require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    }
  } catch (_) {}
  return { users: {}, characters: {}, sessions: {} };
}

function saveStore(store) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 0), 'utf8');
}

let store = loadStore();

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  store.sessions[token] = {
    userId,
    created: Date.now(),
    expires: Date.now() + 30 * 24 * 60 * 60 * 1000
  };
  saveStore(store);
  return token;
}

function getUserFromToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.body && req.body.token) || req.query.token;
  if (!token) return null;
  const session = store.sessions[token];
  if (!session || session.expires < Date.now()) return null;
  const user = store.users[session.userId];
  if (!user) return null;
  return { user, token, userId: session.userId };
}

const attempts = new Map();
function rateOk(ip) {
  const now = Date.now();
  const e = attempts.get(ip) || { count: 0, first: now };
  if (now - e.first > 15 * 60 * 1000) {
    e.count = 0;
    e.first = now;
  }
  e.count++;
  attempts.set(ip, e);
  return e.count <= 20;
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', game: 'Oryndel: Crown of Embers', auth: 'local', persistent: true });
});

app.get('/api/config', (req, res) => {
  res.json({ authMode: 'local' });
});

app.post('/api/register', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!rateOk(ip)) return res.status(429).json({ error: 'Demasiados intentos. Espera un poco.' });

  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email no válido' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  const exists = Object.values(store.users).find(u => u.email === email);
  if (exists) {
    return res.status(400).json({ error: 'Ese email ya está registrado' });
  }

  const id = uuidv4();
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);

  store.users[id] = { id, email, salt, hash, created_at: new Date().toISOString() };
  saveStore(store);

  const token = createSession(id);
  res.json({
    user: { id, email },
    session: { access_token: token, refresh_token: token },
    message: 'Cuenta creada'
  });
});

app.post('/api/login', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!rateOk(ip)) return res.status(429).json({ error: 'Demasiados intentos. Espera un poco.' });

  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  const user = Object.values(store.users).find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  }

  const hash = hashPassword(password, user.salt);
  if (hash !== user.hash) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  }

  const token = createSession(user.id);
  res.json({
    user: { id: user.id, email: user.email },
    session: { access_token: token, refresh_token: token }
  });
});

app.get('/api/me', (req, res) => {
  const auth = getUserFromToken(req);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });
  res.json({ user: { id: auth.user.id, email: auth.user.email } });
});

app.get('/api/characters', (req, res) => {
  const auth = getUserFromToken(req);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });

  const list = Object.values(store.characters)
    .filter(c => c.user_id === auth.userId)
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

  res.json(list);
});

app.post('/api/characters', (req, res) => {
  const auth = getUserFromToken(req);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });

  const name = (req.body.name || '').trim();
  const cls = req.body.class || 'warrior';

  if (!name || name.length < 3) {
    return res.status(400).json({ error: 'El nombre debe tener al menos 3 caracteres' });
  }

  const taken = Object.values(store.characters).find(
    c => c.user_id === auth.userId && c.name.toLowerCase() === name.toLowerCase()
  );
  if (taken) {
    return res.status(400).json({ error: 'Ese nombre ya existe' });
  }

  const id = uuidv4();
  const char = {
    id,
    user_id: auth.userId,
    name,
    class: cls,
    level: 1,
    xp: 0,
    health: 100,
    max_health: 100,
    mana: 40,
    max_mana: 40,
    position_x: 320,
    position_y: 280,
    map_id: 'valle_bruma',
    gold: 20,
    inventory: [
      { id: 'iron_blade', name: 'Hoja de Hierro Viejo', type: 'weapon', power: 6 },
      { id: 'ember_herb', name: 'Hierba de Brasas', type: 'consumable', heal: 35, qty: 3 }
    ],
    equipment: { weapon: 'iron_blade' },
    stats: { str: 12, agi: 10, int: 8, vit: 11 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  store.characters[id] = char;
  saveStore(store);
  res.json(char);
});

app.put('/api/characters/:id', (req, res) => {
  const auth = getUserFromToken(req);
  if (!auth) return res.status(401).json({ error: 'No autenticado' });

  const char = store.characters[req.params.id];
  if (!char || char.user_id !== auth.userId) {
    return res.status(404).json({ error: 'Personaje no encontrado' });
  }

  const fields = [
    'position_x', 'position_y', 'map_id', 'health', 'mana', 'max_health', 'max_mana',
    'gold', 'level', 'xp', 'inventory', 'equipment', 'stats'
  ];
  fields.forEach(f => {
    if (req.body[f] !== undefined) char[f] = req.body[f];
  });
  char.updated_at = new Date().toISOString();
  store.characters[char.id] = char;
  saveStore(store);
  res.json(char);
});

app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(500).send('Missing public/index.html — redeploy with full repo');
});

server.listen(PORT, () => {
  console.log(`Oryndel running on port ${PORT}`);
  console.log('Auth: LOCAL (no Supabase required)');
  console.log('Saves in ./data/store.json');
});
