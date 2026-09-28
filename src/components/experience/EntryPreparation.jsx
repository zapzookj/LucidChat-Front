import { useEffect, useState } from 'react';
import { ArrowLeft, RotateCcw, Sparkles } from 'lucide-react';
import './EntryExperience.css';

/** Existing rooms use this quiet preparation surface; no entrance is replayed. */
export default function EntryPreparation({ error, onRetry, onLeave }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 14000);
    return () => window.clearTimeout(timer);
  }, []);
  return <main className="lucid-preparation">
    <div className="lucid-preparation__mark" aria-hidden="true"><Sparkles size={26} strokeWidth={1.2} /></div>
    <p className="lucid-entry__brand">LUCID CHAT</p>
    <h1>{error ? '이야기를 불러오지 못했어요' : '이야기를 불러오고 있어요'}</h1>
    <p role={error ? 'alert' : 'status'}>{error || (slow ? '조금 더 시간이 걸리고 있어요. 잠시만 기다려 주세요.' : '머물던 장면으로 이어집니다.')}</p>
    {(error || slow) && <div className="lucid-entry__actions">
      {onLeave && <button type="button" className="lucid-entry__button lucid-entry__button--quiet" onClick={onLeave}><ArrowLeft size={15} />로비로</button>}
      {error && onRetry && <button type="button" className="lucid-entry__button" onClick={onRetry}><RotateCcw size={15} />다시 불러오기</button>}
    </div>}
  </main>;
}
