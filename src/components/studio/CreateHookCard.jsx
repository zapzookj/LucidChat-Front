import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

/**
 * [Studio v1] 캐릭터 카루셀 말미 훅 카드 — "나만의 캐릭터"
 *
 * LobbyPage CharacterCard와 같은 폼팩터(260x380 / 300x440)로 카루셀 끝에 끼워 넣는
 * 스튜디오 진입 훅. 어두운 카드 + 점선 보더 + 중앙 실루엣 물음표, hover 시 앰버 글로우.
 */
export default function CreateHookCard({ onClick, onHover }) {
  return (
    <motion.div
      onClick={onClick}
      onMouseEnter={onHover}
      className="relative cursor-pointer flex-shrink-0 select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, scale: 0.78 }}
      whileHover={{ scale: 0.84, transition: { type: "spring", stiffness: 300, damping: 20 } }}
      whileTap={{ scale: 0.76 }}
    >
      <div
        className="group relative w-[260px] h-[380px] sm:w-[300px] sm:h-[440px] rounded-2xl overflow-hidden
                   border border-dashed border-white/20 hover:border-amber-400/50
                   bg-gradient-to-b from-stone-900/90 via-neutral-950 to-black
                   transition-all duration-500 hover:shadow-[0_0_60px_rgba(251,191,36,0.18)]"
      >
        {/* 중앙 실루엣 + 물음표 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 pb-16">
          <div className="relative">
            {/* 인물 실루엣 */}
            <svg width="110" height="150" viewBox="0 0 110 150" className="opacity-60">
              <circle cx="55" cy="42" r="26" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" strokeDasharray="4 4" />
              <path
                d="M 14 148 Q 14 96 55 92 Q 96 96 96 148 Z"
                fill="rgba(255,255,255,0.06)"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            </svg>
            {/* 물음표 */}
            <motion.span
              className="absolute inset-0 flex items-center justify-center text-5xl font-black text-white/25 group-hover:text-amber-300/60 transition-colors duration-500"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            >
              ?
            </motion.span>
          </div>
        </div>

        {/* hover 시 상단 앰버 글로우 라인 */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/70 to-transparent"
          initial={{ scaleX: 0 }}
          whileHover={{ scaleX: 1 }}
          transition={{ duration: 0.4 }}
        />

        {/* 하단 텍스트 */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h3 className="flex items-center gap-2 text-xl font-semibold text-white/80 group-hover:text-amber-100 tracking-wide transition-colors duration-300">
            <Sparkles size={16} className="text-amber-300/70" />
            나만의 캐릭터
          </h3>
          <p className="text-sm text-white/40 mt-1 leading-relaxed">스튜디오에서 소환하기</p>
        </div>
      </div>
    </motion.div>
  );
}
