import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sfx } from '../utils/sfx';
import api from '../api/axios';

/**
 * [Phase 5.5-Illust] 장소 전환 연출 컴포넌트
 *
 * 새로운 장소로 이동할 때:
 *   1. 화면 암전 (fade to black)
 *   2. "새로운 장소로 이동 중..." 타자기 효과 (3~5초)
 *   3. 배경 이미지 로딩 대기
 *   4. 배경 표시 + 페이드 인
 *
 * Props:
 *   active            - 전환 진행 중 여부
 *   locationName      - 이동할 장소 이름 (한글)
 *   backgroundUrl     - 배경 이미지 URL (캐시 히트 시 즉시 전달, 생성 중이면 null)
 *   cacheHash         - 폴링용 해시 키 (배경 생성 중일 때)
 *   isGenerating      - 배경 생성 진행 중 여부
 *   onTransitionComplete - 전환 완료 콜백 (배경 URL 전달)
 */

const TYPEWRITER_SPEED = 60; // ms per character
const MIN_DISPLAY_TIME = 3000; // 최소 3초 표시

const LocationTransition = ({
  active,
  locationName,
  backgroundUrl,
  cacheHash,
  isGenerating,
  onTransitionComplete,
}) => {
  const [phase, setPhase] = useState('idle'); // idle | blackout | typing | waiting | fadein
  const [displayedText, setDisplayedText] = useState('');
  const [resolvedBgUrl, setResolvedBgUrl] = useState(null);
  const startTimeRef = useRef(null);
  const pollRef = useRef(null);

  const transitionText = locationName
    ? `${locationName}(으)로 이동하는 중...`
    : '새로운 장소로 이동 중...';

  // ━━━ 전환 시작 ━━━
  useEffect(() => {
    if (active && phase === 'idle') {
      setPhase('blackout');
      sfx.wooshDeep();
      startTimeRef.current = Date.now();
      setDisplayedText('');
      setResolvedBgUrl(backgroundUrl || null);

      // 0.5초 후 타자기 시작
      setTimeout(() => setPhase('typing'), 500);
    }
    if (!active && phase !== 'idle') {
      cleanup();
      setPhase('idle');
    }
  }, [active]);

  // ━━━ 타자기 효과 ━━━
  useEffect(() => {
    if (phase !== 'typing') return;

    let i = 0;
    const text = transitionText;
    const interval = setInterval(() => {
      i++;
      setDisplayedText(text.substring(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setPhase('waiting');
      }
    }, TYPEWRITER_SPEED);

    return () => clearInterval(interval);
  }, [phase, transitionText]);

  // ━━━ 배경 URL이 즉시 있으면 최소 시간 후 완료 ━━━
  useEffect(() => {
    if (backgroundUrl && !resolvedBgUrl) {
      setResolvedBgUrl(backgroundUrl);
    }
  }, [backgroundUrl]);

  // ━━━ 대기 단계: 배경 URL 확보 + 최소 표시 시간 충족 시 전환 완료 ━━━
  useEffect(() => {
    if (phase !== 'waiting') return;

    const checkReady = () => {
      const elapsed = Date.now() - (startTimeRef.current || Date.now());
      const hasBackground = resolvedBgUrl != null;
      const minTimeMet = elapsed >= MIN_DISPLAY_TIME;

      if (hasBackground && minTimeMet) {
        setPhase('fadein');
        sfx.chime();
        setTimeout(() => {
          onTransitionComplete?.(resolvedBgUrl);
          setPhase('idle');
        }, 1000); // 페이드인 시간
        return true;
      }

      // 배경 없이 10초 이상 → 폴백 (배경 없이 전환)
      if (elapsed >= 15000) {
        setPhase('fadein');
        sfx.chime();
        setTimeout(() => {
          onTransitionComplete?.(null);
          setPhase('idle');
        }, 1000);
        return true;
      }

      return false;
    };

    if (!checkReady()) {
      const interval = setInterval(() => {
        if (checkReady()) clearInterval(interval);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [phase, resolvedBgUrl, onTransitionComplete]);

  // ━━━ 배경 생성 폴링 (캐시 미스 시) ━━━
  // 백엔드는 캐시 미스면 비동기로 배경을 생성·캐싱하지만 완성을 푸시하지 않는다.
  // cacheHash로 /illustrations/background를 폴링하여 완성되면 resolvedBgUrl을 채운다.
  // (resolvedBgUrl이 채워지면 위의 waiting useEffect의 checkReady가 전환을 마무리한다.)
  useEffect(() => {
    // 이미 URL이 있거나, 생성 중이 아니거나, 폴링 키가 없으면 폴링 불필요
    if (resolvedBgUrl || !isGenerating || !cacheHash) return;
    if (phase === 'idle' || phase === 'fadein') return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await api.get('/illustrations/background', {
          params: { cacheHash },
        });
        if (cancelled) return;
        if (res?.data?.ready && res.data.url) {
          setResolvedBgUrl(res.data.url);
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch (e) {
        // 네트워크 일시 오류는 무시하고 다음 tick에 재시도
        // (waiting useEffect의 15초 폴백이 최종 안전망)
      }
    };

    // 즉시 1회 + 1초 간격 폴링
    poll();
    pollRef.current = setInterval(poll, 1000);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isGenerating, cacheHash, resolvedBgUrl, phase]);

  const cleanup = () => {
    if (pollRef.current) clearInterval(pollRef.current);
  };

  useEffect(() => () => cleanup(), []);

  if (phase === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[300] flex flex-col items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'fadein' ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: phase === 'fadein' ? 1 : 0.5 }}
        style={{ backgroundColor: 'black' }}
      >
        {/* 배경 프리로드 (숨김) */}
        {resolvedBgUrl && (
          <img
            src={resolvedBgUrl}
            alt=""
            className="hidden"
            onLoad={() => {/* 프리로드 완료 */}}
          />
        )}

        {/* 장소 이동 텍스트 */}
        <div className="text-center px-8">
          {/* 위치 아이콘 */}
          <motion.div
            className="mb-8"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <span className="text-xl">🚶</span>
            </div>
          </motion.div>

          {/* 타자기 텍스트 */}
          <p className="text-white/70 text-lg tracking-wider" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            {displayedText}
            {(phase === 'typing') && (
              <motion.span
                className="inline-block w-0.5 h-5 bg-white/50 ml-0.5 align-middle"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
          </p>

          {/* 생성 중 표시 */}
          {isGenerating && phase === 'waiting' && (
            <motion.p
              className="text-white/30 text-xs mt-4 tracking-widest"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              새로운 풍경을 그리는 중...
            </motion.p>
          )}
        </div>

        {/* 하단 진행 바 */}
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-32">
          <div className="h-px bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white/20 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: phase === 'fadein' ? '100%' : '70%' }}
              transition={{ duration: phase === 'fadein' ? 0.5 : 8, ease: 'easeOut' }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LocationTransition;