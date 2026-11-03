// ===== 共通：状態・サウンド・入力・ウィンドウ =====
const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let G = null; // ゲーム状態
const SAVE_KEY = 'kirinoshima_save_v1';

function newGame() {
  G = {
    party: [makeMember('ao', 1)],
    gold: 30,
    items: { herb: 3 },
    found: 0, placed: 0,
    flags: {},
    map: 'town:minato', x: 7, y: 9, dir: 'up',
    steps: 0, nextEnc: 12,
  };
}

function makeMember(id, lv) {
  const m = { id, lv: 1, exp: 0, wpn: null, arm: null };
  m.lv = lv; m.exp = expFor(lv);
  m.hp = maxStat(m, 'hp'); m.mp = maxStat(m, 'mp');
  return m;
}
const expFor = (lv) => (lv <= 1 ? 0 : Math.floor(8 * Math.pow(lv - 1, 2.25) + 6 * (lv - 1)));
function maxStat(m, k) {
  const c = CHARS[m.id];
  return c.base[k] + c.grow[k] * (m.lv - 1);
}
function stat(m, k) {
  let v = maxStat(m, k);
  if (k === 'atk' && m.wpn) v += ITEMS[m.wpn].pow;
  if (k === 'def' && m.arm) v += ITEMS[m.arm].pow;
  return v;
}
const spellsOf = (m) => CHARS[m.id].learn.filter(([lv]) => m.lv >= lv).map(([, s]) => s);
const alive = (list) => list.filter((m) => m.hp > 0);

function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); return true; } catch (e) { return false; }
}
function loadGame() {
  try { const s = localStorage.getItem(SAVE_KEY); if (s) { G = JSON.parse(s); return true; } } catch (e) {}
  return false;
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }

// ---------- サウンド（WebAudioで生成） ----------
const Sound = {
  ctx: null, on: true,
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  tone(f, d, type = 'square', vol = 0.06, delay = 0, slide = 0) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + d + 0.02);
  },
  play(n) {
    const T = this.tone.bind(this);
    switch (n) {
      case 'cursor': T(880, 0.04, 'square', 0.03); break;
      case 'ok': T(660, 0.05); T(990, 0.06, 'square', 0.05, 0.05); break;
      case 'cancel': T(440, 0.06, 'square', 0.04, 0, -150); break;
      case 'bump': T(110, 0.06, 'square', 0.05); break;
      case 'hit': T(200, 0.12, 'sawtooth', 0.08, 0, -150); break;
      case 'hurt': T(120, 0.2, 'square', 0.09, 0, -60); break;
      case 'crit': T(300, 0.08, 'sawtooth', 0.09); T(150, 0.2, 'sawtooth', 0.09, 0.07, -100); break;
      case 'magic': [0, 1, 2, 3, 4].forEach((i) => T(500 + i * 180, 0.07, 'triangle', 0.06, i * 0.04)); break;
      case 'heal': [0, 1, 2].forEach((i) => T(700 + i * 260, 0.12, 'sine', 0.08, i * 0.07)); break;
      case 'enc': [0, 1, 2, 3, 4, 5].forEach((i) => T(i % 2 ? 300 : 600, 0.06, 'square', 0.05, i * 0.05)); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => T(f, 0.18, 'square', 0.05, i * 0.12)); break;
      case 'lvup': [523, 523, 523, 698, 880, 1047].forEach((f, i) => T(f, 0.16, 'square', 0.05, i * 0.11)); break;
      case 'item': [784, 988, 1175].forEach((f, i) => T(f, 0.12, 'triangle', 0.07, i * 0.09)); break;
      case 'stairs': [400, 300, 200].forEach((f, i) => T(f, 0.08, 'square', 0.05, i * 0.07)); break;
      case 'star': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => T(f, 0.3, 'sine', 0.07, i * 0.15)); break;
      case 'dead': [392, 330, 262, 196].forEach((f, i) => T(f, 0.3, 'triangle', 0.08, i * 0.25)); break;
    }
  },
};

// ---------- 入力 ----------
const Input = {
  held: {}, handlers: [],
  push(h) { this.handlers.push(h); },
  pop(h) { const i = this.handlers.lastIndexOf(h); if (i >= 0) this.handlers.splice(i, 1); },
  press(k) {
    Sound.init();
    const h = this.handlers[this.handlers.length - 1];
    if (h) h(k);
    else if (window.onFreePress) window.onFreePress(k);
  },
  dir() { for (const d of ['up', 'down', 'left', 'right']) if (this.held[d]) return d; return null; },
};

function setupInput() {
  const keymap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right',
    z: 'a', Enter: 'a', ' ': 'a', x: 'b', Escape: 'b', Backspace: 'b' };
  addEventListener('keydown', (e) => {
    const k = keymap[e.key]; if (!k) return;
    e.preventDefault();
    if (['up', 'down', 'left', 'right'].includes(k)) { if (!Input.held[k]) { Input.held[k] = true; Input.press(k); } }
    else if (!e.repeat) Input.press(k);
  });
  addEventListener('keyup', (e) => { const k = keymap[e.key]; if (k) Input.held[k] = false; });

  document.querySelectorAll('[data-key]').forEach((el) => {
    const k = el.dataset.key;
    const down = (e) => { e.preventDefault(); el.classList.add('on'); if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) {}
      if (['up', 'down', 'left', 'right'].includes(k)) { for (const d in Input.held) Input.held[d] = false; Input.held[k] = true; }
      Input.press(k); };
    const up = (e) => { e.preventDefault(); el.classList.remove('on'); Input.held[k] = false; };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  });
  // 画面タップでメッセージ送り
  $('#screen').addEventListener('pointerdown', (e) => {
    if (e.target.closest('.win.menu')) return;
    const h = Input.handlers[Input.handlers.length - 1];
    if (h && h.isMsg) { e.preventDefault(); Input.press('a'); }
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---------- メッセージウィンドウ ----------
let msgLines = [];
function showMsg(on) { $('#msg').hidden = !on; }
function renderMsg(extra) { $('#msgtext').textContent = msgLines.join('\n') + (extra || ''); }

// 文字送りして、Aボタン待ち（auto指定時は時間で自動送り）
function say(text, opts = {}) {
  return new Promise((resolve) => {
    showMsg(true);
    if (!opts.append) msgLines = [];
    const lines = String(text).split('\n');
    const base = msgLines.slice();
    let full = lines.join('\n'), i = 0, done = false, timer;
    const arrow = $('#msgnext');
    arrow.hidden = true;
    const finishType = () => {
      done = true; clearInterval(timer);
      msgLines = base.concat(lines); while (msgLines.length > 5) msgLines.shift();
      renderMsg();
      if (opts.auto != null) { setTimeout(close, opts.auto); } else arrow.hidden = false;
    };
    const close = () => { Input.pop(h); arrow.hidden = true; resolve(); };
    const h = (k) => {
      if (k !== 'a' && k !== 'b') return;
      if (!done) finishType();
      else if (opts.auto == null) { Sound.play('cursor'); close(); }
    };
    h.isMsg = true;
    Input.push(h);
    timer = setInterval(() => {
      i += 2;
      const shown = full.slice(0, i).split('\n');
      const tmp = base.concat(shown); while (tmp.length > 5) tmp.shift();
      $('#msgtext').textContent = tmp.join('\n');
      if (i >= full.length) finishType();
    }, 22);
  });
}
async function talk(...pages) { for (const p of pages) await say(p); showMsg(false); }

// ---------- 選択メニュー ----------
// items: [{label, right?, disabled?}] / pos: {top,left,right,bottom,width}
function choose(items, pos = {}, opts = {}) {
  return new Promise((resolve) => {
    const win = document.createElement('div');
    win.className = 'win menu';
    if (opts.title) { const t = document.createElement('div'); t.className = 'wtitle'; t.textContent = opts.title; win.appendChild(t); }
    Object.assign(win.style, pos);
    const list = document.createElement('div'); list.className = 'mlist';
    if (opts.cols) list.style.gridTemplateColumns = `repeat(${opts.cols},1fr)`;
    win.appendChild(list);
    let cur = clamp(opts.start || 0, 0, items.length - 1);
    const els = items.map((it, idx) => {
      const b = document.createElement('button');
      b.className = 'mi' + (it.disabled ? ' dis' : '');
      b.innerHTML = `<span class="l"></span><span class="r"></span>`;
      b.querySelector('.l').textContent = it.label;
      b.querySelector('.r').textContent = it.right || '';
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Sound.init(); cur = idx; upd(); select(); });
      list.appendChild(b); return b;
    });
    const upd = () => { els.forEach((e, i) => e.classList.toggle('cur', i === cur)); els[cur] && els[cur].scrollIntoView({ block: 'nearest' }); if (opts.onMove) opts.onMove(cur); };
    const end = (v) => { Input.pop(h); win.remove(); resolve(v); };
    const select = () => { if (items[cur].disabled) { Sound.play('bump'); return; } Sound.play('ok'); end(cur); };
    const cols = opts.cols || 1;
    const h = (k) => {
      if (k === 'up') cur = (cur - cols + items.length) % items.length;
      else if (k === 'down') cur = (cur + cols) % items.length;
      else if (k === 'left' && cols > 1) cur = (cur - 1 + items.length) % items.length;
      else if (k === 'right' && cols > 1) cur = (cur + 1) % items.length;
      else if (k === 'a') return select();
      else if (k === 'b') { if (opts.noCancel) return; Sound.play('cancel'); return end(-1); }
      else return;
      Sound.play('cursor'); upd();
    };
    Input.push(h);
    $('#layer').appendChild(win);
    upd();
  });
}

// ---------- パーティ表示 ----------
function renderStatus(show = true) {
  const el = $('#status');
  el.hidden = !show;
  if (!show) return;
  el.innerHTML = '';
  for (const m of G.party) {
    const c = CHARS[m.id];
    const d = document.createElement('div');
    d.className = 'pm' + (m.hp <= 0 ? ' dead' : m.hp < maxStat(m, 'hp') / 4 ? ' low' : '');
    d.innerHTML = `<div class="nm"><span></span><span class="lv">Lv${m.lv}</span></div><div class="hm"><span>H<b>${m.hp}</b></span><span>M<b>${m.mp}</b></span></div>`;
    d.querySelector('.nm span').textContent = c.name;
    el.appendChild(d);
  }
}
function hideAllWindows() { showMsg(false); renderStatus(false); $('#layer').innerHTML = ''; }
