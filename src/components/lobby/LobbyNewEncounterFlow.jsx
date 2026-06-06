import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, MessageCircle, BookOpen, Drama, Sparkles, Loader2 } from "lucide-react";
import api from "../../api/axios";
import { fetchWorlds as fetchStoryWorlds } from "../../api/StoryV2Api";
import { sfx } from "../../utils/sfx";
import LobbyCard from "./LobbyCard";

/**
 * [Phase 7-V2 Pivot] 통합 "새로운 만남" 플로우.
 *
 * 단일 진입점에서 3단계 카드 내비게이션으로 통일:
 *   1) 모드 선택  (자유 채팅 / 스토리 / 극장)
 *   2) 세계관 선택 (World 카드)
 *   3) 캐릭터 선택 (히로인 카드 — 자유=1명, 스토리/극장=1~3명)
 *
 * 완료 시 모드별 분기:
 *   - SANDBOX  → 방 즉시 생성 → onEnterChat(roomId)
 *   - STORY    → onHandoffStory({ worldId, heroineIds })  (페르소나/장소 셋업은 StoryCreateFlow)
 *   - THEATER  → onHandoffTheater({ worldId, heroineIds }) (스탯 배분 등은 TheaterCreateFlow)
 *
 * Props:
 *   onBack()                          — 로비 홈 복귀
 *   onEnterChat(roomId)               — 자유 채팅 방 진입
 *   onHandoffStory({worldId,heroineIds})   — 스토리 셋업 위임
 *   onHandoffTheater({worldId,heroineIds}) — 극장 셋업 위임
 */

// ── 모드 비주얼 구성 — 각 모드마다 색·아이콘·장식 차별화 ──
const MODES = [
  {
    key: "SANDBOX", title: "자유 채팅", subtitle: "캐릭터와 자유롭게 대화", tagEn: "Free Chat",
    icon: MessageCircle, accent: "cyan",
    gradient: "from-cyan-500/30 via-sky-600/15 to-slate-900",
    glow: "rgba(34,211,238,0.35)", iconBg: "from-cyan-400/30 to-sky-500/10", iconColor: "text-cyan-200",
    ring: "group-hover:border-cyan-400/50", blob: "bg-cyan-400/20",
  },
  {
    key: "STORY", title: "스토리", subtitle: "디렉터가 이끄는 서사 모드", tagEn: "Story",
    icon: BookOpen, accent: "amber",
    gradient: "from-amber-500/30 via-orange-600/15 to-slate-900",
    glow: "rgba(251,191,36,0.35)", iconBg: "from-amber-400/30 to-orange-500/10", iconColor: "text-amber-200",
    ring: "group-hover:border-amber-400/50", blob: "bg-amber-400/20",
  },
  {
    key: "THEATER", title: "극장", subtitle: "연출된 무대 위의 이야기", tagEn: "Theater",
    icon: Drama, accent: "violet",
    gradient: "from-violet-500/30 via-purple-600/15 to-slate-900",
    glow: "rgba(167,139,250,0.35)", iconBg: "from-violet-400/30 to-purple-500/10", iconColor: "text-violet-100",
    ring: "group-hover:border-violet-400/50", blob: "bg-violet-400/20",
  },
];

const ACCENT_BY_MODE = { SANDBOX: "cyan", STORY: "amber", THEATER: "violet" };

// ── 모드 카드 — 풍부한 비주얼 (일반 LobbyCard와 별도 디자인) ──
function ModeCard({ mode, index, onClick }) {
  const Icon = mode.icon;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => sfx.hover?.()}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, type: "spring", stiffness: 240, damping: 22 }}
      whileHover={{ y: -8, transition: { type: "spring", stiffness: 320, damping: 20 } }}
      whileTap={{ scale: 0.97 }}
      className={`group relative w-[240px] h-[348px] sm:w-[270px] sm:h-[392px] rounded-3xl overflow-hidden border border-white/10 ${mode.ring} transition-colors duration-300`}
      style={{ boxShadow: `0 8px 40px -12px ${mode.glow}` }}
    >
      {/* 그라데이션 배경 */}
      <div className={`absolute inset-0 bg-gradient-to-br ${mode.gradient}`} />

      {/* 떠다니는 blob 장식 */}
      <motion.div
        className={`absolute -top-10 -right-10 w-44 h-44 rounded-full blur-3xl ${mode.blob}`}
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={`absolute -bottom-12 -left-8 w-40 h-40 rounded-full blur-3xl ${mode.blob} opacity-60`}
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      {/* 상단 글로우 라인 */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50 group-hover:opacity-90 transition-opacity" />

      {/* 콘텐츠 */}
      <div className="relative h-full flex flex-col items-center justify-center px-6 text-center">
        {/* 아이콘 — 큰 원형 + 펄스 글로우 */}
        <motion.div
          className={`relative mb-7 w-24 h-24 rounded-2xl bg-gradient-to-br ${mode.iconBg} border border-white/15 flex items-center justify-center backdrop-blur-sm`}
          whileHover={{ rotate: [0, -4, 4, 0], transition: { duration: 0.5 } }}
        >
          <motion.div
            className="absolute inset-0 rounded-2xl"
            style={{ boxShadow: `0 0 30px ${mode.glow}` }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <Icon size={44} className={`relative ${mode.iconColor}`} strokeWidth={1.6} />
        </motion.div>

        <h3 className="text-2xl font-bold text-white tracking-wide mb-1.5">{mode.title}</h3>
        <p className="text-sm text-white/55 leading-relaxed mb-4">{mode.subtitle}</p>

        <span className="text-[10px] tracking-[0.3em] uppercase text-white/25 group-hover:text-white/45 transition-colors">
          {mode.tagEn}
        </span>

        {/* 하단 화살표 인디케이터 */}
        <motion.div
          className="absolute bottom-6 text-white/30 group-hover:text-white/70 transition-colors"
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronLeft size={20} className="rotate-[270deg]" />
        </motion.div>
      </div>
    </motion.button>
  );
}

export default function LobbyNewEncounterFlow({
  onBack,
  onEnterChat,
  onHandoffStory,
  onHandoffTheater,
}) {
  const [step, setStep] = useState("mode");        // "mode" | "world" | "character"
  const [mode, setMode] = useState(null);          // SANDBOX | STORY | THEATER
  const [worlds, setWorlds] = useState([]);
  const [selectedWorldId, setSelectedWorldId] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [selectedCharIds, setSelectedCharIds] = useState([]);
  const [loadingWorlds, setLoadingWorlds] = useState(false);
  const [loadingChars, setLoadingChars] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const accent = mode ? ACCENT_BY_MODE[mode] : "neutral";
  const maxSelect = mode === "SANDBOX" ? 1 : 3;
  const multiSelect = mode !== "SANDBOX";

  const selectedWorld = useMemo(
    () => worlds.find((w) => w.worldId === selectedWorldId) || null,
    [worlds, selectedWorldId]
  );

  // ── 세계관 로드 ──
  useEffect(() => {
    if (step !== "world") return;
    setLoadingWorlds(true);
    setError(null);
    fetchStoryWorlds()
      .then((list) => setWorlds(list || []))
      .catch((e) => {
        console.error("[Encounter] worlds load failed", e);
        setError("세계관을 불러올 수 없습니다.");
      })
      .finally(() => setLoadingWorlds(false));
  }, [step]);

  // ── 캐릭터 로드 (선택 세계관 기준) ──
  useEffect(() => {
    if (step !== "character" || !selectedWorldId) return;
    setLoadingChars(true);
    setError(null);
    api
      .get(`/lobby/characters?worldId=${encodeURIComponent(selectedWorldId)}`)
      .then((res) => {
        // 모드별 가용성 필터: 스토리=storyAvailable, 극장=theaterAvailable, 자유=전체
        let list = res.data || [];
        if (mode === "STORY") list = list.filter((c) => c.storyAvailable);
        else if (mode === "THEATER") list = list.filter((c) => c.theaterAvailable);
        setCharacters(list);
      })
      .catch((e) => {
        console.error("[Encounter] characters load failed", e);
        setError("캐릭터를 불러올 수 없습니다.");
      })
      .finally(() => setLoadingChars(false));
  }, [step, selectedWorldId, mode]);

  // ── 단계 핸들러 ──
  const handlePickMode = (m) => {
    sfx.click();
    setMode(m);
    setSelectedWorldId(null);
    setSelectedCharIds([]);
    setStep("world");
  };

  const handlePickWorld = (worldId) => {
    sfx.click();
    setSelectedWorldId(worldId);
    setSelectedCharIds([]);
    setStep("character");
  };

  const toggleChar = (id) => {
    if (!multiSelect) {
      sfx.click();
      setSelectedCharIds([id]);
      return;
    }
    setSelectedCharIds((prev) => {
      if (prev.includes(id)) {
        sfx.click();
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= maxSelect) {
        sfx.thud();
        return prev;
      }
      sfx.click();
      return [...prev, id];
    });
  };

  const goBack = useCallback(() => {
    sfx.click();
    setError(null);
    if (step === "mode") { onBack?.(); return; }
    if (step === "world") { setStep("mode"); setMode(null); return; }
    if (step === "character") { setStep("world"); setSelectedCharIds([]); return; }
  }, [step, onBack]);

  // ── 완료: 모드별 분기 ──
  const canComplete = selectedCharIds.length >= 1 && selectedCharIds.length <= maxSelect;

  const handleComplete = async () => {
    if (!canComplete || submitting) return;

    if (mode === "STORY") {
      sfx.chime();
      onHandoffStory?.({ worldId: selectedWorldId, heroineIds: selectedCharIds });
      return;
    }
    if (mode === "THEATER") {
      sfx.chime();
      onHandoffTheater?.({ worldId: selectedWorldId, heroineIds: selectedCharIds });
      return;
    }

    // SANDBOX — 방 즉시 생성
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/lobby/rooms", {
        characterId: selectedCharIds[0],
        chatMode: "SANDBOX",
      });
      sfx.chime();
      onEnterChat?.(res.data.roomId);
    } catch (e) {
      console.error("[Encounter] sandbox create failed", e);
      setError(e.response?.data?.message || "방 생성에 실패했습니다.");
      setSubmitting(false);
    }
  };

  // ── breadcrumb ──
  const crumbs = [
    { label: "모드", active: step === "mode", done: step !== "mode" },
    { label: "세계관", active: step === "world", done: step === "character" },
    { label: "캐릭터", active: step === "character", done: false },
  ];

  const stepTitle =
    step === "mode" ? "무엇을 할까요"
    : step === "world" ? "세계관 선택"
    : "함께할 캐릭터 선택";
  const stepSub =
    step === "mode" ? "모드를 선택하세요"
    : step === "world" ? "이야기가 펼쳐질 무대를 고르세요"
    : multiSelect ? `최소 1명, 최대 ${maxSelect}명까지 선택` : "대화할 캐릭터를 선택하세요";

  return (
    <motion.div
      key="new-encounter"
      className="relative z-10 flex flex-col h-[calc(100%-80px)]"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
    >
      {/* 상단: 뒤로 + breadcrumb */}
      <div className="px-6 py-2 flex items-center justify-between">
        <button
          onClick={goBack}
          onMouseEnter={() => sfx.hover?.()}
          className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors duration-200"
        >
          <ChevronLeft size={16} /><span>{step === "mode" ? "로비" : "이전"}</span>
        </button>
        <div className="flex items-center gap-2">
          {crumbs.map((c, i) => (
            <div key={c.label} className="flex items-center gap-2">
              <span className={`text-xs tracking-wide transition-colors ${
                c.active ? "text-white font-semibold" : c.done ? "text-white/50" : "text-white/25"
              }`}>{c.label}</span>
              {i < crumbs.length - 1 && <span className="text-white/15 text-xs">›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 제목 */}
      <motion.div className="text-center mb-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">{stepTitle}</h2>
        <p className="text-xs text-white/25 mt-1 tracking-wider">{stepSub}</p>
      </motion.div>

      {/* 본문 — 카드 그리드 (세로 중앙 정렬, 콘텐츠 많으면 스크롤) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6">
        <div className="min-h-full flex flex-col justify-center py-6">
        {error && (
          <div className="max-w-md mx-auto mb-4 px-4 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm text-center">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* STEP 1 — 모드 */}
          {step === "mode" && (
            <motion.div
              key="s-mode"
              className="flex flex-wrap items-center justify-center gap-5 sm:gap-7"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            >
              {MODES.map((m, i) => (
                <ModeCard key={m.key} mode={m} index={i} onClick={() => handlePickMode(m.key)} />
              ))}
            </motion.div>
          )}

          {/* STEP 2 — 세계관 */}
          {step === "world" && (
            <motion.div
              key="s-world"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            >
              {loadingWorlds ? (
                <div className="flex items-center justify-center py-20 text-white/30">
                  <Loader2 size={20} className="animate-spin mr-2" /> 세계관을 불러오는 중...
                </div>
              ) : worlds.length === 0 ? (
                <div className="text-center py-20 text-white/30 text-sm">사용 가능한 세계관이 없습니다.</div>
              ) : (
                <div className="flex flex-wrap items-start justify-center gap-4 sm:gap-5 pt-2">
                  {worlds.map((w, i) => (
                    <LobbyCard
                      key={w.worldId}
                      index={i}
                      size="lg"
                      imageUrl={w.heroImageUrl || w.thumbnailUrl}
                      title={w.displayName}
                      subtitle={w.tagline || w.description}
                      meta={w.heroineCount != null ? `히로인 ${w.heroineCount}명` : null}
                      accent={accent}
                      fallbackIcon={Sparkles}
                      onClick={() => handlePickWorld(w.worldId)}
                      onHover={() => sfx.hover?.()}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 3 — 캐릭터 */}
          {step === "character" && (
            <motion.div
              key="s-char"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            >
              {selectedWorld && (
                <p className="text-center text-xs text-white/30 mb-4">
                  <span className={`text-${accent}-300/70`}>{selectedWorld.displayName}</span>
                </p>
              )}
              {loadingChars ? (
                <div className="flex items-center justify-center py-20 text-white/30">
                  <Loader2 size={20} className="animate-spin mr-2" /> 캐릭터를 불러오는 중...
                </div>
              ) : characters.length === 0 ? (
                <div className="text-center py-20 text-white/30 text-sm">
                  이 세계관에는 {mode === "THEATER" ? "극장" : mode === "STORY" ? "스토리" : ""} 가능한 캐릭터가 없습니다.
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-center gap-3 sm:gap-4 pt-2">
                  {characters.map((c, i) => (
                    <LobbyCard
                      key={c.id}
                      index={i}
                      imageUrl={c.thumbnailUrl || c.defaultImageUrl}
                      title={c.name}
                      subtitle={c.tagline}
                      accent={accent}
                      selected={selectedCharIds.includes(c.id)}
                      onClick={() => toggleChar(c.id)}
                      onHover={() => sfx.hover?.()}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>

      {/* 하단 — 캐릭터 단계 진행 버튼 */}
      {step === "character" && characters.length > 0 && (
        <motion.div
          className="px-6 py-4 border-t border-white/5 flex items-center justify-between gap-4"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-xs text-white/40">
            {multiSelect
              ? `${selectedCharIds.length} / ${maxSelect} 선택됨`
              : selectedCharIds.length > 0 ? "선택 완료" : "캐릭터를 선택하세요"}
          </span>
          <button
            onClick={handleComplete}
            disabled={!canComplete || submitting}
            className={`px-6 py-2.5 rounded-full font-bold text-sm transition flex items-center gap-2
              ${canComplete && !submitting
                ? mode === "STORY"   ? "bg-amber-500 hover:bg-amber-400 text-black"
                : mode === "THEATER" ? "bg-violet-500 hover:bg-violet-400 text-white"
                : "bg-cyan-500 hover:bg-cyan-400 text-black"
                : "bg-white/5 text-white/30 cursor-not-allowed"}`}
          >
            {submitting ? <><Loader2 size={16} className="animate-spin" /> 생성 중...</>
              : mode === "SANDBOX" ? "대화 시작"
              : "다음"}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}