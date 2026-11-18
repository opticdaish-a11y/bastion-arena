import { BookOpen, Coins, LogOut, Music, Trophy, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type ChatMsg, type FloatingFx, GameBoard, type MatchReward } from './components/GameBoard';
import { HowToPlayModal } from './components/HowToPlayModal';
import { Lobby } from './components/Lobby';
import { chooseNextAIAction } from './shared/aiEngine';
import { applyGameAction, createInitialGameState } from './shared/gameEngine';
import { getHeroUpgradeCost } from './shared/heroesAndMaps';
import type {
  AIDifficulty,
  ArenaId,
  GameAction,
  GameEvent,
  GameMode,
  GameState,
  HeroClassId,
  LeaderboardEntry,
  PlayerId,
} from './shared/types';
import {
  loadProfile,
  type PlayerProfile,
  reportMatchToLeaderboard,
  saveProfile,
} from './utils/profile';
import { sound } from './utils/sound';

interface MatchConfig {
  mode: 'ai' | 'local';
  arenaId: ArenaId;
  p1Team: HeroClassId[];
  p2Team: HeroClassId[];
  difficulty: AIDifficulty;
  p1Name: string;
  p2Name: string;
}

export function App() {
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [mode, setMode] = useState<GameMode>('ai');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('tactician');
  const [lastConfig, setLastConfig] = useState<MatchConfig | null>(null);
  const [lastReward, setLastReward] = useState<MatchReward | null>(null);
  const rewardedMatchRef = useRef<boolean>(false);

  const [sfxMuted, setSfxMuted] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [floatingFx, setFloatingFx] = useState<FloatingFx[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<PlayerId | null>(1);
  const [waitingRoomCode, setWaitingRoomCode] = useState<string | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);

  const refreshLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch {
      // ignore offline
    }
  }, []);

  useEffect(() => {
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  const updateProfile = useCallback((updater: (prev: PlayerProfile) => PlayerProfile) => {
    setProfile((prev) => {
      const next = updater(prev);
      saveProfile(next);
      return next;
    });
  }, []);

  const handleToggleTeamHero = (classId: HeroClassId, teamSize: 1 | 2) => {
    sound.play('click');
    updateProfile((prev) => {
      const curr = prev.selectedTeam;
      if (teamSize === 1) return { ...prev, selectedTeam: [classId] };
      if (curr.includes(classId)) {
        if (curr.length > 1) {
          return { ...prev, selectedTeam: curr.filter((c) => c !== classId) };
        }
        return prev;
      }
      if (curr.length < 2) {
        return { ...prev, selectedTeam: [...curr, classId] };
      }
      return { ...prev, selectedTeam: [curr[1], classId] };
    });
  };

  const handleUpgradeHero = (classId: HeroClassId) => {
    const lv = profile.heroLevels[classId] || 1;
    const cost = getHeroUpgradeCost(lv);
    if (lv >= 5 || cost === 0 || profile.gold < cost) return;
    sound.play('levelup');
    updateProfile((prev) => ({
      ...prev,
      gold: prev.gold - cost,
      heroLevels: {
        ...prev.heroLevels,
        [classId]: Math.min(5, (prev.heroLevels[classId] || 1) + 1),
      },
    }));
  };

  const triggerEvents = useCallback((events: GameEvent[]) => {
    const newFx: FloatingFx[] = [];
    for (const ev of events) {
      if (ev.sound) sound.play(ev.sound);
      if (ev.coord) {
        const kind: FloatingFx['kind'] =
          ev.type === 'damage' || ev.type === 'trap'
            ? 'hit'
            : ev.type === 'heal'
            ? 'heal'
            : ev.type === 'shield'
            ? 'shield'
            : ev.type === 'move'
            ? 'move'
            : 'skill';

        const color =
          kind === 'hit'
            ? '#ff7676'
            : kind === 'heal'
            ? '#6ee7b7'
            : kind === 'shield'
            ? '#7dd3fc'
            : '#ffe494';

        newFx.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          coord: ev.coord,
          label: ev.label || '',
          color,
          kind,
        });
      }
    }
    if (newFx.length > 0) {
      setFloatingFx((prev) => [...prev, ...newFx]);
      setTimeout(() => {
        const ids = new Set(newFx.map((f) => f.id));
        setFloatingFx((prev) => prev.filter((f) => !ids.has(f.id)));
      }, 1150);
    }
  }, []);

  // Grant match rewards + update ranking when a match finishes
  useEffect(() => {
    if (!gameState || !gameState.winner || rewardedMatchRef.current) return;
    if (mode === 'local') {
      rewardedMatchRef.current = true;
      setLastReward({ trophyDelta: 0, goldEarned: 35 });
      updateProfile((p) => ({ ...p, gold: p.gold + 35 }));
      return;
    }

    rewardedMatchRef.current = true;
    const myId: PlayerId = mode === 'online' ? myPlayerId || 1 : 1;
    const won = gameState.winner === myId;
    const diffMult = difficulty === 'grandmaster' ? 35 : difficulty === 'tactician' ? 25 : 18;
    const trophyDelta = won ? (mode === 'online' ? 32 : diffMult) : mode === 'online' ? -12 : -8;
    const goldEarned = won ? (mode === 'online' ? 110 : 80) : 25;

    setLastReward({ trophyDelta, goldEarned });

    setProfile((prev) => {
      const nextStreak = won ? prev.streak + 1 : 0;
      const next: PlayerProfile = {
        ...prev,
        trophies: Math.max(0, prev.trophies + trophyDelta),
        gold: prev.gold + goldEarned,
        wins: prev.wins + (won ? 1 : 0),
        losses: prev.losses + (won ? 0 : 1),
        streak: nextStreak,
        bestStreak: Math.max(prev.bestStreak, nextStreak),
      };
      saveProfile(next);
      reportMatchToLeaderboard(next, won, trophyDelta).then((lb) => {
        if (lb.length > 0) setLeaderboard(lb);
      });
      return next;
    });
  }, [gameState, mode, myPlayerId, difficulty, updateProfile]);

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWaitingRoomCode(null);
  }, []);

  const connectWebSocket = useCallback(
    (onOpenSend: (ws: WebSocket) => void) => {
      closeSocket();
      setOnlineError(null);
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        onOpenSend(ws);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'ROOM_CREATED') {
            setWaitingRoomCode(msg.code);
            setMyPlayerId(1);
            setMode('online');
          } else if (msg.type === 'ROOM_JOINED') {
            setWaitingRoomCode(null);
            setMyPlayerId(2);
            setMode('online');
          } else if (msg.type === 'GAME_STATE') {
            setWaitingRoomCode(null);
            if (!msg.state.winner) {
              rewardedMatchRef.current = false;
              setLastReward(null);
            }
            setGameState(msg.state);
            if (Array.isArray(msg.events)) {
              triggerEvents(msg.events);
            }
          } else if (msg.type === 'CHAT_MESSAGE') {
            setChatMessages((prev) => [...prev.slice(-30), msg]);
          } else if (msg.type === 'OPPONENT_STATUS' && !msg.connected) {
            setChatMessages((prev) => [
              ...prev,
              {
                sender: 'Sistema',
                playerId: 1,
                text: 'Tu oponente se ha desconectado.',
                timestamp: Date.now(),
              },
            ]);
          } else if (msg.type === 'ERROR') {
            setOnlineError(msg.message || 'Error de conexión');
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        setOnlineError('No se pudo conectar al servidor multijugador.');
      };
    },
    [closeSocket, triggerEvents]
  );

  const handleStartLocalOrAI = (opts: MatchConfig) => {
    closeSocket();
    rewardedMatchRef.current = false;
    setLastReward(null);
    setMode(opts.mode);
    setDifficulty(opts.difficulty);
    setLastConfig(opts);
    setMyPlayerId(opts.mode === 'ai' ? 1 : null);
    setChatMessages([]);

    const aiLevel =
      opts.difficulty === 'grandmaster' ? 3 : opts.difficulty === 'tactician' ? 2 : 1;
    const p2Levels: Partial<Record<HeroClassId, number>> =
      opts.mode === 'ai'
        ? {
            vanguard: aiLevel,
            rogue: aiLevel,
            pyromancer: aiLevel,
            guardian: aiLevel,
            berserker: aiLevel,
            chronomancer: aiLevel,
          }
        : profile.heroLevels;

    setGameState(
      createInitialGameState({
        arenaId: opts.arenaId,
        p1Team: opts.p1Team,
        p2Team: opts.p2Team,
        playerNames: { 1: opts.p1Name, 2: opts.p2Name },
        p1Levels: profile.heroLevels,
        p2Levels,
      })
    );
  };

  const handleCreateOnlineRoom = (opts: {
    playerName: string;
    arenaId: ArenaId;
    team: HeroClassId[];
  }) => {
    setChatMessages([]);
    connectWebSocket((ws) => {
      ws.send(JSON.stringify({ type: 'CREATE_ROOM', ...opts }));
    });
  };

  const handleJoinOnlineRoom = (opts: {
    code: string;
    playerName: string;
    team: HeroClassId[];
  }) => {
    setChatMessages([]);
    connectWebSocket((ws) => {
      ws.send(JSON.stringify({ type: 'JOIN_ROOM', ...opts }));
    });
  };

  const handleAction = useCallback(
    (action: GameAction) => {
      if (mode === 'online') {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'GAME_ACTION', action }));
        }
        return;
      }

      setGameState((prev) => {
        if (!prev) return prev;
        const res = applyGameAction(prev, action);
        if (res.error) return prev;
        triggerEvents(res.events);
        return res.state;
      });
    },
    [mode, triggerEvents]
  );

  useEffect(() => {
    if (mode !== 'ai' || !gameState || gameState.winner || gameState.activePlayer !== 2) {
      return;
    }
    const timer = setTimeout(() => {
      const aiAction = chooseNextAIAction(gameState, 2, difficulty);
      handleAction(aiAction);
    }, 520);
    return () => clearTimeout(timer);
  }, [mode, gameState, difficulty, handleAction]);

  const handleRematch = () => {
    if (mode === 'online') {
      wsRef.current?.send(JSON.stringify({ type: 'REMATCH' }));
    } else if (lastConfig) {
      handleStartLocalOrAI(lastConfig);
    }
  };

  const handleExitToLobby = () => {
    closeSocket();
    setGameState(null);
    setChatMessages([]);
    setOnlineError(null);
  };

  const handleToggleSfx = () => {
    const next = !sfxMuted;
    sound.sfxMuted = next;
    setSfxMuted(next);
  };

  const handleToggleMusic = () => {
    const next = !musicOn;
    sound.setMusicEnabled(next);
    setMusicOn(next);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img src="/art/icon-192.png" alt="Bastión" className="brand-crest-img" />
          <div>
            <div className="brand-title">BASTIÓN</div>
            <div className="brand-sub">Arena Táctica</div>
          </div>
        </div>

        <div className="topbar-pills">
          <div className={`wallet-pill ${gameState ? 'hide-mobile-in-match' : ''}`} title="Copas de Ranking">
            <Trophy size={14} color="#ffd559" />
            <span>{profile.trophies}</span>
          </div>
          <div className={`wallet-pill ${gameState ? 'hide-mobile-in-match' : ''}`} title="Oro de Mejoras">
            <Coins size={14} color="#ffd559" />
            <span>{profile.gold}</span>
          </div>

          <button
            id="toggle-music-btn"
            className="icon-btn"
            onClick={handleToggleMusic}
            title={musicOn ? 'Pausar música ambiental' : 'Activar música ambiental'}
            style={{ opacity: musicOn ? 1 : 0.5 }}
          >
            <Music size={17} />
          </button>

          <button
            id="toggle-sound-btn"
            className="icon-btn"
            onClick={handleToggleSfx}
            title={sfxMuted ? 'Activar efectos' : 'Silenciar efectos'}
          >
            {sfxMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>

          <button
            id="open-guide-top-btn"
            className={`icon-btn ${!gameState ? 'hide-mobile-lobby' : ''}`}
            onClick={() => {
              sound.play('click');
              setShowGuide(true);
            }}
            title="Cómo jugar"
          >
            <BookOpen size={17} />
          </button>

          {gameState && (
            <button
              id="exit-match-btn"
              className="btn btn-secondary"
              style={{ padding: '6px 11px', fontSize: '0.8rem' }}
              onClick={handleExitToLobby}
            >
              <LogOut size={15} />
              Salir
            </button>
          )}
        </div>
      </header>

      {!gameState ? (
        <Lobby
          profile={profile}
          leaderboard={leaderboard}
          onRefreshLeaderboard={refreshLeaderboard}
          onUpdateProfileName={(name) => updateProfile((p) => ({ ...p, name }))}
          onToggleTeamHero={handleToggleTeamHero}
          onUpgradeHero={handleUpgradeHero}
          onStartLocalOrAI={handleStartLocalOrAI}
          onCreateOnlineRoom={handleCreateOnlineRoom}
          onJoinOnlineRoom={handleJoinOnlineRoom}
          onOpenGuide={() => setShowGuide(true)}
          waitingRoomCode={waitingRoomCode}
          onlineError={onlineError}
          onCancelWaiting={closeSocket}
        />
      ) : (
        <GameBoard
          state={gameState}
          mode={mode}
          myPlayerId={myPlayerId}
          floatingFx={floatingFx}
          chatMessages={chatMessages}
          lastReward={lastReward}
          onAction={handleAction}
          onSendChat={(text) => {
            wsRef.current?.send(JSON.stringify({ type: 'CHAT', text }));
          }}
          onRematch={handleRematch}
          onExitToLobby={handleExitToLobby}
        />
      )}

      {showGuide && <HowToPlayModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}

export default App;
