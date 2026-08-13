import { motion } from "framer-motion";
import { User, Clock, Heart, Star, Play, Drama, BookOpen, Crown } from "lucide-react";
import { assetUrl } from "../../utils/assetUrl";

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

export const isNightTime = () => { const h = new Date().getHours(); return h >= 19 || h < 6; };

// ── 지배 스탯 메타 ──
export const STAT_META = {
  intimacy:    { label: "친밀도", icon: "💬", color: "#60a5fa", gradient: "from-blue-500/60 to-blue-400/60" },
  affection:   { label: "호감도", icon: "💕", color: "#f472b6", gradient: "from-rose-500/60 to-pink-400/60" },
  dependency:  { label: "의존도", icon: "🫂", color: "#a78bfa", gradient: "from-violet-500/60 to-purple-400/60" },
  playfulness: { label: "장난기", icon: "😜", color: "#34d399", gradient: "from-emerald-500/60 to-teal-400/60" },
  trust:       { label: "신뢰도", icon: "🤝", color: "#fbbf24", gradient: "from-amber-500/60 to-yellow-400/60" },
};

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Dialogue 세션 카드 — 기억의 끈 (구 LobbyPage 이식, SFX 제거)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const DialogueRoomCard = ({ room, onSelect }) => {
  const getStatusColor = (s) => ({ LOVER: "text-rose-400", FRIEND: "text-amber-400", ACQUAINTANCE: "text-emerald-400" }[s] || "text-white/50");
  const getModeBadge = (m) =>
    m === "STORY"
      ? { label: "스토리", cls: "bg-amber-400/15 text-amber-300 border-amber-400/30" }
      : { label: "자유", cls: "bg-cyan-400/15 text-cyan-300 border-cyan-400/30" };

  const badge = getModeBadge(room.chatMode);
  const domStatKey = room.dominantStatName || "affection";
  const domStatMeta = STAT_META[domStatKey] || STAT_META.affection;
  const domStatValue =
    room.dominantStatValue !== undefined ? room.dominantStatValue : room.affectionScore;
  const displayRelation = room.dynamicRelationTag || null;

  return (
    <motion.div
      onClick={() => onSelect(room.roomId, room.chatMode)}
      className="relative group p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10 cursor-pointer transition-colors duration-200"
      whileHover={{ scale: 1.01, transition: { type: "spring", stiffness: 400, damping: 25 } }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-start gap-3.5">
        <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white/10 flex-shrink-0 bg-slate-800">
          {room.characterThumbnailUrl
            ? <img src={room.characterThumbnailUrl} alt={room.characterName} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-white/20"><User size={20} /></div>
          }
          {room.endingReached && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-slate-900 border border-white/20">
              <Star size={8} className={room.endingType === "HAPPY" ? "text-amber-400" : "text-rose-400"} fill="currentColor" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm">{room.characterName}</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs leading-none" title={domStatMeta.label}>{domStatMeta.icon}</span>
            <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${domStatMeta.gradient}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(Math.abs(domStatValue), 0)}%` }}
                transition={{ duration: 0.8, delay: 0.1 }}
              />
            </div>
            <span className="text-[10px] text-white/30 w-6 text-right tabular-nums">{domStatValue}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {displayRelation ? (
              <span className="text-[10px] font-medium truncate max-w-[120px]" style={{ color: domStatMeta.color + "99" }}>
                {displayRelation}
              </span>
            ) : (
              <Heart size={10} className={getStatusColor(room.statusLevel)} />
            )}
            <span className="text-[10px] text-white/15 mx-0.5">·</span>
            <Clock size={10} className="text-white/20" />
            <span className="text-[11px] text-white/25">{formatRelativeTime(room.lastActiveAt)}</span>
            {room.endingReached && (
              <span className="text-[10px] text-white/40 ml-auto italic">
                {room.endingTitle || (room.endingType === "HAPPY" ? "해피엔딩" : "배드엔딩")}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors duration-200 mt-1">
          <Play size={12} className="text-white/40 group-hover:text-white/70 transition-colors duration-200 ml-0.5" />
        </div>
      </div>
    </motion.div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Theater 세션 카드 (구 LobbyPage 이식 — baseUrl ReferenceError 크래시 픽스: assetUrl로 교정)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ACT_TITLES = { 1: "Act 1", 2: "Act 2", 3: "Act 3", 4: "Act 4" };

export const TheaterSessionCard = ({ session, onSelect }) => {
  const leadImgUrl =
    session.leadHeroineThumbnailUrl ||
    (session.leadHeroineSlug ? assetUrl(`/characters/${session.leadHeroineSlug}/thumb.jpg`) : null);
  const actLabel = ACT_TITLES[session.currentAct] || `Act ${session.currentAct}`;

  return (
    <motion.div
      onClick={() => onSelect(session.roomId)}
      className="relative group p-4 rounded-xl border border-violet-400/15 bg-violet-500/[0.04] hover:bg-violet-500/[0.08] hover:border-violet-400/30 cursor-pointer transition-colors duration-200"
      whileHover={{ scale: 1.01, transition: { type: "spring", stiffness: 400, damping: 25 } }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-start gap-3.5">
        <div className="relative w-12 h-12 rounded-full overflow-hidden border border-violet-400/30 flex-shrink-0 bg-slate-800">
          {leadImgUrl ? (
            <img src={leadImgUrl} alt={session.leadHeroineName || ""} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-violet-300/50">
              <Drama size={18} />
            </div>
          )}
          {session.endingReached && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-slate-900 border border-amber-400/40">
              <Crown size={8} className="text-amber-400" fill="currentColor" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm truncate max-w-[140px]">
              {session.worldDisplayName || "극장 세션"}
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-violet-400/15 text-violet-200 border-violet-400/30">
              극장
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-white/55">
            <Drama size={10} className="text-violet-300/80" />
            <span className="font-medium text-violet-200/90">{actLabel}</span>
            <span className="text-white/15">·</span>
            <BookOpen size={10} className="text-white/30" />
            <span>Ch {session.currentChapter}</span>
            {session.leadHeroineName && (
              <>
                <span className="text-white/15">·</span>
                <Heart size={10} className="text-rose-300/70" fill="currentColor" />
                <span className="text-rose-200/85 truncate max-w-[60px]">{session.leadHeroineName}</span>
                <span className="text-rose-300/60">{session.leadHeroineAffection}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-white/40 truncate max-w-[120px]">
              감독 {session.avatarName || "이름 없음"}
            </span>
            <span className="text-[10px] text-white/15 mx-0.5">·</span>
            <Clock size={10} className="text-white/20" />
            <span className="text-[11px] text-white/25">{formatRelativeTime(session.lastActiveAt)}</span>
            {session.endingReached && (
              <span className="text-[10px] text-amber-300/80 ml-auto italic truncate max-w-[100px]">
                {session.endingTitle || "엔딩"}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors duration-200 mt-1">
          <Play size={12} className="text-violet-200/70 group-hover:text-violet-100 transition-colors duration-200 ml-0.5" />
        </div>
      </div>
    </motion.div>
  );
};
