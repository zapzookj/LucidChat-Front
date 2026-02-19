import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import CharacterDisplay from "../components/CharacterDisplay";
import DialogueBox from "../components/DialogueBox";
import BackgroundDisplay from "../components/BackgroundDisplay";
import AudioEngine from "../components/AudioEngine";
import EndingCredits from "../components/Endingcredits";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, MessageSquare, Trash2, Settings, Music, VolumeX, 
  LogOut, User as UserIcon, Gamepad2, Save, Sparkles, Lock, Unlock,
  CheckCircle, AlertTriangle, Info, Zap, Play, SkipForward,
  Heart, Crown, MapPin, Shirt
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
  
  // [Phase 4] 씬 디렉션 상태
  const [currentLocation, setCurrentLocation] = useState("ENTRANCE");
  const [currentTime, setCurrentTime] = useState("NIGHT");
  const [currentOutfit, setCurrentOutfit] = useState("MAID");
  const [currentBgmMode, setCurrentBgmMode] = useState(null);
  
  // [상태 정보]
  const [affection, setAffection] = useState(0);
  const [energy, setEnergy] = useState(user?.energy || 100);
  const [isTyping, setIsTyping] = useState(false);

  // 인트로 시퀀스 상태 ('none' | 'door' | 'greeting')
  const [introStep, setIntroStep] = useState('none');
  const [isLoading, setIsLoading] = useState(true); // 깜빡임 방지용
  
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

  // [알림/모달 상태]
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  // 이벤트 선택지 모달 상태
  const [eventOptions, setEventOptions] = useState(null);

  // ━━━ [Phase 4.2] 관계 승급 이벤트 상태 ━━━
  const [promotionOverlay, setPromotionOverlay] = useState(null);   // null | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'SUCCESS_PENDING' | 'FAILURE_PENDING'
  const [promotionProgress, setPromotionProgress] = useState(null); // IN_PROGRESS 배너용 { target, displayName, turnsRemaining, moodScore }
  const [promotionResult, setPromotionResult] = useState(null);     // 오버레이에 표시할 이벤트 데이터

  // ━━━ [Phase 4.3] 엔딩 이벤트 상태 ━━━
  const [endingTrigger, setEndingTrigger] = useState(null);       // { endingType: 'HAPPY' | 'BAD' }
  const [endingData, setEndingData] = useState(null);             // EndingResponse from backend
  const [showEndingCredits, setShowEndingCredits] = useState(false); // 엔딩 크레딧 표시 여부
  const [endingLoading, setEndingLoading] = useState(false);      // 엔딩 생성 로딩

  const logsEndRef = useRef(null);

  // ================= Helper Functions =================
  const showToast = (message, type = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  const openConfirm = (message, onConfirm, type = 'danger') => {
      setConfirmModal({ message, onConfirm, type });
  };

  const closeConfirm = () => {
      setConfirmModal(null);
  };

  // ================= Image Preloading (Phase 4: outfit-aware) =================
  useEffect(() => {
    const outfits = ["maid"];
    const emotions = ["neutral","joy","sad","angry","shy","surprise","panic","disgust","relax","frightened","flirtatious","heated"];
    outfits.forEach(outfit => {
      emotions.forEach(emo => {
        const img = new Image();
        img.src = `/characters/${outfit}_${emo}.png`;
      });
    });
  }, []);

  // ================= BGM Logic (Phase 4: AudioEngine handles playback) =================
  const toggleBgm = () => {
    setIsBgmPlaying(!isBgmPlaying);
  };

  // 인트로 완료 시 BGM 자동 시작
  // bgmMode와 isBgmPlaying을 반드시 같은 effect에서 동시에 세팅해야
  // AudioEngine이 unmuted 상태에서 audio를 생성 → Autoplay Policy 통과
  useEffect(() => {
    if (introStep === 'none' && !isLoading && !isBgmPlaying) {
      const restoredBgm = roomInfo?.currentBgmMode || "DAILY";
      setCurrentBgmMode(restoredBgm);
      setIsBgmPlaying(true);
    }
  }, [introStep, isLoading]);

  useEffect(() => {
    localStorage.setItem("bgmVolume", String(bgmVolume));
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
    // 설정창뿐 아니라 초기 로딩 시에도 시크릿 모드 정보가 필요함 (이벤트 카드용)
    fetchUserInfo();
  }, []); // Mount 시 한 번 실행

  // 설정창 열릴 때 리프레시
  useEffect(() => {
      if(showSettings) {
          api.get("/users/me").then(res => setUserInfo(prev => ({...prev, isSecretMode: res.data.isSecretMode})));
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
      showToast("프로필이 성공적으로 저장되었습니다.", "success");
    } catch (err) {
      console.error(err);
      showToast("저장에 실패했습니다.", "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const toggleSecretMode = async () => {
      const nextValue = !userInfo.isSecretMode;
      setUserInfo(prev => ({ ...prev, isSecretMode: nextValue }));

      try {
          await api.patch("/users/update", {
              nickname: userInfo.nickname,
              profileDescription: userInfo.profileDescription,
              isSecretMode: nextValue 
          });
      } catch (err) {
          setUserInfo(prev => ({ ...prev, isSecretMode: !nextValue }));
          showToast("설정 변경에 실패했습니다.", "error");
      }
  };

  // 길면 여러 씬으로 쪼개는 유틸 (문장/줄 기준 + maxChars)
const splitNarration = (text, maxChars = 140) => {
  const cleaned = (text ?? "")
    .replace(/^\s*\[NARRATION\]\s*/i, "") // [NARRATION] 태그 제거
    .trim();

  // 줄바꿈 단락 기준
  const paras = cleaned.split(/\n+/).map(s => s.trim()).filter(Boolean);

  // 문장 단위로 쪼개기 (마침표/물음표/느낌표/… 기준)
  const sentences = paras.flatMap(p => p.match(/[^.!?…]+[.!?…]?/g) ?? [p]);

  const chunks = [];
  let buf = "";
  for (const s of sentences) {
    if (!buf) buf = s.trim();
    else if ((buf + " " + s).length <= maxChars) buf += " " + s.trim();
    else {
      chunks.push(buf.trim());
      buf = s.trim();
    }
  }
  if (buf) chunks.push(buf.trim());
  return chunks;
};

  // ================= Init Logic =================
  useEffect(() => {
    const init = async () => {
      if(!roomId) return;
      setIsLoading(true); 

      try {
        // 1. 기본 정보 병렬 로드
        const [roomRes, userRes, logsRes] = await Promise.all([
            api.get(`/chat/rooms/${roomId}`),
            api.get("/users/me"),
            api.get(`/chat/rooms/${roomId}/logs?page=0&size=50`)
        ]);

        setRoomInfo(roomRes.data);
        // [Phase 4.3] 이미 엔딩에 도달한 채팅방인지 확인
        // if (info.endingReached && info.endingTitle) {
        //   // 이미 엔딩을 본 채팅방 — 안내 토스트
        //   showToast(`엔딩: "${info.endingTitle}" — 초기화하면 다시 시작할 수 있습니다.`, "info");
        // }
        setAffection(roomRes.data.affectionScore);
        // [Fix] 스테일 클로저 방지 — userRes에서 전체 유저 정보를 세팅
        setUserInfo({
            nickname: userRes.data.nickname || "",
            profileDescription: userRes.data.profileDescription || "",
            isSecretMode: userRes.data.isSecretMode || false
        });
        // [Fix] Energy sync - force sync with actual server energy value
        if (userRes.data.energy !== undefined) {
            setEnergy(userRes.data.energy);
        }
        // [Fix] 에너지 동기화 — 서버의 실제 에너지 값으로 강제 동기화
        if (userRes.data.energy !== undefined) {
            setEnergy(userRes.data.energy);
        }

        // [Phase 4.1] 씬 상태 복원 (재접속 시 서버에서 마지막 상태 로드)
        // Note: bgmMode는 여기서 복원하지 않음 — auto-start effect에서 isBgmPlaying과 동시에 세팅해야
        // 브라우저 Autoplay Policy 문제를 방지할 수 있음
        if (roomRes.data.currentLocation) setCurrentLocation(roomRes.data.currentLocation);
        if (roomRes.data.currentOutfit) setCurrentOutfit(roomRes.data.currentOutfit);
        if (roomRes.data.currentTimeOfDay) setCurrentTime(roomRes.data.currentTimeOfDay);

        const logs = logsRes.data?.content || [];

        if (logs.length === 0) {
            // [Case A] 신규 유저 -> 인트로 시퀀스 시작
            await startIntroSequence(roomId);
        } else {
            // [Case B] 기존 유저 -> 마지막 상태 복원
            const sortedLogs = logs.reverse();
            setMessages(sortedLogs);
            
            // 마지막 로그가 캐릭터 대사라면 씬 복원
            if (sortedLogs.length > 0) {
               const lastLog = sortedLogs[sortedLogs.length - 1];
               if (lastLog.role === 'ASSISTANT') {
                 setCurrentScene({
                   dialogue: lastLog.cleanContent,
                   narration: "",
                   emotion: lastLog.emotionTag || "NEUTRAL"
                 });
                 setDisplayedEmotion(lastLog.emotionTag || "NEUTRAL");
               }
            }
        }
      } catch (err) {
        console.error("Init Error", err);
        showToast("초기화 중 오류가 발생했습니다.", "error");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [roomId]);

  const startIntroSequence = async (roomId) => {
      setIntroStep('door'); // 1. 영상 재생 시작
      
      try {
          // 2. 백엔드 init (나레이션 + 첫인사 생성)
          await api.post(`/chat/rooms/${roomId}/init`);
          
          // 3. 생성된 로그 가져오기
          const logsRes = await api.get(`/chat/rooms/${roomId}/logs?page=0&size=5`);
          const newLogs = logsRes.data.content.reverse();
          
          setMessages(newLogs);

          // 4. 씬 큐(Scene Queue) 구성
          // UX: 영상이 끝나면(IntroStep none) -> System 나레이션 재생 -> Assistant 대사 재생
          const queue = [];
          
          // (1) 나레이션 씬
          const narrationLog = newLogs.find(l => l.role === 'SYSTEM');
          if (narrationLog) {
            const parts = splitNarration(narrationLog.cleanContent, 140);
            parts.forEach(part => {
              queue.push({
                  dialogue: "", 
                  narration: part, 
                  emotion: "NEUTRAL",
                  isEvent: true,
                  sceneType: "INTRO",
                  isIntroNarration: true // 캐릭터 숨김용 플래그
              });
            });
          }
          
          // (2) 첫인사 씬
          const greetingLog = newLogs.find(l => l.role === 'ASSISTANT');
          if (greetingLog) {
              queue.push({
                  dialogue: greetingLog.cleanContent,
                  narration: "메이드 아이리가 고개를 숙여 인사하며 부드럽게 미소짓는다.",
                  emotion: greetingLog.emotionTag,
                  isEvent: false,
                  sceneType: "NORMAL"
              });
          }
          
          setSceneQueue(queue); // 큐에 넣고 대기 (영상 끝나면 Scene logic이 돌 것임)
          
      } catch (e) {
          console.error("Intro Sequence Failed", e);
      }
  };

  const handleIntroVideoEnd = () => {
      setIntroStep('none'); // 오버레이 제거 -> 이때부터 DialogueBox가 보임
      // DialogueBox는 sceneQueue에 들어있는 첫 번째(나레이션)를 자동으로 재생 시작
  };

  // ================= Chat Logic =================
  useEffect(() => {
    if (user?.energy !== undefined) {
      setEnergy(user.energy);
    }
  }, [user]);

  // [Phase 4] 씬 전환 시 감정 + 디렉션 업데이트
  useEffect(() => {
    if (!currentScene) return;
    if (currentScene.emotion) {
      setDisplayedEmotion(currentScene.emotion);
    }
    // null이 아닌 값만 업데이트 (null = 이전 상태 유지)
    if (currentScene.location) setCurrentLocation(currentScene.location);
    if (currentScene.time) setCurrentTime(currentScene.time);
    if (currentScene.outfit) setCurrentOutfit(currentScene.outfit);
    if (currentScene.bgmMode) setCurrentBgmMode(currentScene.bgmMode);
  }, [currentScene]);

  // 스크롤 처리
  useEffect(() => {
    if (showHistory && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [showHistory, messages]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  [Phase 4.2] 관계 승급 이벤트 처리
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const getRelationColor = (relation) => {
    switch(relation) {
      case 'ACQUAINTANCE': return { bg: 'from-emerald-600 to-teal-600', border: 'border-emerald-500/50', text: 'text-emerald-300', glow: 'shadow-emerald-500/30' };
      case 'FRIEND': return { bg: 'from-blue-600 to-indigo-600', border: 'border-blue-500/50', text: 'text-blue-300', glow: 'shadow-blue-500/30' };
      case 'LOVER': return { bg: 'from-rose-600 to-pink-600', border: 'border-rose-500/50', text: 'text-rose-300', glow: 'shadow-rose-500/30' };
      default: return { bg: 'from-gray-600 to-gray-700', border: 'border-gray-500/50', text: 'text-gray-300', glow: 'shadow-gray-500/30' };
    }
  };

  const getUnlockIcon = (type) => type === 'LOCATION' ? <MapPin size={22} /> : <Shirt size={22} />;

  const handlePromotionEvent = (promoEvent) => {
    if (!promoEvent) return;
    switch (promoEvent.status) {
      case 'STARTED':
        setPromotionResult(promoEvent);
        setPromotionOverlay('STARTED');
        setPromotionProgress({
          target: promoEvent.targetRelation,
          displayName: promoEvent.targetDisplayName,
          turnsRemaining: promoEvent.turnsRemaining,
          moodScore: 0
        });
        setTimeout(() => setPromotionOverlay(null), 3500);
        break;
      case 'IN_PROGRESS':
        setPromotionProgress({
          target: promoEvent.targetRelation,
          displayName: promoEvent.targetDisplayName,
          turnsRemaining: promoEvent.turnsRemaining,
          moodScore: promoEvent.moodScore
        });
        break;
      case 'SUCCESS':
        setPromotionProgress(null);
        setPromotionResult(promoEvent);
        setPromotionOverlay('SUCCESS_PENDING');
        break;
      case 'FAILURE':
        setPromotionProgress(null);
        setPromotionResult(promoEvent);
        setPromotionOverlay('FAILURE_PENDING');
        break;
    }
  };

  // [Phase 4.3] 엔딩 트리거 감지 후 씬 재생 완료 시 엔딩 생성
  useEffect(() => {
    if (!endingTrigger) return;
    // 현재 씬 큐가 모두 소진되고, 타이핑도 끝나면 엔딩 생성
    if (sceneQueue.length === 0 && !isTyping) {
      // 약간의 딜레이 (마지막 대사 여운)
      const t = setTimeout(() => {
        generateEnding(endingTrigger.endingType);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [endingTrigger, sceneQueue, isTyping]);

  // [Phase 4.3] 엔딩 데이터 생성 API 호출
  const generateEnding = async (endingType) => {
    setEndingLoading(true);
    try {
      const res = await api.post(`/ending/rooms/${roomId}/generate`, { endingType });
      setEndingData(res.data);

      // 엔딩 BGM 즉시 전환
      setCurrentBgmMode(endingType === "HAPPY" ? "ENDING_HAPPY" : "ENDING_BAD");

      // 약간의 딜레이 후 크레딧 표시 (BGM 전환 시간 확보)
      setTimeout(() => {
        setShowEndingCredits(true);
        setEndingLoading(false);
      }, 1500);

    } catch (err) {
      console.error("Ending generation failed:", err);
      showToast("엔딩 생성 중 오류가 발생했습니다.", "error");
      setEndingLoading(false);
      setEndingTrigger(null);
    }
  };

  // [Phase 4.3] 엔딩 씬 변경 콜백 (EndingCredits → 배경/감정 변경)
  const handleEndingSceneChange = (sceneInfo) => {
    if (sceneInfo.emotion) setDisplayedEmotion(sceneInfo.emotion);
    if (sceneInfo.location) setCurrentLocation(sceneInfo.location);
    if (sceneInfo.time) setCurrentTime(sceneInfo.time);
    if (sceneInfo.outfit) setCurrentOutfit(sceneInfo.outfit);
    // BGM은 엔딩 전용 BGM 유지 (씬에서 변경하지 않음)
  };

  // [Phase 4.3] 엔딩 크레딧 완료 콜백
  const handleEndingComplete = () => {
    setShowEndingCredits(false);
    setEndingTrigger(null);
    // 엔딩 후 BGM을 일상으로 복원
    setCurrentBgmMode("TOUCHING");
    showToast("엔딩을 감상해주셔서 감사합니다.", "success");
  };

  const dismissPromotionOverlay = () => {
    setPromotionOverlay(null);
    setPromotionResult(null);
  };

  // 씬 큐 소진 후 pending → 실제 오버레이 표시
  useEffect(() => {
    if (sceneQueue.length === 0 && currentScene && !isTyping) {
      if (promotionOverlay === 'SUCCESS_PENDING') {
        setTimeout(() => setPromotionOverlay('SUCCESS'), 800);
      } else if (promotionOverlay === 'FAILURE_PENDING') {
        setTimeout(() => setPromotionOverlay('FAILURE'), 800);
      }
    }
  }, [sceneQueue, currentScene, isTyping, promotionOverlay]);

  const handleSendMessage = async (text) => {
    if (text && energy <= 0 && !endingTrigger) {
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

      const { scenes, currentAffection, promotionEvent, endingTrigger: endingTrig } = res.data;
      setAffection(currentAffection);
      
      if (scenes && scenes.length > 0) {
        setSceneQueue(scenes); 
      }

      const combinedText = scenes.map(s => s.dialogue).join(" ");
      setMessages(prev => [...prev, { role: 'ASSISTANT', cleanContent: combinedText }]);

      // [Phase 4.2] 승급 이벤트 처리
      if (promotionEvent) {
        handlePromotionEvent(promotionEvent);
      }

      // [Phase 4.3] 엔딩 트리거 감지
      if (endingTrig) {
        setEndingTrigger(endingTrig);
      }

    } catch (err) {
      console.error(err);
      setCurrentScene({ dialogue: `잠시만요.. ${roomInfo?.characterName || '그녀'}가 잠깐 바쁜 일이 있어서...`, emotion: "SAD", narration: "잠시 후 다시 시도해주세요." });
      setDisplayedEmotion("SAD");
    } finally {
      setIsTyping(false);
    }
  };

  // 이벤트 트리거 -> 옵션 받기 (1단계)
  const handleTriggerEvent = async () => {
    setIsTyping(true); 
    try {
        const res = await api.post(`/story/rooms/${roomId}/events`);
        
        // 옵션 모달을 띄운다
        if (res.data.options && res.data.options.length > 0) {
            setEventOptions(res.data.options);
        } else {
            showToast("이벤트 생성에 실패했습니다.", "error");
        }
    } catch (err) {
        console.error("Event trigger failed", err);
        showToast("이벤트 생성 실패", "error");
    } finally {
        setIsTyping(false);
    }
  };

  // 이벤트 선택 -> 실행 (2단계)
  const handleSelectEvent = async (option) => {
      // 1. 에너지 체크
      if (energy < option.energyCost) {
          showToast(`에너지가 부족합니다. (필요: ${option.energyCost})`, "error");
          return;
      }
      // 2. 시크릿 모드 체크
      if (option.type === 'SECRET' && !userInfo.isSecretMode) {
          showToast("시크릿 모드 활성화가 필요합니다.", "info");
          return;
      }

      // UX: 로딩 중일 때 이전 대사 지우기 (몰입감)
      setCurrentScene({ dialogue: "", narration: "운명의 흐름을 읽는 중...", emotion: displayedEmotion, isEvent: true });
      setEventOptions(null); // 모달 닫기
      setIsTyping(true);
      setEnergy(prev => Math.max(0, prev - option.energyCost)); // 선차감(낙관적)

      try {
          const res = await api.post(`/story/rooms/${roomId}/events/select`, {
              detail: option.detail,
              energyCost: option.energyCost
          });
          
          // 결과 처리 (Narrator Message + Character Reaction)
          const { scenes, currentAffection } = res.data;
          setAffection(currentAffection);
          // 큐구성: [이벤트 나레이션] -> [캐릭터 반응1] -> [반응2]...
          const newQueue = [];
          
          // 1. 이벤트 나레이션 (옵션의 detail)
          newQueue.push({
              dialogue: "",
              narration: option.detail, // 선택한 상황 묘사
              emotion: displayedEmotion, // 감정 유지
              isEvent: true // 이벤트 씬 플래그
          });
          
          // 2. 캐릭터 반응 추가
          if (scenes?.length) {
              newQueue.push(...scenes);
          }
          
          setSceneQueue(newQueue);

          // 로그 업데이트 (히스토리용)
          setMessages(prev => [
              ...prev, 
              { role: 'SYSTEM', cleanContent: option.detail },
              { role: 'ASSISTANT', cleanContent: scenes.map(s => s.dialogue).join(" ") }
          ]);

      } catch (e) { 
          showToast("오류 발생", "error"); 
          setCurrentScene(null);
      } finally { 
          setIsTyping(false); 
      }
  };

  // 씬 전환 로직 (자동 "..." 발송 제거)
  const handleNextScene = () => {
    // 큐에 남은 씬이 있다면 다음 씬 재생
    if (sceneQueue.length > 0) {
      const nextScene = sceneQueue[0];
      setCurrentScene(nextScene);
      setSceneQueue(prev => prev.slice(1));
    } 
    // 큐가 비었다면 대기 (사용자 입력 대기)
  };

  // 큐 자동 재생 (초기 진입 시)
  useEffect(() => {
    if (!currentScene && sceneQueue.length > 0) {
      const nextScene = sceneQueue[0];
      setCurrentScene(nextScene);
      setSceneQueue(prev => prev.slice(1));
    }
  }, [sceneQueue, currentScene]);

  const handleClearHistory = () => {
    openConfirm(
        "정말로 모든 기억을 지우시겠습니까?\n이 작업은 되돌릴 수 없습니다.",
        async () => {
            try {
                await api.delete(`/chat/rooms/${roomId}`);
                setMessages([]);
                setAffection(0);
                // [Phase 4] 씬 디렉션 초기화
                setCurrentLocation("ENTRANCE");
                setCurrentTime("NIGHT");
                setCurrentOutfit("MAID");
                setCurrentBgmMode("DAILY");
                // [Phase 4.2] 승급 이벤트 상태 초기화
                setPromotionOverlay(null);
                setPromotionProgress(null);
                setPromotionResult(null);
                // [Phase 4.3] 엔딩 상태 초기화
                setEndingTrigger(null);
                setEndingData(null);
                setShowEndingCredits(false);
                // [Fix] Energy re-sync - restore from server after clear
                try {
                    const freshUser = await api.get("/users/me");
                    if (freshUser.data.energy !== undefined) setEnergy(freshUser.data.energy);
                } catch (_) { /* ignore energy sync failure */ }
                // [Fix] 에너지 재동기화 — 서버의 실제 에너지 값으로 복원
                try {
                    const freshUser = await api.get("/users/me");
                    if (freshUser.data.energy !== undefined) setEnergy(freshUser.data.energy);
                } catch (_) { /* 에너지 동기화 실패 무시 */ }
                showToast("초기화되었습니다. 새로운 만남을 시작합니다.", "success");
                closeConfirm();
                
                // 초기화 후 인트로 다시 시작
                startIntroSequence(roomId);

            } catch (err) {
                showToast("오류가 발생했습니다.", "error");
                closeConfirm();
            }
        },
        'danger'
    );
  };

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

  if (isLoading || !roomInfo) return <div className="h-full flex items-center justify-center bg-gray-900 text-white/30 animate-pulse">Loading Lucid Chat...</div>;

  return (
    <div className="relative w-full h-screen font-sans overflow-hidden bg-gray-900">
      
      {/* [Phase 4] Dynamic Background */}
      <BackgroundDisplay location={currentLocation} time={currentTime} />

      {/* [Phase 4] Audio Engine (BGM + Ambience + SFX) */}
      <AudioEngine 
        bgmMode={currentBgmMode}
        location={currentLocation}
        time={currentTime}
        masterVolume={bgmVolume}
        isMuted={!isBgmPlaying}
      />

      {/* ================= Intro Cinematic Overlay ================= */}
      <AnimatePresence>
          {introStep === 'door' && (
              <motion.div 
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }} 
                  transition={{ duration: 1.5 }} // 천천히 페이드 아웃
                  className="absolute inset-0 z-[999] bg-black flex flex-col items-center justify-center"
              >
                  <video 
                      autoPlay playsInline 
                      onEnded={handleIntroVideoEnd} 
                      onClick={handleIntroVideoEnd}
                      className="w-full h-full object-cover"
                  >
                      <source src="/videos/intro_door.mp4" type="video/mp4" />
                  </video>
                  <div className="absolute bottom-10 w-full text-center animate-pulse">
                      <span className="text-white/30 text-xs tracking-widest cursor-pointer">CLICK TO SKIP</span>
                  </div>
              </motion.div>
          )}
      </AnimatePresence>


      <CharacterDisplay emotion={displayedEmotion} outfit={currentOutfit} />

      {/* ━━━ [Phase 5] Promotion IN_PROGRESS Banner ━━━ */}
      <AnimatePresence>
        {promotionProgress && !promotionOverlay && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute top-6 left-6 z-40"
          >
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-xl border bg-black/60 shadow-lg ${
              getRelationColor(promotionProgress.target).border
            }`}>
              <Heart size={18} className={`${getRelationColor(promotionProgress.target).text} animate-pulse`} fill="currentColor" />
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Promotion Event</span>
                <span className={`text-xs font-bold ${getRelationColor(promotionProgress.target).text}`}>
                  → {promotionProgress.displayName}
                </span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-500">남은 턴</span>
                <span className="text-sm font-bold text-white">{promotionProgress.turnsRemaining}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-500">분위기</span>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`w-1.5 h-3 rounded-full transition-colors ${
                      i < Math.max(0, promotionProgress.moodScore)
                        ? 'bg-yellow-400'
                        : 'bg-white/10'
                    }`} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Buttons */}
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

      {/* ================= Event Selection Modal (3-Branch) ================= */}
      <AnimatePresence>
        {eventOptions && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                    {eventOptions.map((opt, idx) => {
                        const isLocked = opt.type === 'SECRET' && !userInfo.isSecretMode;
                        const isNoEnergy = energy < opt.energyCost;
                        
                        return (
                            <button
                                key={idx}
                                onClick={() => !isLocked && !isNoEnergy && handleSelectEvent(opt)}
                                disabled={isLocked || isNoEnergy}
                                className={`relative group h-[400px] rounded-2xl border overflow-hidden transition-all duration-300 flex flex-col items-center justify-center p-6 text-center
                                    ${opt.type === 'SECRET' 
                                        ? 'border-red-500/50 bg-gradient-to-b from-red-900/80 to-black/80 hover:scale-105 hover:border-red-400 hover:shadow-[0_0_30px_rgba(220,38,38,0.5)]' 
                                        : opt.type === 'AFFECTION'
                                            ? 'border-pink-500/50 bg-gradient-to-b from-pink-900/80 to-black/80 hover:scale-105 hover:border-pink-400 hover:shadow-[0_0_30px_rgba(236,72,153,0.5)]'
                                            : 'border-indigo-500/50 bg-gradient-to-b from-indigo-900/80 to-black/80 hover:scale-105 hover:border-indigo-400 hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]'
                                    }
                                    ${(isLocked || isNoEnergy) ? 'opacity-50 grayscale cursor-not-allowed hover:scale-100' : ''}
                                `}
                            >
                                {/* Icon & Title */}
                                <div className="mb-4">
                                    {opt.type === 'SECRET' ? <Sparkles size={40} className="text-red-400 animate-pulse"/> :
                                     opt.type === 'AFFECTION' ? <Sparkles size={40} className="text-pink-400"/> :
                                     <Zap size={40} className="text-indigo-400"/>}
                                </div>
                                
                                <h3 className={`text-xl font-bold mb-2 ${
                                    opt.type === 'SECRET' ? 'text-red-100' : opt.type === 'AFFECTION' ? 'text-pink-100' : 'text-indigo-100'
                                }`}>
                                    {opt.summary}
                                </h3>

                                {/* Secret Lock Mask */}
                                {isLocked ? (
                                    <div className="absolute inset-0 backdrop-blur-md flex flex-col items-center justify-center bg-black/40 z-10">
                                        <Lock size={48} className="text-gray-400 mb-2"/>
                                        <span className="text-gray-300 font-bold text-sm">Secret Mode Only</span>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-300 line-clamp-4 leading-relaxed mb-6">
                                        {opt.detail}
                                    </p>
                                )}

                                {/* Cost Badge */}
                                <div className={`px-4 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1
                                    ${isNoEnergy ? 'bg-gray-700 text-gray-400 border-gray-600' : 
                                      'bg-black/50 text-white border-white/20'}`}>
                                    <Zap size={12} className={isNoEnergy ? "text-gray-500" : "text-yellow-400"} fill={isNoEnergy ? "none" : "currentColor"} />
                                    Cost: {opt.energyCost}
                                </div>

                                {isNoEnergy && <span className="text-red-400 text-xs mt-2 font-bold">에너지 부족!</span>}
                            </button>
                        )
                    })}
                </motion.div>
                
                {/* Close Modal (Background Click) */}
                <div className="absolute inset-0 -z-10" onClick={() => setEventOptions(null)} />
            </div>
        )}
      </AnimatePresence>

      {/* ━━━━━━━ [Phase 5] PROMOTION STARTED Overlay ━━━━━━━ */}
      <AnimatePresence>
        {promotionOverlay === 'STARTED' && promotionResult && (() => {
          const rc = getRelationColor(promotionResult.targetRelation);
          return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            {/* 파티클 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: '100vh', x: `${Math.random() * 100}vw` }}
                  animate={{ opacity: [0, 0.6, 0], y: '-10vh' }}
                  transition={{ duration: 3 + Math.random() * 2, delay: Math.random() * 1.5, repeat: Infinity }}
                  className={`absolute w-1 h-1 rounded-full ${
                    i % 3 === 0 ? 'bg-yellow-400' : i % 3 === 1 ? 'bg-pink-400' : 'bg-white'
                  }`}
                />
              ))}
            </div>

            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.3 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.5 }}
                className="mx-auto mb-6"
              >
                <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${rc.bg} flex items-center justify-center shadow-2xl ${rc.glow}`}>
                  <Heart size={36} className="text-white" fill="currentColor" />
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="text-gray-400 text-sm tracking-widest uppercase mb-3"
              >
                Relationship Event
              </motion.p>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
                className="text-3xl font-bold text-white mb-2"
              >
                관계 변화의 기운이 느껴집니다
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3 }}
                className={`text-lg font-bold ${rc.text}`}
              >
                → {promotionResult.targetDisplayName} 승급 이벤트
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 2.0 }}
                className="text-xs text-gray-500 mt-6"
              >
                다음 {promotionResult.turnsRemaining}턴 동안 그녀의 마음을 움직이세요
              </motion.p>
            </motion.div>
          </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ━━━━━━━ [Phase 5] PROMOTION SUCCESS Overlay ━━━━━━━ */}
      <AnimatePresence>
        {promotionOverlay === 'SUCCESS' && promotionResult && (() => {
          const rc = getRelationColor(promotionResult.targetRelation);
          return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-lg"
            onClick={dismissPromotionOverlay}
          >
            {/* 축하 컨페티 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(40)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: '-10vh', x: `${Math.random() * 100}vw`, rotate: 0 }}
                  animate={{ opacity: [0, 1, 0], y: '110vh', rotate: 360 * (Math.random() > 0.5 ? 1 : -1) }}
                  transition={{ duration: 3 + Math.random() * 3, delay: Math.random() * 2, repeat: Infinity }}
                  className={`absolute rounded-sm ${
                    i % 5 === 0 ? 'w-2 h-3 bg-yellow-400' :
                    i % 5 === 1 ? 'w-1.5 h-2.5 bg-pink-400' :
                    i % 5 === 2 ? 'w-2 h-2 bg-indigo-400' :
                    i % 5 === 3 ? 'w-1 h-3 bg-emerald-400' :
                    'w-2.5 h-1 bg-white/80'
                  }`}
                />
              ))}
            </div>

            <div className="text-center max-w-md mx-auto px-6">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
                className="mx-auto mb-6"
              >
                <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${rc.bg} flex items-center justify-center shadow-2xl ${rc.glow} ring-4 ring-white/20`}>
                  <Crown size={44} className="text-white" />
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-yellow-400 text-sm tracking-[0.3em] uppercase font-bold mb-2"
              >
                Relationship Up
              </motion.p>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="text-3xl font-bold text-white mb-1"
              >
                {promotionResult.targetDisplayName}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
                className="text-gray-400 text-sm mb-8"
              >
                아이리와의 관계가 깊어졌습니다
              </motion.p>

              {/* 해금 카드 */}
              {promotionResult.unlocks && promotionResult.unlocks.length > 0 && (
                <div className="space-y-3 mb-8">
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    className="text-xs text-gray-500 uppercase tracking-widest mb-4"
                  >
                    New Unlocks
                  </motion.p>
                  {promotionResult.unlocks.map((unlock, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.4 + idx * 0.25, type: "spring", stiffness: 200 }}
                      className={`flex items-center gap-4 px-5 py-3.5 rounded-xl border bg-white/5 backdrop-blur-sm ${rc.border}`}
                    >
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${rc.bg} flex items-center justify-center shadow-md text-white`}>
                        {getUnlockIcon(unlock.type)}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="text-[10px] text-gray-500 uppercase">
                          {unlock.type === 'LOCATION' ? '장소 해금' : '복장 해금'}
                        </span>
                        <p className="text-white font-bold text-sm">{unlock.displayName}</p>
                      </div>
                      <Unlock size={16} className={rc.text} />
                    </motion.div>
                  ))}
                </div>
              )}

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                transition={{ delay: 2.0 + (promotionResult.unlocks?.length || 0) * 0.25 }}
                className="text-xs text-gray-500"
              >
                화면을 터치하여 계속
              </motion.p>
            </div>
          </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ━━━━━━━ [Phase 5] PROMOTION FAILURE Overlay ━━━━━━━ */}
      <AnimatePresence>
        {promotionOverlay === 'FAILURE' && promotionResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md"
            onClick={dismissPromotionOverlay}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="text-center max-w-sm mx-auto px-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="mx-auto mb-6"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-xl ring-4 ring-white/5">
                  <Heart size={36} className="text-gray-500" />
                </div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-2xl font-bold text-white mb-2"
              >
                아쉽게도...
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-gray-400 text-sm mb-2"
              >
                아직 관계가 변하기엔 이른 것 같습니다
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="text-gray-500 text-xs mb-8"
              >
                호감도가 다시 임계점에 도달하면 새로운 기회가 찾아옵니다
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                transition={{ delay: 1.5 }}
                className="text-xs text-gray-600"
              >
                화면을 터치하여 계속
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
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

      {/* Confirm Modal */}
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

      {/* Settings Modal */}
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
                                        ? "캐릭터에게 보여질 나의 설정, 외모, 성격 등을 자유롭게 적어주세요.\n(예: 나는 키 188cm에 몸무게 88kg, 그리고 골격근량 48kg, 체지방 8%를 유지하고 있으며...)" 
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
                                {isSavingProfile ? "Saving..." : "Save Profile Info"}
                            </button>
                        </div>
                    </section>

                    <div className="h-px bg-white/10" />

                    {/* 2. Game Settings */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Gamepad2 size={16}/> Game Options
                        </h3>
                        <div className="space-y-6">
                            {/* Secret Mode Toggle */}
                            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 relative group">
                                <div className="flex flex-col">
                                    <span className={`text-sm font-bold flex items-center gap-2 ${userInfo.isSecretMode ? 'text-red-400' : 'text-gray-300'}`}>
                                        Secret Mode (NSFW)
                                        {userInfo.isSecretMode && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">ON</span>}
                                    </span>
                                    <span className="text-xs text-gray-500 mt-1">대화의 모든 리미트를 해제합니다.</span>
                                </div>

                                <button 
                                    onClick={toggleSecretMode}
                                    className={`w-12 h-7 rounded-full transition-colors duration-300 relative ${userInfo.isSecretMode ? 'bg-red-600' : 'bg-gray-700'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-md absolute top-1 left-1 transition-transform duration-300 ${userInfo.isSecretMode ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>

                                {/* Tooltip */}
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

                            {/* BGM Volume */}
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
                                  <button type="button" onClick={() => setBgmVolume(0)} className="text-[11px] text-gray-400 hover:text-white transition">Mute</button>
                                  <button type="button" onClick={() => setBgmVolume(0.5)} className="text-[11px] text-gray-400 hover:text-white transition">Reset</button>
                                  <button type="button" onClick={() => setBgmVolume(1)} className="text-[11px] text-gray-400 hover:text-white transition">Max</button>
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

      {/* History Modal */}
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

      {/* ━━━━━━━ [Phase 4.3] 엔딩 로딩 오버레이 ━━━━━━━ */}
      <AnimatePresence>
        {endingLoading && (
          <motion.div
            className="fixed inset-0 z-[9998] bg-black/90 flex flex-col items-center justify-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-12 h-12 border-2 border-rose-400/30 border-t-rose-400 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            />
            <motion.p
              className="text-white/50 text-sm tracking-widest"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              서사의 결말을 엮는 중...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━━━━━ [Phase 4.3] 엔딩 크레딧 ━━━━━━━ */}
      <AnimatePresence>
        {showEndingCredits && endingData && (
          <EndingCredits
            endingData={endingData}
            onComplete={handleEndingComplete}
            onSceneChange={handleEndingSceneChange}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatPage;