/** Preserve the persisted response identity across live queues and replay. */
export function withLiveSceneIdentity(scene) {
  return { ...scene, presentationId: scene.presentationId || crypto.randomUUID(), voiceAutoEligible: true };
}

export function scenePresentationKey(scene) {
  return scene?.presentationId || (scene?.parentLogId != null && Number.isInteger(scene.sceneIndex)
    ? `${scene.parentLogId}/${scene.sceneIndex}/${Boolean(scene.__replay)}` : null);
}

export function withVoiceIdentity(data) {
  if (!data?.assistantLogId || !Array.isArray(data.scenes)) return data;
  return { ...data, scenes: data.scenes.map((scene, sceneIndex) => ({
    ...scene, presentationId: scene.presentationId || `${data.assistantLogId}/${sceneIndex}`,
    parentLogId: data.assistantLogId, sceneIndex, voiceAutoEligible: true,
  })) };
}

export function attachFirstVoiceIdentity(current, data) {
  const first = data?.scenes?.[0];
  if (!current || current.parentLogId || !first || !data.assistantLogId) return current;
  if ((current.dialogue || '') !== (first.dialogue || '') || (current.narration || '') !== (first.narration || '')
      || (current.speaker || '') !== (first.speaker || '')) return current;
  return { ...current, parentLogId: data.assistantLogId, sceneIndex: 0, voiceAutoEligible: true };
}

export function voiceSceneKey(roomId, scene) {
  if (!roomId || !scene?.parentLogId || !Number.isInteger(scene.sceneIndex)) return null;
  return `${roomId}/${scene.parentLogId}/${scene.sceneIndex}`;
}
