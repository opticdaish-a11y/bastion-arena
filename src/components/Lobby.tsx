import {
  ArrowUpCircle,
  BookOpen,
  Bot,
  Check,
  Coins,
  Copy,
  Globe,
  Map as MapIcon,
  Play,
  RefreshCw,
  Share2,
  Shield,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  ARENAS,
  charToTileType,
  getHeroUpgradeBonus,
  getHeroUpgradeCost,
  getRankInfo,
  HERO_TEMPLATES,
} from '../shared/heroesAndMaps';
import type {
  AIDifficulty,
  ArenaId,
  GameMode,
  HeroClassId,
  LeaderboardEntry,
  RoomSummary,
} from '../shared/types';
import type { PlayerProfile } from '../utils/profile';
import { sound } from '../utils/sound';
import { HeroIcon, HeroPortrait } from './HeroAvatar';

interface LobbyProps {
  profile: PlayerProfile;
  leaderboard: LeaderboardEntry[];
  onRefreshLeaderboard: () => void;
  onUpdateProfileName: (name: string) => void;
  onToggleTeamHero: (classId: HeroClassId, teamSize: 1 | 2) => void;
  onUpgradeHero: (classId: HeroClassId) => void;
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

type HubTab = 'play' | 'heroes' | 'ranking';

const ALL_HEROES: HeroClassId[] = [
  'vanguard',
  'rogue',
  'pyromancer',
  'guardian',
  'berserker',
  'chronomancer',
];

export function Lobby({
  profile,
  leaderboard,
  onRefreshLeaderboard,
  onUpdateProfileName,
  onToggleTeamHero,
  onUpgradeHero,
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

  const [tab, setTab] = useState<HubTab>('play');
  const [mode, setMode] = useState<GameMode>(initialRoom ? 'online' : 'ai');
  const [arenaId, setArenaId] = useState<ArenaId>('sunlit_arena');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('tactician');
  const [teamSize, setTeamSize] = useState<1 | 2>(2);

  const [p2Team, setP2Team] = useState<HeroClassId[]>(['berserker', 'chronomancer']);
  const [p2Name, setP2Name] = useState('Rival');

  const [joinCode, setJoinCode] = useState(initialRoom);
  const [publicRooms, setPublicRooms] = useState<RoomSummary[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [sharedGame, setSharedGame] = useState(false);

  const rank = getRankInfo(profile.trophies);
  const activeP1Team = profile.selectedTeam.slice(0, teamSize);
  const activeP2Team = p2Team.slice(0, teamSize);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setPublicRooms(data.rooms || []);
      }
    } catch {
      // ignore offline
    }
  };

  useEffect(() => {
    if (mode === 'online' && tab === 'play') {
      fetchRooms();
    }
  }, [mode, tab]);

  useEffect(() => {
    if (tab === 'ranking') {
      onRefreshLeaderboard();
    }
  }, [tab, onRefreshLeaderboard]);

  const toggleP2Hero = (cid: HeroClassId) => {
    sound.play('click');
    if (teamSize === 1) {
      setP2Team([cid]);
      return;
    }
    if (p2Team.includes(cid)) {
      if (p2Team.length > 1) setP2Team(p2Team.filter((c) => c !== cid));
    } else if (p2Team.length < 2) {
      setP2Team([...p2Team, cid]);
    } else {
      setP2Team([p2Team[1], cid]);
    }
  };

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
    const text =
      '¡Juega BASTIÓN: Arena de Héroes! Estrategia por turnos con 6 héroes, ranking y online gratis.';
    if (navigator.share) {
      try {
        await navigator.share({ title: 'BASTIÓN — Arena de Héroes', text, url });
        return;
      } catch {
        // fallback
      }
    }
    navigator.clipboard?.writeText(`${text} ${url}`);
    setSharedGame(true);
    setTimeout(() => setSharedGame(false), 2200);
  };

  return (
    <div className="hub-wrapper">
      {/* Sunlit Flagship Banner */}
      <section className="hub-hero-banner">
        <div className="hub-hero-bg" />
        <div className="hub-hero-scrim" />
        <div className="hub-hero-inner">
          <div>
            <h1>BASTIÓN: ARENA DE HÉROES</h1>
            <p>Elige tu escuadrón, domina el Núcleo y conquista el Ranking.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div className="rank-banner-badge">
              <span style={{ fontSize: '1.3rem' }}>{rank.badge}</span>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.86rem' }}>
                  {rank.name}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--ink-secondary)', fontWeight: 700 }}>
                  🏆 {profile.trophies} Copas · {profile.wins}V / {profile.losses}D
                </div>
              </div>
            </div>
            <button
              id="share-game-btn"
              className="btn btn-secondary"
              style={{ padding: '8px 12px', fontSize: '0.84rem' }}
              onClick={handleShareGame}
            >
              {sharedGame ? <Check size={16} color="#1d9658" /> : <Share2 size={16} />}
              {sharedGame ? '¡Copiado!' : 'Invitar'}
            </button>
          </div>
        </div>
      </section>

      {/* Desktop Navigation Tabs */}
      <nav className="desktop-nav-tabs" aria-label="Navegación principal">
        <button
          className={`nav-tab-btn ${tab === 'play' ? 'active' : ''}`}
          onClick={() => { sound.play('click'); setTab('play'); }}
        >
          <Swords size={18} />
          Batalla
        </button>
        <button
          id="tab-heroes-desktop"
          className={`nav-tab-btn ${tab === 'heroes' ? 'active' : ''}`}
          onClick={() => { sound.play('click'); setTab('heroes'); }}
        >
          <Shield size={18} />
          Héroes y Mejoras (6)
        </button>
        <button
          id="tab-ranking-desktop"
          className={`nav-tab-btn ${tab === 'ranking' ? 'active' : ''}`}
          onClick={() => { sound.play('click'); setTab('ranking'); }}
        >
          <Trophy size={18} />
          Ranking Global
        </button>
        <button
          className="nav-tab-btn"
          onClick={() => { sound.play('click'); onOpenGuide(); }}
        >
          <BookOpen size={18} />
          Cómo Jugar
        </button>
      </nav>

      <main className="hub-content">
        {/* ==================== TAB 1: BATALLA ==================== */}
        {tab === 'play' && (
          <>
            <div className="parchment-panel">
              <div className="mode-pill-grid">
                <button
                  id="mode-ai-btn"
                  className={`mode-pill ${mode === 'ai' ? 'active' : ''}`}
                  onClick={() => { sound.play('click'); setMode('ai'); }}
                >
                  <Bot size={22} color="#1e62b5" />
                  <strong>Contra IA</strong>
                  <span>3 niveles tácticos</span>
                </button>
                <button
                  id="mode-local-btn"
                  className={`mode-pill ${mode === 'local' ? 'active' : ''}`}
                  onClick={() => { sound.play('click'); setMode('local'); }}
                >
                  <Users size={22} color="#1d9658" />
                  <strong>Local 2J</strong>
                  <span>En el mismo celular</span>
                </button>
                <button
                  id="mode-online-btn"
                  className={`mode-pill ${mode === 'online' ? 'active' : ''}`}
                  onClick={() => { sound.play('click'); setMode('online'); }}
                >
                  <Globe size={22} color="#c47808" />
                  <strong>Online</strong>
                  <span>Salas con código</span>
                </button>
              </div>
            </div>

            <div className="play-grid">
              {/* Left: Squad & Player Name */}
              <div className="parchment-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 className="section-heading" style={{ marginBottom: 0 }}>
                    <Swords size={19} color="#b97507" />
                    Tu Escuadrón
                  </h2>
                  {mode !== 'online' && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        id="size-1v1-btn"
                        className={`btn ${teamSize === 1 ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                        onClick={() => setTeamSize(1)}
                      >
                        1v1
                      </button>
                      <button
                        id="size-2v2-btn"
                        className={`btn ${teamSize === 2 ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                        onClick={() => setTeamSize(2)}
                      >
                        2v2
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label
                      htmlFor="p1-name-input"
                      style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-secondary)', marginBottom: '4px' }}
                    >
                      {mode === 'online' ? 'Tu Nombre' : 'Jugador 1 (Azul)'}
                    </label>
                    <input
                      id="p1-name-input"
                      value={profile.name}
                      onChange={(e) => onUpdateProfileName(e.target.value)}
                      maxLength={18}
                      style={{ width: '100%' }}
                    />
                  </div>
                  {mode === 'local' && (
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <label
                        htmlFor="p2-name-input"
                        style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-secondary)', marginBottom: '4px' }}
                      >
                        Jugador 2 (Rojo)
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

                {/* Selected Hero Quick Cards */}
                <div className="squad-preview-row">
                  {activeP1Team.map((cid) => {
                    const tpl = HERO_TEMPLATES[cid];
                    const lv = profile.heroLevels[cid] || 1;
                    const bonus = getHeroUpgradeBonus(lv);
                    return (
                      <div key={cid} className="squad-slot-card">
                        <div className="squad-slot-avatar">
                          <HeroPortrait classId={cid} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.94rem' }}>
                            {tpl.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)', fontWeight: 600 }}>
                            Nv.{lv} · {tpl.role}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.69rem', color: '#1d68b8', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {tpl.maxHp + bonus.hpBonus} PV · {tpl.atk + bonus.atkBonus} ATQ
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Hero Swap Pills */}
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-secondary)', marginBottom: '6px' }}>
                  Cambio rápido de héroes (toca para alternar):
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  {ALL_HEROES.map((cid) => {
                    const tpl = HERO_TEMPLATES[cid];
                    const selected = activeP1Team.includes(cid);
                    return (
                      <button
                        key={cid}
                        id={`quick-pick-${cid}`}
                        className={`btn ${selected ? 'btn-blue' : 'btn-secondary'}`}
                        style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                        onClick={() => onToggleTeamHero(cid, teamSize)}
                      >
                        <HeroIcon classId={cid} size={14} />
                        {tpl.name}
                      </button>
                    );
                  })}
                </div>

                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.84rem' }}
                  onClick={() => { sound.play('click'); setTab('heroes'); }}
                >
                  <ArrowUpCircle size={16} color="#b97507" />
                  <span>Mejorar Héroes</span>
                  <span style={{ whiteSpace: 'nowrap', fontWeight: 800, color: '#9e6004' }}>
                    (🪙 {profile.gold})
                  </span>
                </button>

                {mode === 'local' && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1.5px solid var(--parchment-border)' }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-secondary)', marginBottom: '6px' }}>
                      Escuadrón de {p2Name || 'Jugador 2'} (Rojo):
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {ALL_HEROES.map((cid) => {
                        const tpl = HERO_TEMPLATES[cid];
                        const sel = activeP2Team.includes(cid);
                        return (
                          <button
                            key={cid}
                            className={`btn ${sel ? 'btn-danger' : 'btn-secondary'}`}
                            style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                            onClick={() => toggleP2Hero(cid)}
                          >
                            {tpl.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Arena Picker + Play Button */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="parchment-panel">
                  <h2 className="section-heading">
                    <MapIcon size={19} color="#b97507" />
                    Elige la Arena (5)
                  </h2>
                  <div className="arena-grid">
                    {(Object.keys(ARENAS) as ArenaId[]).map((aid) => {
                      const a = ARENAS[aid];
                      return (
                        <button
                          key={aid}
                          id={`arena-${aid}`}
                          className={`arena-banner-card ${arenaId === aid ? 'selected' : ''}`}
                          onClick={() => {
                            sound.play('click');
                            setArenaId(aid);
                          }}
                        >
                          <div className="arena-bg-img" style={{ backgroundImage: `url('${a.backdrop}')` }} />
                          <div className="arena-bg-scrim" />
                          <div style={{ position: 'relative', zIndex: 2, flex: 1 }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.98rem' }}>
                              {a.name}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: '#e6edf8', lineHeight: 1.3, marginTop: '2px' }}>
                              {a.subtitle}
                            </div>
                          </div>
                          <div className="arena-minimap" aria-hidden="true">
                            {a.layout.flatMap((row, ry) =>
                              row.split('').map((ch, rx) => (
                                <span key={`${ry}-${rx}`} className={`mini-cell ${charToTileType(ch)}`} />
                              ))
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {mode === 'ai' && (
                  <div className="parchment-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.94rem' }}>
                        Nivel de la IA
                      </span>
                      <span style={{ fontSize: '0.76rem', color: 'var(--ink-secondary)', fontWeight: 700 }}>
                        Premio: +🏆 Copas y 🪙 Oro
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
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
                          className={`btn ${difficulty === key ? 'btn-blue' : 'btn-secondary'}`}
                          style={{ flex: 1, padding: '8px 6px', fontSize: '0.84rem' }}
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
                      style={{ width: '100%', padding: '15px', fontSize: '1.08rem' }}
                      onClick={() => {
                        sound.play('click');
                        const aiPool = ALL_HEROES.filter((c) => !activeP1Team.includes(c));
                        const aiTeam = aiPool.slice(0, teamSize);
                        onStartLocalOrAI({
                          mode: 'ai',
                          arenaId,
                          p1Team: activeP1Team,
                          p2Team: aiTeam,
                          difficulty,
                          p1Name: profile.name.trim() || 'Comandante',
                          p2Name: `IA (${difficulty === 'apprentice' ? 'Aprendiz' : difficulty === 'tactician' ? 'Táctico' : 'Maestro'})`,
                        });
                      }}
                    >
                      <Play size={20} fill="currentColor" />
                      ¡JUGAR CONTRA IA!
                    </button>
                  </div>
                )}

                {mode === 'local' && (
                  <div className="parchment-panel">
                    <button
                      id="start-local-match-btn"
                      className="btn btn-green"
                      style={{ width: '100%', padding: '15px', fontSize: '1.06rem' }}
                      onClick={() => {
                        sound.play('click');
                        onStartLocalOrAI({
                          mode: 'local',
                          arenaId,
                          p1Team: activeP1Team,
                          p2Team: activeP2Team,
                          difficulty,
                          p1Name: profile.name.trim() || 'Jugador 1',
                          p2Name: p2Name.trim() || 'Jugador 2',
                        });
                      }}
                    >
                      <Play size={20} fill="currentColor" />
                      ¡INICIAR DUELO LOCAL!
                    </button>
                  </div>
                )}

                {mode === 'online' && (
                  <div className="parchment-panel">
                    <h3 className="section-heading" style={{ fontSize: '1rem' }}>
                      <Globe size={18} color="#1e62b5" />
                      Multijugador Online
                    </h3>

                    {onlineError && (
                      <div
                        style={{
                          background: '#fde8e8',
                          border: '1.5px solid #e05252',
                          color: '#8f1d1d',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          fontSize: '0.84rem',
                          fontWeight: 600,
                          marginBottom: '12px',
                        }}
                      >
                        {onlineError}
                      </div>
                    )}

                    {waitingRoomCode ? (
                      <div
                        style={{
                          background: '#ffffff',
                          border: '2px solid var(--gold-main)',
                          borderRadius: '12px',
                          padding: '16px',
                          textAlign: 'center',
                        }}
                      >
                        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-secondary)', marginBottom: '6px' }}>
                          Comparte este código con tu amigo:
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '2rem',
                              fontWeight: 800,
                              letterSpacing: '0.16em',
                              color: '#19538f',
                            }}
                          >
                            {waitingRoomCode}
                          </span>
                          <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={handleCopyInvite}>
                            {copiedCode ? <Check size={16} color="#1d9658" /> : <Copy size={16} />}
                          </button>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
                          Esperando oponente...
                        </p>
                        <button className="btn btn-danger" onClick={onCancelWaiting}>
                          Cancelar Sala
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <button
                          id="create-room-btn"
                          className="btn btn-primary"
                          style={{ width: '100%', padding: '13px' }}
                          onClick={() => {
                            sound.play('click');
                            onCreateOnlineRoom({
                              playerName: profile.name.trim() || 'Anfitrión',
                              arenaId,
                              team: profile.selectedTeam.slice(0, 2),
                            });
                          }}
                        >
                          Crear Sala y Obtener Código
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
                            className="btn btn-blue"
                            disabled={!joinCode.trim()}
                            onClick={() => {
                              sound.play('click');
                              onJoinOnlineRoom({
                                code: joinCode.trim(),
                                playerName: profile.name.trim() || 'Retador',
                                team: profile.selectedTeam.slice(0, 2),
                              });
                            }}
                          >
                            Unirse
                          </button>
                        </div>

                        <div style={{ borderTop: '1.5px solid var(--parchment-border)', paddingTop: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink-secondary)' }}>
                              Salas abiertas ({publicRooms.length})
                            </span>
                            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.76rem' }} onClick={fetchRooms}>
                              <RefreshCw size={13} /> Actualizar
                            </button>
                          </div>
                          {publicRooms.length === 0 ? (
                            <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                              No hay salas abiertas ahora. ¡Crea una y comparte el código!
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
                                    background: '#ffffff',
                                    padding: '8px 10px',
                                    borderRadius: '10px',
                                    border: '1.5px solid var(--parchment-border)',
                                  }}
                                >
                                  <div style={{ fontSize: '0.82rem' }}>
                                    <strong>{r.hostName}</strong> · {ARENAS[r.arenaId]?.name}
                                  </div>
                                  <button
                                    className="btn btn-blue"
                                    style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                                    onClick={() =>
                                      onJoinOnlineRoom({
                                        code: r.code,
                                        playerName: profile.name.trim() || 'Retador',
                                        team: profile.selectedTeam.slice(0, 2),
                                      })
                                    }
                                  >
                                    Entrar ({r.code})
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
            </div>
          </>
        )}

        {/* ==================== TAB 2: HÉROES Y MEJORAS ==================== */}
        {tab === 'heroes' && (
          <div className="parchment-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <div>
                <h2 className="section-heading" style={{ marginBottom: '2px' }}>
                  <Shield size={20} color="#b97507" />
                  Cuartel de Héroes y Mejoras
                </h2>
                <p style={{ fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>
                  Equipa hasta 2 héroes y usa tu Oro de Arena para subirlos hasta Nivel 5.
                </p>
              </div>
              <div className="wallet-pill" style={{ background: '#1e355d', fontSize: '0.92rem', padding: '6px 14px' }}>
                <Coins size={16} color="#ffd559" />
                <span>{profile.gold} Oro</span>
              </div>
            </div>

            <div className="heroes-catalog-grid">
              {ALL_HEROES.map((cid) => {
                const tpl = HERO_TEMPLATES[cid];
                const lv = profile.heroLevels[cid] || 1;
                const bonus = getHeroUpgradeBonus(lv);
                const cost = getHeroUpgradeCost(lv);
                const isEquipped = profile.selectedTeam.includes(cid);
                const canAfford = cost > 0 && profile.gold >= cost;

                return (
                  <div key={cid} className={`hero-upgrade-card ${isEquipped ? 'equipped' : ''}`}>
                    <div className="hero-portrait-header">
                      <HeroPortrait classId={cid} />
                      <div className="hero-portrait-scrim" />
                      <span className="hero-level-pill">Nv. {lv} / 5</span>
                      {isEquipped && <span className="hero-equipped-pill">EN EQUIPO</span>}
                      <div style={{ position: 'absolute', bottom: '8px', left: '10px', right: '10px', color: '#ffffff', zIndex: 2 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.12rem' }}>
                          {tpl.name}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#fce8c3', fontWeight: 600 }}>
                          {tpl.title} · {tpl.role}
                        </div>
                      </div>
                    </div>

                    <div className="hero-upgrade-body">
                      <div className="stat-row-grid">
                        <div className="stat-pill">PV {tpl.maxHp + bonus.hpBonus}</div>
                        <div className="stat-pill">ATQ {tpl.atk + bonus.atkBonus}</div>
                        <div className="stat-pill">MOV {tpl.move}</div>
                        <div className="stat-pill">RNG {tpl.range}</div>
                      </div>

                      {bonus.startShield > 0 && (
                        <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#19538f', background: '#e7f2ff', padding: '4px 8px', borderRadius: '7px' }}>
                          🛡️ Maestría Nv.4+: Inicia con +{bonus.startShield} Escudo
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                        {(['basic', 'skill1', 'skill2'] as const).map((slot) => {
                          const ab = tpl.abilities[slot];
                          return (
                            <div
                              key={slot}
                              style={{
                                background: 'var(--parchment-bg)',
                                border: '1px solid var(--parchment-border)',
                                borderRadius: '8px',
                                padding: '6px 8px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800 }}>
                                <span>{ab.name}</span>
                                <span style={{ color: '#9e6004', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                                  {ab.energyCost === 0 ? 'Gratis' : `${ab.energyCost} EN`}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)', lineHeight: 1.3 }}>
                                {ab.description}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button
                          className={`btn ${isEquipped ? 'btn-blue' : 'btn-secondary'}`}
                          style={{ flex: 1, padding: '8px', fontSize: '0.82rem' }}
                          onClick={() => onToggleTeamHero(cid, 2)}
                        >
                          {isEquipped ? '✓ Equipado' : 'Equipar'}
                        </button>
                        <button
                          id={`upgrade-${cid}-btn`}
                          className="btn btn-primary"
                          style={{ flex: 1, padding: '8px', fontSize: '0.82rem' }}
                          disabled={!canAfford}
                          onClick={() => onUpgradeHero(cid)}
                        >
                          {lv >= 5 ? 'MAX' : `Subir (🪙${cost})`}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: RANKING GLOBAL ==================== */}
        {tab === 'ranking' && (
          <div className="parchment-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <div>
                <h2 className="section-heading" style={{ marginBottom: '2px' }}>
                  <Trophy size={20} color="#b97507" />
                  Clasificación Global de BASTIÓN
                </h2>
                <p style={{ fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>
                  Gana partidas contra la IA o en Online para sumar Copas y escalar hasta Leyenda.
                </p>
              </div>
              <button className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '0.82rem' }} onClick={onRefreshLeaderboard}>
                <RefreshCw size={15} /> Actualizar
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '10px',
                marginBottom: '16px',
              }}
            >
              <div style={{ background: '#ffffff', border: '2px solid var(--gold-main)', borderRadius: '12px', padding: '12px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-secondary)' }}>TU RANGO</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.05rem', marginTop: '2px' }}>
                  {rank.badge} {rank.name}
                </div>
              </div>
              <div style={{ background: '#ffffff', border: '1.5px solid var(--parchment-border)', borderRadius: '12px', padding: '12px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-secondary)' }}>COPAS</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.2rem', color: '#9e6004' }}>
                  🏆 {profile.trophies}
                </div>
              </div>
              <div style={{ background: '#ffffff', border: '1.5px solid var(--parchment-border)', borderRadius: '12px', padding: '12px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-secondary)' }}>VICTORIAS / RACHA</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.1rem' }}>
                  {profile.wins}V - {profile.losses}D · 🔥{profile.streak}
                </div>
              </div>
            </div>

            <div className="leaderboard-list">
              {leaderboard.map((entry, idx) => {
                const isMe = entry.name.toLowerCase() === profile.name.trim().toLowerCase();
                const entryRank = getRankInfo(entry.trophies);
                return (
                  <div key={`${entry.name}-${idx}`} className={`leader-row ${isMe ? 'is-me' : ''}`}>
                    <div className={`leader-rank-num ${idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : ''}`}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.96rem' }}>
                        {entry.name} {isMe && <span style={{ fontSize: '0.74rem', color: '#19538f' }}>(Tú)</span>}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--ink-secondary)', fontWeight: 600 }}>
                        {entryRank.badge} {entryRank.name} · {entry.wins}V / {entry.losses}D
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.96rem', color: '#9e6004' }}>
                        🏆 {entry.trophies}
                      </div>
                      {entry.streak > 1 && (
                        <div style={{ fontSize: '0.72rem', color: '#c94c14', fontWeight: 700 }}>
                          🔥 Racha {entry.streak}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom App Navigation */}
      <nav className="mobile-bottom-nav" aria-label="Menú inferior móvil">
        <button
          className={`mobile-nav-item ${tab === 'play' ? 'active' : ''}`}
          onClick={() => { sound.play('click'); setTab('play'); }}
        >
          <Swords size={20} />
          Batalla
        </button>
        <button
          id="tab-heroes-mobile"
          className={`mobile-nav-item ${tab === 'heroes' ? 'active' : ''}`}
          onClick={() => { sound.play('click'); setTab('heroes'); }}
        >
          <Shield size={20} />
          Héroes
        </button>
        <button
          id="tab-ranking-mobile"
          className={`mobile-nav-item ${tab === 'ranking' ? 'active' : ''}`}
          onClick={() => { sound.play('click'); setTab('ranking'); }}
        >
          <Trophy size={20} />
          Ranking
        </button>
        <button
          className="mobile-nav-item"
          onClick={() => { sound.play('click'); onOpenGuide(); }}
        >
          <BookOpen size={20} />
          Guía
        </button>
      </nav>
    </div>
  );
}
