import {
  BookOpen,
  Bot,
  Check,
  Copy,
  Globe,
  Map as MapIcon,
  Play,
  RefreshCw,
  Share2,
  Swords,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ARENAS, charToTileType, HERO_TEMPLATES } from '../shared/heroesAndMaps';
import type {
  AIDifficulty,
  ArenaId,
  GameMode,
  HeroClassId,
  RoomSummary,
} from '../shared/types';
import { sound } from '../utils/sound';
import { HeroIcon, HeroPortrait } from './HeroAvatar';

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
  onOpenGuide: () => void;
  waitingRoomCode: string | null;
  onlineError: string | null;
  onCancelWaiting: () => void;
}

const ALL_HEROES: HeroClassId[] = ['vanguard', 'rogue', 'pyromancer', 'guardian'];

const EMBER_POSITIONS = [
  { left: '12%', delay: '0s', dur: '6.5s' },
  { left: '24%', delay: '1.8s', dur: '7.2s' },
  { left: '38%', delay: '0.7s', dur: '5.8s' },
  { left: '52%', delay: '2.5s', dur: '6.9s' },
  { left: '66%', delay: '1.1s', dur: '7.5s' },
  { left: '79%', delay: '3.2s', dur: '6.1s' },
  { left: '91%', delay: '0.4s', dur: '6.7s' },
];

export function Lobby({
  onStartLocalOrAI,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
  onOpenGuide,
  waitingRoomCode,
  onlineError,
  onCancelWaiting,
}: LobbyProps) {
  const initialRoom =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('room')?.toUpperCase().slice(0, 6) || ''
      : '';

  const [mode, setMode] = useState<GameMode>(initialRoom ? 'online' : 'ai');
  const [arenaId, setArenaId] = useState<ArenaId>('crucible');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('tactician');
  const [teamSize, setTeamSize] = useState<1 | 2>(2);

  const [p1Team, setP1Team] = useState<HeroClassId[]>(['vanguard', 'pyromancer']);
  const [p2Team, setP2Team] = useState<HeroClassId[]>(['rogue', 'guardian']);
  const [inspectedHero, setInspectedHero] = useState<HeroClassId>('vanguard');

  const [p1Name, setP1Name] = useState('Comandante');
  const [p2Name, setP2Name] = useState('Rival');

  const [joinCode, setJoinCode] = useState(initialRoom);
  const [publicRooms, setPublicRooms] = useState<RoomSummary[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [sharedGame, setSharedGame] = useState(false);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setPublicRooms(data.rooms || []);
      }
    } catch {
      // Ignore if offline
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
    setInspectedHero(classId);
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

  const handleCopyInvite = () => {
    if (!waitingRoomCode) return;
    const inviteUrl = `${window.location.origin}/?room=${waitingRoomCode}`;
    navigator.clipboard?.writeText(
      `¡Únete a mi partida en BASTIÓN! Código: ${waitingRoomCode}\n${inviteUrl}`
    );
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareGame = async () => {
    sound.play('click');
    const url = window.location.origin;
    const text = '¡Ven a jugar BASTIÓN: Arena de Héroes! Tablero táctico por turnos gratis en navegador y celular.';
    if (navigator.share) {
      try {
        await navigator.share({ title: 'BASTIÓN — Arena de Héroes', text, url });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    navigator.clipboard?.writeText(`${text} ${url}`);
    setSharedGame(true);
    setTimeout(() => setSharedGame(false), 2200);
  };

  const inspectedTpl = HERO_TEMPLATES[inspectedHero];

  return (
    <div className="lobby-wrapper">
      {/* Cinematic Key Art Hero Stage */}
      <section className="lobby-hero-stage">
        <div className="lobby-hero-bg" />
        <div className="lobby-hero-scrim" />
        <div className="embers-layer" aria-hidden="true">
          {EMBER_POSITIONS.map((e, i) => (
            <span
              key={i}
              className="ember-dot"
              style={{ left: e.left, animationDelay: e.delay, animationDuration: e.dur }}
            />
          ))}
        </div>

        <div className="lobby-hero-content">
          <div className="hero-emblem-wrap">
            <img src="/art/icon-192.png" alt="Emblema de Bastión" />
          </div>
          <h1>BASTIÓN</h1>
          <p className="lobby-hero-subtitle">
            Arena Táctica de Héroes. Domina el Núcleo del Bastión o aniquila al escuadrón rival en batallas por turnos.
          </p>
          <div className="hero-quick-actions">
            <button id="open-guide-hero-btn" className="btn btn-secondary" onClick={() => { sound.play('click'); onOpenGuide(); }}>
              <BookOpen size={16} />
              Cómo Jugar
            </button>
            <button id="share-game-btn" className="btn btn-secondary" onClick={handleShareGame}>
              {sharedGame ? <Check size={16} color="#4db87f" /> : <Share2 size={16} />}
              {sharedGame ? '¡Enlace copiado!' : 'Invitar Amigos'}
            </button>
          </div>
        </div>
      </section>

      <main className="lobby-container">
        {/* Game Mode Plaques */}
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
              <Bot size={21} />
            </div>
            <div>
              <h3>Contra la IA</h3>
              <p>Entrena y desafía a la máquina en 3 niveles tácticos.</p>
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
              <Users size={21} />
            </div>
            <div>
              <h3>Duelo Local (2J)</h3>
              <p>Juega por turnos con un amigo en el mismo celular o PC.</p>
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
              <Globe size={21} />
            </div>
            <div>
              <h3>Multijugador Online</h3>
              <p>Crea una sala con código y reta a otros en tiempo real.</p>
            </div>
          </button>
        </section>

        <section className="setup-grid">
          {/* Left: Painted Hero Roster + Skill Inspector */}
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
                <Swords size={18} />
                Elige tu Escuadrón ({teamSize === 2 ? '2 Héroes' : '1 Héroe'})
              </h2>
              {mode !== 'online' && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    id="size-1v1-btn"
                    className={`btn ${teamSize === 1 ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '5px 11px', fontSize: '0.78rem' }}
                    onClick={() => setTeamSize(1)}
                  >
                    1v1
                  </button>
                  <button
                    id="size-2v2-btn"
                    className={`btn ${teamSize === 2 ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '5px 11px', fontSize: '0.78rem' }}
                    onClick={() => setTeamSize(2)}
                  >
                    2v2
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label
                  htmlFor="p1-name-input"
                  style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '4px' }}
                >
                  {mode === 'online' ? 'Tu Nombre de Comandante' : 'Jugador 1 (Azul)'}
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
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label
                    htmlFor="p2-name-input"
                    style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '4px' }}
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
                const pickIndex = activeP1Team.indexOf(cid);
                const isSelected = pickIndex !== -1;
                return (
                  <button
                    key={cid}
                    id={`pick-hero-${cid}`}
                    className={`hero-portrait-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleHero(cid, p1Team, setP1Team)}
                  >
                    <div className="hero-art-box">
                      <HeroPortrait classId={cid} />
                      <div className="hero-art-scrim" />
                      <span className="hero-role-pill">{tpl.role}</span>
                      {isSelected && (
                        <span className="hero-pick-badge">
                          {teamSize === 1 ? 'LISTO' : `HÉROE ${pickIndex + 1}`}
                        </span>
                      )}
                    </div>

                    <div className="hero-card-body">
                      <div className="hero-card-title-row">
                        <span className="hero-card-name">{tpl.name}</span>
                        <span style={{ color: tpl.accentColor }}>
                          <HeroIcon classId={cid} size={15} />
                        </span>
                      </div>

                      <div className="hero-stats-strip">
                        <div className="stat-chip">PV <strong>{tpl.maxHp}</strong></div>
                        <div className="stat-chip">ATQ <strong>{tpl.atk}</strong></div>
                        <div className="stat-chip">MOV <strong>{tpl.move}</strong></div>
                        <div className="stat-chip">RNG <strong>{tpl.range}</strong></div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Skill Inspector for the last tapped hero */}
            <div className="hero-inspect-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                  Habilidades de {inspectedTpl.name} — <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{inspectedTpl.title}</span>
                </span>
              </div>
              <div className="skill-preview-grid">
                {(['basic', 'skill1', 'skill2'] as const).map((slot) => {
                  const ab = inspectedTpl.abilities[slot];
                  return (
                    <div key={slot} className="skill-preview-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', color: '#f2ece1' }}>
                        <span>{ab.name}</span>
                        <span style={{ color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                          {ab.energyCost === 0 ? 'Gratis' : `${ab.energyCost} EN`}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                        {ab.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {mode === 'local' && (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Escuadrón de {p2Name || 'Jugador 2'} (Carmesí):
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

          {/* Right: Arena Selection + Launch / Online */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="panel">
              <h2 className="panel-title">
                <MapIcon size={18} />
                Campo de Batalla
              </h2>
              <div className="arena-list">
                {(Object.keys(ARENAS) as ArenaId[]).map((aid) => {
                  const a = ARENAS[aid];
                  return (
                    <button
                      key={aid}
                      id={`arena-${aid}`}
                      className={`arena-card ${arenaId === aid ? 'selected' : ''}`}
                      onClick={() => {
                        sound.play('click');
                        setArenaId(aid);
                      }}
                    >
                      <div
                        className="arena-card-bg"
                        style={{ backgroundImage: `url('${a.backdrop}')` }}
                      />
                      <div className="arena-card-scrim" />
                      <div className="arena-card-info">
                        <h4>{a.name}</h4>
                        <p>{a.subtitle}</p>
                      </div>
                      <div className="arena-minimap" aria-hidden="true">
                        {a.layout.flatMap((row, ry) =>
                          row.split('').map((ch, rx) => (
                            <span
                              key={`${ry}-${rx}`}
                              className={`mini-cell ${charToTileType(ch)}`}
                            />
                          ))
                        )}
                      </div>
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
                      ['grandmaster', 'Maestro'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      id={`diff-${key}`}
                      className={`btn ${difficulty === key ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '8px 8px', fontSize: '0.8rem' }}
                      onClick={() => {
                        sound.play('click');
                        setDifficulty(key);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  id="start-ai-match-btn"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '0.96rem' }}
                  onClick={() => {
                    sound.play('click');
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
                      p2Name: `IA (${difficulty === 'apprentice' ? 'Aprendiz' : difficulty === 'tactician' ? 'Táctico' : 'Maestro'})`,
                    });
                  }}
                >
                  <Play size={18} fill="currentColor" />
                  ¡Entrar a la Arena!
                </button>
              </div>
            )}

            {mode === 'local' && (
              <div className="panel">
                <button
                  id="start-local-match-btn"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '0.96rem' }}
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
                  <Play size={18} fill="currentColor" />
                  Iniciar Duelo Local
                </button>
              </div>
            )}

            {mode === 'online' && (
              <div className="panel">
                <h2 className="panel-title">
                  <Globe size={18} />
                  Arena Online en Vivo
                </h2>

                {onlineError && (
                  <div
                    style={{
                      background: 'rgba(222, 86, 86, 0.16)',
                      border: '1px solid rgba(222, 86, 86, 0.45)',
                      color: '#ffb0b0',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      marginBottom: '12px',
                    }}
                  >
                    {onlineError}
                  </div>
                )}

                {waitingRoomCode ? (
                  <div
                    style={{
                      background: 'rgba(11, 13, 18, 0.72)',
                      border: '1px solid var(--border-brass)',
                      borderRadius: '12px',
                      padding: '18px',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Envía este código o enlace a tu rival:
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
                          fontSize: '1.9rem',
                          fontWeight: 800,
                          letterSpacing: '0.18em',
                          color: 'var(--accent-gold-bright)',
                        }}
                      >
                        {waitingRoomCode}
                      </span>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '7px 11px' }}
                        onClick={handleCopyInvite}
                        title="Copiar invitación"
                      >
                        {copiedCode ? <Check size={16} color="#4db87f" /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                      Esperando oponente en la arena...
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
                      style={{ width: '100%', padding: '13px' }}
                      onClick={() => {
                        sound.play('click');
                        onCreateOnlineRoom({
                          playerName: p1Name.trim() || 'Anfitrión',
                          arenaId,
                          team: p1Team.slice(0, 2),
                        });
                      }}
                    >
                      Crear Sala y Generar Código
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
                          letterSpacing: '0.12em',
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
                          Salas abiertas ({publicRooms.length})
                        </span>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={fetchRooms}
                        >
                          <RefreshCw size={13} /> Actualizar
                        </button>
                      </div>
                      {publicRooms.length === 0 ? (
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          No hay salas abiertas aún. ¡Crea una y comparte el código!
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
                                background: 'rgba(11, 13, 18, 0.72)',
                                padding: '8px 10px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-iron)',
                              }}
                            >
                              <div style={{ fontSize: '0.8rem' }}>
                                <strong>{r.hostName}</strong> ·{' '}
                                <span style={{ color: 'var(--text-muted)' }}>{ARENAS[r.arenaId]?.name}</span>
                              </div>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '5px 10px', fontSize: '0.76rem' }}
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
    </div>
  );
}
