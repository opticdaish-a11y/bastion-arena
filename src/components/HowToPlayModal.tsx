import { AlertTriangle, Crown, Droplets, Footprints, Shield, Swords, X, Zap } from 'lucide-react';

interface HowToPlayModalProps {
  onClose: () => void;
}

export function HowToPlayModal({ onClose }: HowToPlayModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card guide-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px', textAlign: 'left' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '1.35rem' }}>Cómo Jugar BASTIÓN</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Cerrar guía">
            <X size={20} />
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '16px' }}>
          Combate táctico por turnos en una arena de 9×9. Gana quien <strong>derrote a todos los héroes rivales</strong> o acumule <strong>5 puntos</strong> en el Núcleo del Bastión.
        </p>

        <div className="guide-steps">
          <div className="guide-step">
            <div className="guide-step-badge"><Footprints size={17} /></div>
            <div>
              <strong>1. Mueve tu Héroe</strong>
              <p>Toca a uno de tus héroes azules y presiona cualquier casilla iluminada en azul para desplazarte.</p>
            </div>
          </div>

          <div className="guide-step">
            <div className="guide-step-badge"><Swords size={17} /></div>
            <div>
              <strong>2. Ataca o Usa Habilidades</strong>
              <p>Elige el ataque básico (gratis) o una habilidad especial (gasta Energía) y toca al enemigo resaltado en naranja.</p>
            </div>
          </div>

          <div className="guide-step">
            <div className="guide-step-badge"><Shield size={17} /></div>
            <div>
              <strong>3. Controla el Centro y Termina Turno</strong>
              <p>Si terminas tu turno con un héroe parado sobre la Corona central, sumas +1 Punto de Núcleo. ¡Recibes +2 Energía cada turno!</p>
            </div>
          </div>
        </div>

        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', color: 'var(--accent-gold)', margin: '16px 0 10px' }}>
          Casillas Especiales de la Arena
        </h3>

        <div className="guide-tiles-grid">
          <div className="guide-tile-item">
            <Crown size={18} color="#e6ba5c" />
            <div>
              <strong>Núcleo del Bastión</strong>
              <span>+1 Punto al terminar tu turno encima.</span>
            </div>
          </div>
          <div className="guide-tile-item">
            <Zap size={18} color="#5ea5db" />
            <div>
              <strong>Runa de Poder</strong>
              <span>+1 Energía y +2 Escudo al pisarla.</span>
            </div>
          </div>
          <div className="guide-tile-item">
            <Droplets size={18} color="#4ca674" />
            <div>
              <strong>Fuente Curativa</strong>
              <span>Recupera +3 PV al iniciar tu turno aquí.</span>
            </div>
          </div>
          <div className="guide-tile-item">
            <AlertTriangle size={18} color="#d65656" />
            <div>
              <strong>Trampa de Pinchos</strong>
              <span>Inflige 3 de daño directo al pisarla.</span>
            </div>
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%', marginTop: '18px', padding: '12px' }} onClick={onClose}>
          ¡Entendido, a la Arena!
        </button>
      </div>
    </div>
  );
}
