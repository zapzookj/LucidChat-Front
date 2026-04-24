import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import {
  Zap, User, Settings, Sparkles, ChevronLeft, ChevronRight,
  Clock, Heart, BookOpen, Compass, Archive, Play, X, Star,
  LogOut, Volume2, VolumeX, Gem
} from "lucide-react";
import AchievementGallery from "../components/AchievementGallery";
import LucidStore from "../components/LucidStore";

// ═══════════════════════════════════════════════════════════════
//  Lucid Station — 자각몽의 정거장
// ═══════════════════════════════════════════════════════════════

// ── [Fix #7] SFX 유틸리티 ──
const sfxCache = {};
const playSfx = (src, volume = 0.35) => {
  try {
    if (!sfxCache[src]) sfxCache[src] = new Audio(src);
    const a = sfxCache[src];
    a.volume = volume;
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
};

// ── 별똥별 파티클 ──
const ShootingStar = ({ delay, startX, startY }) => (
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

// ── 반짝이는 별 ──
const TwinkleStar = ({ style }) => (
  <motion.div
    className="absolute w-[2px] h-[2px] bg-white rounded-full pointer-events-none"
    style={style}
    animate={{ opacity: [0.15, 0.7, 0.15], scale: [0.8, 1.2, 0.8] }}
    transition={{ duration: Math.random() * 3 + 2, repeat: Infinity, delay: Math.random() * 5 }}
  />
);

const isNightTime = () => { const h = new Date().getHours(); return h >= 19 || h < 6; };

// ── [Fix #3] 캐릭터 카드 — 호버 효과 개선 ──
const CharacterCard = ({ character, isActive, onClick, onHover }) => {
  // [Phase 5] slug 기반 이미지 fallback
  const slug = character.slug || "airi";
  const imgSrc = character.thumbnailUrl || character.defaultImageUrl || `/characters/${slug}/maid_neutral.png`;

  return (
    <motion.div
      layout
      onClick={onClick}
      onMouseEnter={onHover}
      className="relative cursor-pointer flex-shrink-0 select-none"
      animate={{
        scale: isActive ? 1 : 0.78,
        opacity: isActive ? 1 : 0.45,
        rotateY: isActive ? 0 : -8,
        z: isActive ? 50 : 0,
      }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
      whileHover={
        isActive
          ? { scale: 1.03, transition: { type: "spring", stiffness: 300, damping: 20 } }
          : { scale: 0.84, opacity: 0.65, transition: { type: "spring", stiffness: 300, damping: 20 } }
      }
      whileTap={{ scale: isActive ? 0.97 : 0.8 }}
      style={{ perspective: "1200px", transformStyle: "preserve-3d" }}
    >
      <div className={`
        relative w-[260px] h-[380px] sm:w-[300px] sm:h-[440px] rounded-2xl overflow-hidden
        border transition-all duration-500
        ${isActive ? "border-white/30 shadow-[0_0_60px_rgba(147,130,255,0.25)]" : "border-white/10 shadow-lg"}
      `}>
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/60 via-slate-800/80 to-slate-900">
          <img src={imgSrc} alt={character.name} className="w-full h-full object-cover" draggable={false} />
        </div>

        {isActive ? (
          <motion.div
            className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"
            animate={{ opacity: [0.6, 0.8, 0.6] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        )}

        {/* 상단 glow bar — 활성 시 펄스, 비활성은 호버로 표시 */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/50 to-transparent"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 0.7 }}
          animate={isActive ? { opacity: [0.3, 0.7, 0.3] } : { opacity: 0 }}
          transition={isActive ? { duration: 3, repeat: Infinity } : { duration: 0.3 }}
        />

        <div className="absolute bottom-0 left-0 right-0 p-5">
          <motion.h3
            className="text-xl font-semibold text-white tracking-wide"
            animate={isActive ? { textShadow: "0 0 20px rgba(255,255,255,0.4)" } : { textShadow: "none" }}
          >
            {character.name}
          </motion.h3>
          <p className="text-sm text-white/60 mt-1 leading-relaxed">
            {character.tagline || "새로운 만남이 당신을 기다립니다"}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// ── 모드 선택 오버레이 ──
const ModeSelectOverlay = ({ character, onSelect, onClose }) => {
  const slug = character.slug || "airi";
  const imgSrc = character.thumbnailUrl || character.defaultImageUrl || `/characters/${slug}/maid_neutral.png`;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      />
      <motion.div
        className="relative z-10 flex flex-col lg:flex-row items-center gap-8 max-w-5xl mx-auto px-4"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
      >
        {/* 캐릭터 카드 (확대) */}
        <div className="relative w-[280px] h-[400px] sm:w-[320px] sm:h-[460px] rounded-2xl overflow-hidden border border-white/20 shadow-[0_0_80px_rgba(147,130,255,0.3)] flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/60 via-slate-800/80 to-slate-900">
            <img src={imgSrc} alt={character.name} className="w-full h-full object-cover" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h3 className="text-2xl font-bold text-white">{character.name}</h3>
            <p className="text-sm text-white/50 mt-2 leading-relaxed">
              {character.description || character.tagline || ""}
            </p>
          </div>
          <button
            onClick={onClose}
            onMouseEnter={() => playSfx("/sounds/sfx_button_hover.ogg", 0.2)}
            onMouseDown={() => playSfx("/sounds/sfx_button_click.wav", 0.3)}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white/60 hover:text-white hover:bg-black/60 transition-colors duration-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* 모드 선택 패널 */}
        <div className="flex flex-col gap-5 w-full max-w-sm">
          {/* 스토리 모드 */}
          <motion.button
            onClick={() => { playSfx("/sounds/sfx_button_click.wav", 0.35); onSelect("STORY"); }}
            onMouseEnter={() => playSfx("/sounds/sfx_button_hover.ogg", 0.2)}
            disabled={!character.storyAvailable}
            className={`
              relative group text-left p-6 rounded-xl border overflow-hidden transition-colors duration-300
              ${character.storyAvailable
                ? "border-amber-400/30 hover:border-amber-400/60 cursor-pointer"
                : "border-white/10 opacity-40 cursor-not-allowed"}
            `}
            whileHover={character.storyAvailable
              ? { scale: 1.025, boxShadow: "0 0 36px rgba(251,191,36,0.18)", transition: { type: "spring", stiffness: 400, damping: 25 } }
              : {}}
            whileTap={character.storyAvailable ? { scale: 0.975 } : {}}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-purple-900/10 to-transparent" />
            <motion.div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" initial={{ scaleX: 0 }} whileHover={{ scaleX: 1 }} transition={{ duration: 0.4 }} />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <BookOpen size={20} className="text-amber-400" />
                <span className="text-lg font-bold text-amber-200 tracking-wide">스토리 모드</span>
                <span className="text-[11px] font-medium text-amber-400/70 bg-amber-400/10 px-2 py-0.5 rounded-full ml-auto">Story Mode</span>
              </div>
              <p className="text-sm text-white/50 leading-relaxed">정해진 운명의 서사를 따라갑니다. 깊은 감정의 교류와 여러 결말이 당신을 기다립니다.</p>
              <div className="flex items-center gap-1.5 mt-4 text-amber-400/80">
                <Zap size={14} /><span className="text-xs font-semibold">대화 당 에너지 2 소모 (부스트 시 10)</span>
              </div>
              {!character.storyAvailable && <p className="text-xs text-white/30 mt-2 italic">아직 준비 중인 모드입니다</p>}
            </div>
          </motion.button>

          {/* 자유 모드 */}
          <motion.button
            onClick={() => { playSfx("/sounds/sfx_button_click.wav", 0.35); onSelect("SANDBOX"); }}
            onMouseEnter={() => playSfx("/sounds/sfx_button_hover.ogg", 0.2)}
            className="relative group text-left p-6 rounded-xl border border-cyan-400/30 hover:border-cyan-400/60 overflow-hidden transition-colors duration-300 cursor-pointer"
            whileHover={{ scale: 1.025, boxShadow: "0 0 36px rgba(34,211,238,0.18)", transition: { type: "spring", stiffness: 400, damping: 25 } }}
            whileTap={{ scale: 0.975 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-blue-900/10 to-transparent" />
            <motion.div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" initial={{ scaleX: 0 }} whileHover={{ scaleX: 1 }} transition={{ duration: 0.4 }} />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <Compass size={20} className="text-cyan-400" />
                <span className="text-lg font-bold text-cyan-200 tracking-wide">자유 모드</span>
                <span className="text-[11px] font-medium text-cyan-400/70 bg-cyan-400/10 px-2 py-0.5 rounded-full ml-auto">Sandbox Mode</span>
              </div>
              <p className="text-sm text-white/50 leading-relaxed">가벼운 일상과 예측 불가능한 대화를 즐깁니다. 어떤 제약도, 정해진 결말도 없습니다.</p>
              <div className="flex items-center gap-1.5 mt-4 text-cyan-400/80">
                <Zap size={14} /><span className="text-xs font-semibold">대화 당 에너지 1 소모 (부스트 시 5)</span>
              </div>
            </div>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── [Phase 5.5-Fix] 스탯 메타 (지배 스탯 아이콘/색상) ──
const STAT_META = {
  intimacy:    { label: "친밀도", icon: "💬", color: "#60a5fa", gradient: "from-blue-500/60 to-blue-400/60" },
  affection:   { label: "호감도", icon: "💕", color: "#f472b6", gradient: "from-rose-500/60 to-pink-400/60" },
  dependency:  { label: "의존도", icon: "🫂", color: "#a78bfa", gradient: "from-violet-500/60 to-purple-400/60" },
  playfulness: { label: "장난기", icon: "😜", color: "#34d399", gradient: "from-emerald-500/60 to-teal-400/60" },
  trust:       { label: "신뢰도", icon: "🤝", color: "#fbbf24", gradient: "from-amber-500/60 to-yellow-400/60" },
};

// ── 기억의 끈 사이드바 ──
const ContinuePanel = ({ rooms, onSelect, onClose }) => {
  const getStatusColor = (s) => ({ LOVER: "text-rose-400", FRIEND: "text-amber-400", ACQUAINTANCE: "text-emerald-400" }[s] || "text-white/50");
  const getModeBadge = (m) => m === "STORY" ? { label: "스토리", cls: "bg-amber-400/15 text-amber-300 border-amber-400/30" } : { label: "자유", cls: "bg-cyan-400/15 text-cyan-300 border-cyan-400/30" };
  const formatTime = (d) => {
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

  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      <motion.div
        className="relative w-full max-w-md h-full bg-slate-900/95 backdrop-blur-xl border-l border-white/10 overflow-hidden"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">기억의 끈</h2>
            <p className="text-xs text-white/30 mt-0.5">Continue · 진행 중인 이야기</p>
          </div>
          <button onClick={onClose} onMouseEnter={() => playSfx("/sounds/sfx_button_hover.ogg", 0.15)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors duration-200">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-76px)] custom-scrollbar px-4 py-4 space-y-3">
          {rooms.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-white/30">
              <Sparkles size={36} className="mb-3 opacity-40" />
              <p className="text-sm">아직 시작한 이야기가 없습니다</p>
              <p className="text-xs mt-1 opacity-60">새로운 만남에서 여정을 시작하세요</p>
            </div>
          )}
          {rooms.map((room) => {
            const badge = getModeBadge(room.chatMode);
            // [Phase 5.5-Fix] 지배 스탯 정보 — 레거시 호환 (dominantStatName 없으면 affection 폴백)
            const domStatKey = room.dominantStatName || "affection";
            const domStatMeta = STAT_META[domStatKey] || STAT_META.affection;
            const domStatValue = room.dominantStatValue !== undefined ? room.dominantStatValue : room.affectionScore;
            const displayRelation = room.dynamicRelationTag || null;
            return (
              <motion.div
                key={room.roomId}
                onClick={() => { playSfx("/sounds/sfx_button_click.wav", 0.3); onSelect(room.roomId); }}
                onMouseEnter={() => playSfx("/sounds/sfx_button_hover.ogg", 0.12)}
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
                    {/* [Phase 5.5-Fix] 지배 스탯 진척도 바 — 레거시 호감도 대체 */}
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
                    {/* [Phase 5.5-Fix] 동적 관계 태그 + 마지막 대화 시간 */}
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
                      <span className="text-[11px] text-white/25">{formatTime(room.lastActiveAt)}</span>
                      {room.endingReached && <span className="text-[10px] text-white/40 ml-auto italic">{room.endingTitle || (room.endingType === "HAPPY" ? "해피엔딩" : "배드엔딩")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors duration-200 mt-1">
                    <Play size={12} className="text-white/40 group-hover:text-white/70 transition-colors duration-200 ml-0.5" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── [Fix #6] 설정 모달 — 로그아웃과 분리 ──
const SettingsModal = ({ onClose, onLogout, bgmMuted, onToggleBgm }) => (
  <motion.div className="fixed inset-0 z-50 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
    <motion.div
      className="relative z-10 w-full max-w-xs bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl"
      initial={{ scale: 0.92, opacity: 0, y: 12 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.92, opacity: 0, y: 12 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
    >
        
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-white tracking-wide">설정</h3>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors duration-200"><X size={16} /></button>
      </div>
      <button
        onClick={onToggleBgm}
        onMouseEnter={() => playSfx("/sounds/sfx_button_hover.ogg", 0.15)}
        className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/10 transition-colors duration-200 mb-3"
      >
        <div className="flex items-center gap-3 text-sm text-white/70">
          {bgmMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          <span>로비 BGM</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${bgmMuted ? "bg-white/5 text-white/30" : "bg-emerald-500/15 text-emerald-400"}`}>
          {bgmMuted ? "OFF" : "ON"}
        </span>
      </button>
      <button
        onClick={() => { playSfx("/sounds/sfx_button_click.wav", 0.3); onLogout(); }}
        onMouseEnter={() => playSfx("/sounds/sfx_button_hover.ogg", 0.15)}
        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/20 transition-colors duration-200 text-sm text-white/50 hover:text-rose-400"
      >
        <LogOut size={16} /><span>로그아웃</span>
      </button>
    </motion.div>
  </motion.div>
);


// ═══════════════════════════════════════════════════════════════
//  메인 로비 페이지
// ═══════════════════════════════════════════════════════════════
const LobbyPage = ({ topbarExtras }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [view, setView] = useState("hub");
  const [characters, setCharacters] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeCharIdx, setActiveCharIdx] = useState(0);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [entering, setEntering] = useState(false);
  const [bgmMuted, setBgmMuted] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [storeInitialTab, setStoreInitialTab] = useState("energy");

  // [BETA] 베타 테스터 이스터에그 — 로고 5회 클릭
  const betaClickRef = useRef(0);
  const betaTimerRef = useRef(null);
  const [betaToast, setBetaToast] = useState(null); // { message, type: 'success'|'info' }

  const bgmRef = useRef(null);

  const stars = useMemo(() => Array.from({ length: 60 }, () => ({ left: `${Math.random() * 100}%`, top: `${Math.random() * 60}%` })), []);
  const shootingStars = useMemo(() => [0, 4.5, 9, 14.5, 20].map((delay) => ({ delay, startX: Math.random() * 80, startY: Math.random() * 35 })), []);

  // ── [Fix #4] 로비 BGM ──
  useEffect(() => {
    const audio = new Audio("/sounds/bgm_lobby.mp3");
    audio.loop = true;
    audio.volume = 0.25;
    bgmRef.current = audio;

    const tryPlay = () => { if (bgmRef.current && !bgmMuted) bgmRef.current.play().catch(() => {}); };
    const onInteraction = () => { tryPlay(); window.removeEventListener("click", onInteraction); window.removeEventListener("keydown", onInteraction); };
    window.addEventListener("click", onInteraction);
    window.addEventListener("keydown", onInteraction);
    tryPlay();

    return () => {
      window.removeEventListener("click", onInteraction);
      window.removeEventListener("keydown", onInteraction);
      if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!bgmRef.current) return;
    bgmMuted ? bgmRef.current.pause() : bgmRef.current.play().catch(() => {});
  }, [bgmMuted]);

  // BGM 페이드아웃 헬퍼
  const fadeBgmOut = () => {
    if (!bgmRef.current) return;
    const fade = setInterval(() => {
      if (bgmRef.current && bgmRef.current.volume > 0.02) {
        bgmRef.current.volume = Math.max(0, bgmRef.current.volume - 0.03);
      } else {
        clearInterval(fade);
        if (bgmRef.current) bgmRef.current.pause();
      }
    }, 50);
  };

  // ── 데이터 로딩 ──
  useEffect(() => { fetchUserInfo(); fetchCharacters(); fetchRooms(); }, []);
  const fetchUserInfo = async () => { try { setUserInfo((await api.get("/users/me")).data); } catch {} };
  const fetchCharacters = async () => { try { setCharacters((await api.get("/lobby/characters")).data); } catch {} };
  const fetchRooms = async () => { try { setRooms((await api.get("/lobby/rooms")).data); } catch {} };

  // ── 카루셀 ──
  const goNext = () => { playSfx("/sounds/sfx_button_click.wav", 0.2); setActiveCharIdx((p) => Math.min(p + 1, characters.length - 1)); };
  const goPrev = () => { playSfx("/sounds/sfx_button_click.wav", 0.2); setActiveCharIdx((p) => Math.max(p - 1, 0)); };

  useEffect(() => {
    if (view !== "characters") return;
    const handler = (e) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape") { selectedCharacter ? setSelectedCharacter(null) : setView("hub"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, selectedCharacter, characters.length]);

  const handleCardClick = (idx) => {
    playSfx("/sounds/sfx_button_click.wav", 0.3);
    idx === activeCharIdx ? setSelectedCharacter(characters[idx]) : setActiveCharIdx(idx);
  };

  const handleModeSelect = async (mode) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.post("/lobby/rooms", { characterId: selectedCharacter.id, chatMode: mode });
      localStorage.setItem("roomId", res.data.roomId);
      fadeBgmOut();
      setEntering(true);
      setTimeout(() => navigate(`/chat/${res.data.roomId}`), 800);
    } catch (e) {
      alert(e.response?.data?.message || "입장에 실패했습니다.");
      setLoading(false);
    }
  };

  const handleContinue = (roomId) => {
    localStorage.setItem("roomId", roomId);
    fadeBgmOut();
    setEntering(true);
    setTimeout(() => navigate(`/chat/${roomId}`), 800);
  };

  const handleLogout = () => {
    if (bgmRef.current) bgmRef.current.pause();
    logout();
    navigate("/login");
  };

  // [BETA] 로고 5회 클릭 → 베타 테스터 혜택 지급
  const handleLogoClick = async () => {
    betaClickRef.current += 1;

    // 2초 내 연속 클릭만 카운트
    clearTimeout(betaTimerRef.current);
    betaTimerRef.current = setTimeout(() => { betaClickRef.current = 0; }, 2000);

    if (betaClickRef.current < 5) return;
    betaClickRef.current = 0;

    try {
      const res = await api.post("/users/beta-activate");
      if (res.data.alreadyActivated) {
        setBetaToast({ message: "✨ 이미 베타 테스터 혜택이 적용되어 있어요!", type: "info" });
      } else {
        setBetaToast({ message: "🎉 베타 테스터 혜택 적용 완료! 루시드 미드나잇 패스 + 에너지 300 지급", type: "success" });
        fetchUserInfo(); // 에너지/구독 정보 갱신
      }
      setTimeout(() => setBetaToast(null), 5000);
    } catch (e) {
      console.error("[BETA] Activation failed:", e);
      setBetaToast({ message: "혜택 적용에 실패했습니다.", type: "error" });
      setTimeout(() => setBetaToast(null), 3000);
    }
  };

  const displayEnergy = userInfo?.energy ?? user?.energy ?? 0;
  const displayNickname = userInfo?.nickname ?? user?.nickname ?? "";

  // [Fix #8] 시간대별 배경 이미지
  const lobbyBg = isNightTime() ? "/backgrounds/bg_lobby_night.png" : "/backgrounds/bg_lobby_day.png";

  return (
    <div className="relative w-full h-full overflow-hidden select-none">

      {/* ═══ 배경 레이어 ═══ */}
      <div className="absolute inset-0">
        {/* [Fix #8] 실제 배경 일러스트 */}
        <img src={lobbyBg} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        <div className="absolute inset-0 bg-black/15" />
        {isNightTime() && stars.map((style, i) => <TwinkleStar key={i} style={style} />)}
        {isNightTime() && shootingStars.map((s, i) => <ShootingStar key={i} {...s} />)}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* ═══ 입장 페이드아웃 ═══ */}
      <AnimatePresence>
        {entering && <motion.div className="fixed inset-0 z-[100] bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />}
      </AnimatePresence>

      {/* ═══ Top Bar ═══ */}
      <div className="relative z-20 flex items-center justify-between px-5 sm:px-8 py-4">
        {/* [Fix #5] 좌측: 아이콘 로고 + 텍스트 */}
        <motion.div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => setView("hub")}
          whileHover={{ scale: 1.03, transition: { type: "spring", stiffness: 400, damping: 25 } }}
        >
          <img src="/logo_icon.png" alt="" className="h-7 sm:h-8 drop-shadow-lg" onError={(e) => { e.target.style.display = "none"; }} />
          <span className="text-lg sm:text-xl font-bold text-white tracking-[0.12em] drop-shadow-lg" style={{ fontFamily: "'Pretendard', sans-serif" }}>
            LUCID CHAT
          </span>
        </motion.div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* ─── 탭바 슬롯 ─── */}
          {topbarExtras && (
            <div className="mr-1">{topbarExtras}</div>
          )}
          <div className="flex items-center gap-1.5 bg-black/20 ...">
            <Zap size={14} />
            <span className="text-sm font-semibold text-white">{displayEnergy}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-white/60 text-sm">
            <User size={14} /><span>{displayNickname}</span>
          </div>
          {/* 💎 Lucid Store 버튼 */}
        <button
        onClick={() => {
            playSfx("/sounds/sfx_button_click.wav", 0.25);
            setStoreInitialTab("energy"); // 기본 탭
            setShowStore(true);
        }}
        onMouseEnter={() => playSfx("/sounds/sfx_button_hover.ogg", 0.15)}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-amber-400/70 hover:text-amber-300 hover:bg-black/40 transition-colors duration-200"
        >
        <Gem size={14} />
        </button>
          {/* [Fix #6] 설정 모달 열기 */}
          <button
            onClick={() => { playSfx("/sounds/sfx_button_click.wav", 0.25); setShowSettings(true); }}
            onMouseEnter={() => playSfx("/sounds/sfx_button_hover.ogg", 0.15)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white/50 hover:text-white hover:bg-black/40 transition-colors duration-200"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* ═══ Hub 메인 메뉴 ═══ */}
      <AnimatePresence mode="wait">
        {view === "hub" && (
          <motion.div
            key="hub"
            className="relative z-10 flex flex-col items-center justify-center h-[calc(100%-80px)]"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            {/* [Fix #5] 서비스 로고 이미지 — [BETA] 5회 클릭 이스터에그 */}
            <motion.div className="mb-10 cursor-pointer" onClick={handleLogoClick} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
              <img
                src="/logo.png"
                alt="Lucid Chat"
                className="h-28 sm:h-40 md:h-48 drop-shadow-[0_0_40px_rgba(255,255,255,0.25)] object-contain select-none"
                draggable={false}
                onError={(e) => { e.target.style.display = "none"; if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = "block"; }}
              />
              <p className="text-white/25 text-xs sm:text-sm tracking-[0.3em] uppercase text-center hidden">Lucid Station</p>
            </motion.div>

            {/* [Fix #2] 부드러운 호버 spring + [Fix #7] SFX */}
            <div className="flex flex-col items-center gap-6 sm:gap-8">
              {[
                { label: "새로운 만남", sub: "New Encounter", action: () => setView("characters") },
                { label: "기억의 끈", sub: "Continue", action: () => { fetchRooms(); setView("continue"); }, disabled: rooms.length === 0 },
                { label: "수집품", sub: "Archives", action: () => setShowAchievements(true) },
              ].map((item, i) => (
                <motion.button
                  key={item.label}
                  onClick={() => { if (item.disabled) return; playSfx("/sounds/sfx_button_click.wav", 0.35); item.action(); }}
                  onMouseEnter={() => { if (!item.disabled) playSfx("/sounds/sfx_button_hover.ogg", 0.2); }}
                  disabled={item.disabled}
                  className={`group flex flex-col items-center gap-1.5 ${item.disabled ? "opacity-25 cursor-not-allowed" : "cursor-pointer"}`}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: item.disabled ? 0.25 : 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.1, duration: 0.5, type: "spring", stiffness: 120, damping: 16 }}
                  whileHover={!item.disabled ? { scale: 1.06, transition: { type: "spring", stiffness: 300, damping: 18 } } : {}}
                  whileTap={!item.disabled ? { scale: 0.96 } : {}}
                >
                  <motion.span
                    className="text-2xl sm:text-4xl font-bold text-white tracking-wider"
                    style={{ fontFamily: "'Pretendard', sans-serif" }}
                    whileHover={{ textShadow: "0 0 30px rgba(255,255,255,0.5), 0 0 60px rgba(147,130,255,0.35)", transition: { duration: 0.3 } }}
                  >
                    {item.label}
                  </motion.span>
                  <span className="text-[11px] text-white/20 tracking-[0.25em] uppercase group-hover:text-white/45 transition-colors duration-300">
                    {item.sub}
                  </span>
                  {/* 호버 시 하단 glow 언더라인 */}
                  <motion.div
                    className="h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    initial={{ width: 0, opacity: 0 }}
                    whileHover={{ width: "100%", opacity: 1 }}
                    transition={{ duration: 0.35 }}
                  />
                </motion.button>
              ))}
            </div>

            <motion.div
              className="absolute bottom-12 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent"
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.8, duration: 1 }}
            />
          </motion.div>
        )}

        {/* ═══ 캐릭터 선택 화면 ═══ */}
        {view === "characters" && (
          <motion.div key="characters" className="relative z-10 flex flex-col h-[calc(100%-80px)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <div className="px-6 py-2">
              <button
                onClick={() => { playSfx("/sounds/sfx_button_click.wav", 0.2); setView("hub"); }}
                onMouseEnter={() => playSfx("/sounds/sfx_button_hover.ogg", 0.15)}
                className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors duration-200"
              >
                <ChevronLeft size={16} /><span>돌아가기</span>
              </button>
            </div>
            <motion.div className="text-center mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">새로운 만남</h2>
              <p className="text-xs text-white/25 mt-1 tracking-wider">당신의 이야기를 함께할 존재를 선택하세요</p>
            </motion.div>

            <div className="flex-1 flex items-center justify-center relative">
              {characters.length === 0 ? (
                <div className="text-white/30 text-sm">캐릭터를 불러오는 중...</div>
              ) : (
                <>
                  {activeCharIdx > 0 && (
                    <motion.button onClick={goPrev} onMouseEnter={() => playSfx("/sounds/sfx_button_hover.ogg", 0.15)}
                      className="absolute left-4 sm:left-8 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-white/50 hover:text-white hover:bg-black/50 transition-colors duration-200"
                      whileHover={{ scale: 1.1, transition: { type: "spring", stiffness: 400, damping: 20 } }} whileTap={{ scale: 0.9 }}
                    ><ChevronLeft size={18} /></motion.button>
                  )}
                  <div className="flex items-center justify-center gap-4 sm:gap-6">
                    {characters.map((c, idx) => (
                      <CharacterCard key={c.id} character={c} isActive={idx === activeCharIdx} onClick={() => handleCardClick(idx)} onHover={() => playSfx("/sounds/sfx_button_hover.ogg", 0.12)} />
                    ))}
                  </div>
                  {activeCharIdx < characters.length - 1 && (
                    <motion.button onClick={goNext} onMouseEnter={() => playSfx("/sounds/sfx_button_hover.ogg", 0.15)}
                      className="absolute right-4 sm:right-8 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-white/50 hover:text-white hover:bg-black/50 transition-colors duration-200"
                      whileHover={{ scale: 1.1, transition: { type: "spring", stiffness: 400, damping: 20 } }} whileTap={{ scale: 0.9 }}
                    ><ChevronRight size={18} /></motion.button>
                  )}
                </>
              )}
            </div>
            {characters.length > 1 && (
              <div className="flex justify-center gap-2 pb-8">
                {characters.map((_, idx) => (
                  <button key={idx} onClick={() => { playSfx("/sounds/sfx_button_click.wav", 0.15); setActiveCharIdx(idx); }}
                    className={`h-2 rounded-full transition-all duration-300 ${idx === activeCharIdx ? "bg-white/70 w-6" : "bg-white/20 w-2"}`} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Overlays ═══ */}
      <AnimatePresence>{selectedCharacter && <ModeSelectOverlay character={selectedCharacter} onSelect={handleModeSelect} onClose={() => setSelectedCharacter(null)} />}</AnimatePresence>
      <AnimatePresence>{view === "continue" && <ContinuePanel rooms={rooms} onSelect={handleContinue} onClose={() => setView("hub")} />}</AnimatePresence>
      <AnimatePresence>{showAchievements && <AchievementGallery onClose={() => setShowAchievements(false)} />}</AnimatePresence>
      {/* 💎 Lucid Store Overlay */}
      <LucidStore
      isOpen={showStore}
      onClose={() => setShowStore(false)}
      initialTab={storeInitialTab}
      userInfo={userInfo}
      characters={characters}
      onPaymentComplete={() => {
      setShowStore(false);
      fetchUserInfo(); // 결제 후 에너지 갱신
      }}
      />
      <AnimatePresence>{showSettings && <SettingsModal onClose={() => setShowSettings(false)} onLogout={handleLogout} bgmMuted={bgmMuted} onToggleBgm={() => setBgmMuted((m) => !m)} />}</AnimatePresence>

      {/* [BETA] 베타 테스터 토스트 알림 */}
      <AnimatePresence>
        {betaToast && (
          <motion.div
            className={`fixed bottom-8 left-1/2 z-[9999] px-6 py-3.5 rounded-2xl backdrop-blur-xl border shadow-2xl text-sm font-medium
              ${betaToast.type === "success"
                ? "bg-emerald-900/80 border-emerald-400/30 text-emerald-200 shadow-emerald-500/20"
                : betaToast.type === "info"
                  ? "bg-violet-900/80 border-violet-400/30 text-violet-200 shadow-violet-500/20"
                  : "bg-rose-900/80 border-rose-400/30 text-rose-200 shadow-rose-500/20"
              }`}
            initial={{ x: "-50%", y: 30, opacity: 0, scale: 0.9 }}
            animate={{ x: "-50%", y: 0, opacity: 1, scale: 1 }}
            exit={{ x: "-50%", y: 30, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {betaToast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LobbyPage;