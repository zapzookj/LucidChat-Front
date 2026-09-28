import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bell, SlidersHorizontal } from "lucide-react";
import DialogueBox from "../components/DialogueBox";
import BiometricStatusPanel from "../components/BiometricStatusPanel";
import BottomSheet from "../components/mobile/BottomSheet";
import StoryV2NotificationPanel from "../components/story-v2/StoryV2NotificationPanel";
import useDeviceProfile from "../hooks/useDeviceProfile";
import { assetUrl } from "../utils/assetUrl";

// Development-only fixture. App must lazy-import this behind import.meta.env.DEV.
// These are the production components, with local example state instead of chat APIs.
const SCENES = {
  dialogue: { narration: "창가로 스며든 오후의 빛. 아이리가 찻잔을 내려놓고 당신을 바라본다.", dialogue: "기다리고 있었어요. 오늘은 어떤 하루를 보내셨나요? 천천히 이야기해 주세요. 저는 어디 가지 않을 테니까요." },
  next: { narration: "아이리는 잠시 망설이다가, 당신 쪽으로 한 걸음 다가왔다.", dialogue: "사실, 주인님께 보여드리고 싶은 게 있어요. 저와 함께 정원으로 가 주실래요?" },
  waiting: { narration: "두 사람 사이로 편안한 침묵이 내려앉는다.", dialogue: "" },
  long: { narration: "오랫동안 닫혀 있던 온실의 문을 열자, 잊고 있던 계절의 향기가 밀려왔다.", dialogue: "이곳은 제가 가장 좋아하는 곳이에요. 비가 오는 날이면 유리 지붕을 두드리는 소리가 정말 아름답거든요. 처음 이 저택에 왔을 때는 모든 게 낯설고 조금 무서웠어요. 그런데 어느 날 주인님이 여기서 책을 읽고 계신 걸 보고, 저도 조금씩 이곳이 좋아지기 시작했죠. 별것 아닌 이야기처럼 들릴 수도 있지만, 오늘은 꼭 말씀드리고 싶었어요. 함께 있는 시간이 제게 얼마나 소중한지요. 다음에 비가 내리면 여기서 다시 만나요. 따뜻한 차와 가장 좋아하시는 과자를 준비해 둘게요." },
  empty: { narration: "따뜻한 차 향기가 오후의 방을 가득 채운다.", dialogue: "차가 식기 전에 드세요. 오늘도 곁에서 함께할게요." },
  story: { isEvent: true, narration: "온실 너머에서 희미한 종소리가 들려온다. 익숙한 저택에 새로운 이야기가 찾아오고 있었다.", dialogue: "당신은 정원으로 향할 수도, 아이리에게 종소리에 관해 물을 수도 있다." },
};
const STATS = { intimacy: 64, affection: 55, dependency: 34, playfulness: 52, trust: 72, lust: 0, corruption: 0, obsession: 0 };
const NOTIFICATIONS = [{ notificationId: "preview-1", fromCharacterName: "아이리", content: "온실에 꽃이 피었어요. 시간이 되시면 같이 보러 가요.", worldDay: 3, worldDayPart: "오후" }];

export default function ChatDesignPreview() {
  const { isMobile } = useDeviceProfile();
  const [scenario, setScenario] = useState("dialogue");
  const [reply, setReply] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sheet, setSheet] = useState("");
  const [notice, setNotice] = useState("");
  const timer = useRef(null);
  const statusToggle = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const changeScenario = (value) => {
    clearTimeout(timer.current);
    setScenario(value);
    setReply(null);
    setWaiting(false);
    setNotice("");
  };
  const sendLocalMessage = (message) => {
    setNotice(`체험 입력: ${message}`);
    setWaiting(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setWaiting(false);
      setReply({ narration: "아이리가 작게 웃으며 고개를 끄덕였다.", dialogue: "그랬군요. 이렇게 이야기를 들려주셔서 기뻐요. 우리, 조금만 더 함께 있을까요?" });
    }, 1300);
  };

  return (
    <main className="relative h-dvh min-h-[480px] overflow-hidden bg-lobby-bg text-lobby-tx0">
      <img src={assetUrl("https://assets.lucid-chat.com/backgrounds/airi/bg_default.png")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-65" />
      <div className="absolute inset-0 bg-gradient-to-b from-lobby-bg/60 via-lobby-bg/10 to-lobby-bg/65" />
      <img src={assetUrl("https://assets.lucid-chat.com/characters/airi/thumbnail.png")} alt="아이리" className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-[88%] max-w-full object-contain object-top" />
      <header className="relative z-30 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-lobby-bg/90 px-4 py-3 backdrop-blur-xl sm:px-7">
        <a href="/" className="flex min-h-11 items-center gap-2 text-sm text-lobby-tx1"><ArrowLeft size={17} /> 로비</a>
        <div className="hidden min-w-0 sm:block"><p className="text-sm font-semibold">AURORA · 대화 공간</p><p className="text-xs text-lobby-tx2">개발용 체험 · 예시 데이터 · 실제 전송 및 구매 없음</p></div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="preview-scenario">체험 상태</label>
          <select id="preview-scenario" value={scenario} onChange={(event) => changeScenario(event.target.value)} className="min-h-11 max-w-[140px] rounded-xl border border-lobby-accent/25 bg-lobby-surface px-3 text-sm text-lobby-tx0">
            <option value="dialogue">일반 대화</option><option value="next">다음 대사</option><option value="waiting">응답 대기</option><option value="long">긴 대사</option><option value="empty">에너지 부족</option><option value="story">스토리 장면</option>
          </select>
          <button type="button" aria-label="알림 체험" onClick={() => setNotificationsOpen(true)} className="aurora-icon-close border border-white/10 bg-lobby-surface/90"><Bell size={18} /></button>
          <button type="button" aria-label="시트 체험" onClick={() => setSheet("체험 안내")} className="aurora-icon-close border border-white/10 bg-lobby-surface/90"><SlidersHorizontal size={18} /></button>
        </div>
      </header>
      <p className="relative z-10 mt-3 px-4 text-center text-xs text-white/80 sm:hidden">개발용 체험 · 예시 데이터 · 실제 전송 없음</p>
      {notice && <p role="status" className="absolute left-1/2 top-28 z-30 max-w-[90%] -translate-x-1/2 rounded-xl border border-lobby-accent/25 bg-lobby-surface px-4 py-2 text-xs text-lobby-tx1 shadow-xl">{notice}</p>}
      <DialogueBox
        key={scenario}
        characterName="아이리"
        nickname="여행자"
        scene={reply || SCENES[scenario]}
        onSend={sendLocalMessage}
        isTyping={waiting || scenario === "waiting"}
        affection={STATS.affection}
        energy={scenario === "empty" ? 0 : 28}
        freeEnergy={scenario === "empty" ? 0 : 24}
        paidEnergy={scenario === "empty" ? 0 : 4}
        onNextScene={() => changeScenario("dialogue")}
        hasNextScene={scenario === "next"}
        emotion="HAPPY"
        onOpenStatusPanel={() => setStatusOpen((open) => !open)}
        statusToggleRef={statusToggle}
        onOpenProfile={() => setSheet("아이리 · 캐릭터 프로필")}
        onOpenStore={() => setSheet("에너지 충전")}
        chatMode="SANDBOX"
        thoughtUnlocked
        innerThought="오늘도 이렇게 곁에 있어 주셔서 다행이다. 이 오후가 조금 더 오래 이어졌으면."
        storyV2Mode={scenario === "story"}
        dialogueOptions={["아이리에게 종소리에 관해 묻는다", "창밖의 정원을 살펴본다"]}
        onSelectDialogueOption={sendLocalMessage}
        showStoryActions={scenario === "story"}
        onStoryAction={(type) => setNotice(`스토리 행동 체험: ${type}`)}
        mobile={isMobile}
      />
      <BiometricStatusPanel isOpen={statusOpen} onClose={() => setStatusOpen(false)} stats={STATS} emotion="HAPPY" characterId="preview-airi" characterName="아이리" statusLevel="FRIEND" excludeRef={statusToggle} characterThought="오늘은 조금 더 오래, 함께 이야기하고 싶다." loadSecretStatus={false} />
      {notificationsOpen && <StoryV2NotificationPanel notifications={NOTIFICATIONS} onClose={() => setNotificationsOpen(false)} onItemClick={() => setNotice("예시 알림을 확인했어요.")} />}
      <BottomSheet open={!!sheet} onClose={() => setSheet("")} title={sheet}>
        <div className="space-y-4 pb-2"><p className="text-base leading-relaxed text-lobby-tx0">실제 대화 컴포넌트를 체험하고 있어요.</p><p className="text-sm leading-relaxed text-lobby-tx1">상단의 상태 메뉴에서 긴 대사, 응답 대기, 에너지 부족, 스토리 장면을 확인할 수 있어요. 입력은 이 페이지 안에서만 처리되며, 실제 메시지나 구매 요청을 보내지 않아요.</p><button type="button" onClick={() => setSheet("")} className="min-h-12 w-full rounded-xl bg-lobby-accent px-4 py-3 text-sm font-semibold text-lobby-bg">계속 둘러보기</button></div>
      </BottomSheet>
    </main>
  );
}
