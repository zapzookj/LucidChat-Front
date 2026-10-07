import { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { Volume2, Square, LoaderCircle, AudioLines } from 'lucide-react';

export function VoiceModeToggle({ voice }) {
  if (!voice.mode.available) return null;
  return <button type="button" role="switch" aria-checked={voice.mode.enabled} disabled={voice.busy} onClick={voice.toggle}
    className={`min-h-11 px-3 rounded-full border flex items-center gap-2 text-xs backdrop-blur-md ${voice.mode.enabled ? 'text-violet-200 border-violet-400/50 bg-violet-500/20' : 'text-white/60 border-white/10 bg-black/40'}`}
    aria-label={`자동 보이스 ${voice.mode.enabled ? '켜짐' : '꺼짐'}`}>
    <AudioLines size={16} /><span>보이스</span>{voice.mode.enabled && <span>+{voice.mode.energyCost}E</span>}
  </button>;
}

export function VoiceListenButton({ voice }) {
  if (!voice.mode.available && voice.status?.status !== 'GREETING') return null;
  const status = voice.status?.status;
  const loading = voice.checking || voice.presentationPending || ['QUEUED', 'GENERATING'].includes(status) || voice.playback === 'loading';
  const supported = voice.status?.sceneIndices?.includes(voice.sceneIndex ?? 0);
  // The page passes the current scene index; an unlocked multi-speaker response can contain unsupported scenes.
  const disabled = voice.busy || loading || (status !== 'UNAVAILABLE' && (!supported || !['AVAILABLE', 'FAILED', 'READY', 'GREETING'].includes(status)));
  const label = status === 'UNAVAILABLE' ? '상태 다시 확인' : loading ? '음성 준비 중' : !supported ? '보이스 없음' : voice.playback === 'playing' ? '멈춤' : voice.playback === 'blocked' ? '눌러서 재생'
    : voice.playback === 'error' ? '재생 다시 시도' : status === 'GREETING' ? '첫인사 듣기 · 무료'
    : status === 'FAILED' ? '생성 재시도' : status === 'READY' && voice.hasPlayed ? '다시 듣기' : supported ? '듣기' : '보이스 없음';
  return <span className="flex items-center gap-2 ml-auto">
    {status === 'FAILED' && voice.status.refunded && <span role="status" className="text-[10px] text-white/50">음성 {voice.status.energyCost}E 환불</span>}
    <button type="button" disabled={disabled} onClick={(event) => { event.stopPropagation(); voice.listen(); }} aria-label={label}
      className="min-h-11 px-3 rounded-full bg-violet-500/10 border border-violet-300/20 text-violet-100 text-xs flex items-center gap-1.5 disabled:opacity-40">
      {loading ? <LoaderCircle size={14} className="animate-spin" /> : voice.playback === 'playing' ? <Square size={12} /> : <Volume2 size={14} />}
      <span aria-live="polite">{label}</span>
    </button>
  </span>;
}

export function VoiceConfirmDialog({ voice }) {
  const dialog = useRef(null); const titleId = useId();
  useEffect(() => {
    if (!voice.confirmation) return;
    const prior = document.activeElement;
    const box = dialog.current; box?.querySelector('button')?.focus();
    const keys = (event) => {
      if (event.key === 'Escape' && !voice.busy) { event.preventDefault(); voice.cancelConfirmation(); }
      if (event.key !== 'Tab') return;
      const buttons = [...box.querySelectorAll('button:not(:disabled)')];
      if (!buttons.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
    };
    document.addEventListener('keydown', keys);
    return () => { document.removeEventListener('keydown', keys); if (prior?.isConnected) prior.focus(); };
  }, [voice.confirmation, voice.busy, voice.cancelConfirmation]);
  if (!voice.confirmation) return null;
  const auto = voice.confirmation.type === 'mode';
  return createPortal(<div className="fixed inset-0 z-[200] bg-black/65 backdrop-blur-sm flex items-center justify-center p-5" onClick={() => !voice.busy && voice.cancelConfirmation()}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}
      className="w-full max-w-sm rounded-2xl border border-violet-300/20 bg-[#181326] p-6 text-white shadow-2xl">
      <h2 id={titleId} className="text-lg font-semibold">{auto ? '자동 보이스를 켤까요?' : voice.confirmation.retry ? '음성을 다시 생성할까요?' : '이 응답을 목소리로 들을까요?'}</h2>
      <p className="mt-3 text-sm text-white/65 leading-relaxed">{auto ? '다음 응답부터 지원되는 캐릭터의 대사를 자동으로 생성하고 재생합니다.' : '이 응답의 지원되는 대사를 생성합니다. 같은 응답은 다시 들어도 추가 차감되지 않습니다.'}</p>
      <p className="mt-3 text-sm text-violet-200">{auto ? '응답마다 추가' : '이번 생성'} {voice.mode.energyCost}E · 생성 실패 시 음성 비용 환불</p>
      <p className="mt-2 text-xs text-white/45">음성은 현재 보이는 씬만 재생하며, 다음 씬으로 자동 이동하지 않습니다.</p>
      <div className="mt-6 flex gap-3"><button disabled={voice.busy} onClick={voice.cancelConfirmation} className="flex-1 min-h-11 rounded-xl bg-white/5">취소</button>
        <button disabled={voice.busy} onClick={voice.confirm} className="flex-1 min-h-11 rounded-xl bg-violet-600">{voice.busy ? '처리 중' : auto ? '켜기' : '생성하기'}</button></div>
    </div>
  </div>, document.body);
}

export function VoiceVolumeControl({ voice }) {
  const id = useId();
  return <div className="mt-4 p-4 rounded-xl border border-white/10 bg-white/5">
    <div className="flex justify-between text-sm text-white/70"><label htmlFor={id}>보이스 음량</label><span>{Math.round(voice.volume * 100)}%</span></div>
    <input id={id} type="range" min="0" max="100" value={Math.round(voice.volume * 100)} onChange={(event) => voice.setVolume(Number(event.target.value) / 100)} className="mt-3 w-full accent-violet-500" />
    <p className="mt-2 text-xs text-white/40">목소리가 재생되는 동안 BGM은 잠시 작아집니다.</p>
  </div>;
}
