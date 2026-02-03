import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext"; // 유저 정보 가져오기
import api from "../api/axios";
import CharacterDisplay from "../components/CharacterDisplay";
import DialogueBox from "../components/DialogueBox";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Trash2 } from "lucide-react";

const ChatPage = () => {
  const { user } = useAuth(); // 로그인한 유저 정보
  const roomId = localStorage.getItem("roomId");
  
  const [roomInfo, setRoomInfo] = useState(null);
  const [messages, setMessages] = useState([]); // 전체 로그 (히스토리용)
  
  // [컷신 상태]
  const [sceneQueue, setSceneQueue] = useState([]); // 재생 대기 중인 씬들
  const [currentScene, setCurrentScene] = useState(null); // 현재 보여지는 씬
  
  // [상태 정보]
  const [affection, setAffection] = useState(0);
  const [energy, setEnergy] = useState(user?.energy || 100); // 초기값은 유저 정보 or 100
  const [isTyping, setIsTyping] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const logsEndRef = useRef(null);

  // 로그창 스크롤
  useEffect(() => {
    if (showHistory && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [showHistory, messages]);

  // 1. 초기 데이터 로드
  useEffect(() => {
    const init = async () => {
      if(!roomId) return;
      try {
        const roomRes = await api.get(`/chat/rooms/${roomId}`);
        setRoomInfo(roomRes.data);
        setAffection(roomRes.data.affectionScore);
        
        // 로그 로드
        const logsRes = await api.get(`/chat/rooms/${roomId}/logs?page=0&size=50`);
        if (logsRes.data && logsRes.data.content) {
            const sortedLogs = logsRes.data.content.reverse();
            setMessages(sortedLogs);
            
            // 마지막 상태 복원 (단순 텍스트로)
            if (sortedLogs.length > 0) {
               const lastLog = sortedLogs[sortedLogs.length - 1];
               if (lastLog.role === 'ASSISTANT') {
                 // 로그 복원 시에는 나레이션 없이 대사만 보여주거나, 마지막 감정만 유지
                 setCurrentScene({
                   dialogue: lastLog.cleanContent,
                   narration: "",
                   emotion: lastLog.emotionTag || "NEUTRAL"
                 });
               }
            }
        }
      } catch (err) {
        console.error("초기화 에러", err);
      }
    };
    init();
  }, [roomId]);

  // 2. 메시지 전송 핸들러
  const handleSendMessage = async (text) => {
    // 에너지 체크 (Optimistic)
    if (energy <= 0) {
      alert("에너지가 부족합니다. 내일 다시 대화해주세요!");
      return;
    }
    setEnergy(prev => Math.max(0, prev - 1)); // 즉시 차감

    // 내 메시지 표시
    const tempMsg = { role: 'USER', cleanContent: text };
    setMessages(prev => [...prev, tempMsg]);
    setIsTyping(true);
    setCurrentScene(null); // 타이핑 중엔 기존 대사 지우기 (선택사항)

    try {
      const res = await api.post(`/chat/rooms/${roomId}/messages`, {
        roomId: roomId,
        message: text
      });

      const { scenes, currentAffection } = res.data;

      // 호감도 업데이트
      setAffection(currentAffection);
      
      // [핵심] 받아온 씬들을 큐에 넣고 재생 시작
      if (scenes && scenes.length > 0) {
        setSceneQueue(scenes); 
        // 첫 번째 씬 즉시 재생 (혹은 큐 useEffect에 맡김)
        // 여기선 큐에 넣으면 아래 useEffect가 반응하도록 설계
      }

      // 로그에는 전체 합쳐서 저장된 걸 백엔드가 처리했으므로, 
      // 프론트 로그창에는 대사만 합쳐서 보여주거나 함 (여기선 생략, 백엔드 로직 따름)
      // *편의상* 마지막 대사를 로그에 추가 (실제론 재조회하거나 조합해야 함)
      const combinedText = scenes.map(s => s.dialogue).join(" ");
      setMessages(prev => [...prev, { role: 'ASSISTANT', cleanContent: combinedText }]);

    } catch (err) {
      console.error(err);
      setCurrentScene({ dialogue: "(...서버와의 연결이 희미해집니다...)", emotion: "SAD" });
    } finally {
      setIsTyping(false);
    }
  };

  // 3. 컷신 재생기 (Queue Consumer)
  useEffect(() => {
    // 현재 보여주는 씬이 없고, 큐에 남은 씬이 있다면 -> 다음 씬 재생
    if (!currentScene && sceneQueue.length > 0) {
      const nextScene = sceneQueue[0];
      setCurrentScene(nextScene);
      setSceneQueue(prev => prev.slice(1)); // 큐에서 제거
    }
  }, [sceneQueue, currentScene]);

  // 다음 씬으로 넘기기 (사용자 클릭 시)
  const handleNextScene = () => {
    if (sceneQueue.length > 0) {
      const nextScene = sceneQueue[0];
      setCurrentScene(nextScene);
      setSceneQueue(prev => prev.slice(1));
    } else {
      // 큐가 비었으면 끝 (대기 상태)
      // currentScene은 유지 (마지막 대사 보여줌)
    }
  };

  // 대화 초기화
  const handleClearHistory = async () => {
    if (!window.confirm("모든 기억을 지우시겠습니까?")) return;
    try {
      await api.delete(`/chat/rooms/${roomId}`);
      setMessages([]);
      setCurrentScene({ dialogue: "(모든 기억이 초기화되었습니다.)", emotion: "NEUTRAL", narration: "" });
      alert("초기화되었습니다.");
    } catch (err) {
      alert("오류가 발생했습니다.");
    }
  };

  if (!roomInfo) return <div className="h-full flex items-center justify-center text-white/50">Loading...</div>;

  return (
    // <div className="relative w-full h-full font-sans overflow-hidden bg-gray-900">
    <div className="relative w-full h-screen font-sans overflow-hidden bg-gray-900">
      <img 
        src="/backgrounds/room_night.png"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-80"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 z-0" />

      {/* 캐릭터 (현재 씬의 감정 따라감) */}
      <CharacterDisplay emotion={currentScene?.emotion || "NEUTRAL"} />

      {/* 대화창 */}
      <DialogueBox 
        characterName={roomInfo.characterName}
        scene={currentScene} // 현재 씬 정보 통째로 전달
        onSend={handleSendMessage}
        isTyping={isTyping}
        onOpenHistory={() => setShowHistory(true)}
        affection={affection}
        energy={energy}
        onNextScene={handleNextScene} // 클릭 핸들러
        hasNextScene={sceneQueue.length > 0} // 커서 변경용
      />

      {/* 히스토리 & 설정 모달 */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
            className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-black/90 backdrop-blur-2xl z-50 shadow-2xl border-l border-white/10 flex flex-col"
          >
            {/* 헤더 */}
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/40">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <MessageSquare size={20} className="text-pink-500"/>
                Dialogue Log
              </h2>
              <button onClick={() => setShowHistory(false)} className="p-2 rounded-full hover:bg-white/10 transition">
                <X size={24} className="text-white/70" />
              </button>
            </div>
            
            {/* 로그 리스트 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {messages.length === 0 ? (
                 <div className="text-center text-white/30 py-10">기록이 없습니다.</div>
              ) : messages.map((msg, idx) => {
                const isMe = msg.role === 'USER';
                return (
                  <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className={`text-xs mb-1 px-2 ${isMe ? 'text-pink-400' : 'text-indigo-400'}`}>
                      {isMe ? '나' : roomInfo.characterName}
                    </span>
                    <div className={`px-5 py-3 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${
                      isMe ? 'bg-pink-600 text-white rounded-tr-sm' : 'bg-[#2a2a35] text-gray-100 rounded-tl-sm border border-white/5'
                    }`}>
                      {msg.cleanContent}
                    </div>
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>

            {/* [NEW] 하단 설정 영역 (초기화 버튼 이동) */}
            <div className="p-6 border-t border-white/10 bg-black/40">
              <button 
                onClick={handleClearHistory}
                className="w-full py-3 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition flex items-center justify-center gap-2 font-bold"
              >
                <Trash2 size={18} />
                모든 대화 기록 삭제 (초기화)
              </button>
              <p className="text-center text-white/20 text-xs mt-3">
                초기화 시 호감도와 기억이 모두 사라집니다.
              </p>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatPage;