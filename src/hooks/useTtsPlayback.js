import { useState, useRef, useCallback, useEffect } from 'react';
import api from '../api/axios';
import { voiceSceneKey, scenePresentationKey } from '../utils/ttsScene';
import { VoiceClipCache } from '../utils/voiceClipCache';

export default function useTtsPlayback(roomId, scene, { onEnergyChanged, notify, active = true, awaitingFinalResult = false } = {}) {
  const [mode, setMode] = useState({ available: false, enabled: false, energyCost: 1 });
  const [status, setStatus] = useState(null);
  const [playback, setPlayback] = useState('idle');
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [volume, setVolumeState] = useState(() => {
    const stored = Number(localStorage.getItem('voiceVolume') ?? 0.85);
    return Number.isFinite(stored) ? Math.max(0, Math.min(1, stored)) : 0.85;
  });
  const audio = useRef(null);
  const cache = useRef(null);
  if (!cache.current) cache.current = new VoiceClipCache(async (path, signal) => (await api.get(path, { responseType: 'blob', signal })).data);
  const released = useRef(new Map());
  const [, refreshPresentation] = useState(0);
  const epoch = useRef(0);
  const pollEpoch = useRef(0);
  const statusRequest = useRef(null);
  const modeEpoch = useRef(0);
  const previousActive = useRef(active);
  const played = useRef(new Set());
  const heard = useRef(new Set());
  const revoked = useRef(new Set());
  const current = useRef(null);
  const callbacks = useRef({ onEnergyChanged, notify });
  callbacks.current = { onEnergyChanged, notify };
  const key = voiceSceneKey(roomId, scene);
  const presentationId = scenePresentationKey(scene);
  current.current = { roomId, scene, key, presentationId, active, mode, volume };
  const releasePresentation = useCallback((reason) => {
    const id = current.current.presentationId;
    if (id && !released.current.has(id)) { released.current.set(id, reason); refreshPresentation(value => value + 1); }
  }, []);
  const presentationPending = Boolean(presentationId && active && !document.hidden && mode.available && mode.enabled
    && scene?.voiceAutoEligible && !scene.__replay && scene.dialogue && !scene.isEvent && !released.current.has(presentationId));

  const stop = useCallback(() => {
    epoch.current++;
    if (audio.current) { audio.current.onended = null; audio.current.onerror = null; audio.current.pause(); audio.current = null; }
    setPlayback('idle');
  }, []);
  const refreshMode = useCallback(async () => {
    if (!roomId) return;
    const ticket = ++modeEpoch.current;
    try { const { data } = await api.get(`/tts/rooms/${roomId}`); if (current.current.roomId === roomId && modeEpoch.current === ticket) setMode(data); }
    catch { if (current.current.roomId === roomId && modeEpoch.current === ticket) setMode({ available: false, enabled: false, energyCost: 1 }); }
  }, [roomId]);
  useEffect(() => {
    const displayed = current.current.presentationId;
    const priorRelease = released.current.get(displayed);
    setConfirmation(null); setStatus(null); played.current.clear(); heard.current.clear(); revoked.current.clear(); released.current.clear();
    if (priorRelease) released.current.set(displayed, priorRelease);
    void refreshMode();
    return () => { stop(); cache.current.reset(); };
  }, [refreshMode, stop]);
  useEffect(() => {
    if (active && !previousActive.current) void refreshMode();
    previousActive.current = active;
  }, [active, refreshMode]);
  useEffect(() => {
    cache.current.reset();
    if (!active) { stop(); releasePresentation('inactive'); }
  }, [roomId, scene?.parentLogId, active, stop, releasePresentation]);
  useEffect(() => {
    if (!presentationPending) return;
    // Generation starts only after final_result gives us the persisted response ID.
    // The stream already has its own deadline; do not spend the audio budget on LLM text generation.
    if (!key) {
      if (!awaitingFinalResult) releasePresentation('unavailable');
      return;
    }
    const timer = setTimeout(() => { stop(); cache.current.reset(); releasePresentation('timeout'); }, 30000);
    return () => clearTimeout(timer);
  }, [presentationId, key, presentationPending, awaitingFinalResult, stop, releasePresentation]);
  useEffect(() => {
    // Once text is allowed to start, later mode/status metadata must never hide it again.
    if (!active || document.hidden || !mode.available || !mode.enabled) {
      releasePresentation('fallback'); stop(); cache.current.reset();
    }
  }, [roomId, mode.available, mode.enabled, presentationId, active, releasePresentation, stop]);
  const cancelConfirmation = useCallback(() => setConfirmation(null), []);
  useEffect(() => {
    const discard = () => {
      pollEpoch.current++; statusRequest.current?.abort(); stop(); cache.current.reset(); releasePresentation('inactive');
      if (current.current.key) setStatus({ status: 'UNAVAILABLE' });
    };
    const hidden = () => { if (document.hidden) discard(); };
    const logout = event => { if (event.key === 'accessToken' || event.key === null) discard(); };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('storage', logout);
    return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('storage', logout); };
  }, [stop, releasePresentation]);
  useEffect(() => { if (audio.current) audio.current.volume = volume; }, [volume]);
  const setVolume = (value) => { const next = Math.max(0, Math.min(1, value)); setVolumeState(next); localStorage.setItem('voiceVolume', String(next)); };

  const play = useCallback(async (info, automatic = false) => {
    const target = current.current;
    if (!target.key || !target.active || document.hidden || revoked.current.has(target.scene.parentLogId)) return;
    if (!info?.sceneIndices?.includes(target.scene.sceneIndex)) return;
    if (automatic && released.current.has(target.presentationId)) return;
    stop(); const ticket = epoch.current;
    setPlayback('loading');
    try {
      if (!automatic) {
        // A cached private clip is not proof that its source still exists or is still owned.
        const { data: latest } = await api.get(`/tts/rooms/${target.roomId}/responses/${target.scene.parentLogId}`);
        if (epoch.current !== ticket || current.current.key !== target.key || !current.current.active || document.hidden || revoked.current.has(target.scene.parentLogId)) return;
        setStatus(latest);
        if (!['READY', 'GREETING'].includes(latest.status) || !latest.sceneIndices?.includes(target.scene.sceneIndex)) { stop(); cache.current.reset(); return; }
        info = latest;
      }
      const url = info.status === 'GREETING' ? `/tts/greetings/${encodeURIComponent(info.greetingSlug)}`
        : `/tts/rooms/${target.roomId}/responses/${target.scene.parentLogId}/clips/${target.scene.sceneIndex}`;
      cache.current.useScope(`${target.roomId}/${target.scene.parentLogId}/${info.attemptId || info.greetingSlug || 'ready'}`);
      const player = await cache.current.prepare(target.scene.sceneIndex, url);
      if (epoch.current !== ticket || current.current.key !== target.key || !current.current.active || document.hidden
          || revoked.current.has(target.scene.parentLogId) || (automatic && (!current.current.mode.enabled || released.current.has(target.presentationId)))) return;
      audio.current = player;
      player.currentTime = 0;
      player.volume = current.current.volume;
      player.onended = () => { if (epoch.current === ticket) stop(); };
      player.onerror = () => { if (epoch.current === ticket) { stop(); cache.current.reset(); setPlayback('error'); releasePresentation('unavailable'); } };
      await player.play();
      if (epoch.current !== ticket) { player.pause(); return; }
      setPlayback('playing'); played.current.add(target.key); heard.current.add(target.key);
      releasePresentation('playing');
    } catch (error) {
      if (epoch.current !== ticket) return;
      stop(); cache.current.reset(); setPlayback(error?.name === 'NotAllowedError' ? 'blocked' : 'error');
      releasePresentation('unavailable');
    }
  }, [stop, releasePresentation]);

  useEffect(() => {
    stop(); setStatus(null); setConfirmation(null);
    if (!key || !active || !scene?.dialogue || scene.isEvent) return;
    const request = new AbortController(); statusRequest.current = request;
    const ticket = ++pollEpoch.current; let timer; let done = false;
    const poll = async () => {
      if (done || pollEpoch.current !== ticket) return;
      if (document.hidden) { setStatus({ status: 'UNAVAILABLE' }); releasePresentation('inactive'); return; }
      try {
        const { data } = await api.get(`/tts/rooms/${roomId}/responses/${scene.parentLogId}`, { signal: request.signal });
        if (done || pollEpoch.current !== ticket || current.current.key !== key || revoked.current.has(scene.parentLogId)) return;
        setStatus(data);
        if (data.status === 'QUEUED' || data.status === 'GENERATING') timer = setTimeout(poll, 750);
        else if (data.status === 'READY' || data.status === 'FAILED') callbacks.current.onEnergyChanged?.();
        if (!data.sceneIndices?.includes(scene.sceneIndex) || ['FAILED', 'AVAILABLE', 'UNAVAILABLE', 'UNSUPPORTED', 'SKIPPED', 'CANCELLED'].includes(data.status)) releasePresentation('unavailable');
        if (data.status === 'READY' && current.current.mode.enabled && !document.hidden && scene.voiceAutoEligible && !scene.__replay) {
          // Only this owned READY response's next two supported scenes; never a POST.
          cache.current.useScope(`${roomId}/${scene.parentLogId}/${data.attemptId || 'ready'}`);
          for (const index of data.sceneIndices.filter(index => index > scene.sceneIndex).slice(0, 2)) {
            void cache.current.prepare(index, `/tts/rooms/${roomId}/responses/${scene.parentLogId}/clips/${index}`).catch(() => {});
          }
        }
        if (data.status === 'READY' && current.current.mode.enabled && scene.voiceAutoEligible && !scene.__replay && !played.current.has(key)) {
          played.current.add(key); void play(data, true);
        }
      } catch { if (!done && pollEpoch.current === ticket) { setStatus({ status: 'UNAVAILABLE' }); releasePresentation('unavailable'); } }
    };
    void poll();
    return () => { done = true; clearTimeout(timer); request.abort(); stop(); };
  }, [key, active, roomId, scene?.dialogue, scene?.isEvent, scene?.voiceAutoEligible, scene?.__replay, scene?.parentLogId, refreshNonce, play, stop, releasePresentation]);

  const toggle = async () => {
    if (!mode.enabled) { setConfirmation({ type: 'mode' }); return; }
    modeEpoch.current++; stop(); cache.current.reset(); releasePresentation('off');
    setBusy(true);
    try { const { data } = await api.patch(`/tts/rooms/${roomId}`, { enabled: false, expectedEnergyCost: mode.energyCost }); if (current.current.roomId === roomId) { modeEpoch.current++; setMode(data); stop(); } }
    catch { callbacks.current.notify?.('보이스 설정을 변경하지 못했습니다.', 'error'); }
    finally { setBusy(false); }
  };
  const listen = () => {
    if (revoked.current.has(current.current.scene?.parentLogId)) return;
    if (status?.status === 'UNAVAILABLE') { setRefreshNonce(value => value + 1); return; }
    if (playback === 'playing') { stop(); return; }
    if (status?.status === 'READY' || status?.status === 'GREETING') { void play(status); return; }
    if (status?.status === 'AVAILABLE' || status?.status === 'FAILED') setConfirmation({ type: 'unlock', key, attemptId: status.attemptId, retry: status.status === 'FAILED' });
  };
  const confirm = async () => {
    const pending = confirmation; if (!pending || busy) return;
    setBusy(true);
    try {
      if (pending.type === 'mode') {
        modeEpoch.current++;
        const { data } = await api.patch(`/tts/rooms/${roomId}`, { enabled: true, expectedEnergyCost: mode.energyCost });
        if (current.current.roomId !== roomId) return;
        modeEpoch.current++;
        setMode(data);
      } else {
        if (pending.key !== current.current.key) return;
        const target = current.current; const requestEpoch = epoch.current;
        const { data } = await api.post(`/tts/rooms/${roomId}/responses/${target.scene.parentLogId}`, {
          expectedEnergyCost: mode.energyCost, idempotencyKey: crypto.randomUUID(), retryOfAttemptId: pending.retry ? pending.attemptId : null,
        });
        callbacks.current.onEnergyChanged?.();
        if (pending.key !== current.current.key || epoch.current !== requestEpoch || revoked.current.has(target.scene.parentLogId)) return;
        setStatus(data);
        if (data.status === 'READY' || data.status === 'GREETING') void play(data);
        else if (data.status === 'QUEUED' || data.status === 'GENERATING') {
          // Manual requests keep playback intent only while this exact scene remains visible.
          const wait = async () => {
            if (pending.key !== current.current.key || epoch.current !== requestEpoch || !current.current.active || revoked.current.has(target.scene.parentLogId)) return;
            try {
              const { data: next } = await api.get(`/tts/rooms/${roomId}/responses/${target.scene.parentLogId}`);
              if (pending.key !== current.current.key || epoch.current !== requestEpoch) return;
              setStatus(next);
              if (next.status === 'QUEUED' || next.status === 'GENERATING') setTimeout(wait, 1500);
              else { callbacks.current.onEnergyChanged?.(); if (next.status === 'READY') void play(next); }
            } catch { if (pending.key === current.current.key && epoch.current === requestEpoch) { setStatus({ status: 'UNAVAILABLE' }); setPlayback('error'); } }
          };
          setTimeout(wait, 1500);
        }
      }
      setConfirmation(null);
    } catch (error) {
      callbacks.current.notify?.(error.response?.status === 402 ? '음성 생성에 필요한 에너지가 부족합니다.' : '보이스 요청을 완료하지 못했습니다. 다시 확인해 주세요.', 'error');
      void refreshMode();
    } finally { setBusy(false); }
  };
  const invalidate = (logId) => {
    revoked.current.add(logId);
    if (current.current.scene?.parentLogId === logId) { stop(); cache.current.reset(); releasePresentation('deleted'); setStatus(null); setConfirmation(null); }
  };
  const checking = Boolean(!status && active && scene?.dialogue && !scene.isEvent && (key || scene.voiceAutoEligible));
  return { mode, status, playback, hasPlayed: heard.current.has(key), presentationPending, checking, busy, confirmation, cancelConfirmation, confirm, toggle, listen, stop, invalidate, volume, setVolume, refreshMode };
}
