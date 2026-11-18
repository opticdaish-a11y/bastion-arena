import { getRankInfo } from '../shared/heroesAndMaps';
import type { HeroClassId, LeaderboardEntry } from '../shared/types';

export interface PlayerProfile {
  name: string;
  trophies: number;
  gold: number;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  heroLevels: Record<HeroClassId, number>;
  selectedTeam: HeroClassId[];
}

const STORAGE_KEY = 'bastion_player_profile_v2';

export function getDefaultProfile(): PlayerProfile {
  return {
    name: 'Comandante',
    trophies: 100,
    gold: 300,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    heroLevels: {
      vanguard: 1,
      rogue: 1,
      pyromancer: 1,
      guardian: 1,
      berserker: 1,
      chronomancer: 1,
    },
    selectedTeam: ['vanguard', 'pyromancer'],
  };
}

export function loadProfile(): PlayerProfile {
  if (typeof window === 'undefined') return getDefaultProfile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultProfile();
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const def = getDefaultProfile();
    return {
      ...def,
      ...parsed,
      heroLevels: { ...def.heroLevels, ...(parsed.heroLevels || {}) },
      selectedTeam:
        Array.isArray(parsed.selectedTeam) && parsed.selectedTeam.length > 0
          ? parsed.selectedTeam
          : def.selectedTeam,
    };
  } catch {
    return getDefaultProfile();
  }
}

export function saveProfile(profile: PlayerProfile) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage quota errors
  }
}

export async function reportMatchToLeaderboard(
  profile: PlayerProfile,
  won: boolean,
  trophyDelta: number
): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch('/api/leaderboard/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: profile.name,
        trophies: profile.trophies,
        wins: profile.wins,
        losses: profile.losses,
        streak: profile.streak,
        won,
        trophyDelta,
        rankName: getRankInfo(profile.trophies).name,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.leaderboard || [];
    }
  } catch {
    // ignore network errors
  }
  return [];
}
