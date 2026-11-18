import { LogOut, Shield, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type ChatMsg, type FloatingFx, GameBoard } from './components/GameBoard';
import { Lobby } from './components/Lobby';
import { chooseNextAIAction } from './shared/aiEngine';
import { applyGameAction, createInitialGameState } from './shared/gameEngine';
import type {
  AIDifficulty,
  ArenaId,
  GameAction,
  GameEvent,
  GameMode,
  GameState,
  HeroClassId,
  PlayerId,
} from './shared/types';
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
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [mode, setMode] = useState<GameMode>('ai');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('tactician');
  const [lastConfig, setLastConfig] = useState<MatchConfig | null>(null);
  const [muted, setMuted] = useState(false);

  // Floating combat effects
  const [floatingFx, setFloatingFx] = useState<FloatingFx[]>([]);

  // Online state
  const wsRef = useRef<WebSocket | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<PlayerId | null>(1);
  const [waitingRoomCode, setWaitingRoomCode] = useState<string | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);

  const triggerEvents = useCallback((events: GameEvent[]) => {
    const newFx: FloatingFx[] = [];
    for (const ev of events) {
      if (ev.sound) sound.play(ev.sound);
      if (ev.coord && ev.label) {
        const color =
          ev.type === 'damage' || ev.type === 'trap'
            ? '#f07171'
            : ev.type === 'heal'
            ? '#6ee7b7'
            : ev.type === 'shield'
            ? '#7dd3fc'
            : '#f5c76b';
        newFx.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          coord: ev.coord,
          label: ev.label,
          color,
        });
      }
    }
    if (newFx.length > 0) {
      setFloatingFx((prev) => [...prev, ...newFx]);
      setTimeout(() => {
        const ids = new Set(newFx.map((f) => f.id));
        setFloatingFx((prev) => prev.filter((f) => !ids.has(f.id)));
      }, 1200);
    }
  }, []);

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

  // Local / AI Start
  const handleStartLocalOrAI = (opts: MatchConfig) => {
    closeSocket();
    setMode(opts.mode);
    setDifficulty(opts.difficulty);
    setLastConfig(opts);
    setMyPlayerId(opts.mode === 'ai' ? 1 : null);
    setChatMessages([]);
    setGameState(
      createInitialGameState({
        arenaId: opts.arenaId,
        p1Team: opts.p1Team,
        p2Team: opts.p2Team,
        playerNames: { 1: opts.p1Name, 2: opts.p2Name },
      })
    );
  };

  // Online Create / Join
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

  // Dispatch Game Action
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

  // AI Turn Loop
  useEffect(() => {
    if (mode !== 'ai' || !gameState || gameState.winner || gameState.activePlayer !== 2) {
      return;
    }

    const timer = setTimeout(() => {
      const aiAction = chooseNextAIAction(gameState, 2, difficulty);
      handleAction(aiAction);
    }, 480);

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

  const handleToggleMute = () => {
    sound.muted = !muted;
    setMuted(!muted);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-crest">
            <Shield size={20} />
          </div>
          <div>
            <div className="brand-title">BASTIÓN</div>
            <div className="brand-sub">Arena Táctica de Héroes</div>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            id="toggle-sound-btn"
            className="btn btn-ghost"
            onClick={handleToggleMute}
            title={muted ? 'Activar sonido' : 'Silenciar'}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {gameState && (
            <button
              id="exit-match-btn"
              className="btn btn-secondary"
              style={{ padding: '7px 12px', fontSize: '0.82rem' }}
              onClick={handleExitToLobby}
            >
              <LogOut size={15} />
              Lobby
            </button>
          )}
        </div>
      </header>

      {!gameState ? (
        <Lobby
          onStartLocalOrAI={handleStartLocalOrAI}
          onCreateOnlineRoom={handleCreateOnlineRoom}
          onJoinOnlineRoom={handleJoinOnlineRoom}
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
          onAction={handleAction}
          onSendChat={(text) => {
            wsRef.current?.send(JSON.stringify({ type: 'CHAT', text }));
          }}
          onRematch={handleRematch}
          onExitToLobby={handleExitToLobby}
        />
      )}
    </div>
  );
}

export default App;
