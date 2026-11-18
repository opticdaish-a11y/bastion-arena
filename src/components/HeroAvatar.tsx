import { Flame, Shield, Sparkles, Swords } from 'lucide-react';
import { HERO_TEMPLATES } from '../shared/heroesAndMaps';
import type { HeroClassId } from '../shared/types';

export function HeroIcon({
  classId,
  size = 20,
}: {
  classId: HeroClassId;
  size?: number;
}) {
  switch (classId) {
    case 'vanguard':
      return <Shield size={size} strokeWidth={2.2} />;
    case 'rogue':
      return <Swords size={size} strokeWidth={2.2} />;
    case 'pyromancer':
      return <Flame size={size} strokeWidth={2.2} />;
    case 'guardian':
      return <Sparkles size={size} strokeWidth={2.2} />;
  }
}

export function HeroPortrait({
  classId,
  alt,
  className = '',
}: {
  classId: HeroClassId;
  alt?: string;
  className?: string;
}) {
  const tpl = HERO_TEMPLATES[classId];
  return (
    <img
      src={tpl.portrait}
      alt={alt || tpl.name}
      className={className}
      loading="eager"
      draggable={false}
    />
  );
}
