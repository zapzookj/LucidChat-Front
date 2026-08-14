import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../../api/axios";
import { sfx } from "../../utils/sfx";
import { withWaGwa } from "../../utils/josa";
import { setPrefGender } from "../../utils/preference";
import { CharacterCard, SkeletonCard, EmptyState, ErrorState, RATE_LIMIT_MSG } from "./lobbyUi";
import { TwinkleStar } from "./lobbyShared";

/**
 * [블록 A R2] '첫 만남' 2단계 온보딩 — 디자인 정본: aichat docs/15_assets/lobby_redesign_mockup.html 화면 5.
 *
 * 1단계(취향): 유저 성별을 묻지 않고 선호 캐릭터를 직접 묻는다(가정 0 — 설계 문서 §2).
 *   기본 선택 없음 + 선택 전 '다음' 비활성. 선택 즉시 preference.js(로컬)에 저장 —
 *   홈 개인화 정렬·설정 모달과 같은 저장소("언제든 설정에서 바꿀 수 있어요" 카피의 실체).
 * 2단계(택1): 공식 후보 3인 난이도 분산 → 즉시 자유 대화. 후보 규칙은 picks 주석 참조.
 *
 * 스킵 정책(재노출 없음 — 설계 문서 §2): 스킵 이력(localStorage)이 있으면 재진입 시 즉시
 * 홈으로 replace. 유일한 재진입로는 홈 히어로의 '첫 만남 시작하기' 배너 —
 * navigate("/first-meet", { state: { intent: true } })로만 다시 열린다(postLogin 무변경).
 *
 * 셸 밖 풀스크린 유지 — 배경은 토큰 배경 + 보라 글로우 + 별(에셋 무의존, 셸과 동일 문법).
 * 사운드 정책: 결정적 순간(방 생성 성공)만 sfx.chime — 호버/클릭 SFX 없음.
 */

const SKIP_KEY = "lucid:firstMeetSkipped";

const PREF_OPTIONS = [
  { value: "FEMALE", icon: "🌸", label: "여성 캐릭터", desc: "여성 캐릭터를 먼저 보여드려요" },
  { value: "MALE",   icon: "🌊", label: "남성 캐릭터", desc: "남성 캐릭터를 먼저 보여드려요" },
  { value: "ALL",    icon: "✦",  label: "모두 좋아요", desc: "가리지 않고 골고루 보여드려요" },
];

export default function FirstMeetPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef(null);

  const [step, setStep] = useState(1);
  const [pref, setPref] = useState(null);          // 기본 선택 없음 (설계 문서 §2 — 기본값 금지)
  const [feed, setFeed] = useState(null);          // null=로딩 중, []=로드 완료(빈 포함)
  const [feedError, setFeedError] = useState(false); // false | true | "rate"(429)
  const [selectedId, setSelectedId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);

  // ── 재노출 없음 규칙: 스킵 이력 + intent 아님 → 즉시 홈으로 replace ──
  const skipRedirect =
    localStorage.getItem(SKIP_KEY) === "1" && !location.state?.intent;
  useEffect(() => {
    if (skipRedirect) navigate("/", { replace: true });
  }, [skipRedirect, navigate]);

  // ── 피드 프리페치 (1단계에서 미리 — 2단계 진입 즉시 후보 노출) ──
  const loadFeed = useCallback(async () => {
    setFeedError(false);
    setFeed(null);
    try {
      const r = await api.get("/lobby/feed");
      // 공식만 + 홈 피드와 동일한 썸네일 폴백 매핑(defaultImageUrl)
      setFeed((r.data.items || []).filter((c) => !c.ugc).map((c) => ({ ...c, thumbnailUrl: c.thumbnailUrl || c.defaultImageUrl })));
    } catch (e) {
      setFeedError(e?.response?.status === 429 ? "rate" : true);
      setFeed([]);
    }
  }, []);
  useEffect(() => {
    if (!skipRedirect) loadFeed();
  }, [skipRedirect, loadFeed]);

  /**
   * 후보 3인 규칙(설계 문서 §2 '온보딩 후보 규칙'):
   *  1) 공식(!ugc)에서 1단계 선호 성별 풀 우선(ALL은 혼합 풀 그대로).
   *  2) EASY/NORMAL/HARD 각 1명 — 난이도 슬롯별로 선호 풀에서 먼저 찾고,
   *     [백필 규칙] 해당 성별 후보가 부족하면 같은 난이도의 반대 성별로 채운다.
   *  3) 그래도 3명 미만이면 난이도 무관 선호 풀 → 반대 풀 순으로 잔여 보충.
   *  gender 미제공 아이템은 FEMALE 간주(preference.js 정렬 규칙과 동일 방어).
   */
  const picks = useMemo(() => {
    if (!feed) return [];
    const norm = (c) => c.gender || "FEMALE";
    const usePref = pref === "FEMALE" || pref === "MALE";
    const preferred = usePref ? feed.filter((c) => norm(c) === pref) : feed;
    const backfill = usePref ? feed.filter((c) => norm(c) !== pref) : [];
    const chosen = [];
    for (const d of ["EASY", "NORMAL", "HARD"]) {
      // 선호 ALL: 직전 선택과 다른 성별 우선 탐색(없으면 아무 성별) — 후보 3인 성별 교차
      const prevGender = !usePref && chosen.length > 0 ? norm(chosen[chosen.length - 1]) : null;
      const hit =
        (prevGender
          ? preferred.find((c) => c.difficulty === d && !chosen.includes(c) && norm(c) !== prevGender)
          : null) ||
        preferred.find((c) => c.difficulty === d && !chosen.includes(c)) ||
        backfill.find((c) => c.difficulty === d && !chosen.includes(c));
      if (hit) chosen.push(hit);
    }
    for (const c of [...preferred, ...backfill]) {
      if (chosen.length >= 3) break;
      if (!chosen.includes(c)) chosen.push(c);
    }
    return chosen.slice(0, 3);
  }, [feed, pref]);

  // 2단계 진입 시 가운데 카드 기본 선택 (목업 관례 — 보통 난이도가 가운데)
  useEffect(() => {
    if (step === 2 && picks.length > 0 && !picks.some((c) => c.characterId === selectedId)) {
      setSelectedId((picks[1] || picks[0]).characterId);
    }
  }, [step, picks, selectedId]);

  // 스텝 전환 시 스크롤 최상단 복귀
  useEffect(() => {
    scrollRef.current?.scrollTo?.(0, 0);
  }, [step]);

  const selected = picks.find((c) => c.characterId === selectedId) || null;

  const pickPref = (value) => {
    setPref(value);
    setPrefGender(value); // 'FEMALE' | 'MALE' | 'ALL' — preference.js가 저장 형태 정규화
  };

  const handleSkip = () => {
    localStorage.setItem(SKIP_KEY, "1");
    navigate("/", { replace: true });
  };

  const handleStart = async () => {
    if (!selected || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const res = await api.post("/lobby/rooms", {
        characterId: selected.characterId,
        chatMode: "SANDBOX",
      });
      localStorage.setItem("roomId", res.data.roomId);
      sfx.chime?.(); // 결정적 순간 — 온보딩 선택 완료(기존 정책 유지)
      navigate(`/chat/${res.data.roomId}`, { replace: true });
    } catch (e) {
      setStartError(e.response?.data?.message || "시작에 실패했어요. 잠시 후 다시 시도해 주세요.");
      setStarting(false);
    }
  };

  const stars = useMemo(
    () => Array.from({ length: 36 }, () => ({ left: `${Math.random() * 100}%`, top: `${Math.random() * 45}%` })),
    []
  );

  if (skipRedirect) return null;

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-lobby-bg">
      {/* ═══ 배경 — 토큰 배경 + 보라 글로우 + 별 (셸과 동일 문법, 에셋 무의존) ═══ */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(1200px 500px at 50% -8%, rgba(139,110,247,0.14), transparent 60%)" }}
        />
        <div className="absolute inset-0 opacity-50">
          {stars.map((style, i) => <TwinkleStar key={i} style={style} />)}
        </div>
      </div>

      <div ref={scrollRef} className="relative z-10 h-full overflow-y-auto custom-scrollbar">
        {/* ── 상단 로고만 (탭 없음 — 온보딩 몰입 유지) ── */}
        <header className="max-w-[1200px] mx-auto h-16 px-4 sm:px-8 flex items-center">
          <span className="flex items-center gap-2">
            <span className="text-violet-300 text-[15px]">✦</span>
            <span className="text-base font-extrabold text-white tracking-[0.14em]">LUCID</span>
          </span>
        </header>

        {/* ── 스텝 콘텐츠 — enter 페이드 1회(셸 밖이므로 자체 담당) ── */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="max-w-[880px] mx-auto px-4 sm:px-8 pt-16 pb-[120px] text-center"
        >
          {step === 1 && (
            <>
              <p className="text-lb-meta font-bold text-lobby-tx2 tracking-[0.14em]">첫 만남 · 1 / 2</p>
              <h1 className="text-[19px] leading-[1.3] font-extrabold sm:text-lb-hero text-white tracking-tight mt-3">
                어떤 캐릭터에게 끌리시나요?
              </h1>
              <p className="text-[13px] sm:text-lb-card text-lobby-tx1 mt-2">
                답에 맞춰 홈 화면을 꾸며드려요 — 언제든 설정에서 바꿀 수 있어요
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
                {PREF_OPTIONS.map((opt) => {
                  const on = pref === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => pickPref(opt.value)}
                      aria-pressed={on}
                      className={`rounded-2xl border px-5 py-7 text-center transition-all duration-200 ease-out hover:-translate-y-0.5 ${
                        on
                          ? "border-violet-400/45 bg-gradient-to-br from-violet-300/15 to-sky-300/10 shadow-[0_0_32px_rgba(167,139,250,0.12)]"
                          : "border-white/[0.09] bg-white/[0.035] hover:border-white/[0.16]"
                      }`}
                    >
                      <span className="block text-[26px] mb-2.5">{opt.icon}</span>
                      <span className="block text-lb-card font-bold text-white">{opt.label}</span>
                      <span className="block text-lb-meta text-lobby-tx2 mt-1">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* 기본 선택 없음 — 선택 전 '다음' 비활성 (설계 문서 §2) */}
              <button
                onClick={() => setStep(2)}
                disabled={!pref}
                className={`mt-8 w-full max-w-[420px] py-[15px] rounded-2xl text-lb-card font-extrabold text-slate-900 bg-gradient-to-r from-violet-300 to-sky-300 transition-all ${
                  pref
                    ? "hover:-translate-y-px hover:shadow-[0_6px_28px_rgba(167,139,250,0.4)]"
                    : "opacity-40 cursor-default"
                }`}
              >
                다음
              </button>

              <button
                onClick={handleSkip}
                className="block mx-auto mt-5 text-lb-meta text-lobby-tx2 hover:text-lobby-tx1 underline underline-offset-[3px] transition-colors"
              >
                먼저 둘러볼게요
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-lb-meta font-bold text-lobby-tx2 tracking-[0.14em]">첫 만남 · 2 / 2</p>
              <h1 className="text-[19px] leading-[1.3] font-extrabold sm:text-lb-hero text-white tracking-tight mt-3">
                누구와 첫 이야기를 시작할까요?
              </h1>
              <p className="text-[13px] sm:text-lb-card text-lobby-tx1 mt-2">
                지금 고른 한 명과 바로 대화가 시작돼요 — 다른 캐릭터는 언제든 홈에서
              </p>

              {/* 후보 3장 — 로딩/오류/빈 상태는 상태 매트릭스 패턴 재사용 */}
              {feedError ? (
                <div className="mt-12">
                  <ErrorState message={feedError === "rate" ? RATE_LIMIT_MSG : undefined} onRetry={loadFeed} />
                </div>
              ) : feed === null ? (
                <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mt-12">
                  {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : picks.length === 0 ? (
                // 방어 분기 — 공식 상시 공급이라 정상 경로에선 발생하지 않음
                <div className="mt-12">
                  <EmptyState
                    title="지금은 소개할 캐릭터가 없어요"
                    desc="홈에서 다시 만나요"
                    ctaLabel="홈으로"
                    onCta={() => navigate("/", { replace: true })}
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mt-12">
                    {picks.map((c) => (
                      <CharacterCard
                        key={c.characterId}
                        item={c}
                        selected={c.characterId === selectedId}
                        onClick={() => setSelectedId(c.characterId)}
                      />
                    ))}
                  </div>

                  <p className="text-lb-meta text-lobby-tx2 mt-4">난이도는 캐릭터가 마음을 여는 속도예요</p>

                  <button
                    onClick={handleStart}
                    disabled={!selected || starting}
                    aria-busy={starting}
                    className={`mt-8 w-full max-w-[420px] py-[15px] rounded-2xl text-lb-card font-extrabold text-slate-900 bg-gradient-to-r from-violet-300 to-sky-300 transition-all ${
                      selected && !starting
                        ? "hover:-translate-y-px hover:shadow-[0_6px_28px_rgba(167,139,250,0.4)]"
                        : "opacity-40 cursor-default"
                    }`}
                  >
                    {selected ? withWaGwa(selected.name, "대화 시작하기") : "대화 시작하기"}
                  </button>

                  {startError && (
                    <p className="text-lb-meta text-rose-300 mt-3">{startError}</p>
                  )}
                </>
              )}

              <button
                onClick={handleSkip}
                className="block mx-auto mt-5 text-lb-meta text-lobby-tx2 hover:text-lobby-tx1 underline underline-offset-[3px] transition-colors"
              >
                먼저 둘러볼게요
              </button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
