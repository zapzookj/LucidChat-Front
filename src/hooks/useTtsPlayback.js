import { useState, useRef, useCallback, useEffect } from 'react';
import api from '../api/axios';
import { voiceSceneKey } from '../utils/ttsScene';

export default function useTtsPlayback(roomId, scene, { onEnergyChanged, notify, active = true } = {}) {
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
  const objectUrl = useRef(null);
  const epoch = useRef(0);
  const played = useRef(new Set());
  const revoked = useRef(new Set());
  const current = useRef(null);
  const callbacks = useRef({ onEnergyChanged, notify });
  callbacks.current = { onEnergyChanged, notify };
  const key = voiceSceneKey(roomId, scene);
  current.current = { roomId, scene, key, active, mode, volume };

  const stop = useCallback(() => {
    epoch.current++;
    if (audio.current) { audio.current.pause(); audio.current.removeAttribute('src'); audio.current.load(); audio.current = null; }
    if (objectUrl.current) { URL.revokeObjectURL(objectUrl.current); objectUrl.current = null; }
    setPlayback('idle');
  }, []);
  const refreshMode = useCallback(async () => {
    if (!roomId) return;
    try { const { data } = await api.get(`/tts/rooms/${roomId}`); if (current.current.roomId === roomId) setMode(data); }
    catch { if (current.current.roomId === roomId) setMode({ available: false, enabled: false, energyCost: 1 }); }
  }, [roomId]);
  useEffect(() => { setConfirmation(null); setStatus(null); played.current.clear(); revoked.current.clear(); void refreshMode(); return stop; }, [refreshMode, stop]);
  useEffect(() => { if (active) void refreshMode(); }, [active, refreshMode]);
  const cancelConfirmation = useCallback(() => setConfirmation(null), []);
  useEffect(() => {
    const hidden = () => { if (document.hidden) stop(); };
    const logout = () => { if (!localStorage.getItem('accessToken')) stop(); };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('storage', logout);
    return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('storage', logout); };
  }, [stop]);
  useEffect(() => { if (audio.current) audio.current.volume = volume; }, [volume]);
  const setVolume = (value) => { const next = Math.max(0, Math.min(1, value)); setVolumeState(next); localStorage.setItem('voiceVolume', String(next)); };

  const play = useCallback(async (info, automatic = false) => {
    const target = current.current;
    if (!target.key || !target.active || document.hidden || revoked.current.has(target.scene.parentLogId)) return;
    if (!info?.sceneIndices?.includes(target.scene.sceneIndex)) return;
    stop(); const ticket = epoch.current;
    setPlayback('loading');
    try {
      const url = info.status === 'GREETING' ? `/tts/greetings/${encodeURIComponent(info.greetingSlug)}`
        : `/tts/rooms/${target.roomId}/responses/${target.scene.parentLogId}/clips/${target.scene.sceneIndex}`;
      const { data } = await api.get(url, { responseType: 'blob' });
      if (epoch.current !== ticket || current.current.key !== target.key || !current.current.active || document.hidden
          || revoked.current.has(target.scene.parentLogId) || (automatic && !current.current.mode.enabled)) return;
      objectUrl.current = URL.createObjectURL(data);
      const player = new Audio(objectUrl.current); audio.current = player;
      player.volume = current.current.volume;
      player.onended = () => { if (epoch.current === ticket) stop(); };
      player.onerror = () => { if (epoch.current === ticket) { stop(); setPlayback('error'); } };
      await player.play();
      if (epoch.current !== ticket) { player.pause(); return; }
      setPlayback('playing'); played.current.add(target.key);
    } catch (error) {
      if (epoch.current !== ticket) return;
      stop(); setPlayback(error?.name === 'NotAllowedError' ? 'blocked' : 'error');
    }
  }, [stop]);

  useEffect(() => {
    stop(); setStatus(null); setConfirmation(null);
    if (!key || !active || !scene?.dialogue || scene.isEvent) return;
    const request = new AbortController(); let timer; let done = false;
    const poll = async () => {
      try {
        const { data } = await api.get(`/tts/rooms/${roomId}/responses/${scene.parentLogId}`, { signal: request.signal });
        if (done || current.current.key !== key || revoked.current.has(scene.parentLogId)) return;
        setStatus(data);
        if (data.status === 'QUEUED' || data.status === 'GENERATING') timer = setTimeout(poll, 1500);
        else if (data.status === 'READY' || data.status === 'FAILED') callbacks.current.onEnergyChanged?.();
        if (data.status === 'READY' && current.current.mode.enabled && scene.voiceAutoEligible && !scene.__replay && !played.current.has(key)) {
          played.current.add(key); void play(data, true);
        }
      } catch { if (!done) setStatus({ status: 'UNAVAILABLE' }); }
    };
    void poll();
    return () => { done = true; clearTimeout(timer); request.abort(); stop(); };
  }, [key, active, roomId, scene?.dialogue, scene?.isEvent, scene?.voiceAutoEligible, scene?.__replay, scene?.parentLogId, refreshNonce, play, stop]);

  const toggle = async () => {
    if (!mode.enabled) { setConfirmation({ type: 'mode' }); return; }
    setBusy(true);
    try { const { data } = await api.patch(`/tts/rooms/${roomId}`, { enabled: false, expectedEnergyCost: mode.energyCost }); if (current.current.roomId === roomId) { setMode(data); stop(); } }
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
        const { data } = await api.patch(`/tts/rooms/${roomId}`, { enabled: true, expectedEnergyCost: mode.energyCost });
        if (current.current.roomId !== roomId) return;
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
    if (current.current.scene?.parentLogId === logId) { stop(); setStatus(null); setConfirmation(null); }
  };
  return { mode, status, playback, busy, confirmation, cancelConfirmation, confirm, toggle, listen, stop, invalidate, volume, setVolume, refreshMode };
}
