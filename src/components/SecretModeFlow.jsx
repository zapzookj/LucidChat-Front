import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock, Shield, Sparkles, Crown, Key, Moon, ArrowRight, X } from "lucide-react";
import api from "../api/axios";
import AdultVerificationModal from "./AdultVerificationModal";

/**
 * SecretModeFlow — 시크릿 모드 해금 상태머신
 *
 * [Flow]
 * 1. CHECK_ADULT    → isAdult=false면 인증 모달
 * 2. CHECK_ACCESS   → API로 접근 권한 확인
 * 3. NEED_PURCHASE  → 상점 유도
 * 4. GRANTED        → 시크릿 모드 활성화
 *
 * [Usage]
 * <SecretModeFlow
 *   isOpen={showSecretFlow}
 *   onClose={() => setShowSecretFlow(false)}
 *   onGranted={() => { toggleSecretMode(); }}
 *   onOpenStore={(tab) => { setStoreTab(tab); setShowStore(true); }}
 *   userInfo={userInfo}
 *   characterId={currentCharId}
 * />
 */
const SecretModeFlow = ({
  isOpen,
  onClose,
  onGranted,
  onOpenStore,
  userInfo,
  characterId,
}) => {
  const [step, setStep] = useState("idle"); // idle | check_adult | check_access | need_purchase | granted
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [accessStatus, setAccessStatus] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setStep("idle");
      setAccessStatus(null);
      return;
    }
    startFlow();
  }, [isOpen]);

  const startFlow = useCallback(async () => {
    // Step 1: Adult check
    if (!userInfo?.isAdultVerified) {
      setStep("check_adult");
      setShowVerifyModal(true);
      return;
    }

    // Step 2: Access check
    setStep("check_access");
    await checkAccess();
  }, [userInfo, characterId]);

  const checkAccess = async () => {
    try {
      const { data } = await api.get(`/users/secret-status?characterId=${characterId}`);
      setAccessStatus(data);

      if (data.canAccess) {
        setStep("granted");
        // 자동으로 활성화
        setTimeout(() => {
          onGranted?.();
          onClose();
        }, 1500);
      } else {
        setStep("need_purchase");
      }
    } catch {
      setStep("need_purchase");
    }
  };

  const handleVerified = useCallback(async () => {
    setShowVerifyModal(false);
    // 인증 성공 → 접근 권한 체크로 자동 진행
    setStep("check_access");
    await checkAccess();
  }, [characterId]);

  const handleOpenStore = () => {
    onClose();
    onOpenStore?.("secret");
  };

  if (!isOpen && !showVerifyModal) return null;

  return (
    <>
      {/* Adult Verification Modal */}
      <AdultVerificationModal
        isOpen={showVerifyModal}
        onClose={() => {
          setShowVerifyModal(false);
          onClose();
        }}
        onVerified={handleVerified}
      />

      {/* Main Flow Modal */}
      <AnimatePresence>
        {isOpen && step !== "idle" && !showVerifyModal && (
          <motion.div
            className="fixed inset-0 z-[150] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <motion.div
              className="relative z-10 w-[90vw] max-w-sm rounded-2xl p-6 border border-white/10"
              style={{
                background: "linear-gradient(145deg, rgba(25,15,45,0.97), rgba(40,20,65,0.95))",
                boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
              }}
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
            >
              {/* Checking access */}
              {step === "check_access" && (
                <div className="text-center py-8">
                  <motion.div
                    className="w-10 h-10 border-2 border-purple-400/30 border-t-purple-400 rounded-full mx-auto mb-4"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  <p className="text-white/60 text-sm">접근 권한을 확인하는 중...</p>
                </div>
              )}

              {/* Need purchase */}
              {step === "need_purchase" && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-5">
                    <Lock size={28} className="text-purple-400" />
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2">시크릿 모드 해금 필요</h3>
                  <p className="text-white/50 text-sm mb-6 leading-relaxed">
                    시크릿 모드를 이용하려면<br />
                    해금권을 구매해야 합니다.
                  </p>

                  <div className="space-y-3">
                    {/* Quick options */}
                    <button
                      onClick={handleOpenStore}
                      className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/20 hover:border-purple-400/40 transition group"
                    >
                      <div className="flex items-center gap-3">
                        <Moon size={18} className="text-purple-400" />
                        <div className="text-left">
                          <p className="text-white text-sm font-medium">시크릿 패키지 보기</p>
                          <p className="text-white/30 text-[11px]">24시간 패스 · 영구 해금</p>
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-white/30 group-hover:text-white/60 transition" />
                    </button>

                    <button
                      onClick={() => { onClose(); onOpenStore?.("pass"); }}
                      className="w-full flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition group"
                    >
                      <div className="flex items-center gap-3">
                        <Crown size={18} className="text-rose-400" />
                        <div className="text-left">
                          <p className="text-white text-sm font-medium">미드나잇 패스 구독</p>
                          <p className="text-white/30 text-[11px]">모든 캐릭터 시크릿 상시 개방</p>
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-white/30 group-hover:text-white/60 transition" />
                    </button>
                  </div>

                  <button
                    onClick={onClose}
                    className="mt-5 text-white/30 text-xs hover:text-white/50 transition"
                  >
                    나중에 하기
                  </button>
                </div>
              )}

              {/* Granted */}
              {step === "granted" && (
                <div className="text-center py-4">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20"
                  >
                    <Unlock size={28} className="text-white" />
                  </motion.div>

                  {/* Confetti */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(16)].map((_, i) => (
                      <motion.div
                        key={i}
                        className={`absolute w-1.5 h-1.5 rounded-full ${
                          ["bg-purple-400", "bg-pink-400", "bg-amber-400", "bg-cyan-400"][i % 4]
                        }`}
                        initial={{ x: "50%", y: "30%", opacity: 0, scale: 0 }}
                        animate={{
                          x: `${15 + Math.random() * 70}%`,
                          y: `${Math.random() * 100}%`,
                          opacity: [0, 1, 0],
                          scale: [0, 1, 0],
                        }}
                        transition={{
                          duration: 1.2 + Math.random() * 0.8,
                          delay: Math.random() * 0.3,
                        }}
                      />
                    ))}
                  </div>

                  <motion.h3
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-lg font-bold text-white mb-1"
                  >
                    시크릿 모드 해금!
                  </motion.h3>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-purple-300 text-sm"
                  >
                    새로운 가능성이 열립니다
                  </motion.p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SecretModeFlow;