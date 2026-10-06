import assert from 'node:assert/strict';
import { VoiceClipCache } from '../src/utils/voiceClipCache.js';
import { createBgmEnvelope } from '../src/utils/bgmEnvelope.js';

class Player extends EventTarget {
  readyState = 3; volume = 0; paused = true; loads = 0;
  pause() { this.paused = true; }
  removeAttribute() { this.removed = true; }
  load() { this.loads++; }
}
let reads = 0;
const cache = new VoiceClipCache(async () => { reads++; return new Blob(['audio']); }, () => new Player());
cache.useScope('room/log/attempt1');
const first = await cache.prepare(1, '/owned/1');
assert.equal(await cache.prepare(1, '/owned/1'), first);
assert.equal(reads, 1);
// Scene transition reuses one response; a changed attempt must discard everything.
cache.useScope('room/log/attempt1');
assert.equal(await cache.prepare(1, '/owned/1'), first);
cache.useScope('room/log/attempt2');
assert.equal(first.removed, true);
assert.notEqual(await cache.prepare(1, '/owned/1'), first);
cache.reset();
assert.equal(cache.entries.size, 0);
const pending = new VoiceClipCache((path, signal) => new Promise((resolve, reject) => {
  signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')));
}), () => new Player());
const download = pending.prepare(0, '/owned/0');
pending.reset();
await assert.rejects(download, { name: 'AbortError' });
let waitingPlayer;
const waiting = new VoiceClipCache(async () => new Blob(['audio']), () => { waitingPlayer = new Player(); waitingPlayer.readyState = 0; return waitingPlayer; });
const decoding = waiting.prepare(0, '/owned/0');
await new Promise(resolve => setImmediate(resolve));
waiting.reset();
await assert.rejects(decoding, { name: 'AbortError' });
assert.equal(waitingPlayer.removed, true);
// Actual canplay and media failure, not just a permanently ready stub.
const media = new VoiceClipCache(async () => new Blob(['audio']), () => { waitingPlayer = new Player(); waitingPlayer.readyState = 0; return waitingPlayer; });
const ready = media.prepare(1, '/owned/1');
await new Promise(resolve => setImmediate(resolve));
waitingPlayer.dispatchEvent(new Event('canplay'));
assert.equal(await ready, waitingPlayer);
media.reset();
const failed = media.prepare(2, '/owned/2');
await new Promise(resolve => setImmediate(resolve));
waitingPlayer.dispatchEvent(new Event('error'));
await assert.rejects(failed, /Audio unavailable/);
assert.equal(media.entries.size, 0);

let now = 0; let nextId = 0; const frames = new Map();
const scheduler = { now: () => now, request: callback => { frames.set(++nextId, callback); return nextId; }, cancel: id => frames.delete(id) };
const advance = ms => { now += ms; const scheduled = [...frames.values()]; frames.clear(); scheduled.forEach(callback => callback()); };
const bgm = new Player();
const envelope = createBgmEnvelope(bgm, { master: 1, muted: false, ducked: false }, scheduler);
const fade = envelope.fadeTo(1, 1500);
advance(750); assert.ok(Math.abs(bgm.volume - 0.225) < 1e-8);
envelope.update({ master: 1, muted: false, ducked: true });
assert.ok(Math.abs(bgm.volume - 0.225) < 1e-8); // No immediate drop.
advance(160); assert.ok(bgm.volume > 0.1 && bgm.volume < 0.225);
advance(590); await fade;
assert.ok(Math.abs(bgm.volume - 0.1125) < 1e-8); // Fade and duck both respected.
envelope.update({ master: 1, muted: false, ducked: false });
assert.ok(Math.abs(bgm.volume - 0.1125) < 1e-8);
advance(450); assert.ok(bgm.volume > 0.1125 && bgm.volume < 0.45);
envelope.update({ master: 1, muted: true, ducked: false });
advance(450); assert.equal(bgm.volume, 0);
envelope.update({ master: 0, muted: false, ducked: false });
assert.equal(bgm.volume, 0);
const cancelled = envelope.fadeTo(0, 1500);
envelope.dispose();
assert.equal(await cancelled, false);
advance(5000); assert.equal(bgm.volume, 0); assert.equal(frames.size, 0);
console.log('✓ 음성 캐시 재사용/attempt 교체/다운로드·디코딩 취소/미디어 오류 및 BGM duck·fade·mute·dispose 동작 검증');
