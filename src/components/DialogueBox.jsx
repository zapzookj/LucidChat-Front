import { motion, AnimatePresence } from "framer-motion";
import { Send, History, Heart, Zap, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";

const DialogueBox = ({ 
  characterName, 
  scene, // 현재 컷신 정보 { narration, dialogue, emotion }
  onSend, 
  isTyping, 
  onOpenHistory, 
  affection, 
  energy,
  onNextScene, // 다음 씬으로 넘기는 함수
  hasNextScene // 다음 씬이 남아있는지 여부
}) => {
  const [input, setInput] = useState("");

  // 씬이 바뀌면 입력창 초기화 등의 효과를 줄 수 있음
  const { narration, dialogue } = scene || {};

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping || hasNextScene) return; // 컷신 재생 중엔 입력 불가
    onSend(input);
    setInput("");
  };

  // 컷신 진행 (화면 터치/클릭)
  const handleBoxClick = () => {
    if (hasNextScene) {
      onNextScene();
    }
  };

  return (
    <div className="absolute bottom-0 w-full z-20 p-4 pb-8 flex justify-center">
      <div className="w-full max-w-4xl flex flex-col gap-3">
        
        {/* [NEW] 상단 정보바 (호감도, 에너지, 히스토리) */}
        <div className="flex justify-end items-center px-2 gap-3">
          
          {/* 호감도 배지 */}
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-pink-500/30 text-pink-300 shadow-lg">
            <Heart size={16} fill="currentColor" className="animate-pulse" />
            <span className="text-sm font-bold tracking-wide">{affection}</span>
          </div>

          {/* 에너지 배지 */}
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-yellow-400/30 text-yellow-300 shadow-lg">
            <Zap size={16} fill="currentColor" />
            <span className="text-sm font-bold tracking-wide">{energy}</span>
          </div>

          {/* 히스토리 버튼 */}
          <button 
            onClick={onOpenHistory}
            className="bg-black/40 backdrop-blur-md p-2 rounded-full text-white/80 hover:bg-white/20 transition border border-white/10 shadow-lg"
            title="지난 대화"
          >
            <History size={20} />
          </button>
        </div>

        {/* 메인 대화창 (클릭 시 다음 씬으로 넘어감) */}
        <motion.div 
          onClick={handleBoxClick}
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`relative bg-black/50 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 pt-10 shadow-2xl transition-all ${hasNextScene ? 'cursor-pointer hover:bg-black/60' : ''}`}
        >
          {/* 캐릭터 이름표 */}
          <div className="absolute -top-5 left-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold px-8 py-2 rounded-2xl shadow-lg border border-white/20 transform -rotate-1 z-20">
            {characterName}
          </div>

          {/* [NEW] 나레이션 (지문) 영역 - 컷신이 있을 때만 표시 */}
          <AnimatePresence mode="wait">
            {narration && (
              <motion.div
                key={narration}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-3 text-sm text-pink-200/90 font-medium italic flex items-center gap-2"
              >
                <span>* {narration}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 대사 출력 영역 */}
          <div className="min-h-[3.5rem] text-lg text-white/95 leading-relaxed font-medium drop-shadow-md tracking-wide">
            {isTyping ? (
               <div className="flex gap-1 mt-2 items-center h-full opacity-70">
                 <span className="w-2 h-2 bg-white rounded-full animate-bounce"/>
                 <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-100"/>
                 <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-200"/>
                 <span className="ml-2 text-sm text-white/50">생각하는 중...</span>
               </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.span
                  key={dialogue} // 대사가 바뀔 때마다 페이드인
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {dialogue || "..."}
                </motion.span>
              </AnimatePresence>
            )}
          </div>

          {/* 다음 씬 유도 아이콘 (컷신 진행 중일 때) */}
          {hasNextScene && (
            <motion.div 
              animate={{ x: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="absolute bottom-6 right-6 text-white/50"
            >
              <ChevronRight size={24} />
            </motion.div>
          )}

          {/* 입력 폼 (컷신이 끝났을 때만 보임) */}
          {!hasNextScene && (
            <motion.form 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onSubmit={handleSubmit} 
              className="mt-4 flex gap-3 relative z-10"
            >
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="대화를 입력하세요..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white placeholder-white/40 focus:bg-white/10 focus:border-pink-500/50 transition duration-300 shadow-inner"
              />
              <button 
                type="submit"
                disabled={isTyping || !input.trim()}
                className="bg-gradient-to-br from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white p-3.5 rounded-xl transition shadow-lg disabled:opacity-50 disabled:grayscale transform active:scale-95"
              >
                <Send size={22} />
              </button>
            </motion.form>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default DialogueBox;