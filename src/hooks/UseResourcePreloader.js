import { useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4 Fix #15] useResourcePreloader — 단계적 리소스 프리로딩
//
//  관계 레벨(STRANGER → ACQUAINTANCE → FRIEND → LOVER)에 따라
//  해금된 리소스만 점진적으로 프리로딩.
//  Secret Mode일 경우 모든 티어를 한 번에 로딩.
//
//  리소스 경로는 BackgroundDisplay.jsx, AudioEngine.jsx,
//  CharacterDisplay.jsx, RelationStatusPolicy.java와 정확히 일치.
//
//  사용법 (ChatPage.jsx):
//    const { preloadEndingAssets } = useResourcePreloader(
//      roomInfo?.statusLevel,
//      userInfo.isSecretMode
//    );
// ═══════════════════════════════════════════════════════════════

const ALL_EMOTIONS = [
  "neutral", "joy", "sad", "angry", "shy", "surprise",
  "panic", "disgust", "relax", "frightened", "flirtatious", "heated",
];

// ── 관계 레벨별 해금 리소스 매핑 ──
// RelationStatusPolicy.java의 getAllowedLocations/getAllowedOutfits 기준
const RESOURCE_TIERS = {
  // ─── STRANGER: 저택 내부 8곳 + MAID 복장 + 코어 BGM/앰비언스 ───
  STRANGER: {
    outfits: ["maid"],
    // BackgroundDisplay.jsx BG_MAP 기준 — 저택 내부 전체
    backgrounds: [
      "/backgrounds/bg_entrance_day.png",
      "/backgrounds/bg_entrance_night.png",
      "/backgrounds/bg_livingroom_day.png",
      "/backgrounds/bg_livingroom_night.png",
      "/backgrounds/bg_balcony_day.png",
      "/backgrounds/bg_balcony_night.png",
      "/backgrounds/bg_study.png",              // 서재는 1장 (day/night 공용)
      "/backgrounds/bg_bathroom_day.png",
      "/backgrounds/bg_bathroom_night.png",
      "/backgrounds/bg_garden_day.png",
      "/backgrounds/bg_garden_night.png",
      "/backgrounds/bg_kitchen_day.png",
      "/backgrounds/bg_kitchen_night.png",
      "/backgrounds/bg_bedroom_day.png",
      "/backgrounds/bg_bedroom_night.png",
    ],
    // AudioEngine.jsx BGM_MAP 기준 — 초반 자주 사용되는 BGM
    bgm: [
      "/sounds/bgm_daily.mp3",
      "/sounds/bgm_romantic.mp3",
      "/sounds/bgm_touching.mp3",
      "/sounds/bgm_tense.mp3",
      "/sounds/bgm_lobby.mp3",
    ],
    // AudioEngine.jsx AMBIENCE_MAP 기준 — 저택 내부 장소
    ambience: [
      "/sounds/amb_birds.mp3",       // GARDEN_DAY, BALCONY_DAY
      "/sounds/amb_crickets.mp3",    // GARDEN_NIGHT, BALCONY_NIGHT
      "/sounds/amb_owl.mp3",         // GARDEN_NIGHT, BALCONY_NIGHT
      "/sounds/amb_kitchen.mp3",     // KITCHEN
      "/sounds/amb_bathroom.mp3",    // BATHROOM
    ],
    // AudioEngine.jsx SFX_MAP 기준
    sfx: [
      "/sounds/sfx_door_open.mp3",   // 대부분의 실내 전환
    ],
  },

  // ─── ACQUAINTANCE: DOWNTOWN + DATE/PAJAMA 복장 ───
  ACQUAINTANCE: {
    outfits: ["date", "pajama"],
    backgrounds: [
      "/backgrounds/bg_downtown_day.png",
      "/backgrounds/bg_downtown_night.png",
    ],
    bgm: [
      "/sounds/bgm_exciting.mp3",
    ],
    ambience: [
      "/sounds/amb_street.mp3",     // DOWNTOWN
    ],
    sfx: [],
  },

  // ─── FRIEND: BEACH + SWIMWEAR 복장 ───
  FRIEND: {
    outfits: ["swimwear"],
    backgrounds: [
      "/backgrounds/bg_beach_day.png",
      "/backgrounds/bg_beach_night.png",
      "/backgrounds/bg_beach_sunset.png",
    ],
    bgm: [],
    ambience: [
      "/sounds/amb_beach.mp3",      // BEACH
    ],
    sfx: [
      "/sounds/sfx_seagull.mp3",    // BEACH 전환 시
    ],
  },

  // ─── LOVER: BAR + NEGLIGEE 복장 + EROTIC BGM ───
  LOVER: {
    outfits: ["negligee"],
    backgrounds: [
      "/backgrounds/bg_bar_night.png",
    ],
    bgm: [
      "/sounds/bgm_erotic.mp3",
    ],
    ambience: [
      "/sounds/amb_bar.mp3",        // BAR
    ],
    sfx: [],
  },
};

// 관계 레벨 순서 (누적 로딩)
const RELATION_ORDER = ["STRANGER", "ACQUAINTANCE", "FRIEND", "LOVER"];


// ── 프리로딩 유틸 ──

/** 이미지 프리로딩 — new Image()로 브라우저 캐시에 적재 */
function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

/** 오디오 프리로딩 — preload="auto"로 전체 파일 캐싱 */
function preloadAudio(src) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.oncanplaythrough = () => {
      audio.src = "";   // 메모리 해제 (캐시는 유지됨)
      resolve(true);
    };
    audio.onerror = () => resolve(false);
    audio.src = src;
  });
}

/**
 * 배치 프리로딩 — concurrency 제한으로 네트워크 과부하 방지
 * 이미지 4개, 오디오 2개씩 동시 로딩
 */
async function preloadBatch(items, loader, concurrency = 3) {
  const queue = [...items];
  let loaded = 0;

  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      await loader(item);
      loaded++;
    }
  };

  await Promise.all(
    Array(Math.min(concurrency, items.length))
      .fill(null)
      .map(() => worker())
  );

  return loaded;
}


// ═══════════════════════════════════════════════════════════════
//  Hook
// ═══════════════════════════════════════════════════════════════

/**
 * @param {string} statusLevel - 현재 관계 레벨 ("STRANGER" | "ACQUAINTANCE" | "FRIEND" | "LOVER")
 * @param {boolean} isSecretMode - 시크릿 모드 (전체 리소스 즉시 해금)
 * @returns {{ preloadEndingAssets: () => void }}
 */
export default function useResourcePreloader(statusLevel, isSecretMode = false) {
  const loadedTiersRef = useRef(new Set());

  const preloadTier = useCallback(async (tierName) => {
    if (loadedTiersRef.current.has(tierName)) return;
    loadedTiersRef.current.add(tierName);

    const tier = RESOURCE_TIERS[tierName];
    if (!tier) return;

    const startTime = performance.now();

    // 1) 캐릭터 이미지 (복장 × 12감정) — 우선 로딩
    const charImages = tier.outfits.flatMap((outfit) =>
      ALL_EMOTIONS.map((emo) => `/characters/${outfit}_${emo}.png`)
    );
    await preloadBatch(charImages, preloadImage, 4);

    // 2) 배경 이미지
    await preloadBatch(tier.backgrounds, preloadImage, 3);

    // 3) 오디오 (BGM → 앰비언스 → SFX)
    const allAudio = [...tier.bgm, ...tier.ambience, ...tier.sfx];
    await preloadBatch(allAudio, preloadAudio, 2);

    const elapsed = Math.round(performance.now() - startTime);
    const total = charImages.length + tier.backgrounds.length + allAudio.length;
    console.log(
      `🎨 [Preloader] Tier ${tierName}: ${total} assets loaded in ${elapsed}ms`
    );
  }, []);

  // ── 관계 레벨 변경 시 해당 티어까지 누적 로딩 ──
  useEffect(() => {
    if (!statusLevel) return;

    const loadTiers = async () => {
      if (isSecretMode) {
        // 시크릿 모드: 모든 티어 순차 로딩
        for (const tier of RELATION_ORDER) {
          await preloadTier(tier);
        }
        return;
      }

      // 일반 모드: 현재 관계 레벨까지 누적 로딩
      const currentIdx = RELATION_ORDER.indexOf(statusLevel);
      const targetIdx = currentIdx >= 0 ? currentIdx : 0;

      for (let i = 0; i <= targetIdx; i++) {
        await preloadTier(RELATION_ORDER[i]);
      }
    };

    // requestIdleCallback으로 초기 렌더링 차단 방지
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => loadTiers(), { timeout: 3000 });
    } else {
      setTimeout(loadTiers, 500);
    }
  }, [statusLevel, isSecretMode, preloadTier]);

  // ── 엔딩 리소스 선제 로딩 (호감도 높을 때 호출) ──
  const preloadEndingAssets = useCallback(() => {
    if (loadedTiersRef.current.has("_ENDING")) return;
    loadedTiersRef.current.add("_ENDING");

    console.log("🎨 [Preloader] Pre-loading ending BGM assets");
    preloadAudio("/sounds/bgm_ending_happy.mp3");
    preloadAudio("/sounds/bgm_ending_bad.mp3");
  }, []);

  return { preloadEndingAssets };
}