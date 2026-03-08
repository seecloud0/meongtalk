export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb',
        },
    },
};

const ipRequestCache = new Map();
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
    // CORS 처리 (필요 시)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (clientIp !== 'unknown') {
        const record = ipRequestCache.get(clientIp) || { count: 0, firstRequest: now };

        if (now - record.firstRequest > RATE_LIMIT_WINDOW_MS) {
            record.count = 1;
            record.firstRequest = now;
        } else {
            record.count += 1;
        }

        ipRequestCache.set(clientIp, record);

        if (record.count > RATE_LIMIT_MAX) {
            return res.status(429).json({
                error: `하루 최대 ${RATE_LIMIT_MAX}번 제한을 초과했습니다. 내일 다시 시도해주세요 🐶`
            });
        }
    }

    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) {
            return res.status(400).json({ error: 'imageBase64 데이터가 필요합니다.' });
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

        if (!GEMINI_API_KEY || !ELEVENLABS_API_KEY) {
            return res.status(500).json({ error: '서버 환경 변수(API Key)가 설정되지 않았습니다.' });
        }

        // --- 1. Gemini API 호출 ---
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const base64Data = imageBase64.split(',')[1] || imageBase64; // Data URL 예외 처리

        // 프롬프트: 7살 꼬마 느낌
        const prompt = "너는 이 강아지야. 7살 어린아이의 말투로, 이 사진의 상황에 대해 짧고 귀엽게 딱 한 문장(30자 이내)으로 말해줘. 존댓말을 써줘. 따옴표 없이 말해줘.";

        const geminiRes = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt },
                            { inlineData: { mimeType: "image/jpeg", data: base64Data } }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 60,
                }
            })
        });

        if (!geminiRes.ok) {
            const errTxt = await geminiRes.text();
            return res.status(502).json({ error: `Gemini API 에러: ${errTxt}` });
        }

        const geminiData = await geminiRes.json();
        let generatedText = "멍멍! 나 지금 신났어요!";
        try {
            if (geminiData.candidates && geminiData.candidates.length > 0) {
                generatedText = geminiData.candidates[0].content.parts[0].text.trim();
                // 앞뒤 따옴표 제거
                generatedText = generatedText.replace(/^["']|["']$/g, '');
            }
        } catch (e) {
            console.error("Gemini Parse Error:", e);
        }

        // --- 2. ElevenLabs TTS API 호출 ---
        const MY_DOG_VOICE_ID = "jBpfuIE2acCO8z3wKNLl"; // Gigi (어린아이 목소리)
        const paddedText = "... " + generatedText;

        const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${MY_DOG_VOICE_ID}?output_format=mp3_44100_128`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY
            },
            body: JSON.stringify({
                text: paddedText,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                    stability: 0.25,
                    similarity_boost: 1.0,
                    style: 0.9,
                    use_speaker_boost: true
                }
            })
        });

        if (!ttsRes.ok) {
            const errTxt = await ttsRes.text();
            return res.status(502).json({ error: `ElevenLabs API 에러: ${errTxt}` });
        }

        // 오디오 데이터를 Base64로 전송
        const arrayBuffer = await ttsRes.arrayBuffer();
        const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

        // 최종 응답 반환
        return res.status(200).json({
            success: true,
            speech: generatedText,
            audioBase64: `data:audio/mp3;base64,${audioBase64}`
        });

    } catch (error) {
        console.error("Server API Error:", error);
        return res.status(500).json({ error: "서버 내부 오류 발생" });
    }
}
