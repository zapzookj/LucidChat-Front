import { useEffect, useRef, useCallback } from "react";
import { assetUrl } from "../utils/assetUrl";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4] AudioEngine — 동적 청각 엔진
//  [Phase 4.1] BGM 관성 시스템 — 쿨다운 방어선 추가
//  [Phase 4.3] 엔딩 BGM 추가 + 쿨다운 바이패스
//  [Phase 5]   멀티캐릭터 지원:
//    • characterSlug prop → 캐릭터 전용 DAILY BGM
//    • /sounds/characters/{slug}/bgm_daily.mp3
//    • 나머지 BGM/Ambience/SFX는 공유 에셋 (변경 없음)
//
//  [Phase 7-V2 Story] World 기반 DAILY BGM 지원 추가:
//    • worldId prop (V2 전용) — 우선순위: worldId > characterSlug > "airi"
//    • /sounds/worlds/{worldId_lower}/bgm_daily.mp3 (V2 신규 경로)
//    • V1 (Sandbox) 호출은 worldId={undefined}로 기존 character path 그대로 사용
//    • Ambience는 V2에서 location={null}로 비활성 (V2 locationKey ≠ V1 enum)
// ═══════════════════════════════════════════════════════════════

// ─── 공유 BGM 매핑 ───
const SHARED_BGM = Object.fromEntries(
  Object.entries({
    LOBBY:        "/sounds/bgm_lobby.mp3",
    ROMANTIC:     "/sounds/bgm_romantic.mp3",
    EXCITING:     "/sounds/bgm_exciting.mp3",
    TOUCHING:     "/sounds/bgm_touching.mp3",
    TENSE:        "/sounds/bgm_tense.mp3",
    EROTIC:       "/sounds/bgm_erotic.mp3",
    ENDING_HAPPY: "/sounds/bgm_ending_happy.mp3",
    ENDING_BAD:   "/sounds/bgm_ending_bad.mp3",
  }).map(([k, v]) => [k, assetUrl(v)])
);

/**
 * bgmMode + (worldId | characterSlug) → BGM 파일 경로.
 *
 * <p>DAILY 분기 우선순위:
 * <ol>
 *   <li>worldId 있음 (V2 STORY) → /sounds/worlds/{worldId_lower}/bgm_daily.mp3</li>
 *   <li>characterSlug 있음 (V1 SANDBOX) → /sounds/characters/{slug}/bgm_daily.mp3</li>
 *   <li>둘 다 없음 → V1 default ("airi")</li>
 * </ol>
 * 나머지 BGM mode는 공유 자산 (텐션 BGM은 World 무관 보편적).
 */
function resolveBgmSrc(bgmMode, characterSlug, worldId) {
  // [BGM 정책] V2 Daily 이원화 — 세계관별 2종:
  //   DAILY_CALM   → /sounds/worlds/{worldId}/bgm_daily_calm.mp3   (잔잔·조용)
  //   DAILY_BRIGHT → /sounds/worlds/{worldId}/bgm_daily_bright.mp3 (밝음·활기)
  //   DAILY(레거시)는 기존 파일(bgm_daily.mp3) 그대로 — 새 에셋 업로드 전 과도기에도 현행 유지.
  if (bgmMode === "DAILY_CALM" || bgmMode === "DAILY_BRIGHT" || bgmMode === "DAILY") {
    if (worldId) {
      if (bgmMode === "DAILY") {
        return assetUrl(`/sounds/worlds/${String(worldId).toLowerCase()}/bgm_daily.mp3`);
      }
      const variant = bgmMode === "DAILY_BRIGHT" ? "bright" : "calm";
      return assetUrl(`/sounds/worlds/${String(worldId).toLowerCase()}/bgm_daily_${variant}.mp3`);
    }
    // V1 (characterSlug): 기존 단일 daily 유지 — CALM/BRIGHT가 와도 daily로 폴백 (V1 회귀 0)
    const slug = characterSlug || "airi";
    return assetUrl(`/sounds/characters/${slug}/bgm_daily.mp3`);
  }
  return SHARED_BGM[bgmMode] || null;
}

// ─── Ambience 매핑 (V1 Location enum 키 기반) ───
// V2는 location={null}을 넘겨 자동 비활성. V2 locationKey는 World별 임의 문자열이라 매핑 부재.
const AMBIENCE_MAP = Object.fromEntries(
  Object.entries({
    BEACH:      ["/sounds/amb_beach.mp3"],
    KITCHEN:    ["/sounds/amb_kitchen.mp3"],
    DOWNTOWN:   ["/sounds/amb_street.mp3"],
    BAR:        ["/sounds/amb_bar.mp3"],
    BATHROOM:   ["/sounds/amb_bathroom.mp3"],
    GARDEN_DAY:     ["/sounds/amb_birds.mp3"],
    GARDEN_NIGHT:   ["/sounds/amb_crickets.mp3", "/sounds/amb_owl.mp3"],
    BALCONY_DAY:    ["/sounds/amb_birds.mp3"],
    BALCONY_NIGHT:  ["/sounds/amb_crickets.mp3", "/sounds/amb_owl.mp3"],
  }).map(([k, arr]) => [k, arr.map(assetUrl)])
);

// ─── SFX 매핑 (장소 전환 1회) ───
const SFX_MAP = Object.fromEntries(
  Object.entries({
    BAR:       "/sounds/sfx_door_open.mp3",
    BEDROOM:   "/sounds/sfx_door_open.mp3",
    STUDY:     "/sounds/sfx_door_open.mp3",
    LIVINGROOM:"/sounds/sfx_door_open.mp3",
    KITCHEN:   "/sounds/sfx_door_open.mp3",
    BATHROOM:  "/sounds/sfx_door_open.mp3",
    ENTRANCE:  "/sounds/sfx_door_open.mp3",
    BEACH:     "/sounds/sfx_seagull.mp3",
  }).map(([k, v]) => [k, assetUrl(v)])
);

// ─── 볼륨 & 타이밍 상수 ───
const BGM_VOLUME_RATIO = 0.45;
const AMBIENCE_VOLUME_RATIO = 0.25;
const SFX_VOLUME_RATIO = 0.6;
const FADE_DURATION = 1500;
const BGM_COOLDOWN_MS = 30_000;

function fadeOut(audio, duration = FADE_DURATION) {
  if (!audio || audio.paused) return Promise.resolve();

  return new Promise(resolve => {
    const startVol = audio.volume;
    const steps = 20;
    const interval = duration / steps;
    const decrement = startVol / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      audio.volume = Math.max(0, startVol - decrement * step);
      if (step >= steps) {
        clearInterval(timer);
        audio.pause();
        audio.volume = startVol;
        resolve();
      }
    }, interval);
  });
}

function fadeIn(audio, targetVolume, duration = FADE_DURATION) {
  if (!audio) return;

  audio.volume = 0;
  audio.play().catch(() => {});

  const steps = 20;
  const interval = duration / steps;
  const increment = targetVolume / steps;
  let step = 0;

  const timer = setInterval(() => {
    step++;
    audio.volume = Math.min(targetVolume, increment * step);
    if (step >= steps) {
      clearInterval(timer);
    }
  }, interval);
}


/**
 * @param {object} props
 * @param {string} props.bgmMode        — BgmMode enum 문자열 (DAILY / ROMANTIC / TENSE / ENDING_HAPPY ...)
 * @param {string|null} props.location  — V1 Location enum 키. V2는 null 권장 (ambience 비활성)
 * @param {string|null} props.time      — V1 time slot. V2는 dayPartToV1Time(dayPart) 또는 null
 * @param {number} [props.masterVolume=0.5]
 * @param {boolean} [props.isMuted=false]
 * @param {string} [props.characterSlug]  — V1 SANDBOX 전용. DAILY BGM 폴백 슬롯
 * @param {string} [props.worldId]        — V2 STORY 전용. DAILY BGM 우선 슬롯 (있으면 character보다 우선)
 */
const AudioEngine = ({
  bgmMode, location, time,
  masterVolume = 0.5, isMuted = false,
  characterSlug, worldId,
}) => {
  // ── Refs ──
  const bgmRef = useRef(null);
  const bgmModeRef = useRef(null);
  const ambienceRefs = useRef([]);
  const ambienceKeyRef = useRef("");
  const prevLocationRef = useRef(null);
  const masterRef = useRef(masterVolume);
  const mutedRef = useRef(isMuted);
  const bgmLastChangedRef = useRef(0);
  const characterSlugRef = useRef(characterSlug);
  const worldIdRef = useRef(worldId);

  // [Phase 5] characterSlug 변경 시 ref 동기화
  useEffect(() => {
    characterSlugRef.current = characterSlug;
  }, [characterSlug]);

  // [Phase 7-V2] worldId 변경 시 ref 동기화 — characterSlug와 동일 패턴
  useEffect(() => {
    worldIdRef.current = worldId;
  }, [worldId]);

  // masterVolume / isMuted 동기화
  useEffect(() => {
    masterRef.current = masterVolume;

    if (bgmRef.current) {
      const vol = isMuted ? 0 : masterVolume * BGM_VOLUME_RATIO;
      bgmRef.current.volume = vol;
      if (!isMuted && bgmRef.current.paused) {
        bgmRef.current.play().catch(() => {});
      }
    }

    ambienceRefs.current.forEach(a => {
      if (a) {
        a.volume = isMuted ? 0 : masterVolume * AMBIENCE_VOLUME_RATIO;
      }
    });
  }, [masterVolume, isMuted]);

  useEffect(() => {
    mutedRef.current = isMuted;
    if (bgmRef.current) {
      bgmRef.current.volume = isMuted ? 0 : masterRef.current * BGM_VOLUME_RATIO;
    }
    ambienceRefs.current.forEach(a => {
      if (a) {
        a.volume = isMuted ? 0 : masterRef.current * AMBIENCE_VOLUME_RATIO;
      }
    });
  }, [isMuted]);

  // Autoplay Policy 복구
  useEffect(() => {
    const resumeAudio = () => {
      if (bgmRef.current && bgmRef.current.paused && !mutedRef.current) {
        bgmRef.current.play().catch(() => {});
      }
      ambienceRefs.current.forEach(a => {
        if (a && a.paused && !mutedRef.current) {
          a.play().catch(() => {});
        }
      });
      document.removeEventListener("click", resumeAudio);
      document.removeEventListener("touchstart", resumeAudio);
    };

    document.addEventListener("click", resumeAudio, { once: false });
    document.addEventListener("touchstart", resumeAudio, { once: false });

    return () => {
      document.removeEventListener("click", resumeAudio);
      document.removeEventListener("touchstart", resumeAudio);
    };
  }, []);

  // ── L1: BGM 전환 (쿨다운 방어선 포함) ──
  // [Phase 7-V2] resolveBgmSrc에 worldId도 전달 — DAILY 분기에서 우선 적용
  useEffect(() => {
    if (!bgmMode || bgmMode === bgmModeRef.current) return;

    const newSrc = resolveBgmSrc(bgmMode, characterSlugRef.current, worldIdRef.current);
    if (!newSrc) return;

    const isEndingBgm = bgmMode.startsWith("ENDING_");

    const now = Date.now();
    if (bgmModeRef.current !== null && !isEndingBgm) {
      const elapsed = now - bgmLastChangedRef.current;
      if (elapsed < BGM_COOLDOWN_MS) {
        console.log(
          `🎵 [AudioEngine] BGM change BLOCKED by cooldown: ${bgmModeRef.current} → ${bgmMode} (${Math.round(elapsed/1000)}s < ${BGM_COOLDOWN_MS/1000}s)`
        );
        return;
      }
    }

    console.log(
      `🎵 [AudioEngine] BGM switching: ${bgmModeRef.current} → ${bgmMode} ` +
      `(world=${worldIdRef.current || "-"}, slug=${characterSlugRef.current || "-"})`
    );
    bgmModeRef.current = bgmMode;
    bgmLastChangedRef.current = now;

    const switchBgm = async () => {
      if (bgmRef.current) {
        await fadeOut(bgmRef.current);
      }

      const newAudio = new Audio(newSrc);
      newAudio.loop = true;
      newAudio.preload = "auto";
      bgmRef.current = newAudio;

      const targetVol = mutedRef.current ? 0 : masterRef.current * BGM_VOLUME_RATIO;
      fadeIn(newAudio, targetVol);
    };

    switchBgm();
  }, [bgmMode]);

  // ── L2: Ambience 전환 (V1 Location enum 기반 — V2는 location={null}로 자동 비활성) ──
  useEffect(() => {
    if (!location) {
      if (ambienceRefs.current.length > 0) {
        ambienceRefs.current.forEach(a => fadeOut(a, 800));
        ambienceRefs.current = [];
        ambienceKeyRef.current = "";
      }
      return;
    }

    const timeKey = time || "NIGHT";
    const specificKey = `${location}_${timeKey}`;
    const sources = AMBIENCE_MAP[specificKey] || AMBIENCE_MAP[location] || [];
    const newKey = sources.join("|");

    if (newKey === ambienceKeyRef.current) return;
    ambienceKeyRef.current = newKey;

    const oldAmbience = [...ambienceRefs.current];
    oldAmbience.forEach(a => fadeOut(a, 800));
    ambienceRefs.current = [];

    if (sources.length > 0) {
      const targetVol = mutedRef.current ? 0 : masterRef.current * AMBIENCE_VOLUME_RATIO;
      const newAudios = [];

      sources.forEach((src, idx) => {
        const a = new Audio(src);
        a.loop = true;
        a.preload = "auto";
        newAudios.push(a);

        if (idx === 0) {
          fadeIn(a, targetVol, 1000);
        } else {
          setTimeout(() => fadeIn(a, targetVol, 1000), idx * 150);
        }
      });
      ambienceRefs.current = newAudios;
    }
  }, [location, time]);

  // ── L3: SFX (장소 전환 시 1회 재생) ──
  // [Phase6/Tier4 / H-27] SFX Audio 인스턴스 누수 차단.
  //   기존: new Audio(src) → play 후 ref 잃어버림 → ended에도 인스턴스가 메모리에 남음.
  //   개선: sfxRefsArray로 추적 + ended/error 시 src='' + ref 정리 + unmount cleanup.
  const sfxRefsArray = useRef([]);
  useEffect(() => {
    if (!location || location === prevLocationRef.current) return;
    prevLocationRef.current = location;

    const sfxSrc = SFX_MAP[location];
    if (!sfxSrc) return;

    const sfx = new Audio(sfxSrc);
    sfx.volume = mutedRef.current ? 0 : masterRef.current * SFX_VOLUME_RATIO;

    const cleanup = () => {
      try { sfx.src = ''; } catch { /* ignore */ }
      sfxRefsArray.current = sfxRefsArray.current.filter(a => a !== sfx);
    };
    sfx.addEventListener('ended', cleanup, { once: true });
    sfx.addEventListener('error', cleanup, { once: true });
    sfxRefsArray.current.push(sfx);

    sfx.play().catch(() => cleanup());
  }, [location]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current = null;
      }
      ambienceRefs.current.forEach(a => { a.pause(); });
      ambienceRefs.current = [];
      // [Phase6/Tier4 / H-27] SFX 인스턴스 일괄 정리
      sfxRefsArray.current.forEach(a => {
        try { a.pause(); a.src = ''; } catch { /* ignore */ }
      });
      sfxRefsArray.current = [];
    };
  }, []);

  return null;
};

export { resolveBgmSrc };
export default AudioEngine;