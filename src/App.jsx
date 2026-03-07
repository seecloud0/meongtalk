import { useState, useEffect, useRef } from 'react';
import UploadArea from './components/UploadArea';
import SpeechBubble from './components/SpeechBubble';
import SettingsModal from './components/SettingsModal';
import { fileToBase64, generateDogSpeech, generateAudioFromText } from './services/aiService';

// MVP용 가상 데이터 (추후 AI로 대체)
// const FAKE_SPEECHES = [
//   "나 밥 줘라 멍! 🍖",
//   "주인아 산책 안 가냐 멍? 🐕‍🦺",
//   "오늘 나 엄청 귀엽지? 칭찬해 멍! ✨"
// ];

function App() {
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'result'
  const [loadingMsg, setLoadingMsg] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [speech, setSpeech] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);

  // 모달 제어 및 API 키 상태
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasApiKeys, setHasApiKeys] = useState(false);

  useEffect(() => {
    checkApiKeys();
  }, []);

  const checkApiKeys = () => {
    const gemini = localStorage.getItem('geminiKey');
    const elevenLabs = localStorage.getItem('elevenLabsKey');
    setHasApiKeys(!!gemini && !!elevenLabs);
  };

  const handleImageUpload = async (file, previewUrl) => {
    if (!hasApiKeys) {
      alert("먼저 우측 상단 ⚙️ 버튼을 눌러 API Key를 입력해주세요!");
      setIsSettingsOpen(true);
      return;
    }

    try {
      setImageUrl(previewUrl);
      setStatus('loading');

      // 1. 이미지 Base64 변환
      setLoadingMsg('강아지 표정 분석 중... 📸');
      const base64Img = await fileToBase64(file);

      // 2. Gemini 대사 생성 (JSON 파싱 후 순수 텍스트 반환됨)
      setLoadingMsg('어울리는 대사 쓰는 중... ✍️');
      const generatedText = await generateDogSpeech(base64Img);

      console.log("🐶 생성된 대사:", generatedText); // 디버깅용 로그
      setSpeech(generatedText);

      // 3. ElevenLabs 음성 생성
      setLoadingMsg('목소리 입히는 중... 🎙️');
      const audioBlobUrl = await generateAudioFromText(generatedText);
      setAudioUrl(audioBlobUrl);

      // 4. 완료 처리 (화면에 결과 렌더링)
      setStatus('result');

      // (주의) React가 DOM에 <audio> 태그를 그리고 난 뒤 재생해야 하므로 넉넉하게 딜레이 부여
      setTimeout(() => {
        if (audioRef.current) {
          // 오디오 소스가 제대로 로드되도록 load() 호출 후 play()
          audioRef.current.load();
          audioRef.current.play().catch(e => {
            console.error("오디오 자동 재생 실패 (브라우저 정책 제한일 수 있음):", e);
            // 안드로이드/크롬 정책상 자동재생이 막힐 수 있다는 안내도 고려할 수 있으나,
            // 보통 업로드 버튼(사용자 제스처) 이후라 재생이 허용되어야 정상입니다.
          });
        }
      }, 500);

    } catch (error) {
      console.error(error);
      alert("AI 변환 중 오류가 발생했습니다: \n" + error.message);
      resetApp();
    }
  };

  const resetApp = () => {
    setImageUrl(null);
    setSpeech('');
    setAudioUrl(null);
    setStatus('idle');
  };

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      <button
        className="settings-btn"
        onClick={() => setIsSettingsOpen(true)}
        title="API 설정"
      >
        ⚙️
      </button>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={() => checkApiKeys()}
      />

      <header className="title-header">
        <h1 className="font-cute">멍토크 🐾</h1>
        <p>우리집 강아지의 속마음 엿보기</p>
      </header>

      <main className="card-glass" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {status === 'idle' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <UploadArea onImageUpload={handleImageUpload} />
          </div>
        )}

        {(status === 'loading' || status === 'result') && (
          <div className="preview-container">
            <img src={imageUrl} alt="Uploaded Dog" className="preview-image" />

            {status === 'loading' && (
              <div className="loading-overlay">
                <div className="spinner"></div>
                <h3 className="font-cute" style={{ color: 'var(--color-primary)' }}>
                  {loadingMsg}
                </h3>
              </div>
            )}

            {status === 'result' && (
              <SpeechBubble text={speech} />
            )}
          </div>
        )}

        {status === 'result' && (
          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <audio
              ref={audioRef}
              src={audioUrl}
              controls
              autoPlay
              style={{ width: '100%', maxWidth: '300px' }}
            />
            <button className="btn-primary" onClick={resetApp}>
              다시 해보기 🔄
            </button>
          </div>
        )}

      </main>

      <footer style={{ textAlign: 'center', marginTop: '32px', color: 'var(--color-text-mutted)', fontSize: '0.85rem' }}>
        <p>© 2026 MeongTalk MVP version</p>
      </footer>
    </div>
  );
}

export default App;
// End of file
