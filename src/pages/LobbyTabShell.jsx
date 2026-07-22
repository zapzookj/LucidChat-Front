import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drama, MessageCircle } from "lucide-react";

import LobbyPage from "./LobbyPage";
import TheaterLobbyTab from "../components/theater/TheaterLobbyTab";
import TheaterCreateFlow from "../components/theater/TheaterCreateFlow";

/**
 * [Phase 5.5-Theater-Polish] LobbyTabShell v2
 *
 * 이슈 #9 해결:
 *  - 탭바가 LobbyPage 바깥에 있어서 레이아웃 짤림 → LobbyPage Topbar에 통합
 *  - Theater 탭 전환 시 LobbyPage unmount → BGM 끊김 → display:none으로 전환만
 *
 * [아키텍처]
 *  - LobbyPage는 항상 마운트 상태 유지 (BGM persistent)
 *  - Theater 탭 활성 시: LobbyPage는 display:none, TheaterLobbyTab이 위를 덮음
 *  - 탭바(TabBar) 컴포넌트는 LobbyPage의 topbarExtras prop으로 주입
 *
 * [대안 설계 고려사항]
 *  - Dialogue 탭과 Theater 탭이 서로 다른 BGM을 원할 수 있음
 *    → 현재 구현: LobbyPage BGM(로비 BGM) 유지. Theater 탭도 같은 BGM.
 *    → 향후 Theater 탭 전용 BGM 원하면 이 컴포넌트에 AudioEngine 추가 가능
 */

const TABS = {
  DIALOGUE: "DIALOGUE",
  THEATER: "THEATER",
};

export default function LobbyTabShell() {
  const [activeTab, setActiveTab] = useState(TABS.DIALOGUE);
  const [createFlowWorld, setCreateFlowWorld] = useState(null);

  // localStorage 기억 (사용자가 떠난 탭 복원)
  useEffect(() => {
    const saved = localStorage.getItem("lobby_active_tab");
    if (saved && TABS[saved]) setActiveTab(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("lobby_active_tab", activeTab);
  }, [activeTab]);

  const handleTabSwitch = useCallback((tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
  }, [activeTab]);

  // ─── 탭바 컴포넌트 (LobbyPage Topbar에 주입될 엘리먼트) ───
  const tabBar = (
    <div className="flex items-center gap-0.5 bg-black/30 backdrop-blur-md rounded-full p-0.5 border border-white/10">
      <TabButton
        active={activeTab === TABS.DIALOGUE}
        onClick={() => handleTabSwitch(TABS.DIALOGUE)}
        icon={<MessageCircle size={12} />}
        label="Dialogue"
      />
      <TabButton
        active={activeTab === TABS.THEATER}
        onClick={() => handleTabSwitch(TABS.THEATER)}
        icon={<Drama size={12} />}
        label="Theater"
      />
    </div>
  );

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950">
      {/* ═══ Dialogue 탭 (LobbyPage) — 항상 마운트 유지 ═══ */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          visibility: activeTab === TABS.DIALOGUE ? "visible" : "hidden",
          pointerEvents: activeTab === TABS.DIALOGUE ? "auto" : "none",
        }}
      >
        <LobbyPage topbarExtras={tabBar} />
      </div>

      {/* ═══ Theater 탭 — 활성 시에만 렌더 ═══ */}
      <AnimatePresence>
        {activeTab === TABS.THEATER && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 w-full h-full"
          >
            <TheaterLayout
              tabBar={tabBar}
              onOpenCreateFlow={(world) => setCreateFlowWorld(world)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Theater 생성 플로우 ═══ */}
      <AnimatePresence>
        {createFlowWorld && (
          <TheaterCreateFlow
            world={createFlowWorld}
            onClose={() => setCreateFlowWorld(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Theater 탭 레이아웃 (Topbar 포함)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TheaterLayout({ tabBar, onOpenCreateFlow }) {
  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col">
      {/* Theater 전용 배경 그라디언트 */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950">
        {/* 은은한 별빛 */}
        <div className="absolute inset-0 pointer-events-none opacity-50">
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-[2px] h-[2px] bg-white/40 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{ opacity: [0.1, 0.6, 0.1] }}
              transition={{
                duration: 3 + Math.random() * 3,
                repeat: Infinity,
                delay: Math.random() * 3,
              }}
            />
          ))}
        </div>
      </div>

      {/* Topbar — 탭바만 보여주는 미니 버전 (LobbyPage Topbar와 같은 위치) */}
      <div className="relative z-20 flex items-center justify-between px-5 sm:px-8 py-4">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo_icon.png"
            alt=""
            className="h-7 sm:h-8 drop-shadow-lg"
            onError={(e) => { e.target.style.display = "none"; }}
          />
          <span
            className="text-lg sm:text-xl font-bold text-white tracking-[0.12em] drop-shadow-lg"
            style={{ fontFamily: "'Pretendard', sans-serif" }}
          >
            LUCID CHAT
          </span>
        </div>
        <div className="flex items-center gap-3">{tabBar}</div>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar">
        <TheaterLobbyTab onCreateFlow={onOpenCreateFlow} />
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  탭 버튼
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
        active
          ? "bg-white/15 text-white shadow-sm"
          : "text-white/50 hover:text-white/80"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}