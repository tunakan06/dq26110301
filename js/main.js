// ===== 起動・タイトル・メインループ =====
let mode = 'title';
for (const k in MONSTERS) MONSTERS[k].id = k;

function drawTitle(tm) {
  ctx.fillStyle = '#0d2747'; ctx.fillRect(0, 0, 176, 176);
  for (let y = 100; y < 176; y += 4) for (let x = 0; x < 176; x += 8) {
    ctx.fillStyle = (x + y + Math.floor(tm / 300)) % 3 ? '#1d4d80' : '#2f6fb8';
    ctx.fillRect(x + ((y / 4) % 2) * 4, y, 5, 1);
  }
  ctx.fillStyle = '#e8c35a'; ctx.beginPath(); ctx.arc(130, 46, 10, 0, 7); ctx.fill();
  // しまのシルエット
  ctx.fillStyle = '#132238';
  ctx.beginPath(); ctx.moveTo(20, 100); ctx.quadraticCurveTo(50, 70, 80, 100); ctx.fill();
  ctx.beginPath(); ctx.moveTo(100, 100); ctx.quadraticCurveTo(140, 62, 176, 100); ctx.fill();
  for (let i = 0; i < 6; i++) {
    const x = ((tm / 40 + i * 47) % 260) - 40;
    ctx.fillStyle = 'rgba(230,236,245,.18)'; ctx.beginPath(); ctx.ellipse(x, 88 + (i % 3) * 8, 30, 6, 0, 0, 7); ctx.fill();
  }
  for (let i = 0; i < 20; i++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.3 * Math.sin(tm / 400 + i)})`; ctx.fillRect((i * 37) % 176, (i * 23) % 60, 1, 1); }
}

async function titleScreen() {
  mode = 'title';
  $('#title').hidden = false;
  const items = [{ label: 'はじめから' }, { label: 'つづきから', disabled: !hasSave() }];
  const r = await choose(items, { left: '25%', width: '50%', bottom: '10%' }, { noCancel: true, start: hasSave() ? 1 : 0 });
  $('#title').hidden = true;
  if (r === 1 && loadGame()) {
    mode = 'field';
    await say(`${CHARS.ao.name}は ぼうけんを さいかいした。`, { auto: 900 }); showMsg(false);
    return;
  }
  newGame(); mode = 'field';
  busy = true;
  await fade(true); await fade(false);
  await talk('ここは うみに うかぶ ちいさな しま\nミナトじま。', 'ある あさ、うみの むこうの しまじまは\nしろい きりに つつまれて きえてしまった。', 'りょうしの こ アオは\nむらの ちょうろうに よばれた……。', '（ゆびで ←↑↓→ をおして いどう。\nAで はなす・しらべる、Bで メニュー）');
  busy = false;
}

window.onFreePress = (k) => {
  if (mode !== 'field' || busy || P.moving || Battle.active) return;
  if (k === 'a') interact();
  if (k === 'b') { Sound.play('ok'); runEvent(fieldMenu); }
};

let last = performance.now(), stuckT = 0;
function loop(tm) {
  const dt = Math.min(50, tm - last); last = tm;
  if (mode === 'title') drawTitle(tm);
  else if (Battle.active) Battle.draw(tm);
  else { updateField(dt); drawField(tm); }
  // 安全装置：入力待ちも戦闘もないのに操作不能のままなら解除する
  if (mode === 'field' && busy && !Input.handlers.length && !Battle.active && $('#fade').className !== 'on') {
    stuckT += dt;
    if (stuckT > 4000) { busy = false; stuckT = 0; showMsg(false); $('#layer').innerHTML = ''; }
  } else stuckT = 0;
  requestAnimationFrame(loop);
}

window.addEventListener('load', () => {
  ctx = $('#cv').getContext('2d');
  ctx.imageSmoothingEnabled = false;
  buildAll();
  setupInput();
  requestAnimationFrame(loop);
  titleScreen();
});
