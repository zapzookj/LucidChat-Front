import { motion, AnimatePresence } from "framer-motion";
import { Send, Heart, Zap, ChevronRight, Dices, History } from "lucide-react"; // Dices 아이콘 추가
import { useState, useEffect, useRef } from "react";

const DialogueBox = ({ 
  characterName, 
  scene, 
  onSend, 
  isTyping, 
  affection, 
  energy,
  onNextScene, 
  hasNextScene,
  nickname,
  onTriggerEvent // [NEW] 이벤트 트리거 함수 받기
}) => {
  const [input, setInput] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [isTextFullyDisplayed, setIsTextFullyDisplayed] = useState(false);

  // [호감도 애니메이션 상태]
  const prevAffection = useRef(affection);
  const [affectionDiff, setAffectionDiff] = useState(null);

  // 1. 호감도 변화 감지
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

  // 2. Typewriter Effect
  useEffect(() => {
    if (!scene?.dialogue && !scene?.narration) { // 나레이션만 있는 경우도 고려
      setDisplayedText("");
      setIsTextFullyDisplayed(true);
      return;
    }

    setDisplayedText("");
    setIsTextFullyDisplayed(false);
    
    // dialogue가 있으면 dialogue를, 없으면 narration을 타이핑 (우선순위: 대사 > 지문)
    // 단, 지문은 상단에 별도로 표시되므로, 여기서는 dialogue가 주 목적
    // 하지만 이벤트 트리거 시에는 dialogue 없이 narration만 올 수 있음 -> 이 경우 메인 텍스트박스에 표시할지 고민
    // *기획 의도*: 나레이션은 상단 작은 글씨, 대사는 큰 글씨.
    // *수정*: 이벤트 발생 시 scene.dialogue는 비어있고 scene.narration만 옴.
    // ChatPage에서 setCurrentScene({ dialogue: "", narration: eventMessage })로 넘겼음.
    // 따라서 dialogue가 비어있으면 텍스트 박스에는 "(상황이 전환됩니다...)" 같은 걸 띄우거나 비워둠.
    
    const fullText = scene.dialogue || ""; 
    let charIndex = 0;

    if (!fullText) {
        setIsTextFullyDisplayed(true);
        return;
    }

    const typingInterval = setInterval(() => {
      charIndex++;
      setDisplayedText(fullText.slice(0, charIndex));

      if (charIndex >= fullText.length) {
        clearInterval(typingInterval);
        setIsTextFullyDisplayed(true);
      }
    }, 30); 

    return () => clearInterval(typingInterval);
  }, [scene]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping || hasNextScene) return;
    onSend(input);
    setInput("");
  };

  const handleBoxClick = () => {
    if (scene?.dialogue && !isTextFullyDisplayed) {
      setDisplayedText(scene.dialogue);
      setIsTextFullyDisplayed(true);
    } else if (hasNextScene) {
      onNextScene();
    }
  };

  return (
    <div className="absolute bottom-0 w-full z-20 p-4 pb-8 flex justify-center">
      <div className="w-full max-w-4xl flex flex-col gap-3">
        
        {/* 상단 정보바 */}
        <div className="flex justify-end items-center px-2 gap-3 relative">
          {/* 호감도 배지 */}
          <div className="relative group cursor-help">
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-pink-500/30 shadow-lg">
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
            {/* 호감도 변화 팝업 */}
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
            {/* 툴팁 */}
            <div className="absolute bottom-full right-0 mb-2 w-64 bg-black/90 border border-pink-500/20 p-4 rounded-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-xl backdrop-blur-sm">
               <p className="font-bold text-pink-300 mb-2">{characterName}의 {nickname}님을 향한 호감도</p>
               <ul className="space-y-1 text-gray-400">
                 <li>-100 ~ -1 : 싫어함</li>
                 <li>0 ~ 20 : 낯선 사람</li>
                 <li>21 ~ 40 : 지인</li>
                 <li>41 ~ 70 : 친구</li>
                 <li>71 ~ 100 : 사랑</li>
               </ul>
            </div>
          </div>

          {/* 에너지 배지 */}
          <div className="relative group cursor-help">
            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-yellow-400/30 text-yellow-300 shadow-lg">
              <Zap size={16} fill="currentColor" />
              <span className="text-sm font-bold tracking-wide">{energy}</span>
            </div>
            <div className="absolute bottom-full right-0 mb-2 w-64 bg-black/90 border border-yellow-500/20 p-4 rounded-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-xl backdrop-blur-sm">
               <p className="font-bold text-yellow-300 mb-2">피로도</p>
               <p className="leading-relaxed text-gray-400">
                 대화 시 1, 이벤트 트리거 시 2 감소. 10분마다 1 회복.
               </p>
            </div>
          </div>
        </div>

        {/* 메인 대화창 */}
        <motion.div 
          onClick={handleBoxClick}
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`relative bg-black/50 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 pt-10 shadow-2xl transition-all ${hasNextScene || (!isTextFullyDisplayed && scene?.dialogue) ? 'cursor-pointer hover:bg-black/60' : ''}`}
        >
          <div className="absolute -top-5 left-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold px-8 py-2 rounded-2xl shadow-lg border border-white/20 transform -rotate-1 z-20">
            {characterName}
          </div>

          {/* 나레이션 (지문) 영역 - 이벤트 트리거 시 여기가 메인 */}
          <AnimatePresence mode="wait">
            {scene?.narration && (
              <motion.div
                key={scene.narration}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-3 text-sm text-pink-200/90 font-medium italic flex items-center gap-2"
              >
                {/* 나레이션이 있을 때 강조 */}
                <span>* {scene.narration}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 대사 출력 영역 */}
          <div className="min-h-[3.5rem] text-lg text-white/95 leading-relaxed font-medium drop-shadow-md tracking-wide">
            {isTyping ? (
               <div className="flex gap-1.5 items-center h-full opacity-70 mt-2">
                 <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                 <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                 <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce"></div>
                 <span className="ml-2 text-sm text-indigo-200/50 font-light">상황 진행 중...</span>
               </div>
            ) : (
              <>
                {displayedText}
                {!isTextFullyDisplayed && scene?.dialogue && (
                  <span className="inline-block w-2 h-5 bg-white/70 ml-1 align-middle animate-pulse"/>
                )}
                {!scene?.dialogue && !scene?.narration && !isTyping && (
                  <span className="text-white/20 text-sm">(대화를 시작하거나 주사위를 굴려보세요)</span>
                )}
              </>
            )}
          </div>

          {/* 다음 씬 아이콘 */}
          {hasNextScene && isTextFullyDisplayed && (
            <motion.div 
              animate={{ x: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="absolute bottom-6 right-6 text-white/50"
            >
              <ChevronRight size={24} />
            </motion.div>
          )}

          {/* 입력 폼 & 이벤트 트리거 버튼 */}
          {!hasNextScene && (
            <motion.form 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onSubmit={handleSubmit} 
              className="mt-4 flex gap-3 relative z-10"
            >
              {/* [NEW] 이벤트 트리거 버튼 (Dice) */}
              <div className="relative group">
                <button
                    type="button"
                    onClick={onTriggerEvent}
                    disabled={isTyping || energy < 2}
                    className="h-full px-4 rounded-xl bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/40 hover:text-white transition flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <Dices size={20} />
                </button>
                {/* 에너지 비용 툴팁 */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-[10px] text-yellow-300 rounded border border-yellow-500/30 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                    -2 Energy
                </div>
              </div>

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