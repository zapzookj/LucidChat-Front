import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles } from 'lucide-react';
import { canRevealEntry } from '../../utils/introPresentation';
import './EntryExperience.css';

const DUST = Array.from({ length: 18 }, (_, index) => ({
  left: `${(index * 37 + 7) % 100}%`,
  top: `${(index * 23 + 11) % 90}%`,
  animationDelay: `${(index % 7) * 110}ms`,
}));

/** A presentation layer only. The parent owns all requests, retries and readiness. */
export default function EntryExperience({
  title = '새로운 이야기', subtitle, kind = 'character', videoSrc,
  ready = false, error = null, onComplete, onRetry, onLeave,
}) {
  const reducedMotion = useReducedMotion();
  const [presentationDone, setPresentationDone] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
  const [slow, setSlow] = useState(false);
  const [host] = useState(() => document.createElement('div'));
  const dialogRef = useRef(null);
  const videoRef = useRef(null);
  const completeRef = useRef(onComplete);
  const completedRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const useVideo = Boolean(videoSrc && !videoFailed && !reducedMotion && !presentationDone && !error);
  const revealing = canRevealEntry({ presentationDone, ready, error });

  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);

  // The dialog is portaled so every other application surface can be inert.
  // Save existing values: another modal may have already made a sibling inert.
  useEffect(() => {
    host.setAttribute('data-lucid-entry', '');
    document.body.appendChild(host);
    const previousFocus = document.activeElement;
    const siblings = [...document.body.children].filter(node => node !== host);
    const previous = siblings.map(node => [node, node.inert]);
    previous.forEach(([node]) => { node.inert = true; });
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      previous.forEach(([node, inert]) => { node.inert = inert; });
      host.remove();
      if (previousFocus?.isConnected && previousFocus !== document.body) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [host]);

  useEffect(() => {
    if (useVideo || presentationDone) return;
    const timer = window.setTimeout(() => setPresentationDone(true), reducedMotion ? 160 : 2800);
    return () => window.clearTimeout(timer);
  }, [useVideo, presentationDone, reducedMotion]);

  // Loading, rejected autoplay, unsupported codecs and a stalled film all have a
  // bounded fallback. A data request is never cancelled by a media failure.
  useEffect(() => {
    if (!useVideo) return;
    const timer = window.setTimeout(() => setVideoFailed(true), videoStarted ? 45000 : 3500);
    return () => window.clearTimeout(timer);
  }, [useVideo, videoStarted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!useVideo || !video) return;
    let active = true;
    // React StrictMode replays effect setup/cleanup on the same video element.
    // Restore the source that cleanup released before attempting playback again.
    video.setAttribute('src', videoSrc);
    video.play()?.catch(() => { if (active) setVideoFailed(true); });
    return () => {
      active = false;
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [useVideo, videoSrc]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 14000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!revealing || completedRef.current) return;
    const timer = window.setTimeout(() => {
      completedRef.current = true;
      completeRef.current?.();
    }, reducedMotion ? 180 : 720);
    return () => window.clearTimeout(timer);
  }, [revealing, reducedMotion]);

  const handleKeyDown = event => {
    if (event.key === 'Escape' && !presentationDone) {
      event.preventDefault();
      setPresentationDone(true);
    }
    if (event.key !== 'Tab') return;
    const buttons = [...dialogRef.current.querySelectorAll('button:not(:disabled)')];
    if (!buttons.length) { event.preventDefault(); return; }
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    const focus = document.activeElement;
    if (event.shiftKey && (focus === first || focus === dialogRef.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (focus === last || focus === dialogRef.current)) {
      event.preventDefault(); first.focus();
    }
  };

  const status = error ? '첫 장면을 불러오지 못했어요'
    : revealing ? '이야기가 시작됩니다'
      : presentationDone && !ready ? (slow ? '첫 장면 준비가 조금 길어지고 있어요' : '첫 장면을 준비하고 있어요')
        : kind === 'world' ? '새로운 세계로 이어지는 문' : '당신과 만날 순간을 기다리며';

  return createPortal(
    <section
      ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
      aria-describedby={descriptionId} tabIndex={-1} onKeyDown={handleKeyDown}
      data-entry-phase={revealing ? 'reveal' : error ? 'error' : presentationDone ? 'waiting' : 'playing'}
      className={`lucid-entry ${revealing ? 'lucid-entry--reveal' : ''} ${presentationDone ? 'lucid-entry--settled' : ''} ${useVideo ? 'lucid-entry--video' : ''} ${reducedMotion ? 'lucid-entry--reduced' : ''}`}
    >
      <div className="lucid-entry__canvas" aria-hidden="true">
        <div className="lucid-entry__aurora lucid-entry__aurora--lilac" />
        <div className="lucid-entry__aurora lucid-entry__aurora--teal" />
        <div className="lucid-entry__horizon" />
        <div className="lucid-entry__orbit lucid-entry__orbit--outer" />
        <div className="lucid-entry__orbit lucid-entry__orbit--inner" />
        <div className="lucid-entry__portal">
          <div className="lucid-entry__portal-inner" />
          <div className="lucid-entry__seam" />
        </div>
        <div className="lucid-entry__dust">{DUST.map((style, index) => <i key={index} style={style} />)}</div>
      </div>
      {useVideo && <video
        ref={videoRef} src={videoSrc} autoPlay muted playsInline preload="auto"
        className="lucid-entry__film" aria-hidden="true"
        onPlaying={() => setVideoStarted(true)}
        onEnded={() => setPresentationDone(true)}
        onError={() => setVideoFailed(true)}
      />}
      <header className="lucid-entry__header">
        <span className="lucid-entry__brand"><Sparkles size={16} strokeWidth={1.3} aria-hidden="true" /> LUCID CHAT</span>
        <span className="lucid-entry__edition">{kind === 'world' ? '새로운 세계' : '첫 만남'}</span>
      </header>
      <div className="lucid-entry__center">
        <span className="lucid-entry__eyebrow">{kind === 'world' ? '이야기의 문을 열다' : '꿈이 만나는 순간'}</span>
        <h1 id={titleId} className="lucid-entry__title">{title}</h1>
        {subtitle && <p className="lucid-entry__subtitle">{subtitle}</p>}
        <span className="lucid-entry__rule" aria-hidden="true"><i />✦<i /></span>
      </div>
      <footer className="lucid-entry__footer">
        <div className="lucid-entry__status" id={descriptionId} role={error ? 'alert' : 'status'} aria-live="polite">
          <span className={`lucid-entry__status-dot ${ready || error ? 'lucid-entry__status-dot--still' : ''}`} aria-hidden="true" />
          <span>{status}{error && <small>{error}</small>}{slow && !error && !ready && <small>준비가 끝나면 자동으로 이어집니다.</small>}</span>
        </div>
        <div className="lucid-entry__actions">
          {(error || slow) && onLeave && <button type="button" className="lucid-entry__button lucid-entry__button--quiet" onClick={onLeave}><ArrowLeft size={15} aria-hidden="true" />로비로</button>}
          {error && onRetry ? <button type="button" className="lucid-entry__button" onClick={onRetry}><RotateCcw size={15} aria-hidden="true" />다시 준비하기</button>
            : !presentationDone && !revealing && <button type="button" className="lucid-entry__button" onClick={() => setPresentationDone(true)}>연출 건너뛰기<ArrowRight size={16} aria-hidden="true" /></button>}
        </div>
      </footer>
    </section>, host,
  );
}
