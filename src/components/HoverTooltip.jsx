import { cloneElement, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Render outside scroll/transform containers and keep the explanation inside the viewport. */
export default function HoverTooltip({ children, content }) {
  const anchor = useRef(null);
  const tooltip = useRef(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  useLayoutEffect(() => {
    if (!open) { setPosition(null); return; }
    const update = () => {
      if (!anchor.current || !tooltip.current) return;
      const rect = anchor.current.getBoundingClientRect();
      const box = tooltip.current.getBoundingClientRect();
      const margin = 12;
      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - box.width - margin));
      const above = rect.top - box.height - 10;
      const top = Math.max(margin, Math.min(above >= margin ? above : rect.bottom + 10, window.innerHeight - box.height - margin));
      setPosition({ left, top });
    };
    const escape = event => { if (event.key === 'Escape') setOpen(false); };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(tooltip.current);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    document.addEventListener('keydown', escape);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <span ref={anchor} className="inline-flex h-full"
    onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
    onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
    {cloneElement(children, { 'aria-describedby': open ? [children.props['aria-describedby'], id].filter(Boolean).join(' ') : children.props['aria-describedby'] })}
    {open && createPortal(<div ref={tooltip} id={id} role="tooltip"
      className="fixed w-56 max-w-[calc(100vw-24px)] max-h-[calc(100dvh-24px)] overflow-y-auto bg-black/95 border border-amber-500/30 p-4 rounded-xl text-xs text-gray-300 pointer-events-none z-[150] shadow-2xl backdrop-blur-xl"
      style={{ ...position, visibility: position ? 'visible' : 'hidden' }}>{content}</div>, document.body)}
  </span>;
}
