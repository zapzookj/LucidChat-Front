/** Track fade × voice duck × user volume. A single writer prevents competing fades. */
export function createBgmEnvelope(audio, initial, scheduler = {
  now: () => performance.now(), request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id),
}) {
  let settings = initial;
  let trackGain = 0;
  let duckGain = initial.ducked ? 0.25 : 1;
  let trackRamp = null;
  let duckRamp = null;
  let frame = null;
  let disposed = false;
  const apply = () => { audio.volume = settings.muted ? 0 : Math.max(0, Math.min(1, settings.master * 0.45 * trackGain * duckGain)); };
  const value = (ramp, now) => {
    const t = Math.max(0, Math.min(1, (now - ramp.start) / ramp.duration));
    return ramp.from + (ramp.to - ramp.from) * t * t * (3 - 2 * t);
  };
  const tick = () => {
    frame = null;
    if (disposed) return;
    const now = scheduler.now();
    if (trackRamp) {
      trackGain = value(trackRamp, now);
      if (now >= trackRamp.start + trackRamp.duration) { trackRamp.resolve(true); trackRamp = null; }
    }
    if (duckRamp) {
      duckGain = value(duckRamp, now);
      if (now >= duckRamp.start + duckRamp.duration) duckRamp = null;
    }
    apply();
    if (trackRamp || duckRamp) frame = scheduler.request(tick);
  };
  const schedule = () => { if (frame == null && !disposed) frame = scheduler.request(tick); };
  apply();
  return {
    update(next) {
      if (disposed) return;
      if (settings.ducked !== next.ducked) {
        if (duckRamp) duckGain = value(duckRamp, scheduler.now());
        duckRamp = { from: duckGain, to: next.ducked ? 0.25 : 1, start: scheduler.now(), duration: next.ducked ? 320 : 900 };
        schedule();
      }
      settings = next;
      apply();
    },
    fadeTo(to, duration) {
      if (disposed) return Promise.resolve(false);
      if (trackRamp) { trackGain = value(trackRamp, scheduler.now()); trackRamp.resolve(false); }
      return new Promise(resolve => {
        trackRamp = { from: trackGain, to, start: scheduler.now(), duration, resolve };
        schedule();
      });
    },
    dispose() {
      disposed = true;
      if (frame != null) scheduler.cancel(frame);
      trackRamp?.resolve(false);
      trackRamp = null; duckRamp = null;
      audio.pause();
      audio.removeAttribute('src'); audio.load();
    },
  };
}
