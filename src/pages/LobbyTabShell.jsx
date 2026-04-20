import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Drama } from "lucide-react";
import LobbyPage from "./LobbyPage";
import TheaterLobbyTab from "../components/theater/TheaterLobbyTab";
import TheaterCreateFlow from "../components/theater/TheaterCreateFlow";

/**
 * [Phase 5.5-Theater] 로비 탭 쉘 (LobbyTabShell)
 *
 * 기존 LobbyPage를 건드리지 않고, 상위에서 Dialogue/Theater 탭을 전환한다.
 * 라우팅 진입점은 이 컴포넌트이며, 라우터의 `/lobby` 경로를 이 파일로 교체한다.
 *
 * 탭 전환 UX:
 *  - Dialogue 탭: 기존 LobbyPage 전체 그대로
 *  - Theater 탭: TheaterLobbyTab + 진입 시 TheaterCreateFlow 모달
 *
 * [디자인 컨셉]
 *  - 상단에 큰 탭 전환 바 배치
 *  - 탭별로 배경 무드가 달라짐 (Dialogue: 카페 느낌, Theater: 극장 느낌)
 */

const TABS = [
  {
    key: "DIALOGUE",
    label: "Dialogue",
    subtitle: "대화의 공간",
    icon: MessageSquare,
    accent: "indigo",
  },
  {
    key: "THEATER",
    label: "Theater",
    subtitle: "감상의 극장",
    icon: Drama,
    accent: "purple",
  },
];

export default function LobbyTabShell() {
  const [activeTab, setActiveTab] = useState("DIALOGUE");
  const [createFlowWorld, setCreateFlowWorld] = useState(null);

  const handleOpenCreateFlow = useCallback((world) => {
    setCreateFlowWorld(world);
  }, []);

  const handleCloseCreateFlow = useCallback(() => {
    setCreateFlowWorld(null);
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-950">
      {/* ═══ 상단 탭 바 ═══ */}
      <div
        className="sticky top-0 z-40 backdrop-blur-xl border-b border-white/5"
        style={{
          background:
            activeTab === "THEATER"
              ? "linear-gradient(180deg, rgba(49,46,129,0.4), rgba(15,23,42,0.8))"
              : "linear-gradient(180deg, rgba(15,23,42,0.6), rgba(15,23,42,0.8))",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 rounded-2xl p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="relative flex-1 px-4 py-3 rounded-xl transition-colors"
                >
                  {isActive && (
                    <motion.div
                      layoutId="tab-background"
                      className={`absolute inset-0 rounded-xl ${
                        tab.accent === "purple"
                          ? "bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-400/40"
                          : "bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 border border-indigo-400/40"
                      }`}
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    />
                  )}
                  <div className="relative flex items-center justify-center gap-2">
                    <Icon
                      size={16}
                      className={
                        isActive
                          ? tab.accent === "purple"
                            ? "text-purple-200"
                            : "text-indigo-200"
                          : "text-white/40"
                      }
                    />
                    <div className="text-left">
                      <div
                        className={`text-sm font-bold ${
                          isActive ? "text-white" : "text-white/50"
                        }`}
                      >
                        {tab.label}
                      </div>
                      <div
                        className={`text-[10px] uppercase tracking-widest ${
                          isActive
                            ? tab.accent === "purple"
                              ? "text-purple-300/60"
                              : "text-indigo-300/60"
                            : "text-white/30"
                        }`}
                      >
                        {tab.subtitle}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ 탭 컨텐츠 ═══ */}
      <AnimatePresence mode="wait">
        {activeTab === "DIALOGUE" ? (
          <motion.div
            key="dialogue"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/*
              기존 LobbyPage는 자체 레이아웃을 가지므로 그대로 렌더.
              단, LobbyPage 내부의 최상위 sticky 헤더와 본 쉘의 탭바가 중복되지 않도록
              LobbyPage 자체의 탑바는 숨김 처리가 필요. (Props: hideOwnTopbar)
            */}
            <LobbyPage hideOwnTopbar={true} />
          </motion.div>
        ) : (
          <motion.div
            key="theater"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-6xl mx-auto px-4 py-8"
          >
            <TheaterLobbyTab onCreateFlow={handleOpenCreateFlow} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Theater 생성 플로우 모달 ═══ */}
      <AnimatePresence>
        {createFlowWorld && (
          <TheaterCreateFlow
            world={createFlowWorld}
            onClose={handleCloseCreateFlow}
          />
        )}
      </AnimatePresence>
    </div>
  );
}