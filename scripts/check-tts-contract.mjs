import assert from 'node:assert/strict';
import { withVoiceIdentity, attachFirstVoiceIdentity, voiceSceneKey } from '../src/utils/ttsScene.js';
import { messageToScene } from '../src/utils/sceneReplay.js';

const response = withVoiceIdentity({ assistantLogId: 'response-a', scenes: [
  { speaker: '아이리', dialogue: '안녕', narration: '미소 짓는다' },
  { speaker: '아이리', dialogue: '다시 만나서 반가워', narration: '' },
] });
assert.equal(response.scenes[1].parentLogId, 'response-a');
assert.equal(response.scenes[1].sceneIndex, 1);
const current = attachFirstVoiceIdentity({ speaker: '아이리', dialogue: '안녕', narration: '미소 짓는다' }, response);
assert.equal(voiceSceneKey(10, current), '10/response-a/0');
assert.equal(attachFirstVoiceIdentity({ ...current, parentLogId: 'older' }, response).parentLogId, 'older');
assert.equal(attachFirstVoiceIdentity({ speaker: '아이리', dialogue: '다른 말' }, response).parentLogId, undefined);
assert.equal(voiceSceneKey(10, { dialogue: 'first_scene 아직 저장 전' }), null);
assert.equal(voiceSceneKey(10, { parentLogId: 'a', sceneIndex: '1' }), null);
const replay = messageToScene({ role: 'ASSISTANT', speaker: '아이리', cleanContent: '*미소 짓는다*\n안녕', parentLogId: 'old-response', sceneIndex: 3 });
assert.equal(voiceSceneKey(10, replay), '10/old-response/3');
assert.equal(replay.__replay, true);
assert.equal(replay.dialogue, '안녕');
assert.equal(messageToScene({ role: 'SYSTEM', parentLogId: 'old-system', sceneIndex: 2, cleanContent: '*바람이 분다*' }).dialogue, '');
assert.equal(withVoiceIdentity({ scenes: [{}] }).scenes[0].parentLogId, undefined);
console.log('✓ TTS 응답 식별자·현재 첫 씬·과거 리플레이 계약 12개 통과');
