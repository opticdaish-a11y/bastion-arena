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

interface GameBoardProps {
  state: GameState;
  mode: GameMode;
  myPlayerId: PlayerId | null;
  floatingFx: FloatingFx[];
  chatMessages: ChatMsg[];
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

  const arena = ARENAS[state.arenaId] || ARENAS.crucible;

  const canControlActivePlayer =
    !state.winner &&
    (mode === 'local' || (myPlayerId !== null && state.activePlayer === myPlayerId));

  // Auto-select a ready hero of the active player
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
    if (state.winner) return `¡Partida finalizada! ${state.playerNames[state.winner]} se alza con la victoria.`;
    if (!canControlActivePlayer) {
      return mode === 'ai'
        ? `${state.playerNames[2]} está calculando su movimiento...`
        : `Esperando jugada de ${state.playerNames[state.activePlayer]}...`;
    }
    if (selectedSlot && selectedHero) {
      const abName = HERO_TEMPLATES[selectedHero.classId].abilities[selectedSlot].name;
      if (validTargets.length === 0) {
        return `No hay objetivos válidos al alcance para ${abName}. Toca otra habilidad o muévete primero.`;
      }
      return `Toca una casilla iluminada en naranja para lanzar ${abName}.`;
    }
    if (allActiveHeroesDone) {
      return 'Todos tus héroes actuaron. Pulsa "Terminar Turno" para continuar.';
    }
    if (selectedHero) {
      if (!selectedHero.hasMoved && !selectedHero.hasActed) {
        return `Toca una casilla azul para mover a ${selectedHero.name}, o elige una habilidad abajo.`;
      }
      if (!selectedHero.hasActed) {
        return `${selectedHero.name} ya se movió: elige una habilidad o Fortificar.`;
      }
      if (!selectedHero.hasMoved) {
        return `${selectedHero.name} aún puede moverse a una casilla azul.`;
      }
    }
    return 'Toca uno de tus héroes en el tablero para darle órdenes.';
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
    const summary = `⚔️ ¡Victoria de ${state.playerNames[state.winner]} en BASTIÓN!\n🏰 Arena: ${arena.name} | Turno ${state.turn}\n👑 Núcleo: ${state.bastionPoints[1]} - ${state.bastionPoints[2]}\n¿Me retas? 👉 ${window.location.origin}`;
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
          <Crown size={20} className="tile-icon" color="#f7d486" />
        </>
      );
    }
    if (type === 'fountain') return <Droplets size={18} className="tile-icon" color="#4db87f" />;
    if (type === 'rune') {
      return (
        <Zap
          size={18}
          className="tile-icon"
          color={runeReady ? '#7cd0ff' : '#4a5468'}
          style={{ opacity: runeReady ? 0.9 : 0.3 }}
        />
      );
    }
    if (type === 'trap') return <AlertTriangle size={16} className="tile-icon" color="#de5656" />;
    if (type === 'fire') return <Flame size={19} className="tile-icon" color="#ffa952" style={{ opacity: 0.92 }} />;
    return null;
  };

  const p1Heroes = state.heroes.filter((h) => h.owner === 1);
  const p2Heroes = state.heroes.filter((h) => h.owner === 2);

  return (
    <div className="battle-stage">
      {/* Dynamic Arena Illustrated Backdrop */}
      <div
        className="arena-backdrop-layer"
        style={{ backgroundImage: `url('${arena.backdrop}')` }}
      />
      <div className="arena-backdrop-vignette" />

      <div className="game-layout">
        {/* Left Column: Squad Rosters & Combat Log */}
        <aside className="sidebar-col">
          <div className="panel" style={{ padding: '14px' }}>
            <h3 className="panel-title" style={{ fontSize: '0.88rem', marginBottom: '10px' }}>
              Escuadrones en Arena
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
                      style={{ borderColor: h.owner === 1 ? 'var(--p1-color)' : 'var(--p2-color)' }}
                    >
                      <HeroPortrait classId={h.classId} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {h.name}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {h.alive ? `${h.hp}/${h.maxHp}` : 'CAÍDO'}
                        </span>
                      </div>
                      <div style={{ height: '5px', background: '#090b10', borderRadius: '4px', overflow: 'hidden', marginBottom: '4px' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${(h.hp / h.maxHp) * 100}%`,
                            background: h.owner === 1 ? 'var(--p1-color)' : 'var(--p2-color)',
                            transition: 'width 0.25s ease',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.69rem', color: 'var(--text-muted)' }}>
                        <span>{tpl.title}</span>
                        <span>
                          {h.shield > 0 && `🛡${h.shield} `}
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

          <div className="panel" style={{ padding: '14px' }}>
            <h3 className="panel-title" style={{ fontSize: '0.88rem', marginBottom: '10px' }}>
              Crónica de Batalla
            </h3>
            <div className="combat-log">
              {state.log.map((entry) => (
                <div
                  key={entry.id}
                  className={`log-entry ${entry.player === 1 ? 'p1' : entry.player === 2 ? 'p2' : 'system'}`}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.67rem', opacity: 0.65, marginRight: '6px' }}>
                    T{entry.turn}
                  </span>
                  {entry.text}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Column: Versus Scoreboard, Hint, 9x9 Sculpted Board */}
        <section>
          <div className="scoreboard">
            <div className="player-badge p1">
              <div className="player-name-row">
                <span
                  className="turn-dot"
                  style={{
                    background: state.activePlayer === 1 ? 'var(--p1-color)' : 'var(--text-muted)',
                    boxShadow: state.activePlayer === 1 ? '0 0 10px var(--p1-color)' : 'none',
                  }}
                />
                <span>{state.playerNames[1]}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div className="bastion-pips" title={`Puntos de Núcleo: ${state.bastionPoints[1]}/${state.bastionGoal}`}>
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
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
                {arena.name}
              </div>
            </div>

            <div className="player-badge p2">
              <div className="player-name-row">
                <span>{state.playerNames[2]}</span>
                <span
                  className="turn-dot"
                  style={{
                    background: state.activePlayer === 2 ? 'var(--p2-color)' : 'var(--text-muted)',
                    boxShadow: state.activePlayer === 2 ? '0 0 10px var(--p2-color)' : 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <div className="energy-pips" title={`Energía: ${state.energy[2]}/${state.maxEnergy}`}>
                  {Array.from({ length: state.maxEnergy }).map((_, i) => (
                    <span key={i} className={`energy-pip ${i < state.energy[2] ? 'filled' : ''}`} />
                  ))}
                </div>
                <div className="bastion-pips" title={`Puntos de Núcleo: ${state.bastionPoints[2]}/${state.bastionGoal}`}>
                  {Array.from({ length: state.bastionGoal }).map((_, i) => (
                    <span key={i} className={`bastion-pip ${i < state.bastionPoints[2] ? 'filled' : ''}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="tactical-hint-bar">
            <Info size={15} color="#e0b35a" style={{ flexShrink: 0 }} />
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
                      title={
                        tile.type === 'bastion'
                          ? 'Núcleo del Bastión (+1 Punto al terminar turno aquí)'
                          : tile.type === 'fountain'
                          ? 'Fuente Curativa (+3 PV al inicio del turno)'
                          : tile.type === 'rune'
                          ? 'Runa de Poder (+1 Energía, +2 Escudo)'
                          : tile.type === 'trap'
                          ? 'Trampa de Pinchos (-3 PV al pisar)'
                          : tile.type === 'fire'
                          ? 'Llamas (-3 PV y Quemadura)'
                          : tile.type === 'wall'
                          ? 'Pilar de Obsidiana'
                          : undefined
                      }
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
                              <span className="status-dot" style={{ background: '#4db87f' }} title="Envenenado" />
                            )}
                            {occupant.statuses.burn > 0 && (
                              <span className="status-dot" style={{ background: '#e67e35' }} title="Quemadura" />
                            )}
                            {occupant.statuses.rooted > 0 && (
                              <span className="status-dot" style={{ background: '#a68b5b' }} title="Inmovilizado" />
                            )}
                            {occupant.statuses.backstab && (
                              <span className="status-dot" style={{ background: '#f8fafc' }} title="Sigilo +3 ATQ" />
                            )}
                          </div>

                          <div className="hero-hp-bar">
                            <div
                              className="hero-hp-fill"
                              style={{
                                width: `${(occupant.hp / occupant.maxHp) * 100}%`,
                                background: occupant.owner === 1 ? '#58b4ff' : '#ff5e5e',
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

        {/* Right Column / Mobile Command Dock */}
        <aside className="sidebar-col">
          <div className="panel" style={{ padding: '15px' }}>
            {selectedHero ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div
                    className="roster-thumb"
                    style={{
                      width: '48px',
                      height: '48px',
                      borderColor: selectedHero.owner === 1 ? 'var(--p1-color)' : 'var(--p2-color)',
                    }}
                  >
                    <HeroPortrait classId={selectedHero.classId} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--accent-gold-bright)' }}>
                      {selectedHero.name}
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {HERO_TEMPLATES[selectedHero.classId].title}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                    <div><strong>{selectedHero.hp}</strong>/{selectedHero.maxHp} PV</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      MOV {selectedHero.move} · RNG {selectedHero.range}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', fontSize: '0.73rem', marginBottom: '12px' }}>
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      background: selectedHero.hasMoved ? 'rgba(11,13,18,0.65)' : 'rgba(79, 155, 224, 0.16)',
                      border: `1px solid ${selectedHero.hasMoved ? 'var(--border-iron)' : 'rgba(79, 155, 224, 0.5)'}`,
                      color: selectedHero.hasMoved ? 'var(--text-muted)' : '#9fd5ff',
                    }}
                  >
                    {selectedHero.hasMoved ? 'Mov. usado' : 'Mov. listo'}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      background: selectedHero.hasActed ? 'rgba(11,13,18,0.65)' : 'rgba(224, 179, 90, 0.16)',
                      border: `1px solid ${selectedHero.hasActed ? 'var(--border-iron)' : 'rgba(224, 179, 90, 0.5)'}`,
                      color: selectedHero.hasActed ? 'var(--text-muted)' : 'var(--accent-gold-bright)',
                    }}
                  >
                    {selectedHero.hasActed ? 'Acción usada' : 'Acción lista'}
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
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                Toca uno de tus héroes en el tablero para ver sus acciones.
              </p>
            )}

            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                id="end-turn-btn"
                className={`btn btn-primary ${allActiveHeroesDone && canControlActivePlayer ? 'end-turn-pulse' : ''}`}
                style={{ width: '100%', padding: '12px', fontSize: '0.94rem' }}
                disabled={!canControlActivePlayer}
                onClick={() => {
                  sound.play('click');
                  setSelectedSlot(null);
                  onAction({ type: 'END_TURN', player: state.activePlayer });
                }}
              >
                <SkipForward size={17} />
                Terminar Turno
              </button>
            </div>
          </div>

          {mode === 'online' && (
            <div className="panel" style={{ padding: '14px' }}>
              <h3 className="panel-title" style={{ fontSize: '0.88rem', marginBottom: '8px' }}>
                <MessageSquare size={15} />
                Chat de Sala
              </h3>
              <div
                style={{
                  maxHeight: '130px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginBottom: '8px',
                }}
              >
                {chatMessages.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Envía un saludo o GG a tu rival...
                  </p>
                ) : (
                  chatMessages.map((m, i) => (
                    <div key={i} style={{ fontSize: '0.77rem', lineHeight: 1.35 }}>
                      <strong style={{ color: m.playerId === 1 ? 'var(--p1-color)' : 'var(--p2-color)' }}>
                        {m.sender}:
                      </strong>{' '}
                      <span style={{ color: 'var(--text-primary)' }}>{m.text}</span>
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
                  style={{ flex: 1, padding: '7px 10px', fontSize: '0.8rem' }}
                />
                <button type="submit" className="btn btn-secondary" style={{ padding: '7px 10px' }}>
                  <Send size={14} />
                </button>
              </form>
            </div>
          )}
        </aside>
      </div>

      {/* Victory Modal with Shareable Match Summary */}
      {state.winner && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <Crown size={46} color="#f7d486" style={{ margin: '0 auto 10px', filter: 'drop-shadow(0 0 12px rgba(224,179,90,0.5))' }} />
            <h2>¡Victoria de {state.playerNames[state.winner]}!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '16px' }}>
              {state.winReason} en el Turno {state.turn}.
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                background: 'rgba(11,13,18,0.7)',
                border: '1px solid var(--border-iron)',
                borderRadius: '10px',
                padding: '10px',
                marginBottom: '20px',
                fontSize: '0.82rem',
              }}
            >
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>NÚCLEO</div>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>
                  {state.bastionPoints[1]} - {state.bastionPoints[2]}
                </strong>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>ARENA</div>
                <strong>{arena.name}</strong>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>TURNOS</div>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{state.turn}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button id="rematch-btn" className="btn btn-primary" onClick={onRematch}>
                <RotateCcw size={16} />
                Revancha
              </button>
              <button id="share-victory-btn" className="btn btn-secondary" onClick={handleShareResult}>
                {sharedResult ? <Check size={16} color="#4db87f" /> : <Share2 size={16} />}
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
