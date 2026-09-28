import { assetUrl } from './assetUrl';

// Art direction for the existing transparent originals. This is presentation metadata,
// never an authority for character access, gender, difficulty, or world membership.
const ORIGINALS = {
  airi:    { accent: '#dcc1e9', glow: '#8e708e', objectPosition: '50% 23%', worldLabel: '중세 판타지' },
  yeonhwa: { accent: '#b7dfd7', glow: '#5b928d', objectPosition: '50% 19%', worldLabel: '동양 판타지' },
  taeri:   { accent: '#d6cced', glow: '#8f80a2', objectPosition: '50% 18%', worldLabel: '현대 한국' },
  luna:    { accent: '#a9d9e6', glow: '#4f8f9d', objectPosition: '50% 19%', worldLabel: '현대 한국' },
  claire:  { accent: '#e5d7b1', glow: '#a19b7a', objectPosition: '50% 18%', worldLabel: '중세 판타지' },
  rosetta: { accent: '#e7becf', glow: '#a6728b', objectPosition: '50% 17%', worldLabel: '판타지 아카데미' },
  chaerin: { accent: '#e3cbb9', glow: '#ae897b', objectPosition: '50% 16%', worldLabel: '현대 한국' },
  sierra:  { accent: '#c8dac0', glow: '#7b9c8f', objectPosition: '50% 19%', worldLabel: '판타지 아카데미' },
  edel:    { accent: '#bdcced', glow: '#7187a7', objectPosition: '50% 17%', worldLabel: '판타지 아카데미' },
  seolah:  { accent: '#d4c3ed', glow: '#8878a5', objectPosition: '50% 18%', worldLabel: '동양 판타지' },
};

export function getCharacterPresentation(character = {}) {
  const source = character.thumbnailUrl || character.defaultImageUrl || '';
  const mediaSlug = source.match(/\/characters\/([^/]+)\//)?.[1];
  const slug = character.slug || character.characterSlug || mediaSlug || '';
  const known = !character.ugc && ORIGINALS[slug];
  return {
    slug,
    artMode: known ? 'cutout' : 'cover',
    backgroundUrl: known ? assetUrl(`/backgrounds/${slug}/bg_default.png`) : '',
    accent: known?.accent || '#d2c3fa',
    glow: known?.glow || '#786fa3',
    objectPosition: known?.objectPosition || '50% 22%',
    worldLabel: known?.worldLabel || '',
  };
}
