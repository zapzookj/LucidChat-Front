import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import CharacterDisplay from "../components/CharacterDisplay";
import DialogueBox from "../components/DialogueBox";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, MessageSquare, Trash2, Settings, Music, VolumeX, 
  LogOut, User as UserIcon, Gamepad2, Save, Sparkles 
} from "lucide-react";

const ChatPage = () => {
  const { user, logout } = useAuth();
  const roomId = localStorage.getItem("roomId");
  
  const [roomInfo, setRoomInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  
  // [컷신 상태]
  const [sceneQueue, setSceneQueue] = useState([]);
  const [currentScene, setCurrentScene] = useState(null);
  const [displayedEmotion, setDisplayedEmotion] = useState("NEUTRAL");
  
  // [상태 정보]
  const [affection, setAffection] = useState(0);
  const [energy, setEnergy] = useState(user?.energy || 100);
  const [isTyping, setIsTyping] = useState(false);
  
  // [UI 상태]
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);

  // [유저 설정 상태]
  const [userInfo, setUserInfo] = useState({ nickname: "", profileDescription: "" });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const logsEndRef = useRef(null);
  const audioRef = useRef(null);

  // ... (BGM 로직, User Info 로직, 기존 useEffect들은 그대로 유지) ...
  // (지면 관계상 생략된 코드는 기존과 동일합니다. 아래 handleTriggerEvent가 핵심입니다.)

  // ================= BGM Logic =================
  useEffect(() => {
    audioRef.current = new Audio("/sounds/main bgm.mp3");
    audioRef.current.loop = true;
    audioRef.current.volume = 0.5;
    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise.then(() => setIsBgmPlaying(true)).catch(() => setIsBgmPlaying(false));
    }
    return () => { if (audioRef.current) audioRef.current.pause(); };
  }, []);

  const toggleBgm = () => {
    if (isBgmPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(console.error);
    setIsBgmPlaying(!isBgmPlaying);
  };

  // ================= User Info Logic =================
  useEffect(() => {
    if (showSettings) {
        api.get("/users/me").then(res => {
            setUserInfo({ nickname: res.data.nickname || "", profileDescription: res.data.profileDescription || "" });
        }).catch(console.error);
    }
  }, [showSettings]);

  const handleUpdateProfile = async () => {
    setIsSavingProfile(true);
    try {
      await api.patch("/users/update", { nickname: userInfo.nickname, profileDescription: userInfo.profileDescription });
      alert("프로필이 저장되었습니다.");
    } catch (err) { alert("실패했습니다."); } 
    finally { setIsSavingProfile(false); }
  };

  // ================= Chat Logic =================
  // ... (기존 에너지/감정 useEffect 등 유지) ...
  useEffect(() => {
    if (user?.energy !== undefined) setEnergy(user.energy);
  }, [user]);

  useEffect(() => {
    if (currentScene?.emotion) setDisplayedEmotion(currentScene.emotion);
  }, [currentScene]);

  useEffect(() => {
    if (showHistory && logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [showHistory, messages]);

  useEffect(() => {
    const init = async () => {
      if(!roomId) return;
      try {
        const roomRes = await api.get(`/chat/rooms/${roomId}`);
        setRoomInfo(roomRes.data);
        setAffection(roomRes.data.affectionScore);
        
        const logsRes = await api.get(`/chat/rooms/${roomId}/logs?page=0&size=50`);
        if (logsRes.data && logsRes.data.content) {
            setMessages(logsRes.data.content.reverse());
            // ... (마지막 씬 복원 로직 유지) ...
            const sortedLogs = logsRes.data.content; // 이미 reverse 됨
            if (sortedLogs.length > 0) {
               const lastLog = sortedLogs[sortedLogs.length - 1];
               if (lastLog.role === 'ASSISTANT') {
                 setCurrentScene({ dialogue: lastLog.cleanContent, narration: "", emotion: lastLog.emotionTag || "NEUTRAL" });
                 setDisplayedEmotion(lastLog.emotionTag || "NEUTRAL");
               }
            }
        }
      } catch (err) { console.error(err); }
    };
    init();
  }, [roomId]);

  const handleSendMessage = async (text) => {
    if (energy <= 0) return alert("에너지가 부족합니다.");
    setEnergy(prev => Math.max(0, prev - 1));
    setMessages(prev => [...prev, { role: 'USER', cleanContent: text }]);
    setIsTyping(true);
    setCurrentScene(null);

    try {
      const res = await api.post(`/chat/rooms/${roomId}/messages`, { roomId, message: text });
      setAffection(res.data.currentAffection);
      if (res.data.scenes?.length > 0) setSceneQueue(res.data.scenes);
      
      const combinedText = res.data.scenes.map(s => s.dialogue).join(" ");
      setMessages(prev => [...prev, { role: 'ASSISTANT', cleanContent: combinedText }]);
    } catch (err) {
      setCurrentScene({ dialogue: "서버 연결 오류...", emotion: "SAD" });
      setDisplayedEmotion("SAD");
    } finally { setIsTyping(false); }
  };

  // [NEW] 이벤트 트리거 (나레이션 생성) 핸들러
  const handleTriggerEvent = async () => {
    // 이벤트 비용 체크 (백엔드 설정과 동일하게 2로 가정)
    if (energy < 2) return alert("이벤트를 실행하려면 에너지 2가 필요합니다.");
    
    setEnergy(prev => Math.max(0, prev - 2)); // 즉시 차감 (낙관적 업데이트)
    setIsTyping(true); // 캐릭터가 생각하는 것처럼 연출 (나레이터 생성 중)

    try {
        const res = await api.post(`/story/rooms/${roomId}/events`);
        const { eventMessage, userEnergy } = res.data; // 백엔드 NarratorResponse

        setEnergy(userEnergy); // 서버 값으로 동기화

        // 시스템 메시지로 로그에 추가
        const systemMsg = { role: 'SYSTEM', cleanContent: eventMessage };
        setMessages(prev => [...prev, systemMsg]);

        // 화면에도 나레이션 씬으로 보여주기 (선택 사항: 컷신 큐에 넣어서 보여줄 수도 있음)
        // 여기서는 채팅창 하단 DialogueBox에 즉시 띄웁니다.
        setCurrentScene({ 
            dialogue: "", 
            narration: eventMessage, 
            emotion: displayedEmotion // 감정은 유지
        });

    } catch (err) {
        console.error("Event trigger failed", err);
        alert("이벤트 생성에 실패했습니다.");
    } finally {
        setIsTyping(false);
    }
  };

  // ... (Scene Queue effect, Next Scene, Clear History, Logout 등 기존 유지) ...
  useEffect(() => {
    if (!currentScene && sceneQueue.length > 0) {
      const nextScene = sceneQueue[0];
      setCurrentScene(nextScene);
      setSceneQueue(prev => prev.slice(1));
    }
  }, [sceneQueue, currentScene]);

  const handleNextScene = () => {
    if (sceneQueue.length > 0) {
      const nextScene = sceneQueue[0];
      setCurrentScene(nextScene);
      setSceneQueue(prev => prev.slice(1));
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("초기화 하시겠습니까?")) return;
    try { await api.delete(`/chat/rooms/${roomId}`); window.location.reload(); } catch(e){}
  };

  const handleLogout = async () => {
      if(window.confirm("로그아웃?")) { await logout(); window.location.href = "/login"; }
  };

  if (!roomInfo) return <div className="h-full flex items-center justify-center text-white/50">Loading...</div>;

  return (
    <div className="relative w-full h-screen font-sans overflow-hidden bg-gray-900">
      <img src="/backgrounds/room_night.png" alt="Background" className="absolute inset-0 w-full h-full object-cover z-0 opacity-80" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 z-0" />

      <CharacterDisplay emotion={displayedEmotion} />

      {/* 우측 상단 컨트롤 */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
        <button onClick={toggleBgm} className={`p-3 rounded-full backdrop-blur-md border ${isBgmPlaying ? 'bg-pink-500/20 border-pink-500/50 text-pink-300' : 'bg-black/40 border-white/10 text-gray-400'}`}>
            {isBgmPlaying ? <Music size={20} className="animate-pulse"/> : <VolumeX size={20} />}
        </button>
        <button onClick={() => setShowSettings(true)} className="p-3 rounded-full bg-black/40 border border-white/10 text-white/80"><Settings size={20} /></button>
        <button onClick={() => setShowHistory(true)} className="p-3 rounded-full bg-black/40 border border-white/10 text-white/80"><MessageSquare size={20} /></button>
      </div>

      <DialogueBox 
        characterName={roomInfo.characterName}
        scene={currentScene} 
        onSend={handleSendMessage}
        isTyping={isTyping}
        affection={affection}
        energy={energy}
        onNextScene={handleNextScene} 
        hasNextScene={sceneQueue.length > 0} 
        nickname={user?.nickname || "사용자"}
        onTriggerEvent={handleTriggerEvent} // [NEW] 이벤트 핸들러 전달
      />

      {/* 설정 모달 (기존 코드 유지) */}
      {/* ... (생략) ... */}
      
      {/* 히스토리 모달 (SYSTEM 메시지 렌더링 추가) */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-black/90 backdrop-blur-2xl z-50 shadow-2xl border-l border-white/10 flex flex-col"
          >
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/40">
              <h2 className="text-xl font-bold text-white flex gap-2"><MessageSquare size={20} className="text-pink-500"/> Dialogue Log</h2>
              <button onClick={() => setShowHistory(false)}><X size={24} className="text-white/70" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {messages.length === 0 ? <div className="text-center text-white/30 py-10">기록 없음</div> : messages.map((msg, idx) => {
                // [NEW] 시스템 메시지 (나레이션) 렌더링
                if (msg.role === 'SYSTEM') {
                    return (
                        <div key={idx} className="flex justify-center my-6">
                            <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 text-indigo-200 text-xs px-5 py-2.5 rounded-full backdrop-blur-sm shadow-lg flex items-center gap-2 max-w-[90%] text-center leading-relaxed">
                                <Sparkles size={14} className="text-yellow-300 shrink-0" />
                                <span>{msg.cleanContent}</span>
                            </div>
                        </div>
                    );
                }

                const isMe = msg.role === 'USER';
                return (
                  <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className={`text-xs mb-1 px-2 ${isMe ? 'text-pink-400' : 'text-indigo-400'}`}>{isMe ? '나' : roomInfo.characterName}</span>
                    <div className={`px-5 py-3 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${isMe ? 'bg-pink-600 text-white rounded-tr-sm' : 'bg-[#2a2a35] text-gray-100 rounded-tl-sm border border-white/5'}`}>
                      {msg.cleanContent}
                    </div>
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
            {/* Footer 유지 */}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatPage;