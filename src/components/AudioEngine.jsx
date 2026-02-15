import { useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
//  [Phase 4] AudioEngine — 동적 청각 엔진
//
//  3-Layer Audio System:
//    L1. BGM       — 감정 테마별 루프 (크로스페이드 전환)
//    L2. Ambience  — 장소별 환경음 루프 (페이드 전환)
//    L3. SFX       — 장소 전환 시 1회 효과음
//
//  Props:
//    bgmMode     — "ROMANTIC" | "EXCITING" | "TOUCHING" | "TENSE" | null
//    location    — Location enum string | null
//    time        — "DAY" | "NIGHT" | "SUNSET" | null
//    masterVolume — 0~1 (설정에서 조절)
//    isMuted      — boolean (BGM 토글)
// ═══════════════════════════════════════════════════════════════

// ─── BGM 매핑 ───
const BGM_MAP = {
  LOBBY:    "/sounds/bgm_lobby.mp3",
  DAILY:    "/sounds/bgm_daily.mp3",
  ROMANTIC: "/sounds/bgm_romantic.mp3",
  EXCITING: "/sounds/bgm_exciting.mp3",
  TOUCHING: "/sounds/bgm_touching.mp3",
  TENSE:    "/sounds/bgm_tense.mp3",
};

// ─── Ambience 매핑 (location + time → ambience 배열) ───
// 여러 엠비언스를 동시에 재생할 수 있음 (예: 정원 밤 = 귀뚜라미 + 올빼미)
const AMBIENCE_MAP = {
  BEACH:      ["/sounds/amb_beach.mp3"],
  KITCHEN:    ["/sounds/amb_kitchen.mp3"],
  DOWNTOWN:   ["/sounds/amb_street.mp3"],
  BAR:        ["/sounds/amb_bar.mp3"],
  BATHROOM:   ["/sounds/amb_bathroom.mp3"],

  // 정원/발코니: 시간대에 따라 다른 엠비언스
  GARDEN_DAY:     ["/sounds/amb_birds.mp3"],
  GARDEN_NIGHT:   ["/sounds/amb_crickets.mp3", "/sounds/amb_owl.mp3"],
  BALCONY_DAY:    ["/sounds/amb_birds.mp3"],
  BALCONY_NIGHT:  ["/sounds/amb_crickets.mp3", "/sounds/amb_owl.mp3"],
};

// ─── SFX 매핑 (장소 전환 시 1회 재생) ───
const SFX_MAP = {
  // 실내 진입 시 문 열리는 소리
  BAR:       "/sounds/sfx_door_open.mp3",
  BEDROOM:   "/sounds/sfx_door_open.mp3",
  STUDY:     "/sounds/sfx_door_open.mp3",
  LIVINGROOM:"/sounds/sfx_door_open.mp3",
  KITCHEN:   "/sounds/sfx_door_open.mp3",
  BATHROOM:  "/sounds/sfx_door_open.mp3",
  ENTRANCE:  "/sounds/sfx_door_open.mp3",

  // 해변: 갈매기
  BEACH:     "/sounds/sfx_seagull.mp3",
};

// ─── 볼륨 상수 ───
const BGM_VOLUME_RATIO = 0.45;      // master 대비 BGM 비율
const AMBIENCE_VOLUME_RATIO = 0.25;  // master 대비 엠비언스 비율
const SFX_VOLUME_RATIO = 0.6;       // master 대비 SFX 비율
const FADE_DURATION = 1500;          // 크로스페이드 시간 (ms)

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
        audio.volume = startVol; // 복원 (재사용 대비)
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
  const bgmRef = useRef(null);           // 현재 BGM Audio
  const bgmModeRef = useRef(null);       // 현재 BGM 모드 (중복 방지)
  const ambienceRefs = useRef([]);        // 현재 Ambience Audio 배열
  const ambienceKeyRef = useRef("");      // 현재 Ambience 키 (중복 방지)
  const prevLocationRef = useRef(null);   // 이전 location (SFX 트리거용)
  const masterRef = useRef(masterVolume);
  const mutedRef = useRef(isMuted);

  // masterVolume / isMuted 동기화
  useEffect(() => {
    masterRef.current = masterVolume;
    if (bgmRef.current) {
      bgmRef.current.volume = isMuted ? 0 : masterVolume * BGM_VOLUME_RATIO;
    }
    ambienceRefs.current.forEach(a => {
      if (a) a.volume = isMuted ? 0 : masterVolume * AMBIENCE_VOLUME_RATIO;
    });
  }, [masterVolume, isMuted]);

  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);

  // ── L1: BGM 전환 ──
  useEffect(() => {
    if (!bgmMode || bgmMode === bgmModeRef.current) return;
    bgmModeRef.current = bgmMode;

    const newSrc = BGM_MAP[bgmMode];
    if (!newSrc) return;

    const switchBgm = async () => {
      // 기존 BGM 페이드 아웃
      if (bgmRef.current) {
        await fadeOut(bgmRef.current);
      }

      // 새 BGM 생성 및 페이드 인
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

    // location+time 조합으로 ambience 키 결정
    const timeKey = time || "NIGHT";
    const specificKey = `${location}_${timeKey}`;
    const sources = AMBIENCE_MAP[specificKey] || AMBIENCE_MAP[location] || [];
    const newKey = sources.join("|");

    if (newKey === ambienceKeyRef.current) return;
    ambienceKeyRef.current = newKey;

    // 기존 ambience 모두 페이드 아웃
    const oldAmbience = [...ambienceRefs.current];
    oldAmbience.forEach(a => fadeOut(a, 800).then(() => { /* GC 대기 */ }));
    ambienceRefs.current = [];

    // 새 ambience 페이드 인
    if (sources.length > 0) {
      const targetVol = mutedRef.current ? 0 : masterRef.current * AMBIENCE_VOLUME_RATIO;
      const newAudios = sources.map(src => {
        const a = new Audio(src);
        a.loop = true;
        a.preload = "auto";
        fadeIn(a, targetVol, 1000);
        return a;
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

  // 렌더링 없음 (순수 로직 컴포넌트)
  return null;
};

export default AudioEngine;