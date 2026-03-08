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

        // 기존 프론트엔드에서 사용하던 정밀한 프롬프트 복구
        const prompt = `
당신은 사진 속 귀엽고 똑똑한 7살 어린이 수준의 지능을 가진 반려견입니다.
사진을 보고 주인에게 하고 싶은 말을 '7살 어린이의 발랄하고 매끄러운 말투'로 오직 '완벽하게 끝나는 한 문장'으로 짧게 말해주세요.

[지시사항]
1. 단어 단어 뚝뚝 끊기게 말하지 말고, 호흡이 매끄러운 한 문장으로 유창하게 말할 것.
2. 7살 아이 특유의 순수하고 호기심 많고 통통 튀는 감성을 담아 말할 것.
3. 쉼표(,)나 말줄임표(...) 같은 기호는 아예 사용하지 말 것.
4. 문장이 중간에 절대 끊기지 않도록 완벽하게 의미를 맺을 것. 전체 길이는 반드시 공백 포함 **30글자 이내**로 아주 짧게 제한할 것.
5. 앞뒤에 다른 말이나 설명 달지 말고, 대문자/소문자/따옴표 없이 대사만 적고 마지막엔 무조건 "~멍!" 으로 끝낼 것.

예시:
우아아 주인님 얼른 저랑 밖에 나가서 신나게 뛰어놀아요 멍!`;
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
                    maxOutputTokens: 200, // 토큰이 부족해서 잘리는 것을 방지
                }
            })
        });

        if (!geminiRes.ok) {
            const errTxt = await geminiRes.text();
            return res.status(502).json({ error: `Gemini API 에러: ${errTxt}` });
        }

        const geminiData = await geminiRes.json();
        let generatedText = "멍멍! 나 지금 신났어요 멍!";
        try {
            if (geminiData.candidates && geminiData.candidates.length > 0) {
                let textResult = geminiData.candidates[0].content.parts[0].text;
                // 앞뒤 따옴표, 불필요한 공백/줄바꿈 제거
                textResult = textResult.replace(/[\r\n]+/g, ' ').replace(/^["']|["']$/g, '').trim();

                // 생성된 대사 끝부분이 자연스럽게 안 끝났을 경우 (잘림 방어)
                const endsWithDogSound = /멍!$|왈!$|멍\.$|왈\.$|멍\s?$|왈\s?$|여!$|요!$|다!$/.test(textResult);
                if (!endsWithDogSound && textResult.length > 5) {
                    textResult += "... 멍!";
                }

                generatedText = textResult;
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
