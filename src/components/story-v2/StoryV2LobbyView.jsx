import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Users, Play } from "lucide-react";
import { fetchWorlds } from "../../api/StoryV2Api";
import { sfx } from "../../utils/sfx";

/**
 * [Story V2] 로비 World 카드 그리드 뷰.
 *
 * <p>LobbyPage의 view === "worlds" 분기에서 렌더링.
 *
 * Props:
 *   onBack()         — 허브로 복귀
 *   onEnterCreate(worldId)  — World 카드 클릭 → CreateFlow 진입
 *   onContinue(roomId)      — 기존 방 "이어하기" 클릭
 */
export default function StoryV2LobbyView({ onBack, onEnterCreate, onContinue }) {
  const [worlds, setWorlds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchWorlds()
      .then((list) => setWorlds(list))
      .catch((e) => {
        console.error("[V2-Lobby] worlds fetch failed", e);
        setError("월드 목록을 불러올 수 없습니다.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      key="v2-worlds-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/85 backdrop-blur-sm px-4 sm:px-8 py-6 text-white"
    >
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => {
            sfx.click();
            onBack();
          }}
          className="p-2 hover:bg-white/5 rounded transition"
          aria-label="허브로 돌아가기"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-2xl font-light flex items-center gap-2">
          <Sparkles size={22} className="text-amber-300" />
          이야기의 문턱
          <span className="text-sm text-stone-500 ml-2">Story Worlds</span>
        </h1>
      </div>

      {loading && (
        <div className="text-center py-16 text-stone-400">월드를 불러오는 중...</div>
      )}

      {error && (
        <div className="text-center py-16 text-red-300">{error}</div>
      )}

      {!loading && !error && worlds.length === 0 && (
        <div className="text-center py-16 text-stone-500">
          아직 사용 가능한 월드가 없습니다.
        </div>
      )}

      {/* World 카드 그리드 */}
      {!loading && !error && worlds.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
          {worlds.map((w) => (
            <WorldCard
              key={w.worldId}
              world={w}
              onEnterCreate={onEnterCreate}
              onContinue={onContinue}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  World 카드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function WorldCard({ world, onEnterCreate, onContinue }) {
  const hasExisting = world.hasExistingRoom;

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="bg-stone-900/80 rounded-xl overflow-hidden border border-stone-800 hover:border-amber-400/30 transition"
    >
      {/* 히어로 이미지 */}
      {world.heroImageUrl ? (
        <div
          className="h-48 bg-cover bg-center"
          style={{ backgroundImage: `url(${world.heroImageUrl})` }}
        />
      ) : (
        <div className="h-48 bg-gradient-to-br from-stone-800 to-stone-900 flex items-center justify-center">
          <Sparkles size={32} className="text-stone-600" />
        </div>
      )}

      {/* 본문 */}
      <div className="p-5">
        <h2 className="text-xl font-bold text-amber-100">{world.displayName}</h2>
        {world.tagline && (
          <p className="text-sm text-stone-400 italic mt-1">{world.tagline}</p>
        )}
        {world.description && (
          <p className="text-sm text-stone-500 mt-3 line-clamp-3">{world.description}</p>
        )}

        {/* 메타 정보 */}
        <div className="flex items-center gap-4 mt-4 text-xs text-stone-500">
          <span className="flex items-center gap-1">
            <Users size={14} /> 히로인 {world.heroineCount}명
          </span>
          {world.moodKeywords && (
            <span className="truncate">{world.moodKeywords}</span>
          )}
        </div>

        {/* CTA */}
        <div className="mt-5 flex gap-2">
          {hasExisting ? (
            <>
              <button
                onClick={() => {
                  sfx.click();
                  onContinue(world.existingRoomId);
                }}
                className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded transition flex items-center justify-center gap-1.5"
              >
                <Play size={16} /> 이어하기
              </button>
              <button
                onClick={() => {
                  sfx.click();
                  onEnterCreate(world.worldId);
                }}
                className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm rounded transition"
                title="새로 시작 (기존 진행 사라짐)"
              >
                새로 시작
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                sfx.click();
                onEnterCreate(world.worldId);
              }}
              className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded transition flex items-center justify-center gap-1.5"
            >
              <Play size={16} /> 시작하기
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}