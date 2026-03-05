import { motion, AnimatePresence } from "framer-motion";
import { Send, Heart, Zap, ChevronRight, Dices, History, Sparkles, Rocket, ShoppingBag } from "lucide-react";
import { useState, useEffect, useRef } from "react";

/**
 * Phase 5 BM: DialogueBox 개편
 *
 * [변경점]
 * 1. "피로도" → "에너지" 텍스트 전면 교체
 * 2. 에너지 0일 때 Send → "에너지 충전하기" 버튼 (상점 연결)
 * 3. 부스트 모드 인디케이터 (에너지 뱃지 옆)
 * 4. 에너지 툴팁 설명 최신화 (구독/부스트 비용 반영)
 */
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
  onTriggerEvent,
  // Phase 5 BM additions
  boostMode = false,
  isSubscriber = false,
  freeEnergyMax = 30,
  chatMode = "SANDBOX",
  onOpenStore,
}) => {
  const [input, setInput] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [isTextFullyDisplayed, setIsTextFullyDisplayed] = useState(false);

  const prevAffection = useRef(affection);
  const [affectionDiff, setAffectionDiff] = useState(null);

  const isEventScene = scene?.isEvent;

  // 부스트 모드 에너지 비용 계산
  const getEnergyCost = () => {
    const base = chatMode === "STORY" ? 2 : 1;
    if (!boostMode) return base;
    return isSubscriber ? base : base * 5;
  };

  const energyCost = getEnergyCost();

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

  useEffect(() => {
    const fullText = isEventScene ? (scene?.narration || "") : (scene?.dialogue || "");

    if (!fullText && !scene?.narration && !isEventScene) {
      setDisplayedText("");
      setIsTextFullyDisplayed(true);
      return;
    }

    setDisplayedText("");
    setIsTextFullyDisplayed(false);

    let charIndex = 0;
    const speed = isEventScene ? 50 : 30;

    const typingInterval = setInterval(() => {
      charIndex++;
      setDisplayedText(fullText.slice(0, charIndex));
      if (charIndex >= fullText.length) {
        clearInterval(typingInterval);
        setIsTextFullyDisplayed(true);
      }
    }, speed);

    return () => clearInterval(typingInterval);
  }, [scene, isEventScene]);

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
    } else if (hasNextScene || isEventScene) {
      onNextScene();
    }
  };

  const noEnergy = energy <= 0;
  const lowEnergy = energy < energyCost && energy > 0;

  return (
    <div className="absolute bottom-0 w-full z-20 p-4 pb-8 flex justify-center select-none">
      <div className="w-full max-w-4xl flex flex-col gap-3">

        {/* 상단 정보바 */}
        <div className="flex justify-end items-center px-2 gap-3 relative">

          {/* 부스트 모드 뱃지 */}
          <AnimatePresence>
            {boostMode && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 10 }}
                className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-2 rounded-full border border-cyan-500/40 shadow-[0_0_15px_rgba(34,211,238,0.25)]"
              >
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Rocket size={16} className="text-cyan-400" />
                </motion.div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-cyan-400 font-bold uppercase leading-none">Boost</span>
                  <span className="text-[10px] text-cyan-200 font-bold leading-none">Pro Model</span>
                </div>
                {!isSubscriber && (
                  <span className="text-[9px] text-cyan-400/60 ml-0.5">x5</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 호감도 */}
          <div className="relative group cursor-help">
            <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-pink-500/40 shadow-[0_0_15px_rgba(236,72,153,0.3)] hover:bg-black/80 transition-colors">
              <div className="relative w-6 h-6">
                <Heart className="absolute inset-0 text-gray-700 stroke-1" size={24} />
                <div
                  className="absolute inset-0 overflow-hidden transition-all duration-700 ease-out"
                  style={{ clipPath: `inset(${100 - Math.max(0, Math.min(100, affection))}% 0 0 0)` }}
                >
                  <Heart size={24} className="fill-pink-500 text-pink-500 drop-shadow-[0_0_5px_rgba(236,72,153,0.8)]" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-pink-400 font-bold uppercase leading-none">호감도</span>
                <span className="text-sm font-black tracking-wide text-white">{affection}%</span>
              </div>
            </div>

            <AnimatePresence>
              {affectionDiff && (
                <motion.div
                  key={affectionDiff.id}
                  initial={{ opacity: 0, y: 10, scale: 0.5 }}
                  animate={{ opacity: 1, y: -40, scale: 1.5, rotate: affectionDiff.value > 0 ? 10 : -10 }}
                  exit={{ opacity: 0, y: -60, scale: 1 }}
                  transition={{ duration: 0.8, type: "spring" }}
                  className={`absolute -top-4 left-1/2 -translate-x-1/2 font-black text-2xl drop-shadow-lg z-50 pointer-events-none whitespace-nowrap ${affectionDiff.value > 0 ? 'text-pink-400' : 'text-blue-400'}`}
                >
                  {affectionDiff.value > 0 ? `+${affectionDiff.value}` : affectionDiff.value}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-full right-0 mb-3 w-64 bg-black/95 border border-pink-500/30 p-4 rounded-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-2xl backdrop-blur-xl">
              <p className="font-bold text-pink-400 mb-2 text-sm">{characterName}의 {nickname}님을 향한 호감도</p>
              <div className="w-full h-1.5 bg-gray-800 rounded-full mb-3 overflow-hidden">
                <div className="h-full bg-pink-500 transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, affection))}%` }} />
              </div>
              <ul className="space-y-1.5 text-gray-400">
                <li className={affection < 0 ? "text-white font-bold" : ""}>💔 -100 ~ -1 : 싫어함</li>
                <li className={affection >= 0 && affection <= 20 ? "text-white font-bold" : ""}>😐 0 ~ 20 : 낯선 사람</li>
                <li className={affection > 20 && affection <= 40 ? "text-white font-bold" : ""}>🙂 21 ~ 40 : 지인</li>
                <li className={affection > 40 && affection <= 70 ? "text-white font-bold" : ""}>😊 41 ~ 70 : 친구</li>
                <li className={affection > 70 ? "text-pink-300 font-bold" : ""}>😍 71 ~ 100 : 사랑</li>
              </ul>
            </div>
          </div>

          {/* 에너지 (피로도 → 에너지 전면 교체) */}
          <div className="relative group cursor-help">
            <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:bg-black/80 transition-colors">
              <Zap size={20} className={`text-yellow-400 ${energy < 20 ? 'animate-pulse' : ''}`} fill={energy > 0 ? "currentColor" : "none"} />
              <div className="flex flex-col w-12">
                <span className="text-[10px] text-yellow-400 font-bold uppercase leading-none mb-0.5">에너지</span>
                <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${energy < 20 ? 'bg-red-500' : 'bg-yellow-400'}`}
                    style={{ width: `${Math.min(100, (energy / freeEnergyMax) * 100)}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-bold text-white ml-1">{energy}</span>
            </div>

            {/* 에너지 툴팁 (최신화) */}
            <div className="absolute bottom-full right-0 mb-3 w-72 bg-black/95 border border-yellow-500/30 p-4 rounded-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-2xl backdrop-blur-xl">
              <p className="font-bold text-yellow-400 mb-2 text-sm">에너지</p>
              <p className="leading-relaxed text-gray-400 mb-3">
                대화를 보낼 때마다 에너지가 소모됩니다.
              </p>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">자유 모드</span>
                  <span className="text-yellow-300 font-bold">{boostMode && !isSubscriber ? "5" : "1"} 에너지</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">스토리 모드</span>
                  <span className="text-yellow-300 font-bold">{boostMode && !isSubscriber ? "10" : "2"} 에너지</span>
                </div>
                {boostMode && !isSubscriber && (
                  <div className="flex justify-between text-cyan-400">
                    <span>부스트 모드 (비구독)</span>
                    <span className="font-bold">x5 소모</span>
                  </div>
                )}
                <div className="h-px bg-white/10 my-2" />
                <div className="flex justify-between">
                  <span className="text-gray-500">자연 회복</span>
                  <span className="text-white/60">{isSubscriber ? "5분마다 +1" : "10분마다 +1"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">최대 보유량</span>
                  <span className="text-white/60">{freeEnergyMax}</span>
                </div>
              </div>
              {isSubscriber && (
                <div className="mt-2 px-2 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px]">
                  ✨ 루시드 패스: 회복 2배 + 최대 보유량 증가
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 메인 대화창 */}
        <motion.div
          onClick={handleBoxClick}
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`relative border rounded-[2rem] p-6 pt-10 shadow-2xl transition-all ${
            hasNextScene || (!isTextFullyDisplayed && (scene?.dialogue || isEventScene)) ? 'cursor-pointer' : ''
          } ${
            isEventScene
              ? 'bg-gradient-to-br from-indigo-900/90 to-purple-900/90 border-indigo-400/50 backdrop-blur-xl ring-1 ring-purple-500/30'
              : 'bg-black/50 border-white/10 backdrop-blur-xl hover:bg-black/60'
          }`}
        >
          {/* 캐릭터 이름표 */}
          {!isEventScene && (
            <div className="absolute -top-5 left-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold px-8 py-2 rounded-2xl shadow-lg border border-white/20 transform -rotate-1 z-20">
              {characterName}
            </div>
          )}

          {/* 나레이션 */}
          <AnimatePresence mode="wait">
            {!isEventScene && scene?.narration && (
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

          {/* 텍스트 출력 */}
          <div className={`min-h-[3.5rem] leading-relaxed font-medium drop-shadow-md tracking-wide flex flex-col justify-center ${
            isEventScene ? 'items-center text-center py-4' : 'text-lg text-white/95'
          }`}>
            {isEventScene && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mb-3 text-yellow-300">
                <Sparkles size={24} />
              </motion.div>
            )}

            {isTyping ? (
              <div className="flex gap-1.5 items-center justify-center h-full opacity-70 mt-2">
                <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" />
                <span className="ml-2 text-sm text-indigo-200/50 font-light">
                  {isEventScene ? "운명의 주사위를 굴리는 중..." : "생각 중..."}
                </span>
              </div>
            ) : (
              <>
                <span className={isEventScene ? "text-xl text-indigo-100 font-serif italic" : ""}>
                  {displayedText}
                </span>
                {!scene?.dialogue && !scene?.narration && !isTyping && (
                  <span className="text-white/30 text-sm">　대화를 시작해보세요...</span>
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

          {/* 입력 폼 */}
          {!hasNextScene && !isEventScene && (
            <motion.form
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onSubmit={handleSubmit}
              className="mt-4 flex gap-3 relative z-10"
            >
              {/* 이벤트 트리거 버튼 */}
              <div className="relative group">
                <button
                  type="button"
                  onClick={onTriggerEvent}
                  disabled={isTyping || energy < 2}
                  className="h-full px-4 rounded-xl bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/40 hover:text-white transition flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Dices size={20} />
                </button>

                <div className="absolute right-full bottom-0 mr-3 w-64 bg-black/95 border border-indigo-500/30 p-4 rounded-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-2xl backdrop-blur-xl">
                  <p className="font-bold text-indigo-300 mb-2 text-sm flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-300" />
                    이벤트 트리거
                  </p>
                  <p className="leading-relaxed text-gray-400">
                    랜덤 이벤트를 발생시킵니다.<br />
                    운명의 흐름이 바뀔 수도 있어요.
                  </p>
                  <div className="mt-3 flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">소모</span>
                    <span className="text-yellow-300 font-bold">-2 에너지</span>
                  </div>
                </div>
              </div>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={noEnergy ? "에너지가 부족합니다" : lowEnergy ? `에너지가 부족합니다 (필요: ${energyCost})` : "대화를 입력하세요..."}
                disabled={isTyping || noEnergy || lowEnergy}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white placeholder-white/40 focus:bg-white/10 focus:border-pink-500/50 transition duration-300 shadow-inner"
              />

              {/* 에너지 0: 충전 버튼 / 정상: 전송 버튼 */}
              {noEnergy || lowEnergy ? (
                <motion.button
                  type="button"
                  onClick={() => onOpenStore?.("energy")}
                  className="bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white px-4 py-3.5 rounded-xl transition shadow-lg flex items-center gap-2 font-medium text-sm whitespace-nowrap"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <ShoppingBag size={18} />
                  <span className="hidden sm:inline">충전하기</span>
                </motion.button>
              ) : (
                <button
                  type="submit"
                  disabled={isTyping || !input.trim()}
                  className="bg-gradient-to-br from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white p-3.5 rounded-xl transition shadow-lg disabled:opacity-50 disabled:grayscale transform active:scale-95"
                >
                  <Send size={22} />
                </button>
              )}
            </motion.form>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default DialogueBox;