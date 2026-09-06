function getCharacter() {
  const raw = sessionStorage.getItem('oryndel_char') || sessionStorage.getItem('eldoria_char');
  if (!raw) {
    window.location.href = '/';
    return null;
  }
  return JSON.parse(raw);
}

function saveCharacterLocal(char) {
  sessionStorage.setItem('oryndel_char', JSON.stringify(char));
}

function getToken() {
  return sessionStorage.getItem('oryndel_token') || localStorage.getItem('oryndel_token') || '';
}

async function saveCharacterDB(char) {
  saveCharacterLocal(char);
  const token = getToken();
  if (!token) return;

  try {
    await fetch('/api/characters/' + char.id, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({
        position_x: char.position_x,
        position_y: char.position_y,
        map_id: char.map_id,
        health: char.health,
        mana: char.mana,
        max_health: char.max_health,
        max_mana: char.max_mana,
        gold: char.gold,
        level: char.level,
        xp: char.xp,
        inventory: typeof char.inventory === 'string' ? JSON.parse(char.inventory) : (char.inventory || []),
        equipment: typeof char.equipment === 'string' ? JSON.parse(char.equipment) : (char.equipment || {}),
        stats: char.stats
      })
    });
  } catch (_) {}
}

function updateUI(char) {
  const nameEl = document.getElementById('ui-name');
  const levelEl = document.getElementById('ui-level');
  const hpEl = document.getElementById('ui-hp');
  const goldEl = document.getElementById('ui-gold');
  if (nameEl) nameEl.textContent = char.name;
  if (levelEl) levelEl.textContent = `Lv.${char.level}`;
  if (hpEl) hpEl.textContent = `HP ${char.health}/${char.max_health}`;
  if (goldEl) goldEl.textContent = `🪙 ${char.gold}`;
}

let dialogueQueue = [];
let dialogueCallback = null;

function showDialogue(lines, onComplete) {
  dialogueQueue = Array.isArray(lines) ? [...lines] : [lines];
  dialogueCallback = onComplete || null;
  const box = document.getElementById('dialogue-box');
  const text = document.getElementById('dialogue-text');
  if (!box || !text) return;
  box.classList.add('visible');
  text.textContent = dialogueQueue.shift();
}

function advanceDialogue() {
  const box = document.getElementById('dialogue-box');
  const text = document.getElementById('dialogue-text');
  if (!box || !box.classList.contains('visible')) return false;

  if (dialogueQueue.length > 0) {
    text.textContent = dialogueQueue.shift();
    return true;
  }
  box.classList.remove('visible');
  if (dialogueCallback) {
    const cb = dialogueCallback;
    dialogueCallback = null;
    cb();
  }
  return true;
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    if (advanceDialogue()) e.preventDefault();
  }
});

document.getElementById('dialogue-box')?.addEventListener('click', () => advanceDialogue());
