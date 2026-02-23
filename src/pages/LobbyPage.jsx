import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import {
  Zap, User, Settings, Sparkles, ChevronLeft, ChevronRight,
  Clock, Heart, BookOpen, Compass, Archive, Play, X, Star
} from "lucide-react";
import AchievementGallery from "../components/AchievementGallery";

// ═══════════════════════════════════════════════════════════════
//  Lucid Station — 자각몽의 정거장
// ═══════════════════════════════════════════════════════════════

// ── 별똥별 파티클 (Idle 애니메이션) ──
const ShootingStar = ({ delay }) => {
  const startX = Math.random() * 100;
  const startY = Math.random() * 40;

  return (
    <motion.div
      className="absolute w-[2px] h-[2px] bg-white rounded-full"
      style={{ left: `${startX}%`, top: `${startY}%` }}
      initial={{ opacity: 0, x: 0, y: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        x: [0, 120, 200],
        y: [0, 80, 140],
      }}
      transition={{
        duration: 1.8,
        delay,
        repeat: Infinity,
        repeatDelay: Math.random() * 12 + 8,
        ease: "easeOut",
      }}
    >
      {/* 꼬리 */}
      <div className="absolute w-[60px] h-[1px] bg-gradient-to-l from-white/80 to-transparent -left-[60px] top-0" />
    </motion.div>
  );
};

// ── 반짝이는 별 ──
const TwinkleStar = ({ style }) => (
  <motion.div
    className="absolute w-[2px] h-[2px] bg-white rounded-full"
    style={style}
    animate={{ opacity: [0.2, 0.8, 0.2], scale: [0.8, 1.2, 0.8] }}
    transition={{
      duration: Math.random() * 3 + 2,
      repeat: Infinity,
      delay: Math.random() * 5,
    }}
  />
);

// ── 시간대별 배경 그라디언트 ──
const getTimeGradient = () => {
  const hour = new Date().getHours();
  // 낮 (6-16)
  if (hour >= 6 && hour < 16) {
    return "from-sky-300 via-blue-400 to-indigo-500";
  }
  // 노을 (16-19)
  if (hour >= 16 && hour < 19) {
    return "from-orange-300 via-rose-400 to-purple-600";
  }
  // 밤 (19-6)
  return "from-slate-900 via-indigo-950 to-slate-950";
};

const isNightTime = () => {
  const hour = new Date().getHours();
  return hour >= 19 || hour < 6;
};

// ── 캐릭터 카드 컴포넌트 ──
const CharacterCard = ({ character, isActive, onClick }) => {
  return (
    <motion.div
      layout
      onClick={onClick}
      className="relative cursor-pointer flex-shrink-0 select-none"
      animate={{
        scale: isActive ? 1 : 0.78,
        opacity: isActive ? 1 : 0.45,
        rotateY: isActive ? 0 : -8,
        z: isActive ? 50 : 0,
      }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      whileHover={!isActive ? { scale: 0.84, opacity: 0.65 } : {}}
      style={{ perspective: "1200px", transformStyle: "preserve-3d" }}
    >
      <div
        className={`
          relative w-[260px] h-[380px] sm:w-[300px] sm:h-[440px] rounded-2xl overflow-hidden
          border transition-all duration-500
          ${isActive
            ? "border-white/30 shadow-[0_0_60px_rgba(147,130,255,0.25)]"
            : "border-white/10 shadow-lg"
          }
        `}
      >
        {/* 카드 배경 이미지 */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/60 via-slate-800/80 to-slate-900">
          {character.thumbnailUrl && (
            <img
              src={character.thumbnailUrl}
              alt={character.name}
              className="w-full h-full object-cover"
              draggable={false}
            />
          )}
          {!character.thumbnailUrl && character.defaultImageUrl && (
            <img
              src={character.defaultImageUrl}
              alt={character.name}
              className="w-full h-full object-cover"
              draggable={false}
            />
          )}
        </div>

        {/* 숨쉬는 듯한 오버레이 */}
        {isActive && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"
            animate={{ opacity: [0.6, 0.8, 0.6] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        )}
        {!isActive && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        )}

        {/* 하단 텍스트 */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <motion.h3
            className="text-xl font-semibold text-white tracking-wide"
            animate={isActive ? { textShadow: "0 0 20px rgba(255,255,255,0.4)" } : {}}
          >
            {character.name}
          </motion.h3>
          <p className="text-sm text-white/60 mt-1 leading-relaxed">
            {character.tagline || "새로운 만남이 당신을 기다립니다"}
          </p>
        </div>

        {/* 활성 카드 상단 빛 */}
        {isActive && (
          <motion.div
            className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/50 to-transparent"
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        )}
      </div>
    </motion.div>
  );
};

// ── 모드 선택 오버레이 ──
const ModeSelectOverlay = ({ character, onSelect, onClose }) => {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* 배경 블러 */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />

      {/* 콘텐츠 */}
      <motion.div
        className="relative z-10 flex flex-col lg:flex-row items-center gap-8 max-w-5xl mx-auto px-4"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
      >
        {/* 캐릭터 카드 (확대) */}
        <div className="relative w-[280px] h-[400px] sm:w-[320px] sm:h-[460px] rounded-2xl overflow-hidden border border-white/20 shadow-[0_0_80px_rgba(147,130,255,0.3)] flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/60 via-slate-800/80 to-slate-900">
            {(character.thumbnailUrl || character.defaultImageUrl) && (
              <img
                src={character.thumbnailUrl || character.defaultImageUrl}
                alt={character.name}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h3 className="text-2xl font-bold text-white">{character.name}</h3>
            <p className="text-sm text-white/50 mt-2 leading-relaxed">
              {character.description || character.tagline || ""}
            </p>
          </div>

          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white/60 hover:text-white hover:bg-black/60 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* 모드 선택 패널 */}
        <div className="flex flex-col gap-5 w-full max-w-sm">
          {/* 스토리 모드 */}
          <motion.button
            onClick={() => onSelect("STORY")}
            disabled={!character.storyAvailable}
            className={`
              relative group text-left p-6 rounded-xl border overflow-hidden transition-all duration-300
              ${character.storyAvailable
                ? "border-amber-400/30 hover:border-amber-400/60 hover:shadow-[0_0_30px_rgba(251,191,36,0.15)] cursor-pointer"
                : "border-white/10 opacity-40 cursor-not-allowed"
              }
            `}
            whileHover={character.storyAvailable ? { scale: 1.02 } : {}}
            whileTap={character.storyAvailable ? { scale: 0.98 } : {}}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-purple-900/10 to-transparent" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <BookOpen size={20} className="text-amber-400" />
                <span className="text-lg font-bold text-amber-200 tracking-wide">스토리 모드</span>
                <span className="text-[11px] font-medium text-amber-400/70 bg-amber-400/10 px-2 py-0.5 rounded-full ml-auto">
                  Story Mode
                </span>
              </div>
              <p className="text-sm text-white/50 leading-relaxed">
                정해진 운명의 서사를 따라갑니다. 깊은 감정의 교류와 여러 결말이 당신을 기다립니다.
              </p>
              <div className="flex items-center gap-1.5 mt-4 text-amber-400/80">
                <Zap size={14} />
                <span className="text-xs font-semibold">대화 당 에너지 2 소모</span>
              </div>
              {!character.storyAvailable && (
                <p className="text-xs text-white/30 mt-2 italic">아직 준비 중인 모드입니다</p>
              )}
            </div>
          </motion.button>

          {/* 자유 모드 */}
          <motion.button
            onClick={() => onSelect("SANDBOX")}
            className="relative group text-left p-6 rounded-xl border border-cyan-400/30 hover:border-cyan-400/60 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] overflow-hidden transition-all duration-300 cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-blue-900/10 to-transparent" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <Compass size={20} className="text-cyan-400" />
                <span className="text-lg font-bold text-cyan-200 tracking-wide">자유 모드</span>
                <span className="text-[11px] font-medium text-cyan-400/70 bg-cyan-400/10 px-2 py-0.5 rounded-full ml-auto">
                  Sandbox Mode
                </span>
              </div>
              <p className="text-sm text-white/50 leading-relaxed">
                가벼운 일상과 예측 불가능한 대화를 즐깁니다. 어떤 제약도, 정해진 결말도 없습니다.
              </p>
              <div className="flex items-center gap-1.5 mt-4 text-cyan-400/80">
                <Zap size={14} />
                <span className="text-xs font-semibold">대화 당 에너지 1 소모</span>
              </div>
            </div>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── 기억의 끈 사이드바 ──
const ContinuePanel = ({ rooms, onSelect, onClose }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case "LOVER": return "text-rose-400";
      case "FRIEND": return "text-amber-400";
      case "ACQUAINTANCE": return "text-emerald-400";
      default: return "text-white/50";
    }
  };

  const getModeBadge = (mode) => {
    if (mode === "STORY") return { label: "스토리", color: "bg-amber-400/15 text-amber-300 border-amber-400/30" };
    return { label: "자유", color: "bg-cyan-400/15 text-cyan-300 border-cyan-400/30" };
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* 배경 클릭으로 닫기 */}
      <motion.div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />

      {/* 사이드 패널 */}
      <motion.div
        className="relative w-full max-w-md h-full bg-slate-900/95 backdrop-blur-xl border-l border-white/10 overflow-hidden"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">기억의 끈</h2>
            <p className="text-xs text-white/30 mt-0.5">Continue · 진행 중인 이야기</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* 방 목록 */}
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
            return (
              <motion.div
                key={room.roomId}
                onClick={() => onSelect(room.roomId)}
                className="relative group p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10 cursor-pointer transition-all duration-300"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-start gap-3.5">
                  {/* 캐릭터 썸네일 */}
                  <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white/10 flex-shrink-0 bg-slate-800">
                    {room.characterThumbnailUrl ? (
                      <img
                        src={room.characterThumbnailUrl}
                        alt={room.characterName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20">
                        <User size={20} />
                      </div>
                    )}
                    {/* 엔딩 도달 뱃지 */}
                    {room.endingReached && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-slate-900 border border-white/20">
                        <Star size={8} className={room.endingType === "HAPPY" ? "text-amber-400" : "text-rose-400"} fill="currentColor" />
                      </div>
                    )}
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">{room.characterName}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    {/* 호감도 바 */}
                    <div className="flex items-center gap-2 mt-2">
                      <Heart size={10} className={getStatusColor(room.statusLevel)} />
                      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-rose-500/60 to-pink-400/60"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(room.affectionScore, 0)}%` }}
                          transition={{ duration: 0.8, delay: 0.1 }}
                        />
                      </div>
                      <span className="text-[10px] text-white/30 w-6 text-right">{room.affectionScore}</span>
                    </div>

                    {/* 마지막 시간 + 엔딩 */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Clock size={10} className="text-white/20" />
                      <span className="text-[11px] text-white/25">{formatTime(room.lastActiveAt)}</span>
                      {room.endingReached && (
                        <span className="text-[10px] text-white/40 ml-auto italic">
                          {room.endingTitle || (room.endingType === "HAPPY" ? "해피엔딩" : "배드엔딩")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 재생 아이콘 */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 group-hover:bg-white/10 transition mt-1">
                    <Play size={12} className="text-white/40 group-hover:text-white/70 transition ml-0.5" />
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

// ═══════════════════════════════════════════════════════════════
//  메인 로비 페이지
// ═══════════════════════════════════════════════════════════════
const LobbyPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // ── 상태 ──
  const [view, setView] = useState("hub"); // hub | characters | continue
  const [characters, setCharacters] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeCharIdx, setActiveCharIdx] = useState(0);
  const [selectedCharacter, setSelectedCharacter] = useState(null); // 모드 선택 오버레이
  const [showAchievements, setShowAchievements] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [entering, setEntering] = useState(false); // 입장 페이드아웃

  // 별 위치 메모이즈
  const stars = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 60}%`,
    })),
    []
  );

  // ── 데이터 로딩 ──
  useEffect(() => {
    fetchUserInfo();
    fetchCharacters();
    fetchRooms();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const res = await api.get("/users/me");
      setUserInfo(res.data);
    } catch (e) {
      console.error("Failed to fetch user info:", e);
    }
  };

  const fetchCharacters = async () => {
    try {
      const res = await api.get("/lobby/characters");
      setCharacters(res.data);
    } catch (e) {
      console.error("Failed to fetch characters:", e);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await api.get("/lobby/rooms");
      setRooms(res.data);
    } catch (e) {
      console.error("Failed to fetch rooms:", e);
    }
  };

  // ── 카루셀 네비게이션 ──
  const goNext = () => setActiveCharIdx((prev) => Math.min(prev + 1, characters.length - 1));
  const goPrev = () => setActiveCharIdx((prev) => Math.max(prev - 1, 0));

  // 키보드 네비게이션
  useEffect(() => {
    if (view !== "characters") return;
    const handler = (e) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape") {
        if (selectedCharacter) setSelectedCharacter(null);
        else setView("hub");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, selectedCharacter, characters.length]);

  // ── 카드 클릭 → 모드 선택 ──
  const handleCardClick = (idx) => {
    if (idx === activeCharIdx) {
      setSelectedCharacter(characters[idx]);
    } else {
      setActiveCharIdx(idx);
    }
  };

  // ── 모드 선택 → 방 생성 + 입장 ──
  const handleModeSelect = async (mode) => {
    if (loading) return;
    setLoading(true);

    try {
      const res = await api.post("/lobby/rooms", {
        characterId: selectedCharacter.id,
        chatMode: mode,
      });

      const roomId = res.data.roomId;
      localStorage.setItem("roomId", roomId);

      // 페이드아웃 → ChatPage로 전환
      setEntering(true);
      setTimeout(() => {
        navigate(`/chat/${roomId}`);
      }, 800);
    } catch (e) {
      const msg = e.response?.data?.message || "입장에 실패했습니다.";
      alert(msg);
      setLoading(false);
    }
  };

  // ── Continue → 채팅방 입장 ──
  const handleContinue = (roomId) => {
    localStorage.setItem("roomId", roomId);
    setEntering(true);
    setTimeout(() => {
      navigate(`/chat/${roomId}`);
    }, 800);
  };

  // ── 로그아웃 ──
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const displayEnergy = userInfo?.energy ?? user?.energy ?? 0;
  const displayNickname = userInfo?.nickname ?? user?.nickname ?? "";

  return (
    <div className="relative w-full h-full overflow-hidden select-none">

      {/* ═══ 배경 레이어 ═══ */}
      <div className="absolute inset-0">
        {/* 기본 그라디언트 하늘 — 시간대 반응형 */}
        <div className={`absolute inset-0 bg-gradient-to-b ${getTimeGradient()} transition-colors duration-[5000ms]`} />

        {/* 구름 텍스처 오버레이 */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.4) 0%, transparent 60%),
              radial-gradient(ellipse at 80% 30%, rgba(255,255,255,0.3) 0%, transparent 55%),
              radial-gradient(ellipse at 50% 80%, rgba(255,255,255,0.2) 0%, transparent 50%)
            `,
          }}
        />

        {/* 배경 이미지 (유저가 제공 시 교체) */}
        {/* <img src="/lobby/sky_bg.png" className="absolute inset-0 w-full h-full object-cover" /> */}

        {/* 별 (밤에만 표시) */}
        {isNightTime() && stars.map((style, i) => (
          <TwinkleStar key={i} style={style} />
        ))}

        {/* 별똥별 (밤에만) */}
        {isNightTime() && [0, 4.5, 9, 14.5, 20].map((delay, i) => (
          <ShootingStar key={i} delay={delay} />
        ))}

        {/* 하단 비네트 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* ═══ 입장 페이드아웃 ═══ */}
      <AnimatePresence>
        {entering && (
          <motion.div
            className="fixed inset-0 z-[100] bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          />
        )}
      </AnimatePresence>

      {/* ═══ Top Bar ═══ */}
      <div className="relative z-20 flex items-center justify-between px-5 sm:px-8 py-4">
        {/* 좌측: 로고 */}
        <motion.div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setView("hub")}
          whileHover={{ scale: 1.02 }}
        >
          {/* 로고 텍스트 (이미지 로고로 교체 가능) */}
          <span className="text-xl sm:text-2xl font-bold text-white tracking-[0.15em] drop-shadow-lg"
            style={{ fontFamily: "'Pretendard', sans-serif" }}
          >
            LUCID CHAT
          </span>
        </motion.div>

        {/* 우측: 에너지, 닉네임, 설정 */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* 에너지 */}
          <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5">
            <Zap size={14} className="text-amber-400" />
            <span className="text-sm font-semibold text-white">{displayEnergy}</span>
          </div>

          {/* 닉네임 */}
          <div className="hidden sm:flex items-center gap-1.5 text-white/60 text-sm">
            <User size={14} />
            <span>{displayNickname}</span>
          </div>

          {/* 설정/로그아웃 */}
          <button
            onClick={handleLogout}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white/50 hover:text-white hover:bg-black/40 transition"
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            {/* 캐치프레이즈 */}
            <motion.p
              className="text-white/25 text-xs sm:text-sm tracking-[0.3em] uppercase mb-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Lucid Station
            </motion.p>

            {/* 메뉴 버튼들 — 영화 포스터 스타일 타이포그래피 */}
            <div className="flex flex-col items-center gap-6 sm:gap-8">
              {[
                {
                  label: "새로운 만남",
                  sub: "New Encounter",
                  icon: Sparkles,
                  action: () => setView("characters"),
                },
                {
                  label: "기억의 끈",
                  sub: "Continue",
                  icon: Clock,
                  action: () => {
                    fetchRooms();
                    setView("continue");
                  },
                  disabled: rooms.length === 0,
                },
                {
                  label: "수집품",
                  sub: "Archives",
                  icon: Archive,
                  action: () => setShowAchievements(true),
                },
              ].map((item, i) => (
                <motion.button
                  key={item.label}
                  onClick={item.action}
                  disabled={item.disabled}
                  className={`
                    group flex flex-col items-center gap-1
                    ${item.disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                  `}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.12, duration: 0.5 }}
                  whileHover={!item.disabled ? { scale: 1.05 } : {}}
                  whileTap={!item.disabled ? { scale: 0.97 } : {}}
                >
                  <motion.span
                    className="text-2xl sm:text-4xl font-bold text-white tracking-wider transition-all duration-300"
                    style={{ fontFamily: "'Pretendard', sans-serif" }}
                    whileHover={{
                      textShadow: "0 0 30px rgba(255,255,255,0.6), 0 0 60px rgba(147,130,255,0.4)",
                    }}
                  >
                    {item.label}
                  </motion.span>
                  <span className="text-[11px] text-white/20 tracking-[0.25em] uppercase group-hover:text-white/40 transition">
                    {item.sub}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* 하단 장식선 */}
            <motion.div
              className="absolute bottom-12 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.8, duration: 1 }}
            />
          </motion.div>
        )}

        {/* ═══ 캐릭터 선택 화면 ═══ */}
        {view === "characters" && (
          <motion.div
            key="characters"
            className="relative z-10 flex flex-col h-[calc(100%-80px)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* 뒤로가기 */}
            <div className="px-6 py-2">
              <button
                onClick={() => setView("hub")}
                className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition"
              >
                <ChevronLeft size={16} />
                <span>돌아가기</span>
              </button>
            </div>

            {/* 타이틀 */}
            <motion.div
              className="text-center mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">새로운 만남</h2>
              <p className="text-xs text-white/25 mt-1 tracking-wider">당신의 이야기를 함께할 존재를 선택하세요</p>
            </motion.div>

            {/* 캐릭터 카루셀 */}
            <div className="flex-1 flex items-center justify-center relative">
              {characters.length === 0 ? (
                <div className="text-white/30 text-sm">캐릭터를 불러오는 중...</div>
              ) : (
                <>
                  {/* 좌 화살표 */}
                  {activeCharIdx > 0 && (
                    <motion.button
                      onClick={goPrev}
                      className="absolute left-4 sm:left-8 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-white/50 hover:text-white hover:bg-black/50 transition"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <ChevronLeft size={18} />
                    </motion.button>
                  )}

                  {/* 카드 컨테이너 */}
                  <div className="flex items-center justify-center gap-4 sm:gap-6">
                    {characters.map((character, idx) => (
                      <CharacterCard
                        key={character.id}
                        character={character}
                        isActive={idx === activeCharIdx}
                        onClick={() => handleCardClick(idx)}
                      />
                    ))}
                  </div>

                  {/* 우 화살표 */}
                  {activeCharIdx < characters.length - 1 && (
                    <motion.button
                      onClick={goNext}
                      className="absolute right-4 sm:right-8 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-white/50 hover:text-white hover:bg-black/50 transition"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <ChevronRight size={18} />
                    </motion.button>
                  )}
                </>
              )}
            </div>

            {/* 하단 인디케이터 */}
            {characters.length > 1 && (
              <div className="flex justify-center gap-2 pb-8">
                {characters.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveCharIdx(idx)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      idx === activeCharIdx ? "bg-white/70 w-6" : "bg-white/20"
                    }`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ 모드 선택 오버레이 ═══ */}
      <AnimatePresence>
        {selectedCharacter && (
          <ModeSelectOverlay
            character={selectedCharacter}
            onSelect={handleModeSelect}
            onClose={() => setSelectedCharacter(null)}
          />
        )}
      </AnimatePresence>

      {/* ═══ 기억의 끈 사이드바 ═══ */}
      <AnimatePresence>
        {view === "continue" && (
          <ContinuePanel
            rooms={rooms}
            onSelect={handleContinue}
            onClose={() => setView("hub")}
          />
        )}
      </AnimatePresence>

      {/* ═══ 수집품 갤러리 ═══ */}
      <AnimatePresence>
        {showAchievements && (
          <AchievementGallery onClose={() => setShowAchievements(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LobbyPage;