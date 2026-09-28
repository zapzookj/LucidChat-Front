import { useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X, Sparkles, ArrowRight } from "lucide-react";
import { savePendingAction } from "../../utils/postLogin";
import useOverlayFocus from "../mobile/useOverlayFocus";
import "../../styles/aurora-secondary.css";

/**
 * [블록 A R2] 로그인 게이트 모달 — 게스트가 '행동'(대화 시작·스튜디오·보관함 등)을
 * 시도했을 때 뜨는 부드러운 관문. 저장된 액션은 로그인 후 postLogin이 복원한다.
 * 스타일은 로비 토큰 정합(디자인 정본 화면 8 §7 — 기존 컴포넌트 재사용 + 토큰 정합만).
 * 사운드 정책: 클릭 SFX 없음(결정적 순간 아님).
 *
 * Props(계약 불변):
 *   gate    — { action, title?, message? } | null. action은 postLogin 액션 형태.
 *   onClose — 닫기(둘러보기 계속)
 */
export default function GuestLoginGate({ gate, onClose }) {
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  useOverlayFocus(Boolean(gate), dialogRef, onClose);
  if (!gate) return null;

  const title = gate.title || "로그인이 필요해요";
  const message =
    gate.message || "캐릭터와 대화하려면 로그인이 필요해요. 로그인하면 바로 이어서 시작돼요.";

  const handleLogin = () => {
    if (gate.action) savePendingAction(gate.action);
    navigate("/login");
  };

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 bg-[#080d1d]/75 backdrop-blur-md"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <motion.div
        ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="guest-gate-title" aria-describedby="guest-gate-message" tabIndex={-1}
        className="aurora-gate relative z-10 w-full max-w-[420px] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-[28px] border border-white/15 p-7 sm:p-8 outline-none"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.22 }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-11 h-11 rounded-full flex items-center justify-center text-lobby-tx2 hover:bg-white/5 hover:text-white transition-colors"
          aria-label="닫기"
        >
          <X size={16} />
        </button>

        <div className="mb-4 pt-1">
          <span className="flex items-center justify-center w-14 h-14 mb-6 rounded-[20px] border border-lobby-accent/20 bg-gradient-to-br from-lobby-accent/15 to-lobby-teal/10">
            <Sparkles size={23} strokeWidth={1.5} className="text-lobby-accent" />
          </span>
          <h3 id="guest-gate-title" className="break-keep text-[23px] leading-snug font-semibold text-lobby-tx0 tracking-tight">{title}</h3>
        </div>

        <p id="guest-gate-message" className="break-keep text-sm text-lobby-tx1 leading-[1.8] mb-7">{message}</p>

        <button
          onClick={handleLogin}
          className="aurora-secondary-primary w-full py-3.5 px-5 rounded-2xl text-sm font-bold flex items-center justify-between gap-3"
        >
          로그인하고 계속하기
          <ArrowRight size={17} />
        </button>
        <button
          onClick={onClose}
          className="w-full mt-2.5 min-h-11 text-sm text-lobby-tx1 hover:text-lobby-tx0 transition-colors"
        >
          조금 더 둘러볼게요
        </button>
      </motion.div>
    </motion.div>
  );
}
