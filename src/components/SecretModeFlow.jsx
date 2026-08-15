import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock, Crown, Moon, ArrowRight, UserRound } from "lucide-react";
import api from "../api/axios";
import AdultVerificationModal from "./AdultVerificationModal";
import { fetchProfile, updateProfile } from "../api/PersonaApi";
import { sfx } from "../utils/sfx";

/**
 * SecretModeFlow — 시크릿 모드 해금 상태머신
 *
 * [Flow]
 * 1. CHECK_ADULT    → isAdult=false면 인증 모달
 * 2. CHECK_ACCESS   → API로 접근 권한 확인
 * 2.5 PERSONA_AGE   → [블록 B] 페르소나 프로필 나이<19(미설정 포함)면 수정 제안 모달
 *                     (UX는 부드럽게, 게이트는 서버 하드 — 수정 없인 활성 불가)
 * 3. NEED_PURCHASE  → 상점 유도
 * 4. GRANTED        → 시크릿 모드 활성화
 *
 * [Phase 7-V2 BM 피벗]
 *   - 시크릿 모드 BM이 user-global로 통합 — 캐릭터별 해금 폐기.
 *   - characterId prop은 V1 호환을 위해 *받아만 두고 무시*. UI 텍스트도 user-wide 톤.
 *   - API 호출: GET /users/secret-status (쿼리 파라미터 없음, user-global 응답).
 *
 * [Usage]
 * <SecretModeFlow
 *   isOpen={showSecretFlow}
 *   onClose={() => setShowSecretFlow(false)}
 *   onGranted={() => { toggleSecretMode(); }}
 *   onOpenStore={(tab) => { setStoreTab(tab); setShowStore(true); }}
 *   userInfo={userInfo}
 *   characterId={currentCharId}  // V1 호환용 — V2에선 생략 가능. 무시됨.
 * />
 */
const SecretModeFlow = ({
  isOpen,
  onClose,
  onGranted,
  onOpenStore,
  userInfo,
  characterId, // eslint-disable-line no-unused-vars  -- V1 호환용, 무시됨
}) => {
  const [step, setStep] = useState("idle"); // idle | check_adult | check_access | persona_age | need_purchase | granted
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [accessStatus, setAccessStatus] = useState(null);
  // [블록 B] 페르소나 나이 수정 제안 — 프로필 드래프트
  const [profileDraft, setProfileDraft] = useState(null);
  const [ageInput, setAgeInput] = useState("");
  const [ageSaving, setAgeSaving] = useState(false);
  const [ageError, setAgeError] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setStep("idle");
      setAccessStatus(null);
      return;
    }
    sfx.wooshLight();
    startFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (step === "granted") sfx.sparkle();
  }, [step]);

  const startFlow = useCallback(async () => {
    // Step 1: Adult check
    if (!userInfo?.isAdultVerified) {
      setStep("check_adult");
      setShowVerifyModal(true);
      return;
    }

    // Step 2: Access check (user-global)
    setStep("check_access");
    await checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo]);

  const checkAccess = async () => {
    try {
      // [Phase 7-V2 BM 피벗] characterId 쿼리 제거 — user-global 응답.
      // 백엔드 GET /users/secret-status는 characterId를 받아도 무시한다.
      const { data } = await api.get("/users/secret-status");
      setAccessStatus(data);

      if (data.canAccess) {
        setStep("granted");
        // 자동으로 활성화
        setTimeout(() => {
          onGranted?.();
          onClose();
        }, 1500);
      } else if (data.accessReason === "PERSONA_UNDERAGE") {
        // [블록 B] 페르소나 나이 게이트 — 수정 제안 모달로 (서버가 하드 차단 중)
        setStep("persona_age");
        await loadProfileForAgeEdit();
      } else {
        setStep("need_purchase");
      }
    } catch {
      setStep("need_purchase");
    }
  };

  // [블록 B 리뷰픽스] 프로필 로드 실패가 데드엔드가 되지 않게 — 에러 표시 + 재시도 가능
  const loadProfileForAgeEdit = async () => {
    setAgeError(null);
    try {
      const profile = await fetchProfile();
      setProfileDraft(profile);
      setAgeInput(profile?.age ?? "");
    } catch {
      setProfileDraft(null);
      setAgeError("프로필을 불러오지 못했어요. 다시 시도해 주세요.");
    }
  };

  // [블록 B] 프로필 나이만 수정하고 접근 재확인
  const handleAgeSave = async () => {
    if (ageSaving || !profileDraft) return;
    setAgeSaving(true);
    setAgeError(null);
    try {
      await updateProfile({
        name: profileDraft.name,
        age: ageInput === "" ? null : Number(ageInput),
        gender: profileDraft.gender,
        personaText: profileDraft.personaText,
        allure: profileDraft.allure, friendliness: profileDraft.friendliness,
        trust: profileDraft.trust, charisma: profileDraft.charisma, mystique: profileDraft.mystique,
      });
      setStep("check_access");
      await checkAccess();
    } catch (e) {
      setAgeError(e?.response?.data?.message || "나이 수정에 실패했어요.");
    } finally {
      setAgeSaving(false);
    }
  };

  const handleVerified = useCallback(async () => {
    setShowVerifyModal(false);
    // 인증 성공 → 접근 권한 체크로 자동 진행
    setStep("check_access");
    await checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenStore = () => {
    sfx.click();
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

              {/* [블록 B] Persona age gate — 수정 제안 (서버가 하드 차단 중) */}
              {step === "persona_age" && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
                    <UserRound size={28} className="text-amber-400" />
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2">성인 페르소나가 필요해요</h3>
                  <p className="text-white/50 text-sm mb-5 leading-relaxed">
                    시크릿 모드는 성인 페르소나로만 이용할 수 있어요.<br />
                    프로필의 나이를 수정할까요?
                  </p>

                  <div className="flex items-center justify-center gap-2 mb-2">
                    <input
                      type="number" min={1} max={120}
                      value={ageInput}
                      placeholder="나이"
                      onChange={(e) => setAgeInput(e.target.value)}
                      className="w-24 bg-white/[0.06] border border-white/15 rounded-xl px-3 py-2.5 text-center text-white text-sm outline-none focus:border-amber-400/60"
                    />
                    <span className="text-white/40 text-sm">세</span>
                  </div>
                  {ageError && <p className="text-rose-300 text-xs mb-2">{ageError}</p>}

                  {/* [리뷰픽스] 프로필 로드 실패 시 버튼이 재시도로 전환 — 무피드백 데드엔드 방지 */}
                  <button
                    onClick={profileDraft ? handleAgeSave : loadProfileForAgeEdit}
                    disabled={ageSaving || (profileDraft && ageInput === "")}
                    className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white transition disabled:opacity-40"
                  >
                    {ageSaving ? "수정 중…" : profileDraft ? "나이 수정하고 계속" : "프로필 다시 불러오기"}
                  </button>

                  <button
                    onClick={() => { sfx.click(); onClose?.(); }}
                    className="mt-4 text-white/30 text-xs hover:text-white/50 transition"
                  >
                    나중에 하기
                  </button>
                </div>
              )}

              {/* Need purchase */}
              {step === "need_purchase" && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-5">
                    <Lock size={28} className="text-purple-400" />
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2">시크릿 모드 해금 필요</h3>
                  {/* [BM 피벗] 텍스트 톤도 user-global로 정리 — 캐릭터별 → 모든 캐릭터 한 번에 */}
                  <p className="text-white/50 text-sm mb-6 leading-relaxed">
                    시크릿 모드는 한 번 해금하면<br />
                    모든 캐릭터에 적용됩니다.
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
                      onClick={() => { sfx.click(); onClose(); onOpenStore?.("pass"); }}
                      className="w-full flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition group"
                    >
                      <div className="flex items-center gap-3">
                        <Crown size={18} className="text-rose-400" />
                        <div className="text-left">
                          <p className="text-white text-sm font-medium">미드나잇 패스 구독</p>
                          <p className="text-white/30 text-[11px]">시크릿 모드 상시 개방 + 무제한 에너지</p>
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-white/30 group-hover:text-white/60 transition" />
                    </button>
                  </div>

                  <button
                    onClick={() => { sfx.click(); onClose?.(); }}
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