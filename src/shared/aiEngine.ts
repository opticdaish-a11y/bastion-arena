import {
  applyGameAction,
  getAbilityAoeTiles,
  getHeroAt,
  getValidMoves,
  getValidTargets,
  manhattan,
} from './gameEngine';
import { HERO_TEMPLATES } from './heroesAndMaps';
import type {
  AbilitySlot,
  AIDifficulty,
  GameAction,
  GameState,
  HeroInstance,
  PlayerId,
} from './types';

function evaluateState(state: GameState, aiPlayer: PlayerId): number {
  const enemyPlayer: PlayerId = aiPlayer === 1 ? 2 : 1;

  if (state.winner === aiPlayer) return 100000;
  if (state.winner === enemyPlayer) return -100000;

  let score = 0;
  score += (state.bastionPoints[aiPlayer] - state.bastionPoints[enemyPlayer]) * 45;
  score += (state.energy[aiPlayer] - state.energy[enemyPlayer]) * 4;

  const aiHeroes = state.heroes.filter((h) => h.owner === aiPlayer && h.alive);
  const enemyHeroes = state.heroes.filter((h) => h.owner === enemyPlayer && h.alive);

  score += (aiHeroes.length - enemyHeroes.length) * 120;

  const center = { x: 4, y: 4 };

  for (const h of aiHeroes) {
    score += h.hp * 6 + h.shield * 3;
    score -= (h.cooldowns.skill1 + h.cooldowns.skill2) * 1.5;
    const distCenter = manhattan(h.pos, center);
    score += Math.max(0, 6 - distCenter) * 4;
    if (distCenter === 0) score += 28; // Holding the Bastion core

    const tile = state.grid[h.pos.y][h.pos.x];
    if (tile.type === 'fountain' && h.hp < h.maxHp) score += 12;
    if (tile.type === 'fire') score -= 12;
    if (h.statuses.poison > 0) score -= 6;
    if (h.statuses.burn > 0) score -= 8;
    if (h.statuses.backstab) score += 8;

    // Proximity to nearest enemy for melee vs ranged
    if (enemyHeroes.length > 0) {
      const minEnemyDist = Math.min(...enemyHeroes.map((e) => manhattan(h.pos, e.pos)));
      if (h.range === 1) {
        score += Math.max(0, 7 - minEnemyDist) * 3;
      } else {
        // Ranged heroes prefer distance 2-3
        score += minEnemyDist >= 2 && minEnemyDist <= 4 ? 8 : 0;
      }
    }
  }

  for (const e of enemyHeroes) {
    score -= e.hp * 6 + e.shield * 3;
    score += (e.cooldowns.skill1 + e.cooldowns.skill2) * 2;
    if (manhattan(e.pos, center) === 0) score -= 32;
    if (e.statuses.poison > 0) score += 7;
    if (e.statuses.burn > 0) score += 9;
    if (e.statuses.rooted > 0) score += 12;
  }

  return score;
}

function getCandidateActionsForHero(state: GameState, hero: HeroInstance): GameAction[] {
  const actions: GameAction[] = [];

  if (!hero.hasMoved) {
    const moves = getValidMoves(state, hero.id);
    for (const to of moves) {
      actions.push({ type: 'MOVE', player: hero.owner, heroId: hero.id, to });
    }
  }

  if (!hero.hasActed) {
    const slots: AbilitySlot[] = ['skill1', 'skill2', 'basic'];
    for (const slot of slots) {
      const ab = HERO_TEMPLATES[hero.classId].abilities[slot];
      const targets = getValidTargets(state, hero.id, slot);
      for (const target of targets) {
        // Prune clearly unproductive AoE/whirlwind targets for faster, smarter AI
        if (ab.targetType === 'any_tile') {
          const aoe = getAbilityAoeTiles(state, hero, slot, target);
          const hitsUseful = aoe.some((c) => {
            const occ = getHeroAt(state, c);
            return (occ && occ.owner !== hero.owner) || (c.x === 4 && c.y === 4);
          });
          if (!hitsUseful) continue;
        }
        if (hero.classId === 'berserker' && slot === 'skill2') {
          const hasAdjacentEnemy = state.heroes.some(
            (e) =>
              e.alive &&
              e.owner !== hero.owner &&
              Math.max(Math.abs(e.pos.x - hero.pos.x), Math.abs(e.pos.y - hero.pos.y)) <= 1
          );
          if (!hasAdjacentEnemy) continue;
        }
        actions.push({
          type: 'USE_ABILITY',
          player: hero.owner,
          heroId: hero.id,
          slot,
          target,
        });
      }
    }
    if (hero.hasMoved || actions.length === 0) {
      actions.push({ type: 'FORTIFY', player: hero.owner, heroId: hero.id });
    }
  }

  return actions;
}

export function chooseNextAIAction(
  state: GameState,
  aiPlayer: PlayerId,
  difficulty: AIDifficulty
): GameAction {
  if (state.winner || state.activePlayer !== aiPlayer) {
    return { type: 'END_TURN', player: aiPlayer };
  }

  const myHeroes = state.heroes.filter(
    (h) => h.owner === aiPlayer && h.alive && (!h.hasMoved || !h.hasActed)
  );

  if (myHeroes.length === 0) {
    return { type: 'END_TURN', player: aiPlayer };
  }

  const allCandidates: Array<{ action: GameAction; score: number }> = [];

  for (const hero of myHeroes) {
    const candidates = getCandidateActionsForHero(state, hero);
    for (const action of candidates) {
      const { state: nextState } = applyGameAction(state, action);
      let score = evaluateState(nextState, aiPlayer);

      // Lookahead 1 step for the same hero (e.g., Move -> Attack!) on tactician/grandmaster
      if (difficulty !== 'apprentice' && action.type === 'MOVE') {
        const movedHero = nextState.heroes.find((h) => h.id === hero.id);
        if (movedHero && movedHero.alive && !movedHero.hasActed) {
          const followUps = getCandidateActionsForHero(nextState, movedHero);
          let bestFollow = score;
          for (const fu of followUps) {
            const { state: fuState } = applyGameAction(nextState, fu);
            const fuScore = evaluateState(fuState, aiPlayer);
            if (fuScore > bestFollow) bestFollow = fuScore;
          }
          score = bestFollow;
        }
      }

      // Slight preference to attack before fortifying if equal
      if (action.type === 'FORTIFY') score -= 2;

      if (difficulty === 'apprentice') {
        score += (Math.random() - 0.5) * 35;
      } else if (difficulty === 'tactician') {
        score += (Math.random() - 0.5) * 6;
      }

      allCandidates.push({ action, score });
    }
  }

  if (allCandidates.length === 0) {
    return { type: 'END_TURN', player: aiPlayer };
  }

  allCandidates.sort((a, b) => b.score - a.score);
  return allCandidates[0].action;
}
