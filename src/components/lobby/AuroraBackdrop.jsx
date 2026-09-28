import { useEffect, useState } from 'react';

/** A small, purely decorative scene: transform-only drift pauses in background tabs. */
export default function AuroraBackdrop({ className = '' }) {
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return (
    <div className={`aurora-backdrop ${className}`} aria-hidden="true" data-paused={!visible}>
      <div className="aurora-backdrop-light aurora-backdrop-light--lavender" />
      <div className="aurora-backdrop-light aurora-backdrop-light--teal" />
      <div className="aurora-backdrop-rings"><span /><span /><span /></div>
      <div className="aurora-backdrop-grain" />
    </div>
  );
}
