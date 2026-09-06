let currentUser = null;
let accessToken = null;

const authScreen = document.getElementById('auth-screen');
const charScreen = document.getElementById('char-screen');
const errorEl = document.getElementById('auth-error');
const charError = document.getElementById('char-error');

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {})
  };
}

function saveSession(user, session) {
  currentUser = user;
  accessToken = session?.access_token || null;
  if (accessToken) {
    localStorage.setItem('oryndel_token', accessToken);
    localStorage.setItem('oryndel_user', JSON.stringify(user));
  }
}

function clearSession() {
  currentUser = null;
  accessToken = null;
  localStorage.removeItem('oryndel_token');
  localStorage.removeItem('oryndel_user');
  sessionStorage.removeItem('oryndel_char');
  sessionStorage.removeItem('oryndel_session');
}

document.getElementById('btn-login').onclick = async () => {
  errorEl.textContent = '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || password.length < 8) {
    errorEl.textContent = 'Email válido y contraseña de al menos 8 caracteres';
    return;
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Error al iniciar sesión';
      return;
    }
    saveSession(data.user, data.session);
    showCharScreen();
  } catch (err) {
    errorEl.textContent = 'No se pudo conectar con el servidor';
  }
};

document.getElementById('btn-register').onclick = async () => {
  errorEl.textContent = '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || password.length < 8) {
    errorEl.textContent = 'Email válido y contraseña de al menos 8 caracteres';
    return;
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Error al crear la cuenta';
      return;
    }

    if (data.session) {
      saveSession(data.user, data.session);
      errorEl.textContent = '';
      showCharScreen();
    } else {
      errorEl.textContent = data.message || 'Cuenta creada. Ahora inicia sesión.';
    }
  } catch (err) {
    errorEl.textContent = 'No se pudo conectar con el servidor';
  }
};

document.getElementById('btn-logout').onclick = () => {
  clearSession();
  charScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
};

async function showCharScreen() {
  authScreen.classList.add('hidden');
  charScreen.classList.remove('hidden');
  await loadCharacters();
}

async function loadCharacters() {
  const list = document.getElementById('char-list');
  list.innerHTML = '';

  try {
    const res = await fetch('/api/characters', { headers: authHeaders() });
    if (!res.ok) {
      list.innerHTML = '<p style="color:#7a6a55">Error al cargar partidas.</p>';
      return;
    }
    const data = await res.json();

    if (!data || data.length === 0) {
      list.innerHTML = '<p style="color:#7a6a55">Aún no tienes partidas. ¡Crea tu héroe!</p>';
      return;
    }

    data.forEach(char => {
      const div = document.createElement('div');
      div.className = 'char-card';
      const place = char.map_id === 'valle_bruma' ? 'Valle de Bruma' : (char.map_id || 'Oryndel');
      div.innerHTML = `
        <span><strong>${char.name}</strong> — ${char.class} Lv.${char.level}<br>
        <small style="color:#8a7a65">${place}</small></span>
        <span style="color:#c4a35a">🪙 ${char.gold}</span>`;
      div.onclick = () => continueGame(char);
      list.appendChild(div);
    });
  } catch {
    list.innerHTML = '<p style="color:#7a6a55">Error de conexión.</p>';
  }
}

document.getElementById('btn-create-char').onclick = async () => {
  charError.textContent = '';
  const name = document.getElementById('char-name').value.trim();
  const cls = document.getElementById('char-class').value;

  if (!name || name.length < 3) {
    charError.textContent = 'El nombre debe tener al menos 3 caracteres';
    return;
  }

  try {
    const res = await fetch('/api/characters', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, class: cls })
    });
    const data = await res.json();
    if (!res.ok) {
      charError.textContent = data.error || 'Error al crear personaje';
      return;
    }
    continueGame(data);
  } catch {
    charError.textContent = 'No se pudo conectar';
  }
};

function continueGame(char) {
  sessionStorage.setItem('oryndel_char', JSON.stringify(char));
  sessionStorage.setItem('oryndel_user', currentUser.id);
  if (accessToken) {
    sessionStorage.setItem('oryndel_token', accessToken);
  }
  window.location.href = '/overworld.html';
}

(async () => {
  const token = localStorage.getItem('oryndel_token');
  const userRaw = localStorage.getItem('oryndel_user');
  if (!token || !userRaw) return;

  accessToken = token;
  try {
    const res = await fetch('/api/me', { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      showCharScreen();
    } else {
      clearSession();
    }
  } catch {
    try {
      currentUser = JSON.parse(userRaw);
      showCharScreen();
    } catch {
      clearSession();
    }
  }
})();
