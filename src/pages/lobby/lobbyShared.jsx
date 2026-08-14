import { motion } from "framer-motion";

/**
 * [블록 A] 로비 공용 조각 — 구 LobbyPage에서 이식.
 * 사운드 정책(docs/14 §B): 호버·클릭 SFX 전수 제거 — '결정적 순간'(대화 시작·온보딩 선택)만
 * 호출부에서 chime. 카드 자체는 무음.
 */

// ── 별 파티클 (야간 배경) ──
export const ShootingStar = ({ delay, startX, startY }) => (
  <motion.div
    className="absolute w-[2px] h-[2px] bg-white rounded-full pointer-events-none"
    style={{ left: `${startX}%`, top: `${startY}%` }}
    initial={{ opacity: 0, x: 0, y: 0 }}
    animate={{ opacity: [0, 1, 1, 0], x: [0, 120, 200], y: [0, 80, 140] }}
    transition={{ duration: 1.8, delay, repeat: Infinity, repeatDelay: Math.random() * 12 + 8, ease: "easeOut" }}
  >
    <div className="absolute w-[60px] h-[1px] bg-gradient-to-l from-white/80 to-transparent -left-[60px] top-0" />
  </motion.div>
);

export const TwinkleStar = ({ style }) => (
  <motion.div
    className="absolute w-[2px] h-[2px] bg-white rounded-full pointer-events-none"
    style={style}
    animate={{ opacity: [0.15, 0.7, 0.15], scale: [0.8, 1.2, 0.8] }}
    transition={{ duration: Math.random() * 3 + 2, repeat: Infinity, delay: Math.random() * 5 }}
  />
);

export const formatRelativeTime = (d) => {
  if (!d) return "";
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const dy = Math.floor(h / 24);
  if (dy < 7) return `${dy}일 전`;
  return new Date(d).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
};
