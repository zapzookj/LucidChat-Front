import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Play, Pause, ChevronRight, Heart, Crown, Drama
} from "lucide-react";
import { fetchTheaterRoom } from "../api/TheaterLobbyApi";
import { updatePlaySettings } from "../api/TheaterPlayApi";
import {
  fetchLocationBranch, fetchSceneBranch, confirmBranchChoice
} from "../api/TheaterGameplayApi";
import useTheaterStream from "../hooks/useTheaterStream";
import TheaterChapterReportModal from "../components/theater/TheaterChapterReportModal";
import TheaterBranchModal from "../components/theater/TheaterBranchModal";

/**
 * [Phase 5.5-Theater] Theater 플레이어 페이지 (분기 통합 버전)
 */

const SPEED_DURATION_MS = { SLOW: 7000, NORMAL: 4500, FAST: 2500 };
const TYPING_SPEED = { SLOW: 55, NORMAL: 35, FAST: 20 };

function useTypewriter(fullText, speedMs, skip = false) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!fullText) { setDisplayed(""); setDone(true); return; }
    if (skip) { setDisplayed(fullText); setDone(true); return; }
    setDisplayed(""); setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(fullText.slice(0, i));
      if (i >= fullText.length) { clearInterval(interval); setDone(true); }
    }, speedMs);
    return () => clearInterval(interval);
  }, [fullText, speedMs, skip]);
  return { displayed, done };
}

const SceneDisplay = ({ scene, playSpeed, skipTyping, onTypingDone }) => {
  const speed = TYPING_SPEED[playSpeed] || TYPING_SPEED.NORMAL;
  const { displayed: narration, done: nDone } = useTypewriter(scene?.narration || "", speed, skipTyping);
  const { displayed: innerN, done: iDone } = useTypewriter(nDone ? scene?.innerNarration || "" : "", speed, skipTyping);
  const { displayed: dialogue, done: dDone } = useTypewriter(iDone ? scene?.dialogue || "" : "", speed, skipTyping);

  useEffect(() => {
    if (nDone && iDone && dDone && onTypingDone) onTypingDone();
  }, [nDone, iDone, dDone, onTypingDone]);

  if (!scene) return null;
  return (
    <div className="relative z-10 min-h-[240px] max-w-3xl mx-auto space-y-4">
      {scene.narration && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="text-white/90 text-lg leading-relaxed tracking-wide drop-shadow-lg"
          style={{ fontFamily: "'Noto Serif KR', serif" }}>
          {narration}
          {!nDone && <span className="inline-block w-[2px] h-5 bg-white/70 ml-0.5 animate-pulse" />}
        </motion.div>
      )}
      {scene.innerNarration && nDone && (
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
          className="text-purple-200/80 text-base leading-relaxed italic pl-4 border-l-2 border-purple-400/40"
          style={{ fontFamily: "'Noto Serif KR', serif" }}>
          <span className="text-purple-400/60 mr-1">「</span>{innerN}<span className="text-purple-400/60 ml-1">」</span>
        </motion.div>
      )}
      {scene.dialogue && iDone && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="pt-3 border-t border-white/10">
          {scene.speakerName && <div className="text-amber-200/80 text-sm font-bold mb-1">{scene.speakerName}</div>}
          <div className="text-white text-xl leading-relaxed drop-shadow-lg">"{dialogue}"</div>
        </motion.div>
      )}
    </div>
  );
};

const HeroineHud = ({ heroines, currentSpeakerId }) => {
  if (!heroines || heroines.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {heroines.map((h) => {
        const isActive = h.characterId === currentSpeakerId;
        return (
          <motion.div key={h.characterId} animate={{ scale: isActive ? 1.03 : 1 }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border ${
              isActive ? "bg-rose-500/20 border-rose-400/60" : "bg-black/30 border-white/10"
            }`}>
            <div className="w-6 h-6 rounded-full bg-cover bg-center" style={{
              backgroundImage: h.thumbnailUrl ? `url(${h.thumbnailUrl})` : "none",
              backgroundColor: "#4c1d95"
            }} />
            <span className={`text-xs font-bold ${isActive ? "text-rose-100" : "text-white/60"}`}>{h.name}</span>
            <div className="flex items-center gap-0.5 text-[10px]">
              <Heart size={9} className={isActive ? "text-rose-300" : "text-white/40"} fill="currentColor" />
              <span className={isActive ? "text-rose-200" : "text-white/50"}>{h.affection}</span>
            </div>
            {h.confirmedMain && <Crown size={10} className="text-amber-300" />}
          </motion.div>
        );
      })}
    </div>
  );
};

export default function TheaterPlayPage() {
  const { roomId } = useParams();
  const numericRoomId = Number(roomId);
  const navigate = useNavigate();

  const [roomInfo, setRoomInfo] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [chapterReport, setChapterReport] = useState(null);
  const [branchModalData, setBranchModalData] = useState(null);
  const [locationBranchRequested, setLocationBranchRequested] = useState(false);

  const [playSpeed, setPlaySpeed] = useState("NORMAL");
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [typingDone, setTypingDone] = useState(false);
  const [skipTyping, setSkipTyping] = useState(false);

  const autoPlayTimerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const info = await fetchTheaterRoom(numericRoomId);
        if (!alive) return;
        setRoomInfo(info);
        if (info.playSettings) {
          setPlaySpeed(info.playSettings.playSpeed || "NORMAL");
          setAutoPlayEnabled(info.playSettings.autoPlayEnabled ?? true);
        }
      } catch (e) {
        if (alive) setLoadError(e?.response?.data?.message || "방 정보를 불러오지 못했습니다.");
      }
    })();
    return () => { alive = false; };
  }, [numericRoomId]);

  const {
    currentBatch, currentSceneIndex, currentScene,
    loadingNext, chapterEnding, nextScene, resumeAfterChapter, reloadBatch
  } = useTheaterStream({
    roomId: numericRoomId,
    autoStart: !!roomInfo && !roomInfo.endingReached && !roomInfo.progress?.inIntermission,
    onChapterEnd: (report) => setChapterReport(report),
    onBranchReady: async (branchSignal) => {
      try {
        const options = await fetchSceneBranch(numericRoomId, branchSignal.level, branchSignal.contextSummary);
        setBranchModalData({ options, isLocation: false });
      } catch (e) {
        console.error("[Theater] branch fetch failed:", e);
      }
    },
    onError: (e) => console.error("[Theater] Stream error:", e),
  });

  useEffect(() => {
    if (!roomInfo || !currentBatch) return;
    if (locationBranchRequested) return;
    if (roomInfo.heroines?.length < 2) return;
    const progress = roomInfo.progress;
    if (!progress || progress.currentAct > 3) return;
    if (currentBatch.batchId !== 0 || currentSceneIndex !== 0) return;

    (async () => {
      try {
        setLocationBranchRequested(true);
        const options = await fetchLocationBranch(numericRoomId);
        setBranchModalData({ options, isLocation: true });
      } catch (e) {
        console.debug("[Theater] location branch skipped:", e?.message);
      }
    })();
  }, [roomInfo, currentBatch, currentSceneIndex, locationBranchRequested, numericRoomId]);

  const handleBranchConfirm = useCallback(async (chosenIndex) => {
    if (!branchModalData) return;
    try {
      await confirmBranchChoice(numericRoomId, {
        level: branchModalData.options.branchLevel,
        chosenIndex,
        branchToken: branchModalData.options.branchToken || null,
        optionsSnapshot: branchModalData.options.options,
      });
      setBranchModalData(null);
      reloadBatch();
    } catch (e) {
      console.error("[Theater] Branch confirm failed:", e);
    }
  }, [branchModalData, numericRoomId, reloadBatch]);

  useEffect(() => {
    if (!autoPlayEnabled || !typingDone) return;
    if (loadingNext || chapterEnding) return;
    if (chapterReport || branchModalData) return;
    const delay = SPEED_DURATION_MS[playSpeed] || SPEED_DURATION_MS.NORMAL;
    autoPlayTimerRef.current = setTimeout(() => {
      nextScene();
      setTypingDone(false);
      setSkipTyping(false);
    }, delay);
    return () => { if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current); };
  }, [typingDone, autoPlayEnabled, playSpeed, currentSceneIndex, loadingNext,
      chapterEnding, chapterReport, branchModalData, nextScene]);

  useEffect(() => {
    setTypingDone(false);
    setSkipTyping(false);
  }, [currentSceneIndex, currentBatch?.batchId]);

  const handleSpeedChange = useCallback(async (s) => {
    setPlaySpeed(s);
    try { await updatePlaySettings(numericRoomId, { autoPlayEnabled, playSpeed: s }); } catch {}
  }, [numericRoomId, autoPlayEnabled]);

  const handleToggleAutoPlay = useCallback(async () => {
    const next = !autoPlayEnabled;
    setAutoPlayEnabled(next);
    try { await updatePlaySettings(numericRoomId, { autoPlayEnabled: next, playSpeed }); } catch {}
  }, [autoPlayEnabled, playSpeed, numericRoomId]);

  const handleManualAdvance = () => {
    if (branchModalData || chapterReport) return;
    if (!typingDone) { setSkipTyping(true); setTypingDone(true); return; }
    nextScene();
  };

  const handleChapterReportClose = useCallback(() => {
    const report = chapterReport;
    setChapterReport(null);
    setLocationBranchRequested(false);
    if (report?.leadsToIntermission) {
      navigate(`/theater/${numericRoomId}/intermission`);
      return;
    }
    resumeAfterChapter();
  }, [chapterReport, resumeAfterChapter, navigate, numericRoomId]);

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-4">
        <p className="text-red-300 mb-4">{loadError}</p>
        <button onClick={() => navigate("/lobby")}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70">
          로비로 돌아가기
        </button>
      </div>
    );
  }
  if (!roomInfo) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <motion.div className="w-10 h-10 border-2 border-purple-400/40 border-t-purple-400 rounded-full"
          animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
      </div>
    );
  }

  const speaker = currentBatch?.speakerHeroineId;

  return (
    <div className="relative min-h-screen bg-slate-950 overflow-hidden select-none" onClick={handleManualAdvance}>
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-slate-950 to-purple-950/30" />

      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={(e) => { e.stopPropagation(); navigate("/lobby"); }}
            className="p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70">
            <ArrowLeft size={16} />
          </button>
          <div className="bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10">
            <div className="flex items-center gap-2 text-xs">
              <Drama size={11} className="text-indigo-300" />
              <span className="text-white/80 font-bold">{roomInfo.worldDisplayName}</span>
              <span className="text-white/30">·</span>
              <span className="text-white/50">
                Act {roomInfo.progress?.currentAct} / Ch {roomInfo.progress?.currentChapter}
              </span>
            </div>
          </div>
        </div>
        <HeroineHud heroines={roomInfo.heroines} currentSpeakerId={speaker} />
      </div>

      <div className="relative z-10 flex-1 min-h-screen flex items-center justify-center px-4 pt-24 pb-32">
        <AnimatePresence mode="wait">
          {currentScene && (
            <motion.div
              key={`${currentBatch?.batchId}-${currentSceneIndex}`}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}
              className="w-full max-w-3xl bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-white/5">
              <SceneDisplay scene={currentScene} playSpeed={playSpeed}
                skipTyping={skipTyping} onTypingDone={() => setTypingDone(true)} />
              <div className="mt-4 flex items-center justify-center gap-1.5">
                {currentBatch?.scenes?.map((_, i) => (
                  <div key={i} className={`h-[2px] rounded-full transition-all ${
                    i === currentSceneIndex ? "w-6 bg-white/80"
                    : i < currentSceneIndex ? "w-3 bg-white/30" : "w-3 bg-white/10"
                  }`} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 max-w-3xl mx-auto">
          <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-full p-1 border border-white/10">
            {["SLOW", "NORMAL", "FAST"].map((s) => (
              <button key={s} onClick={() => handleSpeedChange(s)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  playSpeed === s ? "bg-white/15 text-white" : "text-white/40"
                }`}>
                {s === "SLOW" ? "느림" : s === "NORMAL" ? "보통" : "빠름"}
              </button>
            ))}
          </div>
          <motion.button onClick={handleManualAdvance}
            disabled={loadingNext || chapterEnding} whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-2 px-8 py-3 rounded-full font-bold text-sm shadow-xl ${
              (loadingNext || chapterEnding) ? "bg-white/10 text-white/30 cursor-not-allowed"
              : "bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
            }`}>
            {loadingNext || chapterEnding ? "로딩..." : <>다음 <ChevronRight size={16} /></>}
          </motion.button>
          <button onClick={handleToggleAutoPlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-md border ${
              autoPlayEnabled ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
              : "bg-black/40 border-white/10 text-white/50"
            }`}>
            {autoPlayEnabled ? <Play size={11} fill="currentColor" /> : <Pause size={11} fill="currentColor" />}
            {autoPlayEnabled ? "자동" : "수동"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {branchModalData && (
          <TheaterBranchModal branchOptions={branchModalData.options}
            onConfirm={handleBranchConfirm} onCancel={null} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {chapterReport && (
          <TheaterChapterReportModal report={chapterReport} onClose={handleChapterReportClose} />
        )}
      </AnimatePresence>
    </div>
  );
}