/** Memory only, one owned response/attempt. No generation requests or persistent audio storage. */
export class VoiceClipCache {
  constructor(fetchBlob, createAudio = url => new Audio(url)) {
    this.fetchBlob = fetchBlob;
    this.createAudio = createAudio;
    this.entries = new Map();
    this.scope = null;
  }
  reset(scope = null) {
    for (const entry of this.entries.values()) {
      entry.controller.abort();
      entry.cancelReady?.();
      entry.audio?.pause();
      entry.audio?.removeAttribute('src');
      entry.audio?.load();
      if (entry.url) { URL.revokeObjectURL(entry.url); entry.url = null; }
    }
    this.entries.clear();
    this.scope = scope;
  }
  useScope(scope) { if (this.scope !== scope) this.reset(scope); }
  prepare(index, path) {
    if (this.entries.has(index)) return this.entries.get(index).ready;
    const entry = { controller: new AbortController() };
    this.entries.set(index, entry);
    entry.ready = (async () => {
      const blob = await this.fetchBlob(path, entry.controller.signal);
      if (entry.controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      entry.url = URL.createObjectURL(blob);
      entry.audio = this.createAudio(entry.url);
      entry.audio.preload = 'auto';
      await new Promise((resolve, reject) => {
        const player = entry.audio;
        const cleanup = () => {
          player.removeEventListener('canplay', ready);
          player.removeEventListener('error', failed);
          clearTimeout(timer);
          entry.cancelReady = null;
        };
        const ready = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error('Audio unavailable')); };
        const timer = setTimeout(failed, 8000);
        entry.cancelReady = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
        player.addEventListener('canplay', ready, { once: true });
        player.addEventListener('error', failed, { once: true });
        if (player.readyState >= 3) ready(); else player.load();
      });
      if (entry.controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      return entry.audio;
    })();
    // A failed preload must be retryable and must not retain a blob URL.
    entry.ready.catch(() => {
      if (this.entries.get(index) === entry) this.entries.delete(index);
      entry.audio?.pause();
      entry.audio?.removeAttribute('src');
      entry.audio?.load();
      if (entry.url) { URL.revokeObjectURL(entry.url); entry.url = null; }
    });
    return entry.ready;
  }
}
