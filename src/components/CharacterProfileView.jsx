import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronDown, MessageCircle, User, X } from "lucide-react";
import { fetchCharacterProfile } from "../api/ProfileApi";
import { sfx } from "../utils/sfx";

/**
 * [Profile v1] CharacterProfileView — 캐릭터 프로필 풀스크린 오버레이 (z-[100])
 *
 * variant 4종:
 *   - "immersive" (A안 「첫 만남」): defaultImageUrl 풀블리드 + 딥네이비 스크림,
 *     무드 칩 → 대형 이름 → 신상 2×2 그리드 → 세리프 티저 인용 → 앰버 CTA
 *   - "dossier"   (B안 「인물 기록」): CHARACTER FILE 문서 무드 — 모노 헤더,
 *     사각 초상 + 스탬프 칩 + 레코드 행 리스트 + 첫인사 발췌 인용
 *   - "card"      (로비 선택): 화면 중앙 글래스 모달 카드 — 풀스크린 아님.
 *     데스크톱 = 좌측 일러 패널(고정폭) + 우측 정보 칼럼, 모바일 = 컴팩트
 *     배너 스택. 딤 백드롭 클릭 닫기.
 *   - "panel"     (챗 인게임): BiometricStatusPanel(STATUS)과 같은 맥락의 우측
 *     사이드 카드 — 풀스크린이 아니라 fixed 글래스 패널(z-[65]), 컴팩트 일러
 *     배너 + 밀도형 신상 행. 바깥 mousedown 닫힘(excludeRef 제외).
 *
 * Props:
 *   characterId : number|string
 *   variant     : "immersive" | "dossier" | "panel" (기본 immersive)
 *   open        : boolean
 *   onClose     : () => void
 *   onStartChat : ((characterId) => void|Promise) | null
 *     — null이면 CTA가 "대화로 돌아가기"(단순 닫기)로 바뀐다 (ChatPage 진입점용)
 *   ctaLabel    : string|null — CTA 문구 오버라이드 (로비 선택 플로우 "이 캐릭터 선택하기" 등)
 *   excludeRef  : ref|null — panel 전용. 바깥 클릭 판정에서 제외할 토글 버튼
 *     (폴리싱 #8 — mousedown 닫힘 → click 재오픈 깜빡임 방지)
 *
 * 동작:
 *   - open 시 fetch (로딩 스피너) / 에러는 message 토스트 후 자동 닫기
 *   - ESC 닫기 + 배경 클릭 닫기(열림 250ms 가드 — BottomSheet 패턴)
 *   - 열림 sfx.wooshLight
 *   - CTA는 busyRef 재진입 락 (StudioCreateFlow/WorldCreateFlow 패턴)
 */

const SERIF_STACK = "Georgia,'Nanum Myeongjo',serif";
const MONO_STACK = "'JetBrains Mono','SFMono-Regular',Consolas,monospace";

/** nullable 신상 값 — null이면 "기록 없음" 회색 처리 */
const RecordValue = ({ value, className = "" }) =>
  value ? (
    <span className={className}>{value}</span>
  ) : (
    <span className="text-white/25 font-normal">기록 없음</span>
  );

// ── 신상 2×2 그리드 카드 (immersive) ──
const VitalCard = ({ label, value }) => (
  <div className="rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2.5">
    <div className="text-[9px] tracking-[0.18em] uppercase text-white/40 mb-1">{label}</div>
    <div className="text-sm font-bold text-white leading-snug">
      <RecordValue value={value} />
    </div>
  </div>
);

// ── 레코드 행 (dossier) ──
const DossierRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 border-b border-white/[0.07]">
    <span className="text-[11px] text-white/40 tracking-wider flex-shrink-0 pt-0.5">{label}</span>
    <span className="text-sm text-white font-medium text-right leading-snug">
      <RecordValue value={value} />
    </span>
  </div>
);

// ── 밀도형 레코드 행 (panel — DossierRow보다 타이트) ──
const PanelRow = ({ label, value, last = false }) => (
  <div
    className={`flex items-start justify-between gap-3 py-2 ${
      last ? "" : "border-b border-white/[0.06]"
    }`}
  >
    <span className="text-[10px] text-white/35 tracking-wider flex-shrink-0 pt-0.5">{label}</span>
    <span className="text-xs text-white font-medium text-right leading-snug">
      <RecordValue value={value} />
    </span>
  </div>
);

export default function CharacterProfileView({
  characterId,
  variant = "immersive",
  open,
  onClose,
  onStartChat = null,
  ctaLabel: ctaLabelProp = null,
  excludeRef = null,
}) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorToast, setErrorToast] = useState(null);
  const [showLooks, setShowLooks] = useState(false); // immersive — 외형·복장 접이식
  const [ctaBusy, setCtaBusy] = useState(false);

  // [폴리싱 #8 패턴] 열림 직후 같은 클릭이 백드롭에 떨어져 곧바로 닫히는 사고 방지
  const openedAtRef = useRef(0);
  // CTA 재진입 락 — state 기반 busy는 리렌더 전 2번째 클릭이 통과한다
  const busyRef = useRef(false);
  const errorCloseTimerRef = useRef(null);

  // ── open 시 fetch / close 시 리셋 ──
  useEffect(() => {
    if (!open) {
      setProfile(null);
      setErrorToast(null);
      setShowLooks(false);
      setCtaBusy(false);
      busyRef.current = false;
      clearTimeout(errorCloseTimerRef.current);
      return undefined;
    }
    openedAtRef.current = Date.now();
    sfx.wooshLight();

    let cancelled = false;
    setLoading(true);
    fetchCharacterProfile(characterId)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((e) => {
        if (cancelled) return;
        sfx.thud();
        // 404 = 비공개/숨김 방어 — 서버 message 우선 노출 후 닫기
        setErrorToast(e?.response?.data?.message || "프로필을 불러오지 못했어요.");
        errorCloseTimerRef.current = setTimeout(() => onClose?.(), 1800);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, characterId]);

  useEffect(() => () => clearTimeout(errorCloseTimerRef.current), []);

  const handleClose = useCallback(() => {
    sfx.click();
    onClose?.();
  }, [onClose]);

  const handleBackdropClick = () => {
    if (Date.now() - openedAtRef.current < 250) return; // 열림 후 250ms 이내 클릭 무시
    onClose?.();
  };

  // ── ESC 닫기 ──
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // ── panel 전용: 바깥 mousedown 닫힘 (BiometricStatusPanel과 동일 맥락) ──
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open || variant !== "panel") return undefined;
    const handler = (e) => {
      if (Date.now() - openedAtRef.current < 250) return; // 열림 직후 같은 클릭 가드
      if (!panelRef.current || panelRef.current.contains(e.target)) return;
      if (excludeRef?.current?.contains(e.target)) return; // 토글 버튼 재클릭 = 깜빡임 방지
      onClose?.();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, variant, onClose, excludeRef]);

  // ── CTA — onStartChat 없으면 단순 닫기("대화로 돌아가기") ──
  const ctaLabel = ctaLabelProp || (onStartChat ? "대화 시작하기" : "대화로 돌아가기");
  const handleCta = async () => {
    if (busyRef.current) return;
    sfx.click();
    if (!onStartChat) {
      onClose?.();
      return;
    }
    busyRef.current = true;
    setCtaBusy(true);
    try {
      await onStartChat(profile?.characterId ?? characterId);
    } finally {
      busyRef.current = false;
      setCtaBusy(false);
    }
  };

  const ctaClass =
    "w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/25 transition flex items-center justify-center gap-2 disabled:opacity-60";

  const ageRole = profile
    ? [profile.age != null ? `${profile.age}세` : null, profile.role].filter(Boolean).join(" · ")
    : "";

  // ═══ "panel" — STATUS 상태창과 같은 맥락의 우측 사이드 카드 (풀스크린 아님) ═══
  if (variant === "panel") {
    return (
      <>
        <AnimatePresence>
          {open && (
            <motion.div
              key="profile-panel"
              ref={panelRef}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="fixed right-3 sm:right-5 z-[65] flex flex-col"
              style={{
                top: "72px",
                bottom: "72px",
                width: "min(330px, 42vw)",
                willChange: "transform, opacity",
                transform: "translateZ(0)",
              }}
            >
              <div
                className="h-full rounded-2xl border border-white/[0.08] flex flex-col"
                style={{
                  background: "linear-gradient(160deg, rgba(8,4,20,0.82), rgba(15,8,30,0.88))",
                  backdropFilter: "blur(28px) saturate(1.3)",
                  boxShadow:
                    "0 12px 60px rgba(0,0,0,0.5), 0 0 80px rgba(251,191,36,0.12), inset 0 1px 0 rgba(255,255,255,0.04)",
                  overflow: "hidden",
                }}
              >
                {/* 상단 장식 라인 — 앰버 (프로필 아이덴티티) */}
                <div
                  className="h-[2px] w-full flex-shrink-0"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(251,191,36,0.55), rgba(251,146,60,0.35), transparent)",
                  }}
                />

                {loading && (
                  <div className="flex-1 flex items-center justify-center">
                    <motion.div
                      className="w-8 h-8 border-2 border-amber-400/40 border-t-amber-400 rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                )}

                {!loading && profile && (
                  <>
                    {/* 컴팩트 일러스트 배너 — 상단 크롭 + 하단 스크림 위 이름 */}
                    <div className="relative h-44 flex-shrink-0 bg-gradient-to-b from-indigo-950/60 to-transparent">
                      {profile.defaultImageUrl || profile.thumbnailUrl ? (
                        <img
                          src={profile.defaultImageUrl || profile.thumbnailUrl}
                          alt={profile.name}
                          className="w-full h-full object-cover object-top"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/10">
                          <User size={40} />
                        </div>
                      )}
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(to bottom, rgba(8,4,20,0.25) 0%, rgba(8,4,20,0) 32%, rgba(8,4,20,0.55) 74%, rgba(10,5,22,0.94) 100%)",
                        }}
                      />
                      <span
                        className="absolute top-3 left-3.5 text-[9px] text-white/50 drop-shadow"
                        style={{ fontFamily: MONO_STACK, letterSpacing: "0.28em" }}
                      >
                        PROFILE
                      </span>
                      <button
                        type="button"
                        onClick={handleClose}
                        onMouseEnter={() => sfx.hover()}
                        aria-label="닫기"
                        className="absolute top-2.5 right-2.5 w-8 h-8 flex items-center justify-center rounded-full bg-black/45 backdrop-blur-md border border-white/10 text-white/60 hover:text-white hover:bg-black/70 transition-colors"
                      >
                        <X size={14} />
                      </button>
                      <div className="absolute inset-x-0 bottom-0 px-4 pb-2.5">
                        <h2
                          className="text-xl text-white tracking-wide drop-shadow"
                          style={{ fontWeight: 800 }}
                        >
                          {profile.name}
                        </h2>
                        {ageRole && <p className="text-[11px] text-white/55 mt-0.5">{ageRole}</p>}
                      </div>
                    </div>

                    {/* 본문 — 내부 스크롤 (스크롤바 숨김, STATUS 패널 관례) */}
                    <div
                      className="profile-panel-scroll flex-1 overflow-y-auto px-4 pt-3 pb-2"
                      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                      <style>{`.profile-panel-scroll::-webkit-scrollbar { display: none; }`}</style>

                      {/* 무드 칩 + 세계관 배지 */}
                      {((profile.moodTags || []).length > 0 || profile.worldName) && (
                        <div className="flex flex-wrap items-center gap-1 mb-3">
                          {(profile.moodTags || []).map((tag) => (
                            <span
                              key={tag}
                              className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-200 border border-amber-400/25"
                            >
                              {tag}
                            </span>
                          ))}
                          {profile.worldName && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-400/15 text-violet-200 border border-violet-400/25">
                              🌙 {profile.worldName}
                            </span>
                          )}
                        </div>
                      )}

                      {/* 신상 레코드 — 밀도형 행 */}
                      <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-3.5 py-1">
                        <PanelRow label="키" value={profile.height} />
                        <PanelRow label="좋아하는 것" value={profile.likes} />
                        <PanelRow label="싫어하는 것" value={profile.dislikes} />
                        <PanelRow label="취미" value={profile.hobby} last />
                      </div>

                      {/* introTeaser — 세리프 이탤릭 인용 */}
                      <blockquote
                        className="mt-3.5 pl-3 border-l-2 border-amber-400/60 italic leading-relaxed"
                        style={{ fontFamily: SERIF_STACK }}
                      >
                        {profile.introTeaser ? (
                          <span className="text-[13px] text-white/80">{profile.introTeaser}</span>
                        ) : (
                          <span className="text-xs text-white/25">기록 없음</span>
                        )}
                      </blockquote>

                      {profile.ugc && profile.creatorNickname && (
                        <p className="text-[10px] text-white/30 mt-3">
                          창작자 · {profile.creatorNickname}
                        </p>
                      )}

                      {/* 외형·복장 서술 — 고스트 링크 접이식 (immersive와 동일 패턴) */}
                      {(profile.appearance || profile.clothing) && (
                        <div className="mt-3.5 pb-1">
                          <button
                            type="button"
                            onClick={() => {
                              sfx.click();
                              setShowLooks((v) => !v);
                            }}
                            className="flex items-center gap-1 text-[10px] text-white/35 hover:text-white/60 transition-colors"
                          >
                            {showLooks ? "외형 서술 접기" : "외형·복장 자세히 보기"}
                            <ChevronDown
                              size={11}
                              className={`transition-transform ${showLooks ? "rotate-180" : ""}`}
                            />
                          </button>
                          <AnimatePresence>
                            {showLooks && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="pt-2.5 space-y-2.5">
                                  {profile.appearance && (
                                    <div>
                                      <div className="text-[9px] tracking-[0.18em] uppercase text-white/35 mb-1">
                                        외형
                                      </div>
                                      <p className="text-[11px] text-white/60 leading-relaxed whitespace-pre-line">
                                        {profile.appearance}
                                      </p>
                                    </div>
                                  )}
                                  {profile.clothing && (
                                    <div>
                                      <div className="text-[9px] tracking-[0.18em] uppercase text-white/35 mb-1">
                                        복장
                                      </div>
                                      <p className="text-[11px] text-white/60 leading-relaxed whitespace-pre-line">
                                        {profile.clothing}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>

                    {/* 하단 CTA — 패널 고정 푸터 */}
                    <div className="flex-shrink-0 px-4 py-3 border-t border-white/[0.08]">
                      <button
                        type="button"
                        disabled={ctaBusy}
                        onClick={handleCta}
                        onMouseEnter={() => sfx.hover()}
                        className="w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/25 transition flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        <MessageCircle size={13} />
                        {ctaBusy ? "입장 중…" : ctaLabel}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 에러 토스트 — 패널 트리 밖 (transform 조상 아래 fixed 좌표 붕괴 방지) */}
        <AnimatePresence>
          {errorToast && (
            <motion.div
              key="profile-panel-toast"
              className="fixed bottom-8 left-1/2 z-[9999] px-6 py-3.5 rounded-2xl backdrop-blur-xl border shadow-2xl text-sm font-medium bg-rose-900/80 border-rose-400/30 text-rose-200 shadow-rose-500/20"
              initial={{ x: "-50%", y: 30, opacity: 0, scale: 0.9 }}
              animate={{ x: "-50%", y: 0, opacity: 1, scale: 1 }}
              exit={{ x: "-50%", y: 30, opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              {errorToast}
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // ═══ "card" — 화면 중앙 글래스 모달 카드 (로비 선택 플로우) ═══
  if (variant === "card") {
    return (
      <AnimatePresence>
        {open && (
          <motion.div
            key="profile-card-overlay"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* 딤 백드롭 */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={handleBackdropClick}
            />

            {loading && (
              <motion.div
                className="relative w-9 h-9 border-2 border-amber-400/40 border-t-amber-400 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            )}

            {!loading && profile && (
              <motion.div
                key="profile-card"
                className="relative w-[min(92vw,680px)] max-h-[min(88vh,660px)] rounded-2xl border border-white/[0.08] overflow-hidden flex flex-col sm:flex-row"
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 280, damping: 26 }}
                style={{
                  background: "linear-gradient(160deg, rgba(8,4,20,0.92), rgba(15,8,30,0.95))",
                  backdropFilter: "blur(28px) saturate(1.3)",
                  boxShadow:
                    "0 12px 60px rgba(0,0,0,0.55), 0 0 80px rgba(251,191,36,0.10), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                {/* 일러스트 패널 — 모바일: 컴팩트 배너 / 데스크톱: 좌측 세로 패널 */}
                <div className="relative h-44 sm:h-auto sm:w-[248px] flex-shrink-0 bg-gradient-to-b from-indigo-950/70 via-[#0d0a1e] to-[#0b1026]">
                  {profile.defaultImageUrl || profile.thumbnailUrl ? (
                    <img
                      src={profile.defaultImageUrl || profile.thumbnailUrl}
                      alt={profile.name}
                      className="w-full h-full object-cover object-top"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/10">
                      <User size={44} />
                    </div>
                  )}
                  {/* 크롭 경계 완화 스크림 — 모바일 하단 / 데스크톱 우측 */}
                  <div
                    className="absolute inset-0 sm:hidden"
                    style={{
                      background:
                        "linear-gradient(to bottom, rgba(8,4,20,0.15) 0%, rgba(8,4,20,0) 40%, rgba(10,5,22,0.85) 100%)",
                    }}
                  />
                  <div
                    className="absolute inset-0 hidden sm:block"
                    style={{
                      background:
                        "linear-gradient(to right, rgba(8,4,20,0) 65%, rgba(10,5,22,0.55) 100%)",
                    }}
                  />
                </div>

                {/* 정보 칼럼 */}
                <div className="flex-1 min-w-0 flex flex-col">
                  {/* 헤더 — eyebrow + 이름 + 닫기 */}
                  <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-1 flex-shrink-0">
                    <div className="min-w-0">
                      <div
                        className="text-[9px] text-white/35 mb-1"
                        style={{ fontFamily: MONO_STACK, letterSpacing: "0.28em" }}
                      >
                        PROFILE
                      </div>
                      <h2
                        className="text-2xl text-white tracking-wide truncate"
                        style={{ fontWeight: 800 }}
                      >
                        {profile.name}
                      </h2>
                      {ageRole && <p className="text-xs text-white/50 mt-0.5">{ageRole}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={handleClose}
                      onMouseEnter={() => sfx.hover()}
                      aria-label="닫기"
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* 본문 스크롤 */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pt-2 pb-3">
                    {/* 무드 칩 + 세계관 배지 */}
                    {((profile.moodTags || []).length > 0 || profile.worldName) && (
                      <div className="flex flex-wrap items-center gap-1 mb-3">
                        {(profile.moodTags || []).map((tag) => (
                          <span
                            key={tag}
                            className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-200 border border-amber-400/25"
                          >
                            {tag}
                          </span>
                        ))}
                        {profile.worldName && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-400/15 text-violet-200 border border-violet-400/25">
                            🌙 {profile.worldName}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 신상 레코드 — 밀도형 행 */}
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-3.5 py-1">
                      <PanelRow label="키" value={profile.height} />
                      <PanelRow label="좋아하는 것" value={profile.likes} />
                      <PanelRow label="싫어하는 것" value={profile.dislikes} />
                      <PanelRow label="취미" value={profile.hobby} last />
                    </div>

                    {/* introTeaser — 세리프 이탤릭 인용 */}
                    <blockquote
                      className="mt-3.5 pl-3 border-l-2 border-amber-400/60 italic leading-relaxed"
                      style={{ fontFamily: SERIF_STACK }}
                    >
                      {profile.introTeaser ? (
                        <span className="text-[13px] text-white/80">{profile.introTeaser}</span>
                      ) : (
                        <span className="text-xs text-white/25">기록 없음</span>
                      )}
                    </blockquote>

                    {profile.ugc && profile.creatorNickname && (
                      <p className="text-[10px] text-white/30 mt-3">
                        창작자 · {profile.creatorNickname}
                      </p>
                    )}

                    {/* 외형·복장 서술 — 고스트 링크 접이식 */}
                    {(profile.appearance || profile.clothing) && (
                      <div className="mt-3.5">
                        <button
                          type="button"
                          onClick={() => {
                            sfx.click();
                            setShowLooks((v) => !v);
                          }}
                          className="flex items-center gap-1 text-[10px] text-white/35 hover:text-white/60 transition-colors"
                        >
                          {showLooks ? "외형 서술 접기" : "외형·복장 자세히 보기"}
                          <ChevronDown
                            size={11}
                            className={`transition-transform ${showLooks ? "rotate-180" : ""}`}
                          />
                        </button>
                        <AnimatePresence>
                          {showLooks && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <div className="pt-2.5 space-y-2.5">
                                {profile.appearance && (
                                  <div>
                                    <div className="text-[9px] tracking-[0.18em] uppercase text-white/35 mb-1">
                                      외형
                                    </div>
                                    <p className="text-[11px] text-white/60 leading-relaxed whitespace-pre-line">
                                      {profile.appearance}
                                    </p>
                                  </div>
                                )}
                                {profile.clothing && (
                                  <div>
                                    <div className="text-[9px] tracking-[0.18em] uppercase text-white/35 mb-1">
                                      복장
                                    </div>
                                    <p className="text-[11px] text-white/60 leading-relaxed whitespace-pre-line">
                                      {profile.clothing}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>

                  {/* CTA 푸터 */}
                  <div className="flex-shrink-0 px-5 py-3.5 border-t border-white/[0.08]">
                    <button
                      type="button"
                      disabled={ctaBusy}
                      onClick={handleCta}
                      onMouseEnter={() => sfx.hover()}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/25 transition flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <MessageCircle size={13} />
                      {ctaBusy ? "입장 중…" : ctaLabel}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 에러 토스트 */}
            <AnimatePresence>
              {errorToast && (
                <motion.div
                  key="profile-card-toast"
                  className="fixed bottom-8 left-1/2 z-[9999] px-6 py-3.5 rounded-2xl backdrop-blur-xl border shadow-2xl text-sm font-medium bg-rose-900/80 border-rose-400/30 text-rose-200 shadow-rose-500/20"
                  initial={{ x: "-50%", y: 30, opacity: 0, scale: 0.9 }}
                  animate={{ x: "-50%", y: 0, opacity: 1, scale: 1 }}
                  exit={{ x: "-50%", y: 30, opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                >
                  {errorToast}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* ═══ 배경 레이어 ═══ */}
          <div
            className="absolute inset-0"
            style={{ background: "#0b1026" }}
            onClick={handleBackdropClick}
          />

          {/* ═══ 로딩 ═══ */}
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <motion.div
                className="w-10 h-10 border-2 border-amber-400/40 border-t-amber-400 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </div>
          )}

          {/* ═══ A안 「첫 만남」 — immersive ═══ */}
          {!loading && profile && variant === "immersive" && (
            <motion.div
              className="absolute inset-0 z-10 overflow-y-auto custom-scrollbar"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              // 콘텐츠 칼럼 바깥(빈 배경) 클릭 = 배경 클릭 닫기 (250ms 가드)
              onClick={(e) => { if (e.target === e.currentTarget) handleBackdropClick(); }}
            >
              {/* 풀블리드 배경 + 딥네이비 스크림 (위 40%부터 하단으로) */}
              <div className="fixed inset-0 pointer-events-none">
                {profile.defaultImageUrl || profile.thumbnailUrl ? (
                  <img
                    src={profile.defaultImageUrl || profile.thumbnailUrl}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/10 bg-gradient-to-b from-indigo-950 to-[#0b1026]">
                    <User size={72} />
                  </div>
                )}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to bottom, rgba(11,16,38,0) 0%, rgba(11,16,38,0) 40%, rgba(11,16,38,0.78) 68%, rgba(11,16,38,0.97) 100%)",
                  }}
                />
              </div>

              {/* 상단바 — 뒤로가기 원형 버튼 */}
              <div className="sticky top-0 z-20 flex items-center px-4 sm:px-6 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  onMouseEnter={() => sfx.hover()}
                  aria-label="뒤로가기"
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
              </div>

              {/* 하단 콘텐츠 — 상단 여백(일러스트 노출부) 클릭도 배경 클릭으로 취급 */}
              <div
                className="relative z-10 max-w-lg mx-auto px-5 sm:px-6 pt-[38vh] pb-8"
                onClick={(e) => { if (e.target === e.currentTarget) handleBackdropClick(); }}
              >
                {/* 무드 태그 칩 + 세계관 배지 */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {(profile.moodTags || []).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-400/15 text-amber-200 border border-amber-400/30 backdrop-blur-sm"
                    >
                      {tag}
                    </span>
                  ))}
                  {profile.worldName && (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-violet-400/15 text-violet-200 border border-violet-400/30 backdrop-blur-sm">
                      🌙 {profile.worldName}
                    </span>
                  )}
                </div>

                {/* 이름 (대형 800) + 나이·역할 */}
                <h1
                  className="text-4xl sm:text-5xl text-white tracking-wide drop-shadow-lg"
                  style={{ fontWeight: 800 }}
                >
                  {profile.name}
                </h1>
                {ageRole && <p className="text-sm text-white/60 mt-1.5">{ageRole}</p>}
                {profile.ugc && profile.creatorNickname && (
                  <p className="text-[11px] text-white/35 mt-1">
                    창작자 · {profile.creatorNickname}
                  </p>
                )}

                {/* 반투명 시트 */}
                <div className="mt-5 -mx-5 sm:-mx-6 rounded-t-2xl bg-white/[0.05] backdrop-blur-md border-t border-white/10 px-5 sm:px-6 pt-5 pb-6">
                  {/* 신상 2×2 그리드 */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <VitalCard label="키 · Height" value={profile.height} />
                    <VitalCard label="취미 · Hobby" value={profile.hobby} />
                    <VitalCard label="좋아하는 것 · Likes" value={profile.likes} />
                    <VitalCard label="싫어하는 것 · Dislikes" value={profile.dislikes} />
                  </div>

                  {/* introTeaser — 세리프 이탤릭 인용 */}
                  <blockquote
                    className="mt-5 pl-4 border-l-2 border-amber-400/70 italic leading-relaxed"
                    style={{ fontFamily: SERIF_STACK }}
                  >
                    {profile.introTeaser ? (
                      <span className="text-[15px] text-white/85">{profile.introTeaser}</span>
                    ) : (
                      <span className="text-sm text-white/25">기록 없음</span>
                    )}
                  </blockquote>

                  {/* CTA */}
                  <button
                    type="button"
                    disabled={ctaBusy}
                    onClick={handleCta}
                    onMouseEnter={() => sfx.hover()}
                    className={`mt-6 ${ctaClass}`}
                  >
                    <MessageCircle size={15} />
                    {ctaBusy ? "입장 중…" : ctaLabel}
                  </button>

                  {/* 외형·복장 서술 — 고스트 링크 접이식 */}
                  {(profile.appearance || profile.clothing) && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          sfx.click();
                          setShowLooks((v) => !v);
                        }}
                        className="mx-auto flex items-center gap-1 text-[11px] text-white/35 hover:text-white/60 transition-colors"
                      >
                        {showLooks ? "외형 서술 접기" : "외형·복장 자세히 보기"}
                        <ChevronDown
                          size={12}
                          className={`transition-transform ${showLooks ? "rotate-180" : ""}`}
                        />
                      </button>
                      <AnimatePresence>
                        {showLooks && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-3 space-y-3">
                              {profile.appearance && (
                                <div>
                                  <div className="text-[9px] tracking-[0.18em] uppercase text-white/35 mb-1">
                                    외형
                                  </div>
                                  <p className="text-xs text-white/60 leading-relaxed whitespace-pre-line">
                                    {profile.appearance}
                                  </p>
                                </div>
                              )}
                              {profile.clothing && (
                                <div>
                                  <div className="text-[9px] tracking-[0.18em] uppercase text-white/35 mb-1">
                                    복장
                                  </div>
                                  <p className="text-xs text-white/60 leading-relaxed whitespace-pre-line">
                                    {profile.clothing}
                                  </p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ B안 「인물 기록」 — dossier ═══ */}
          {!loading && profile && variant === "dossier" && (
            <motion.div
              className="absolute inset-0 z-10 overflow-y-auto custom-scrollbar"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <div
                className="min-h-full bg-gradient-to-b from-stone-950 via-[#100e0a] to-stone-950"
                // 문서 칼럼 바깥(빈 배경) 클릭 = 배경 클릭 닫기 (250ms 가드)
                onClick={(e) => { if (e.target === e.currentTarget) handleBackdropClick(); }}
              >
                <div className="max-w-xl mx-auto px-5 sm:px-6 py-6">
                  {/* 헤더행 — CHARACTER FILE / NO.XXX + 닫기 */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/15">
                    <div
                      className="flex items-center gap-3 text-[10px] text-white/45"
                      style={{ fontFamily: MONO_STACK, letterSpacing: "0.3em" }}
                    >
                      <span>CHARACTER FILE</span>
                      <span className="text-white/20">/</span>
                      <span className="text-amber-200/70">
                        NO.{String(profile.characterId ?? characterId).padStart(3, "0")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClose}
                      onMouseEnter={() => sfx.hover()}
                      aria-label="닫기"
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-colors"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* 초상 + 이름 + slug */}
                  <div className="flex items-start gap-4 mt-5">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden border border-white/15 bg-stone-900 flex-shrink-0">
                      {profile.thumbnailUrl || profile.defaultImageUrl ? (
                        <img
                          src={profile.thumbnailUrl || profile.defaultImageUrl}
                          alt={profile.name}
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/15">
                          <User size={30} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 pt-1">
                      <h1 className="text-3xl text-white tracking-wide" style={{ fontWeight: 800 }}>
                        {profile.name}
                      </h1>
                      {profile.slug && (
                        <p
                          className="text-[11px] text-white/35 lowercase mt-1"
                          style={{ letterSpacing: "0.25em" }}
                        >
                          {profile.slug}
                        </p>
                      )}
                      {/* 무드 태그 — 스탬프 칩 (살짝 기울임) */}
                      {(profile.moodTags || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {profile.moodTags.map((tag, i) => (
                            <span
                              key={tag}
                              className="inline-block text-[10px] font-bold px-2 py-0.5 rounded text-amber-200/90 uppercase"
                              style={{
                                border: "1.5px solid rgba(251,191,36,0.45)",
                                transform: `rotate(${i % 2 === 0 ? -2 : 1.5}deg)`,
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 레코드 행 리스트 */}
                  <div className="mt-6">
                    <DossierRow
                      label="나이"
                      value={profile.age != null ? `${profile.age}세` : null}
                    />
                    <DossierRow label="역할" value={profile.role} />
                    <DossierRow label="키" value={profile.height} />
                    <DossierRow label="좋아하는 것" value={profile.likes} />
                    <DossierRow label="싫어하는 것" value={profile.dislikes} />
                    <DossierRow label="취미" value={profile.hobby} />
                    <DossierRow label="세계관" value={profile.worldName} />
                    {profile.ugc && (
                      <DossierRow label="크리에이터" value={profile.creatorNickname} />
                    )}
                  </div>

                  {/* 첫인사 발췌 인용 */}
                  <div className="mt-7">
                    <div
                      className="text-[9px] text-white/40 mb-2.5"
                      style={{ fontFamily: MONO_STACK, letterSpacing: "0.25em" }}
                    >
                      FIRST GREETING — 발췌
                    </div>
                    <div className="relative rounded-xl bg-white/[0.03] border border-white/10 px-5 py-4">
                      <span
                        className="absolute -top-2 left-3 text-3xl text-amber-300/50 leading-none select-none"
                        style={{ fontFamily: SERIF_STACK }}
                      >
                        “
                      </span>
                      {profile.greetingExcerpt ? (
                        <p
                          className="text-sm text-white/80 leading-relaxed"
                          style={{ fontFamily: SERIF_STACK }}
                        >
                          {profile.greetingExcerpt}
                        </p>
                      ) : (
                        <p className="text-sm text-white/25">기록 없음</p>
                      )}
                    </div>
                  </div>

                  {/* 하단 CTA */}
                  <button
                    type="button"
                    disabled={ctaBusy}
                    onClick={handleCta}
                    onMouseEnter={() => sfx.hover()}
                    className={`mt-7 ${ctaClass}`}
                  >
                    <MessageCircle size={15} />
                    {ctaBusy ? "입장 중…" : ctaLabel}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ 에러 토스트 ═══ */}
          <AnimatePresence>
            {errorToast && (
              <motion.div
                className="fixed bottom-8 left-1/2 z-[9999] px-6 py-3.5 rounded-2xl backdrop-blur-xl border shadow-2xl text-sm font-medium bg-rose-900/80 border-rose-400/30 text-rose-200 shadow-rose-500/20"
                initial={{ x: "-50%", y: 30, opacity: 0, scale: 0.9 }}
                animate={{ x: "-50%", y: 0, opacity: 1, scale: 1 }}
                exit={{ x: "-50%", y: 30, opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
              >
                {errorToast}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
