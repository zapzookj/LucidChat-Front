import { motion, AnimatePresence } from "framer-motion";
import { Send, History, Heart, Zap, ChevronRight, Battery } from "lucide-react";
import { useState, useEffect, useRef } from "react";

const DialogueBox = ({ 
  characterName, 
  scene, 
  onSend, 
  isTyping, 
  onOpenHistory, 
  affection, 
  energy,
  onNextScene, 
  hasNextScene,
  nickname 
}) => {
  const [input, setInput] = useState("");

  // [Typewriter 상태]
  const [displayedText, setDisplayedText] = useState("");
  const [isTextFullyDisplayed, setIsTextFullyDisplayed] = useState(false);

  // [호감도 애니메이션 상태]
  const prevAffection = useRef(affection);
  const [affectionDiff, setAffectionDiff] = useState(null);

  // 1. 호감도 변화 감지 (+5 팝업)
  useEffect(() => {
    if (prevAffection.current !== affection) {
      const diff = affection - prevAffection.current;
      if (diff !== 0) {
        setAffectionDiff({ value: diff, id: Date.now() });
        setTimeout(() => setAffectionDiff(null), 2000);
      }
      prevAffection.current = affection;
    }
  }, [affection]);

  // 2. Typewriter Effect (로직 개선)
  useEffect(() => {
    // 씬이나 대사가 없으면 초기화
    if (!scene?.dialogue) {
      setDisplayedText("");
      setIsTextFullyDisplayed(true);
      return;
    }

    // 초기화
    setDisplayedText("");
    setIsTextFullyDisplayed(false);
    
    const fullText = scene.dialogue;
    let charIndex = 0; // 현재 출력할 글자 수

    // [핵심 수정] 한 글자씩 더하는 게 아니라(prev + char), 0번부터 N번까지 잘라서(slice) 보여줌
    // -> 'undefined' 오류와 글자 꼬임 방지
    const typingInterval = setInterval(() => {
      charIndex++;
      setDisplayedText(fullText.slice(0, charIndex));

      if (charIndex >= fullText.length) {
        clearInterval(typingInterval);
        setIsTextFullyDisplayed(true);
      }
    }, 30); // 타이핑 속도

    return () => clearInterval(typingInterval);
  }, [scene]); // scene이 바뀔 때만 재실행

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping || hasNextScene) return;
    onSend(input);
    setInput("");
  };

  // 텍스트 박스 클릭 핸들러 (스킵 or 다음 씬)
  const handleBoxClick = () => {
    if (scene?.dialogue && !isTextFullyDisplayed) {
      // 타이핑 중이면 즉시 전체 출력 (스킵)
      setDisplayedText(scene.dialogue);
      setIsTextFullyDisplayed(true);
    } else if (hasNextScene) {
      // 다 떴으면 다음 씬으로
      onNextScene();
    }
  };

  return (
    <div className="absolute bottom-0 w-full z-20 p-4 pb-8 flex justify-center">
      <div className="w-full max-w-4xl flex flex-col gap-3">
        
        {/* 상단 정보바 (호감도, 에너지, 히스토리) */}
        <div className="flex justify-end items-center px-2 gap-3 relative">
          
          {/* 1. 호감도 배지 (Tooltip + Gauge) */}
          <div className="relative group cursor-help">
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-pink-500/30 shadow-lg">
              
              {/* 차오르는 하트 아이콘 */}
              <div className="relative w-4 h-4">
                <Heart className="absolute inset-0 text-gray-600" size={16} />
                <div 
                  className="absolute inset-0 overflow-hidden"
                  style={{ clipPath: `inset(${100 - Math.max(0, Math.min(100, affection))}% 0 0 0)` }}
                >
                  <Heart size={16} className="fill-pink-500 text-pink-500" />
                </div>
              </div>
              
              <span className="text-sm font-bold tracking-wide text-pink-300">{affection}%</span>
            </div>

            {/* 호감도 변화 팝업 (+5) */}
            <AnimatePresence>
              {affectionDiff && (
                <motion.div
                  key={affectionDiff.id}
                  initial={{ opacity: 0, y: 0, scale: 0.5 }}
                  animate={{ opacity: 1, y: -20, scale: 1.1 }}
                  exit={{ opacity: 0, y: -30 }}
                  className={`absolute -top-6 left-2 font-black text-sm pointer-events-none ${
                    affectionDiff.value > 0 ? 'text-pink-400' : 'text-blue-400'
                  }`}
                >
                  {affectionDiff.value > 0 ? `+${affectionDiff.value}` : affectionDiff.value}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 호감도 툴팁 */}
            <div className="absolute bottom-full right-0 mb-2 w-64 bg-black/90 border border-pink-500/20 p-4 rounded-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-xl backdrop-blur-sm">
               <p className="font-bold text-pink-300 mb-2">{characterName}의 {nickname}님을 향한 호감도</p>
               <ul className="space-y-1 text-gray-400">
                 <li>-100 ~ -1  : 싫어하는 사람</li>
                 <li>  0  ~  20 : 낯선 사람</li>
                 <li>  21 ~  40 : 지인</li>
                 <li>  41 ~  70 : 친구</li>
                 <li>  71 ~ 100 : 사랑</li>
               </ul>
            </div>
          </div>

          {/* 2. 에너지 배지 (Tooltip) */}
          <div className="relative group cursor-help">
            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-yellow-400/30 text-yellow-300 shadow-lg">
              <Zap size={16} fill="currentColor" />
              <span className="text-sm font-bold tracking-wide">{energy}</span>
            </div>

            {/* 에너지 툴팁 */}
            <div className="absolute bottom-full right-0 mb-2 w-64 bg-black/90 border border-yellow-500/20 p-4 rounded-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-xl backdrop-blur-sm">
               <p className="font-bold text-yellow-300 mb-2">{characterName}의 피로도</p>
               <p className="leading-relaxed text-gray-400">
                 10분에 1씩 회복되며 대화를 하면 피로도가 1 감소합니다. 피로도가 0이 되면 대화가 불가능합니다.
               </p>
            </div>
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

        {/* 메인 대화창 (클릭 시 다음 씬으로 넘어감 / 스킵) */}
        <motion.div 
          onClick={handleBoxClick}
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`relative bg-black/50 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 pt-10 shadow-2xl transition-all ${hasNextScene || (!isTextFullyDisplayed && scene?.dialogue) ? 'cursor-pointer hover:bg-black/60' : ''}`}
        >
          {/* 캐릭터 이름표 */}
          <div className="absolute -top-5 left-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold px-8 py-2 rounded-2xl shadow-lg border border-white/20 transform -rotate-1 z-20">
            {characterName}
          </div>

          {/* 나레이션 (지문) 영역 */}
          <AnimatePresence mode="wait">
            {scene?.narration && (
              <motion.div
                key={scene.narration}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-3 text-sm text-pink-200/90 font-medium italic flex items-center gap-2"
              >
                <span>* {scene.narration}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 대사 출력 영역 */}
          <div className="min-h-[3.5rem] text-lg text-white/95 leading-relaxed font-medium drop-shadow-md tracking-wide">
            {isTyping ? (
               // [Thinking UI] Pulse Animation
               <div className="flex gap-1.5 items-center h-full opacity-70 mt-2">
                 <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                 <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                 <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce"></div>
                 <span className="ml-2 text-sm text-indigo-200/50 font-light">생각 중...</span>
               </div>
            ) : (
              // [Typewriter] 한 글자씩 출력 (slice 사용으로 안정성 확보)
              <>
                {displayedText}
                {/* 커서 (타이핑 중에만 표시) */}
                {!isTextFullyDisplayed && scene?.dialogue && (
                  <span className="inline-block w-2 h-5 bg-white/70 ml-1 align-middle animate-pulse"/>
                )}
                {/* 대화 시작 전 안내 문구 */}
                {!scene?.dialogue && !isTyping && (
                  <span className="text-white/20 text-sm">(대화를 시작해보세요)</span>
                )}
              </>
            )}
          </div>

          {/* 다음 씬 유도 아이콘 (타이핑 끝나고, 다음 씬 있을 때만) */}
          {hasNextScene && isTextFullyDisplayed && (
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
                placeholder={energy > 0 ? "대화를 입력하세요..." : "에너지가 부족합니다."}
                disabled={isTyping || energy <= 0}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white placeholder-white/40 focus:bg-white/10 focus:border-pink-500/50 transition duration-300 shadow-inner"
              />
              <button 
                type="submit"
                disabled={isTyping || !input.trim() || energy <= 0}
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