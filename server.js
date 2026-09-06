require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eqvxurybiaroxkiwtodc.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: ws }
    })
  : null;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxdnh1cnliaWFyb3hraXd0b2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2ODI4MTIsImV4cCI6MjEwNDI1ODgxMn0.UcTOxpCXKOeZwNTcV--lD7sy_aCa3iSbnz8lWfbqiuA', {
  realtime: { transport: ws }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    game: 'Oryndel: Crown of Embers',
    serviceRole: !!supabaseAdmin,
    persistent: true
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxdnh1cnliaWFyb3hraXd0b2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2ODI4MTIsImV4cCI6MjEwNDI1ODgxMn0.UcTOxpCXKOeZwNTcV--lD7sy_aCa3iSbnz8lWfbqiuA'
  });
});

const loginAttempts = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, first: now };
  if (now - entry.first > 15 * 60 * 1000) {
    entry.count = 0;
    entry.first = now;
  }
  entry.count++;
  loginAttempts.set(ip, entry);
  return entry.count <= 15;
}

app.post('/api/auth-check', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
  }
  res.json({ ok: true });
});

app.post('/api/register', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
  }

  const { email, password } = req.body || {};
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email válido y contraseña de al menos 8 caracteres' });
  }

  try {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: email.split('@')[0] },
        emailRedirectTo: undefined
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (data.user && !data.session && supabaseAdmin) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
          email_confirm: true
        });
        const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (!loginErr && loginData.session) {
          return res.json({
            user: loginData.user,
            session: loginData.session,
            message: 'Cuenta creada e iniciada'
          });
        }
      } catch (_) {}
    }

    res.json({
      user: data.user,
      session: data.session,
      message: data.session
        ? 'Cuenta creada'
        : 'Cuenta creada. Si pide confirmación de email, actívala o desactiva Confirm email en Supabase.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al registrar' });
  }
});

app.post('/api/login', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) {
      return res.status(401).json({
        error: error.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos'
          : error.message
      });
    }
    res.json({ user: data.user, session: data.session });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al iniciar sesión' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Oryndel running on port ${PORT}`);
  console.log('Service role:', supabaseAdmin ? 'enabled' : 'not set (add SUPABASE_SERVICE_ROLE_KEY)');
});
