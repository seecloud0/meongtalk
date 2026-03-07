import { useState, useEffect } from 'react';

export default function SettingsModal({ isOpen, onClose, onSave }) {
    const [geminiKey, setGeminiKey] = useState('');
    const [elevenLabsKey, setElevenLabsKey] = useState('');

    // 모달이 열릴 때 로컬 스토리지에서 키를 불러옴
    useEffect(() => {
        if (isOpen) {
            setGeminiKey(localStorage.getItem('geminiKey') || '');
            setElevenLabsKey(localStorage.getItem('elevenLabsKey') || '');
        }
    }, [isOpen]);

    const handleSave = () => {
        localStorage.setItem('geminiKey', geminiKey.trim());
        localStorage.setItem('elevenLabsKey', elevenLabsKey.trim());
        onSave({ geminiKey: geminiKey.trim(), elevenLabsKey: elevenLabsKey.trim() });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content card-glass">
                <div className="modal-header">
                    <h2 className="font-cute" style={{ color: 'var(--color-primary)' }}>⚙️ API 설정</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-body">
                    <p style={{ fontSize: '0.9rem', marginBottom: '20px', color: 'var(--color-text-mutted)' }}>
                        멍토크를 사용하려면 각 서비스의 API Key가 필요합니다.<br />
                        (입력하신 키는 브라우저에만 저장되며 외부로 전송되지 않습니다.)
                    </p>

                    <div className="input-group">
                        <label>Google Gemini API Key (Vision 모델용)</label>
                        <input
                            type="password"
                            placeholder="AIza..."
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                        />
                    </div>

                    <div className="input-group">
                        <label>ElevenLabs API Key (음성 합성용)</label>
                        <input
                            type="password"
                            placeholder="Enter your key..."
                            value={elevenLabsKey}
                            onChange={(e) => setElevenLabsKey(e.target.value)}
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn-primary" style={{ width: '100%' }} onClick={handleSave}>
                        저장하기 💾
                    </button>
                </div>
            </div>
        </div>
    );
}
