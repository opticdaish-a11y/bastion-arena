import {
  AlertTriangle,
  Check,
  Crown,
  Droplets,
  Flame,
  Info,
  MessageSquare,
  RotateCcw,
  Send,
  Share2,
  Shield,
  SkipForward,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  coordEq,
  getAbilityAoeTiles,
  getHeroAt,
  getValidMoves,
  getValidTargets,
} from '../shared/gameEngine';
import { ARENAS, HERO_TEMPLATES } from '../shared/heroesAndMaps';
import type {
  AbilitySlot,
  Coord,
  GameAction,
  GameMode,
  GameState,
  HeroInstance,
  PlayerId,
} from '../shared/types';
import { sound } from '../utils/sound';
import { HeroPortrait } from './HeroAvatar';

export interface FloatingFx {
  id: string;
  coord: Coord;
  label: string;
  color: string;
  kind: 'hit' | 'heal' | 'shield' | 'skill' | 'move';
}

export interface ChatMsg {
  sender: string;
  playerId: PlayerId;
  text: string;
  timestamp: number;
}

export interface MatchReward {
  trophyDelta: number;
  goldEarned: number;
}

interface GameBoardProps {
  state: GameState;
  mode: GameMode;
  myPlayerId: PlayerId | null;
  floatingFx: FloatingFx[];
  chatMessages: ChatMsg[];
  lastReward: MatchReward | null;
  onAction: (action: GameAction) => void;
  onSendChat: (text: string) => void;
  onRematch: () => void;
  onExitToLobby: () => void;
}

export function GameBoard({
  state,
  mode,
  myPlayerId,
  floatingFx,
  chatMessages,
  lastReward,
  onAction,
  onSendChat,
  onRematch,
  onExitToLobby,
}: GameBoardProps) {
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AbilitySlot | null>(null);
  const [hoverCoord, setHoverCoord] = useState<Coord | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [sharedResult, setSharedResult] = useState(false);

  const arena = ARENAS[state.arenaId] || ARENAS.sunlit_arena;

  const canControlActivePlayer =
    !state.winner &&
    (mode === 'local' || (myPlayerId !== null && state.activePlayer === myPlayerId));

  useEffect(() => {
    const activeHeroes = state.heroes.filter(
      (h) => h.owner === state.activePlayer && h.alive
    );
    const current = activeHeroes.find((h) => h.id === selectedHeroId);
    if (!current || (current.hasMoved && current.hasActed)) {
      const ready = activeHeroes.find((h) => !h.hasMoved || !h.hasActed) || activeHeroes[0];
      setSelectedHeroId(ready ? ready.id : null);
      setSelectedSlot(null);
    }
  }, [state.activePlayer, state.turn, state.heroes, selectedHeroId]);

  const selectedHero: HeroInstance | undefined = useMemo(
    () => state.heroes.find((h) => h.id === selectedHeroId && h.alive),
    [state.heroes, selectedHeroId]
  );

  const validMoves = useMemo(() => {
    if (!canControlActivePlayer || !selectedHero || selectedSlot !== null) return [];
    if (selectedHero.owner !== state.activePlayer) return [];
    return getValidMoves(state, selectedHero.id);
  }, [canControlActivePlayer, selectedHero, selectedSlot, state]);

  const validTargets = useMemo(() => {
    if (!canControlActivePlayer || !selectedHero || !selectedSlot) return [];
    if (selectedHero.owner !== state.activePlayer) return [];
    return getValidTargets(state, selectedHero.id, selectedSlot);
  }, [canControlActivePlayer, selectedHero, selectedSlot, state]);

  const aoePreviewTiles = useMemo(() => {
    if (!selectedHero || !selectedSlot || !hoverCoord) return [];
    if (!validTargets.some((c) => coordEq(c, hoverCoord))) return [];
    return getAbilityAoeTiles(state, selectedHero, selectedSlot, hoverCoord);
  }, [selectedHero, selectedSlot, hoverCoord, validTargets, state]);

  const allActiveHeroesDone = useMemo(() => {
    const activeHeroes = state.heroes.filter(
      (h) => h.owner === state.activePlayer && h.alive
    );
    return activeHeroes.length > 0 && activeHeroes.every((h) => h.hasMoved && h.hasActed);
  }, [state.heroes, state.activePlayer]);

  const tacticalHint = useMemo(() => {
    if (state.winner) return `¡Partida terminada! Ganó ${state.playerNames[state.winner]}.`;
    if (!canControlActivePlayer) {
      return mode === 'ai'
        ? `${state.playerNames[2]} está pensando su jugada...`
        : `Esperando jugada de ${state.playerNames[state.activePlayer]}...`;
    }
    if (selectedSlot && selectedHero) {
      const abName = HERO_TEMPLATES[selectedHero.classId].abilities[selectedSlot].name;
      if (validTargets.length === 0) {
        return `Sin alcance para ${abName}. Muévete primero o elige otra acción.`;
      }
      return `Toca un objetivo naranja en el tablero para usar ${abName}.`;
    }
    if (allActiveHeroesDone) {
      return '¡Todo listo! Pulsa el botón dorado "Terminar Turno".';
    }
    if (selectedHero) {
      if (!selectedHero.hasMoved && !selectedHero.hasActed) {
        return `Toca una casilla AZUL para mover a ${selectedHero.name}, o elige un poder.`;
      }
      if (!selectedHero.hasActed) {
        return `${selectedHero.name} ya se movió: ataca, usa habilidad o Fortifica.`;
      }
      if (!selectedHero.hasMoved) {
        return `${selectedHero.name} aún puede moverse a una casilla azul.`;
      }
    }
    return 'Toca uno de tus héroes para darle órdenes.';
  }, [state, canControlActivePlayer, mode, selectedSlot, selectedHero, validTargets.length, allActiveHeroesDone]);

  const handleTileClick = (x: number, y: number) => {
    if (!canControlActivePlayer) return;
    const coord = { x, y };

    if (selectedHero && selectedSlot && validTargets.some((c) => coordEq(c, coord))) {
      onAction({
        type: 'USE_ABILITY',
        player: state.activePlayer,
        heroId: selectedHero.id,
        slot: selectedSlot,
        target: coord,
      });
      setSelectedSlot(null);
      return;
    }

    if (selectedHero && selectedSlot === null && validMoves.some((c) => coordEq(c, coord))) {
      onAction({
        type: 'MOVE',
        player: state.activePlayer,
        heroId: selectedHero.id,
        to: coord,
      });
      return;
    }

    const occupant = getHeroAt(state, coord);
    if (occupant && occupant.owner === state.activePlayer) {
      sound.play('click');
      setSelectedHeroId(occupant.id);
      setSelectedSlot(null);
      return;
    }

    if (selectedSlot) {
      setSelectedSlot(null);
    }
  };

  const handleShareResult = async () => {
    if (!state.winner) return;
    const summary = `⚔️ ¡Victoria de ${state.playerNames[state.winner]} en BASTIÓN!\n🏰 ${arena.name} | Turno ${state.turn}\n👑 Núcleo: ${state.bastionPoints[1]} - ${state.bastionPoints[2]}\n¿Me retas? 👉 ${window.location.origin}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Resultado en BASTIÓN', text: summary, url: window.location.origin });
        return;
      } catch {
        // fallback
      }
    }
    navigator.clipboard?.writeText(summary);
    setSharedResult(true);
    setTimeout(() => setSharedResult(false), 2200);
  };

  const renderTileDetail = (type: string, runeReady?: boolean) => {
    if (type === 'wall') return <div className="wall-pillar-cap" />;
    if (type === 'bastion') {
      return (
        <>
          <div className="bastion-ring" />
          <Crown size={20} className="tile-icon" color="#8a4c03" />
        </>
      );
    }
    if (type === 'fountain') return <Droplets size={18} className="tile-icon" color="#0d693b" />;
    if (type === 'rune') {
      return (
        <Zap
          size={18}
          className="tile-icon"
          color={runeReady ? '#0d4e96' : '#73654d'}
          style={{ opacity: runeReady ? 0.95 : 0.35 }}
        />
      );
    }
    if (type === 'trap') return <AlertTriangle size={16} className="tile-icon" color="#991b1b" />;
    if (type === 'fire') return <Flame size={19} className="tile-icon" color="#9a2600" />;
    return null;
  };

  const p1Heroes = state.heroes.filter((h) => h.owner === 1);
  const p2Heroes = state.heroes.filter((h) => h.owner === 2);

  return (
    <div className="battle-stage">
      <div
        className="arena-backdrop-layer"
        style={{ backgroundImage: `url('${arena.backdrop}')` }}
      />
      <div className="arena-backdrop-vignette" />

      <div className="game-layout">
        {/* Left Column: Roster & Combat Log */}
        <aside className="sidebar-col">
          <div className="parchment-panel" style={{ padding: '14px' }}>
            <h3 className="section-heading" style={{ fontSize: '0.96rem', marginBottom: '10px' }}>
              Héroes en Arena
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[...p1Heroes, ...p2Heroes].map((h) => {
                const tpl = HERO_TEMPLATES[h.classId];
                const isSel = h.id === selectedHeroId;
                return (
                  <button
                    key={h.id}
                    className={`roster-mini-card ${isSel ? 'active-selected' : ''} ${!h.alive ? 'dead' : ''}`}
                    onClick={() => {
                      if (h.alive && h.owner === state.activePlayer && canControlActivePlayer) {
                        sound.play('click');
                        setSelectedHeroId(h.id);
                        setSelectedSlot(null);
                      }
                    }}
                  >
                    <div
                      className="roster-thumb"
                      style={{ borderColor: h.owner === 1 ? 'var(--blue-main)' : 'var(--red-main)' }}
                    >
                      <HeroPortrait classId={h.classId} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {h.name} <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>Nv.{h.level}</span>
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', fontWeight: 700 }}>
                          {h.alive ? `${h.hp}/${h.maxHp}` : 'CAÍDO'}
                        </span>
                      </div>
                      <div style={{ height: '6px', background: '#dfd2b8', borderRadius: '99px', overflow: 'hidden', marginBottom: '4px' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${(h.hp / h.maxHp) * 100}%`,
                            background: h.owner === 1 ? 'var(--blue-main)' : 'var(--red-main)',
                            transition: 'width 0.25s ease',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--ink-secondary)', fontWeight: 600 }}>
                        <span>{tpl.role}</span>
                        <span>
                          {h.shield > 0 && `🛡️${h.shield} `}
                          {h.statuses.poison > 0 && '☠️'}
                          {h.statuses.burn > 0 && '🔥'}
                          {h.statuses.rooted > 0 && '🌿'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="parchment-panel" style={{ padding: '14px' }}>
            <h3 className="section-heading" style={{ fontSize: '0.96rem', marginBottom: '10px' }}>
              Registro de Batalla
            </h3>
            <div className="combat-log">
              {state.log.map((entry) => (
                <div
                  key={entry.id}
                  className={`log-entry ${entry.player === 1 ? 'p1' : entry.player === 2 ? 'p2' : 'system'}`}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', opacity: 0.7, marginRight: '6px' }}>
                    T{entry.turn}
                  </span>
                  {entry.text}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Column: Scoreboard + Hint + 9x9 Board */}
        <section>
          <div className="scoreboard">
            <div className="player-badge p1">
              <div className="player-name-row">
                <span
                  className="turn-dot"
                  style={{
                    background: state.activePlayer === 1 ? 'var(--blue-main)' : '#bfb297',
                    boxShadow: state.activePlayer === 1 ? '0 0 8px var(--blue-main)' : 'none',
                  }}
                />
                <span>{state.playerNames[1]}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div className="bastion-pips" title={`Núcleo: ${state.bastionPoints[1]}/${state.bastionGoal}`}>
                  {Array.from({ length: state.bastionGoal }).map((_, i) => (
                    <span key={i} className={`bastion-pip ${i < state.bastionPoints[1] ? 'filled' : ''}`} />
                  ))}
                </div>
                <div className="energy-pips" title={`Energía: ${state.energy[1]}/${state.maxEnergy}`}>
                  {Array.from({ length: state.maxEnergy }).map((_, i) => (
                    <span key={i} className={`energy-pip ${i < state.energy[1] ? 'filled' : ''}`} />
                  ))}
                </div>
              </div>
            </div>

            <div className="turn-center">
              <div className="turn-num">TURNO {state.turn}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-secondary)' }}>
                {arena.name}
              </div>
            </div>

            <div className="player-badge p2">
              <div className="player-name-row">
                <span>{state.playerNames[2]}</span>
                <span
                  className="turn-dot"
                  style={{
                    background: state.activePlayer === 2 ? 'var(--red-main)' : '#bfb297',
                    boxShadow: state.activePlayer === 2 ? '0 0 8px var(--red-main)' : 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <div className="energy-pips" title={`Energía: ${state.energy[2]}/${state.maxEnergy}`}>
                  {Array.from({ length: state.maxEnergy }).map((_, i) => (
                    <span key={i} className={`energy-pip ${i < state.energy[2] ? 'filled' : ''}`} />
                  ))}
                </div>
                <div className="bastion-pips" title={`Núcleo: ${state.bastionPoints[2]}/${state.bastionGoal}`}>
                  {Array.from({ length: state.bastionGoal }).map((_, i) => (
                    <span key={i} className={`bastion-pip ${i < state.bastionPoints[2] ? 'filled' : ''}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="tactical-hint-bar">
            <Info size={16} color="#b97507" style={{ flexShrink: 0 }} />
            <span>{tacticalHint}</span>
          </div>

          <div className="board-frame">
            {!state.winner && (
              <div key={`${state.turn}-${state.activePlayer}`} className="turn-banner-overlay">
                {canControlActivePlayer && mode !== 'local'
                  ? '¡Tu Turno!'
                  : `Turno de ${state.playerNames[state.activePlayer]}`}
              </div>
            )}

            <div className="board-grid" role="grid" aria-label="Tablero táctico de 9 por 9">
              {state.grid.map((row, y) =>
                row.map((tile, x) => {
                  const occupant = getHeroAt(state, { x, y });
                  const isMove = validMoves.some((c) => c.x === x && c.y === y);
                  const isTarget = validTargets.some((c) => c.x === x && c.y === y);
                  const isAoe = aoePreviewTiles.some((c) => c.x === x && c.y === y);
                  const isSel = selectedHero && selectedHero.pos.x === x && selectedHero.pos.y === y;
                  const fxHere = floatingFx.filter((f) => f.coord.x === x && f.coord.y === y);
                  const hasHitFx = fxHere.some((f) => f.kind === 'hit');
                  const hasMoveFx = fxHere.some((f) => f.kind === 'move');

                  const classes = [
                    'tile',
                    (x + y) % 2 === 1 ? 'alt' : '',
                    tile.type,
                    tile.type === 'rune' && !tile.runeReady ? 'rune-spent' : '',
                    isMove ? 'valid-move' : '',
                    isTarget ? 'valid-target' : '',
                    isAoe ? 'aoe-preview' : '',
                    isSel ? 'selected-tile' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <div
                      key={`${x}-${y}`}
                      className={classes}
                      onClick={() => handleTileClick(x, y)}
                      onMouseEnter={() => setHoverCoord({ x, y })}
                      onMouseLeave={() => setHoverCoord(null)}
                    >
                      {renderTileDetail(tile.type, tile.runeReady)}

                      {occupant && (
                        <div
                          className={`hero-token ${occupant.owner === 1 ? 'p1' : 'p2'} ${
                            isSel ? 'is-selected' : ''
                          } ${occupant.hasMoved && occupant.hasActed ? 'exhausted' : ''} ${
                            hasHitFx ? 'fx-hit' : hasMoveFx ? 'fx-move' : ''
                          }`}
                        >
                          <div className="hero-token-portrait">
                            <HeroPortrait classId={occupant.classId} />
                          </div>

                          {occupant.shield > 0 && (
                            <span className="hero-shield-badge">{occupant.shield}</span>
                          )}

                          <div className="hero-status-dots">
                            {occupant.statuses.poison > 0 && (
                              <span className="status-dot" style={{ background: '#29a867' }} />
                            )}
                            {occupant.statuses.burn > 0 && (
                              <span className="status-dot" style={{ background: '#e67e35' }} />
                            )}
                            {occupant.statuses.rooted > 0 && (
                              <span className="status-dot" style={{ background: '#8b5e34' }} />
                            )}
                            {occupant.statuses.backstab && (
                              <span className="status-dot" style={{ background: '#1e293b' }} />
                            )}
                          </div>

                          <div className="hero-hp-bar">
                            <div
                              className="hero-hp-fill"
                              style={{
                                width: `${(occupant.hp / occupant.maxHp) * 100}%`,
                                background: occupant.owner === 1 ? '#3b8de3' : '#ef4444',
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {fxHere.map((fx) => (
                        <div key={fx.id}>
                          {fx.kind !== 'move' && (
                            <span className="fx-burst-ring" style={{ color: fx.color }} />
                          )}
                          {fx.label && (
                            <span className="float-fx" style={{ color: fx.color }}>
                              {fx.label}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Right Column / Command Dock */}
        <aside className="sidebar-col">
          <div className="parchment-panel" style={{ padding: '15px' }}>
            {selectedHero ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <div
                    className="roster-thumb"
                    style={{
                      width: '48px',
                      height: '48px',
                      borderColor: selectedHero.owner === 1 ? 'var(--blue-main)' : 'var(--red-main)',
                    }}
                  >
                    <HeroPortrait classId={selectedHero.classId} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.1rem' }}>
                      {selectedHero.name}
                    </h3>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink-secondary)' }}>
                      {HERO_TEMPLATES[selectedHero.classId].title} (Nv.{selectedHero.level})
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700 }}>
                    <div>{selectedHero.hp}/{selectedHero.maxHp} PV</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)' }}>
                      MOV {selectedHero.move} · RNG {selectedHero.range}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', fontSize: '0.76rem', fontWeight: 700, marginBottom: '10px' }}>
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '5px',
                      borderRadius: '8px',
                      background: selectedHero.hasMoved ? '#e8dcc3' : '#dceeff',
                      color: selectedHero.hasMoved ? 'var(--ink-muted)' : '#164d8c',
                      border: '1.5px solid',
                      borderColor: selectedHero.hasMoved ? '#cbb996' : '#85beff',
                    }}
                  >
                    {selectedHero.hasMoved ? 'Mov. usado' : '✓ Puede moverse'}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '5px',
                      borderRadius: '8px',
                      background: selectedHero.hasActed ? '#e8dcc3' : '#fff0c7',
                      color: selectedHero.hasActed ? 'var(--ink-muted)' : '#8f5504',
                      border: '1.5px solid',
                      borderColor: selectedHero.hasActed ? '#cbb996' : '#f1b84b',
                    }}
                  >
                    {selectedHero.hasActed ? 'Acción usada' : '✓ Puede actuar'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(['basic', 'skill1', 'skill2'] as AbilitySlot[]).map((slot) => {
                    const ab = HERO_TEMPLATES[selectedHero.classId].abilities[slot];
                    const cd =
                      slot === 'skill1'
                        ? selectedHero.cooldowns.skill1
                        : slot === 'skill2'
                        ? selectedHero.cooldowns.skill2
                        : 0;
                    const enoughEnergy = state.energy[state.activePlayer] >= ab.energyCost;
                    const disabled =
                      !canControlActivePlayer ||
                      selectedHero.owner !== state.activePlayer ||
                      selectedHero.hasActed ||
                      cd > 0 ||
                      !enoughEnergy;
                    const isSelected = selectedSlot === slot;

                    return (
                      <button
                        key={slot}
                        id={`ability-${slot}-btn`}
                        className={`ability-btn ${isSelected ? 'selected' : ''}`}
                        disabled={disabled}
                        onClick={() => {
                          sound.play('click');
                          setSelectedSlot(isSelected ? null : slot);
                        }}
                      >
                        <div className="ability-header">
                          <span>{ab.name}</span>
                          <span className="ability-cost">
                            {cd > 0
                              ? `Espera ${cd}`
                              : ab.energyCost === 0
                              ? 'Gratis'
                              : `${ab.energyCost} EN`}
                          </span>
                        </div>
                        <p className="ability-desc">{ab.description}</p>
                      </button>
                    );
                  })}

                  <button
                    id="fortify-btn"
                    className="btn btn-secondary"
                    style={{ padding: '9px' }}
                    disabled={
                      !canControlActivePlayer ||
                      selectedHero.owner !== state.activePlayer ||
                      selectedHero.hasActed
                    }
                    onClick={() => {
                      setSelectedSlot(null);
                      onAction({
                        type: 'FORTIFY',
                        player: state.activePlayer,
                        heroId: selectedHero.id,
                      });
                    }}
                  >
                    <Shield size={16} />
                    Fortificar (+2 Escudo)
                  </button>
                </div>
              </>
            ) : (
              <p style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--ink-secondary)' }}>
                Toca uno de tus héroes en el tablero para darle órdenes.
              </p>
            )}

            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1.5px solid var(--parchment-border)' }}>
              <button
                id="end-turn-btn"
                className={`btn btn-primary ${allActiveHeroesDone && canControlActivePlayer ? 'end-turn-pulse' : ''}`}
                style={{ width: '100%', padding: '13px', fontSize: '1rem' }}
                disabled={!canControlActivePlayer}
                onClick={() => {
                  sound.play('click');
                  setSelectedSlot(null);
                  onAction({ type: 'END_TURN', player: state.activePlayer });
                }}
              >
                <SkipForward size={18} />
                Terminar Turno
              </button>
            </div>
          </div>

          {mode === 'online' && (
            <div className="parchment-panel" style={{ padding: '14px' }}>
              <h3 className="section-heading" style={{ fontSize: '0.94rem', marginBottom: '8px' }}>
                <MessageSquare size={16} color="#1e62b5" />
                Chat de Sala
              </h3>
              <div
                style={{
                  maxHeight: '120px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  marginBottom: '8px',
                }}
              >
                {chatMessages.length === 0 ? (
                  <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                    Envía un saludo o GG a tu rival...
                  </p>
                ) : (
                  chatMessages.map((m, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', lineHeight: 1.35 }}>
                      <strong style={{ color: m.playerId === 1 ? 'var(--blue-dark)' : 'var(--red-dark)' }}>
                        {m.sender}:
                      </strong>{' '}
                      <span>{m.text}</span>
                    </div>
                  ))
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (chatInput.trim()) {
                    onSendChat(chatInput.trim());
                    setChatInput('');
                  }
                }}
                style={{ display: 'flex', gap: '6px' }}
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Mensaje..."
                  maxLength={140}
                  style={{ flex: 1, padding: '7px 10px', fontSize: '0.84rem' }}
                />
                <button type="submit" className="btn btn-blue" style={{ padding: '7px 11px' }}>
                  <Send size={14} />
                </button>
              </form>
            </div>
          )}
        </aside>
      </div>

      {/* Victory Modal with Trophies & Gold Rewards */}
      {state.winner && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <Crown size={46} color="#e09316" style={{ margin: '0 auto 8px' }} />
            <h2>¡Victoria de {state.playerNames[state.winner]}!</h2>
            <p style={{ color: 'var(--ink-secondary)', fontSize: '0.94rem', fontWeight: 600, marginBottom: '14px' }}>
              {state.winReason} · Turno {state.turn}
            </p>

            {lastReward && (
              <div
                style={{
                  background: '#ffffff',
                  border: '2px solid var(--gold-main)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  marginBottom: '14px',
                  display: 'flex',
                  justifyContent: 'space-around',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                }}
              >
                <span style={{ color: lastReward.trophyDelta >= 0 ? '#1d9658' : '#cc3636' }}>
                  🏆 {lastReward.trophyDelta >= 0 ? `+${lastReward.trophyDelta}` : lastReward.trophyDelta} Copas
                </span>
                <span style={{ color: '#b97507' }}>
                  🪙 +{lastReward.goldEarned} Oro
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button id="rematch-btn" className="btn btn-primary" onClick={onRematch}>
                <RotateCcw size={16} />
                Revancha
              </button>
              <button id="share-victory-btn" className="btn btn-blue" onClick={handleShareResult}>
                {sharedResult ? <Check size={16} /> : <Share2 size={16} />}
                {sharedResult ? '¡Copiado!' : 'Compartir'}
              </button>
              <button id="back-lobby-btn" className="btn btn-secondary" onClick={onExitToLobby}>
                Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
