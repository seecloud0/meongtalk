import { useState, useEffect } from 'react';

export default function SpeechBubble({ text }) {
    const [displayedText, setDisplayedText] = useState('');

    useEffect(() => {
        setDisplayedText('');
        if (!text) return;

        console.log("SpeechBubble received text:", text); // 디버깅용 로그
        const chars = Array.from(text);
        let currentIndex = 0;

        const timer = setInterval(() => {
            if (currentIndex < chars.length) {
                // prev 대신에 chars의 누적합으로 정확히 떨어지도록 설정
                setDisplayedText(chars.slice(0, currentIndex + 1).join(''));
                currentIndex++;
            } else {
                clearInterval(timer);
            }
        }, 80); // 타이핑 속도 (ms)

        return () => clearInterval(timer);
    }, [text]);

    return (
        <div className="speech-bubble">
            <p className="speech-text font-cute">{displayedText}</p>
        </div>
    );
}
