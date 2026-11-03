// ===== ゲームデータ（すべてオリジナル） =====
const SPELLS = {
  heal:    { name: 'ヒール',       mp: 3,  type: 'heal',   target: 'ally',    pow: 35,  field: true },
  hiheal:  { name: 'ハイヒール',   mp: 7,  type: 'heal',   target: 'ally',    pow: 130, field: true },
  cure:    { name: 'キュア',       mp: 9,  type: 'heal',   target: 'allies',  pow: 50,  field: true },
  revive:  { name: 'リバイブ',     mp: 15, type: 'revive', target: 'ally',    field: true },
  fire:    { name: 'フレア',       mp: 4,  type: 'dmg',    target: 'enemy',   pow: 24 },
  ice:     { name: 'ブリザ',       mp: 6,  type: 'dmg',    target: 'enemies', pow: 20 },
  bolt:    { name: 'ライトニング', mp: 10, type: 'dmg',    target: 'enemies', pow: 48 },
  storm:   { name: 'フレアストーム', mp: 14, type: 'dmg',  target: 'enemies', pow: 70 },
  meteor:  { name: 'メテオ',       mp: 26, type: 'dmg',    target: 'enemies', pow: 140 },
  slash:   { name: 'ためぎり',     mp: 3,  type: 'phys',   target: 'enemy',   mult: 2.0 },
  sweep:   { name: 'なぎはらい',   mp: 6,  type: 'phys',   target: 'enemies', mult: 0.9 },
  crush:   { name: 'かいしんげき', mp: 10, type: 'phys',   target: 'enemy',   mult: 3.3 },
  star:    { name: 'ほしのつるぎ', mp: 12, type: 'phys',   target: 'enemies', mult: 1.4 },
};

const CHARS = {
  ao:   { name: 'アオ', job: 'うみのこ', color: '#3a7bd5', hair: '#2b1d14',
          base: { hp: 32, mp: 8,  atk: 9,  def: 6, agi: 7 },
          grow: { hp: 7,  mp: 3,  atk: 3,  def: 2, agi: 2 },
          learn: [[3, 'heal'], [7, 'slash'], [12, 'bolt'], [16, 'hiheal'], [22, 'star']] },
  rina: { name: 'リナ', job: 'まどうし', color: '#c0398a', hair: '#e8c35a',
          base: { hp: 22, mp: 20, atk: 5,  def: 3, agi: 9 },
          grow: { hp: 5,  mp: 5,  atk: 1,  def: 1, agi: 3 },
          learn: [[1, 'fire'], [1, 'heal'], [6, 'ice'], [10, 'cure'], [14, 'storm'], [17, 'revive'], [21, 'meteor']] },
  gant: { name: 'ガント', job: 'せんし', color: '#8a5a2b', hair: '#7a7a7a',
          base: { hp: 48, mp: 6,  atk: 15, def: 10, agi: 3 },
          grow: { hp: 10, mp: 1,  atk: 4,  def: 3, agi: 1 },
          learn: [[1, 'slash'], [12, 'sweep'], [18, 'crush']] },
};

const ITEMS = {
  herb:   { name: 'やくそう',       price: 8,    type: 'heal', pow: 40,  desc: 'HPを40かいふく' },
  water:  { name: 'まほうの水',     price: 40,   type: 'mp',   pow: 25,  desc: 'MPを25かいふく' },
  bigherb:{ name: 'おおやくそう',   price: 60,   type: 'heal', pow: 150, desc: 'HPを150かいふく' },
  feather:{ name: 'いのちのはね',   price: 300,  type: 'revive',         desc: 'たおれた仲間をいきかえらせる' },
  // そうび
  stick:  { name: 'かしのぼう',     price: 25,   type: 'wpn', pow: 4 },
  copper: { name: 'どうのつるぎ',   price: 90,   type: 'wpn', pow: 9 },
  cloth:  { name: 'たびびとのふく', price: 20,   type: 'arm', pow: 3 },
  leather:{ name: 'かわのよろい',   price: 80,   type: 'arm', pow: 7 },
  steel:  { name: 'はがねのつるぎ', price: 380,  type: 'wpn', pow: 18 },
  chain:  { name: 'くさりかたびら', price: 320,  type: 'arm', pow: 14 },
  staff:  { name: 'しずくのつえ',   price: 260,  type: 'wpn', pow: 12 },
  frost:  { name: 'ひょうがのけん', price: 1100, type: 'wpn', pow: 30 },
  scale:  { name: 'りゅうのうろこ', price: 950,  type: 'arm', pow: 24 },
  starsw: { name: 'ほしくずのけん', price: 0,    type: 'wpn', pow: 42 },
};

// kind: 描画タイプ
const MONSTERS = {
  puff:   { name: 'キリダマ',     kind: 'blob',  c1: '#cfd8e6', c2: '#8fa0bb', hp: 9,   atk: 6,  def: 2,  agi: 4,  exp: 3,  gold: 3 },
  hornrab:{ name: 'ツノウサギ',   kind: 'beast', c1: '#e8dcc8', c2: '#b85c4a', hp: 13,  atk: 8,  def: 3,  agi: 7,  exp: 5,  gold: 5, ears: 1 },
  crow:   { name: 'オオガラス',   kind: 'bird',  c1: '#3b3f55', c2: '#e2b13c', hp: 11,  atk: 9,  def: 2,  agi: 11, exp: 5,  gold: 4 },
  shroom: { name: 'ドクキノコ',   kind: 'mush',  c1: '#b33a5a', c2: '#f4e9d0', hp: 26,  atk: 14, def: 7,  agi: 5,  exp: 12, gold: 10 },
  lizard: { name: 'モリトカゲ',   kind: 'beast', c1: '#4d8c3a', c2: '#d9c25a', hp: 32,  atk: 17, def: 9,  agi: 6,  exp: 14, gold: 12, tail: 1 },
  wisp:   { name: 'ヒダマ',       kind: 'wisp',  c1: '#ff9a3c', c2: '#ffe27a', hp: 22,  atk: 11, def: 6,  agi: 12, exp: 13, gold: 11, acts: [{ name: 'ひのこ', type: 'magic', pow: 16 }] },
  wolf:   { name: 'ユキオオカミ', kind: 'beast', c1: '#e9f0f7', c2: '#5d7fa3', hp: 52,  atk: 27, def: 13, agi: 13, exp: 30, gold: 22, ears: 1, tail: 1 },
  golem:  { name: 'コオリゴーレム', kind: 'golem', c1: '#9fd3e6', c2: '#4a7d99', hp: 75, atk: 25, def: 24, agi: 3,  exp: 38, gold: 30 },
  bat:    { name: 'ツララバット', kind: 'bat',   c1: '#6c7fb8', c2: '#d6f1ff', hp: 40,  atk: 23, def: 12, agi: 16, exp: 28, gold: 20, acts: [{ name: 'こおりのいき', type: 'breath', pow: 18 }] },
  knight: { name: 'カゲナイト',   kind: 'human', c1: '#3b3048', c2: '#9b8bc4', hp: 95,  atk: 38, def: 26, agi: 10, exp: 70, gold: 50 },
  mage:   { name: 'ヤミマドウシ', kind: 'human', c1: '#5a2a6b', c2: '#f0d36a', hp: 70,  atk: 28, def: 18, agi: 14, exp: 66, gold: 48, hat: 1, acts: [{ name: 'やみのいかずち', type: 'magicall', pow: 30 }, { name: 'やみのいやし', type: 'healself', pow: 60 }] },
  wyrm:   { name: 'キリワーム',   kind: 'dragon', c1: '#6f8f86', c2: '#d8e8d0', hp: 130, atk: 40, def: 24, agi: 8, exp: 90, gold: 70, acts: [{ name: 'きりのブレス', type: 'breath', pow: 34 }] },
  // ボス
  b1: { name: 'イワガニ',         kind: 'crab',  c1: '#b0563a', c2: '#f2d0a0', hp: 110, atk: 15, def: 8,  agi: 5,  exp: 60,  gold: 80, boss: 1, big: 1,
        acts: [{ name: 'ハサミでなぎはらう', type: 'phys all', pow: 0.8 }] },
  b2: { name: 'ヤドリギのせい',   kind: 'tree',  c1: '#4a6b2f', c2: '#a8d86a', hp: 300, atk: 26, def: 14, agi: 7,  exp: 300, gold: 300, boss: 1, big: 1,
        acts: [{ name: 'ねっこでしめつける', type: 'phys', pow: 1.5 }, { name: 'ひかりをすいとる', type: 'healself', pow: 70 }, { name: 'はっぱのあらし', type: 'magicall', pow: 22 }] },
  b3: { name: 'ひょうりゅうグラシア', kind: 'dragon', c1: '#bfe6ff', c2: '#3a6fa0', hp: 620, atk: 40, def: 26, agi: 12, exp: 900, gold: 800, boss: 1, big: 1,
        acts: [{ name: 'ふぶきのブレス', type: 'breath', pow: 42 }, { name: 'しっぽでなぎはらう', type: 'phys all', pow: 0.9 }] },
  b4: { name: 'きりのおうノクス', kind: 'king', c1: '#2a2440', c2: '#c6b7ff', hp: 1500, atk: 54, def: 32, agi: 18, exp: 0, gold: 0, boss: 1, big: 1, twice: 1,
        acts: [{ name: 'しろいきりをはく', type: 'breath', pow: 48 }, { name: 'やみのいかずち', type: 'magicall', pow: 44 }, { name: 'きりをまとう', type: 'healself', pow: 150 }] },
};

const REGIONS = [
  { name: 'ミナトじま', enc: ['puff', 'hornrab', 'crow'], bg: ['#6fb0e0', '#9bd36b'] },
  { name: 'ハナミじま', enc: ['shroom', 'lizard', 'wisp', 'hornrab'], bg: ['#5a9a6a', '#2f5a35'] },
  { name: 'シモツキじま', enc: ['wolf', 'golem', 'bat'], bg: ['#c9e2f2', '#ffffff'] },
  { name: 'きりのしま', enc: ['knight', 'mage', 'wyrm'], bg: ['#3b3352', '#191526'] },
];

const DUNGEONS = {
  cave:   { name: 'しおさいのほら穴', region: 0, seed: 11, boss: 'b1', frag: 1, wall: '#5a4a3a', floor: '#2b231c', chests: ['herb', 'copper', 'water'] },
  tower:  { name: 'みどりのとう',     region: 1, seed: 27, boss: 'b2', frag: 2, wall: '#3f6b46', floor: '#1d3322', chests: ['bigherb', 'staff', 'feather'] },
  ice:    { name: 'こおりのどうくつ', region: 2, seed: 43, boss: 'b3', frag: 3, wall: '#7fb3cf', floor: '#21364a', chests: ['scale', 'feather', 'bigherb'] },
  castle: { name: 'きりのしろ',       region: 3, seed: 77, boss: 'b4', frag: 0, wall: '#4b3f66', floor: '#16121f', chests: ['starsw', 'feather', 'water'] },
};

const TOWNS = {
  minato: { name: 'ミナトむら', floor: '#c9b98a', roof: '#b0473a', shop: ['herb', 'stick', 'cloth', 'copper', 'leather'], inn: 6 },
  hanami: { name: 'ハナミのさと', floor: '#b7c98a', roof: '#d47aa3', shop: ['herb', 'water', 'steel', 'chain', 'staff'], inn: 18 },
  shimo:  { name: 'シモツキむら', floor: '#e4eef5', roof: '#4a6fa5', shop: ['herb', 'bigherb', 'water', 'feather', 'frost', 'scale'], inn: 40 },
};
