import { motion, AnimatePresence } from "framer-motion";

const EMOTION_MAP = {
  NEUTRAL: "neutral.png",
  JOY: "joy.png",
  SAD: "sad.png",
  ANGRY: "angry.png",
  SHY: "shy.png",
  SURPRISE: "surprise.png",
  PANIC: "panic.png",
  RELAX: "relax.png",
  DISGUST: "disgust.png",
};

const CharacterDisplay = ({ emotion = "NEUTRAL" }) => {
  const fileName = EMOTION_MAP[emotion] || EMOTION_MAP.NEUTRAL;

  return (
    <div className="absolute inset-0 z-0 flex items-end justify-center pointer-events-none overflow-hidden">
      <motion.div
        animate={{ y: [0, -8, 0] }} // 숨쉬기 모션
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="relative w-full h-full max-w-4xl flex items-end justify-center pb-20 md:pb-28"
      >
        <AnimatePresence mode="popLayout">
          <motion.img
            key={emotion} 
            src={`/characters/${fileName}`}
            alt={emotion}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1.05 }} // 살짝 확대되며 등장
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="h-[85%] md:h-[90%] object-contain drop-shadow-2xl filter brightness-105"
            onError={(e) => {
               // 이미지가 없을 때 엑박 방지 (기본 이미지로 대체하거나 숨김)
               e.target.style.display = 'none';
               console.error(`이미지 로드 실패: ${fileName}`);
            }}
          />
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default CharacterDisplay;