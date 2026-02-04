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

  // ================= BGM Logic =================
  useEffect(() => {
    // BGM 초기화 (public/sounds/bgm.mp3 파일 필요)
    audioRef.current = new Audio("/sounds/main bgm.mp3");
    audioRef.current.loop = true;
    audioRef.current.volume = 0.5;

    // 컴포넌트 마운트 시 자동 재생 시도
    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsBgmPlaying(true))
        .catch((error) => {
          console.log("Auto-play prevented:", error);
          setIsBgmPlaying(false);
        });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggleBgm = () => {
    if (isBgmPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error(e));
    }
    setIsBgmPlaying(!isBgmPlaying);
  };

  // ================= User Info Logic =================
  // 유저 정보 불러오기
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await api.get("/users/me");
        setUserInfo({
          nickname: res.data.nickname || "",
          profileDescription: res.data.profileDescription || ""
        });
      } catch (err) {
        console.error("Failed to fetch user info", err);
      }
    };
    if (showSettings) { // 설정창 열 때 갱신
        fetchUserInfo();
    }
  }, [showSettings]);

  // 유저 정보 저장
  const handleUpdateProfile = async () => {
    setIsSavingProfile(true);
    try {
      await api.patch("/users/update", {
        nickname: userInfo.nickname,
        profileDescription: userInfo.profileDescription
      });
      alert("프로필이 저장되었습니다.");
    } catch (err) {
      console.error(err);
      alert("저장에 실패했습니다.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ================= Existing Logic =================
  useEffect(() => {
    if (user?.energy !== undefined) {
      setEnergy(user.energy);
    }
  }, [user]);

  useEffect(() => {
    if (currentScene?.emotion) {
      setDisplayedEmotion(currentScene.emotion);
    }
  }, [currentScene]);

  useEffect(() => {
    if (showHistory && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
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
            const sortedLogs = logsRes.data.content.reverse();
            setMessages(sortedLogs);
            
            if (sortedLogs.length > 0) {
               const lastLog = sortedLogs[sortedLogs.length - 1];
               if (lastLog.role === 'ASSISTANT') {
                 const restoredScene = {
                   dialogue: lastLog.cleanContent,
                   narration: "",
                   emotion: lastLog.emotionTag || "NEUTRAL"
                 };
                 setCurrentScene(restoredScene);
                 setDisplayedEmotion(restoredScene.emotion);
               }
            }
        }
      } catch (err) {
        console.error("초기화 에러", err);
      }
    };
    init();
  }, [roomId]);

  const handleSendMessage = async (text) => {
    // 텍스트가 없으면(자동반응) 에너지 체크 패스 혹은 별도 로직
    if (text && energy <= 0) {
      alert("에너지가 부족합니다. 내일 다시 대화해주세요!");
      return;
    }
    // 자동 반응일 경우(text가 없음) 에너지 차감 안함 (이미 이벤트에서 차감됨)
    if (text) {
        setEnergy(prev => Math.max(0, prev - 1));
        setMessages(prev => [...prev, { role: 'USER', cleanContent: text }]);
    }

    // const tempMsg = { role: 'USER', cleanContent: text };
    // setMessages(prev => [...prev, tempMsg]);
    setIsTyping(true);
    setCurrentScene(null); 

    try {
      // 텍스트가 없으면 "..." 등으로 보내거나 백엔드 약속 필요. 
      // 여기선 편의상 "..." (침묵)을 보냄. 백엔드에서 (...)은 무시하고 상황에 반응하도록 프롬프트가 되어 있으면 좋음.
      const messagePayload = text || "..."; 
      
      const res = await api.post(`/chat/rooms/${roomId}/messages`, { roomId, message: messagePayload });

      const { scenes, currentAffection } = res.data;
      setAffection(currentAffection);
      
      if (scenes && scenes.length > 0) {
        setSceneQueue(scenes); 
      }

      const combinedText = scenes.map(s => s.dialogue).join(" ");
      setMessages(prev => [...prev, { role: 'ASSISTANT', cleanContent: combinedText }]);

    } catch (err) {
      console.error(err);
      setCurrentScene({ dialogue: `잠시만요.. ${roomInfo?.characterName || '그녀'}가 잠깐 바쁜 일이 있어서...`, emotion: "SAD", narration: "잠시 후 다시 시도해주세요." });
      setDisplayedEmotion("SAD");
    } finally {
      setIsTyping(false);
    }
  };


  // [NEW] 이벤트 트리거 (나레이션 생성) 핸들러
  const handleTriggerEvent = async () => {
    // 이벤트 비용 체크 (백엔드 설정과 동일하게 2로 가정)
    if (energy < 2) return alert("이벤트를 실행하려면 에너지 2가 필요합니다.");
    
    setEnergy(prev => Math.max(0, prev - 2)); // 즉시 차감 (낙관적 업데이트)
    setIsTyping(true); // 캐릭터가 생각하는 것처럼 연출 (나레이터 생성 중)

    try {
        // 1. 이벤트 생성 (나레이션)
        const res = await api.post(`/story/rooms/${roomId}/events`);
        const { eventMessage, userEnergy } = res.data; // 백엔드 NarratorResponse

        setEnergy(userEnergy); // 서버 값으로 동기화

        // 시스템 메시지로 로그에 추가
        const systemMsg = { role: 'SYSTEM', cleanContent: eventMessage };
        setMessages(prev => [...prev, systemMsg]);

        // 2. 이벤트 씬 설정 (UI 연출)
        // isEvent: true를 줘서 DialogueBox가 특별하게 렌더링하게 함
        setCurrentScene({ 
            dialogue: "", 
            narration: eventMessage, 
            emotion: displayedEmotion, // 감정은 유지
            isEvent: true
        });

        // [핵심] 캐릭터 자동 반응을 위해 큐에 '자동 반응 트리거' 예약?
        // 여기서는 유저가 이벤트를 '읽고' 클릭했을 때 반응하게 하기 위해
        // handleNextScene 로직을 활용하거나, 
        // 그냥 바로 API를 호출해서 큐에 넣어버릴 수도 있음.

        // [중요] 여기서 handleSendMessage를 호출하지 않음!
        // 유저가 이벤트를 읽고 화면을 클릭했을 때(handleNextScene) 호출하도록 함.
    } catch (err) {
        console.error("Event trigger failed", err);
        alert("이벤트 생성에 실패했습니다.");
        setIsTyping(false);
    } finally {
        setIsTyping(false);
    }
  };

  useEffect(() => {
    if (!currentScene && sceneQueue.length > 0) {
      const nextScene = sceneQueue[0];
      setCurrentScene(nextScene);
      setSceneQueue(prev => prev.slice(1));
    }
  }, [sceneQueue, currentScene]);

  // [수정] 다음 씬 처리 핸들러 (이벤트 씬 처리 추가)
  const handleNextScene = () => {
    // 1. 현재 이벤트 씬이었다면 -> 캐릭터 반응(선톡) 요청
    if (currentScene?.isEvent) {
        // 이벤트 씬을 큐에서 넘기듯이 처리하고 싶지만, 
        // 여기서는 "유저 확인" -> "캐릭터 반응 로딩" 순서이므로 API 호출
        handleSendMessage(null); 
        return;
    }

    // 2. 일반 컷신 큐 처리
    if (sceneQueue.length > 0) {
      const nextScene = sceneQueue[0];
      setCurrentScene(nextScene);
      setSceneQueue(prev => prev.slice(1));
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("모든 기억을 지우시겠습니까?")) return;
    try {
      await api.delete(`/chat/rooms/${roomId}`);
      setMessages([]);
      setCurrentScene({ dialogue: "...", emotion: "SAD", narration: "...모든 기억이 희미해집니다..." });
      setAffection(0);
      alert("초기화되었습니다.");
    } catch (err) {
      alert("오류가 발생했습니다.");
    }
  };

  const handleLogout = async () => {
      if(window.confirm("로그아웃 하시겠습니까?")) {
          await logout();
          window.location.href = "/login";
      }
  }

  if (!roomInfo) return <div className="h-full flex items-center justify-center text-white/50">Loading...</div>;

  return (
    <div className="relative w-full h-screen font-sans overflow-hidden bg-gray-900">
      <img 
        src="/backgrounds/room_night.png"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-80"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 z-0" />

      {/* 캐릭터 디스플레이 */}
      <CharacterDisplay emotion={displayedEmotion} />

      {/* [NEW] 우측 상단 컨트롤 버튼 그룹 (BGM, 설정, 기록) */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
        {/* BGM Toggle */}
        <button 
            onClick={toggleBgm}
            className={`p-3 rounded-full backdrop-blur-md transition shadow-lg border ${
                isBgmPlaying 
                ? 'bg-pink-500/20 border-pink-500/50 text-pink-300 hover:bg-pink-500/30' 
                : 'bg-black/40 border-white/10 text-gray-400 hover:bg-white/10'
            }`}
            title={isBgmPlaying ? "BGM 끄기" : "BGM 켜기"}
        >
            {isBgmPlaying ? <Music size={20} className="animate-pulse"/> : <VolumeX size={20} />}
        </button>

        {/* Settings Button */}
        <button 
            onClick={() => setShowSettings(true)}
            className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white/80 hover:bg-white/20 transition border border-white/10 shadow-lg"
            title="설정"
        >
            <Settings size={20} />
        </button>

        {/* History Button (기존 위치에서 이동) */}
        <button 
            onClick={() => setShowHistory(true)}
            className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white/80 hover:bg-white/20 transition border border-white/10 shadow-lg"
            title="지난 대화"
        >
            <MessageSquare size={20} />
        </button>
      </div>

      {/* 대화창 (History 버튼 제거됨) */}
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

      {/* [NEW] 설정 모달 */}
      <AnimatePresence>
        {showSettings && (
            <motion.div 
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
                className="fixed inset-y-0 right-0 w-full md:w-[420px] bg-black/95 backdrop-blur-2xl z-50 shadow-2xl border-l border-white/10 flex flex-col"
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Settings size={20} className="text-indigo-400"/>
                        Settings
                    </h2>
                    <button onClick={() => setShowSettings(false)} className="p-2 rounded-full hover:bg-white/10 transition">
                        <X size={24} className="text-white/70" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {/* 1. User Settings */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <UserIcon size={16}/> User Profile
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Nickname</label>
                                <input 
                                    type="text" 
                                    value={userInfo.nickname}
                                    onChange={(e) => setUserInfo({...userInfo, nickname: e.target.value})}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-indigo-500/50 outline-none transition"
                                    placeholder="닉네임을 입력하세요"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">My Persona (Secret Mode)</label>
                                <textarea 
                                    value={userInfo.profileDescription}
                                    onChange={(e) => setUserInfo({...userInfo, profileDescription: e.target.value})}
                                    className="w-full h-32 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-indigo-500/50 outline-none resize-none transition custom-scrollbar leading-relaxed"
                                    placeholder="캐릭터에게 보여질 나의 설정, 외모, 성격 등을 자유롭게 적어주세요."
                                />
                            </div>
                            <button 
                                onClick={handleUpdateProfile}
                                disabled={isSavingProfile}
                                className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Save size={18} />
                                {isSavingProfile ? "Saving..." : "Save Profile"}
                            </button>
                        </div>
                    </section>

                    <div className="h-px bg-white/10" />

                    {/* 2. Game Settings (Dummy) */}
                    <section className="opacity-70">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Gamepad2 size={16}/> Game Settings <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-500">COMING SOON</span>
                        </h3>
                        <div className="space-y-4 pointer-events-none grayscale">
                            <div>
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>BGM Volume</span>
                                    <span>50%</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full w-1/2 bg-indigo-500" />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>Text Speed</span>
                                    <span>Fast</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full w-3/4 bg-indigo-500" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm text-gray-300">Secret Mode (NSFW)</span>
                                <div className="w-10 h-6 bg-white/10 rounded-full relative">
                                    <div className="absolute left-1 top-1 w-4 h-4 bg-gray-500 rounded-full" />
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="p-6 border-t border-white/10 bg-white/5">
                    <button 
                        onClick={handleLogout}
                        className="w-full py-3 rounded-lg border border-white/10 hover:bg-white/10 text-gray-300 transition flex items-center justify-center gap-2"
                    >
                        <LogOut size={18} />
                        Logout
                    </button>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
      
      {/* 히스토리 모달 (SYSTEM 메시지 렌더링 추가) */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
            className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-black/90 backdrop-blur-2xl z-50 shadow-2xl border-l border-white/10 flex flex-col"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/40">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <MessageSquare size={20} className="text-pink-500"/>
                Dialogue Log
              </h2>
              <button onClick={() => setShowHistory(false)} className="p-2 rounded-full hover:bg-white/10 transition">
                <X size={24} className="text-white/70" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {messages.length === 0 ? <div className="text-center text-white/30 py-10">기록이 없습니다.</div> : messages.map((msg, idx) => {
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
            {/* Footer */}
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