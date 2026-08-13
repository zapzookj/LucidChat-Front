import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, User, Settings, X, LogOut, LogIn, Volume2, VolumeX, Gem,
  Sparkles, Globe2, Palette, Archive as ArchiveIcon,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import useDeviceProfile from "../../hooks/useDeviceProfile";
import LucidStore from "../../components/LucidStore";
import HelpButton from "../../components/HelpButton";
import GuestLoginGate from "../../components/lobby/GuestLoginGate";
import { savePendingAction } from "../../utils/postLogin";
import { assetUrl } from "../../utils/assetUrl";
import { TwinkleStar, ShootingStar, isNightTime } from "./lobbyShared";

/**
 * [블록 A] Lucid Station 셸 — 플랫폼형 로비의 상주 레이아웃(A′ 확정안, docs/14 §B).
 *
 * <p>탭 4개(정거장/세계관/스튜디오/보관함)가 IA의 전부다. 모바일=하단 탭바(세이프에어리어),
 * 데스크톱=상단 탭. 자식 라우트(Outlet)가 탭 콘텐츠 — 스튜디오도 셸 임베드(2안 확정,
 * 2026-08-13 종원)라 탭바가 상주하고 URL(/studio)은 유지된다.
 *
 * <p>게스트(비로그인)도 셸에 진입한다 — 탐색은 전부 허용, 행동은 requireLogin 게이트.
 * 사운드 정책: 로비 BGM은 설정 옵트인(기본 꺼짐), 호버·클릭 SFX 없음.
 */

const TABS = [
  { key: "home",    path: "/",        label: "정거장",   sub: "Station", Icon: Sparkles,    guestOk: true },
  { key: "worlds",  path: "/worlds",  label: "세계관",   sub: "Worlds",  Icon: Globe2,      guestOk: true },
  { key: "studio",  path: "/studio",  label: "스튜디오", sub: "Studio",  Icon: Palette,     guestOk: false },
  { key: "archive", path: "/archive", label: "보관함",   sub: "Archive", Icon: ArchiveIcon, guestOk: false },
];

const BGM_OPT_KEY = "lucid:lobbyBgm"; // "on"만 재생 — 기본 꺼짐(옵트인)

export default function LobbyShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, refreshUser } = useAuth();
  const { isMobile, width } = useDeviceProfile();
  const guest = !user;
  // [리뷰 P1] 좁은 데스크톱(768~1023)은 상단 탭+우측 클러스터가 704px 폭을 초과해
  //   설정/도움말이 화면 밖으로 잘렸다. lg(1024) 미만은 하단 탭바로 통일해 오버플로우를 근본 제거.
  const showTopTabs = width >= 1024;
  const showBottomBar = width < 1024;

  const [userInfo, setUserInfo] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [storeInitialTab, setStoreInitialTab] = useState("energy");
  const [storeCharacters, setStoreCharacters] = useState([]);
  const [entering, setEntering] = useState(false);
  const [gate, setGate] = useState(null); // GuestLoginGate — { action, title, message } | null
  const [bgmOn, setBgmOn] = useState(() => localStorage.getItem(BGM_OPT_KEY) === "on");
  const bgmRef = useRef(null);

  const activeTab = useMemo(() => {
    const found = [...TABS].sort((a, b) => b.path.length - a.path.length)
      .find((t) => (t.path === "/" ? location.pathname === "/" : location.pathname.startsWith(t.path)));
    return found?.key ?? "home";
  }, [location.pathname]);

  // ── 유저 정보 (멤버만) ──
  const refreshUserInfo = useCallback(async () => {
    if (guest) return;
    try { setUserInfo((await api.get("/users/me")).data); } catch { /* 표시용 — 비차단 */ }
  }, [guest]);
  useEffect(() => { refreshUserInfo(); }, [refreshUserInfo]);

  // ── 로비 BGM — 옵트인일 때만 로드/재생 (docs/14 §B: 기본 제거·설정 옵트인) ──
  useEffect(() => {
    if (!bgmOn) {
      if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current = null; }
      return;
    }
    const audio = new Audio(assetUrl("/sounds/bgm_lobby.mp3"));
    audio.loop = true;
    audio.volume = 0.25;
    bgmRef.current = audio;
    const tryPlay = () => bgmRef.current?.play().catch(() => {});
    const onInteraction = () => { tryPlay(); window.removeEventListener("click", onInteraction); window.removeEventListener("keydown", onInteraction); };
    window.addEventListener("click", onInteraction);
    window.addEventListener("keydown", onInteraction);
    tryPlay();
    return () => {
      window.removeEventListener("click", onInteraction);
      window.removeEventListener("keydown", onInteraction);
      audio.pause();
      if (bgmRef.current === audio) bgmRef.current = null;
    };
  }, [bgmOn]);

  const toggleBgm = () => {
    setBgmOn((prev) => {
      const next = !prev;
      localStorage.setItem(BGM_OPT_KEY, next ? "on" : "off");
      return next;
    });
  };

  const fadeBgmOut = useCallback(() => {
    if (!bgmRef.current) return;
    const fade = setInterval(() => {
      if (bgmRef.current && bgmRef.current.volume > 0.02) {
        bgmRef.current.volume = Math.max(0, bgmRef.current.volume - 0.03);
      } else {
        clearInterval(fade);
        bgmRef.current?.pause();
      }
    }, 50);
  }, []);

  // ── 방 진입 연출 (페이드 아웃 → 이동) ──
  const enterRoom = useCallback((path) => {
    fadeBgmOut();
    setEntering(true);
    setTimeout(() => navigate(path), 700);
  }, [fadeBgmOut, navigate]);

  // ── 게스트 행동 게이트 ──
  const requireLogin = useCallback((gateSpec) => setGate(gateSpec || { action: null }), []);

  // ── 상점 (멤버 전용 — 시크릿 상품 대상 캐릭터 목록 lazy 로드) ──
  const openStore = useCallback(async (tab = "energy") => {
    if (guest) {
      setGate({ action: { type: "route", path: location.pathname }, title: "로그인이 필요해요", message: "충전과 구독은 로그인 후 이용할 수 있어요." });
      return;
    }
    setStoreInitialTab(tab);
    setShowStore(true);
    if (storeCharacters.length === 0) {
      try { setStoreCharacters((await api.get("/lobby/characters")).data); } catch { /* 시크릿 탭만 영향 */ }
    }
  }, [guest, location.pathname, storeCharacters.length]);

  const handleTab = (tab) => {
    if (guest && !tab.guestOk) {
      setGate({
        action: { type: "route", path: tab.path },
        title: tab.key === "studio" ? "스튜디오는 로그인 후 열려요" : "보관함은 로그인 후 열려요",
        message: tab.key === "studio"
          ? "나만의 인연을 만들려면 로그인이 필요해요."
          : "기억의 끈과 수집품은 당신의 이야기가 쌓이는 곳이에요.",
      });
      return;
    }
    navigate(tab.path);
  };

  const handleLogout = () => {
    bgmRef.current?.pause();
    setShowSettings(false);
    logout();
    navigate("/login");
  };

  const displayEnergy = userInfo?.energy ?? user?.energy ?? 0;
  const displayNickname = userInfo?.nickname ?? user?.nickname ?? "";
  const stars = useMemo(() => Array.from({ length: 60 }, () => ({ left: `${Math.random() * 100}%`, top: `${Math.random() * 60}%` })), []);
  const shootingStars = useMemo(() => [0, 4.5, 9, 14.5, 20].map((delay) => ({ delay, startX: Math.random() * 80, startY: Math.random() * 35 })), []);
  const lobbyBg = isNightTime() ? assetUrl("/backgrounds/bg_lobby_night.png") : assetUrl("/backgrounds/bg_lobby_day.png");

  const outletContext = useMemo(() => ({
    guest, user, userInfo, refreshUserInfo, refreshUser,
    requireLogin, openStore, enterRoom, isMobile,
  }), [guest, user, userInfo, refreshUserInfo, refreshUser, requireLogin, openStore, enterRoom, isMobile]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* ═══ 배경 — 자각몽 정거장 ═══ */}
      <div className="absolute inset-0">
        <img src={lobbyBg} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        <div className="absolute inset-0 bg-black/30" />
        {isNightTime() && stars.map((style, i) => <TwinkleStar key={i} style={style} />)}
        {isNightTime() && shootingStars.map((s, i) => <ShootingStar key={i} {...s} />)}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b14]/90 via-[#0b0b14]/40 to-transparent" />
      </div>

      {/* ═══ 입장 페이드아웃 ═══ */}
      <AnimatePresence>
        {entering && <motion.div className="fixed inset-0 z-[100] bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }} />}
      </AnimatePresence>

      {/* ═══ 셸 골격 ═══ */}
      <div className="relative z-10 flex flex-col h-full">
        {/* ── Top Bar ── */}
        <header className="relative flex items-center justify-between px-5 sm:px-8 pt-4 pb-2 flex-shrink-0">
          {/* [리뷰 P2] 헤더 밴드 전용 스크림 — 주간 배경(밝음) 위 탭·닉네임 대비 확보 */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[68px] bg-gradient-to-b from-black/45 to-transparent" />
          <motion.button
            className="relative flex items-center gap-2.5 flex-shrink-0"
            onClick={() => navigate("/")}
            whileHover={{ scale: 1.03 }}
            aria-label="정거장으로"
          >
            <img src={assetUrl("/logo_icon.png")} alt="" className="h-7 sm:h-8 drop-shadow-lg" onError={(e) => { e.target.style.display = "none"; }} />
            <span className="text-lg sm:text-xl font-bold text-white tracking-[0.12em] drop-shadow-lg">
              LUCID <span className="text-violet-300/90">STATION</span>
            </span>
          </motion.button>

          {/* 데스크톱(lg+) 상단 탭 — 좁은 폭은 하단 탭바가 대신함 */}
          {showTopTabs && (
            <nav className="relative flex items-center gap-1 bg-black/35 backdrop-blur-md rounded-full p-1 border border-white/10 shadow-lg">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => handleTab(t)}
                  className={`px-4 py-1.5 rounded-full text-sm transition-colors duration-200 ${
                    activeTab === t.key
                      ? "bg-violet-400/30 text-white font-semibold"
                      : "text-white/65 hover:text-white drop-shadow"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          )}

          <div className="relative flex items-center gap-2.5 sm:gap-3.5 flex-shrink min-w-0">
            {!guest && (
              <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10 text-amber-300">
                <Zap size={14} />
                <span className="text-sm font-semibold text-white">{displayEnergy}</span>
              </div>
            )}
            {!guest && (
              <div className="hidden sm:flex items-center gap-1.5 text-white/70 text-sm drop-shadow min-w-0">
                <User size={14} className="flex-shrink-0" /><span className="truncate max-w-[7rem]">{displayNickname}</span>
              </div>
            )}
            {!guest && (
              <button
                onClick={() => openStore("energy")}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-amber-400/70 hover:text-amber-300 hover:bg-black/40 transition-colors duration-200"
                aria-label="상점"
              >
                <Gem size={14} />
              </button>
            )}
            {!guest && <HelpButton />}
            {guest && (
              <button
                onClick={() => setGate({ action: { type: "route", path: location.pathname }, title: "다시 오신 걸 환영해요", message: "로그인하면 당신의 이야기가 이어져요." })}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold text-slate-900 bg-gradient-to-r from-violet-300 to-sky-300 hover:from-violet-200 hover:to-sky-200 transition-colors shadow-[0_2px_16px_rgba(147,130,255,0.3)]"
              >
                <LogIn size={13} /> 로그인
              </button>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white/50 hover:text-white hover:bg-black/40 transition-colors duration-200"
              aria-label="설정"
            >
              <Settings size={14} />
            </button>
          </div>
        </header>

        {/* ── 탭 콘텐츠 ── */}
        {/* [리뷰 P2] 단일 Outlet에 AnimatePresence(mode=wait)+exit를 걸면 잔류하는 exit 래퍼가
            *도착* 탭을 재생해 이중 페이드가 났다. exit를 없애고 key remount 시 enter만 재생. */}
        <main className={`flex-1 overflow-y-auto custom-scrollbar ${showBottomBar ? "pb-[calc(76px+env(safe-area-inset-bottom))]" : "pb-8"}`}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="h-full"
          >
            <Outlet context={outletContext} />
          </motion.div>
        </main>

        {/* ── 하단 탭바 (모바일 + 좁은 데스크톱) ── */}
        {showBottomBar && (
          <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch gap-1 px-3 pt-2 pb-[calc(10px+env(safe-area-inset-bottom))] bg-[#0c0c18]/85 backdrop-blur-xl border-t border-white/10">
            {TABS.map((t) => {
              const on = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => handleTab(t)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl min-h-[48px] transition-colors duration-200 ${
                    on ? "bg-violet-400/15 text-violet-200" : "text-white/40"
                  }`}
                  aria-label={t.label}
                >
                  <t.Icon size={18} className={on ? "" : "opacity-70"} />
                  <span className={`text-[10px] tracking-wide ${on ? "font-bold" : "font-medium"}`}>{t.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* ═══ 오버레이 ═══ */}
      <AnimatePresence>
        {gate && <GuestLoginGate gate={gate} onClose={() => setGate(null)} />}
      </AnimatePresence>

      {!guest && (
        <LucidStore
          isOpen={showStore}
          onClose={() => setShowStore(false)}
          initialTab={storeInitialTab}
          userInfo={userInfo}
          characters={storeCharacters}
          onPaymentComplete={async () => {
            setShowStore(false);
            if (refreshUser) { try { await refreshUser(); } catch { /* 아래 폴백 */ } }
            refreshUserInfo();
          }}
        />
      )}

      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            guest={guest}
            onClose={() => setShowSettings(false)}
            onLogout={handleLogout}
            onLogin={() => {
              // [리뷰 P2] 설정발 로그인은 '현재 위치 복귀'가 의도 — 신선한 route 액션으로
              //   덮어써 이전 게이트/보호경로가 남긴 묵은 startChat·목적지 소비를 차단.
              setShowSettings(false);
              savePendingAction({ type: "route", path: location.pathname });
              navigate("/login");
            }}
            bgmOn={bgmOn}
            onToggleBgm={toggleBgm}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 설정 모달 — BGM 옵트인 + 로그아웃/로그인 ──
function SettingsModal({ guest, onClose, onLogout, onLogin, bgmOn, onToggleBgm }) {
  return (
    <motion.div className="fixed inset-0 z-[80] flex items-center justify-center px-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors duration-200" aria-label="닫기"><X size={16} /></button>
        </div>
        <button
          onClick={onToggleBgm}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/10 transition-colors duration-200 mb-3"
        >
          <div className="flex items-center gap-3 text-sm text-white/70">
            {bgmOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>로비 BGM</span>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${bgmOn ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-white/30"}`}>
            {bgmOn ? "ON" : "OFF"}
          </span>
        </button>
        {guest ? (
          <button
            onClick={onLogin}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-violet-500/10 border border-white/5 hover:border-violet-400/25 transition-colors duration-200 text-sm text-white/60 hover:text-violet-200"
          >
            <LogIn size={16} /><span>로그인</span>
          </button>
        ) : (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/20 transition-colors duration-200 text-sm text-white/50 hover:text-rose-400"
          >
            <LogOut size={16} /><span>로그아웃</span>
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
