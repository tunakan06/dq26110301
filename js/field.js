// ===== フィールド：マップ生成・描画・移動・イベント =====
const TS = 16, VIEW = 11;
const cv = () => $('#cv');
let ctx;

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- ワールドマップ生成 ----------
const MAPS = {};
function buildWorld() {
  const W = 40, H = 30;
  const t = Array.from({ length: H }, () => Array(W).fill('~'));
  const reg = Array.from({ length: H }, () => Array(W).fill(0));
  const isl = [
    { cx: 20, cy: 22, rx: 7.5, ry: 5.2, g: '.', r: 0 },
    { cx: 7, cy: 14, rx: 5.5, ry: 6.2, g: '.', r: 1 },
    { cx: 32, cy: 9, rx: 6.5, ry: 5.2, g: '*', r: 2 },
    { cx: 19, cy: 5, rx: 4.6, ry: 3.4, g: 'x', r: 3 },
  ];
  for (const s of isl) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = ((x - s.cx) / s.rx) ** 2 + ((y - s.cy) / s.ry) ** 2;
    if (d <= 1) {
      let c = s.g;
      if (d > 0.72 && s.r !== 3) c = s.r === 2 ? '*' : ',';
      else if (s.r === 1 && (x * 7 + y * 13) % 3 !== 0) c = 'T';
      else if (s.r === 0 && (x * 7 + y * 13) % 6 === 0) c = 'T';
      else if (s.r === 2 && (x * 5 + y * 11) % 5 === 0) c = 'T';
      t[y][x] = c; reg[y][x] = s.r;
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let best = 0, bd = 1e9;
    isl.forEach((s, i) => { const d = (x - s.cx) ** 2 + (y - s.cy) ** 2; if (d < bd) { bd = d; best = i; } });
    if (t[y][x] === '~') reg[y][x] = best;
  }
  const bridge = (x1, y1, x2, y2, ch) => {
    let x = x1, y = y1;
    const put = () => { if (t[y][x] === '~') t[y][x] = ch; };
    put();
    while (x !== x2) { x += Math.sign(x2 - x); put(); }
    while (y !== y2) { y += Math.sign(y2 - y); put(); }
  };
  bridge(14, 22, 10, 17, '1');
  bridge(26, 19, 30, 13, '2');
  bridge(20, 17, 19, 8, '3');
  const places = { V: [18, 22], C: [25, 23], H: [7, 17], W: [4, 10], S: [30, 10], I: [35, 7], K: [19, 4] };
  // ところどころに山（特別な場所や橋のそばは避ける）
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if ('.T,*x'.indexOf(t[y][x]) < 0 || (x * 13 + y * 7) % 11 !== 0) continue;
    let near = false;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if ('123~'.includes(t[y + dy][x + dx])) near = true;
    for (const k in places) { const [px, py] = places[k]; if (Math.abs(px - x) + Math.abs(py - y) <= 2) near = true; }
    if (!near) t[y][x] = '^';
  }
  for (const k in places) {
    const [x, y] = places[k];
    t[y][x] = k;
    const g = reg[y][x] === 2 ? '*' : reg[y][x] === 3 ? 'x' : '.';
    if (!'.T,*x'.includes(t[y + 1][x])) t[y + 1][x] = g; else t[y + 1][x] = g;
  }
  MAPS.world = { kind: 'world', w: W, h: H, t, reg, places };
}

const TOWN_TPL = [
  '###############',
  '#.............#',
  '#.BBB.....BBB.#',
  '#.BBB.....BBB.#',
  '#.............#',
  '#.....~~~.....#',
  '#.T...~~~...T.#',
  '#.............#',
  '#.BBB.....BBB.#',
  '#.BBB.....BBB.#',
  '#.............#',
  '#######E#######',
];
function buildTowns() {
  for (const id in TOWNS) MAPS['town:' + id] = { kind: 'town', id, w: 15, h: 12, t: TOWN_TPL.map((r) => r.split('')), town: TOWNS[id] };
}

function buildDungeon(id) {
  const D = DUNGEONS[id], N = 19, R = mulberry(D.seed);
  const t = Array.from({ length: N }, () => Array(N).fill('#'));
  const st = [[9, 17]]; t[17][9] = '.';
  while (st.length) {
    const [x, y] = st[st.length - 1];
    const nb = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dy]) => [x + dx, y + dy, dx, dy])
      .filter(([nx, ny]) => nx > 0 && ny > 0 && nx < N - 1 && ny < N - 1 && t[ny][nx] === '#');
    if (!nb.length) { st.pop(); continue; }
    const [nx, ny, dx, dy] = nb[Math.floor(R() * nb.length)];
    t[y + dy / 2][x + dx / 2] = '.'; t[ny][nx] = '.'; st.push([nx, ny]);
  }
  for (let k = 0; k < 9; k++) { // ループを少し作る
    const x = 1 + Math.floor(R() * (N - 2)), y = 1 + Math.floor(R() * (N - 2));
    if (t[y][x] === '#' && ((x % 2 === 1 && y % 2 === 0) || (x % 2 === 0 && y % 2 === 1))) t[y][x] = '.';
  }
  t[18][9] = 'E';
  // 行き止まりに宝箱
  const dist = Array.from({ length: N }, () => Array(N).fill(-1)); const q = [[9, 17]]; dist[17][9] = 0;
  while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (t[ny] && t[ny][nx] === '.' && dist[ny][nx] < 0) { dist[ny][nx] = dist[y][x] + 1; q.push([nx, ny]); } } }
  const ends = [];
  for (let y = 1; y < N - 1; y += 2) for (let x = 1; x < N - 1; x += 2) {
    if (t[y][x] !== '.' || (x === 9 && (y === 1 || y === 17))) continue;
    const c = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => t[y + dy][x + dx] !== '#').length;
    if (c === 1) ends.push([x, y, dist[y][x]]);
  }
  ends.sort((a, b) => b[2] - a[2]);
  const chests = D.chests.map((item, i) => ends[i] ? { x: ends[i][0], y: ends[i][1], item } : null).filter(Boolean);
  // ボスの間：迷路の上に専用の小部屋を作り、ボスが通路をふさがないようにする
  const room = Array(N).fill('#'); room[9] = '.';
  t[0][9] = '.';
  t.unshift(room); t.unshift(Array(N).fill('#'));
  chests.forEach((c) => (c.y += 2));
  MAPS['dun:' + id] = { kind: 'dun', id, w: N, h: N + 2, t, chests, D };
}

function buildAll() { buildWorld(); buildTowns(); for (const id in DUNGEONS) buildDungeon(id); }
const curMap = () => MAPS[G.map];

// ---------- 通行判定 ----------
function tileAt(m, x, y) { return x < 0 || y < 0 || x >= m.w || y >= m.h ? (m.kind === 'world' ? '~' : '#') : m.t[y][x]; }
function passable(m, x, y) {
  const c = tileAt(m, x, y);
  if (m.kind === 'world') {
    if ('123'.includes(c)) return G.placed >= +c;
    return '.T,*x=VHSCWIK'.includes(c);
  }
  if (c !== '.' && c !== 'E') return false;
  if (npcAt(x, y)) return false;
  if (m.kind === 'dun') {
    if (m.chests.some((ch) => ch.x === x && ch.y === y)) return false;
    if (x === 9 && y === 1 && !G.flags['boss_' + m.id]) return false;
  }
  return true;
}

// ---------- 町の人々 ----------
function npcsOf(m) {
  if (m.kind !== 'town') return [];
  return (TOWN_NPCS[m.id] || []).filter((n) => !n.hide || !n.hide());
}
function npcAt(x, y) { const m = curMap(); return npcsOf(m).find((n) => n.x === x && n.y === y); }

async function innTalk(price) {
  await say(`たびびとの やどへ ようこそ。\nひとばん ${price}ゴールドですが とまりますか？`);
  const r = await choose([{ label: 'はい' }, { label: 'いいえ' }], { right: '8%', bottom: '40%' });
  if (r !== 0) return talk('またの おこしを。');
  if (G.gold < price) return talk('おかねが たりないようですね。');
  G.gold -= price;
  await fade(true); Sound.play('heal');
  G.party.forEach((p) => { p.hp = maxStat(p, 'hp'); p.mp = maxStat(p, 'mp'); });
  await wait(700); await fade(false);
  saveGame();
  return talk('おはようございます。\nゆっくり やすめましたか？（きろくしました）');
}

async function shopTalk(list) {
  await say('いらっしゃい！ なにを かうかね？');
  let start = 0;
  for (;;) {
    renderGold(true);
    const r = await choose(list.map((id) => ({ label: ITEMS[id].name, right: ITEMS[id].price + 'G' })), { left: '4%', top: '4%', width: '60%' }, { title: 'かう', start });
    if (r < 0) break;
    start = r;
    const id = list[r], it = ITEMS[id];
    if (G.gold < it.price) { await say('おかねが たりないよ。'); continue; }
    if (it.type === 'wpn' || it.type === 'arm') {
      await say(`${it.name} だね。だれが そうびする？`);
      const who = await choose(G.party.map((p) => { const cur = p[it.type]; return { label: CHARS[p.id].name, right: cur ? `${ITEMS[cur].pow}→${it.pow}` : `0→${it.pow}` }; }), { right: '4%', top: '4%', width: '50%' });
      if (who < 0) continue;
      G.gold -= it.price; G.party[who][it.type] = id; Sound.play('item');
      await say(`${CHARS[G.party[who].id].name}は ${it.name}を そうびした！`);
    } else {
      G.gold -= it.price; G.items[id] = (G.items[id] || 0) + 1; Sound.play('item');
      await say(`${it.name}を かった！ ほかにも なにか かうかね？`);
    }
  }
  renderGold(false);
  return talk('まいどあり！');
}
function renderGold(on) { const g = $('#gold'); g.hidden = !on; g.textContent = `${G.gold} G`; }

async function placeFragments() {
  if (G.found > G.placed) {
    await say('アオは ほしのかけらを さいだんに おいた。');
    Sound.play('star');
    $('#screen').classList.add('flash'); await wait(900); $('#screen').classList.remove('flash');
    G.placed = G.found;
    const names = ['', 'にしの ハナミじま', 'きたひがしの シモツキじま', 'きたの きりのしま'];
    await say(`さいだんから ひかりが あふれだす！\n${names[G.placed]}への きりの はしが あらわれた！`);
    saveGame();
    return talk('ほしの ちからで きりが はれていく……。（きろくしました）');
  }
  return talk('ほしのさいだん だ。\nくぼみが 3つ ならんでいる。' + (G.placed ? `\n${G.placed}つ ひかっている。` : ''));
}

const TOWN_NPCS = {
  minato: [
    { x: 7, y: 1, look: 'altar', talk: placeFragments },
    { x: 7, y: 7, look: { body: '#7a5c9e', hair: '#ddd' }, talk: async () => {
      if (G.placed === 0 && G.found === 0) return talk('ちょうろう「アオよ。むかし このうみには\nたくさんの しまが あったという。', 'ちょうろう「だが きりのおうが あらわれ\nしまじまは しろい きりに しずんだ。', 'ちょうろう「ひがしの しおさいのほら穴に\nほしのかけらが ねむると きく。', 'ちょうろう「かけらを むらの きたの\nほしのさいだんに ささげておくれ。');
      if (G.found > G.placed) return talk('ちょうろう「おお、それは ほしのかけら！\nはやく さいだんへ！');
      if (G.placed === 1) return talk('ちょうろう「にしに はしが かかった。\nハナミじまの ひとびとを たのむぞ。');
      if (G.placed === 2) return talk('ちょうろう「きたひがしの こおりのしまに\nつぎの かけらが あるはずじゃ。');
      return talk('ちょうろう「きたの しまに きりのしろが みえる。\nこころして いくのじゃぞ。');
    } },
    { x: 3, y: 4, look: { body: '#4b7a4b', hair: '#5a3a1a' }, talk: () => innTalk(TOWNS.minato.inn) },
    { x: 11, y: 4, look: { body: '#c08a2a', hair: '#333' }, talk: () => shopTalk(TOWNS.minato.shop) },
    { x: 11, y: 10, look: { body: '#d0607a', hair: '#7a3a1a' }, talk: () => talk('おかあさん「アオ、たびに でるなら\nやくそうを わすれずにね。', 'おかあさん「つかれたら やどやで やすむのよ。\nやすむと ぼうけんも きろくされるわ。') },
    { x: 3, y: 10, look: { body: '#3a8ab0', hair: '#222' }, talk: () => talk('こども「Bボタンで メニューが ひらけるよ！\nセーブも できるんだって。') },
  ],
  hanami: [
    { x: 7, y: 7, look: { body: '#4a7a3a', hair: '#ddd' }, talk: () => G.flags.boss_tower ? talk('おさ「もりが いきを ふきかえした。\nありがとう、うみのこよ。') : talk('おさ「きりから すくわれた とおもったら\nみどりのとうの ヤドリギが あばれだした。', 'おさ「とうは しまの きたにしに ある。\nどうか しずめておくれ。') },
    { x: 10, y: 7, look: { body: CHARS.rina.color, hair: CHARS.rina.hair }, hide: () => G.flags.rina, talk: async () => {
      await talk('？？？「あなた、きりの はしを わたってきたの？', 'リナ「わたしは リナ。まほうの しゅぎょう中なの。\nあなたの たび、てつだわせて！');
      const lv = Math.max(1, G.party[0].lv - 1);
      G.party.push(makeMember('rina', lv)); G.flags.rina = 1; Sound.play('lvup');
      await talk('リナが なかまに くわわった！');
    } },
    { x: 3, y: 4, look: { body: '#4b7a4b', hair: '#5a3a1a' }, talk: () => innTalk(TOWNS.hanami.inn) },
    { x: 11, y: 4, look: { body: '#c08a2a', hair: '#333' }, talk: () => shopTalk(TOWNS.hanami.shop) },
    { x: 4, y: 10, look: { body: '#c06a9a', hair: '#e8c35a' }, talk: () => talk('むすめ「キノコの まものは かたいけど\nまほうには よわいみたい。') },
  ],
  shimo: [
    { x: 7, y: 7, look: { body: '#5a6a9a', hair: '#eee' }, talk: () => G.flags.boss_ice ? talk('むらおさ「ふぶきが やんだ……！\nきたの しまへ いそぐのだ。') : talk('むらおさ「ひがしの こおりのどうくつに\nひょうりゅうが すみついて しまった。', 'むらおさ「ほのおの まほうが よく きくぞ。') },
    { x: 10, y: 7, look: { body: CHARS.gant.color, hair: CHARS.gant.hair }, hide: () => G.flags.gant, talk: async () => {
      await talk('？？？「ほう、きりを はらう わかものか。', 'ガント「おれは ガント。むらを まもる せんしだ。\nりゅうたいじ、おれも いこう！');
      const lv = Math.max(1, G.party[0].lv - 1);
      G.party.push(makeMember('gant', lv)); G.flags.gant = 1; Sound.play('lvup');
      await talk('ガントが なかまに くわわった！');
    } },
    { x: 3, y: 4, look: { body: '#4b7a4b', hair: '#5a3a1a' }, talk: () => innTalk(TOWNS.shimo.inn) },
    { x: 11, y: 4, look: { body: '#c08a2a', hair: '#333' }, talk: () => shopTalk(TOWNS.shimo.shop) },
    { x: 11, y: 10, look: { body: '#7aa0c8', hair: '#333' }, talk: () => talk('りょうし「いのちのはねは たかいけど\nたおれた なかまを たすけられるぞ。') },
  ],
};

// ---------- 移動 ----------
const P = { moving: false, fx: 0, fy: 0, t: 0, frame: 0 };
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
let busy = false;

function tryMove(d) {
  G.dir = d;
  const m = curMap(), [dx, dy] = DIRS[d], nx = G.x + dx, ny = G.y + dy;
  if (!passable(m, nx, ny)) {
    if (m.kind === 'dun' && nx === 9 && ny === 1 && !G.flags['boss_' + m.id]) return runEvent(bossEvent);
    if (!P.bumpT || performance.now() - P.bumpT > 300) { Sound.play('bump'); P.bumpT = performance.now(); }
    return;
  }
  P.moving = true; P.fx = G.x; P.fy = G.y; P.t = 0; G.x = nx; G.y = ny;
}

function onStep() {
  const m = curMap(), c = tileAt(m, G.x, G.y);
  if (m.kind === 'world') {
    const T = { V: 'town:minato', H: 'town:hanami', S: 'town:shimo' }[c];
    if (T) return runEvent(() => goTo(T, 7, 10, 'up'));
    const D = { C: 'cave', W: 'tower', I: 'ice', K: 'castle' }[c];
    if (D) return runEvent(() => goTo('dun:' + D, 9, 19, 'up', DUNGEONS[D].name));
  } else if (c === 'E') {
    return runEvent(leaveToWorld);
  }
  // エンカウント
  const zone = m.kind === 'dun' ? (c === '.') : '.T,*x'.includes(c);
  if (!zone) return;
  G.steps += c === 'T' ? 1.5 : 1;
  if (G.steps >= G.nextEnc) {
    G.steps = 0; G.nextEnc = 10 + rnd(16);
    const region = m.kind === 'dun' ? m.D.region : m.reg[G.y][G.x];
    const pool = REGIONS[region].enc;
    const n = 1 + rnd(Math.min(3, 1 + G.party.length));
    const ids = Array.from({ length: n }, () => pick(pool));
    runEvent(() => doBattle(ids, { region }));
  }
}

async function leaveToWorld() {
  const w = MAPS.world, key = { 'town:minato': 'V', 'town:hanami': 'H', 'town:shimo': 'S', 'dun:cave': 'C', 'dun:tower': 'W', 'dun:ice': 'I', 'dun:castle': 'K' }[G.map];
  const [x, y] = w.places[key];
  Sound.play('stairs');
  await goTo('world', x, y + 1, 'down');
}

async function goTo(map, x, y, dir, title) {
  await fade(true);
  G.map = map; G.x = x; G.y = y; G.dir = dir; P.moving = false;
  await fade(false);
  const m = curMap();
  if (m.kind === 'town') saveGame(); // 町に入るたびに自動セーブ
  if (title || m.kind === 'town') { await say(title || m.town.name, { auto: 900 }); showMsg(false); }
}

function fade(on) { return new Promise((r) => { const f = $('#fade'); f.classList.toggle('on', on); setTimeout(r, 260); }); }

async function runEvent(fn) {
  if (busy) return; busy = true;
  try { await fn(); } catch (e) { console.error(e); }
  busy = false; showMsg(false);
}

async function doBattle(ids, opts) {
  const res = await Battle.start(ids, opts);
  if (res === 'lose') {
    await fade(true);
    G.gold = Math.floor(G.gold / 2);
    G.party.forEach((p) => { p.hp = maxStat(p, 'hp'); p.mp = maxStat(p, 'mp'); });
    G.map = 'town:minato'; G.x = 7; G.y = 9; G.dir = 'up';
    await fade(false);
    await talk('……アオたちは ミナトむらで めを さました。\n（おかねが はんぶんに なった）');
  }
  return res;
}

async function bossEvent() {
  const m = curMap(), D = m.D;
  const lines = {
    cave: 'ほら穴の おくで おおきな カニが\nほしのかけらを かかえている！',
    tower: 'とうの さいじょうかいで ヤドリギが\nあやしく ひかっている……！',
    ice: 'こおりの おうざに りゅうが ねむっている。\nりゅうは めを ひらいた！',
    castle: 'きりのおう「ちいさき ものたちよ。\nしまは きりの なかで ねむるのが しあわせなのだ。',
  };
  await say(lines[m.id]);
  showMsg(false);
  const res = await doBattle([D.boss], { region: D.region, boss: true });
  if (res !== 'win') return;
  G.flags['boss_' + m.id] = 1;
  if (m.id === 'castle') return ending();
  G.found = Math.max(G.found, D.frag);
  Sound.play('star');
  await talk('アオは ほしのかけらを てにいれた！', 'ミナトむらの ほしのさいだんへ もちかえろう。');
}

async function openChest(ch) {
  const m = curMap(), key = `chest_${m.id}_${ch.x}_${ch.y}`;
  if (G.flags[key]) return talk('からっぽだ。');
  G.flags[key] = 1;
  const it = ITEMS[ch.item];
  Sound.play('item');
  if (it.type === 'wpn' || it.type === 'arm') {
    await say(`たからばこを あけた！\n${it.name}を みつけた！`);
    const who = await choose(G.party.map((p) => { const cur = p[it.type]; return { label: CHARS[p.id].name, right: `${cur ? ITEMS[cur].pow : 0}→${it.pow}` }; }), { right: '4%', top: '4%', width: '50%' }, { title: 'だれが そうびする？', noCancel: true });
    G.party[who][it.type] = ch.item;
    return talk(`${CHARS[G.party[who].id].name}は ${it.name}を そうびした！`);
  }
  G.items[ch.item] = (G.items[ch.item] || 0) + 1;
  return talk(`たからばこを あけた！\n${it.name}を てにいれた！`);
}

function interact() {
  const m = curMap(), [dx, dy] = DIRS[G.dir], x = G.x + dx, y = G.y + dy;
  if (m.kind === 'town') {
    let n = npcAt(x, y);
    if (!n && tileAt(m, x, y) === '~') n = null;
    if (n) return runEvent(n.talk);
  }
  if (m.kind === 'dun') {
    const ch = m.chests.find((c) => c.x === x && c.y === y);
    if (ch) return runEvent(() => openChest(ch));
    if (x === 9 && y === 1 && !G.flags['boss_' + m.id]) return runEvent(bossEvent);
  }
  runEvent(() => talk('アオは あたりを しらべた。\nとくに なにも ない。'));
}

// ---------- 描画 ----------
function drawTile(c, m, x, y, px, py, tm) {
  const f = (col, a, b, w, h) => { ctx.fillStyle = col; ctx.fillRect(px + a, py + b, w, h); };
  const wf = Math.floor(tm / 500 + x + y) % 2;
  const water = () => { f('#2f6fb8', 0, 0, 16, 16); f('#5b9be0', 2 + wf * 6, 4, 4, 1); f('#5b9be0', 8 - wf * 4, 11, 5, 1); };
  if (m.kind === 'world') {
    switch (c) {
      case '~': return water();
      case '.': f('#6dbb4d', 0, 0, 16, 16); f('#5aa53e', (x * 5) % 12, (y * 7) % 12, 2, 1); f('#5aa53e', (x * 3 + 6) % 13, (y * 5 + 8) % 13, 2, 1); return;
      case ',': f('#e3cf8a', 0, 0, 16, 16); f('#cdb874', (x * 5) % 12, (y * 7) % 12, 2, 1); return;
      case '*': f('#eef4fa', 0, 0, 16, 16); f('#cddcea', (x * 5) % 12, (y * 7) % 12, 3, 1); return;
      case 'x': f('#4a4058', 0, 0, 16, 16); f('#5d5270', (x * 5) % 12, (y * 7) % 12, 3, 1); return;
      case 'T': {
        const snow = m.reg[y][x] === 2;
        f(snow ? '#eef4fa' : '#6dbb4d', 0, 0, 16, 16);
        f('#6b4a2a', 7, 11, 2, 4); f(snow ? '#2f6b5a' : '#2e7d32', 3, 3, 10, 9); f(snow ? '#4a8a78' : '#43a047', 5, 1, 6, 4);
        if (snow) f('#fff', 5, 1, 6, 2);
        return;
      }
      case '^': {
        const g = { 0: '#6dbb4d', 1: '#6dbb4d', 2: '#eef4fa', 3: '#4a4058' }[m.reg[y][x]];
        f(g, 0, 0, 16, 16);
        ctx.fillStyle = '#7d6a55'; ctx.beginPath(); ctx.moveTo(px + 1, py + 15); ctx.lineTo(px + 8, py + 2); ctx.lineTo(px + 15, py + 15); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(px + 6, py + 6); ctx.lineTo(px + 8, py + 2); ctx.lineTo(px + 10, py + 6); ctx.fill();
        return;
      }
      case '=': water(); f('#a8743c', 0, 3, 16, 10); f('#7a5228', 0, 3, 16, 1); f('#7a5228', 0, 12, 16, 1); f('#8a5e30', 7, 3, 1, 10); return;
      case '1': case '2': case '3': {
        if (G.placed >= +c) { water(); f('#c9a35a', 0, 3, 16, 10); f('#fff3b0', 0, 3, 16, 1); f('#fff3b0', 0, 12, 16, 1); return; }
        water();
        const a = 0.55 + 0.25 * Math.sin(tm / 400 + x * 0.7 + y);
        ctx.fillStyle = `rgba(235,240,248,${a})`; ctx.fillRect(px, py, 16, 16);
        f('rgba(255,255,255,.6)', (tm / 60 + x * 5) % 14, 6, 3, 2);
        return;
      }
      case 'V': case 'H': case 'S': {
        f(c === 'S' ? '#eef4fa' : '#6dbb4d', 0, 0, 16, 16);
        const roof = { V: '#b0473a', H: '#d47aa3', S: '#4a6fa5' }[c];
        f('#e8dcc0', 2, 8, 6, 6); f(roof, 1, 5, 8, 4); f('#e8dcc0', 9, 9, 6, 5); f(roof, 8, 6, 8, 4); f('#5a3a1a', 4, 11, 2, 3); f('#5a3a1a', 11, 11, 2, 3);
        return;
      }
      case 'C': case 'I': {
        f(c === 'I' ? '#eef4fa' : '#6dbb4d', 0, 0, 16, 16);
        f(c === 'I' ? '#9fc7dd' : '#7d6a55', 1, 3, 14, 13); f('#111', 5, 8, 6, 8); f('#111', 6, 7, 4, 1);
        return;
      }
      case 'W': f('#6dbb4d', 0, 0, 16, 16); f('#8f9a8a', 4, 1, 8, 15); f('#6d786a', 4, 1, 8, 2); f('#3f6b46', 6, 5, 4, 3); f('#111', 6, 11, 4, 5); return;
      case 'K': f('#4a4058', 0, 0, 16, 16); f('#2a2440', 1, 4, 14, 12); f('#2a2440', 1, 1, 3, 4); f('#2a2440', 12, 1, 3, 4); f('#2a2440', 6, 0, 4, 5); f('#c6b7ff', 7, 2, 2, 2); f('#000', 6, 10, 4, 6); return;
    }
  } else if (m.kind === 'town') {
    const T = m.town;
    switch (c) {
      case '#': f('#7b7b86', 0, 0, 16, 16); f('#9a9aa6', 0, 0, 7, 7); f('#9a9aa6', 8, 8, 8, 7); return;
      case '.': case 'E': f(T.floor, 0, 0, 16, 16); f('rgba(0,0,0,.06)', (x * 5) % 12, (y * 7) % 12, 2, 2); if (c === 'E') f('rgba(255,255,255,.25)', 2, 12, 12, 3); return;
      case '~': return water();
      case 'T': f(T.floor, 0, 0, 16, 16); f('#6b4a2a', 7, 11, 2, 4); f('#2e7d32', 3, 3, 10, 9); f('#43a047', 5, 1, 6, 4); return;
      case 'B': {
        const below = tileAt(m, x, y + 1) === 'B';
        if (below) { f(T.roof, 0, 0, 16, 16); f('rgba(0,0,0,.18)', 0, 7, 16, 1); f('rgba(0,0,0,.18)', 0, 15, 16, 1); }
        else { f('#e8dcc0', 0, 0, 16, 16); f('#c8b890', 0, 0, 16, 2); if (tileAt(m, x - 1, y) === 'B' && tileAt(m, x + 1, y) === 'B') { f('#6a4424', 5, 5, 6, 11); f('#e2b13c', 9, 10, 1, 1); } else f('#7ab0d8', 5, 5, 6, 5); }
        return;
      }
    }
  } else {
    const D = m.D;
    if (c === '#') { f(D.wall, 0, 0, 16, 16); f('rgba(0,0,0,.25)', 0, 12, 16, 4); f('rgba(255,255,255,.12)', 0, 0, 16, 2); f('rgba(0,0,0,.15)', 7, 2, 1, 10); return; }
    f(D.floor, 0, 0, 16, 16); f('rgba(255,255,255,.05)', (x * 5) % 12, (y * 7) % 12, 3, 2);
    if (c === 'E') { f('#c9b98a', 3, 3, 10, 2); f('#c9b98a', 3, 7, 10, 2); f('#c9b98a', 3, 11, 10, 2); }
  }
}

function drawPerson(px, py, look, dir, frame) {
  const f = (col, a, b, w, h) => { ctx.fillStyle = col; ctx.fillRect(px + a, py + b, w, h); };
  f('rgba(0,0,0,.25)', 3, 14, 10, 2);
  const step = frame % 2;
  f('#3a2a1a', 5, 12, 2, 3 - step); f('#3a2a1a', 9, 12, 2, 2 + step);
  f(look.body, 4, 7, 8, 6); f('rgba(0,0,0,.2)', 4, 12, 8, 1);
  f('#f2c9a0', 4, 1, 8, 7); // かお
  f(look.hair, 4, 0, 8, 3);
  if (dir === 'up') f(look.hair, 4, 0, 8, 7);
  else if (dir === 'left') { f(look.hair, 8, 0, 4, 6); f('#222', 5, 4, 1, 2); }
  else if (dir === 'right') { f(look.hair, 4, 0, 4, 6); f('#222', 10, 4, 1, 2); }
  else { f('#222', 5, 4, 1, 2); f('#222', 10, 4, 1, 2); }
  if (look.band) f(look.band, 4, 2, 8, 1);
  f('#f2c9a0', 2 + (dir === 'right' ? 1 : 0), 8, 2, 3); f('#f2c9a0', 12 - (dir === 'left' ? 1 : 0), 8, 2, 3);
}

function drawField(tm) {
  const m = curMap();
  let cx = G.x, cy = G.y;
  if (P.moving) { const k = P.t; cx = P.fx + (G.x - P.fx) * k; cy = P.fy + (G.y - P.fy) * k; }
  const ox = Math.round((cx - Math.floor(VIEW / 2)) * TS), oy = Math.round((cy - Math.floor(VIEW / 2)) * TS);
  ctx.fillStyle = m.kind === 'world' ? '#2f6fb8' : '#000'; ctx.fillRect(0, 0, 176, 176);
  const x0 = Math.floor(ox / TS) - 1, y0 = Math.floor(oy / TS) - 1;
  for (let y = y0; y < y0 + VIEW + 3; y++) for (let x = x0; x < x0 + VIEW + 3; x++) {
    const inside = x >= 0 && y >= 0 && x < m.w && y < m.h;
    const c = inside ? m.t[y][x] : (m.kind === 'world' ? '~' : '#');
    drawTile(c, m, x, y, x * TS - ox, y * TS - oy, tm);
  }
  if (m.kind === 'town') {
    for (const n of npcsOf(m)) {
      const px = n.x * TS - ox, py = n.y * TS - oy;
      if (n.look === 'altar') {
        ctx.fillStyle = '#8a7a9a'; ctx.fillRect(px + 2, py + 8, 12, 7); ctx.fillStyle = '#b8a8c8'; ctx.fillRect(px + 1, py + 6, 14, 3);
        for (let i = 0; i < 3; i++) { ctx.fillStyle = i < G.placed ? `hsl(50,100%,${60 + 15 * Math.sin(tm / 200 + i)}%)` : '#4a3f55'; ctx.fillRect(px + 3 + i * 4, py + 3, 2, 3); }
      } else drawPerson(px, py + (Math.floor(tm / 600 + n.x) % 2), n.look, 'down', 0);
    }
  }
  if (m.kind === 'dun') {
    for (const ch of m.chests) {
      const px = ch.x * TS - ox, py = ch.y * TS - oy, open = G.flags[`chest_${m.id}_${ch.x}_${ch.y}`];
      ctx.fillStyle = '#8a5a2a'; ctx.fillRect(px + 2, py + 5, 12, 9); ctx.fillStyle = open ? '#3a2410' : '#b07a3a'; ctx.fillRect(px + 2, py + 5, 12, 4); ctx.fillStyle = '#e2b13c'; ctx.fillRect(px + 7, py + 8, 2, 3);
    }
    if (!G.flags['boss_' + m.id]) {
      const px = 9 * TS - ox, py = 1 * TS - oy, b = Math.sin(tm / 250) * 1.5;
      ctx.fillStyle = 'rgba(160,80,220,.35)'; ctx.beginPath(); ctx.arc(px + 8, py + 8, 8 + b, 0, 7); ctx.fill();
      ctx.fillStyle = MONSTERS[m.D.boss].c1; ctx.beginPath(); ctx.arc(px + 8, py + 9, 5.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff3a3a'; ctx.fillRect(px + 5, py + 7, 2, 2); ctx.fillRect(px + 9, py + 7, 2, 2);
    }
  }
  const look = { body: CHARS.ao.color, hair: CHARS.ao.hair, band: '#f5f5f5' };
  drawPerson(Math.floor(VIEW / 2) * TS, Math.floor(VIEW / 2) * TS, look, G.dir, P.moving ? Math.floor(tm / 120) : 0);
  if (m.kind === 'dun') { // 暗がり
    const g = ctx.createRadialGradient(88, 88, 30, 88, 88, 110); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.75)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 176, 176);
  }
}

function updateField(dt) {
  if (P.moving) {
    P.t += dt / 150;
    if (P.t >= 1) { P.moving = false; P.t = 0; onStep(); if (busy) return; }
    else return;
  }
  if (busy || Input.handlers.length) return;
  const d = Input.dir();
  if (d) tryMove(d);
}

// ---------- フィールドメニュー ----------
async function fieldMenu() {
  renderStatus(true); renderGold(true);
  let start = 0;
  for (;;) {
    renderStatus(true); renderGold(true);
    const r = await choose([{ label: 'じゅもん' }, { label: 'どうぐ' }, { label: 'そうび' }, { label: 'つよさ' }, { label: 'セーブ' }, { label: Sound.on ? 'おと：ON' : 'おと：OFF' }, { label: 'むらへ もどる' }],
      { right: '3%', top: '24%', width: '66%' }, { cols: 2, start });
    if (r < 0) break;
    start = r;
    if (r === 0) await fieldSpell();
    if (r === 1) await fieldItem();
    if (r === 2) await showEquip();
    if (r === 3) await showStats();
    if (r === 4) { const ok = saveGame(); await say(ok ? 'ぼうけんの きろくを かきこんだ。' : 'きろくできませんでした。（ブラウザの せってい を かくにん）'); showMsg(false); }
    if (r === 5) Sound.on = !Sound.on;
    if (r === 6) {
      await say('ミナトむらに もどりますか？\n（まよったときや うごけなくなったときに）');
      const y = await choose([{ label: 'はい' }, { label: 'いいえ' }], { right: '8%', bottom: '40%' });
      if (y === 0) { hideAllWindows(); await goTo('town:minato', 7, 9, 'up'); return; }
      showMsg(false);
    }
  }
  renderStatus(false); renderGold(false); showMsg(false);
}

const memberMenu = (title, pos) => choose(G.party.map((p) => ({ label: CHARS[p.id].name, right: `H${p.hp}/${maxStat(p, 'hp')}` })), pos || { left: '3%', top: '22%', width: '52%' }, { title });

async function fieldSpell() {
  const c = await memberMenu('だれが つかう？'); if (c < 0) return;
  const m = G.party[c];
  if (m.hp <= 0) { await say('しんでいる。'); return showMsg(false); }
  const sp = spellsOf(m).filter((s) => SPELLS[s].field);
  if (!sp.length) { await say(`${CHARS[m.id].name}は つかえる じゅもんが ない。`); return showMsg(false); }
  const s = await choose(sp.map((k) => ({ label: SPELLS[k].name, right: SPELLS[k].mp + '', disabled: m.mp < SPELLS[k].mp })), { left: '3%', top: '22%', width: '56%' }, { title: 'じゅもん' });
  if (s < 0) return;
  const S = SPELLS[sp[s]];
  let targets = G.party;
  if (S.target === 'ally') { const t = await memberMenu('だれに？', { right: '3%', top: '40%', width: '52%' }); if (t < 0) return; targets = [G.party[t]]; }
  m.mp -= S.mp; Sound.play('heal');
  for (const t of targets) {
    if (S.type === 'revive') { if (t.hp <= 0) t.hp = Math.floor(maxStat(t, 'hp') / 2); }
    else if (t.hp > 0) t.hp = Math.min(maxStat(t, 'hp'), t.hp + S.pow);
  }
  renderStatus(true);
  await say(`${CHARS[m.id].name}は ${S.name}を となえた！`); showMsg(false);
}

async function fieldItem() {
  const ids = Object.keys(G.items).filter((k) => G.items[k] > 0);
  if (!ids.length) { await say('どうぐを もっていない。'); return showMsg(false); }
  const r = await choose(ids.map((k) => ({ label: ITEMS[k].name, right: '×' + G.items[k] })), { left: '3%', top: '22%', width: '60%' }, { title: 'どうぐ', onMove: (i) => { $('#help').textContent = ITEMS[ids[i]].desc || ''; $('#help').hidden = false; } });
  $('#help').hidden = true;
  if (r < 0) return;
  const t = await memberMenu('だれに つかう？', { right: '3%', top: '40%', width: '52%' }); if (t < 0) return;
  await say(useItem(ids[r], G.party[t])); renderStatus(true); showMsg(false);
}

function useItem(id, t) {
  const it = ITEMS[id], nm = CHARS[t.id].name;
  if (it.type === 'revive') { if (t.hp > 0) return `${nm}は げんきだ。`; G.items[id]--; t.hp = Math.floor(maxStat(t, 'hp') / 2); Sound.play('heal'); return `${nm}は いきかえった！`; }
  if (t.hp <= 0) return `${nm}は たおれている……。`;
  G.items[id]--; Sound.play('heal');
  if (it.type === 'heal') { const b = t.hp; t.hp = Math.min(maxStat(t, 'hp'), t.hp + it.pow); return `${it.name}を つかった！\n${nm}の HPが ${t.hp - b} かいふくした！`; }
  const b = t.mp; t.mp = Math.min(maxStat(t, 'mp'), t.mp + it.pow); return `${it.name}を つかった！\n${nm}の MPが ${t.mp - b} かいふくした！`;
}

async function showEquip() {
  const lines = G.party.map((p) => `${CHARS[p.id].name}\n ぶき：${p.wpn ? ITEMS[p.wpn].name : 'なし'}\n ぼうぐ：${p.arm ? ITEMS[p.arm].name : 'なし'}`);
  await say(lines.join('\n').split('\n').slice(0, 5).join('\n'));
  if (lines.length > 1) await say(lines.slice(1).join('\n').split('\n').slice(-6).join('\n'));
  showMsg(false);
}
async function showStats() {
  for (const p of G.party) {
    const nx = expFor(p.lv + 1) - p.exp;
    await say(`${CHARS[p.id].name}（${CHARS[p.id].job}） Lv${p.lv}  つぎまで ${nx}\nHP ${p.hp}/${maxStat(p, 'hp')}  MP ${p.mp}/${maxStat(p, 'mp')}\nこうげき ${stat(p, 'atk')}  まもり ${stat(p, 'def')}  すばやさ ${stat(p, 'agi')}\nじゅもん：${spellsOf(p).map((s) => SPELLS[s].name).join(' ') || 'なし'}`);
  }
  showMsg(false);
}

async function ending() {
  await talk('きりのおう「ばかな……ひかりが……\nしまが……めを さます……。', 'きりのおうは しろい きりに なって きえた。');
  await fade(true);
  hideAllWindows();
  G.flags.clear = 1; saveGame();
  $('#ending').hidden = false;
  $('#endstats').textContent = G.party.map((p) => `${CHARS[p.id].name} Lv${p.lv}`).join('　');
  await fade(false);
  await new Promise((r) => { const h = (k) => { if (k === 'a') { Input.pop(h); r(); } }; h.isMsg = true; Input.push(h); });
  $('#ending').hidden = true;
  hideAllWindows();
  setTimeout(titleScreen, 0);
}
