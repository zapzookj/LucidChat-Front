import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Film, Sparkles } from 'lucide-react';
import AuroraBackdrop from '../components/lobby/AuroraBackdrop';
import EntryExperience from '../components/experience/EntryExperience';
import { assetUrl } from '../utils/assetUrl';

const OPTIONS = [
  { id: 'character', title: '공용 캐릭터 인트로', description: '전용 영상이 없는 캐릭터 · 오로라 파빌리온' },
  { id: 'world', title: '공용 세계관 인트로', description: '세계의 이름과 함께 시작하는 진입 연출' },
  { id: 'video', title: '기존 전용 영상', description: '아이리의 실제 인트로 영상 우선 재생' },
  { id: 'slow', title: '준비가 늦어지는 상태', description: '건너뛰어도 데이터 준비까지 대기 · 9초 후 완료' },
  { id: 'error', title: '연결 실패와 재시도', description: '오류 안내 → 다시 준비하기 → 진입' },
  { id: 'broken', title: '영상 실패 시 대체 연출', description: '재생할 수 없는 영상은 공용 인트로로 복구' },
];

export default function DesignReviewPage() {
  const [scenario, setScenario] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!scenario) return;
    const timer = setTimeout(() => {
      if (scenario === 'error' && attempt === 0) setError('연결 상태를 확인한 뒤 다시 시도해 주세요.');
      else setReady(true);
    }, scenario === 'slow' ? 9000 : 1200);
    return () => clearTimeout(timer);
  }, [scenario, attempt]);
  const start = (id) => { setReady(false); setError(null); setNotice(''); setAttempt(0); setScenario(id); };
  return (
    <main className="aurora-shell relative h-dvh overflow-y-auto">
      <AuroraBackdrop />
      <div className="aurora-container max-w-5xl py-10 sm:py-16">
        <Link to="/" className="aurora-brand"><span className="aurora-brand-mark" aria-hidden="true" /><span className="aurora-brand-name">LUCID CHAT</span></Link>
        <p className="aurora-eyebrow mt-8"><span />ASTRA · AURORA PAVILION</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">오로라 구현 검수</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-lobby-tx1">실제 서비스 컴포넌트를 로컬 예시 데이터로 확인하는 개발 전용 화면입니다. 인트로와 채팅 체험은 실제 대화 생성이나 재화 사용 없이 동작합니다.</p>
        <div className="my-8 flex flex-wrap gap-3">
          <Link to="/" className="aurora-button-primary">실제 로비 보기<ArrowRight size={16} /></Link>
          <Link to="/__design/chat" className="aurora-button-secondary">채팅 화면 체험<ArrowRight size={16} /></Link>
          <Link to="/__design/secondary" className="aurora-button-secondary">제작·보관함 체험<ArrowRight size={16} /></Link>
        </div>
        <h2 className="mb-4 text-xl font-semibold">진입 경험</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map(option => <button key={option.id} onClick={() => start(option.id)} className="rounded-2xl border border-white/15 bg-lobby-surface/80 p-6 text-left transition-colors hover:border-lobby-accent/60">
            {option.id === 'video' ? <Film className="mb-5 text-lobby-teal" size={24} /> : <Sparkles className="mb-5 text-lobby-accent" size={24} />}
            <strong className="block text-base">{option.title}</strong><span className="mt-2 block text-sm leading-relaxed text-lobby-tx1">{option.description}</span>
          </button>)}
        </div>
        <p role="status" className="mt-6 min-h-6 text-sm text-lobby-teal">{notice}</p>
        <p className="mt-6 text-xs leading-6 text-lobby-tx2">시스템의 ‘동작 줄이기’ 설정을 따르면 공간 이동 없이 짧은 페이드로 전환됩니다. 이 페이지는 프로덕션 빌드에 포함되지 않습니다.</p>
      </div>
      {scenario && <EntryExperience key={`${scenario}-${attempt}`} title={scenario === 'world' ? '아르카디아 학원' : '아이리'} subtitle={scenario === 'world' ? '새로운 세계의 문이 열립니다' : '당신의 이야기가 시작되는 순간'} kind={scenario === 'world' ? 'world' : 'character'} videoSrc={scenario === 'video' ? assetUrl('/videos/characters/airi/intro.mp4') : scenario === 'broken' ? '/__missing-intro.mp4' : null} ready={ready} error={error} onComplete={() => { setNotice('연출과 데이터 준비가 모두 완료되어 채팅으로 이어집니다.'); setScenario(null); }} onRetry={() => { setError(null); setReady(false); setAttempt(value => value + 1); }} onLeave={() => setScenario(null)} />}
    </main>
  );
}
