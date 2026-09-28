import { useState } from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { getCharacterPresentation } from '../../utils/characterPresentation';
import { assetUrl } from '../../utils/assetUrl';

export default function LobbyFeature({ items, onSelect, guest }) {
  const [selectedId, setSelectedId] = useState(null);
  const [failed, setFailed] = useState({});
  const reduce = useReducedMotion();
  const featured = items.find(c => c.characterId === selectedId) || items[0];
  const art = getCharacterPresentation(featured);
  const thumbnail = assetUrl(featured?.thumbnailUrl || featured?.defaultImageUrl);
  const fail = (url) => setFailed(previous => ({ ...previous, [url]: true }));
  return (
    <section className={`aurora-feature ${art.artMode === 'cover' ? 'aurora-feature--cover' : ''}`} aria-label="만나볼 캐릭터" style={{ '--character-glow': art.glow, '--character-accent': art.accent }}>
      <div className="aurora-feature-backdrop" aria-hidden="true">
        {art.backgroundUrl && !failed[art.backgroundUrl] && <img src={art.backgroundUrl} alt="" onError={() => fail(art.backgroundUrl)} decoding="async" />}
      </div>
      <div className="aurora-feature-wash" aria-hidden="true" />
      <div className="aurora-feature-arch" aria-hidden="true"><span /></div>
      {thumbnail && !failed[thumbnail] && (
        <Motion.img key={thumbnail} src={thumbnail} alt="" className="aurora-feature-portrait" decoding="async" fetchPriority="high"
          initial={reduce ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .55, ease: [.2, .7, .2, 1] }}
          onError={() => fail(thumbnail)} />
      )}
      <div className="aurora-feature-copy">
        <p className="aurora-eyebrow"><span aria-hidden="true" /> BETWEEN REALITY & DREAM</p>
        <h1>일상과 꿈 사이,<br /><span>이야기가 시작되는 곳.</span></h1>
        <p className="aurora-feature-description">마음이 가는 캐릭터에게 말을 건네보세요.<br className="hidden sm:block" /> 당신의 한마디가 새로운 장면이 됩니다.</p>
        {featured ? <button type="button" className="aurora-button-primary aurora-feature-cta" onClick={() => onSelect(featured.characterId)}>
          <span>{featured.name} 만나보기</span><ArrowUpRight size={17} aria-hidden="true" />
        </button> : <div className="aurora-feature-placeholder"><Sparkles size={17} aria-hidden="true" /><span>당신의 다음 이야기를 기다리는 중</span></div>}
        <p className="aurora-feature-hint">{guest ? '자유롭게 둘러보고, 대화를 시작할 때 로그인하세요.' : '당신의 속도로, 당신만의 이야기를 만들어 가세요.'}</p>
      </div>
      {featured && <div className="aurora-feature-credit" aria-live="polite"><span>{art.worldLabel || '캐릭터 이야기'}</span><strong>{featured.name}</strong><p>{featured.tagline}</p></div>}
      {items.length > 1 && <div className="aurora-feature-picker" aria-label="소개할 캐릭터 선택">
        {items.map((item,index) => <button key={item.characterId} type="button" aria-label={`${item.name} 소개 보기`} aria-pressed={featured?.characterId === item.characterId}
          className={featured?.characterId === item.characterId ? 'is-selected' : ''} onClick={() => setSelectedId(item.characterId)}><span className="aurora-feature-picker-number">0{index+1}</span><span className="aurora-feature-picker-name">{item.name}</span><span className="aurora-feature-picker-line" aria-hidden="true" /></button>)}
      </div>}
    </section>
  );
}
