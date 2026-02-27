import { useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4 Fix #15] useResourcePreloader — 단계적 리소스 프리로딩
//  [Phase 5] 멀티캐릭터 지원:
//    • characterSlug param → 캐릭터별 이미지/BGM 경로
//    • /characters/{slug}/{outfit}_{emotion}.png
//    • /sounds/characters/{slug}/bgm_daily.mp3
//    • /backgrounds/characters/{slug}/bg_default.png
//    • 공유 에셋 경로는 변경 없음
// ═══════════════════════════════════════════════════════════════

const ALL_EMOTIONS = [
  "neutral", "joy", "sad", "angry", "shy", "surprise",
  "panic", "disgust", "relax", "frightened", "flirtatious", "heated",
];

// ── 관계 레벨별 해금 리소스 매핑 ──
const RESOURCE_TIERS = {
  STRANGER: {
    outfits: ["maid"],
    backgrounds: [
      "/backgrounds/bg_entrance_day.png",
      "/backgrounds/bg_entrance_night.png",
      "/backgrounds/bg_livingroom_day.png",
      "/backgrounds/bg_livingroom_night.png",
      "/backgrounds/bg_balcony_day.png",
      "/backgrounds/bg_balcony_night.png",
      "/backgrounds/bg_study.png",
      "/backgrounds/bg_bathroom_day.png",
      "/backgrounds/bg_bathroom_night.png",
      "/backgrounds/bg_garden_day.png",
      "/backgrounds/bg_garden_night.png",
      "/backgrounds/bg_kitchen_day.png",
      "/backgrounds/bg_kitchen_night.png",
      "/backgrounds/bg_bedroom_day.png",
      "/backgrounds/bg_bedroom_night.png",
    ],
    bgm: [
      // [Phase 5] DAILY BGM은 캐릭터별로 별도 로딩 (아래 preloadTier 참조)
      "/sounds/bgm_romantic.mp3",
      "/sounds/bgm_touching.mp3",
      "/sounds/bgm_tense.mp3",
      "/sounds/bgm_lobby.mp3",
    ],
    ambience: [
      "/sounds/amb_birds.mp3",
      "/sounds/amb_crickets.mp3",
      "/sounds/amb_owl.mp3",
      "/sounds/amb_kitchen.mp3",
      "/sounds/amb_bathroom.mp3",
    ],
    sfx: [
      "/sounds/sfx_door_open.mp3",
    ],
  },

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
      "/sounds/amb_street.mp3",
    ],
    sfx: [],
  },

  FRIEND: {
    outfits: ["swimwear"],
    backgrounds: [
      "/backgrounds/bg_beach_day.png",
      "/backgrounds/bg_beach_night.png",
      "/backgrounds/bg_beach_sunset.png",
    ],
    bgm: [],
    ambience: [
      "/sounds/amb_beach.mp3",
    ],
    sfx: [
      "/sounds/sfx_seagull.mp3",
    ],
  },

  LOVER: {
    outfits: ["negligee"],
    backgrounds: [
      "/backgrounds/bg_bar_night.png",
    ],
    bgm: [
      "/sounds/bgm_erotic.mp3",
    ],
    ambience: [
      "/sounds/amb_bar.mp3",
    ],
    sfx: [],
  },
};

const RELATION_ORDER = ["STRANGER", "ACQUAINTANCE", "FRIEND", "LOVER"];


// ── 프리로딩 유틸 ──

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

function preloadAudio(src) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.oncanplaythrough = () => {
      audio.src = "";
      resolve(true);
    };
    audio.onerror = () => resolve(false);
    audio.src = src;
  });
}

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
//  [Phase 5] characterSlug 파라미터 추가
// ═══════════════════════════════════════════════════════════════

/**
 * @param {string} statusLevel - 현재 관계 레벨
 * @param {boolean} isSecretMode - 시크릿 모드
 * @param {string} characterSlug - 캐릭터 slug (에셋 경로 prefix)
 * @returns {{ preloadEndingAssets: () => void }}
 */
export default function useResourcePreloader(statusLevel, isSecretMode = false, characterSlug = "airi") {
  const loadedTiersRef = useRef(new Set());
  const slugRef = useRef(characterSlug);

  // slug 변경 시 ref 갱신 + 기존 캐시 무효화
  useEffect(() => {
    if (slugRef.current !== characterSlug) {
      slugRef.current = characterSlug;
      loadedTiersRef.current.clear(); // 캐릭터 변경 시 리프리로딩
    }
  }, [characterSlug]);

  const preloadTier = useCallback(async (tierName) => {
    const cacheKey = `${slugRef.current}_${tierName}`;
    if (loadedTiersRef.current.has(cacheKey)) return;
    loadedTiersRef.current.add(cacheKey);

    const tier = RESOURCE_TIERS[tierName];
    if (!tier) return;

    const startTime = performance.now();
    const slug = slugRef.current;

    // 1) 캐릭터 이미지 (복장 × 12감정) — slug 기반 경로
    const charImages = tier.outfits.flatMap((outfit) =>
      ALL_EMOTIONS.map((emo) => `/characters/${slug}/${outfit}_${emo}.png`)
    );
    await preloadBatch(charImages, preloadImage, 4);

    // 2) 캐릭터 전용 기본 배경 (STRANGER 티어에서 1회)
    if (tierName === "STRANGER") {
      const charBg = `/backgrounds/characters/${slug}/bg_default.png`;
      await preloadImage(charBg);
    }

    // 3) 공유 배경 이미지
    await preloadBatch(tier.backgrounds, preloadImage, 3);

    // 4) 오디오 (캐릭터별 DAILY BGM + 공유 BGM + 앰비언스 + SFX)
    const allAudio = [...tier.bgm, ...tier.ambience, ...tier.sfx];
    if (tierName === "STRANGER") {
      // 캐릭터 전용 DAILY BGM
      allAudio.unshift(`/sounds/characters/${slug}/bgm_daily.mp3`);
    }
    await preloadBatch(allAudio, preloadAudio, 2);

    const elapsed = Math.round(performance.now() - startTime);
    const total = charImages.length + tier.backgrounds.length + allAudio.length + (tierName === "STRANGER" ? 1 : 0);
    console.log(
      `🎨 [Preloader] ${slug}/${tierName}: ${total} assets loaded in ${elapsed}ms`
    );
  }, []);

  useEffect(() => {
    if (!statusLevel) return;

    const loadTiers = async () => {
      if (isSecretMode) {
        for (const tier of RELATION_ORDER) {
          await preloadTier(tier);
        }
        return;
      }

      const currentIdx = RELATION_ORDER.indexOf(statusLevel);
      const targetIdx = currentIdx >= 0 ? currentIdx : 0;

      for (let i = 0; i <= targetIdx; i++) {
        await preloadTier(RELATION_ORDER[i]);
      }
    };

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => loadTiers(), { timeout: 3000 });
    } else {
      setTimeout(loadTiers, 500);
    }
  }, [statusLevel, isSecretMode, characterSlug, preloadTier]);

  const preloadEndingAssets = useCallback(() => {
    const cacheKey = `${slugRef.current}_ENDING`;
    if (loadedTiersRef.current.has(cacheKey)) return;
    loadedTiersRef.current.add(cacheKey);

    console.log("🎨 [Preloader] Pre-loading ending BGM assets");
    preloadAudio("/sounds/bgm_ending_happy.mp3");
    preloadAudio("/sounds/bgm_ending_bad.mp3");
  }, []);

  return { preloadEndingAssets };
}