import type { ArenaId, HeroClassId, HeroTemplate, TileType } from './types';

export const HERO_TEMPLATES: Record<HeroClassId, HeroTemplate> = {
  vanguard: {
    classId: 'vanguard',
    name: 'Sir Kael',
    title: 'Vanguardia del Bastión',
    role: 'Tanque / Control',
    maxHp: 24,
    move: 3,
    range: 1,
    atk: 4,
    lore: 'Veterano inquebrantable de la Guardia de Hierro. Rompe líneas enemigas con su escudo.',
    accentColor: '#4a8ec2',
    portrait: '/art/hero_vanguard.webp',
    abilities: {
      basic: {
        id: 'basic',
        name: 'Tajo de Acero',
        description: 'Golpe cuerpo a cuerpo que inflige 4 de daño.',
        energyCost: 0,
        cooldown: 0,
        range: 1,
        targetType: 'enemy',
      },
      skill1: {
        id: 'skill1',
        name: 'Embestida de Escudo',
        description: 'Carga hacia un enemigo a 2 casillas, inflige 5 de daño y lo empuja 1 casilla (+2 daño si choca contra muro o héroe).',
        energyCost: 2,
        cooldown: 2,
        range: 2,
        targetType: 'enemy',
        requiresLos: true,
      },
      skill2: {
        id: 'skill2',
        name: 'Égida Inquebrantable',
        description: 'Otorga +6 de Escudo y postura defensiva (reduce daño y contraataca) durante 1 turno.',
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
    role: 'Asesina / Movilidad',
    maxHp: 17,
    move: 4,
    range: 1,
    atk: 5,
    lore: 'Maestra del sigilo y el veneno. Aparece tras las líneas rivales antes de que puedan reaccionar.',
    accentColor: '#3f9c7a',
    portrait: '/art/hero_rogue.webp',
    abilities: {
      basic: {
        id: 'basic',
        name: 'Hoja Gemela',
        description: 'Ataque rápido cuerpo a cuerpo que inflige 5 de daño (+3 si tiene Paso de Sombra activo).',
        energyCost: 0,
        cooldown: 0,
        range: 1,
        targetType: 'enemy',
      },
      skill1: {
        id: 'skill1',
        name: 'Paso de Sombra',
        description: 'Teletranspórtate hasta 4 casillas a cualquier espacio libre. Tu próximo ataque inflige +3 de daño.',
        energyCost: 2,
        cooldown: 2,
        range: 4,
        targetType: 'empty',
      },
      skill2: {
        id: 'skill2',
        name: 'Lluvia de Dagas',
        description: 'Lanza dagas en cruz (rango 3) infligiendo 4 de daño y aplicando Veneno (2 daño/turno por 2 turnos).',
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
    role: 'Mago / Daño en Área',
    maxHp: 16,
    move: 3,
    range: 3,
    atk: 4,
    lore: 'Canaliza el fuego del crisol antiguo para incinerar escuadrones enteros desde la distancia.',
    accentColor: '#d97736',
    portrait: '/art/hero_pyromancer.webp',
    abilities: {
      basic: {
        id: 'basic',
        name: 'Chispa Ígnea',
        description: 'Proyectil a distancia (rango 3) que inflige 4 de daño.',
        energyCost: 0,
        cooldown: 0,
        range: 3,
        targetType: 'enemy',
        requiresLos: true,
      },
      skill1: {
        id: 'skill1',
        name: 'Bola de Fuego',
        description: 'Explosión 3×3 a distancia (rango 4): 5 de daño en el centro, 3 en los bordes y Quemadura (3 daño/turno).',
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
        description: 'Enciende una casilla y sus 2 adyacentes horizontales/verticales con fuego persistente por 2 turnos.',
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
    role: 'Soporte / Control',
    maxHp: 19,
    move: 3,
    range: 3,
    atk: 3,
    lore: 'Tejedora de raíces y luz ancestral. Sostiene a sus aliados e inmoviliza a los invasores.',
    accentColor: '#7ca952',
    portrait: '/art/hero_guardian.webp',
    abilities: {
      basic: {
        id: 'basic',
        name: 'Flecha Espinal',
        description: 'Disparo de arco a distancia (rango 3) que inflige 3 de daño.',
        energyCost: 0,
        cooldown: 0,
        range: 3,
        targetType: 'enemy',
        requiresLos: true,
      },
      skill1: {
        id: 'skill1',
        name: 'Luz Ancestral',
        description: 'Cura a un aliado (o a ti misma) hasta 4 casillas por 6 PV y limpia Veneno y Quemadura.',
        energyCost: 2,
        cooldown: 2,
        range: 4,
        targetType: 'ally',
      },
      skill2: {
        id: 'skill2',
        name: 'Raíces Atrapadoras',
        description: 'Inflige 3 de daño a un enemigo (rango 4) y lo inmoviliza durante su próximo turno.',
        energyCost: 2,
        cooldown: 3,
        range: 4,
        targetType: 'enemy',
        requiresLos: true,
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
  layout: string[]; // 9 strings of 9 chars
}

// Legend:
// '.' = floor
// '#' = wall
// 'R' = power rune (+1 Energy & +1 Shield on step)
// 'F' = healing fountain (+3 HP at start of turn)
// 'T' = spike trap (3 DMG on step)
// 'B' = bastion core (center control point)

export const ARENAS: Record<ArenaId, ArenaDef> = {
  crucible: {
    id: 'crucible',
    name: 'El Crisol Central',
    subtitle: 'Arena volcánica equilibrada con pilares simétricos, runas de energía y fuentes curativas.',
    backdrop: '/art/arena_crucible.webp',
    accentColor: '#d97736',
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
    name: 'Ruinas Gemelas',
    subtitle: 'Templo ancestral entre la niebla con pasillos estrechos y trampas de pinchos.',
    backdrop: '/art/arena_ruins.webp',
    accentColor: '#4ca674',
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
    name: 'Laberinto de Obsidiana',
    subtitle: 'Caverna de cristal subterránea ideal para emboscadas y flanqueos cerrados.',
    backdrop: '/art/arena_obsidian.webp',
    accentColor: '#5ea5db',
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
