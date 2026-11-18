import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { applyGameAction, createInitialGameState } from '../src/shared/gameEngine';
import { getRankInfo } from '../src/shared/heroesAndMaps';
import type {
  ArenaId,
  GameAction,
  GameEvent,
  GameState,
  HeroClassId,
  LeaderboardEntry,
  PlayerId,
  RoomSummary,
} from '../src/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3001;
const app = express();

// Permissive CORS & CORP headers so PWABuilder and browser validators can read manifest, icons, and SW
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json());

// ==================== PERSISTENT LEADERBOARD ====================
const DATA_DIR = path.resolve(__dirname, '../data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

const SEED_LEADERS: LeaderboardEntry[] = [
  { name: 'Valerius_Rex', trophies: 840, wins: 28, losses: 5, streak: 6, rankName: 'Leyenda del Bastión', updatedAt: Date.now() },
  { name: 'Lady_Lyra', trophies: 620, wins: 21, losses: 7, streak: 3, rankName: 'Diamante Real', updatedAt: Date.now() },
  { name: 'Thorak_Pro', trophies: 460, wins: 15, losses: 6, streak: 2, rankName: 'Platino Solar', updatedAt: Date.now() },
  { name: 'Ignis_Master', trophies: 310, wins: 11, losses: 5, streak: 1, rankName: 'Paladín de Oro', updatedAt: Date.now() },
  { name: 'Sylva_Guard', trophies: 195, wins: 7, losses: 4, streak: 2, rankName: 'Escudero de Plata', updatedAt: Date.now() },
];

function loadLeaderboard(): LeaderboardEntry[] {
  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback to seed
  }
  return [...SEED_LEADERS];
}

function saveLeaderboard(entries: LeaderboardEntry[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries, null, 2));
  } catch {
    // ignore write errors
  }
}

let leaderboard: LeaderboardEntry[] = loadLeaderboard();

function upsertLeaderboard(entry: Partial<LeaderboardEntry> & { name: string }) {
  const cleanName = String(entry.name || 'Comandante').trim().slice(0, 20) || 'Comandante';
  const idx = leaderboard.findIndex(
    (e) => e.name.toLowerCase() === cleanName.toLowerCase()
  );
  const trophies = Math.max(0, Number(entry.trophies ?? 100));
  const updated: LeaderboardEntry = {
    name: cleanName,
    trophies,
    wins: Number(entry.wins ?? 0),
    losses: Number(entry.losses ?? 0),
    streak: Number(entry.streak ?? 0),
    rankName: getRankInfo(trophies).name,
    updatedAt: Date.now(),
  };

  if (idx >= 0) {
    // Keep highest trophies/stats
    leaderboard[idx] = {
      ...leaderboard[idx],
      ...updated,
    };
  } else {
    leaderboard.push(updated);
  }
  leaderboard.sort((a, b) => b.trophies - a.trophies);
  if (leaderboard.length > 30) leaderboard = leaderboard.slice(0, 30);
  saveLeaderboard(leaderboard);
}

// ==================== MULTIPLAYER ROOMS ====================
interface ClientConn {
  ws: WebSocket;
  playerId: PlayerId;
  name: string;
}

interface Room {
  code: string;
  arenaId: ArenaId;
  hostName: string;
  p1Team: HeroClassId[];
  p2Team: HeroClassId[] | null;
  clients: Partial<Record<PlayerId, ClientConn>>;
  state: GameState | null;
  status: 'waiting' | 'playing';
  createdAt: number;
}

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function send(ws: WebSocket | undefined, payload: unknown) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoom(room: Room, payload: unknown) {
  send(room.clients[1]?.ws, payload);
  send(room.clients[2]?.ws, payload);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, leaders: leaderboard.length });
});

app.get('/api/leaderboard', (_req, res) => {
  res.json({ leaderboard: leaderboard.slice(0, 20) });
});

app.post('/api/leaderboard/report', (req, res) => {
  const body = req.body || {};
  if (!body.name) {
    return res.status(400).json({ error: 'Nombre requerido' });
  }
  upsertLeaderboard(body);
  res.json({ leaderboard: leaderboard.slice(0, 20) });
});

app.get('/api/rooms', (_req, res) => {
  const list: RoomSummary[] = [];
  for (const r of rooms.values()) {
    if (r.status === 'waiting') {
      list.push({
        code: r.code,
        hostName: r.hostName,
        arenaId: r.arenaId,
        playersCount: (r.clients[1] ? 1 : 0) + (r.clients[2] ? 1 : 0),
        status: r.status,
      });
    }
  }
  res.json({ rooms: list });
});

const distDir = path.resolve(__dirname, '../dist');

app.get('/manifest.json', (_req, res) => {
  const manifestPath = path.join(distDir, 'manifest.webmanifest');
  if (fs.existsSync(manifestPath)) {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(manifestPath);
  }
  return res.status(404).end();
});

app.use(
  express.static(distDir, {
    dotfiles: 'allow',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('sw.js') || filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else if (filePath.endsWith('manifest.webmanifest') || filePath.endsWith('manifest.json')) {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.use((req, res, next) => {
  if (
    (req.method === 'GET' || req.method === 'HEAD') &&
    !req.path.startsWith('/api/') &&
    !req.path.startsWith('/ws') &&
    !path.extname(req.path)
  ) {
    const indexPath = path.join(distDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.sendFile(indexPath);
    }
  }
  next();
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  let currentRoom: Room | null = null;
  let currentPlayer: PlayerId | null = null;

  ws.on('message', (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, { type: 'ERROR', message: 'Mensaje inválido' });
    }

    if (msg.type === 'CREATE_ROOM') {
      const code = generateRoomCode();
      const playerName = String(msg.playerName || 'Anfitrión').slice(0, 20);
      const arenaId: ArenaId = msg.arenaId || 'sunlit_arena';
      const team: HeroClassId[] = Array.isArray(msg.team) && msg.team.length > 0
        ? msg.team.slice(0, 2)
        : ['vanguard', 'pyromancer'];

      const room: Room = {
        code,
        arenaId,
        hostName: playerName,
        p1Team: team,
        p2Team: null,
        clients: { 1: { ws, playerId: 1, name: playerName } },
        state: null,
        status: 'waiting',
        createdAt: Date.now(),
      };
      rooms.set(code, room);
      currentRoom = room;
      currentPlayer = 1;

      send(ws, {
        type: 'ROOM_CREATED',
        code,
        playerId: 1,
        arenaId,
        hostName: playerName,
      });
      return;
    }

    if (msg.type === 'JOIN_ROOM') {
      const code = String(msg.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        return send(ws, { type: 'ERROR', message: `Sala "${code}" no encontrada.` });
      }
      if (room.clients[2] && room.clients[2].ws.readyState === WebSocket.OPEN) {
        return send(ws, { type: 'ERROR', message: 'La sala ya está llena.' });
      }

      const playerName = String(msg.playerName || 'Retador').slice(0, 20);
      const team: HeroClassId[] = Array.isArray(msg.team) && msg.team.length > 0
        ? msg.team.slice(0, 2)
        : ['rogue', 'guardian'];

      room.p2Team = team;
      room.clients[2] = { ws, playerId: 2, name: playerName };
      room.status = 'playing';
      room.state = createInitialGameState({
        arenaId: room.arenaId,
        p1Team: room.p1Team,
        p2Team: room.p2Team,
        playerNames: {
          1: room.clients[1]?.name || 'Jugador 1',
          2: playerName,
        },
      });

      currentRoom = room;
      currentPlayer = 2;

      send(ws, {
        type: 'ROOM_JOINED',
        code,
        playerId: 2,
        arenaId: room.arenaId,
      });

      broadcastRoom(room, {
        type: 'GAME_STATE',
        state: room.state,
        events: [] as GameEvent[],
      });
      return;
    }

    if (msg.type === 'GAME_ACTION') {
      if (!currentRoom || !currentRoom.state || !currentPlayer) {
        return send(ws, { type: 'ERROR', message: 'No estás en una partida activa.' });
      }
      const action: GameAction = { ...msg.action, player: currentPlayer };
      const result = applyGameAction(currentRoom.state, action);
      if (result.error) {
        return send(ws, { type: 'ERROR', message: result.error });
      }
      currentRoom.state = result.state;
      broadcastRoom(currentRoom, {
        type: 'GAME_STATE',
        state: result.state,
        events: result.events,
      });
      return;
    }

    if (msg.type === 'REMATCH') {
      if (!currentRoom || !currentRoom.p2Team) return;
      currentRoom.state = createInitialGameState({
        arenaId: currentRoom.arenaId,
        p1Team: currentRoom.p1Team,
        p2Team: currentRoom.p2Team,
        playerNames: {
          1: currentRoom.clients[1]?.name || 'Jugador 1',
          2: currentRoom.clients[2]?.name || 'Jugador 2',
        },
      });
      broadcastRoom(currentRoom, {
        type: 'GAME_STATE',
        state: currentRoom.state,
        events: [],
      });
      return;
    }

    if (msg.type === 'CHAT') {
      if (!currentRoom || !currentPlayer) return;
      const text = String(msg.text || '').trim().slice(0, 140);
      if (!text) return;
      const sender = currentRoom.clients[currentPlayer]?.name || `Jugador ${currentPlayer}`;
      broadcastRoom(currentRoom, {
        type: 'CHAT_MESSAGE',
        playerId: currentPlayer,
        sender,
        text,
        timestamp: Date.now(),
      });
    }
  });

  ws.on('close', () => {
    if (currentRoom && currentPlayer) {
      delete currentRoom.clients[currentPlayer];
      const other: PlayerId = currentPlayer === 1 ? 2 : 1;
      send(currentRoom.clients[other]?.ws, {
        type: 'OPPONENT_STATUS',
        connected: false,
      });
      if (!currentRoom.clients[1] && !currentRoom.clients[2]) {
        rooms.delete(currentRoom.code);
      }
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (room.status === 'waiting' && now - room.createdAt > 30 * 60 * 1000) {
      rooms.delete(code);
    }
  }
}, 5 * 60 * 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`BASTION server listening on http://0.0.0.0:${PORT}`);
});
