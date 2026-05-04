import { useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4 Fix] useResourcePreloader — 단계적 리소스 프리로딩
//  [Phase 4 Fix] 캐릭터별 독립 세계관:
//    • 배경: /backgrounds/{slug}/bg_{location}_{time}.png (캐릭터 전용)
//    • 캐릭터: /characters/{slug}/{outfit}_{emotion}.png
//    • BGM: /sounds/characters/{slug}/bgm_daily.mp3 (DAILY만 캐릭터별)
//    • 나머지 BGM/Ambience/SFX는 공유 에셋
//    • availableOutfits/Locations는 서버에서 받아온 데이터 기반
// ═══════════════════════════════════════════════════════════════

const baseUrl = import.meta.env.VITE_ASSET_BASE_URL || "";

const ALL_EMOTIONS = [
  "neutral", "joy", "sad", "angry", "shy", "surprise",
  "panic", "disgust", "relax", "frightened", "flirtatious", "heated",
];

// ── 관계 레벨별 공유 오디오 리소스 ──
const AUDIO_TIERS = {
  STRANGER: {
    bgm: [
      `${baseUrl}/sounds/bgm_romantic.mp3`,
      `${baseUrl}/sounds/bgm_touching.mp3`,
      `${baseUrl}/sounds/bgm_tense.mp3`,
      `${baseUrl}/sounds/bgm_lobby.mp3`,
    ],
    ambience: [
      `${baseUrl}/sounds/amb_birds.mp3`,
      `${baseUrl}/sounds/amb_crickets.mp3`,
      `${baseUrl}/sounds/amb_owl.mp3`,
      `${baseUrl}/sounds/amb_kitchen.mp3`,
      `${baseUrl}/sounds/amb_bathroom.mp3`,
    ],
    sfx: [
      `${baseUrl}/sounds/sfx_door_open.mp3`,
    ],
  },
  ACQUAINTANCE: {
    bgm: [`${baseUrl}/sounds/bgm_exciting.mp3`],
    ambience: [`${baseUrl}/sounds/amb_street.mp3`],
    sfx: [],
  },
  FRIEND: {
    bgm: [],
    ambience: [`${baseUrl}/sounds/amb_beach.mp3`],
    sfx: [`${baseUrl}/sounds/sfx_seagull.mp3`],
  },
  LOVER: {
    bgm: [`${baseUrl}/sounds/bgm_erotic.mp3`],
    ambience: [`${baseUrl}/sounds/amb_bar.mp3`],
    sfx: [],
  },
};

// ── 관계 레벨별 해금되는 기본 시간대 변형 ──
const TIME_VARIANTS = ["day", "night"];
const BEACH_TIMES = ["day", "night", "sunset"];

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
//  [Phase 4 Fix] 캐릭터별 독립 세계관 — availableOutfits/Locations 기반 프리로딩
// ═══════════════════════════════════════════════════════════════

/**
 * @param {string} statusLevel - 현재 관계 레벨
 * @param {boolean} isSecretMode - 시크릿 모드
 * @param {string} characterSlug - 캐릭터 slug (에셋 경로 prefix)
 * @param {string[]} availableOutfits - 서버에서 받은 허용 복장 목록
 * @param {string[]} availableLocations - 서버에서 받은 허용 장소 목록
 * @returns {{ preloadEndingAssets: () => void }}
 */
export default function useResourcePreloader(
  statusLevel,
  isSecretMode = false,
  characterSlug = "airi",
  availableOutfits = [],
  availableLocations = []
) {
  const loadedRef = useRef(new Set());
  const slugRef = useRef(characterSlug);

  // slug 변경 시 ref 갱신 + 기존 캐시 무효화
  useEffect(() => {
    if (slugRef.current !== characterSlug) {
      slugRef.current = characterSlug;
      loadedRef.current.clear();
    }
  }, [characterSlug]);

  const preloadCharacterAssets = useCallback(async () => {
    const slug = slugRef.current;
    const cacheKey = `${slug}_${statusLevel}_${isSecretMode}`;
    if (loadedRef.current.has(cacheKey)) return;
    loadedRef.current.add(cacheKey);

    const startTime = performance.now();

    // 1) 캐릭터 이미지 (허용된 복장 × 12감정) — slug 기반 경로
    const outfits = (availableOutfits || []).map(o => o.toLowerCase());
    const charImages = outfits.flatMap((outfit) =>
      ALL_EMOTIONS.map((emo) => `${baseUrl}/characters/${slug}/${outfit}_${emo}.png`)
    );
    await preloadBatch(charImages, preloadImage, 4);

    // 2) 캐릭터 전용 배경 — slug 기반 경로
    const locations = (availableLocations || []).map(l => l.toLowerCase());
    const bgImages = [`${baseUrl}/backgrounds/${slug}/bg_default.png`];
    for (const loc of locations) {
      const times = (loc === "beach") ? BEACH_TIMES : TIME_VARIANTS;
      for (const t of times) {
        bgImages.push(`${baseUrl}/backgrounds/${slug}/bg_${loc}_${t}.png`);
      }
    }
    await preloadBatch(bgImages, preloadImage, 3);

    // 3) 오디오 (캐릭터별 DAILY BGM + 현재 관계까지의 공유 오디오)
    const allAudio = [`${baseUrl}/sounds/characters/${slug}/bgm_daily.mp3`];
    const currentIdx = RELATION_ORDER.indexOf(statusLevel);
    const targetIdx = isSecretMode ? RELATION_ORDER.length - 1 : (currentIdx >= 0 ? currentIdx : 0);

    for (let i = 0; i <= targetIdx; i++) {
      const tier = AUDIO_TIERS[RELATION_ORDER[i]];
      if (tier) {
        allAudio.push(...tier.bgm, ...tier.ambience, ...tier.sfx);
      }
    }
    await preloadBatch(allAudio, preloadAudio, 2);

    const elapsed = Math.round(performance.now() - startTime);
    const total = charImages.length + bgImages.length + allAudio.length;
    console.log(
      `🎨 [Preloader] ${slug}/${statusLevel}: ${total} assets loaded in ${elapsed}ms`
    );
  }, [statusLevel, isSecretMode, availableOutfits, availableLocations]);

  useEffect(() => {
    if (!statusLevel || !characterSlug) return;

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => preloadCharacterAssets(), { timeout: 3000 });
    } else {
      setTimeout(preloadCharacterAssets, 500);
    }
  }, [statusLevel, isSecretMode, characterSlug, preloadCharacterAssets]);

  const preloadEndingAssets = useCallback(() => {
    const cacheKey = `${slugRef.current}_ENDING`;
    if (loadedRef.current.has(cacheKey)) return;
    loadedRef.current.add(cacheKey);

    console.log("🎨 [Preloader] Pre-loading ending BGM assets");
    preloadAudio(`${baseUrl}/sounds/bgm_ending_happy.mp3`);
    preloadAudio(`${baseUrl}/sounds/bgm_ending_bad.mp3`);
  }, []);

  return { preloadEndingAssets };
}