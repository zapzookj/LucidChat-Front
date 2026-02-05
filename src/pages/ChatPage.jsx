import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import CharacterDisplay from "../components/CharacterDisplay";
import DialogueBox from "../components/DialogueBox";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, MessageSquare, Trash2, Settings, Music, VolumeX, 
  LogOut, User as UserIcon, Gamepad2, Save, Sparkles, Lock, Unlock,
  CheckCircle, AlertTriangle, Info // [NEW] 알림용 아이콘 추가
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
  const [userInfo, setUserInfo] = useState({ 
      nickname: "", 
      profileDescription: "", 
      isSecretMode: false 
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // [BGM Volume]
  const [bgmVolume, setBgmVolume] = useState(() => {
    const saved = localStorage.getItem("bgmVolume");
    const v = saved !== null ? Number(saved) : 0.5;
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
  });

  // [NEW] 커스텀 알림(Toast) & 확인 모달(Confirm) 상태
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' | 'info' }
  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm, type: 'danger' | 'info' }

  const logsEndRef = useRef(null);
  const audioRef = useRef(null);

  // ================= Helper Functions =================
  // 토스트 메시지 출력
  const showToast = (message, type = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000); // 3초 후 자동 사라짐
  };

  // 확인 모달 열기
  const openConfirm = (message, onConfirm, type = 'danger') => {
      setConfirmModal({ message, onConfirm, type });
  };

  // 확인 모달 닫기
  const closeConfirm = () => {
      setConfirmModal(null);
  };

  // ================= BGM Logic =================
  useEffect(() => {
    audioRef.current = new Audio("/sounds/main bgm.mp3");
    audioRef.current.loop = true;
    audioRef.current.volume = bgmVolume;

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

  useEffect(() => {
    localStorage.setItem("bgmVolume", String(bgmVolume));
    if (audioRef.current) {
      audioRef.current.volume = bgmVolume;
    }
  }, [bgmVolume]);

  // ================= User Info Logic =================
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await api.get("/users/me");
        setUserInfo({
          nickname: res.data.nickname || "",
          profileDescription: res.data.profileDescription || "",
          isSecretMode: res.data.isSecretMode || false
        });
      } catch (err) {
        console.error("Failed to fetch user info", err);
      }
    };
    if (showSettings) {
        fetchUserInfo();
    }
  }, [showSettings]);

  const handleUpdateProfile = async () => {
    setIsSavingProfile(true);
    try {
      await api.patch("/users/update", {
        nickname: userInfo.nickname,
        profileDescription: userInfo.profileDescription,
        isSecretMode: userInfo.isSecretMode 
      });
      showToast("설정이 성공적으로 저장되었습니다.", "success"); // [Changed] alert -> toast
    } catch (err) {
      console.error(err);
      showToast("저장에 실패했습니다.", "error"); // [Changed] alert -> toast
    } finally {
      setIsSavingProfile(false);
    }
  };

  // [MODIFIED] 시크릿 모드 토글 (즉시 서버 반영)
  const toggleSecretMode = async () => {
      // 1. 변경할 값 계산
      const nextValue = !userInfo.isSecretMode;
      
      // 2. 낙관적 업데이트 (UI 먼저 반영)
      setUserInfo(prev => ({ ...prev, isSecretMode: nextValue }));

      try {
          // 3. 서버로 즉시 전송 (기존 Update API 재사용)
          // 주의: 닉네임과 설명도 현재 상태 그대로 같이 보내야 함 (PATCH 특성에 따라 다를 수 있지만 안전하게)
          await api.patch("/users/update", {
              nickname: userInfo.nickname,
              profileDescription: userInfo.profileDescription,
              isSecretMode: nextValue 
          });
          
          // 4. 성공 토스트 (선택 사항 - 너무 자주 뜨면 귀찮을 수 있으니 짧게 하거나 생략 가능)
          // showToast(nextValue ? "시크릿 모드가 켜졌습니다." : "시크릿 모드가 꺼졌습니다.", "success");

      } catch (err) {
          console.error("Failed to toggle secret mode", err);
          
          // 5. 실패 시 롤백 (UI 원상 복구)
          setUserInfo(prev => ({ ...prev, isSecretMode: !nextValue }));
          showToast("설정 변경에 실패했습니다.", "error");
      }
  };

  // ================= Chat Logic =================
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
    if (text && energy <= 0) {
      showToast("에너지가 부족합니다. 내일 다시 대화해주세요!", "error");
      return;
    }
    if (text) {
        setEnergy(prev => Math.max(0, prev - 1));
        setMessages(prev => [...prev, { role: 'USER', cleanContent: text }]);
    }

    setIsTyping(true);
    setCurrentScene(null); 

    try {
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

  const handleTriggerEvent = async () => {
    if (energy < 2) return showToast("이벤트를 실행하려면 에너지 2가 필요합니다.", "info");
    setEnergy(prev => Math.max(0, prev - 2)); 
    setIsTyping(true); 

    try {
        const res = await api.post(`/story/rooms/${roomId}/events`);
        const { eventMessage, userEnergy } = res.data; 

        setEnergy(userEnergy); 

        const systemMsg = { role: 'SYSTEM', cleanContent: eventMessage };
        setMessages(prev => [...prev, systemMsg]);

        setCurrentScene({ 
            dialogue: "", 
            narration: eventMessage, 
            emotion: displayedEmotion, 
            isEvent: true
        });

    } catch (err) {
        console.error("Event trigger failed", err);
        showToast("이벤트 생성에 실패했습니다.", "error");
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

  const handleNextScene = () => {
    if (currentScene?.isEvent) {
        handleSendMessage(null); 
        return;
    }
    if (sceneQueue.length > 0) {
      const nextScene = sceneQueue[0];
      setCurrentScene(nextScene);
      setSceneQueue(prev => prev.slice(1));
    }
  };

  // [Changed] 커스텀 모달 적용
  const handleClearHistory = () => {
    openConfirm(
        "정말로 모든 기억을 지우시겠습니까?\n이 작업은 되돌릴 수 없습니다.",
        async () => {
            try {
                await api.delete(`/chat/rooms/${roomId}`);
                setMessages([]);
                setCurrentScene({ dialogue: "...", emotion: "SAD", narration: "...모든 기억이 희미해집니다..." });
                setAffection(0);
                showToast("모든 대화 기록이 초기화되었습니다.", "success");
                closeConfirm();
            } catch (err) {
                showToast("오류가 발생했습니다.", "error");
                closeConfirm();
            }
        },
        'danger'
    );
  };

  // [Changed] 커스텀 모달 적용
  const handleLogout = () => {
      openConfirm(
          "로그아웃 하시겠습니까?",
          async () => {
              await logout();
              window.location.href = "/login";
          },
          'info'
      );
  };

  if (!roomInfo) return <div className="h-full flex items-center justify-center text-white/50">Loading...</div>;

  return (
    <div className="relative w-full h-screen font-sans overflow-hidden bg-gray-900">
      <img 
        src="/backgrounds/room_night.png"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-80"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 z-0" />

      <CharacterDisplay emotion={displayedEmotion} />

      {/* 우측 상단 버튼 그룹 */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
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

        <button 
            onClick={() => setShowSettings(true)}
            className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white/80 hover:bg-white/20 transition border border-white/10 shadow-lg relative group"
            title="설정"
        >
            <Settings size={20} />
            {userInfo.isSecretMode && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-black/50" />}
        </button>

        <button 
            onClick={() => setShowHistory(true)}
            className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white/80 hover:bg-white/20 transition border border-white/10 shadow-lg"
            title="지난 대화"
        >
            <MessageSquare size={20} />
        </button>
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
        onTriggerEvent={handleTriggerEvent} 
      />

      {/* ================= [NEW] Toast Notification ================= */}
      <AnimatePresence>
        {toast && (
            <motion.div
                initial={{ opacity: 0, y: -20, x: "-50%" }}
                animate={{ opacity: 1, y: 0, x: "-50%" }}
                exit={{ opacity: 0, y: -20, x: "-50%" }}
                className={`fixed top-10 left-1/2 z-[100] px-6 py-3 rounded-full backdrop-blur-xl shadow-2xl border flex items-center gap-3 min-w-[300px] justify-center
                    ${toast.type === 'error' ? 'bg-red-900/80 border-red-500/50 text-red-100' : 
                      toast.type === 'success' ? 'bg-green-900/80 border-green-500/50 text-green-100' :
                      'bg-indigo-900/80 border-indigo-500/50 text-indigo-100'}`}
            >
                {toast.type === 'error' ? <AlertTriangle size={18}/> : 
                 toast.type === 'success' ? <CheckCircle size={18}/> : <Info size={18}/>}
                <span className="text-sm font-medium">{toast.message}</span>
            </motion.div>
        )}
      </AnimatePresence>

      {/* ================= [NEW] Custom Confirm Modal ================= */}
      <AnimatePresence>
        {confirmModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    onClick={closeConfirm}
                />
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative bg-[#1a1a24] border border-white/10 p-8 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"/>
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        {confirmModal.type === 'danger' ? <AlertTriangle className="text-rose-500"/> : <Info className="text-indigo-400"/>}
                        확인
                    </h3>
                    <p className="text-gray-300 mb-8 whitespace-pre-wrap leading-relaxed">
                        {confirmModal.message}
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button 
                            onClick={closeConfirm}
                            className="px-5 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition text-sm font-medium"
                        >
                            취소
                        </button>
                        <button 
                            onClick={confirmModal.onConfirm}
                            className={`px-6 py-2.5 rounded-lg text-white text-sm font-bold shadow-lg transition transform active:scale-95
                                ${confirmModal.type === 'danger' 
                                    ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500' 
                                    : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500'}`}
                        >
                            확인
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* ================= Settings Modal ================= */}
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
                <div className={`flex justify-between items-center p-6 border-b transition-colors duration-500 ${userInfo.isSecretMode ? 'border-red-900/50 bg-red-950/20' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-xl font-bold flex items-center gap-2 ${userInfo.isSecretMode ? 'text-red-400' : 'text-white'}`}>
                        {userInfo.isSecretMode ? <Unlock size={20}/> : <Settings size={20} className="text-indigo-400"/>}
                        {userInfo.isSecretMode ? "Secret Settings" : "Settings"}
                    </h2>
                    <button onClick={() => setShowSettings(false)} className="p-2 rounded-full hover:bg-white/10 transition">
                        <X size={24} className="text-white/70" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar pb-32">
                    
                    {/* [MOVED UP] 1. User Settings (위치를 위로 변경하여 툴팁 짤림 방지) */}
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
                            
                            {/* My Persona */}
                            <div className="relative">
                                <label className="block text-xs text-gray-500 mb-1 flex justify-between">
                                    My Persona (Secret Mode Only)
                                    {!userInfo.isSecretMode && <Lock size={12} className="text-gray-500"/>}
                                </label>
                                <textarea 
                                    value={userInfo.profileDescription}
                                    onChange={(e) => setUserInfo({...userInfo, profileDescription: e.target.value})}
                                    disabled={!userInfo.isSecretMode} 
                                    className={`w-full h-32 bg-white/5 border rounded-lg px-4 py-3 text-white outline-none resize-none transition custom-scrollbar leading-relaxed
                                        ${userInfo.isSecretMode 
                                            ? 'border-red-500/30 focus:border-red-500/60 bg-red-900/5' 
                                            : 'border-white/10 opacity-50 cursor-not-allowed grayscale'
                                        }`}
                                    placeholder={
                                        userInfo.isSecretMode 
                                        ? "캐릭터에게 보여질 나의 설정, 외모, 성격 등을 자유롭게 적어주세요. \n(예: 나는 키 188cm에 몸무게 88kg, 그리고 골격근량 48kg, 체지방 8%를 유지하고 있으며...)" 
                                        : "🔒 시크릿 모드를 활성화하면 페르소나를 설정할 수 있습니다."
                                    }
                                />
                            </div>

                            <button 
                                onClick={handleUpdateProfile}
                                disabled={isSavingProfile}
                                className={`w-full py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 disabled:opacity-50
                                    ${userInfo.isSecretMode 
                                        ? 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white shadow-lg shadow-red-900/20' 
                                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                    }`}
                            >
                                <Save size={18} />
                                {isSavingProfile ? "Saving..." : "Save Settings"}
                            </button>
                        </div>
                    </section>

                    <div className="h-px bg-white/10" />

                    {/* [MOVED DOWN] 2. Game Settings (Secret Mode Toggle) */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Gamepad2 size={16}/> Game Options
                        </h3>
                        <div className="space-y-6">
                            {/* Secret Mode Toggle */}
                            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 relative group">
                                <div className="flex flex-col">
                                    <span className={`text-sm font-bold flex items-center gap-2 ${userInfo.isSecretMode ? 'text-red-400' : 'text-gray-300'}`}>
                                        Secret Mode (개발자 모드)
                                        {userInfo.isSecretMode && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">ON</span>}
                                    </span>
                                    <span className="text-xs text-gray-500 mt-1">대화의 모든 리미트를 해제합니다.</span>
                                </div>

                                {/* Toggle Switch */}
                                <button 
                                    onClick={toggleSecretMode}
                                    className={`w-12 h-7 rounded-full transition-colors duration-300 relative ${userInfo.isSecretMode ? 'bg-red-600' : 'bg-gray-700'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-md absolute top-1 left-1 transition-transform duration-300 ${userInfo.isSecretMode ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>

                                {/* Tooltip for Secret Mode (이제 아래쪽에 있어서 위로 뜰 공간 확보됨) */}
                                <div className="absolute right-0 bottom-full mb-3 w-64 bg-black/95 border border-red-500/30 p-4 rounded-xl text-xs text-gray-300
                                opacity-0 group-hover:opacity-100 transition-opacity duration-200
                                pointer-events-none z-50 shadow-2xl backdrop-blur-xl">
                                   <p className="font-bold text-red-400 mb-2 text-sm flex items-center gap-2">
                                     <Lock size={14} /> Secret Mode란?
                                   </p>
                                   <p className="leading-relaxed text-gray-400 mb-2">
                                     캐릭터의 윤리적 제약을 해제하고 <span className="text-red-300 font-bold">자유로운 대화</span>가 가능해집니다.
                                   </p>
                                   <ul className="list-disc list-inside space-y-1 text-gray-500">
                                     <li>호감도가 더 쉽게 오릅니다.</li>
                                     <li><span className="text-indigo-300">My Persona</span> 설정이 해금됩니다.</li>
                                   </ul>
                                </div>
                            </div>

                            {/* Dummy Options */}
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between text-xs text-gray-400 mb-2">
                                  <span className="flex items-center gap-2">
                                    BGM Volume
                                    {bgmVolume === 0 && <span className="text-[10px] text-gray-500">(Muted)</span>}
                                  </span>
                                  <span>{Math.round(bgmVolume * 100)}%</span>
                                </div>

                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  value={Math.round(bgmVolume * 100)}
                                  onChange={(e) => setBgmVolume(Number(e.target.value) / 100)}
                                  className="w-full accent-indigo-500"
                                />

                                <div className="mt-2 flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => setBgmVolume(0)}
                                    className="text-[11px] text-gray-400 hover:text-white transition"
                                  >
                                    Mute
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setBgmVolume(0.5)}
                                    className="text-[11px] text-gray-400 hover:text-white transition"
                                  >
                                    Reset
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setBgmVolume(1)}
                                    className="text-[11px] text-gray-400 hover:text-white transition"
                                  >
                                    Max
                                  </button>
                                </div>
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
      
      {/* 히스토리 모달 */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
            className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-black/90 backdrop-blur-2xl z-50 shadow-2xl border-l border-white/10 flex flex-col"
          >
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/40">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <MessageSquare size={20} className="text-pink-500"/>
                지난 대화 기록
              </h2>
              <button onClick={() => setShowHistory(false)} className="p-2 rounded-full hover:bg-white/10 transition">
                <X size={24} className="text-white/70" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {messages.length === 0 ? <div className="text-center text-white/30 py-10">기록이 없습니다.</div> : messages.map((msg, idx) => {
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
            <div className="p-6 border-t border-white/10 bg-black/40">
              {/* [Changed] 버튼 클릭 시 커스텀 모달 호출 */}
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