import {
  AlertTriangle,
  Crown,
  Droplets,
  Flame,
  MessageSquare,
  RotateCcw,
  Send,
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
import { HERO_TEMPLATES } from '../shared/heroesAndMaps';
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
import { HeroIcon } from './HeroAvatar';

export interface FloatingFx {
  id: string;
  coord: Coord;
  label: string;
  color: string;
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
  myPlayerId: PlayerId | null; // null in local 2P, 1 in AI, 1 or 2 in online
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

  const handleTileClick = (x: number, y: number) => {
    if (!canControlActivePlayer) return;
    const coord = { x, y };

    // 1. If aiming an ability and clicked a valid target
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

    // 2. If clicked a valid move tile
    if (selectedHero && selectedSlot === null && validMoves.some((c) => coordEq(c, coord))) {
      onAction({
        type: 'MOVE',
        player: state.activePlayer,
        heroId: selectedHero.id,
        to: coord,
      });
      return;
    }

    // 3. Otherwise check if clicked own hero to select
    const occupant = getHeroAt(state, coord);
    if (occupant && occupant.owner === state.activePlayer) {
      sound.play('click');
      setSelectedHeroId(occupant.id);
      setSelectedSlot(null);
      return;
    }

    // 4. Deselect ability if clicking elsewhere
    if (selectedSlot) {
      setSelectedSlot(null);
    }
  };

  const renderTileIcon = (type: string, runeReady?: boolean) => {
    if (type === 'bastion') return <Crown size={20} className="tile-icon" color="#d4a853" />;
    if (type === 'fountain') return <Droplets size={18} className="tile-icon" color="#4ca674" />;
    if (type === 'rune' && runeReady) return <Zap size={18} className="tile-icon" color="#5ea5db" />;
    if (type === 'trap') return <AlertTriangle size={16} className="tile-icon" color="#c84b4b" />;
    if (type === 'fire') return <Flame size={18} className="tile-icon" color="#d97736" />;
    return null;
  };

  const p1Heroes = state.heroes.filter((h) => h.owner === 1);
  const p2Heroes = state.heroes.filter((h) => h.owner === 2);

  return (
    <div style={{ padding: '0 8px' }}>
      <div className="game-layout">
        {/* Left Column: Rosters & Combat Log */}
        <aside className="sidebar-col">
          <div className="panel" style={{ padding: '14px' }}>
            <h3 className="panel-title" style={{ fontSize: '0.92rem', marginBottom: '10px' }}>
              Escuadrones
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[...p1Heroes, ...p2Heroes].map((h) => {
                const tpl = HERO_TEMPLATES[h.classId];
                const isSel = h.id === selectedHeroId;
                return (
                  <button
                    key={h.id}
                    className={`hero-card ${isSel ? 'active-selected' : ''} ${!h.alive ? 'dead' : ''}`}
                    style={{ textAlign: 'left', width: '100%' }}
                    onClick={() => {
                      if (h.alive && h.owner === state.activePlayer && canControlActivePlayer) {
                        setSelectedHeroId(h.id);
                        setSelectedSlot(null);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.86rem' }}>
                        <span style={{ color: h.owner === 1 ? 'var(--p1-color)' : 'var(--p2-color)' }}>
                          <HeroIcon classId={h.classId} size={15} />
                        </span>
                        {h.name}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {h.alive ? `${h.hp}/${h.maxHp} PV` : 'CAÍDO'}
                      </span>
                    </div>
                    <div style={{ height: '5px', background: 'var(--bg-deep)', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${(h.hp / h.maxHp) * 100}%`,
                          background: h.owner === 1 ? 'var(--p1-color)' : 'var(--p2-color)',
                          transition: 'width 0.25s ease',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <span>{tpl.title}</span>
                      <span>
                        {h.shield > 0 && `🛡 ${h.shield} `}
                        {h.statuses.poison > 0 && '☠️ '}
                        {h.statuses.burn > 0 && '🔥 '}
                        {h.statuses.rooted > 0 && '🌿 '}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="panel" style={{ padding: '14px' }}>
            <h3 className="panel-title" style={{ fontSize: '0.92rem', marginBottom: '10px' }}>
              Registro de Combate
            </h3>
            <div className="combat-log">
              {state.log.map((entry) => (
                <div
                  key={entry.id}
                  className={`log-entry ${entry.player === 1 ? 'p1' : entry.player === 2 ? 'p2' : 'system'}`}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', opacity: 0.65, marginRight: '6px' }}>
                    T{entry.turn}
                  </span>
                  {entry.text}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Column: Scoreboard + 9x9 Tactical Board */}
        <section>
          <div className="scoreboard">
            <div className="player-badge p1">
              <div className="player-name-row">
                <span
                  className="turn-dot"
                  style={{
                    background: state.activePlayer === 1 ? 'var(--p1-color)' : 'var(--text-muted)',
                    boxShadow: state.activePlayer === 1 ? '0 0 8px var(--p1-color)' : 'none',
                  }}
                />
                <span>{state.playerNames[1]}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <span>Núcleo: {state.bastionPoints[1]}/{state.bastionGoal}</span>
                <div className="energy-pips" title="Energía">
                  {Array.from({ length: state.maxEnergy }).map((_, i) => (
                    <span key={i} className={`energy-pip ${i < state.energy[1] ? 'filled' : ''}`} />
                  ))}
                </div>
              </div>
            </div>

            <div className="turn-center">
              <div className="turn-num">TURNO {state.turn}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {state.winner
                  ? 'Fin de la partida'
                  : state.activePlayer === 1
                  ? `Turno de ${state.playerNames[1]}`
                  : `Turno de ${state.playerNames[2]}`}
              </div>
            </div>

            <div className="player-badge p2">
              <div className="player-name-row">
                <span>{state.playerNames[2]}</span>
                <span
                  className="turn-dot"
                  style={{
                    background: state.activePlayer === 2 ? 'var(--p2-color)' : 'var(--text-muted)',
                    boxShadow: state.activePlayer === 2 ? '0 0 8px var(--p2-color)' : 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <div className="energy-pips" title="Energía">
                  {Array.from({ length: state.maxEnergy }).map((_, i) => (
                    <span key={i} className={`energy-pip ${i < state.energy[2] ? 'filled' : ''}`} />
                  ))}
                </div>
                <span>Núcleo: {state.bastionPoints[2]}/{state.bastionGoal}</span>
              </div>
            </div>
          </div>

          <div className="board-frame">
            <div className="board-grid" role="grid" aria-label="Tablero táctico de 9 por 9">
              {state.grid.map((row, y) =>
                row.map((tile, x) => {
                  const occupant = getHeroAt(state, { x, y });
                  const isMove = validMoves.some((c) => c.x === x && c.y === y);
                  const isTarget = validTargets.some((c) => c.x === x && c.y === y);
                  const isAoe = aoePreviewTiles.some((c) => c.x === x && c.y === y);
                  const isSel = selectedHero && selectedHero.pos.x === x && selectedHero.pos.y === y;
                  const fxHere = floatingFx.filter((f) => f.coord.x === x && f.coord.y === y);

                  const classes = [
                    'tile',
                    (x + y) % 2 === 1 ? 'alt' : '',
                    tile.type,
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
                          ? 'Pilar de Piedra'
                          : undefined
                      }
                    >
                      {renderTileIcon(tile.type, tile.runeReady)}

                      {occupant && (
                        <div
                          className={`hero-token ${occupant.owner === 1 ? 'p1' : 'p2'} ${
                            occupant.hasMoved && occupant.hasActed ? 'exhausted' : ''
                          }`}
                        >
                          <HeroIcon classId={occupant.classId} size={22} />

                          {occupant.shield > 0 && (
                            <span className="hero-shield-badge">{occupant.shield}</span>
                          )}

                          <div className="hero-status-dots">
                            {occupant.statuses.poison > 0 && (
                              <span className="status-dot" style={{ background: '#4ca674' }} title="Envenenado" />
                            )}
                            {occupant.statuses.burn > 0 && (
                              <span className="status-dot" style={{ background: '#d97736' }} title="Quemadura" />
                            )}
                            {occupant.statuses.rooted > 0 && (
                              <span className="status-dot" style={{ background: '#a68b5b' }} title="Inmovilizado" />
                            )}
                            {occupant.statuses.backstab && (
                              <span className="status-dot" style={{ background: '#e5e7eb' }} title="Sigilo +3 ATQ" />
                            )}
                          </div>

                          <div className="hero-hp-bar">
                            <div
                              className="hero-hp-fill"
                              style={{
                                width: `${(occupant.hp / occupant.maxHp) * 100}%`,
                                background: occupant.owner === 1 ? '#64b5f6' : '#ef5350',
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {fxHere.map((fx) => (
                        <span key={fx.id} className="float-fx" style={{ color: fx.color }}>
                          {fx.label}
                        </span>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Hero Actions & Online Chat */}
        <aside className="sidebar-col">
          <div className="panel" style={{ padding: '16px' }}>
            {selectedHero ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--accent-gold)' }}>
                      {selectedHero.name}
                    </h3>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      {HERO_TEMPLATES[selectedHero.classId].title}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                    <div>PV {selectedHero.hp}/{selectedHero.maxHp}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      MOV {selectedHero.move} · RNG {selectedHero.range}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    fontSize: '0.74rem',
                    marginBottom: '12px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '4px',
                      borderRadius: '6px',
                      background: selectedHero.hasMoved ? 'var(--bg-deep)' : 'rgba(74, 142, 194, 0.16)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {selectedHero.hasMoved ? 'Movimiento usado' : 'Movimiento listo'}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '4px',
                      borderRadius: '6px',
                      background: selectedHero.hasActed ? 'var(--bg-deep)' : 'rgba(212, 168, 83, 0.16)',
                      border: '1px solid var(--border-subtle)',
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
                              ? `CD ${cd}`
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
                Selecciona uno de tus héroes en el tablero para ver sus acciones.
              </p>
            )}

            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                id="end-turn-btn"
                className="btn btn-primary"
                style={{ width: '100%', padding: '11px' }}
                disabled={!canControlActivePlayer}
                onClick={() => {
                  sound.play('click');
                  setSelectedSlot(null);
                  onAction({ type: 'END_TURN', player: state.activePlayer });
                }}
              >
                <SkipForward size={16} />
                Terminar Turno
              </button>
            </div>
          </div>

          {mode === 'online' && (
            <div className="panel" style={{ padding: '14px' }}>
              <h3 className="panel-title" style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
                <MessageSquare size={15} />
                Chat de Sala
              </h3>
              <div
                style={{
                  maxHeight: '140px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginBottom: '8px',
                }}
              >
                {chatMessages.length === 0 ? (
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Saluda a tu oponente...
                  </p>
                ) : (
                  chatMessages.map((m, i) => (
                    <div key={i} style={{ fontSize: '0.78rem', lineHeight: 1.35 }}>
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
                  style={{ flex: 1, padding: '7px 10px', fontSize: '0.82rem' }}
                />
                <button type="submit" className="btn btn-secondary" style={{ padding: '7px 10px' }}>
                  <Send size={14} />
                </button>
              </form>
            </div>
          )}

          <div className="panel" style={{ padding: '12px 14px', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Reglas Rápidas
            </strong>
            • Gana derrotando al rival o alcanzando <strong>5 pts</strong> en el Núcleo central.
            <br />• <strong>Runa</strong>: +1 Energía, +2 Escudo · <strong>Fuente</strong>: +3 PV/turno.
          </div>
        </aside>
      </div>

      {/* Victory Modal */}
      {state.winner && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <Crown size={42} color="#d4a853" style={{ margin: '0 auto 12px' }} />
            <h2>¡Victoria de {state.playerNames[state.winner]}!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '22px' }}>
              {state.winReason} en el Turno {state.turn}.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button id="rematch-btn" className="btn btn-primary" onClick={onRematch}>
                <RotateCcw size={16} />
                Revancha
              </button>
              <button id="back-lobby-btn" className="btn btn-secondary" onClick={onExitToLobby}>
                Volver al Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
