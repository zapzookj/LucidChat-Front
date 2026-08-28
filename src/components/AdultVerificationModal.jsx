import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from '../api/axios';
import { sfx } from '../utils/sfx';

/**
 * Phase 5: Adult Verification Modal (NICE API)
 *
 * Flow:
 * 1. User clicks secret mode -> isAdult check
 * 2. If !isAdult -> show this modal
 * 3. Request token from backend -> open NICE popup
 * 4. NICE callback -> send encrypted result to backend
 * 5. Backend verifies age + CI -> mark isAdult = true
 */
const AdultVerificationModal = ({ isOpen, onClose, onVerified }) => {
  const [step, setStep] = useState('intro'); // intro | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) sfx.wooshLight();
  }, [isOpen]);

  const startVerification = useCallback(async () => {
    setStep('loading');
    setErrorMsg('');

    try {
      // Step 1: Get crypto token from backend
      // [docs/13 C-1 픽스] axios 인스턴스 baseURL에 /api/v1이 이미 포함 — 재부착하면 404
      const { data } = await axios.get('/verify/token');
      const { requestNo, tokenVersionId, encData, integrityValue } = data;

      // Step 2: Open NICE popup
      const popup = window.open('', 'nicePopup', 'width=500,height=600,scrollbars=yes');

      if (!popup) {
        setStep('error');
        setErrorMsg('Pop-up blocked. Please allow pop-ups.');
        return;
      }

      // Create form and submit to NICE
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://nice.checkplus.co.kr/CheckPlusSa498';
      form.target = 'nicePopup';

      const fields = {
        m: 'checkplusSerivce',
        token_version_id: tokenVersionId,
        enc_data: encData,
        integrity_value: integrityValue,
      };

      Object.entries(fields).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);

      // Step 3: Listen for callback from popup
      //   발신 측 = /verify/callback 라우트(VerifyCallbackPage). 백엔드
      //   GET|POST /api/v1/verify/callback 가 NICE 결과를 받아 이 SPA 라우트로 302 시킨다.
      //   [C-1.5 · docs/17_assets/defect_register.md] 이전에는 발신자가 리포에 아예 없어
      //   아래 블록 전체가 도달 불가 코드였다.
      let resultReceived = false;

      const handleMessage = async (event) => {
        // [C-1.5 ③] 'Validate origin in production' 주석만 있고 미구현이던 origin 검증.
        //   콜백 페이지는 같은 오리진에서 postMessage 하므로 타 오리진 메시지는 전부 버린다.
        if (event.origin !== window.location.origin) return;
        if (event.data && event.data.type === 'NICE_VERIFY_RESULT') {
          resultReceived = true;
          window.removeEventListener('message', handleMessage);

          // 콜백 브리지가 실패를 통보한 경우(파라미터 누락·NICE 오류 코드) — 서버 호출 없이 종료
          if (event.data.error || !event.data.encData) {
            sfx.thud();
            setStep('error');
            setErrorMsg(event.data.error || '본인확인 결과를 받지 못했습니다. 다시 시도해 주세요.');
            return;
          }

          try {
            const result = await axios.post('/verify/success', {
              requestNo: requestNo,
              encData: event.data.encData,
              tokenVersionId: event.data.tokenVersionId || tokenVersionId,
            });

            if (result.data.success) {
              sfx.chime();
              setStep('success');
              setTimeout(() => {
                onVerified && onVerified();
                onClose();
              }, 1500);
            } else {
              // [E-1.12b · docs/17_assets/defect_register.md:4701]
              //   여기가 비어 있어 서버가 HTTP 200 + success:false를 주면 step이 'loading'에
              //   고착됐다(:72에서 리스너를 이미 뗐으므로 재수신도 불가). 명시적으로 error 전이.
              sfx.thud();
              setStep('error');
              setErrorMsg(result.data.message || '본인확인에 실패했습니다. 다시 시도해 주세요.');
            }
          } catch (err) {
            sfx.thud();
            setStep('error');
            setErrorMsg(err.response?.data?.message || 'Verification failed');
          }
        }
      };

      window.addEventListener('message', handleMessage);

      // Cleanup if popup closed without completing
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          // 결과를 이미 받았으면(POST 진행 중일 수 있음) 단계를 되돌리지 않는다
          if (resultReceived) return;
          window.removeEventListener('message', handleMessage);
          // [E-1.12a · docs/17_assets/defect_register.md:4666]
          //   기존 `if (step === 'loading')`는 **스테일 클로저**였다 — startVerification이
          //   만들어진 렌더의 step은 'intro'라 조건이 영원히 거짓이고, 팝업을 닫으면
          //   'Verification in progress...' 스피너가 영구 고착됐다.
          //   함수형 갱신으로 최신 상태를 읽어 클로저 의존 자체를 제거한다.
          setStep((prev) => (prev === 'loading' ? 'intro' : prev));
        }
      }, 1000);

    } catch (err) {
      sfx.thud();
      setStep('error');
      setErrorMsg(err.response?.data?.message || 'Failed to start verification');
    }
    // [E-1.12a] step을 deps에서 제거했다 — 위 setStep 함수형 갱신으로 최신 상태를 읽으므로
    //   더 이상 step을 캡처할 필요가 없고, 남겨 두면 매 단계 전이마다 콜백이 새로 만들어진다.
  }, [onClose, onVerified]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <motion.div
          className="relative z-10 w-[90vw] max-w-md rounded-2xl p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(30,20,50,0.95), rgba(50,30,80,0.9))',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          }}
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
        >
          {step === 'intro' && (
            <>
              <h2 className="text-xl font-bold text-white mb-3">Adult Verification Required</h2>
              <p className="text-white/70 text-sm mb-4">
                Secret Mode requires adult verification (age 19+).
                Your identity will be verified through NICE authentication.
              </p>
              <p className="text-white/50 text-xs mb-6">
                * CI information is stored as a hash for abuse prevention only.
                No personal data is retained.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { sfx.click(); onClose?.(); }}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { sfx.click(); startVerification(); }}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-500 transition"
                >
                  Verify Now
                </button>
              </div>
            </>
          )}

          {step === 'loading' && (
            <div className="text-center py-8">
              <div className="animate-spin w-10 h-10 border-3 border-purple-400 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-white/70">Verification in progress...</p>
              <p className="text-white/50 text-sm mt-2">Please complete in the popup window.</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">&#x2705;</div>
              <p className="text-white font-bold text-lg">Verification Complete!</p>
              <p className="text-white/70 text-sm mt-2">Secret Mode is now available.</p>
            </div>
          )}

          {step === 'error' && (
            <>
              <div className="text-center py-4">
                <div className="text-4xl mb-3">&#x274C;</div>
                <p className="text-red-400 font-bold">Verification Failed</p>
                <p className="text-white/60 text-sm mt-2">{errorMsg}</p>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => { sfx.click(); onClose?.(); }}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 transition">
                  Close
                </button>
                <button onClick={() => { sfx.click(); setStep('intro'); }}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition">
                  Retry
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AdultVerificationModal;