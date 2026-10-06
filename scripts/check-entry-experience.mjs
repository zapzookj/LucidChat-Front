// Executes the actual page functions with controlled request/stream fixtures.
// No live account, generated scene, or paid request is needed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import { getIntroVideo, canRevealEntry } from '../src/utils/introPresentation.js';
import { extractLastSentence, subjectJosa } from '../src/utils/dialogueSanitizer.js';
import { attachFirstVoiceIdentity } from '../src/utils/ttsScene.js';

const sourceOf = name => readFileSync(new URL(`../src/pages/${name}`, import.meta.url), 'utf8');
const parsePage = source => parse(source, { sourceType: 'module', plugins: ['jsx'] });
function findNode(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const value of Object.values(node)) {
    if (!value || typeof value !== 'object') continue;
    for (const child of Array.isArray(value) ? value : [value]) {
      const found = findNode(child, predicate);
      if (found) return found;
    }
  }
  return null;
}
function namedFunction(source, name) {
  const declaration = findNode(parsePage(source), node => node.type === 'VariableDeclarator' && node.id?.name === name);
  assert.ok(declaration, `${name} exists`);
  const fn = declaration.init.type === 'CallExpression' ? declaration.init.arguments[0] : declaration.init;
  return source.slice(fn.start, fn.end);
}
const bind = (source, scope) => new Function(...Object.keys(scope), `return (${source})`)(...Object.values(scope));
function stateScope(initial = {}) {
  const state = { ...initial };
  const setter = key => value => { state[key] = typeof value === 'function' ? value(state[key]) : value; };
  return { state, setter };
}
const quietConsole = { error() {}, warn() {} };
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks += 1; };

// Skip must not accidentally grant readiness, including error/ready races.
for (const ready of [false, true]) for (const presentationDone of [false, true]) {
  check(canRevealEntry({ ready, presentationDone }) === (ready && presentationDone), 'two independent gates');
  check(!canRevealEntry({ ready, presentationDone, error: 'failed' }), 'error holds the entrance');
}
for (const slug of ['airi', 'yeonhwa', 'taeri', 'luna']) {
  check(getIntroVideo({ characterSlug: slug }) === `/videos/characters/${slug}/intro.mp4`, 'verified film map');
}
for (const slug of [undefined, null, '', 'ugc-example', 'constructor', '__proto__']) {
  check(getIntroVideo({ characterSlug: slug }) === null, 'unknown identity makes no speculative video request');
}
check(getIntroVideo({ isWorld: true, worldId: 'MODERN', characterSlug: 'airi' }) === null, 'world does not borrow a heroine film');

for (const page of ['ChatPage.jsx', 'ChatPageV2.jsx']) {
  const source = sourceOf(page);
  const functionSource = namedFunction(source, 'startIntroSequence');
  const splitNarration = bind(namedFunction(source, 'splitNarration'), {});
  function v1Fixture(logs, post) {
    const { state, setter } = stateScope();
    let requests = 0;
    const scope = {
      introRequestRef: { current: null }, introMountedRef: { current: true }, introRoomRef: { current: 'room' },
      AbortController, console: quietConsole, splitNarration, extractLastSentence, subjectJosa,
      api: { post: async (...args) => { requests += 1; return post?.(...args); }, get: async () => ({ data: { content: [...logs] } }) },
    };
    for (const key of ['OpeningReady', 'IntroError', 'IntroStep', 'Messages', 'SceneQueue', 'CurrentScene']) scope[`set${key}`] = setter(key);
    return { state, scope, run: bind(functionSource, scope), requests: () => requests };
  }
  let release;
  const deferred = new Promise(resolve => { release = resolve; });
  const fixture = v1Fixture([
    { role: 'ASSISTANT', cleanContent: '어서 와요.', emotionTag: 'HAPPY' },
    { role: 'SYSTEM', cleanContent: '달빛이 문틈으로 스며든다.' },
  ], () => deferred);
  const pending = fixture.run('room', { characterName: '아이리' });
  check(fixture.state.IntroStep === 'door' && fixture.state.OpeningReady === false, `${page}: presentation starts before request resolves`);
  await fixture.run('room', { characterName: '아이리' });
  check(fixture.requests() === 1, `${page}: pending init cannot be duplicated`);
  release(); await pending;
  check(fixture.state.OpeningReady && fixture.state.SceneQueue.length === 2, `${page}: narration and greeting both remain queued`);
  check(fixture.state.SceneQueue[0].isIntroNarration && fixture.state.SceneQueue[1].dialogue === '어서 와요.', `${page}: scene order is preserved`);
  check(fixture.scope.introRequestRef.current === null, `${page}: request ownership released`);

  const empty = v1Fixture([]);
  await empty.run('room', {});
  check(!empty.state.OpeningReady && !!empty.state.IntroError, `${page}: empty init cannot expose an empty dialogue`);
  const blank = v1Fixture([{ role: 'ASSISTANT', cleanContent: '  ' }, { role: 'SYSTEM', cleanContent: null }]);
  await blank.run('room', {});
  check(!blank.state.OpeningReady && !!blank.state.IntroError, `${page}: blank stored records are not a playable opening`);
  const invalidHistory = v1Fixture([]);
  invalidHistory.scope.api.get = async () => ({ data: { content: null } });
  await invalidHistory.run('room', {});
  check(!invalidHistory.state.OpeningReady && !!invalidHistory.state.IntroError, `${page}: malformed history remains gated`);
  const failed = v1Fixture([], () => { throw new Error('offline'); });
  await failed.run('room', {});
  check(!!failed.state.IntroError && !failed.scope.introRequestRef.current, `${page}: failed init is explicitly retryable`);
  const oldRoom = v1Fixture([]);
  await oldRoom.run('previous-room', {});
  check(oldRoom.requests() === 0, `${page}: stale initialization does not start a request`);
  const unmounted = v1Fixture([]);
  unmounted.scope.introMountedRef.current = false;
  await unmounted.run('room', {});
  check(unmounted.requests() === 0, `${page}: unmounted initialization is ignored`);

  const cancelled = v1Fixture([], async (_url, _body, options) => {
    options.signal.addEventListener('abort', () => {});
    await Promise.resolve();
  });
  const cancellation = cancelled.run('room', {});
  cancelled.scope.introRequestRef.current.abort();
  await cancellation;
  check(!cancelled.state.OpeningReady && !cancelled.state.IntroError, `${page}: navigation cancellation is not an error`);
}

const v2Source = sourceOf('ChatPageV2.jsx');
const v2Function = namedFunction(v2Source, 'fireOpeningV2');
async function v2Fixture(emit, { busy = false, alreadyFired = false } = {}) {
  const { state, setter } = stateScope({ Messages: [] });
  let requests = 0;
  const scope = {
    roomId: 'room', v2Room: { heroines: [] }, openingFiredRef: { current: alreadyFired },
    introMountedRef: { current: true }, introRoomRef: { current: 'room' }, introRequestRef: { current: null },
    sseAbortRef: { current: null }, isSseBusy: () => busy,
    isSystemSpeakerName: name => !name, console: quietConsole, attachFirstVoiceIdentity,
    buildHistoryEntries: scenes => scenes, sceneStage: { notifyLocationChange() {} },
    fetchStoryV2RoomDetail: async () => ({}), syncCharacterStatsFromRoom() {}, showToast() {},
    markSseTurnStart: () => { scope.sseAbortRef.current = new AbortController(); return 17; },
    markSseTurnEnd: token => { assert.equal(token, 17); state.released = true; },
    sendV2Opening: async (_id, callbacks) => { requests += 1; await emit(callbacks, scope); },
  };
  for (const key of ['OpeningReady', 'IntroError', 'IsTyping', 'AwaitingFinalResult', 'CurrentScene', 'DialogueOptions',
    'SceneQueue', 'CurrentSpeaker', 'DisplayedEmotion', 'Messages', 'HasInnerThought', 'ThoughtUnlocked',
    'CurrentInnerThought', 'CurrentAssistantLogId', 'TopicConcluded', 'LocationTransition', 'CurrentBgmMode', 'V2Room']) scope[`set${key}`] = setter(key);
  await bind(v2Function, scope)([]);
  return { state, scope, requests };
}
const first = { speaker: null, narration: '낯선 세계의 문이 열린다.', dialogue: '', emotion: 'NEUTRAL' };
const second = { speaker: '아이리', narration: '', dialogue: '기다리고 있었어요.' };
const normal = await v2Fixture(cb => { cb.onFirstScene(first); cb.onFinalResult({ scenes: [first, second] }); });
check(normal.state.OpeningReady && normal.state.CurrentScene.narration === first.narration, 'V2 first_scene opens readiness');
check(normal.state.SceneQueue.length === 1 && normal.state.Messages.length === 2, 'V2 final keeps remaining scenes/history');
const finalOnly = await v2Fixture(cb => cb.onFinalResult({ scenes: [first, second] }));
check(finalOnly.state.OpeningReady && finalOnly.state.CurrentScene.narration === first.narration, 'V2 final-only stream restores the omitted first_scene');
const emptyStream = await v2Fixture(() => {});
check(!emptyStream.state.OpeningReady && !!emptyStream.state.IntroError && emptyStream.state.released, 'V2 empty close remains gated and releases request');
const firstOnly = await v2Fixture(cb => cb.onFirstScene(first));
check(firstOnly.state.OpeningReady && !firstOnly.state.AwaitingFinalResult && firstOnly.state.released, 'V2 partial close keeps received scene and releases input wait');
const failure = await v2Fixture(cb => cb.onError({ message: 'offline' }));
check(!!failure.state.IntroError && failure.scope.openingFiredRef.current, 'V2 failure cannot trigger an automatic retry loop');
for (const flags of [{ busy: true }, { alreadyFired: true }]) {
  check((await v2Fixture(() => {}, flags)).requests === 0, 'V2 existing request is never duplicated');
}
const malformed = await v2Fixture(cb => cb.onFirstScene({ narration: ' ', dialogue: 10 }));
check(!malformed.state.OpeningReady && !!malformed.state.IntroError, 'V2 malformed scene does not unlock the entrance');
const rejected = await v2Fixture(() => { throw new Error('unexpected rejection'); });
check(!!rejected.state.IntroError && rejected.state.released && !rejected.scope.introRequestRef.current,
  'V2 unexpected rejection releases its own request and remains retryable');
const duplicateFinal = await v2Fixture(cb => {
  cb.onFinalResult({ scenes: [first, second] });
  cb.onFinalResult({ scenes: [first, second] });
});
check(duplicateFinal.state.Messages.length === 2, 'V2 duplicate final event does not duplicate history');
for (const leave of [scope => { scope.introRoomRef.current = 'next-room'; },
  scope => { scope.introMountedRef.current = false; }, scope => scope.sseAbortRef.current.abort()]) {
  const stale = await v2Fixture((cb, scope) => {
    leave(scope);
    cb.onFirstScene(first);
    cb.onFinalResult({ scenes: [first, second] });
    cb.onError({ message: 'late error' });
  });
  check(!stale.state.OpeningReady && stale.state.Messages.length === 0 && !stale.state.IntroError && stale.state.released,
    'V2 leaving a room discards late scene, history and error events');
}

// Execute the actual media lifecycle as React StrictMode does: setup/cleanup/setup.
// Pending play() rejection from the discarded run must not kill the current film.
const experienceSource = readFileSync(new URL('../src/components/experience/EntryExperience.jsx', import.meta.url), 'utf8');
const mediaEffect = findNode(parsePage(experienceSource), node => node.type === 'CallExpression'
  && node.callee?.name === 'useEffect' && experienceSource.slice(node.start, node.end).includes('video.play()'));
assert.ok(mediaEffect);
const mediaEffectSource = experienceSource.slice(mediaEffect.arguments[0].start, mediaEffect.arguments[0].end);
const playbackAttempts = [];
let mediaFailure = false;
const video = {
  src: '',
  setAttribute(name, value) { this[name] = value; },
  removeAttribute(name) { this[name] = ''; },
  play() {
    check(this.src === '/verified-intro.mp4', 'each media setup restores the verified source');
    return new Promise((_resolve, reject) => { playbackAttempts.push(reject); });
  },
  pause() {}, load() {},
};
const setupMedia = bind(mediaEffectSource, { videoRef: { current: video }, useVideo: true,
  videoSrc: '/verified-intro.mp4', setVideoFailed: value => { mediaFailure = value; } });
const cleanFirstMedia = setupMedia();
cleanFirstMedia();
const cleanSecondMedia = setupMedia();
playbackAttempts[0](new Error('cleanup interrupted play'));
await Promise.resolve();
check(!mediaFailure, 'discarded playback rejection does not fail the active media');
playbackAttempts[1](new Error('autoplay unavailable'));
await Promise.resolve();
check(mediaFailure, 'active playback rejection selects the shared animation fallback');
cleanSecondMedia();
check(video.src === '', 'media cleanup releases its source');

// Execute the actual automatic-opening effect with hydration and resume fixtures.
const openingEffect = findNode(parsePage(v2Source), node => node.type === 'CallExpression'
  && node.callee?.name === 'useEffect' && v2Source.slice(node.start, node.end).includes('openingCandidateRoomId !== roomId'));
assert.ok(openingEffect);
const effectSource = v2Source.slice(openingEffect.arguments[0].start, openingEffect.arguments[0].end);
for (const overrides of [{}, { isLoading: true }, { entryLoadError: 'offline' }, { openingCandidateRoomId: null },
  { openingCandidateRoomId: 'old-room' }, { messages: [{}] }, { v2Room: { endingReached: true } }]) {
  let fires = 0;
  const scope = { isV2: true, isLoading: false, entryLoadError: null, openingCandidateRoomId: 'room', roomId: 'room',
    openingFiredRef: { current: false }, messages: [], v2Room: { heroines: [] }, setIntroStep() {}, fireOpeningV2: () => { fires += 1; }, ...overrides };
  bind(effectSource, scope)();
  check(fires === (Object.keys(overrides).length ? 0 : 1), 'V2 only confirmed, loaded, empty room auto-starts');
}
console.log(`✓ Entry experience: ${checks} readiness, request ownership, stream-order, failure and video-mapping checks passed.`);
