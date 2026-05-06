import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Download, X, Image, Filter, Sparkles } from 'lucide-react';
import api from '../api/axios';
import { sfx } from '../utils/sfx';

/**
 * [Phase 5.5-Illust] 일러스트 갤러리 페이지
 *
 * 유저가 실시간 생성한 모든 캐릭터 일러스트를 열람.
 * - 전체/캐릭터별 필터
 * - 썸네일 그리드 → 클릭 시 풀스크린 뷰어
 * - 다운로드 링크
 *
 * 진입점: AchievementGallery 또는 설정 모달에서 링크
 */

const IllustrationGalleryPage = ({ isOpen, onClose, characters = [] }) => {
  const [illustrations, setIllustrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChar, setSelectedChar] = useState(null); // null = 전체
  const [viewerImage, setViewerImage] = useState(null); // 풀스크린 뷰어

  // ━━━ 갤러리 로드 ━━━
  const loadGallery = useCallback(async (characterId) => {
    setLoading(true);
    try {
      const params = characterId ? { characterId } : {};
      const res = await api.get('/illustrations/gallery', { params });
      setIllustrations(res.data || []);
    } catch (err) {
      console.error('Gallery load failed:', err);
      setIllustrations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadGallery(selectedChar);
    }
  }, [isOpen, selectedChar, loadGallery]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[250] flex flex-col"
        style={{ background: 'linear-gradient(180deg, #0a0614 0%, #120a24 100%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <button onClick={onClose} className="text-white/50 hover:text-white transition">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-white font-bold text-lg flex items-center gap-2">
            <Sparkles size={18} className="text-purple-400" />
            일러스트 갤러리
          </h1>
          <div className="w-6" /> {/* 스페이서 */}
        </div>

        {/* ═══ 캐릭터 필터 탭 ═══ */}
        <div className="px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedChar(null)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition ${
                selectedChar === null
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-white/40 hover:bg-white/10'
              }`}
            >
              전체
            </button>
            {characters.map((char) => (
              <button
                key={char.id}
                onClick={() => setSelectedChar(char.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition ${
                  selectedChar === char.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                {char.name}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ 갤러리 그리드 ═══ */}
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <motion.div
                className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          ) : illustrations.length === 0 ? (
            <div className="text-center py-20">
              <Image size={48} className="text-white/10 mx-auto mb-4" />
              <p className="text-white/30 text-sm">아직 수집된 일러스트가 없습니다</p>
              <p className="text-white/15 text-xs mt-1">대화 중 특별한 순간에 일러스트를 생성해보세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {illustrations.map((illust, idx) => (
                <motion.div
                  key={illust.id}
                  className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group"
                  style={{
                    border: '1px solid rgba(255,255,255,0.06)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => { sfx.click(); setViewerImage(illust); }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <img
                    src={illust.imageUrl}
                    alt={`${illust.characterName} illustration`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* 오버레이 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-white text-xs font-bold">{illust.characterName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {illust.triggerType === 'PROMOTION' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">승급</span>
                        )}
                        {illust.triggerType === 'ENDING' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">엔딩</span>
                        )}
                        {illust.triggerType === 'MANUAL' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">수동</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ 풀스크린 뷰어 ═══ */}
        <AnimatePresence>
          {viewerImage && (
            <motion.div
              className="fixed inset-0 z-[300] bg-black flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { sfx.click(); setViewerImage(null); }}
            >
              <button
                className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white"
                onClick={() => { sfx.click(); setViewerImage(null); }}
              >
                <X size={20} />
              </button>

              <motion.img
                src={viewerImage.imageUrl}
                alt={`${viewerImage.characterName} illustration`}
                className="max-w-full max-h-full object-contain"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
              />

              {/* 하단 정보 */}
              <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 to-transparent">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-white font-bold">{viewerImage.characterName}</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {viewerImage.createdAt?.split('T')[0]}
                      {viewerImage.emotion && ` · ${viewerImage.emotion}`}
                    </p>
                  </div>
                  <a
                    href={viewerImage.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 text-white/80 text-xs hover:bg-white/20 transition"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download size={14} />
                    다운로드
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default IllustrationGalleryPage;