import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Plus, Wand2 } from "lucide-react";
import { ActiveJobCard, MyCharacterCard, MyWorldCard } from "../pages/StudioPage";
import { TalkRow } from "../pages/lobby/ArchiveTab";
import { WorldCard } from "../pages/lobby/StoryTab";
import { ConceptStep } from "../components/studio/StudioCreateFlow";
import { WorldConceptStep } from "../components/studio/WorldCreateFlow";
import { Step1WorldConfirm, Step2HeroineSelect, Step3Profile } from "../components/story-v2/StoryCreateFlow";
import { EmptyState, PageHead, SectionHead } from "../pages/lobby/lobbyUi";
import AuroraBackdrop from "../components/lobby/AuroraBackdrop";
import "../styles/aurora-secondary.css";

// Imported only by App's DEV route. Production UI is rendered with local fixtures:
// no AuthProvider override, API adapter, room creation, or generation request.
const CDN = "https://assets.lucid-chat.com";
const CHARACTERS = [
  { characterId: "example-1", name: "유지민", tagline: "비 오는 날의 작은 우연", thumbnailUrl: `${CDN}/characters/ugc-6/thumbnail.png`, visibility: "PRIVATE", secretReviewStatus: "NONE" },
  { characterId: "example-2", name: "아이리", tagline: "당신 곁에 머무는 다정한 시간", thumbnailUrl: `${CDN}/characters/airi/thumbnail.png`, visibility: "PUBLIC", secretReviewStatus: "NONE" },
  { characterId: "example-3", name: "아직 이름을 정하지 않은 새로운 이야기의 주인공", tagline: "이미지가 없는 경우에도 캐릭터를 관리할 수 있어요", visibility: "PRIVATE", secretReviewStatus: "PENDING" },
];
const WORLD = { worldId: "example-world", name: "달빛이 머무는 저택", displayName: "달빛이 머무는 저택", intro: "당신의 발걸음을 기다리던 곳", description: "오래된 저택의 문이 열립니다. 당신의 선택에 따라 일상의 작은 순간이 특별한 이야기로 바뀌는 세계. 찻잔을 사이에 두고 나누는 대화부터 조용한 정원의 산책까지, 어떤 시간을 함께할지는 당신에게 달려 있어요.", thumbnailUrl: `${CDN}/backgrounds/airi/bg_default.png`, heroImageUrl: `${CDN}/backgrounds/airi/bg_default.png`, tagline: "잊고 있던 온기를 다시 만나는 곳", moodKeywords: "일상, 다정함, 비밀", heroineCount: 3, heroineNames: ["아이리", "연화", "루나"], reviewStatus: "APPROVED" };
const WORLD_OPTIONS = [{ ...WORLD, worldId: "example-world", status: "READY" }];
const HEROINES = [
  { characterId: "airi", name: "아이리", profileImageUrl: `${CDN}/characters/airi/thumbnail.png`, role: "저택의 메이드", tagline: "오늘도 곁에서 함께할게요", difficulty: "EASY" },
  { characterId: "yeonhwa", name: "연화", profileImageUrl: `${CDN}/characters/yeonhwa/hanbok_neutral.png`, role: "황궁의 후궁", tagline: "말하지 못한 이야기", difficulty: "HARD" },
  { characterId: "luna", name: "루나", profileImageUrl: `${CDN}/characters/luna/thumbnail.png`, role: "달빛 아래의 동행", tagline: "조금 특별한 밤의 시작", difficulty: "NORMAL" },
];
const PROFILE = { name: "이야기를 찾아온 여행자", gender: "FEMALE", age: 26, personaText: "낯선 장소에서 익숙한 온기를 찾는 사람. 상대의 이야기를 듣는 것을 좋아하고, 오래된 책과 비 오는 날의 산책을 즐긴다.", empathy: 3, curiosity: 2 };
const ROOMS = [
  { roomId: "sample-1", type: "DIALOGUE", chatMode: "SANDBOX", characterName: "아이리", characterThumbnailUrl: `${CDN}/characters/airi/thumbnail.png`, dynamicRelationTag: "조금씩 가까워지는 사이", lastActiveAt: new Date().toISOString() },
  { roomId: "sample-2", type: "DIALOGUE", chatMode: "STORY", characterName: "연화", characterThumbnailUrl: `${CDN}/characters/yeonhwa/hanbok_neutral.png`, currentChapter: 3, lastActiveAt: new Date(Date.now() - 86400000).toISOString() },
  { roomId: "sample-3", type: "THEATER", worldDisplayName: "달빛이 머무는 저택", currentAct: 2, currentChapter: 4, leadHeroineName: "루나", endingReached: true, endingTitle: "오래도록 기억될 마지막 인사", lastActiveAt: new Date(Date.now() - 3 * 86400000).toISOString() },
];

export default function SecondaryDesignPreview() {
  const [view, setView] = useState("studio");
  const [notice, setNotice] = useState("");
  const [lowEnergy, setLowEnergy] = useState(false);
  const [storyStep, setStoryStep] = useState(1);
  const [selected, setSelected] = useState(["airi"]);
  const setViewAndReset = (next) => { setNotice(""); setView(next); };
  const localNotice = (message) => setNotice(`${message} · 개발용 예시이며 실제 요청은 전송하지 않았어요.`);
  const isForm = view === "character" || view === "world";
  return (
    <main className="relative h-dvh overflow-y-auto bg-lobby-bg text-lobby-tx0 custom-scrollbar">
      <AuroraBackdrop />
      <header className="sticky top-0 z-20 border-b border-white/10 bg-lobby-bg/95 px-4 sm:px-7 py-3 backdrop-blur-xl">
        <div className="mx-auto max-w-[1200px] flex flex-wrap items-center justify-between gap-3">
          <a href="/" className="inline-flex items-center gap-2 min-h-11 text-sm text-lobby-tx1"><ArrowLeft size={17} />로비</a>
          <p className="hidden md:block text-sm font-semibold">AURORA · 스튜디오와 보관함</p>
          <label className="flex items-center gap-2 text-xs text-lobby-tx2">화면
            <select value={view} onChange={(event) => setViewAndReset(event.target.value)} className="min-h-11 rounded-xl bg-lobby-surface border border-white/15 px-3 text-sm text-lobby-tx0">
              <option value="studio">스튜디오</option><option value="archive">보관함</option><option value="story">이야기 시작 준비</option><option value="character">캐릭터 만들기</option><option value="world">세계관 만들기</option>
            </select>
          </label>
        </div>
      </header>
      <div className="relative z-10 mx-auto max-w-[1200px] px-4 sm:px-8 pb-16 pt-5">
        <p className="mb-5 text-xs leading-relaxed text-lobby-teal">개발용 체험 · 예시 데이터 · 실제 제작 및 대화 요청 없음</p>
        {notice && <div role="status" className="mb-6 rounded-2xl border border-lobby-teal/25 bg-lobby-teal/10 p-4 text-sm text-lobby-tx0 leading-relaxed">{notice}</div>}
        {view === "studio" && <>
          <PageHead title="스튜디오" desc="상상 속 인물과 세계가 이야기의 주인공이 되는 곳." />
          <div className="aurora-studio-invite rounded-[26px] p-6 sm:p-8 my-7 flex flex-col sm:flex-row gap-5 sm:items-center sm:justify-between">
            <div><p className="text-lg font-semibold mb-2">어떤 이야기를 만들어 볼까요?</p><p className="text-sm text-lobby-tx1 leading-relaxed">인물의 한 줄 소개에서 시작해, 표정과 세계까지 함께 빚어 가세요.</p></div>
            <button onClick={() => setViewAndReset("character")} className="aurora-secondary-primary min-h-12 rounded-2xl px-5 text-sm font-semibold flex items-center justify-center gap-2 shrink-0"><Plus size={17} />캐릭터 만들기</button>
          </div>
          <ActiveJobCard job={{ status: "GACHA_WAIT" }} onClick={() => localNotice("진행 중인 소환 선택")} />
          <div className="mt-8"><SectionHead title="내 캐릭터" sub="직접 만든 캐릭터의 이야기와 설정을 관리하세요." /></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 mt-5">
            {CHARACTERS.map((character, index) => <MyCharacterCard key={character.characterId} character={character} index={index} onChat={(item) => localNotice(`${item.name} 대화 시작 선택`)} onMenu={(item) => localNotice(`${item.name} 관리 메뉴 선택`)} />)}
          </div>
          <div className="mt-9"><SectionHead title="내 세계관" sub="캐릭터들이 살아갈 무대를 만들어요." action={<button onClick={() => setViewAndReset("world")} className="min-h-11 text-sm text-lobby-accent flex items-center gap-1">세계관 만들기<Plus size={16} /></button>} /></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-5"><MyWorldCard world={WORLD} onClick={() => localNotice("세계관 관리 선택")} /></div>
        </>}
        {view === "archive" && <>
          <PageHead title="보관함" desc="나눈 대화와 수집한 순간들, 내 페르소나까지 한곳에 모았어요." />
          <div className="mt-7 space-y-3">{ROOMS.map((entry) => <TalkRow key={entry.roomId} entry={entry} onOpen={() => localNotice("지난 이야기 이어하기 선택")} />)}</div>
          <div className="mt-8"><SectionHead title="대화가 없는 경우" /></div>
          <EmptyState title="아직 나눈 대화가 없어요" desc="첫 이야기를 시작하면 여기에 기록돼요" ctaLabel="캐릭터 만나러 가기" onCta={() => localNotice("캐릭터 탐색 선택")} />
        </>}
        {view === "story" && <div className="grid lg:grid-cols-[1fr_1.15fr] gap-7 items-start">
          <WorldCard world={WORLD} guest={false} theaterAvailable onStartStory={() => { setStoryStep(1); localNotice("세계관 선택"); }} onStartTheater={() => localNotice("극장 관람 선택")} />
          <section className="aurora-gate rounded-[28px] border border-white/15 p-5 sm:p-7">
            <div className="flex items-center gap-2 text-xs text-lobby-teal mb-6"><BookOpen size={16} />이야기 시작 준비 · {storyStep} / 3</div>
            {storyStep === 1 && <Step1WorldConfirm world={WORLD} />}
            {storyStep === 2 && <Step2HeroineSelect heroines={HEROINES} selected={selected} onToggle={(id) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 3 ? [...current, id] : current)} />}
            {storyStep === 3 && <Step3Profile profile={PROFILE} onEdit={() => localNotice("프로필 편집 선택")} />}
            <div className="flex justify-between gap-3 border-t border-white/10 mt-6 pt-4">
              <button disabled={storyStep === 1} onClick={() => setStoryStep((n) => n - 1)} className="min-h-11 px-3 text-sm text-lobby-tx1 disabled:opacity-30">이전</button>
              <button disabled={storyStep === 2 && !selected.length} onClick={() => storyStep < 3 ? setStoryStep((n) => n + 1) : localNotice("이야기 시작 선택")} className="aurora-secondary-primary min-h-11 px-4 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-40">{storyStep === 3 ? "이야기 시작하기" : "다음"}<ArrowRight size={16} /></button>
            </div>
          </section>
        </div>}
        {isForm && <div className="max-w-2xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6"><p className="flex items-center gap-2 text-sm text-lobby-accent"><Wand2 size={16} />{view === "character" ? "캐릭터 만들기" : "세계관 만들기"} · 첫 단계</p><label className="flex min-h-11 items-center gap-2 text-xs text-lobby-tx1"><input type="checkbox" checked={lowEnergy} onChange={(event) => setLowEnergy(event.target.checked)} />에너지 부족 상태</label></div>
          <section className="rounded-[28px] border border-white/15 bg-lobby-surface/65 p-5 sm:p-8">
            {view === "character" ? <ConceptStep busy={false} energy={lowEnergy ? 0 : 50} worldOptions={WORLD_OPTIONS} onSubmit={(data) => localNotice(`${data.name || "새 캐릭터"} 입력 확인 완료`)} /> : <WorldConceptStep busy={false} energy={lowEnergy ? 0 : 50} onSubmitRequest={(data) => localNotice(`${data.name || "새 세계관"} 입력 확인 완료`)} />}
          </section>
        </div>}
      </div>
    </main>
  );
}
