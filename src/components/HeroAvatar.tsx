import { Flame, Shield, Sparkles, Swords } from 'lucide-react';
import type { HeroClassId } from '../shared/types';

export function HeroIcon({
  classId,
  size = 22,
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
