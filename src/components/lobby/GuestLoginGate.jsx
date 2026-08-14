import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X, Sparkles } from "lucide-react";
import { savePendingAction } from "../../utils/postLogin";

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
      className="fixed inset-0 z-[90] flex items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <motion.div
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/[0.09] bg-[#12121a]/95 backdrop-blur-xl p-7 shadow-[0_0_80px_rgba(167,139,250,0.18)]"
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-lobby-tx2 hover:text-white transition-colors"
          aria-label="닫기"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-full border border-violet-400/25 bg-gradient-to-br from-violet-300/15 to-sky-300/10">
            <Sparkles size={16} className="text-violet-300" />
          </span>
          <h3 className="text-lb-sec text-white tracking-tight">{title}</h3>
        </div>

        <p className="text-lb-meta text-lobby-tx1 leading-relaxed mb-6">{message}</p>

        <button
          onClick={handleLogin}
          className="w-full py-3 rounded-xl text-lb-meta font-bold text-slate-900 bg-gradient-to-r from-violet-300 to-sky-300 hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(167,139,250,0.35)] transition-all"
        >
          로그인하고 계속하기
        </button>
        <button
          onClick={onClose}
          className="w-full mt-2.5 py-2 text-lb-meta text-lobby-tx2 hover:text-lobby-tx1 underline underline-offset-[3px] transition-colors"
        >
          조금 더 둘러볼게요
        </button>
      </motion.div>
    </motion.div>
  );
}
