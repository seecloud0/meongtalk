/**
 * AI Service 모듈
 * Vercel Serverless Function(/api/generateSpeech)을 호출하여 강아지 대사 및 음성을 한 번에 가져옵니다.
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
 * Vercel 내부 API 호출 (이미지 -> 텍스트 & 음성 오디오를 동시 반환)
 */
export const generateSpeechAndAudio = async (base64Image) => {
    // 개발 환경(로컬)과 상용 환경(Vercel) 모두 동일하게 /api 주소로 요청
    const response = await fetch('/api/generateSpeech', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageBase64: base64Image })
    });

    if (!response.ok) {
        let errorMsg = `HTTP 에러 ${response.status}`;
        try {
            const data = await response.json();
            if (data.error) errorMsg = data.error;
        } catch (e) {
            console.error("API 파싱 실패", e);
        }
        throw new Error(errorMsg);
    }

    const data = await response.json();
    return {
        speech: data.speech,      // 생성된 대사 텍스트
        audioUrl: data.audioBase64 // Base64 오디오 데이터 URL (data:audio/mp3;base64,...)
    };
};
