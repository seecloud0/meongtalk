/**
 * AI Service 모듈
 * OpenAI와 ElevenLabs API를 호출하여 강아지 대사를 만들고 음성으로 변환합니다.
 */

// 파일 객체를 Base64 문자열로 변환하는 유틸리티
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};

/**
 * Google Gemini API 연동 (이미지 -> 텍스트)
 */
export const generateDogSpeech = async (base64Image, overridePrompt) => {
    const apiKey = localStorage.getItem('geminiKey');
    if (!apiKey) throw new Error("Google Gemini API Key가 설정되지 않았습니다.");

    const defaultPrompt = `
당신은 사진 속 귀엽고 똑똑한 7살 어린이 수준의 지능을 가진 반려견입니다.
사진을 보고 주인에게 하고 싶은 말을 '7살 어린이의 발랄하고 매끄러운 말투'로 오직 '완벽하게 끝나는 한 문장'으로 짧게 말해주세요.

[지시사항]
1. 단어 단어 뚝뚝 끊기게 말하지 말고, 호흡이 매끄러운 한 문장으로 유창하게 말할 것.
2. 7살 아이 특유의 순수하고 호기심 많고 통통 튀는 감성을 담아 말할 것 (너무 발음을 뭉개지 않고 또박또박 말하되 귀엽게).
3. 쉼표(,)나 말줄임표(...) 같은 기호는 아예 사용하지 말 것.
4. 문장이 중간에 절대 끊기지 않도록 완벽하게 의미를 맺을 것. 전체 길이는 반드시 공백 포함 **30글자 이내**로 아주 짧게 제한할 것.
5. 앞뒤에 다른 말이나 설명 달지 말고, 대문자/소문자/따옴표 없이 대사만 적고 마지막엔 무조건 "~멍!" 으로 끝낼 것.

예시:
우아아 주인님 얼른 저랑 밖에 나가서 신나게 뛰어놀아요 멍!
  `;

    const prompt = overridePrompt || defaultPrompt;

    // data:image/jpeg;base64,... 형식에서 마임 타입과 데이터만 추출
    const mimeMatch = base64Image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = base64Image.split(',')[1];

    const basePath = 'https://generativelanguage.googleapis.com/v1beta/models/';
    // 구글의 신규 가입자 모델 제한(1.5, 2.0 기존 모델 차단)에 따라 완전한 최신 모델인 gemini-2.5-flash를 사용합니다.
    const response = await fetch(`${basePath}gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data
                        }
                    }
                ]
            }],
            generationConfig: {
                maxOutputTokens: 800, // 토큰 제한을 매우 넉넉하게 설정
                temperature: 0.7 // 창의성과 완성도의 밸런스 조정
            }
        })
    });

    if (!response.ok) {
        let errorMsg = response.status;
        try {
            const err = await response.json();
            errorMsg = err.error?.message || response.status;
        } catch (e) { }

        if (response.status === 429 || String(errorMsg).includes("quota")) {
            throw new Error(`[API 할당량 초과] ${errorMsg}`);
        }
        throw new Error(`Gemini API 에러: ${errorMsg}`);
    }

    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) {
        throw new Error("결과를 만들어내지 못했습니다.");
    }

    // 구조 분해 할당 및 옵셔널 체이닝으로 안전하게 텍스트 추출
    const partsArray = data.candidates[0]?.content?.parts;
    if (!partsArray || partsArray.length === 0) {
        throw new Error("응답에서 텍스트를 찾을 수 없습니다.");
    }

    const fullText = partsArray.map(p => p.text || '').join('').trim();

    // 부가적인 마크다운이나 앞뒤에 붙은 불필요 기호, 엔터 공백 치환
    let cleanText = fullText.replace(/[\r\n]+/g, ' ').replace(/^["']|["']$/g, '').trim();

    // 생성된 대사 끝부분이 자연스럽게 안 끝났을 경우 (잘림 방어)
    // "~멍!", "~왈!" 등 특정 종결어미가 없으면 강제로 붙여줌
    const endsWithDogSound = /멍!$|왈!$|멍\.$|왈\.$|멍\s?$|왈\s?$|여!$|요!$|다!$/.test(cleanText);

    if (!endsWithDogSound && cleanText.length > 5) {
        // 문장이 애매하게 끊겼다면 말끝을 흐리는 느낌인 "...멍!" 추가
        cleanText += "... 멍!";
    }

    return cleanText;
};

/**
 * ElevenLabs TTS API 연동 (텍스트 -> 음성 Blob)
 */
export const generateAudioFromText = async (text) => {
    const apiKey = localStorage.getItem('elevenLabsKey');
    if (!apiKey) throw new Error("ElevenLabs API Key가 설정되지 않았습니다.");

    // 강아지/어린아이 역할로 어울릴만한 귀여운 목소리 Voice ID
    // Gigi: jBpfuIE2acCO8z3wKNLl (어린 아이 같은 목소리)
    const MY_DOG_VOICE_ID = "jBpfuIE2acCO8z3wKNLl";

    // 하드웨어 스피커(블루투스 등)가 오디오 신호를 받아 깨어나는 데 걸리는 딜레이 때문에
    // 첫 단어가 잘리는 현상을 방지하기 위해 문장 맨 앞에 짧은 묵음(...)을 추가합니다.
    const paddedText = "... " + text;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${MY_DOG_VOICE_ID}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
        },
        body: JSON.stringify({
            text: paddedText,
            model_id: "eleven_multilingual_v2", // 한국어 지원 모델 유지
            voice_settings: {
                stability: 0.25,       // 감정 기복이 크고 통통 튀는 어린아이의 하이톤 연출
                similarity_boost: 1.0, // 원본 아기 목소리(Gigi)와의 유사도를 100%로 강제 (애기톤 극대화)
                style: 0.9,            // 과장된 아기 연기(감정)를 가장 높게 설정
                use_speaker_boost: true
            }
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ElevenLabs API 에러: ${response.status} - ${errText}`);
    }

    // Blob(바이너리 오디오 파일) 반환
    const audioBlob = await response.blob();
    return URL.createObjectURL(audioBlob);
};
