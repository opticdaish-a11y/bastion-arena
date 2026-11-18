import {
  Bot,
  Check,
  Copy,
  Globe,
  Map as MapIcon,
  Play,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ARENAS, HERO_TEMPLATES } from '../shared/heroesAndMaps';
import type {
  AIDifficulty,
  ArenaId,
  GameMode,
  HeroClassId,
  RoomSummary,
} from '../shared/types';
import { sound } from '../utils/sound';
import { HeroIcon } from './HeroAvatar';

interface LobbyProps {
  onStartLocalOrAI: (opts: {
    mode: 'ai' | 'local';
    arenaId: ArenaId;
    p1Team: HeroClassId[];
    p2Team: HeroClassId[];
    difficulty: AIDifficulty;
    p1Name: string;
    p2Name: string;
  }) => void;
  onCreateOnlineRoom: (opts: {
    playerName: string;
    arenaId: ArenaId;
    team: HeroClassId[];
  }) => void;
  onJoinOnlineRoom: (opts: {
    code: string;
    playerName: string;
    team: HeroClassId[];
  }) => void;
  waitingRoomCode: string | null;
  onlineError: string | null;
  onCancelWaiting: () => void;
}

const ALL_HEROES: HeroClassId[] = ['vanguard', 'rogue', 'pyromancer', 'guardian'];

export function Lobby({
  onStartLocalOrAI,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
  waitingRoomCode,
  onlineError,
  onCancelWaiting,
}: LobbyProps) {
  const [mode, setMode] = useState<GameMode>('ai');
  const [arenaId, setArenaId] = useState<ArenaId>('crucible');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('tactician');
  const [teamSize, setTeamSize] = useState<1 | 2>(2);

  const [p1Team, setP1Team] = useState<HeroClassId[]>(['vanguard', 'pyromancer']);
  const [p2Team, setP2Team] = useState<HeroClassId[]>(['rogue', 'guardian']);
  const [p1Name, setP1Name] = useState('Comandante');
  const [p2Name, setP2Name] = useState('Rival');

  const [joinCode, setJoinCode] = useState('');
  const [publicRooms, setPublicRooms] = useState<RoomSummary[]>([]);
  const [copied, setCopied] = useState(false);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setPublicRooms(data.rooms || []);
      }
    } catch {
      // Ignore when offline
    }
  };

  useEffect(() => {
    if (mode === 'online') {
      fetchRooms();
    }
  }, [mode]);

  const toggleHero = (
    classId: HeroClassId,
    team: HeroClassId[],
    setTeam: (t: HeroClassId[]) => void
  ) => {
    sound.play('click');
    if (teamSize === 1) {
      setTeam([classId]);
      return;
    }
    if (team.includes(classId)) {
      if (team.length > 1) {
        setTeam(team.filter((c) => c !== classId));
      }
    } else if (team.length < 2) {
      setTeam([...team, classId]);
    } else {
      setTeam([team[1], classId]);
    }
  };

  const activeP1Team = p1Team.slice(0, teamSize);
  const activeP2Team = p2Team.slice(0, teamSize);

  const handleCopyCode = () => {
    if (!waitingRoomCode) return;
    navigator.clipboard?.writeText(waitingRoomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="lobby-container">
      <section className="hero-banner">
        <h1>BASTIÓN: ARENA DE HÉROES</h1>
        <p>
          Combate táctico por turnos en tablero 9×9. Domina el Núcleo del Bastión o
          derrota al escuadrón rival usando posicionamiento, terreno y habilidades.
        </p>
      </section>

      <section className="mode-tabs" aria-label="Modos de juego">
        <button
          id="mode-ai-btn"
          className={`mode-card ${mode === 'ai' ? 'active' : ''}`}
          onClick={() => {
            sound.play('click');
            setMode('ai');
          }}
        >
          <div className="mode-icon">
            <Bot size={20} />
          </div>
          <div>
            <h3>Contra IA</h3>
            <p>Desafía a la inteligencia táctica en 3 niveles de dificultad.</p>
          </div>
        </button>

        <button
          id="mode-local-btn"
          className={`mode-card ${mode === 'local' ? 'active' : ''}`}
          onClick={() => {
            sound.play('click');
            setMode('local');
          }}
        >
          <div className="mode-icon">
            <Users size={20} />
          </div>
          <div>
            <h3>Local (2 Jugadores)</h3>
            <p>Duelo táctico por turnos en la misma pantalla (Pass &amp; Play).</p>
          </div>
        </button>

        <button
          id="mode-online-btn"
          className={`mode-card ${mode === 'online' ? 'active' : ''}`}
          onClick={() => {
            sound.play('click');
            setMode('online');
          }}
        >
          <div className="mode-icon">
            <Globe size={20} />
          </div>
          <div>
            <h3>Multijugador Online</h3>
            <p>Crea una sala con código o únete en tiempo real por WebSockets.</p>
          </div>
        </button>
      </section>

      <section className="setup-grid">
        {/* Left: Team Draft */}
        <div className="panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <h2 className="panel-title" style={{ marginBottom: 0 }}>
              Escuadrón ({teamSize === 2 ? '2v2 Táctico' : '1v1 Duelo'})
            </h2>
            {mode !== 'online' && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  id="size-1v1-btn"
                  className={`btn ${teamSize === 1 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                  onClick={() => setTeamSize(1)}
                >
                  1v1
                </button>
                <button
                  id="size-2v2-btn"
                  className={`btn ${teamSize === 2 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                  onClick={() => setTeamSize(2)}
                >
                  2v2
                </button>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label
                htmlFor="p1-name-input"
                style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '4px' }}
              >
                {mode === 'online' ? 'Tu Nombre' : 'Jugador 1 (Azul)'}
              </label>
              <input
                id="p1-name-input"
                value={p1Name}
                onChange={(e) => setP1Name(e.target.value)}
                maxLength={18}
                style={{ width: '100%' }}
              />
            </div>

            {mode === 'local' && (
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label
                  htmlFor="p2-name-input"
                  style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '4px' }}
                >
                  Jugador 2 (Carmesí)
                </label>
                <input
                  id="p2-name-input"
                  value={p2Name}
                  onChange={(e) => setP2Name(e.target.value)}
                  maxLength={18}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>

          <div className="hero-roster">
            {ALL_HEROES.map((cid) => {
              const tpl = HERO_TEMPLATES[cid];
              const isSelected = activeP1Team.includes(cid);
              return (
                <button
                  key={cid}
                  id={`pick-hero-${cid}`}
                  className={`hero-select-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleHero(cid, p1Team, setP1Team)}
                >
                  <div className="hero-select-header">
                    <span className="hero-select-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: tpl.accentColor }}>
                        <HeroIcon classId={cid} size={17} />
                      </span>
                      {tpl.name}
                    </span>
                    <span className="hero-role-tag">{tpl.role}</span>
                  </div>
                  <div className="hero-stats-mini">
                    <span>PV {tpl.maxHp}</span>
                    <span>ATQ {tpl.atk}</span>
                    <span>MOV {tpl.move}</span>
                    <span>RNG {tpl.range}</span>
                  </div>
                  <p className="hero-lore">{tpl.lore}</p>
                </button>
              );
            })}
          </div>

          {mode === 'local' && (
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Equipo de {p2Name || 'Jugador 2'} (Carmesí):
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {ALL_HEROES.map((cid) => {
                  const tpl = HERO_TEMPLATES[cid];
                  const sel = activeP2Team.includes(cid);
                  return (
                    <button
                      key={cid}
                      className={`btn ${sel ? 'btn-danger' : 'btn-secondary'}`}
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      onClick={() => toggleHero(cid, p2Team, setP2Team)}
                    >
                      <HeroIcon classId={cid} size={15} />
                      {tpl.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Arena + Launch / Online */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="panel">
            <h2 className="panel-title">
              <MapIcon size={18} />
              Arena de Combate
            </h2>
            <div className="arena-list">
              {(Object.keys(ARENAS) as ArenaId[]).map((aid) => {
                const a = ARENAS[aid];
                return (
                  <button
                    key={aid}
                    id={`arena-${aid}`}
                    className={`arena-option ${arenaId === aid ? 'selected' : ''}`}
                    onClick={() => {
                      sound.play('click');
                      setArenaId(aid);
                    }}
                  >
                    <h4>{a.name}</h4>
                    <p>{a.subtitle}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {mode === 'ai' && (
            <div className="panel">
              <h2 className="panel-title">Dificultad de la IA</h2>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {(
                  [
                    ['apprentice', 'Aprendiz'],
                    ['tactician', 'Táctico'],
                    ['grandmaster', 'Gran Maestro'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    id={`diff-${key}`}
                    className={`btn ${difficulty === key ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px 10px', fontSize: '0.82rem' }}
                    onClick={() => setDifficulty(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                id="start-ai-match-btn"
                className="btn btn-primary"
                style={{ width: '100%', padding: '13px' }}
                onClick={() => {
                  sound.play('click');
                  // Pick balanced AI team different from player when possible
                  const aiPool = ALL_HEROES.filter((c) => !activeP1Team.includes(c));
                  const aiTeam =
                    aiPool.length >= teamSize
                      ? aiPool.slice(0, teamSize)
                      : ALL_HEROES.slice(0, teamSize);
                  onStartLocalOrAI({
                    mode: 'ai',
                    arenaId,
                    p1Team: activeP1Team,
                    p2Team: aiTeam,
                    difficulty,
                    p1Name: p1Name.trim() || 'Comandante',
                    p2Name: `IA (${difficulty === 'apprentice' ? 'Aprendiz' : difficulty === 'tactician' ? 'Táctico' : 'Gran Maestro'})`,
                  });
                }}
              >
                <Play size={18} />
                Iniciar Batalla contra IA
              </button>
            </div>
          )}

          {mode === 'local' && (
            <div className="panel">
              <button
                id="start-local-match-btn"
                className="btn btn-primary"
                style={{ width: '100%', padding: '13px' }}
                onClick={() => {
                  sound.play('click');
                  onStartLocalOrAI({
                    mode: 'local',
                    arenaId,
                    p1Team: activeP1Team,
                    p2Team: activeP2Team,
                    difficulty,
                    p1Name: p1Name.trim() || 'Jugador 1',
                    p2Name: p2Name.trim() || 'Jugador 2',
                  });
                }}
              >
                <Play size={18} />
                Iniciar Duelo Local
              </button>
            </div>
          )}

          {mode === 'online' && (
            <div className="panel">
              <h2 className="panel-title">
                <Globe size={18} />
                Salas Online
              </h2>

              {onlineError && (
                <div
                  style={{
                    background: 'rgba(200, 75, 75, 0.16)',
                    border: '1px solid rgba(200, 75, 75, 0.45)',
                    color: '#f29b9b',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    marginBottom: '12px',
                  }}
                >
                  {onlineError}
                </div>
              )}

              {waitingRoomCode ? (
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-brass)',
                    borderRadius: '10px',
                    padding: '16px',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Comparte este código con tu rival:
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      marginBottom: '12px',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1.8rem',
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                        color: 'var(--accent-gold)',
                      }}
                    >
                      {waitingRoomCode}
                    </span>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px' }}
                      onClick={handleCopyCode}
                      title="Copiar código"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Esperando a que se una un oponente...
                  </p>
                  <button className="btn btn-danger" onClick={onCancelWaiting}>
                    Cancelar Sala
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button
                    id="create-room-btn"
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px' }}
                    onClick={() => {
                      sound.play('click');
                      onCreateOnlineRoom({
                        playerName: p1Name.trim() || 'Anfitrión',
                        arenaId,
                        team: p1Team.slice(0, 2),
                      });
                    }}
                  >
                    Crear Nueva Sala
                  </button>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      id="join-code-input"
                      placeholder="Código (ej. B7K2)"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      style={{
                        flex: 1,
                        fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    />
                    <button
                      id="join-room-btn"
                      className="btn btn-secondary"
                      disabled={!joinCode.trim()}
                      onClick={() => {
                        sound.play('click');
                        onJoinOnlineRoom({
                          code: joinCode.trim(),
                          playerName: p1Name.trim() || 'Retador',
                          team: p1Team.slice(0, 2),
                        });
                      }}
                    >
                      Unirse
                    </button>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px',
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Salas públicas abiertas ({publicRooms.length})
                      </span>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                        onClick={fetchRooms}
                      >
                        <RefreshCw size={13} /> Actualizar
                      </button>
                    </div>
                    {publicRooms.length === 0 ? (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        No hay salas abiertas ahora. ¡Crea una!
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {publicRooms.map((r) => (
                          <div
                            key={r.code}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: 'var(--bg-elevated)',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <div style={{ fontSize: '0.82rem' }}>
                              <strong>{r.hostName}</strong> ·{' '}
                              <span style={{ color: 'var(--text-muted)' }}>{ARENAS[r.arenaId]?.name}</span>
                            </div>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                              onClick={() =>
                                onJoinOnlineRoom({
                                  code: r.code,
                                  playerName: p1Name.trim() || 'Retador',
                                  team: p1Team.slice(0, 2),
                                })
                              }
                            >
                              Unirse ({r.code})
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
