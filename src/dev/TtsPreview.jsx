import { useEffect, useMemo, useState } from 'react';
import DialogueBox from '../components/DialogueBox';
import { VoiceModeToggle, VoiceConfirmDialog, VoiceVolumeControl } from '../components/VoiceControls';
import useTtsPlayback from '../hooks/useTtsPlayback';
import api from '../api/axios';

const GREETING = '어서 오세요, 주인님. 저는 이 저택의 메이드, 아이리입니다. 오늘부터 제가 주인님을 모시게 되었어요. 편히 계시다가 필요하신 게 있으면 언제든 말씀해 주세요.';
// Development-only adapter: no paid provider calls or real wallet writes.
export default function TtsPreview() {
  const fixture = useMemo(() => ({ mode: false, status: 'AVAILABLE', energy: 30, polls: 0, failNext: false, delayAudio: false }), []);
  const [serial, setSerial] = useState(1);
  const [scenario, setScenario] = useState('manual');
  const [energy, setEnergy] = useState(30);
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const scene = useMemo(() => deleted ? null : ({ speaker: '아이리', dialogue: GREETING, narration: '아이리가 당신을 바라보며 부드럽게 인사한다.', parentLogId: `local-${serial}`, sceneIndex: 0, voiceAutoEligible: scenario === 'auto' }), [serial, scenario, deleted]);
  useEffect(() => {
    const original = api.defaults.adapter;
    api.defaults.adapter = async config => {
      if (!config.url.startsWith('/tts/')) throw new Error('Local preview only');
      if (fixture.failNext && config.method === 'get') { fixture.failNext = false; throw new Error('Simulated offline'); }
      let data;
      if (config.url.endsWith('/9000')) {
        if (config.method === 'patch') fixture.mode = JSON.parse(config.data).enabled;
        data = { available: true, enabled: fixture.mode, energyCost: 1 };
      } else if (config.url.includes('/clips/') || config.url.startsWith('/tts/greetings/')) {
        if (fixture.delayAudio) await new Promise(resolve => setTimeout(resolve, 3000));
        data = await (await fetch('/__tts-sample.mp3')).blob();
      } else {
        if (config.method === 'post') { fixture.status = 'GENERATING'; fixture.polls = 0; fixture.energy--; }
        if (config.method === 'get' && fixture.status === 'GENERATING' && fixture.polls++ > 0) fixture.status = 'READY';
        data = { status: fixture.status, attemptId: 'local-attempt', energyCost: fixture.status === 'GREETING' ? 0 : 1,
          refunded: fixture.status === 'FAILED', sceneIndices: [0], greetingSlug: 'airi', remainingEnergy: fixture.energy };
      }
      return { data, status: 200, statusText: 'OK', headers: {}, config };
    };
    setReady(true);
    return () => { api.defaults.adapter = original; };
  }, [fixture]);
  const voice = useTtsPlayback(ready ? 9000 : null, scene, { onEnergyChanged: () => setEnergy(fixture.energy), notify: setNotice });
  const pick = value => {
    voice.stop(); setDeleted(false); fixture.delayAudio = false; fixture.failNext = false;
    fixture.status = value === 'greeting' ? 'GREETING' : value === 'failed' ? 'FAILED' : value === 'auto' ? 'GENERATING' : value === 'ready' ? 'READY' : 'AVAILABLE';
    fixture.polls = 0; setScenario(value); setSerial(number => number + 1); setNotice('');
    if (value === 'auto' && fixture.mode) { fixture.energy--; setEnergy(fixture.energy); }
  };
  return <div className="min-h-dvh bg-[#0c111c] text-white relative overflow-hidden">
    <div className="absolute inset-0 bg-cover bg-center opacity-45" style={{ backgroundImage: 'url(https://assets.lucid-chat.com/backgrounds/airi/bg_default.png)' }} />
    <div className="relative z-30 p-4 max-w-2xl">
      <p className="text-xs text-white/70">로컬 TTS 검증 · 과금/응답 상태 시뮬레이션 · 실제 v4 첫인사 MP3 · 공급자 호출 없음</p>
      <div className="flex gap-2 flex-wrap mt-3">{[['manual','수동'],['greeting','무료 첫인사'],['failed','생성 실패'],['ready','준비 완료'],['auto','자동 새 응답']].map(([value,label]) => <button className="min-h-11 rounded-lg bg-white/10 px-3 text-xs" key={value} onClick={() => pick(value)}>{label}</button>)}</div>
      <div className="flex gap-2 flex-wrap mt-2">
        <button className="min-h-11 px-3 bg-white/10 rounded-lg text-xs" onClick={() => { fixture.failNext = true; setSerial(number => number + 1); }}>상태 조회 오류</button>
        <button className="min-h-11 px-3 bg-white/10 rounded-lg text-xs" onClick={() => { fixture.delayAudio = true; fixture.status = 'READY'; setSerial(number => number + 1); }}>오디오 3초 지연</button>
        <button className="min-h-11 px-3 bg-white/10 rounded-lg text-xs" onClick={() => { voice.invalidate(scene?.parentLogId); setDeleted(true); }}>현재 응답 삭제</button>
      </div>
      <p role="status" className="mt-2 text-xs">{notice} · 음성: {voice.playback} · 응답: {voice.status?.status || '조회 중'} · 잔액: {energy}E</p>
      <details className="mt-2 text-xs"><summary>음량</summary><VoiceVolumeControl voice={voice} /></details>
    </div>
    <div className="absolute right-4 top-52 z-40 flex gap-2"><button className="min-h-11 px-3 rounded-full bg-black/40 border border-white/10 text-xs">Boost</button><VoiceModeToggle voice={voice} /></div>
    <DialogueBox mobile={window.innerWidth < 768} characterName="아이리" scene={scene} voice={{ ...voice, sceneIndex: 0 }}
      onSend={() => {}} isTyping={false} energy={energy} freeEnergy={energy} paidEnergy={0} affection={0} nickname="주인님" chatMode="SANDBOX" onNextScene={() => {}} hasNextScene={false} />
    <VoiceConfirmDialog voice={voice} />
  </div>;
}
