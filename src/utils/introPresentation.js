// Only assets found in the original public/videos inventory belong here.
// A missing mapping intentionally selects the shared Aurora entrance: never probe
// guessed character/world URLs, or substitute another character's film.
export const CHARACTER_INTRO_VIDEOS = Object.freeze({
  airi: '/videos/characters/airi/intro.mp4',
  yeonhwa: '/videos/characters/yeonhwa/intro.mp4',
  taeri: '/videos/characters/taeri/intro.mp4',
  luna: '/videos/characters/luna/intro.mp4',
});

// Add world films here once their actual deployed assets have been verified.
export const WORLD_INTRO_VIDEOS = Object.freeze({});

export function getIntroVideo({ characterSlug, worldId, isWorld = false } = {}) {
  const registry = isWorld ? WORLD_INTRO_VIDEOS : CHARACTER_INTRO_VIDEOS;
  const key = isWorld ? worldId : characterSlug;
  return typeof key === 'string' && Object.hasOwn(registry, key) ? registry[key] : null;
}

// Presentation completion and data readiness are deliberately independent.
// Skip changes presentationDone only; neither it nor a timeout unlocks the scene.
export function canRevealEntry({ presentationDone, ready, error }) {
  return Boolean(presentationDone && ready && !error);
}
