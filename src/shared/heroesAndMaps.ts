import type { ArenaId, HeroClassId, HeroTemplate, TileType } from './types';

export const HERO_TEMPLATES: Record<HeroClassId, HeroTemplate> = {
  vanguard: {
    classId: 'vanguard',
    name: 'Sir Kael',
    title: 'Vanguardia Real',
    role: 'Tanque',
    maxHp: 24,
    move: 3,
    range: 1,
    atk: 4,
    lore: 'Veterano inquebrantable de la Guardia Real. Rompe líneas enemigas con su gran escudo rúnico.',
    accentColor: '#2c7ac9',
    portrait: '/art/hero_vanguard.webp',
    abilities: {
      basic: {
        id: 'basic',
        name: 'Tajo de Acero',
        description: 'Golpe cuerpo a cuerpo que causa 4 de daño.',
        energyCost: 0,
        cooldown: 0,
        range: 1,
        targetType: 'enemy',
      },
      skill1: {
        id: 'skill1',
        name: 'Embestida de Escudo',
        description: 'Carga a un enemigo (rango 2), causa 5 de daño y lo empuja (+2 si choca contra muro).',
        energyCost: 2,
        cooldown: 2,
        range: 2,
        targetType: 'enemy',
        requiresLos: true,
      },
      skill2: {
        id: 'skill2',
        name: 'Égida Real',
        description: 'Gana +6 de Escudo y contraataque defensivo por 1 turno.',
        energyCost: 2,
        cooldown: 3,
        range: 0,
        targetType: 'self',
      },
    },
  },
  rogue: {
    classId: 'rogue',
    name: 'Lyra',
    title: 'Pícara Sombría',
    role: 'Asesina',
    maxHp: 17,
    move: 4,
    range: 1,
    atk: 5,
    lore: 'Maestra del sigilo y el veneno. Se teletransporta tras las líneas rivales sin ser vista.',
    accentColor: '#219a6b',
    portrait: '/art/hero_rogue.webp',
    abilities: {
      basic: {
        id: 'basic',
        name: 'Hoja Gemela',
        description: 'Ataque rápido de 5 de daño (+3 extra si usaste Paso de Sombra).',
        energyCost: 0,
        cooldown: 0,
        range: 1,
        targetType: 'enemy',
      },
      skill1: {
        id: 'skill1',
        name: 'Paso de Sombra',
        description: 'Teletranspórtate hasta 4 casillas. Tu próximo ataque hace +3 de daño.',
        energyCost: 2,
        cooldown: 2,
        range: 4,
        targetType: 'empty',
      },
      skill2: {
        id: 'skill2',
        name: 'Lluvia de Dagas',
        description: 'Dagas en cruz (rango 3): 4 de daño y aplica Veneno (2 daño/turno).',
        energyCost: 3,
        cooldown: 3,
        range: 3,
        targetType: 'enemy',
        aoeRadius: 1,
        requiresLos: true,
      },
    },
  },
  pyromancer: {
    classId: 'pyromancer',
    name: 'Ignis',
    title: 'Piromante Astral',
    role: 'Mago de Área',
    maxHp: 16,
    move: 3,
    range: 3,
    atk: 4,
    lore: 'Canaliza el fuego del crisol solar para incinerar escuadrones enteros a distancia.',
    accentColor: '#d96926',
    portrait: '/art/hero_pyromancer.webp',
    abilities: {
      basic: {
        id: 'basic',
        name: 'Chispa Ígnea',
        description: 'Disparo de fuego a distancia (rango 3) de 4 de daño.',
        energyCost: 0,
        cooldown: 0,
        range: 3,
        targetType: 'enemy',
        requiresLos: true,
      },
      skill1: {
        id: 'skill1',
        name: 'Bola de Fuego',
        description: 'Explosión 3×3 (rango 4): 5 de daño al centro, 3 alrededor y Quemadura.',
        energyCost: 3,
        cooldown: 2,
        range: 4,
        targetType: 'any_tile',
        aoeRadius: 1,
        requiresLos: true,
      },
      skill2: {
        id: 'skill2',
        name: 'Muro de Brasas',
        description: 'Enciende una línea de 3 casillas con llamas por 2 turnos.',
        energyCost: 2,
        cooldown: 3,
        range: 3,
        targetType: 'any_tile',
        aoeRadius: 1,
      },
    },
  },
  guardian: {
    classId: 'guardian',
    name: 'Sylva',
    title: 'Guardiana del Bosque',
    role: 'Soporte',
    maxHp: 19,
    move: 3,
    range: 3,
    atk: 3,
    lore: 'Tejedora de raíces y luz ancestral. Sana aliados y paraliza a los enemigos.',
    accentColor: '#5b9c38',
    portrait: '/art/hero_guardian.webp',
    abilities: {
      basic: {
        id: 'basic',
        name: 'Flecha Espinal',
        description: 'Disparo de arco (rango 3) que causa 3 de daño.',
        energyCost: 0,
        cooldown: 0,
        range: 3,
        targetType: 'enemy',
        requiresLos: true,
      },
      skill1: {
        id: 'skill1',
        name: 'Luz Ancestral',
        description: 'Cura +6 PV a un aliado o a ti misma (rango 4) y limpia estados.',
        energyCost: 2,
        cooldown: 2,
        range: 4,
        targetType: 'ally',
      },
      skill2: {
        id: 'skill2',
        name: 'Raíces Atrapadoras',
        description: 'Causa 3 de daño (rango 4) e inmoviliza al rival su próximo turno.',
        energyCost: 2,
        cooldown: 3,
        range: 4,
        targetType: 'enemy',
        requiresLos: true,
      },
    },
  },
  berserker: {
    classId: 'berserker',
    name: 'Thorak',
    title: 'Berserker del Trueno',
    role: 'Luchador',
    maxHp: 22,
    move: 3,
    range: 1,
    atk: 5,
    lore: 'Guerrero nórdico bendecido por la tormenta. Salta directo al centro de la batalla.',
    accentColor: '#2d8bd6',
    portrait: '/art/hero_berserker.webp',
    abilities: {
      basic: {
        id: 'basic',
        name: 'Hachazo Trueno',
        description: 'Golpe brutal cuerpo a cuerpo que causa 5 de daño.',
        energyCost: 0,
        cooldown: 0,
        range: 1,
        targetType: 'enemy',
      },
      skill1: {
        id: 'skill1',
        name: 'Salto Sísmico',
        description: 'Salta hasta 3 casillas libres e inflige 3 de daño y empuje alrededor.',
        energyCost: 2,
        cooldown: 2,
        range: 3,
        targetType: 'empty',
        aoeRadius: 1,
      },
      skill2: {
        id: 'skill2',
        name: 'Torbellino Eléctrico',
        description: 'Inflige 5 de daño a todos los enemigos adyacentes y gana +3 Escudo.',
        energyCost: 3,
        cooldown: 3,
        range: 0,
        targetType: 'self',
      },
    },
  },
  chronomancer: {
    classId: 'chronomancer',
    name: 'Valeria',
    title: 'Cronomante Celestial',
    role: 'Control / Maga',
    maxHp: 17,
    move: 3,
    range: 3,
    atk: 3,
    lore: 'Manipula el tiempo estelar para congelar enemigos y acelerar las habilidades aliadas.',
    accentColor: '#3f7de0',
    portrait: '/art/hero_chronomancer.webp',
    abilities: {
      basic: {
        id: 'basic',
        name: 'Destello Estelar',
        description: 'Proyectil astral (rango 3) que causa 3 de daño.',
        energyCost: 0,
        cooldown: 0,
        range: 3,
        targetType: 'enemy',
        requiresLos: true,
      },
      skill1: {
        id: 'skill1',
        name: 'Pulso Temporal',
        description: 'Causa 4 de daño (rango 4), inmoviliza al rival y aumenta sus esperas.',
        energyCost: 2,
        cooldown: 2,
        range: 4,
        targetType: 'enemy',
        requiresLos: true,
      },
      skill2: {
        id: 'skill2',
        name: 'Bendición de Prisa',
        description: 'Otorga +5 Escudo a un aliado (rango 4), reduce sus esperas y da +1 Energía.',
        energyCost: 2,
        cooldown: 3,
        range: 4,
        targetType: 'ally',
      },
    },
  },
};

export interface ArenaDef {
  id: ArenaId;
  name: string;
  subtitle: string;
  backdrop: string;
  accentColor: string;
  layout: string[];
}

export const ARENAS: Record<ArenaId, ArenaDef> = {
  sunlit_arena: {
    id: 'sunlit_arena',
    name: 'Coliseo del Bastión',
    subtitle: 'La arena real bañada por el sol. Equilibrada con fuentes, runas y columnas reales.',
    backdrop: '/art/bastion_sunlit_banner.webp',
    accentColor: '#e09316',
    layout: [
      '.........',
      '..#...#..',
      '.F..R..F.',
      '...#.#...',
      '..R.B.R..',
      '...#.#...',
      '.T..R..T.',
      '..#...#..',
      '.........',
    ],
  },
  sky_citadel: {
    id: 'sky_citadel',
    name: 'Ciudadela de las Nubes',
    subtitle: 'Templo dorado flotante en las alturas con puentes abiertos y duelos rápidos.',
    backdrop: '/art/arena_sky_citadel.webp',
    accentColor: '#3b8de3',
    layout: [
      '.........',
      '.#.....#.',
      '...R.F...',
      '.#..#..#.',
      '..R.B.R..',
      '.#..#..#.',
      '...F.R...',
      '.#.....#.',
      '.........',
    ],
  },
  crucible: {
    id: 'crucible',
    name: 'El Crisol Solar',
    subtitle: 'Arena volcánica forjada en bronce con trampas de pinchos y pilares simétricos.',
    backdrop: '/art/arena_crucible.webp',
    accentColor: '#d96926',
    layout: [
      '.........',
      '..#...#..',
      '.F..R..T.',
      '...#.#...',
      '..R.B.R..',
      '...#.#...',
      '.T..R..F.',
      '..#...#..',
      '.........',
    ],
  },
  twin_ruins: {
    id: 'twin_ruins',
    name: 'Ruinas Esmeralda',
    subtitle: 'Templo antiguo entre la niebla con pasillos estrechos y trampas tácticas.',
    backdrop: '/art/arena_ruins.webp',
    accentColor: '#2eb872',
    layout: [
      '.........',
      '.##...##.',
      '.#..T..#.',
      '...R.F...',
      '..T.B.T..',
      '...F.R...',
      '.#..T..#.',
      '.##...##.',
      '.........',
    ],
  },
  obsidian_maze: {
    id: 'obsidian_maze',
    name: 'Caverna de Zafiro',
    subtitle: 'Laberinto subterráneo ideal para emboscadas y ataques sorpresa.',
    backdrop: '/art/arena_obsidian.webp',
    accentColor: '#3f7de0',
    layout: [
      '.........',
      '...#.#...',
      '.#..R..#.',
      '.#.T.T.#.',
      '..F.B.F..',
      '.#.T.T.#.',
      '.#..R..#.',
      '...#.#...',
      '.........',
    ],
  },
};

export function charToTileType(ch: string): TileType {
  switch (ch) {
    case '#':
      return 'wall';
    case 'R':
      return 'rune';
    case 'F':
      return 'fountain';
    case 'T':
      return 'trap';
    case 'B':
      return 'bastion';
    default:
      return 'floor';
  }
}

export function getHeroUpgradeBonus(level: number) {
  const lv = Math.max(1, Math.min(5, level));
  return {
    hpBonus: (lv >= 2 ? 2 : 0) + (lv >= 4 ? 2 : 0) + (lv >= 5 ? 3 : 0),
    atkBonus: (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0),
    startShield: lv >= 4 ? 2 : 0,
  };
}

export function getHeroUpgradeCost(currentLevel: number): number {
  switch (currentLevel) {
    case 1:
      return 120;
    case 2:
      return 200;
    case 3:
      return 320;
    case 4:
      return 480;
    default:
      return 0;
  }
}

export function getRankInfo(trophies: number) {
  if (trophies >= 800) return { name: 'Leyenda del Bastión', color: '#f59e0b', badge: '👑' };
  if (trophies >= 550) return { name: 'Diamante Real', color: '#38bdf8', badge: '💎' };
  if (trophies >= 380) return { name: 'Platino Solar', color: '#2dd4bf', badge: '🛡️' };
  if (trophies >= 240) return { name: 'Paladín de Oro', color: '#eab308', badge: '⚔️' };
  if (trophies >= 140) return { name: 'Escudero de Plata', color: '#94a3b8', badge: '🥈' };
  return { name: 'Centinela de Bronce', color: '#d97706', badge: '🥉' };
}
