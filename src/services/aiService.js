/**
 * AI Service 모듈
 * Vercel Serverless Function(/api/generateSpeech)을 호출하여 강아지 대사 및 음성을 한 번에 가져옵니다.
 */

// 파일 객체를 받아와 브라우저 단에서 해상도와 용량을 대폭 줄여 Base64로 반환하는 유틸리티 (HTTP 413 에러 완벽 해결)
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // 스마트폰 최신 사진은 너무 커서, 가로/세로 중 긴 쪽을 800px로 확 줄입니다.
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // JPEG 포맷으로 품질을 60% 로 확 낮춰서 용량을 아주 가볍게(수백KB) 만듭니다.
                // Vercel 무료서버 4.5MB 제한 절대로 안 넘깁니다!
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
                resolve(compressedBase64);
            };
            img.onerror = (error) => reject(error);
        };
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
