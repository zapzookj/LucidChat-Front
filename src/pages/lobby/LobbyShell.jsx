import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion as Motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Zap, X, LogOut, LogIn, Volume2, VolumeX,
  Home, BookOpen, Palette, Archive as ArchiveIcon,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import useDeviceProfile from "../../hooks/useDeviceProfile";
import LucidStore from "../../components/LucidStore";
import HelpButton from "../../components/HelpButton";
import GuestLoginGate from "../../components/lobby/GuestLoginGate";
import { savePendingAction } from "../../utils/postLogin";
import { assetUrl } from "../../utils/assetUrl";
import { getPrefGender, hasAnsweredPref, setPrefGender } from "../../utils/preference";
import AuroraBackdrop from "../../components/lobby/AuroraBackdrop";
import useOverlayFocus from "../../components/mobile/useOverlayFocus";

/**
 * [블록 A R2] 로비 셸 — 재설계 정본(aichat docs/15_assets/lobby_redesign_mockup.html) 구현.
 *
 * <p>탭 4(기능형 라벨 확정): 홈 / 스토리 / 스튜디오 / 보관함. 데스크톱(≥1024)=탑바 중앙 탭,
 * 그 미만=하단 탭바. 배경은 사진 에셋 대신 토큰 배경(#0b0b10)+보라 글로우+별 파티클 —
 * 에셋 유무와 무관하게 완성형으로 보이는 것이 설계 목표.
 *
 * <p>게스트 게이트 규칙(단일 선언): 탐색 전부 열림, 행동 시점에만 로그인 시트.
 * 보관함·스튜디오 탭은 게스트 클릭 시 시트(업적 API도 인증 필수).
 *
 * <p>보존: BGM 옵트인(lucid:lobbyBgm) · enterRoom 페이드 · postLogin 딥링크 체계 ·
 * 설정발 로그인의 pendingAction 덮어쓰기 · 사운드 정책(호버/클릭 SFX 금지).
 */

const TABS = [
  { key: "home",    path: "/",        label: "홈",       Icon: Home,        guestOk: true },
  { key: "story",   path: "/story",   label: "스토리",   Icon: BookOpen,    guestOk: true },
  { key: "studio",  path: "/studio",  label: "스튜디오", Icon: Palette,     guestOk: false },
  { key: "archive", path: "/archive", label: "보관함",   Icon: ArchiveIcon, guestOk: false },
];

const BGM_OPT_KEY = "lucid:lobbyBgm"; // "on"만 재생 — 기본 꺼짐(옵트인)

export default function LobbyShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, refreshUser } = useAuth();
  const { isMobile } = useDeviceProfile();
  const guest = !user;
  const reduceMotion = useReducedMotion();
  const entryTimer = useRef(null);
  const fadeTimer = useRef(null);
  useEffect(() => () => { clearTimeout(entryTimer.current); clearInterval(fadeTimer.current); }, []);
  // 탭 배치는 라이브 뷰포트 폭 기준 — useDeviceProfile.width는 프로필 변경 시에만
  // 리렌더되어 1024px 경계 리사이즈를 놓친다(R1 크리틱 확정 결함). 직접 추적.
  const [vw, setVw] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const showTopTabs = vw >= 768;
  const showBottomBar = vw < 768;

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

  // ── 로비 BGM — 옵트인일 때만 로드/재생 ──
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
    clearInterval(fadeTimer.current);
    if (!bgmRef.current) return;
    fadeTimer.current = setInterval(() => {
      if (bgmRef.current && bgmRef.current.volume > 0.02) {
        bgmRef.current.volume = Math.max(0, bgmRef.current.volume - 0.03);
      } else {
        clearInterval(fadeTimer.current);
        bgmRef.current?.pause();
      }
    }, 50);
  }, []);

  // ── 방 진입 연출 (페이드 아웃 → 이동) ──
  const enterRoom = useCallback((path) => {
    clearTimeout(entryTimer.current);
    fadeBgmOut();
    setEntering(true);
    entryTimer.current = setTimeout(() => navigate(path), reduceMotion ? 80 : 260);
  }, [fadeBgmOut, navigate, reduceMotion]);

  // ── 게스트 행동 게이트 ──
  const requireLogin = useCallback((gateSpec) => setGate(gateSpec || { action: null }), []);

  // ── 상점 (멤버 전용 — 에너지 필 클릭으로 진입) ──
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
    if (activeTab === tab.key) return; // 동일 URL 히스토리 중복 push 방지
    if (guest && !tab.guestOk) {
      setGate({
        action: { type: "route", path: tab.path },
        title: tab.key === "studio" ? "스튜디오는 로그인 후 열려요" : "보관함은 로그인 후 열려요",
        message: tab.key === "studio"
          ? "나만의 캐릭터를 만들려면 로그인이 필요해요."
          : "나눈 대화와 수집한 순간들이 여기에 모여요.",
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

  const outletContext = useMemo(() => ({
    guest, user, userInfo, refreshUserInfo, refreshUser,
    requireLogin, openStore, enterRoom, isMobile,
  }), [guest, user, userInfo, refreshUserInfo, refreshUser, requireLogin, openStore, enterRoom, isMobile]);

  return (
    <div className="aurora-shell relative w-full h-full overflow-hidden select-none">
      <AuroraBackdrop />

      {/* ═══ 입장 페이드아웃 ═══ */}
      <AnimatePresence>
        {entering && <Motion.div className="fixed inset-0 z-[100] bg-lobby-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion ? .08 : .26 }} />}
      </AnimatePresence>

      {/* ═══ 셸 골격 ═══ */}
      <div className="relative z-10 flex flex-col h-full">
        {/* ── Top Bar — 로고 좌 · 탭 중앙(≥1024) · 클러스터 우 ── */}
        <header className="aurora-header">
          <div className="aurora-header-inner">
            <button
              className="aurora-brand"
              onClick={() => navigate("/")}
              aria-label="홈으로"
            >
              <span className="aurora-brand-mark" aria-hidden="true" />
              <span className="aurora-brand-name">LUCID CHAT</span>
            </button>

            {showTopTabs && (
              <nav
                // 센터 고정은 ≥1024만 — 768~1023은 일반 flex 흐름(우측 클러스터와 충돌 방지)
                className={vw >= 1024 ? "absolute left-1/2 -translate-x-1/2 flex items-center gap-1" : "flex items-center gap-1"}
                aria-label="주 메뉴"
              >
                {TABS.map((t) => {
                  const on = activeTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => handleTab(t)}
                      aria-current={on ? "page" : undefined}
                      className={`relative min-h-11 px-[18px] py-2 rounded-xl text-sm font-medium transition-colors duration-150 ${
                        on ? "text-white" : "text-lobby-tx1 hover:text-white"
                      }`}
                    >
                      {t.label}
                      {on && (
                        <span className="absolute bottom-[3px] left-1/2 -translate-x-1/2 w-[18px] h-[2.5px] rounded-full bg-gradient-to-r from-violet-300 to-sky-300" />
                      )}
                    </button>
                  );
                })}
              </nav>
            )}

            <div className="flex items-center gap-2.5 flex-shrink min-w-0">
              {!guest && (
                <button
                  onClick={() => openStore("energy")}
                  className="aurora-button-secondary gap-1.5 px-3.5"
                  aria-label="에너지 충전"
                >
                  <Zap size={13} className="text-amber-400" />
                  <span className="text-lb-meta font-semibold text-white">{displayEnergy}</span>
                </button>
              )}
              {!guest && <HelpButton />}
              {!guest && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="w-11 h-11 flex-none rounded-full border border-white/25 bg-gradient-to-br from-[#75668c] to-[#4e778c] flex items-center justify-center text-sm font-semibold text-white"
                  aria-label="설정"
                  title={displayNickname}
                >
                  {displayNickname?.[0] ?? "·"}
                </button>
              )}
              {guest && (
                <button
                  onClick={() => setGate({ action: { type: "route", path: location.pathname }, title: "다시 오신 걸 환영해요", message: "로그인하면 나눈 이야기가 이어져요." })}
                  className="aurora-button-secondary px-4 text-xs sm:text-sm"
                >
                  로그인
                </button>
              )}
              {guest && (
                <button
                  onClick={() => setGate({ action: { type: "route", path: location.pathname }, title: "당신의 이야기를 시작해요", message: "소셜 계정으로 간편하게 시작할 수 있어요." })}
                  className="aurora-button-primary hidden sm:inline-flex"
                >
                  시작하기
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ── 탭 콘텐츠 — enter-only 페이드(이중 페이드 회귀 방지) ── */}
        <main className={`flex-1 overflow-y-auto custom-scrollbar ${showBottomBar ? "pb-[calc(76px+env(safe-area-inset-bottom))]" : "pb-8"}`}>
          <Motion.div
            key={activeTab}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="min-h-full pb-6"
          >
            <Outlet context={outletContext} />
          </Motion.div>
        </main>

        {/* ── 하단 탭바 (<1024) ── */}
        {showBottomBar && (
          <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch gap-1 px-3 pt-2 pb-[calc(10px+env(safe-area-inset-bottom))] bg-lobby-surface/95 backdrop-blur-xl border-t border-white/[0.12]" aria-label="주 메뉴">
            {TABS.map((t) => {
              const on = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => handleTab(t)}
                  aria-current={on ? "page" : undefined}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl min-h-[48px] transition-colors duration-200 ${
                    on ? "text-white" : "text-lobby-tx2"
                  }`}
                  aria-label={t.label}
                >
                  <t.Icon size={18} className={on ? "text-violet-300" : "opacity-70"} />
                  <span className={`text-xs ${on ? "font-semibold" : "font-medium"}`}>{t.label}</span>
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
              // 설정발 로그인은 '현재 위치 복귀'가 의도 — 신선한 route 액션으로
              // 덮어써 이전 게이트/보호경로가 남긴 묵은 startChat·목적지 소비를 차단.
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

// ── 설정 모달 — BGM 옵트인 + 선호 캐릭터 + 로그아웃/로그인 ──
function SettingsModal({ guest, onClose, onLogout, onLogin, bgmOn, onToggleBgm }) {
  const panelRef = useRef(null);
  useOverlayFocus(true, panelRef, onClose);
  // 선호 캐릭터(개인화 정렬 v1) — 온보딩 1단계와 같은 저장소. "설정에서 바꿀 수 있어요" 카피의 실체.
  const [pref, setPref] = useState(() => (hasAnsweredPref() ? (getPrefGender() ?? "ALL") : null));
  const pickPref = (v) => { setPrefGender(v); setPref(v); };

  const PREFS = [
    { v: "FEMALE", label: "여성" },
    { v: "MALE",   label: "남성" },
    { v: "ALL",    label: "모두" },
  ];

  return (
    <Motion.div className="fixed inset-0 z-[80] flex items-center justify-center px-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button type="button" tabIndex={-1} aria-label="설정 닫기" className="absolute inset-0 bg-[#0c1227]/70 backdrop-blur-sm" onClick={onClose} />
      <Motion.div
        ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="lobby-settings-title" tabIndex={-1}
        className="relative z-10 w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-lobby-surface backdrop-blur-xl border border-white/15 rounded-3xl p-6 shadow-2xl"
        initial={{ scale: 0.92, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 12 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 id="lobby-settings-title" className="text-xl font-semibold text-lobby-tx0">설정</h3>
          <button onClick={onClose} className="aurora-icon-button" aria-label="닫기"><X size={18} /></button>
        </div>

        <button
          onClick={onToggleBgm}
          role="switch" aria-checked={bgmOn}
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

        {!guest && (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 mb-3">
            <p className="text-sm text-white/70">선호 캐릭터</p>
            <p className="text-xs text-lobby-tx1 mt-1">추천 순서에 반영돼요</p>
            <div className="flex gap-1.5 mt-2.5">
              {PREFS.map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => pickPref(v)}
                  aria-pressed={pref === v}
                  className={`flex-1 min-h-11 py-2 rounded-xl text-sm font-medium transition-colors ${
                    pref === v ? "bg-lobby-accent/20 text-lobby-accent" : "bg-white/[0.04] text-lobby-tx1 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

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
      </Motion.div>
    </Motion.div>
  );
}
