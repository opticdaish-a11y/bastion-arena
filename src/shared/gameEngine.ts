import { ARENAS, charToTileType, getHeroUpgradeBonus, HERO_TEMPLATES } from './heroesAndMaps';
import type {
  AbilityDef,
  AbilitySlot,
  ArenaId,
  CombatLogEntry,
  Coord,
  GameAction,
  GameEvent,
  GameState,
  HeroClassId,
  HeroInstance,
  PlayerId,
  Tile,
} from './types';

export const BOARD_SIZE = 9;

export function coordEq(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

export function manhattan(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function inBounds(c: Coord, size = BOARD_SIZE): boolean {
  return c.x >= 0 && c.x < size && c.y >= 0 && c.y < size;
}

export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

export function getHeroAt(state: GameState, c: Coord): HeroInstance | undefined {
  return state.heroes.find((h) => h.alive && h.pos.x === c.x && h.pos.y === c.y);
}

export function hasLineOfSight(grid: Tile[][], from: Coord, to: Coord): boolean {
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (!(x0 === from.x && y0 === from.y) && !(x0 === x1 && y0 === y1)) {
      if (grid[y0][x0].type === 'wall') return false;
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return true;
}

export interface CreateGameOptions {
  arenaId: ArenaId;
  p1Team: HeroClassId[];
  p2Team: HeroClassId[];
  playerNames?: Record<PlayerId, string>;
  p1Levels?: Partial<Record<HeroClassId, number>>;
  p2Levels?: Partial<Record<HeroClassId, number>>;
}

export function createInitialGameState(opts: CreateGameOptions): GameState {
  const arena = ARENAS[opts.arenaId] || ARENAS.sunlit_arena;
  const grid: Tile[][] = arena.layout.map((row, y) =>
    row.split('').map((ch, x) => {
      const t = charToTileType(ch);
      return {
        x,
        y,
        type: t,
        baseType: t,
        runeReady: t === 'rune',
      };
    })
  );

  const p1Spawns: Coord[] = [
    { x: 1, y: 7 },
    { x: 0, y: 5 },
    { x: 2, y: 8 },
  ];
  const p2Spawns: Coord[] = [
    { x: 7, y: 1 },
    { x: 8, y: 3 },
    { x: 6, y: 0 },
  ];

  const makeHero = (
    classId: HeroClassId,
    owner: PlayerId,
    idx: number,
    spawn: Coord,
    level: number
  ): HeroInstance => {
    const tpl = HERO_TEMPLATES[classId];
    const bonus = getHeroUpgradeBonus(level);
    return {
      id: `p${owner}_${classId}_${idx}`,
      owner,
      classId,
      name: tpl.name,
      level,
      hp: tpl.maxHp + bonus.hpBonus,
      maxHp: tpl.maxHp + bonus.hpBonus,
      shield: bonus.startShield,
      atk: tpl.atk + bonus.atkBonus,
      move: tpl.move,
      range: tpl.range,
      pos: { ...spawn },
      hasMoved: false,
      hasActed: false,
      cooldowns: { skill1: 0, skill2: 0 },
      statuses: {
        poison: 0,
        burn: 0,
        rooted: 0,
        backstab: false,
        taunt: false,
      },
      alive: true,
    };
  };

  const heroes: HeroInstance[] = [
    ...opts.p1Team.map((c, i) =>
      makeHero(c, 1, i, p1Spawns[i % p1Spawns.length], opts.p1Levels?.[c] ?? 1)
    ),
    ...opts.p2Team.map((c, i) =>
      makeHero(c, 2, i, p2Spawns[i % p2Spawns.length], opts.p2Levels?.[c] ?? 1)
    ),
  ];

  return {
    boardSize: BOARD_SIZE,
    arenaId: opts.arenaId,
    turn: 1,
    activePlayer: 1,
    energy: { 1: 3, 2: 3 },
    maxEnergy: 6,
    bastionPoints: { 1: 0, 2: 0 },
    bastionGoal: 5,
    grid,
    heroes,
    winner: null,
    winReason: null,
    log: [
      {
        id: 'init',
        turn: 1,
        player: 0,
        text: `¡Comienza la batalla en ${arena.name}! Derrota al rival o alcanza 5 pts en el Núcleo.`,
        kind: 'system',
      },
    ],
    playerNames: opts.playerNames ?? { 1: 'Jugador 1', 2: 'Jugador 2' },
  };
}

export function getValidMoves(state: GameState, heroId: string): Coord[] {
  const hero = state.heroes.find((h) => h.id === heroId);
  if (!hero || !hero.alive || hero.hasMoved || hero.owner !== state.activePlayer) {
    return [];
  }
  if (hero.statuses.rooted > 0) {
    return [];
  }

  const visited = new Set<string>();
  const queue: Array<{ pos: Coord; dist: number }> = [{ pos: hero.pos, dist: 0 }];
  visited.add(`${hero.pos.x},${hero.pos.y}`);
  const result: Coord[] = [];

  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.dist > 0) {
      result.push(curr.pos);
    }
    if (curr.dist >= hero.move) continue;

    for (const d of dirs) {
      const nx = curr.pos.x + d.x;
      const ny = curr.pos.y + d.y;
      const key = `${nx},${ny}`;
      if (!inBounds({ x: nx, y: ny }, state.boardSize) || visited.has(key)) continue;
      if (state.grid[ny][nx].type === 'wall') continue;
      if (getHeroAt(state, { x: nx, y: ny })) continue;
      visited.add(key);
      queue.push({ pos: { x: nx, y: ny }, dist: curr.dist + 1 });
    }
  }

  return result;
}

export function getAbilityDef(hero: HeroInstance, slot: AbilitySlot): AbilityDef {
  return HERO_TEMPLATES[hero.classId].abilities[slot];
}

export function getValidTargets(
  state: GameState,
  heroId: string,
  slot: AbilitySlot
): Coord[] {
  const hero = state.heroes.find((h) => h.id === heroId);
  if (!hero || !hero.alive || hero.hasActed || hero.owner !== state.activePlayer) {
    return [];
  }

  const ability = getAbilityDef(hero, slot);
  if (state.energy[hero.owner] < ability.energyCost) return [];
  if (slot === 'skill1' && hero.cooldowns.skill1 > 0) return [];
  if (slot === 'skill2' && hero.cooldowns.skill2 > 0) return [];

  if (ability.targetType === 'self') {
    return [{ ...hero.pos }];
  }

  const targets: Coord[] = [];
  for (let y = 0; y < state.boardSize; y++) {
    for (let x = 0; x < state.boardSize; x++) {
      const c = { x, y };
      const dist = manhattan(hero.pos, c);
      if (dist === 0 && ability.targetType !== 'ally') continue;
      if (dist > ability.range) continue;

      const tile = state.grid[y][x];
      if (tile.type === 'wall') continue;
      if (ability.requiresLos && !hasLineOfSight(state.grid, hero.pos, c)) continue;

      const occupant = getHeroAt(state, c);
      if (ability.targetType === 'enemy') {
        if (occupant && occupant.owner !== hero.owner) targets.push(c);
      } else if (ability.targetType === 'ally') {
        if (occupant && occupant.owner === hero.owner) targets.push(c);
      } else if (ability.targetType === 'empty') {
        if (!occupant) targets.push(c);
      } else if (ability.targetType === 'any_tile') {
        targets.push(c);
      }
    }
  }
  return targets;
}

export function getAbilityAoeTiles(
  state: GameState,
  hero: HeroInstance,
  slot: AbilitySlot,
  target: Coord
): Coord[] {
  const ability = getAbilityDef(hero, slot);
  if (!ability.aoeRadius) return [target];

  if (hero.classId === 'rogue' && slot === 'skill2') {
    const candidates = [
      target,
      { x: target.x + 1, y: target.y },
      { x: target.x - 1, y: target.y },
      { x: target.x, y: target.y + 1 },
      { x: target.x, y: target.y - 1 },
    ];
    return candidates.filter((c) => inBounds(c, state.boardSize) && state.grid[c.y][c.x].type !== 'wall');
  }

  if (hero.classId === 'pyromancer' && slot === 'skill2') {
    const dx = Math.abs(target.x - hero.pos.x);
    const dy = Math.abs(target.y - hero.pos.y);
    const line =
      dx >= dy
        ? [target, { x: target.x, y: target.y - 1 }, { x: target.x, y: target.y + 1 }]
        : [target, { x: target.x - 1, y: target.y }, { x: target.x + 1, y: target.y }];
    return line.filter((c) => inBounds(c, state.boardSize) && state.grid[c.y][c.x].type !== 'wall');
  }

  // 3x3 ring (Pyromancer Bola de Fuego, Berserker Salto Sísmico)
  const tiles: Coord[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const c = { x: target.x + dx, y: target.y + dy };
      if (inBounds(c, state.boardSize) && state.grid[c.y][c.x].type !== 'wall') {
        tiles.push(c);
      }
    }
  }
  return tiles;
}

function addLog(
  state: GameState,
  player: PlayerId | 0,
  text: string,
  kind: CombatLogEntry['kind']
) {
  state.log.unshift({
    id: `${state.turn}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    turn: state.turn,
    player,
    text,
    kind,
  });
  if (state.log.length > 40) state.log.pop();
}

function dealDamage(
  state: GameState,
  target: HeroInstance,
  rawDmg: number,
  events: GameEvent[],
  sourceName?: string
): number {
  let dmg = rawDmg;
  if (target.statuses.taunt && dmg > 1) {
    dmg = Math.max(1, dmg - 1);
  }
  let remaining = dmg;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
  }
  target.hp = Math.max(0, target.hp - remaining);
  events.push({
    type: 'damage',
    coord: { ...target.pos },
    value: dmg,
    label: `-${dmg}`,
    heroId: target.id,
    sound: 'hit',
  });

  if (target.hp <= 0) {
    target.alive = false;
    addLog(
      state,
      target.owner === 1 ? 2 : 1,
      `¡${target.name} ha caído en combate${sourceName ? ` ante ${sourceName}` : ''}!`,
      'attack'
    );
  }
  return dmg;
}

function checkWinner(state: GameState, events: GameEvent[]) {
  if (state.winner) return;
  const p1Alive = state.heroes.some((h) => h.owner === 1 && h.alive);
  const p2Alive = state.heroes.some((h) => h.owner === 2 && h.alive);

  if (!p1Alive && !p2Alive) {
    state.winner = state.activePlayer;
    state.winReason = 'Aniquilación mutua';
  } else if (!p2Alive) {
    state.winner = 1;
    state.winReason = 'Todos los héroes rivales han sido derrotados';
  } else if (!p1Alive) {
    state.winner = 2;
    state.winReason = 'Todos los héroes rivales han sido derrotados';
  } else if (state.bastionPoints[1] >= state.bastionGoal) {
    state.winner = 1;
    state.winReason = 'Dominio del Núcleo del Bastión (5/5)';
  } else if (state.bastionPoints[2] >= state.bastionGoal) {
    state.winner = 2;
    state.winReason = 'Dominio del Núcleo del Bastión (5/5)';
  }

  if (state.winner) {
    events.push({
      type: 'victory',
      label: `¡Victoria de ${state.playerNames[state.winner]}!`,
      sound: 'victory',
    });
    addLog(
      state,
      state.winner,
      `¡${state.playerNames[state.winner]} gana la partida! (${state.winReason})`,
      'system'
    );
  }
}

export function applyGameAction(
  prevState: GameState,
  action: GameAction
): { state: GameState; events: GameEvent[]; error?: string } {
  if (prevState.winner) {
    return { state: prevState, events: [], error: 'La partida ya terminó' };
  }
  if (action.player !== prevState.activePlayer) {
    return { state: prevState, events: [], error: 'No es tu turno' };
  }

  const state = cloneState(prevState);
  const events: GameEvent[] = [];

  if (action.type === 'MOVE') {
    const valid = getValidMoves(state, action.heroId);
    if (!valid.some((c) => coordEq(c, action.to))) {
      return { state: prevState, events: [], error: 'Movimiento inválido' };
    }
    const hero = state.heroes.find((h) => h.id === action.heroId)!;
    hero.pos = { ...action.to };
    hero.hasMoved = true;
    events.push({ type: 'move', coord: { ...action.to }, heroId: hero.id, sound: 'move' });
    addLog(state, hero.owner, `${hero.name} se mueve a (${action.to.x + 1}, ${action.to.y + 1}).`, 'move');

    const tile = state.grid[action.to.y][action.to.x];
    if (tile.type === 'trap') {
      dealDamage(state, hero, 3, events, 'Trampa de Pinchos');
      events.push({ type: 'trap', coord: { ...action.to }, label: '¡TRAMPA!', sound: 'trap' });
      addLog(state, hero.owner, `¡${hero.name} pisa una trampa de pinchos (-3 PV)!`, 'status');
    } else if (tile.type === 'fire') {
      dealDamage(state, hero, 3, events, 'Fuego');
      hero.statuses.burn = Math.max(hero.statuses.burn, 1);
      addLog(state, hero.owner, `${hero.name} atraviesa llamas (-3 PV).`, 'status');
    } else if (tile.type === 'rune' && tile.runeReady) {
      tile.runeReady = false;
      state.energy[hero.owner] = Math.min(state.maxEnergy, state.energy[hero.owner] + 1);
      hero.shield += 2;
      events.push({
        type: 'shield',
        coord: { ...action.to },
        label: '+1 EN / +2 ESC',
        sound: 'shield',
      });
      addLog(state, hero.owner, `${hero.name} absorbe una Runa (+1 Energía, +2 Escudo).`, 'skill');
    }

    checkWinner(state, events);
    return { state, events };
  }

  if (action.type === 'FORTIFY') {
    const hero = state.heroes.find((h) => h.id === action.heroId);
    if (!hero || !hero.alive || hero.hasActed || hero.owner !== action.player) {
      return { state: prevState, events: [], error: 'No puedes fortificar ahora' };
    }
    hero.hasActed = true;
    hero.shield += 2;
    events.push({
      type: 'shield',
      coord: { ...hero.pos },
      value: 2,
      label: '+2 ESCUDO',
      heroId: hero.id,
      sound: 'shield',
    });
    addLog(state, hero.owner, `${hero.name} se fortifica (+2 Escudo).`, 'skill');
    return { state, events };
  }

  if (action.type === 'USE_ABILITY') {
    const valid = getValidTargets(state, action.heroId, action.slot);
    if (!valid.some((c) => coordEq(c, action.target))) {
      return { state: prevState, events: [], error: 'Objetivo inválido' };
    }
    const hero = state.heroes.find((h) => h.id === action.heroId)!;
    const ability = getAbilityDef(hero, action.slot);

    state.energy[hero.owner] -= ability.energyCost;
    hero.hasActed = true;
    if (action.slot === 'skill1') hero.cooldowns.skill1 = ability.cooldown;
    if (action.slot === 'skill2') hero.cooldowns.skill2 = ability.cooldown;

    const bonusDmg = (hero.statuses.backstab ? 3 : 0) + (hero.atk - HERO_TEMPLATES[hero.classId].atk);

    if (action.slot === 'basic') {
      const target = getHeroAt(state, action.target)!;
      const total = hero.atk + (hero.statuses.backstab ? 3 : 0);
      hero.statuses.backstab = false;
      dealDamage(state, target, total, events, hero.name);
      addLog(
        state,
        hero.owner,
        `${hero.name} usa ${ability.name} contra ${target.name} (${total} daño).`,
        'attack'
      );
      if (target.alive && target.statuses.taunt && manhattan(hero.pos, target.pos) === 1) {
        dealDamage(state, hero, 2, events, `${target.name} (Contraataque)`);
        addLog(state, target.owner, `${target.name} contraataca a ${hero.name} (-2 PV).`, 'attack');
      }
    } else if (hero.classId === 'vanguard' && action.slot === 'skill1') {
      const target = getHeroAt(state, action.target)!;
      const dx = Math.sign(target.pos.x - hero.pos.x);
      const dy = Math.sign(target.pos.y - hero.pos.y);
      const dashPos = { x: target.pos.x - dx, y: target.pos.y - dy };
      if (inBounds(dashPos) && state.grid[dashPos.y][dashPos.x].type !== 'wall' && !getHeroAt(state, dashPos)) {
        hero.pos = dashPos;
      }
      dealDamage(state, target, 5 + bonusDmg, events, hero.name);
      hero.statuses.backstab = false;

      if (target.alive) {
        const pushPos = { x: target.pos.x + dx, y: target.pos.y + dy };
        if (!inBounds(pushPos) || state.grid[pushPos.y][pushPos.x].type === 'wall' || getHeroAt(state, pushPos)) {
          dealDamage(state, target, 2, events, 'Impacto contra muro');
          addLog(state, hero.owner, `${hero.name} embiste a ${target.name} contra un obstáculo (+2 daño extra).`, 'skill');
        } else {
          target.pos = pushPos;
          addLog(state, hero.owner, `${hero.name} embiste y empuja a ${target.name}.`, 'skill');
        }
      }
    } else if (hero.classId === 'vanguard' && action.slot === 'skill2') {
      hero.shield += 6;
      hero.statuses.taunt = true;
      events.push({ type: 'shield', coord: { ...hero.pos }, label: '+6 ESCUDO', sound: 'shield' });
      addLog(state, hero.owner, `${hero.name} activa Égida Real (+6 Escudo).`, 'skill');
    } else if (hero.classId === 'rogue' && action.slot === 'skill1') {
      hero.pos = { ...action.target };
      hero.statuses.backstab = true;
      events.push({ type: 'skill', coord: { ...hero.pos }, label: 'SIGILO +3 ATQ', sound: 'skill' });
      addLog(state, hero.owner, `${hero.name} usa Paso de Sombra (próximo ataque +3 daño).`, 'skill');
    } else if (hero.classId === 'rogue' && action.slot === 'skill2') {
      const aoe = getAbilityAoeTiles(state, hero, 'skill2', action.target);
      hero.statuses.backstab = false;
      for (const c of aoe) {
        const enemy = getHeroAt(state, c);
        if (enemy && enemy.owner !== hero.owner) {
          dealDamage(state, enemy, 4 + bonusDmg, events, hero.name);
          if (enemy.alive) enemy.statuses.poison = 2;
        }
      }
      events.push({ type: 'skill', coord: { ...action.target }, label: 'VENENO', sound: 'skill' });
      addLog(state, hero.owner, `${hero.name} lanza Lluvia de Dagas en cruz (4 daño + Veneno).`, 'skill');
    } else if (hero.classId === 'pyromancer' && action.slot === 'skill1') {
      const aoe = getAbilityAoeTiles(state, hero, 'skill1', action.target);
      hero.statuses.backstab = false;
      for (const c of aoe) {
        const occupant = getHeroAt(state, c);
        if (occupant && occupant.owner !== hero.owner) {
          const isCenter = coordEq(c, action.target);
          dealDamage(state, occupant, (isCenter ? 5 : 3) + bonusDmg, events, hero.name);
          if (occupant.alive) occupant.statuses.burn = 2;
        }
      }
      events.push({ type: 'skill', coord: { ...action.target }, label: '¡EXPLOSIÓN!', sound: 'fire' });
      addLog(state, hero.owner, `${hero.name} lanza Bola de Fuego en (${action.target.x + 1}, ${action.target.y + 1}).`, 'skill');
    } else if (hero.classId === 'pyromancer' && action.slot === 'skill2') {
      const line = getAbilityAoeTiles(state, hero, 'skill2', action.target);
      for (const c of line) {
        const tile = state.grid[c.y][c.x];
        tile.type = 'fire';
        tile.fireTurns = 2;
        const occupant = getHeroAt(state, c);
        if (occupant && occupant.owner !== hero.owner) {
          dealDamage(state, occupant, 3 + bonusDmg, events, hero.name);
          if (occupant.alive) occupant.statuses.burn = 2;
        }
      }
      events.push({ type: 'skill', coord: { ...action.target }, label: 'MURO ÍGNEO', sound: 'fire' });
      addLog(state, hero.owner, `${hero.name} invoca un Muro de Brasas.`, 'skill');
    } else if (hero.classId === 'guardian' && action.slot === 'skill1') {
      const ally = getHeroAt(state, action.target)!;
      const healed = Math.min(6, ally.maxHp - ally.hp);
      ally.hp += healed;
      ally.statuses.poison = 0;
      ally.statuses.burn = 0;
      events.push({ type: 'heal', coord: { ...ally.pos }, value: healed, label: `+${healed} PV`, sound: 'heal' });
      addLog(state, hero.owner, `${hero.name} sana a ${ally.name} (+${healed} PV y purifica estados).`, 'heal');
    } else if (hero.classId === 'guardian' && action.slot === 'skill2') {
      const target = getHeroAt(state, action.target)!;
      hero.statuses.backstab = false;
      dealDamage(state, target, 3 + bonusDmg, events, hero.name);
      if (target.alive) target.statuses.rooted = 1;
      events.push({ type: 'status', coord: { ...target.pos }, label: 'INMOVILIZADO', sound: 'skill' });
      addLog(state, hero.owner, `${hero.name} atrapa a ${target.name} con Raíces (3 daño + Inmovilizado).`, 'skill');
    } else if (hero.classId === 'berserker' && action.slot === 'skill1') {
      // Salto Sísmico: leap to empty tile + 3 dmg & push around landing
      hero.pos = { ...action.target };
      events.push({ type: 'skill', coord: { ...hero.pos }, label: '¡SALTO SÍSMICO!', sound: 'hit' });
      const around = getAbilityAoeTiles(state, hero, 'skill1', action.target);
      for (const c of around) {
        if (coordEq(c, action.target)) continue;
        const enemy = getHeroAt(state, c);
        if (enemy && enemy.owner !== hero.owner) {
          dealDamage(state, enemy, 3 + bonusDmg, events, hero.name);
          if (enemy.alive) {
            const px = enemy.pos.x + Math.sign(enemy.pos.x - hero.pos.x);
            const py = enemy.pos.y + Math.sign(enemy.pos.y - hero.pos.y);
            const push = { x: px, y: py };
            if (inBounds(push) && state.grid[push.y][push.x].type !== 'wall' && !getHeroAt(state, push)) {
              enemy.pos = push;
            }
          }
        }
      }
      addLog(state, hero.owner, `${hero.name} cae con Salto Sísmico sacudiendo el suelo.`, 'skill');
    } else if (hero.classId === 'berserker' && action.slot === 'skill2') {
      // Torbellino Eléctrico: 5 dmg to all adjacent enemies + 3 shield
      hero.shield += 3;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const c = { x: hero.pos.x + dx, y: hero.pos.y + dy };
          if (!inBounds(c)) continue;
          const enemy = getHeroAt(state, c);
          if (enemy && enemy.owner !== hero.owner) {
            dealDamage(state, enemy, 5 + bonusDmg, events, hero.name);
          }
        }
      }
      events.push({ type: 'shield', coord: { ...hero.pos }, label: '⚡ +3 ESC', sound: 'skill' });
      addLog(state, hero.owner, `${hero.name} desata Torbellino Eléctrico alrededor (+3 Escudo).`, 'skill');
    } else if (hero.classId === 'chronomancer' && action.slot === 'skill1') {
      // Pulso Temporal: 4 dmg + root + delay enemy skills by +1 active turn
      const target = getHeroAt(state, action.target)!;
      dealDamage(state, target, 4 + bonusDmg, events, hero.name);
      if (target.alive) {
        target.statuses.rooted = Math.max(target.statuses.rooted, 1);
        target.cooldowns.skill1 += 2;
        target.cooldowns.skill2 += 2;
      }
      events.push({ type: 'status', coord: { ...target.pos }, label: '⏳ Ralentizado', sound: 'skill' });
      addLog(state, hero.owner, `${hero.name} congela el tiempo sobre ${target.name} (4 daño + Inmovilizado).`, 'skill');
    } else if (hero.classId === 'chronomancer' && action.slot === 'skill2') {
      // Bendición de Prisa: +5 shield + reduce cooldowns by 1 + +1 Energy
      const ally = getHeroAt(state, action.target)!;
      ally.shield += 5;
      ally.cooldowns.skill1 = Math.max(0, ally.cooldowns.skill1 - 1);
      ally.cooldowns.skill2 = Math.max(0, ally.cooldowns.skill2 - 1);
      state.energy[hero.owner] = Math.min(state.maxEnergy, state.energy[hero.owner] + 1);
      events.push({ type: 'shield', coord: { ...ally.pos }, label: '+5 ESC / +1 EN', sound: 'heal' });
      addLog(state, hero.owner, `${hero.name} bendice a ${ally.name} (+5 Escudo, +1 Energía).`, 'heal');
    }

    checkWinner(state, events);
    return { state, events };
  }

  if (action.type === 'END_TURN') {
    const endingPlayer = state.activePlayer;
    const center = { x: 4, y: 4 };
    const centerHero = getHeroAt(state, center);
    if (centerHero && centerHero.owner === endingPlayer) {
      state.bastionPoints[endingPlayer] += 1;
      events.push({
        type: 'score',
        coord: center,
        label: `+1 NÚCLEO (${state.bastionPoints[endingPlayer]}/${state.bastionGoal})`,
        sound: 'shield',
      });
      addLog(
        state,
        endingPlayer,
        `${centerHero.name} controla el Núcleo del Bastión (+1 Punto: ${state.bastionPoints[endingPlayer]}/${state.bastionGoal}).`,
        'score'
      );
    }

    // Rooted wears off after finishing the affected hero's turn
    for (const h of state.heroes) {
      if (h.alive && h.owner === endingPlayer && h.statuses.rooted > 0) {
        h.statuses.rooted -= 1;
      }
    }

    checkWinner(state, events);
    if (state.winner) return { state, events };

    const nextPlayer: PlayerId = endingPlayer === 1 ? 2 : 1;
    state.activePlayer = nextPlayer;
    if (nextPlayer === 1) {
      state.turn += 1;
      for (let y = 0; y < state.boardSize; y++) {
        for (let x = 0; x < state.boardSize; x++) {
          const tile = state.grid[y][x];
          if (tile.type === 'fire' && tile.fireTurns !== undefined) {
            tile.fireTurns -= 1;
            if (tile.fireTurns <= 0) {
              tile.type = tile.baseType;
              delete tile.fireTurns;
            }
          }
        }
      }
    }

    state.energy[nextPlayer] = Math.min(state.maxEnergy, state.energy[nextPlayer] + 2);

    for (const h of state.heroes) {
      if (!h.alive || h.owner !== nextPlayer) continue;
      h.hasMoved = false;
      h.hasActed = false;
      h.statuses.taunt = false;
      if (h.cooldowns.skill1 > 0) h.cooldowns.skill1 -= 1;
      if (h.cooldowns.skill2 > 0) h.cooldowns.skill2 -= 1;

      const tile = state.grid[h.pos.y][h.pos.x];
      if (tile.type === 'fountain' && h.hp < h.maxHp) {
        const heal = Math.min(3, h.maxHp - h.hp);
        h.hp += heal;
        events.push({ type: 'heal', coord: { ...h.pos }, label: `+${heal} PV`, sound: 'heal' });
        addLog(state, nextPlayer, `${h.name} recupera +${heal} PV en la Fuente Curativa.`, 'heal');
      }

      if (h.statuses.poison > 0) {
        h.statuses.poison -= 1;
        dealDamage(state, h, 2, events, 'Veneno');
        addLog(state, nextPlayer, `${h.name} sufre 2 de daño por Veneno.`, 'status');
      }
      if (h.alive && h.statuses.burn > 0) {
        h.statuses.burn -= 1;
        dealDamage(state, h, 3, events, 'Quemadura');
        addLog(state, nextPlayer, `${h.name} sufre 3 de daño por Quemadura.`, 'status');
      }
    }

    checkWinner(state, events);
    return { state, events };
  }

  return { state: prevState, events: [], error: 'Acción desconocida' };
}
