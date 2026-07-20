import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import {
  Zap, User, Settings, Sparkles, ChevronLeft, ChevronRight,
  Clock, Heart, BookOpen, Compass, Archive, Play, X, Star,
  LogOut, Volume2, VolumeX, Gem, Drama, Crown
} from "lucide-react";
import AchievementGallery from "../components/AchievementGallery";
import LucidStore from "../components/LucidStore";
import HelpButton from "../components/HelpButton";

// [Phase 5.5-Theater-Polish · Phase I] 통합 진입점
import TheaterDoorway from "../components/lobby/TheaterDoorway";
import TheaterCreateFlow from "../components/theater/TheaterCreateFlow";
import { fetchMyTheaterSessions, fetchWorld as fetchTheaterWorld } from "../api/TheaterLobbyApi";
// [Story V2] World 탐험 진입점
import StoryV2LobbyView from "../components/story-v2/StoryV2LobbyView";
import StoryCreateFlow from "../components/story-v2/StoryCreateFlow";
import LobbyNewEncounterFlow from "../components/lobby/LobbyNewEncounterFlow";
// [Studio v1] UGC 스튜디오 진입 훅 카드
import CreateHookCard from "../components/studio/CreateHookCard";
import { assetUrl } from "../utils/assetUrl";
import { playSfx } from "../utils/sfx";

// ═══════════════════════════════════════════════════════════════
//  Lucid Station — 자각몽의 정거장
// ═══════════════════════════════════════════════════════════════

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
  const imgSrc = character.thumbnailUrl || character.defaultImageUrl || assetUrl(`/characters/${slug}/maid_neutral.png`);

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
  const imgSrc = character.thumbnailUrl || character.defaultImageUrl || assetUrl(`/characters/${slug}/maid_neutral.png`);

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
            onMouseEnter={() => playSfx(`/sounds/sfx_button_hover.ogg`, 0.2)}
            onMouseDown={() => playSfx(`/sounds/sfx_button_click.wav`, 0.3)}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white/60 hover:text-white hover:bg-black/60 transition-colors duration-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* 모드 선택 패널 */}
        <div className="flex flex-col gap-5 w-full max-w-sm">
          {/* 스토리 모드 */}
          <motion.button
            onClick={() => { playSfx(`/sounds/sfx_button_click.wav`, 0.35); onSelect("STORY"); }}
            onMouseEnter={() => playSfx(`/sounds/sfx_button_hover.ogg`, 0.2)}
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
            onClick={() => { playSfx(`/sounds/sfx_button_click.wav`, 0.35); onSelect("SANDBOX"); }}
            onMouseEnter={() => playSfx(`/sounds/sfx_button_hover.ogg`, 0.2)}
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

          {/* [Phase I] 극장 모드 — Theater (indigo/violet 톤) */}
          <motion.button
            onClick={() => {
              if (!character.theaterAvailable) return;
              playSfx(`/sounds/sfx_button_click.wav`, 0.35);
              onSelect("THEATER");
            }}
            onMouseEnter={() => character.theaterAvailable && playSfx(`/sounds/sfx_button_hover.ogg`, 0.2)}
            disabled={!character.theaterAvailable}
            className={`
              relative group text-left p-6 rounded-xl border overflow-hidden transition-colors duration-300
              ${character.theaterAvailable
                ? "border-violet-400/30 hover:border-violet-400/60 cursor-pointer"
                : "border-white/10 opacity-40 cursor-not-allowed"}
            `}
            whileHover={character.theaterAvailable
              ? { scale: 1.025, boxShadow: "0 0 36px rgba(167,139,250,0.22)", transition: { type: "spring", stiffness: 400, damping: 25 } }
              : {}}
            whileTap={character.theaterAvailable ? { scale: 0.975 } : {}}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/25 via-indigo-900/12 to-transparent" />
            <motion.div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" initial={{ scaleX: 0 }} whileHover={{ scaleX: 1 }} transition={{ duration: 0.4 }} />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <Drama size={20} className="text-violet-300" />
                <span className="text-lg font-bold text-violet-100 tracking-wide">극장 모드</span>
                <span className="text-[11px] font-medium text-violet-300/80 bg-violet-400/10 px-2 py-0.5 rounded-full ml-auto">Theater</span>
              </div>
              <p className="text-sm text-white/55 leading-relaxed">
                당신은 감독이 됩니다. 이야기가 자동으로 펼쳐지고, 결정적 순간에만 개입하세요.
              </p>
              <div className="flex items-center gap-1.5 mt-4 text-violet-300/85">
                <Zap size={14} />
                <span className="text-xs font-semibold">배치 당 에너지 1 소모 (5~8 씬)</span>
              </div>
              {!character.theaterAvailable && (
                <p className="text-xs text-white/30 mt-2 italic">아직 준비 중인 모드입니다</p>
              )}
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [Phase I] 시간 포맷터 (모듈 스코프 유틸로 끌어올림 — 카드 컴포넌트들이 공유)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const formatRelativeTime = (d) => {
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
//  Dialogue 세션 카드 — 기존 로직 유지
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DialogueRoomCard = ({ room, onSelect }) => {
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
      onClick={() => { playSfx(`/sounds/sfx_button_click.wav`, 0.3); onSelect(room.roomId, room.chatMode); }}
      onMouseEnter={() => playSfx(`/sounds/sfx_button_hover.ogg`, 0.12)}
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
//  [Phase I] Theater 세션 카드 — Continue 패널용 컴팩트 변형
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ACT_TITLES = {
  1: "Act 1",
  2: "Act 2",
  3: "Act 3",
  4: "Act 4",
};

const TheaterSessionCard = ({ session, onSelect }) => {
  const leadImgUrl =
    session.leadHeroineThumbnailUrl ||
    (session.leadHeroineSlug ? `${baseUrl}/characters/${session.leadHeroineSlug}/thumb.jpg` : null);
  const actLabel = ACT_TITLES[session.currentAct] || `Act ${session.currentAct}`;

  return (
    <motion.div
      onClick={() => { playSfx(`/sounds/sfx_button_click.wav`, 0.3); onSelect(session.roomId); }}
      onMouseEnter={() => playSfx(`/sounds/sfx_button_hover.ogg`, 0.12)}
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  기억의 끈 사이드바 — Dialogue + Theater 통합
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  rooms props 시그니처:
//    [
//      { type: "DIALOGUE", roomId, ...RoomSummaryResponse },
//      { type: "THEATER",  roomId, ...TheaterSessionCard },
//    ]
//  각 항목은 lastActiveAt 기준으로 이미 정렬되어 있다고 가정.
//
// onSelect(roomId, type) — 호출부가 type에 따라 라우팅 분기
const ContinuePanel = ({ rooms, onSelect, onClose }) => {
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
          <button onClick={onClose} onMouseEnter={() => playSfx(`/sounds/sfx_button_hover.ogg`, 0.15)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors duration-200">
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
          {rooms.map((entry) =>
            entry.type === "THEATER" ? (
              <TheaterSessionCard
                key={`T-${entry.roomId}`}
                session={entry}
                onSelect={(id) => onSelect(id, "THEATER")}
              />
            ) : (
              <DialogueRoomCard
                key={`D-${entry.roomId}`}
                room={entry}
                onSelect={(id, chatMode) => onSelect(id, "DIALOGUE", chatMode)}
              />
            )
          )}
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
        onMouseEnter={() => playSfx(`/sounds/sfx_button_hover.ogg`, 0.15)}
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
        onClick={() => { playSfx(`/sounds/sfx_button_click.wav`, 0.3); onLogout(); }}
        onMouseEnter={() => playSfx(`/sounds/sfx_button_hover.ogg`, 0.15)}
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
//
// [Phase 5.5-Theater-Polish · Phase I]
//   - topbarExtras prop 제거 (LobbyTabShell이 사라졌으므로 더 이상 외부 주입 불필요)
//   - rooms / theaterSessions를 별도 state로 두고, 머지된 mergedRooms를 ContinuePanel에 전달
//   - hub의 "기억의 끈" disabled 조건도 머지 기준으로 평가
//
const LobbyPage = () => {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();

  const [view, setView] = useState("hub");
  const [characters, setCharacters] = useState([]);
  const [rooms, setRooms] = useState([]);
  // [Phase I] Theater 세션 — Dialogue rooms와 분리 저장. 머지는 mergedRooms에서.
  const [theaterSessions, setTheaterSessions] = useState([]);
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

  // [Phase I] 캐릭터 카드 → Theater 모드 선택 → CreateFlow 진입 시
  //          이 캐릭터의 worldId를 가진 임시 world 객체와 미리 선택된 히로인 ID를 전달.
  const [createFlowState, setCreateFlowState] = useState(null);
  // shape: { world: {...}, initialHeroineIds: [Long] } | null

  // [Story V2] V2 CreateFlow 진입 상태 — Theater와 별개 트랙
  const [storyV2CreateFlow, setStoryV2CreateFlow] = useState(null);
  // shape: { worldId: string } | null

  // [BETA] 베타 테스터 이스터에그 — 로고 5회 클릭
  const betaClickRef = useRef(0);
  const betaTimerRef = useRef(null);
  const [betaToast, setBetaToast] = useState(null); // { message, type: 'success'|'info' }

  const bgmRef = useRef(null);

  const stars = useMemo(() => Array.from({ length: 60 }, () => ({ left: `${Math.random() * 100}%`, top: `${Math.random() * 60}%` })), []);
  const shootingStars = useMemo(() => [0, 4.5, 9, 14.5, 20].map((delay) => ({ delay, startX: Math.random() * 80, startY: Math.random() * 35 })), []);

  // ── [Fix #4] 로비 BGM ──
  useEffect(() => {
    const audio = new Audio(assetUrl("/sounds/bgm_lobby.mp3"));
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
  // [Phase I] Theater 세션도 함께 로드. 두 API를 병렬 호출 후 lastActiveAt 기준 머지.
  useEffect(() => {
    fetchUserInfo();
    fetchCharacters();
    fetchRoomsAll();
  }, []);
  const fetchUserInfo = async () => { try { setUserInfo((await api.get("/users/me")).data); } catch {} };
  const fetchCharacters = async () => { try { setCharacters((await api.get("/lobby/characters")).data); } catch {} };
  const fetchRooms = async () => { try { setRooms((await api.get("/lobby/rooms")).data); } catch {} };
  const fetchTheaterSessions = async () => {
    try { setTheaterSessions(await fetchMyTheaterSessions()); }
    catch (e) { console.warn("[Lobby] Theater sessions fetch failed:", e?.message); }
  };
  const fetchRoomsAll = async () => {
    await Promise.all([fetchRooms(), fetchTheaterSessions()]);
  };

  // [Phase I] Dialogue rooms + Theater sessions 통합 — type 필드 부여 후 시간 정렬
  const mergedRooms = useMemo(() => {
    const dialogueEntries = (rooms || []).map((r) => ({ ...r, type: "DIALOGUE" }));
    const theaterEntries = (theaterSessions || []).map((s) => ({ ...s, type: "THEATER" }));
    const all = [...dialogueEntries, ...theaterEntries];
    all.sort((a, b) => {
      const ta = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
      const tb = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
      return tb - ta;
    });
    return all;
  }, [rooms, theaterSessions]);

  // ── 카루셀 ──
  const goNext = () => { playSfx(`/sounds/sfx_button_click.wav`, 0.2); setActiveCharIdx((p) => Math.min(p + 1, characters.length - 1)); };
  const goPrev = () => { playSfx(`/sounds/sfx_button_click.wav`, 0.2); setActiveCharIdx((p) => Math.max(p - 1, 0)); };

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
    playSfx(`/sounds/sfx_button_click.wav`, 0.3);
    idx === activeCharIdx ? setSelectedCharacter(characters[idx]) : setActiveCharIdx(idx);
  };

  // [Phase I] 모드 선택 분기:
  //   STORY/SANDBOX → 기존 /lobby/rooms POST 후 /chat/:id
  //   THEATER       → CreateFlow 오픈 (이 캐릭터의 worldId / id 미리 채움)
  //
  // 캐릭터의 worldId가 없으면 백엔드 isTheaterAvailable=false 이므로
  // 카드는 disabled 상태이며 이 함수가 호출되더라도 안전 처리한다.
  const handleModeSelect = async (mode) => {
    if (loading) return;
    if (!selectedCharacter) return;

    if (mode === "THEATER") {
      // 1. theaterAvailable 가드 (UI에서도 disabled지만 이중 안전)
      if (!selectedCharacter.theaterAvailable) {
        return;
      }
      // 2. 임시 world 객체 — 실제 디테일(heroImageUrl/openingNarration)은
      //    CreateFlow에서 fetchWorlds로 충분. 여기서는 id + heroines 시드만 채움.
      const tempWorld = {
        id: selectedCharacter.worldId,
        displayName: selectedCharacter.worldDisplayName || "이야기의 무대",
        // CreateFlow의 step1에서 다른 히로인을 추가하려면 같은 세계관의 heroines 목록이 필요.
        // 일단 현재 캐릭터 1명만 시드로 넣고, CreateFlow가 마운트된 후 fetchWorld로 보강한다.
        heroines: [{
          id: selectedCharacter.id,
          name: selectedCharacter.name,
          characterSlug: selectedCharacter.slug,
          thumbnailUrl: selectedCharacter.thumbnailUrl,
          tagline: selectedCharacter.tagline,
        }],
        secretAllowed: false,
      };
      // ModeSelectOverlay 닫고 CreateFlow 오픈
      setSelectedCharacter(null);
      setCreateFlowState({ world: tempWorld, initialHeroineIds: [selectedCharacter.id] });
      return;
    }

    // STORY / SANDBOX
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

  // [Phase I] 통합 Continue: type에 따라 라우팅 분기
  const handleContinue = (roomId, typeOrChatMode = "DIALOGUE", chatMode = null) => {
    fadeBgmOut();
    setEntering(true);
    // [Phase 7-V2 Pivot Fix] 라우팅 분기:
    //   - THEATER 세션 → /theater/:id
    //   - V2 STORY 방 (chatMode === "STORY") → /v2/chat/:id  (V1 ChatPage가 아닌 ChatPageV2)
    //   - 그 외 (SANDBOX) → /chat/:id
    // 호출 시그니처 두 가지 지원: handleContinue(id, "THEATER") | handleContinue(id, "DIALOGUE", chatMode)
    if (typeOrChatMode === "THEATER") {
      setTimeout(() => navigate(`/theater/${roomId}`), 800);
      return;
    }
    const isStoryV2 = chatMode === "STORY";
    localStorage.setItem("roomId", roomId);
    setTimeout(() => navigate(isStoryV2 ? `/v2/chat/${roomId}` : `/chat/${roomId}`), 800);
  };

  // [Phase 7-V2 Pivot] 통합 플로우 → 극장 핸드오프.
  //   worldId + 선택된 히로인을 받아 극장 World 디테일을 fetch한 뒤
  //   TheaterCreateFlow를 히로인 단계 건너뛰고(아바타 단계부터) 오픈.
  const handleTheaterHandoff = async (worldId, heroineIds) => {
    try {
      const world = await fetchTheaterWorld(worldId);
      setCreateFlowState({
        world,
        initialHeroineIds: heroineIds,
        skipHeroineSelection: true,
      });
    } catch (e) {
      console.error("[Lobby] theater world fetch failed", e);
      alert("극장 정보를 불러오지 못했습니다.");
    }
  };

  // [Studio v1] 스튜디오 진입 — Doorway와 같은 BGM 페이드 + 전환 연출
  const handleEnterStudio = () => {
    fadeBgmOut();
    setEntering(true);
    setTimeout(() => navigate("/studio"), 700);
  };

  // [Phase I] 극장 입구(Doorway) 클릭 → /theater 페이지로 이동
  const handleEnterTheaterPortal = () => {
    playSfx(`/sounds/sfx_button_click.wav`, 0.4);
    fadeBgmOut();
    setEntering(true);
    setTimeout(() => navigate("/theater"), 700);
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
      }

      // [Polish · P0] 응답에 갱신된 UserResponse가 함께 오므로 즉시 동기화.
      //   - res.data.user: 백엔드가 활성화 직후 GET /users/me에 해당하는 전체 객체 반환
      //   - refreshUser(): AuthContext + localStorage 동기화 → useAuth().user.subscriptionTier
      //                    / isAdultVerified가 즉시 반영되어 TheaterCreateFlow의 스탯 분배,
      //                    SecretModeFlow의 성인인증 게이트 등이 정확히 동작.
      //   - fetchUserInfo(): LobbyPage 로컬 userInfo도 갱신 (에너지 표시 즉시 반영).
      if (refreshUser) {
        try { await refreshUser(); } catch { /* sync failure fallback to fetchUserInfo */ }
      }
      fetchUserInfo();

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
  const lobbyBg = isNightTime()
  ? assetUrl("/backgrounds/bg_lobby_night.png")
  : assetUrl("/backgrounds/bg_lobby_day.png");

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
          <img src={assetUrl("/logo_icon.png")} alt="" className="h-7 sm:h-8 drop-shadow-lg" onError={(e) => { e.target.style.display = "none"; }} />
          <span className="text-lg sm:text-xl font-bold text-white tracking-[0.12em] drop-shadow-lg" style={{ fontFamily: "'Pretendard', sans-serif" }}>
            LUCID CHAT
          </span>
        </motion.div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* [Phase I] topbarExtras 슬롯 제거 — LobbyTabShell이 더 이상 존재하지 않음 */}
          <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10 text-amber-300">
            <Zap size={14} />
            <span className="text-sm font-semibold text-white">{displayEnergy}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-white/60 text-sm">
            <User size={14} /><span>{displayNickname}</span>
          </div>
          {/* 💎 Lucid Store 버튼 */}
          <button
            onClick={() => {
              playSfx(`/sounds/sfx_button_click.wav`, 0.25);
              setStoreInitialTab("energy");
              setShowStore(true);
            }}
            onMouseEnter={() => playSfx(`/sounds/sfx_button_hover.ogg`, 0.15)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-amber-400/70 hover:text-amber-300 hover:bg-black/40 transition-colors duration-200"
          >
            <Gem size={14} />
          </button>
          {/* [Phase 6] 도움말 · 문의 (QnA / 문의하기 / 내 문의) */}
          <HelpButton />
          {/* [Fix #6] 설정 모달 열기 */}
          <button
            onClick={() => { playSfx(`/sounds/sfx_button_click.wav`, 0.25); setShowSettings(true); }}
            onMouseEnter={() => playSfx(`/sounds/sfx_button_hover.ogg`, 0.15)}
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
            className="relative z-10 flex flex-col items-center justify-center h-[calc(100%-80px)] overflow-y-auto custom-scrollbar py-8"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            {/* [Fix #5] 서비스 로고 이미지 — [BETA] 5회 클릭 이스터에그 */}
            <motion.div
              className="mb-6 sm:mb-8 cursor-pointer flex-shrink-0"
              onClick={handleLogoClick}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <img
                src={assetUrl("/logo.png")}
                alt="Lucid Chat"
                className="h-24 sm:h-32 md:h-40 drop-shadow-[0_0_40px_rgba(255,255,255,0.25)] object-contain select-none"
                draggable={false}
                onError={(e) => { e.target.style.display = "none"; if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = "block"; }}
              />
              <p className="text-white/25 text-xs sm:text-sm tracking-[0.3em] uppercase text-center hidden">Lucid Station</p>
            </motion.div>

            {/* [Phase 7-V2 Pivot] 진입점 단일화 — '새로운 만남' 하나로 모드/세계관/캐릭터 통합 */}
            <div className="flex flex-col items-center gap-5 sm:gap-7 flex-shrink-0">
              {[
                { label: "새로운 만남", sub: "New Encounter", action: () => setView("encounter") },
                // [Studio v1] UGC 캐릭터 생성 스튜디오 진입
                { label: "스튜디오", sub: "Studio", action: handleEnterStudio },
                { label: "기억의 끈", sub: "Continue", action: () => { fetchRoomsAll(); setView("continue"); }, disabled: mergedRooms.length === 0 },
                { label: "수집품", sub: "Archives", action: () => setShowAchievements(true) },
              ].map((item, i) => (
                <motion.button
                  key={item.label}
                  onClick={() => { if (item.disabled) return; playSfx(`/sounds/sfx_button_click.wav`, 0.35); item.action(); }}
                  onMouseEnter={() => { if (!item.disabled) playSfx(`/sounds/sfx_button_hover.ogg`, 0.2); }}
                  disabled={item.disabled}
                  className={`group flex flex-col items-center gap-1.5 ${item.disabled ? "opacity-25 cursor-not-allowed" : "cursor-pointer"}`}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: item.disabled ? 0.25 : 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.1, duration: 0.5, type: "spring", stiffness: 120, damping: 16 }}
                  whileHover={!item.disabled ? { scale: 1.06, transition: { type: "spring", stiffness: 300, damping: 18 } } : {}}
                  whileTap={!item.disabled ? { scale: 0.96 } : {}}
                >
                  <motion.span
                    className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-wider"
                    style={{ fontFamily: "'Pretendard', sans-serif" }}
                    whileHover={{ textShadow: "0 0 30px rgba(255,255,255,0.5), 0 0 60px rgba(147,130,255,0.35)", transition: { duration: 0.3 } }}
                  >
                    {item.label}
                  </motion.span>
                  <span className="text-[11px] text-white/20 tracking-[0.25em] uppercase group-hover:text-white/45 transition-colors duration-300">
                    {item.sub}
                  </span>
                  <motion.div
                    className="h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    initial={{ width: 0, opacity: 0 }}
                    whileHover={{ width: "100%", opacity: 1 }}
                    transition={{ duration: 0.35 }}
                  />
                </motion.button>
              ))}
            </div>

            {/* [Phase 7-V2 Pivot] 극장 입구 Doorway 제거 — '새로운 만남' 통합 플로우로 진입.
                기존 극장 세션 '이어하기'는 '기억의 끈'에서 노출됨. */}
          </motion.div>
        )}

        {/* ═══ [Phase 7-V2 Pivot] 통합 새로운 만남 플로우 ═══ */}
        {view === "encounter" && (
          <LobbyNewEncounterFlow
            onBack={() => setView("hub")}
            onEnterChat={(roomId) => {
              setEntering(true);
              setTimeout(() => navigate(`/chat/${roomId}`), 600);
            }}
            onHandoffStory={({ worldId, heroineIds }) => {
              setStoryV2CreateFlow({ worldId, presetHeroineIds: heroineIds });
            }}
            onHandoffTheater={({ worldId, heroineIds }) => {
              void handleTheaterHandoff(worldId, heroineIds);
            }}
          />
        )}

        {/* ═══ 캐릭터 선택 화면 (레거시 — encounter 플로우로 대체, 직접 진입 없음) ═══ */}
        {view === "characters" && (
          <motion.div key="characters" className="relative z-10 flex flex-col h-[calc(100%-80px)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <div className="px-6 py-2">
              <button
                onClick={() => { playSfx(`/sounds/sfx_button_click.wav`, 0.2); setView("hub"); }}
                onMouseEnter={() => playSfx(`/sounds/sfx_button_hover.ogg`, 0.15)}
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
                    <motion.button onClick={goPrev} onMouseEnter={() => playSfx(`/sounds/sfx_button_hover.ogg`, 0.15)}
                      className="absolute left-4 sm:left-8 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-white/50 hover:text-white hover:bg-black/50 transition-colors duration-200"
                      whileHover={{ scale: 1.1, transition: { type: "spring", stiffness: 400, damping: 20 } }} whileTap={{ scale: 0.9 }}
                    ><ChevronLeft size={18} /></motion.button>
                  )}
                  <div className="flex items-center justify-center gap-4 sm:gap-6">
                    {characters.map((c, idx) => (
                      <CharacterCard key={c.id} character={c} isActive={idx === activeCharIdx} onClick={() => handleCardClick(idx)} onHover={() => playSfx(`/sounds/sfx_button_hover.ogg`, 0.12)} />
                    ))}
                    {/* [Studio v1] 카루셀 말미 — 스튜디오 진입 훅 카드 */}
                    <CreateHookCard
                      onClick={() => { playSfx(`/sounds/sfx_button_click.wav`, 0.3); handleEnterStudio(); }}
                      onHover={() => playSfx(`/sounds/sfx_button_hover.ogg`, 0.12)}
                    />
                  </div>
                  {activeCharIdx < characters.length - 1 && (
                    <motion.button onClick={goNext} onMouseEnter={() => playSfx(`/sounds/sfx_button_hover.ogg`, 0.15)}
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
                  <button key={idx} onClick={() => { playSfx(`/sounds/sfx_button_click.wav`, 0.15); setActiveCharIdx(idx); }}
                    className={`h-2 rounded-full transition-all duration-300 ${idx === activeCharIdx ? "bg-white/70 w-6" : "bg-white/20 w-2"}`} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Overlays ═══ */}
      <AnimatePresence>
        {selectedCharacter && (
          <ModeSelectOverlay
            character={selectedCharacter}
            onSelect={handleModeSelect}
            onClose={() => setSelectedCharacter(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {view === "continue" && (
          <ContinuePanel
            rooms={mergedRooms}
            onSelect={handleContinue}
            onClose={() => setView("hub")}
          />
        )}
      </AnimatePresence>

      {/* [Story V2] World 카드 그리드 뷰 */}
      <AnimatePresence>
        {view === "worlds" && (
          <StoryV2LobbyView
            onBack={() => setView("hub")}
            onEnterCreate={(worldId) => setStoryV2CreateFlow({ worldId })}
            onContinue={(roomId) => navigate(`/v2/chat/${roomId}`)}
          />
        )}
      </AnimatePresence>

      {/* [Story V2] CreateFlow 모달 */}
      <AnimatePresence>
        {storyV2CreateFlow && (
          <StoryCreateFlow
            worldId={storyV2CreateFlow.worldId}
            presetHeroineIds={storyV2CreateFlow.presetHeroineIds || null}
            onCancel={() => { setStoryV2CreateFlow(null); setView("encounter"); }}
            onComplete={(roomId) => {
              setStoryV2CreateFlow(null);
              navigate(`/v2/chat/${roomId}`);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{showAchievements && <AchievementGallery onClose={() => setShowAchievements(false)} />}</AnimatePresence>

      {/* [Phase I] 캐릭터 카드 → Theater 모드 선택 시 진입하는 CreateFlow */}
      <AnimatePresence>
        {createFlowState && (
          <TheaterCreateFlow
            world={createFlowState.world}
            initialHeroineIds={createFlowState.initialHeroineIds || []}
            skipHeroineSelection={createFlowState.skipHeroineSelection || false}
            onClose={() => { setCreateFlowState(null); if (createFlowState.skipHeroineSelection) setView("encounter"); }}
            // [Phase III · B-4] 무료 유저 Step 4 업셀
            onOpenStore={() => {
              setStoreInitialTab("subscription");
              setShowStore(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* 💎 Lucid Store Overlay */}
      <LucidStore
        isOpen={showStore}
        onClose={() => setShowStore(false)}
        initialTab={storeInitialTab}
        userInfo={userInfo}
        characters={characters}
        onPaymentComplete={async () => {
          setShowStore(false);
          // [Polish · P0] 결제 완료 시 AuthContext + localStorage + LobbyPage 로컬
          //   userInfo를 모두 동기화한다. refreshUser는 AuthContext의 user를 갱신하므로
          //   TheaterCreateFlow의 구독 등급 인식, SecretModeFlow의 성인인증 게이트 등이
          //   결제 직후 정확히 동작.
          if (refreshUser) {
            try { await refreshUser(); } catch { /* fallback below */ }
          }
          fetchUserInfo(); // 결제 후 에너지 갱신 (LobbyPage 로컬 state)
        }}
      />
      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            onClose={() => setShowSettings(false)}
            onLogout={handleLogout}
            bgmMuted={bgmMuted}
            onToggleBgm={() => setBgmMuted((m) => !m)}
          />
        )}
      </AnimatePresence>

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