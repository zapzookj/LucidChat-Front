import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../../api/axios";
import { DIFFICULTY_META } from "../../utils/difficultyMeta";
import { sfx } from "../../utils/sfx";
import { assetUrl } from "../../utils/assetUrl";
import { TwinkleStar, isNightTime } from "./lobbyShared";

/**
 * [블록 A] '첫 만남' 온보딩 — 빈손 신규(방 0개)에게만 보인다 (docs/14 §B — C안).
 * 첫 결정을 '모드'가 아니라 '사람'으로: 난이도 분산 3인 택1 → 즉시 자유 대화.
 * 게스트가 인연을 고르고 로그인한 경우는 딥링크 복원이 이 화면을 대체한다(스킵).
 *
 * 추천 3인: 공식 캐릭터에서 쉬움/보통/어려움 각 1명 자동 선정(2026-08-13 종원 확정),
 * 부족하면 앞선 캐릭터로 채운다.
 */
export default function FirstMeetPage() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api.get("/lobby/feed")
      .then((r) => setFeed((r.data.items || []).filter((c) => !c.ugc)))
      .catch(() => setFeed([]));
  }, []);

  // 난이도 분산 자동 선정 — EASY/NORMAL/HARD 각 1, 미달 시 남은 공식으로 보충
  const picks = useMemo(() => {
    if (!feed) return [];
    const byDiff = (d) => feed.find((c) => c.difficulty === d);
    const chosen = [];
    for (const d of ["EASY", "NORMAL", "HARD"]) {
      const c = byDiff(d);
      if (c && !chosen.includes(c)) chosen.push(c);
    }
    for (const c of feed) {
      if (chosen.length >= 3) break;
      if (!chosen.includes(c)) chosen.push(c);
    }
    return chosen.slice(0, 3);
  }, [feed]);

  useEffect(() => {
    // 가운데 카드(보통)를 기본 선택 — 와이어프레임 C안의 하이라이트 관례
    if (picks.length > 0 && selectedId === null) {
      setSelectedId((picks[1] || picks[0]).characterId);
    }
  }, [picks, selectedId]);

  const selected = picks.find((c) => c.characterId === selectedId) || null;

  const handleStart = async () => {
    if (!selected || starting) return;
    setStarting(true);
    try {
      const res = await api.post("/lobby/rooms", { characterId: selected.characterId, chatMode: "SANDBOX" });
      localStorage.setItem("roomId", res.data.roomId);
      sfx.chime?.(); // 결정적 순간 — 온보딩 선택
      navigate(`/chat/${res.data.roomId}`, { replace: true });
    } catch (e) {
      alert(e.response?.data?.message || "시작에 실패했어요. 잠시 후 다시 시도해 주세요.");
      setStarting(false);
    }
  };

  const stars = useMemo(() => Array.from({ length: 40 }, () => ({ left: `${Math.random() * 100}%`, top: `${Math.random() * 70}%` })), []);
  const bg = isNightTime() ? assetUrl("/backgrounds/bg_lobby_night.png") : assetUrl("/backgrounds/bg_lobby_day.png");

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <div className="absolute inset-0">
        <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        <div className="absolute inset-0 bg-[#0b0b14]/70" />
        {stars.map((style, i) => <TwinkleStar key={i} style={style} />)}
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(36,29,69,0.55),transparent_70%)]" />
      </div>

      <div className="relative z-10 h-full overflow-y-auto custom-scrollbar flex flex-col items-center justify-center px-6 py-10">
        <motion.h1
          className="text-xl sm:text-2xl font-bold text-white tracking-wide text-center"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        >
          누구와 첫 꿈을 꿀까요?
        </motion.h1>
        <motion.p
          className="text-xs text-white/40 mt-2 mb-8 tracking-wide text-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
        >
          자각몽 정거장에서, 세 인연이 당신을 기다립니다
        </motion.p>

        {feed === null && (
          <div className="flex gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="w-36 sm:w-44 h-60 rounded-2xl bg-white/[0.04] border border-white/10 animate-pulse" />
            ))}
          </div>
        )}

        {feed !== null && (
          <div className="flex gap-3 sm:gap-5">
            {picks.map((c, i) => {
              const diff = DIFFICULTY_META[c.difficulty];
              const on = c.characterId === selectedId;
              return (
                <motion.button
                  key={c.characterId}
                  onClick={() => setSelectedId(c.characterId)}
                  className={`relative w-36 sm:w-44 rounded-2xl overflow-hidden border text-left transition-all duration-300 ${
                    on
                      ? "border-violet-300/70 shadow-[0_0_36px_rgba(147,130,255,0.35)] scale-[1.03]"
                      : "border-white/12 opacity-75 hover:opacity-100"
                  }`}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: on ? 1 : 0.75, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.12, type: "spring", stiffness: 160, damping: 20 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <div className="relative h-44 sm:h-52 bg-gradient-to-b from-indigo-900/50 to-slate-900 overflow-hidden">
                    {(c.thumbnailUrl || c.defaultImageUrl) && (
                      <img src={c.thumbnailUrl || c.defaultImageUrl} alt={c.name} className="w-full h-full object-cover object-top" draggable={false} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#10101e] via-transparent to-transparent" />
                  </div>
                  <div className="px-3 py-2.5 bg-[#141422]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-bold text-white">{c.name}</span>
                      {diff && (
                        <span className={`text-[9px] font-bold px-1.5 py-[1px] rounded-full border ${diff.badgeCls}`}>{diff.label}</span>
                      )}
                    </div>
                    <p className="text-[10.5px] text-white/45 truncate mt-0.5">{c.tagline}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        <motion.button
          onClick={handleStart}
          disabled={!selected || starting}
          className={`mt-8 w-full max-w-sm py-3.5 rounded-2xl text-[15px] font-bold transition-colors ${
            selected && !starting
              ? "text-slate-900 bg-gradient-to-r from-violet-300 to-sky-300 hover:from-violet-200 hover:to-sky-200 shadow-[0_4px_28px_rgba(147,130,255,0.4)]"
              : "text-white/30 bg-white/[0.06] cursor-not-allowed"
          }`}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
        >
          {starting ? "꿈으로 이동 중…" : selected ? `${selected.name}와 대화 시작하기` : "인연을 골라주세요"}
        </motion.button>

        <motion.button
          onClick={() => navigate("/", { replace: true })}
          className="mt-4 text-[12px] text-white/30 hover:text-white/60 underline underline-offset-4 transition-colors"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
        >
          먼저 둘러볼게요
        </motion.button>
      </div>
    </div>
  );
}
