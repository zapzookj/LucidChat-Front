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
      const handleMessage = async (event) => {
        // Validate origin in production
        if (event.data && event.data.type === 'NICE_VERIFY_RESULT') {
          window.removeEventListener('message', handleMessage);

          try {
            const result = await axios.post('/verify/success', {
              requestNo: requestNo,
              encData: event.data.encData,
              tokenVersionId: tokenVersionId,
            });

            if (result.data.success) {
              sfx.chime();
              setStep('success');
              setTimeout(() => {
                onVerified && onVerified();
                onClose();
              }, 1500);
            } else {
              sfx.thud();
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
          window.removeEventListener('message', handleMessage);
          if (step === 'loading') {
            setStep('intro');
          }
        }
      }, 1000);

    } catch (err) {
      sfx.thud();
      setStep('error');
      setErrorMsg(err.response?.data?.message || 'Failed to start verification');
    }
  }, [onClose, onVerified, step]);

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