// ===== 戦闘 =====
const Battle = {
  active: false, enemies: [], opts: {}, shake: 0,

  async start(ids, opts = {}) {
    this.active = true; this.opts = opts; this.shake = 0;
    const count = {};
    this.enemies = ids.map((id) => {
      const M = MONSTERS[id];
      count[id] = (count[id] || 0) + 1;
      return { id, M, name: M.name, hp: M.hp, maxhp: M.hp, flash: 0, dying: 0 };
    });
    // 同じ種類が複数なら A/B/C をつける
    const seen = {};
    this.enemies.forEach((e) => { if (count[e.id] > 1) { seen[e.id] = (seen[e.id] || 0) + 1; e.name += 'ABC'[seen[e.id] - 1]; } });
    Sound.play('enc');
    $('#screen').classList.add('enc'); await wait(450); $('#screen').classList.remove('enc');
    renderStatus(true);
    const names = [...new Set(this.enemies.map((e) => e.M.name))];
    await say(opts.boss ? `${names[0]}が おそいかかってきた！` : names.length === 1 && this.enemies.length > 1 ? `${names[0]}たちが あらわれた！` : `${names.join('と ')}が あらわれた！`);
    let result = null;
    while (!result) {
      const cmds = await this.commandPhase();
      if (cmds === 'run') {
        await say('アオたちは にげだした！', { auto: 500 });
        if (Math.random() < 0.6) { result = 'run'; break; }
        await say('しかし まわりこまれてしまった！', { append: true, auto: 600 });
        result = await this.enemyOnlyTurn();
        continue;
      }
      result = await this.resolve(cmds);
    }
    if (result === 'win') await this.victory();
    if (result === 'lose') { Sound.play('dead'); await say('アオたちは ぜんめつした……'); }
    this.active = false; renderStatus(false); showMsg(false);
    return result;
  },

  // ---------- コマンド入力 ----------
  async commandPhase() {
    const cmds = [];
    const members = G.party;
    let i = 0;
    while (i < members.length) {
      const m = members[i];
      if (m.hp <= 0) { cmds[i] = null; i++; continue; }
      renderStatus(true); this.highlight(i);
      showMsg(false);
      const opts = [{ label: 'たたかう' }, { label: 'じゅもん', disabled: !spellsOf(m).length }, { label: 'どうぐ' }, { label: i === 0 ? 'にげる' : 'ぼうぎょ', disabled: i === 0 && this.opts.boss }];
      const r = await choose(opts, { left: '3%', bottom: '3%', width: '46%' }, { title: CHARS[m.id].name + 'は どうする？' });
      if (r < 0) { // ひとつ前の仲間へ
        let j = i - 1; while (j >= 0 && members[j].hp <= 0) j--;
        if (j >= 0) i = j;
        continue;
      }
      let cmd = null;
      if (r === 0) { const t = await this.pickEnemy(); if (t == null) continue; cmd = { type: 'atk', target: t }; }
      if (r === 1) {
        const sp = spellsOf(m);
        const s = await choose(sp.map((k) => ({ label: SPELLS[k].name, right: SPELLS[k].mp + '', disabled: m.mp < SPELLS[k].mp })), { right: '3%', bottom: '3%', width: '56%', maxHeight: '60%' }, { title: 'MP ' + m.mp });
        if (s < 0) continue;
        const S = SPELLS[sp[s]];
        let target = null;
        if (S.target === 'enemy') { target = await this.pickEnemy(); if (target == null) continue; }
        if (S.target === 'ally') { const t = await memberMenu('だれに？', { right: '3%', bottom: '3%', width: '52%' }); if (t < 0) continue; target = G.party[t]; }
        cmd = { type: 'spell', spell: sp[s], target };
      }
      if (r === 2) {
        const ids = Object.keys(G.items).filter((k) => G.items[k] > 0 && ITEMS[k].type !== 'wpn' && ITEMS[k].type !== 'arm');
        if (!ids.length) { await say('どうぐを もっていない。', { auto: 600 }); continue; }
        const s = await choose(ids.map((k) => ({ label: ITEMS[k].name, right: '×' + G.items[k] })), { right: '3%', bottom: '3%', width: '58%' }, { title: 'どうぐ' });
        if (s < 0) continue;
        const t = await memberMenu('だれに？', { right: '3%', bottom: '3%', width: '52%' }); if (t < 0) continue;
        cmd = { type: 'item', item: ids[s], target: G.party[t] };
      }
      if (r === 3) { if (i === 0) { this.highlight(-1); return 'run'; } cmd = { type: 'guard' }; }
      cmds[i] = cmd; i++;
    }
    this.highlight(-1);
    return cmds;
  },

  pickEnemy() {
    const live = this.enemies.filter((e) => e.hp > 0);
    if (live.length === 1) return Promise.resolve(live[0]);
    return choose(live.map((e) => ({ label: e.name, right: '' })), { right: '3%', bottom: '3%', width: '56%' }, { title: 'だれを？', onMove: (i) => { this.enemies.forEach((e) => (e.sel = e === live[i])); } })
      .then((i) => { this.enemies.forEach((e) => (e.sel = false)); return i < 0 ? null : live[i]; });
  },

  highlight(i) { document.querySelectorAll('#status .pm').forEach((el, k) => el.classList.toggle('act', k === i)); },

  // ---------- ターン解決 ----------
  async resolve(cmds) {
    const actors = [];
    G.party.forEach((m, i) => { if (cmds[i]) actors.push({ who: m, side: 'p', cmd: cmds[i], spd: stat(m, 'agi') * (0.6 + Math.random() * 0.6) }); });
    this.enemies.forEach((e) => {
      const n = e.M.twice ? 2 : 1;
      for (let k = 0; k < n; k++) actors.push({ who: e, side: 'e', spd: e.M.agi * (0.6 + Math.random() * 0.6) - k * 5 });
    });
    actors.sort((a, b) => b.spd - a.spd);
    G.party.forEach((m, i) => { m.guard = cmds[i] && cmds[i].type === 'guard'; });
    msgLines = [];
    for (const a of actors) {
      if (a.who.hp <= 0) continue;
      if (a.side === 'p') await this.playerAct(a.who, a.cmd);
      else await this.enemyAct(a.who);
      renderStatus(true);
      const r = this.check(); if (r) return r;
      await wait(120);
    }
    G.party.forEach((m) => (m.guard = false));
    return null;
  },

  async enemyOnlyTurn() {
    for (const e of this.enemies) if (e.hp > 0) { await this.enemyAct(e); renderStatus(true); const r = this.check(); if (r) return r; }
    return null;
  },

  check() {
    if (this.enemies.every((e) => e.hp <= 0)) return 'win';
    if (G.party.every((m) => m.hp <= 0)) return 'lose';
    return null;
  },

  log(t) { return say(t, { append: true, auto: 650 }); },

  retarget(t) { if (t && t.hp > 0) return t; return this.enemies.find((e) => e.hp > 0); },

  physDmg(atk, def, mult = 1) {
    const base = (atk - def / 2) * mult;
    return Math.max(base > 0 ? 1 : rnd(2), Math.floor(base * (0.85 + Math.random() * 0.3)));
  },

  async hitEnemy(e, dmg) {
    e.hp = Math.max(0, e.hp - dmg); e.flash = 12; Sound.play('hit');
    await this.log(`${e.name}に ${dmg}の ダメージ！`);
    if (e.hp <= 0) { e.dying = 1; Sound.play('cancel'); await this.log(e.M.boss ? `${e.name}を たおした！` : `${e.name}を やっつけた！`); }
  },

  async playerAct(m, cmd) {
    const nm = CHARS[m.id].name;
    if (cmd.type === 'guard') return this.log(`${nm}は みを まもっている。`);
    if (cmd.type === 'atk') {
      const e = this.retarget(cmd.target); if (!e) return;
      await this.log(`${nm}の こうげき！`);
      if (Math.random() < 0.05) { await this.log('ミス！ ダメージを あたえられない！'); return; }
      const crit = Math.random() < 1 / 24;
      if (crit) { Sound.play('crit'); await this.log('かいしんの いちげき！'); }
      return this.hitEnemy(e, crit ? Math.floor(stat(m, 'atk') * (1.4 + Math.random() * 0.3)) : this.physDmg(stat(m, 'atk'), e.M.def));
    }
    if (cmd.type === 'item') {
      if (!G.items[cmd.item]) return this.log(`${nm}は どうぐを さがしたが みつからない！`);
      await this.log(`${nm}は ${ITEMS[cmd.item].name}を つかった！`);
      return this.log(useItem(cmd.item, cmd.target).split('\n').pop());
    }
    const S = SPELLS[cmd.spell];
    if (m.mp < S.mp) return this.log(`${nm}は ${S.name}を となえようとしたが MPが たりない！`);
    m.mp -= S.mp;
    await this.log(S.type === 'phys' ? `${nm}の ${S.name}！` : `${nm}は ${S.name}を となえた！`);
    if (S.type === 'phys') {
      const ts = S.target === 'enemies' ? this.enemies.filter((e) => e.hp > 0) : [this.retarget(cmd.target)];
      for (const e of ts) if (e) await this.hitEnemy(e, this.physDmg(stat(m, 'atk'), e.M.def, S.mult));
      return;
    }
    if (S.type === 'dmg') {
      Sound.play('magic'); $('#screen').classList.add('flash'); await wait(200); $('#screen').classList.remove('flash');
      const ts = S.target === 'enemies' ? this.enemies.filter((e) => e.hp > 0) : [this.retarget(cmd.target)];
      for (const e of ts) if (e) await this.hitEnemy(e, Math.floor(S.pow * (1 + m.lv * 0.04) * (0.9 + Math.random() * 0.2)));
      return;
    }
    Sound.play('heal');
    const ts = S.target === 'allies' ? G.party : [cmd.target];
    for (const t of ts) {
      const tn = CHARS[t.id].name;
      if (S.type === 'revive') {
        if (t.hp > 0) await this.log('しかし なにも おこらなかった。');
        else { t.hp = Math.floor(maxStat(t, 'hp') / 2); await this.log(`${tn}は いきかえった！`); }
      } else if (t.hp > 0) {
        const b = t.hp; t.hp = Math.min(maxStat(t, 'hp'), t.hp + S.pow);
        await this.log(`${tn}の HPが ${t.hp - b} かいふくした！`);
      }
      renderStatus(true);
    }
  },

  async hurt(t, dmg) {
    if (t.guard) dmg = Math.floor(dmg / 2);
    t.hp = Math.max(0, t.hp - dmg); Sound.play('hurt'); this.shake = 10;
    renderStatus(true);
    await this.log(`${CHARS[t.id].name}は ${dmg}の ダメージを うけた！`);
    if (t.hp <= 0) await this.log(`${CHARS[t.id].name}は たおれた！`);
  },

  async enemyAct(e) {
    const M = e.M, live = alive(G.party);
    if (!live.length) return;
    let act = null;
    if (M.acts && Math.random() < (M.boss ? 0.45 : 0.3)) act = pick(M.acts);
    if (act && act.type === 'healself' && e.hp > e.maxhp * 0.7) act = null;
    // 狙われやすさ：先頭ほど狙われる
    const target = () => { const w = live.map((m, i) => 3 - Math.min(2, i)); let r = Math.random() * w.reduce((a, b) => a + b); for (let i = 0; i < live.length; i++) { r -= w[i]; if (r <= 0) return live[i]; } return live[0]; };
    if (!act) {
      const t = target();
      await this.log(`${e.name}の こうげき！`);
      if (Math.random() < 0.06) return this.log(`${CHARS[t.id].name}は ひらりと みをかわした！`);
      return this.hurt(t, this.physDmg(M.atk, stat(t, 'def')));
    }
    if (act.type === 'healself') {
      e.hp = Math.min(e.maxhp, e.hp + act.pow); Sound.play('heal');
      return this.log(`${e.name}は ${act.name}！\n${e.name}の きずが ふさがった！`);
    }
    if (act.type === 'phys') { const t = target(); await this.log(`${e.name}は ${act.name}！`); return this.hurt(t, this.physDmg(M.atk, stat(t, 'def'), act.pow)); }
    await this.log(act.type === 'phys all' ? `${e.name}は ${act.name}！` : `${e.name}は ${act.name}${act.type === 'breath' ? '！' : 'を となえた！'}`);
    if (act.type === 'magic') { Sound.play('magic'); const t = target(); return this.hurt(t, Math.floor(act.pow * (0.9 + Math.random() * 0.2))); }
    Sound.play(act.type === 'breath' ? 'hurt' : 'magic');
    for (const t of alive(G.party)) {
      const d = act.type === 'phys all' ? this.physDmg(M.atk, stat(t, 'def'), act.pow) : Math.floor(act.pow * (0.85 + Math.random() * 0.3));
      await this.hurt(t, d);
    }
  },

  async victory() {
    Sound.play('win');
    const exp = this.enemies.reduce((s, e) => s + e.M.exp, 0), gold = this.enemies.reduce((s, e) => s + e.M.gold, 0);
    G.gold += gold;
    await say(`まものたちを やっつけた！\nそれぞれ ${exp}ポイントの けいけんちを かくとく！\n${gold}ゴールドを てにいれた！`);
    for (const m of G.party) {
      if (m.hp <= 0) continue;
      m.exp += exp;
      while (m.exp >= expFor(m.lv + 1)) {
        const before = spellsOf(m), oh = maxStat(m, 'hp'), om = maxStat(m, 'mp');
        m.lv++;
        m.hp += maxStat(m, 'hp') - oh; m.mp += maxStat(m, 'mp') - om;
        Sound.play('lvup'); renderStatus(true);
        await say(`${CHARS[m.id].name}は レベル${m.lv}に あがった！`);
        for (const s of spellsOf(m)) if (!before.includes(s)) await say(`${CHARS[m.id].name}は ${SPELLS[s].name}を おぼえた！`, { append: true });
      }
    }
    // まれに やくそうを おとす
    if (!this.opts.boss && Math.random() < 0.12) { G.items.herb = (G.items.herb || 0) + 1; Sound.play('item'); await say('まものは やくそうを おとしていった！'); }
  },

  // ---------- 描画 ----------
  draw(tm) {
    const R = REGIONS[this.opts.region || 0];
    let sx = 0, sy = 0;
    if (this.shake > 0) { sx = (Math.random() - 0.5) * 6; sy = (Math.random() - 0.5) * 4; this.shake--; }
    ctx.save(); ctx.translate(sx, sy);
    const g = ctx.createLinearGradient(0, 0, 0, 176); g.addColorStop(0, '#05060c'); g.addColorStop(1, '#141826');
    ctx.fillStyle = g; ctx.fillRect(-4, -4, 184, 184);
    // 背景パネル
    ctx.fillStyle = R.bg[0]; ctx.fillRect(12, 34, 152, 84);
    ctx.fillStyle = R.bg[1]; ctx.fillRect(12, 96, 152, 22);
    ctx.strokeStyle = '#f2efe6'; ctx.lineWidth = 1; ctx.strokeRect(12.5, 34.5, 151, 83);
    const live = this.enemies.filter((e) => e.hp > 0 || e.dying > 0);
    const n = live.length;
    live.forEach((e, i) => {
      const big = e.M.big;
      const cx = n === 1 ? 88 : 88 + (i - (n - 1) / 2) * (n === 3 ? 50 : 58);
      const cy = big ? 110 : 112;
      if (e.dying > 0) { e.dying += 1; if (e.dying > 16) { e.dying = 0; return; } ctx.globalAlpha = 1 - e.dying / 16; }
      if (e.flash > 0 && e.flash-- % 4 < 2) { ctx.globalAlpha = 1; return; }
      drawMonster(e.M, cx, cy, big ? 1.6 : 1, tm);
      if (e.sel) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(cx - 4, cy - (big ? 64 : 42)); ctx.lineTo(cx + 4, cy - (big ? 64 : 42)); ctx.lineTo(cx, cy - (big ? 58 : 36)); ctx.fill(); }
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  },
};

// 敵キャラクターをシンプルな図形で描く（オリジナルデザイン）
function drawMonster(M, cx, cy, s, tm) {
  const b = Math.sin(tm / 300 + cx) * 1.5;
  const F = (col) => (ctx.fillStyle = col);
  const R = (x, y, w, h) => ctx.fillRect(cx + x * s, cy + (y + b) * s, w * s, h * s);
  const C = (x, y, r) => { ctx.beginPath(); ctx.arc(cx + x * s, cy + (y + b) * s, r * s, 0, 7); ctx.fill(); };
  const E = (x, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(cx + x * s, cy + (y + b) * s, rx * s, ry * s, 0, 0, 7); ctx.fill(); };
  const eyes = (y, gap, col = '#111', sz = 2) => { F('#fff'); C(-gap, y, sz + 1); C(gap, y, sz + 1); F(col); C(-gap + 0.5, y + 0.5, sz); C(gap + 0.5, y + 0.5, sz); };
  F('rgba(0,0,0,.3)'); ctx.beginPath(); ctx.ellipse(cx, cy + 2 * s, 14 * s, 3 * s, 0, 0, 7); ctx.fill();
  switch (M.kind) {
    case 'blob': // 霧のかたまり：もこもこ雲
      F(M.c2); C(-7, -8, 7); C(7, -8, 7); C(0, -13, 8);
      F(M.c1); C(-6, -10, 6); C(6, -10, 6); C(0, -15, 7); R(-10, -8, 20, 6);
      eyes(-11, 4, '#334'); F('#334'); R(-2, -6, 4, 1);
      break;
    case 'mush':
      F(M.c2); R(-5, -12, 10, 12); F('#222'); C(-2, -7, 1.3); C(2, -7, 1.3);
      F(M.c1); E(0, -14, 13, 7); F('#fff'); C(-6, -16, 2); C(4, -18, 2.5); C(8, -13, 1.5);
      break;
    case 'beast':
      if (M.tail) { F(M.c1); ctx.save(); R(10, -10, 10, 3); ctx.restore(); }
      F(M.c1); E(0, -9, 12, 8); R(-9, -4, 4, 5); R(5, -4, 4, 5);
      E(-9, -16, 6, 6);
      if (M.ears) { R(-13, -27, 3, 9); R(-8, -27, 3, 9); F(M.c2); R(-12, -25, 1, 6); R(-7, -25, 1, 6); }
      if (M.id !== 'wolf') { F(M.c2); R(-12, -26, 2, 6); }
      F('#111'); C(-11, -17, 1.4); F(M.c2); R(-15, -14, 3, 2);
      break;
    case 'bird':
      F(M.c1); E(0, -14, 9, 8); ctx.beginPath(); ctx.moveTo(cx - 6 * s, cy + (-16 + b) * s); ctx.lineTo(cx - 22 * s, cy + (-24 - b * 2) * s); ctx.lineTo(cx - 8 * s, cy + (-8 + b) * s); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 6 * s, cy + (-16 + b) * s); ctx.lineTo(cx + 22 * s, cy + (-24 - b * 2) * s); ctx.lineTo(cx + 8 * s, cy + (-8 + b) * s); ctx.fill();
      F(M.c2); ctx.beginPath(); ctx.moveTo(cx - 2 * s, cy + (-14 + b) * s); ctx.lineTo(cx + 2 * s, cy + (-14 + b) * s); ctx.lineTo(cx, cy + (-9 + b) * s); ctx.fill();
      F('#fff'); C(-4, -17, 2); C(4, -17, 2); F('#c22'); C(-4, -17, 1); C(4, -17, 1);
      break;
    case 'bat':
      F(M.c1); C(0, -16, 7);
      for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + d * 5 * s, cy + (-18 + b) * s); ctx.lineTo(cx + d * 24 * s, cy + (-26 - b * 3) * s); ctx.lineTo(cx + d * 20 * s, cy + (-14) * s); ctx.lineTo(cx + d * 14 * s, cy + (-18) * s); ctx.lineTo(cx + d * 6 * s, cy + (-10 + b) * s); ctx.fill(); }
      F(M.c2); R(-4, -10, 2, 5); R(2, -10, 2, 6); R(-1, -9, 2, 4);
      F('#ff5'); C(-3, -17, 1.5); C(3, -17, 1.5);
      break;
    case 'wisp': {
      const fl = Math.sin(tm / 90) * 2;
      F(M.c1); ctx.beginPath(); ctx.moveTo(cx - 9 * s, cy + (-8 + b) * s); ctx.quadraticCurveTo(cx - 6 * s, cy + (-30 - fl) * s, cx, cy + (-34 + fl) * s); ctx.quadraticCurveTo(cx + 6 * s, cy + (-30 + fl) * s, cx + 9 * s, cy + (-8 + b) * s); ctx.fill();
      C(0, -10, 9); F(M.c2); C(0, -11, 5); eyes(-12, 3, '#a33', 1.2);
      break;
    }
    case 'golem':
      F(M.c2); R(-16, -26, 32, 26); F(M.c1); R(-14, -28, 28, 24); R(-22, -24, 8, 18); R(14, -24, 8, 18); R(-10, -36, 20, 10);
      F('#fff'); R(-12, -27, 6, 2); R(4, -20, 8, 2); F('#2af'); R(-6, -33, 3, 3); R(3, -33, 3, 3);
      break;
    case 'human':
      F(M.c1); ctx.beginPath(); ctx.moveTo(cx - 12 * s, cy + b * s); ctx.lineTo(cx, cy + (-30 + b) * s); ctx.lineTo(cx + 12 * s, cy + b * s); ctx.fill();
      F('#1a1520'); C(0, -27, 6);
      if (M.hat) { F(M.c1); ctx.beginPath(); ctx.moveTo(cx - 10 * s, cy + (-28 + b) * s); ctx.lineTo(cx + 2 * s, cy + (-46 + b) * s); ctx.lineTo(cx + 10 * s, cy + (-28 + b) * s); ctx.fill(); F(M.c2); C(2, -46, 2); }
      else { F(M.c2); R(-7, -36, 14, 6); R(-1, -40, 2, 5); F('#888'); R(14, -34, 2, 30); R(11, -12, 8, 2); }
      F(M.c2); C(-2, -27, 1.2); C(2, -27, 1.2);
      break;
    case 'crab':
      F(M.c1); E(0, -10, 16, 9); R(-20, -6, 4, 6); R(16, -6, 4, 6); R(-24, -4, 3, 5); R(21, -4, 3, 5);
      F(M.c1); C(-20, -22, 6); C(20, -22, 6); F(M.c2); R(-23, -24, 6, 2); R(17, -24, 6, 2);
      F(M.c1); R(-6, -24, 2, 8); R(4, -24, 2, 8); F('#fff'); C(-5, -25, 2.5); C(5, -25, 2.5); F('#111'); C(-5, -25, 1.2); C(5, -25, 1.2);
      F(M.c2); E(0, -7, 10, 3);
      break;
    case 'tree':
      F('#5a3a1e'); R(-7, -26, 14, 26); R(-14, -4, 6, 4); R(8, -4, 6, 4);
      F(M.c1); C(-12, -32, 11); C(12, -32, 11); C(0, -40, 13); F(M.c2); C(-6, -38, 4); C(8, -34, 3); C(14, -40, 2);
      F('#ff6'); C(-3, -17, 2); C(3, -17, 2); F('#111'); R(-3, -11, 6, 2);
      break;
    case 'dragon':
      F(M.c2); E(0, -12, 15, 11);
      F(M.c1); for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + d * 6 * s, cy + (-18 + b) * s); ctx.lineTo(cx + d * 30 * s, cy + (-40 - b) * s); ctx.lineTo(cx + d * 22 * s, cy + (-14 + b) * s); ctx.fill(); }
      F(M.c1); E(0, -12, 12, 9); R(-4, -34, 8, 16); E(0, -36, 9, 6); R(-12, -4, 5, 4); R(7, -4, 5, 4);
      F(M.c2); R(-7, -44, 2, 6); R(5, -44, 2, 6); E(0, -12, 6, 7);
      F('#f33'); C(-4, -37, 1.5); C(4, -37, 1.5);
      break;
    case 'king': {
      const a = 0.25 + 0.1 * Math.sin(tm / 200);
      F(`rgba(198,183,255,${a})`); C(0, -24, 30);
      F(M.c1); ctx.beginPath(); ctx.moveTo(cx - 20 * s, cy + b * s); ctx.lineTo(cx - 8 * s, cy + (-34 + b) * s); ctx.lineTo(cx + 8 * s, cy + (-34 + b) * s); ctx.lineTo(cx + 20 * s, cy + b * s); ctx.fill();
      F('#0d0b16'); C(0, -38, 9);
      F(M.c2); R(-9, -50, 18, 4); R(-9, -56, 3, 6); R(-1.5, -58, 3, 8); R(6, -56, 3, 6);
      F('#fff'); C(-3, -38, 1.6); C(3, -38, 1.6);
      F(M.c2); R(-24, -24, 6, 2); R(18, -24, 6, 2);
      break;
    }
  }
}
