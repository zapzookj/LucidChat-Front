import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Download, X, Loader2, ImageIcon } from 'lucide-react';
import api from '../api/axios';

/**
 * [Phase 5.5-Illust] 실시간 캐릭터 일러스트 생성 모달
 *
 * 흐름:
 *   1. LLM이 generate_illustration: true → DialogueBox에 "✨ 일러스트 생성" 버튼 표시
 *   2. 유저 클릭 → 에너지 10 소모 → POST /illustrations/generate
 *   3. 생성 중: 화려한 로딩 애니메이션
 *   4. 완료: 풀스크린 일러스트 표시 + 갤러리 저장 완료 알림
 *
 * Props:
 *   isOpen          - 모달 표시 여부
 *   onClose         - 닫기 콜백
 *   roomId          - 현재 채팅방 ID
 *   characterName   - 캐릭터 이름 (표시용)
 *   energy          - 현재 에너지 (10 미만이면 비활성)
 *   onEnergyUpdate  - 에너지 갱신 콜백
 */
const POLL_INTERVAL = 1500; // 1.5초
const MAX_POLL_COUNT = 50;  // 최대 75초

const IllustrationModal = ({
  isOpen, onClose, roomId, characterName, energy, onEnergyUpdate
}) => {
  const [status, setStatus] = useState('idle'); // idle | generating | completed | error
  const [requestId, setRequestId] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef(null);
  const pollCountRef = useRef(0);

  // ━━━ 생성 요청 ━━━
  const handleGenerate = useCallback(async () => {
    if (energy < 10) return;

    setStatus('generating');
    setImageUrl(null);
    setErrorMsg('');
    pollCountRef.current = 0;

    try {
      const res = await api.post('/illustrations/generate', { roomId });
      const { requestId: reqId } = res.data;
      setRequestId(reqId);
      onEnergyUpdate?.(-10);
      startPolling(reqId);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.message || '생성 요청에 실패했습니다.');
    }
  }, [roomId, energy, onEnergyUpdate]);

  // ━━━ 폴링 ━━━
  const startPolling = useCallback((reqId) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      pollCountRef.current++;

      if (pollCountRef.current > MAX_POLL_COUNT) {
        clearInterval(pollRef.current);
        setStatus('error');
        setErrorMsg('생성 시간이 초과되었습니다. 갤러리에서 확인해주세요.');
        return;
      }

      try {
        const res = await api.get(`/api/v1/illustrations/status/${reqId}`);
        const { status: s, imageUrl: url } = res.data;

        if (s === 'COMPLETED' && url) {
          clearInterval(pollRef.current);
          setImageUrl(url);
          setStatus('completed');
        } else if (s === 'FAILED') {
          clearInterval(pollRef.current);
          setStatus('error');
          setErrorMsg(res.data.errorMessage || '이미지 생성에 실패했습니다.');
        }
      } catch {
        // 폴링 실패는 무시하고 재시도
      }
    }, POLL_INTERVAL);
  }, []);

  // 클린업
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // 모달 닫힐 때 리셋
  useEffect(() => {
    if (!isOpen) {
      setStatus('idle');
      setRequestId(null);
      setImageUrl(null);
      setErrorMsg('');
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* 배경 오버레이 */}
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          onClick={status !== 'generating' ? onClose : undefined}
        />

        <motion.div
          className="relative z-10 w-[95vw] max-w-lg"
          initial={{ scale: 0.9, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 30 }}
        >
          {/* ═══ IDLE: 생성 확인 ═══ */}
          {status === 'idle' && (
            <div
              className="rounded-2xl p-6 text-center"
              style={{
                background: 'linear-gradient(145deg, rgba(15,10,35,0.97), rgba(30,15,60,0.95))',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
              }}
            >
              <motion.div
                className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(244,114,182,0.2))',
                  border: '1px solid rgba(168,85,247,0.3)',
                }}
                animate={{ boxShadow: ['0 0 20px rgba(168,85,247,0.2)', '0 0 40px rgba(244,114,182,0.3)', '0 0 20px rgba(168,85,247,0.2)'] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles size={36} className="text-purple-300" />
              </motion.div>

              <h2 className="text-xl font-bold text-white mb-2">실시간 일러스트 생성</h2>
              <p className="text-white/50 text-sm mb-1">
                지금 이 순간의 {characterName}을(를) 일러스트로 남깁니다.
              </p>
              <p className="text-purple-300/70 text-xs mb-6">
                에너지 10 소모 · 갤러리에 영구 보관됩니다
              </p>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 transition text-sm"
                >
                  다음에
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={energy < 10}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
                    energy >= 10
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20'
                      : 'bg-white/5 text-white/20 cursor-not-allowed'
                  }`}
                >
                  <Sparkles size={16} />
                  {energy >= 10 ? '생성하기' : '에너지 부족'}
                </button>
              </div>
            </div>
          )}

          {/* ═══ GENERATING: 로딩 ═══ */}
          {status === 'generating' && (
            <div className="rounded-2xl p-8 text-center" style={{
              background: 'linear-gradient(145deg, rgba(15,10,35,0.97), rgba(30,15,60,0.95))',
              border: '1px solid rgba(168,85,247,0.2)',
            }}>
              <motion.div
                className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center relative"
                style={{ background: 'rgba(168,85,247,0.1)' }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-purple-400/30 border-t-purple-400"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
                <ImageIcon size={32} className="text-purple-300" />
              </motion.div>

              <motion.p
                className="text-white/70 text-sm mb-2"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {characterName}의 일러스트를 그리는 중...
              </motion.p>
              <p className="text-white/30 text-xs">
                약 10~30초 소요됩니다
              </p>

              {/* 프로그레스 바 (시각적 피드백) */}
              <div className="mt-6 h-1 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                  initial={{ width: '0%' }}
                  animate={{ width: '90%' }}
                  transition={{ duration: 45, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}

          {/* ═══ COMPLETED: 결과 표시 ═══ */}
          {status === 'completed' && imageUrl && (
            <motion.div
              className="rounded-2xl overflow-hidden relative"
              style={{
                border: '1px solid rgba(168,85,247,0.3)',
                boxShadow: '0 0 60px rgba(168,85,247,0.15)',
              }}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white transition"
              >
                <X size={20} />
              </button>

              <img
                src={imageUrl}
                alt={`${characterName} illustration`}
                className="w-full max-h-[80vh] object-contain bg-black/90"
              />

              <div className="p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent absolute bottom-0 left-0 right-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/50 text-xs mb-1">갤러리에 저장 완료</p>
                    <p className="text-white font-bold text-sm">{characterName}의 순간</p>
                  </div>
                  <a
                    href={imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 text-white/80 text-xs hover:bg-white/20 transition"
                  >
                    <Download size={14} />
                    저장
                  </a>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ ERROR ═══ */}
          {status === 'error' && (
            <div className="rounded-2xl p-6 text-center" style={{
              background: 'linear-gradient(145deg, rgba(15,10,35,0.97), rgba(30,15,60,0.95))',
              border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <div className="text-3xl mb-4">😔</div>
              <h3 className="text-white font-bold mb-2">생성 실패</h3>
              <p className="text-white/50 text-sm mb-4">{errorMsg}</p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-white/10 text-white/70 text-sm hover:bg-white/20 transition"
              >
                닫기
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default IllustrationModal;