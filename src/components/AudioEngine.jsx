import { useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4] AudioEngine — 동적 청각 엔진
//  [Phase 4.1] BGM 관성 시스템 — 쿨다운 방어선 추가
//
//  3-Layer Audio System:
//    L1. BGM       — 감정 테마별 루프 (크로스페이드 + 60초 쿨다운)
//    L2. Ambience  — 장소별 환경음 루프 (페이드 전환)
//    L3. SFX       — 장소 전환 시 1회 효과음
//
//  Props:
//    bgmMode     — BGM 모드 string | null
//    location    — Location enum string | null
//    time        — "DAY" | "NIGHT" | "SUNSET" | null
//    masterVolume — 0~1 (설정에서 조절)
//    isMuted      — boolean (BGM 토글)
// ═══════════════════════════════════════════════════════════════

// ─── BGM 매핑 (7개 테마) ───
const BGM_MAP = {
  LOBBY:    "/sounds/bgm_lobby.mp3",
  DAILY:    "/sounds/bgm_daily.mp3",
  ROMANTIC: "/sounds/bgm_romantic.mp3",
  EXCITING: "/sounds/bgm_exciting.mp3",
  TOUCHING: "/sounds/bgm_touching.mp3",
  TENSE:    "/sounds/bgm_tense.mp3",
  EROTIC:   "/sounds/bgm_erotic.mp3",
};

// ─── Ambience 매핑 (location + time → ambience 배열) ───
const AMBIENCE_MAP = {
  BEACH:      ["/sounds/amb_beach.mp3"],
  KITCHEN:    ["/sounds/amb_kitchen.mp3"],
  DOWNTOWN:   ["/sounds/amb_street.mp3"],
  BAR:        ["/sounds/amb_bar.mp3"],
  BATHROOM:   ["/sounds/amb_bathroom.mp3"],

  GARDEN_DAY:     ["/sounds/amb_birds.mp3"],
  GARDEN_NIGHT:   ["/sounds/amb_crickets.mp3", "/sounds/amb_owl.mp3"],
  BALCONY_DAY:    ["/sounds/amb_birds.mp3"],
  BALCONY_NIGHT:  ["/sounds/amb_crickets.mp3", "/sounds/amb_owl.mp3"],
};

// ─── SFX 매핑 (장소 전환 시 1회 재생) ───
const SFX_MAP = {
  BAR:       "/sounds/sfx_door_open.mp3",
  BEDROOM:   "/sounds/sfx_door_open.mp3",
  STUDY:     "/sounds/sfx_door_open.mp3",
  LIVINGROOM:"/sounds/sfx_door_open.mp3",
  KITCHEN:   "/sounds/sfx_door_open.mp3",
  BATHROOM:  "/sounds/sfx_door_open.mp3",
  ENTRANCE:  "/sounds/sfx_door_open.mp3",
  BEACH:     "/sounds/sfx_seagull.mp3",
};

// ─── 볼륨 & 타이밍 상수 ───
const BGM_VOLUME_RATIO = 0.45;
const AMBIENCE_VOLUME_RATIO = 0.25;
const SFX_VOLUME_RATIO = 0.6;
const FADE_DURATION = 1500;

// [Phase 4.1] BGM 쿨다운 — LLM이 프롬프트를 무시해도 프론트에서 방어
const BGM_COOLDOWN_MS = 60_000; // 60초 이내 BGM 재전환 차단

/**
 * Audio를 부드럽게 페이드 아웃 후 정지
 */
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

/**
 * Audio를 부드럽게 페이드 인
 */
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


const AudioEngine = ({ bgmMode, location, time, masterVolume = 0.5, isMuted = false }) => {
  // ── Refs ──
  const bgmRef = useRef(null);
  const bgmModeRef = useRef(null);
  const ambienceRefs = useRef([]);
  const ambienceKeyRef = useRef("");
  const prevLocationRef = useRef(null);
  const masterRef = useRef(masterVolume);
  const mutedRef = useRef(isMuted);

  // [Phase 4.1] BGM 쿨다운 ref
  const bgmLastChangedRef = useRef(0); // 마지막 BGM 전환 시각 (ms)

  // masterVolume / isMuted 동기화 + [Phase 4.1] Autoplay Policy 복구
  useEffect(() => {
    masterRef.current = masterVolume;

    // BGM: 볼륨 세팅 + unmute 시 paused 상태면 재생 재시도
    if (bgmRef.current) {
      const vol = isMuted ? 0 : masterVolume * BGM_VOLUME_RATIO;
      bgmRef.current.volume = vol;
      if (!isMuted && bgmRef.current.paused) {
        bgmRef.current.play().catch(() => {});
      }
    }

    // Ambience: 동일 로직
    ambienceRefs.current.forEach(a => {
      if (a) {
        a.volume = isMuted ? 0 : masterVolume * AMBIENCE_VOLUME_RATIO;
        if (!isMuted && a.paused) {
          a.play().catch(() => {});
        }
      }
    });
  }, [masterVolume, isMuted]);

  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);

  // [Phase 4.1] Autoplay Policy 복구 — 첫 유저 인터랙션 시 재생 재시도
  // 브라우저가 자동재생을 차단한 경우, 문서 어디든 클릭/터치하면 재생 시도
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
      // 한 번 성공하면 리스너 제거
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
  useEffect(() => {
    if (!bgmMode || bgmMode === bgmModeRef.current) return;

    const newSrc = BGM_MAP[bgmMode];
    if (!newSrc) return;

    // [Phase 4.1] 쿨다운 체크 — 60초 이내 재전환 차단
    // 단, 최초 재생(bgmModeRef.current === null)은 쿨다운 무시
    const now = Date.now();
    if (bgmModeRef.current !== null) {
      const elapsed = now - bgmLastChangedRef.current;
      if (elapsed < BGM_COOLDOWN_MS) {
        console.log(
          `🎵 [AudioEngine] BGM change BLOCKED by cooldown: ${bgmModeRef.current} → ${bgmMode} (${Math.round(elapsed/1000)}s < ${BGM_COOLDOWN_MS/1000}s)`
        );
        return;
      }
    }

    // 쿨다운 통과 → 전환 허용
    console.log(`🎵 [AudioEngine] BGM switching: ${bgmModeRef.current} → ${bgmMode}`);
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

  // ── L2: Ambience 전환 ──
  useEffect(() => {
    if (!location) return;

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

      // 브라우저가 동일 tick에서 여러 Audio.play()를 silent-fail하는 문제 방지
      // 첫 번째는 즉시, 이후는 150ms 간격으로 stagger 재생
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
  useEffect(() => {
    if (!location || location === prevLocationRef.current) return;
    prevLocationRef.current = location;

    const sfxSrc = SFX_MAP[location];
    if (!sfxSrc) return;

    const sfx = new Audio(sfxSrc);
    sfx.volume = mutedRef.current ? 0 : masterRef.current * SFX_VOLUME_RATIO;
    sfx.play().catch(() => {});
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
    };
  }, []);

  return null;
};

export default AudioEngine;