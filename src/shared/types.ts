export type PlayerId = 1 | 2;

export type HeroClassId = 'vanguard' | 'rogue' | 'pyromancer' | 'guardian';

export type TileType =
  | 'floor'
  | 'wall'
  | 'rune'
  | 'fountain'
  | 'trap'
  | 'bastion'
  | 'fire';

export type ArenaId = 'crucible' | 'twin_ruins' | 'obsidian_maze';

export type GameMode = 'ai' | 'local' | 'online';

export type AIDifficulty = 'apprentice' | 'tactician' | 'grandmaster';

export type AbilitySlot = 'basic' | 'skill1' | 'skill2';

export interface Coord {
  x: number;
  y: number;
}

export interface AbilityDef {
  id: AbilitySlot;
  name: string;
  description: string;
  energyCost: number;
  cooldown: number;
  range: number;
  targetType: 'enemy' | 'ally' | 'empty' | 'self' | 'any_tile';
  aoeRadius?: number; // 1 means 3x3
  requiresLos?: boolean;
}

export interface HeroTemplate {
  classId: HeroClassId;
  name: string;
  title: string;
  role: string;
  maxHp: number;
  move: number;
  range: number;
  atk: number;
  lore: string;
  accentColor: string;
  portrait: string;
  abilities: {
    basic: AbilityDef;
    skill1: AbilityDef;
    skill2: AbilityDef;
  };
}

export interface HeroStatuses {
  poison: number; // turns remaining (2 dmg/turn)
  burn: number; // turns remaining (3 dmg/turn)
  rooted: number; // turns remaining (cannot move)
  backstab: boolean; // next attack deals +3 dmg
  taunt: boolean; // +2 counterattack or damage reduction
}

export interface HeroInstance {
  id: string;
  owner: PlayerId;
  classId: HeroClassId;
  name: string;
  hp: number;
  maxHp: number;
  shield: number;
  atk: number;
  move: number;
  range: number;
  pos: Coord;
  hasMoved: boolean;
  hasActed: boolean;
  cooldowns: {
    skill1: number;
    skill2: number;
  };
  statuses: HeroStatuses;
  alive: boolean;
}

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  baseType: TileType; // underlying tile when temporary fire expires
  fireTurns?: number;
  runeReady?: boolean;
}

export interface CombatLogEntry {
  id: string;
  turn: number;
  player: PlayerId | 0;
  text: string;
  kind: 'move' | 'attack' | 'skill' | 'heal' | 'status' | 'score' | 'system';
}

export interface GameEvent {
  type: 'damage' | 'heal' | 'shield' | 'move' | 'skill' | 'status' | 'trap' | 'score' | 'victory';
  coord?: Coord;
  value?: number;
  label?: string;
  heroId?: string;
  sound?: 'hit' | 'skill' | 'heal' | 'move' | 'shield' | 'fire' | 'trap' | 'victory';
}

export interface GameState {
  boardSize: number;
  arenaId: ArenaId;
  turn: number;
  activePlayer: PlayerId;
  energy: Record<PlayerId, number>;
  maxEnergy: number;
  bastionPoints: Record<PlayerId, number>;
  bastionGoal: number;
  grid: Tile[][];
  heroes: HeroInstance[];
  winner: PlayerId | null;
  winReason: string | null;
  log: CombatLogEntry[];
  playerNames: Record<PlayerId, string>;
}

export type GameAction =
  | { type: 'MOVE'; player: PlayerId; heroId: string; to: Coord }
  | {
      type: 'USE_ABILITY';
      player: PlayerId;
      heroId: string;
      slot: AbilitySlot;
      target: Coord;
    }
  | { type: 'FORTIFY'; player: PlayerId; heroId: string }
  | { type: 'END_TURN'; player: PlayerId };

export interface RoomSummary {
  code: string;
  hostName: string;
  arenaId: ArenaId;
  playersCount: number;
  status: 'waiting' | 'drafting' | 'playing';
}
