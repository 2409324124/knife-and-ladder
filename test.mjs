// KNIFE & LADDER — CLI 无头测试
// 用法：node test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

/* 1. 假 DOM */
function fakeCtx2d() {
  return {
    fillStyle: null, font: null, textBaseline: null,
    clearRect() {}, fillText() {}, measureText: (s) => ({ width: String(s).length * 7 }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
  };
}
const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => fakeCtx2d() });
globalThis.window = globalThis;
globalThis.document = { getElementById: fakeCanvas, createElement: fakeCanvas };
globalThis.addEventListener = () => {};
globalThis.location = { search: '' };
globalThis.requestAnimationFrame = () => {};

/* 2. 加载游戏逻辑 */
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
(0, eval)(js);
const dbg = globalThis.__debug;
if (!dbg) { console.error('FAIL: 没有 __debug 钩子'); process.exit(1); }

/* 3. 驱动 */
const { keys, pressed } = dbg;
const hold = (n) => keys.add(n);
const release = (n) => keys.delete(n);
const tap = (n) => { pressed.add(n); keys.add(n); };
const stopAll = () => keys.clear();
const run = (n) => { for (let i = 0; i < n; i++) dbg.step(); };
const P = () => dbg.world.player;
const W = () => dbg.world;
const FLAT = { x: 17 * 16, y: 12 * 16 - 40 };        // col 17 平地
const WATER = { x: 38.5 * 16, y: 150 };              // col 38-39 水
const LADDER = { x: 9 * 16 + 3, y: 152 };            // col 9 梯子

function setupPlay(x, y) {                            // 隔离现场，测试互不串
  const w = W(), p = P();
  w.enemies.length = 0;
  w.lives = 4; w.hitstop = 0; w.respawn = 0;
  w.spawned = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 };
  p.alive = true; p.invuln = 0; p.climbing = false; p.knock = 0;
  p.stance = 0; p.duckT = 0; p.h = 40; p.para = false;
  p.x = x; p.y = (y ?? FLAT.y); p.vx = 0; p.vy = 0; p.attack = 0; p.shootCool = 0; p.face = 1;
  if (dbg.state !== 'play') dbg.state = 'play';
  stopAll();
  run(3);
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  → ' + detail : '')); }
}

/* 4. 用例 */

run(5);
check('初始在标题', dbg.state === 'title', dbg.state);
tap('start'); run(5);
check('Enter 后进入游戏', dbg.state === 'play', dbg.state);
stopAll();
run(300);
check('跳伞后落地站稳', P().onGround === true && P().para === false, 'y=' + P().y);

setupPlay(FLAT.x);
hold('right'); run(120);
check('向右走动', P().x > FLAT.x + 100, 'x=' + Math.round(P().x));
stopAll();

setupPlay(FLAT.x);
tap('jump'); hold('jump');
let apexLong = 1e9;
for (let i = 0; i < 55; i++) { dbg.step(); apexLong = Math.min(apexLong, P().y); }
release('jump'); run(40);
setupPlay(FLAT.x);
tap('jump'); dbg.step(); dbg.step(); release('jump');
let apexShort = 1e9;
for (let i = 0; i < 55; i++) { dbg.step(); apexShort = Math.min(apexShort, P().y); }
check('松开跳跃键跳得更矮', apexShort > apexLong + 2, '短跳顶点 y=' + apexShort.toFixed(1) + ' 长跳 y=' + apexLong.toFixed(1));

setupPlay(FLAT.x);
hold('down'); run(6);
check('按住↓先蹲', P().stance === 1 && P().h === 28, 'h=' + P().h + ' stance=' + P().stance);
run(16);
check('继续按住趴下', P().stance === 2 && P().h === 14, 'h=' + P().h);
const crawled0 = P().x;
hold('right'); run(30);
check('趴行有位移', P().x > crawled0 + 5, 'x=' + Math.round(P().x));
stopAll(); run(20);
check('松开起身', P().stance === 0 && P().h === 40, 'h=' + P().h);

setupPlay(FLAT.x);
W().enemies.push({ id: 999, kind: 'rush', x: P().x + 22, y: P().y, w: 14, h: 40, vx: 0, vy: 0,
  onGround: true, face: -1, alive: true, hp: 1, hitFlash: 0, attack: 0, prone: false,
  cool: 999, animT: 0, leg: 0, deadT: 0, fireT: 0 });
const score0 = W().score;
tap('attack');
let sawHitstop = false;
for (let i = 0; i < 14 && !sawHitstop; i++) { dbg.step(); sawHitstop = W().hitstop > 0; }
check('命中触发顿帧', sawHitstop, 'hitstop=' + W().hitstop);
run(25);
check('刺刀击杀得分', W().enemies.every(e => !e.alive) && W().score > score0, 'score=' + W().score);

setupPlay(LADDER.x, LADDER.y);
hold('up'); run(120);
check('爬梯到顶站稳', P().climbing === false && P().onGround === true && P().y + P().h <= 7 * 16 + 2, 'feet=' + Math.round(P().y + P().h));
release('up');
hold('down'); run(140);
check('下爬回地面', P().climbing === false && P().onGround === true && P().y + P().h >= 12 * 16 - 4, 'feet=' + Math.round(P().y + P().h));
run(120);
check('继续按↓不穿地板', P().y + P().h <= 12 * 16 + 1, 'feet=' + Math.round(P().y + P().h));
stopAll();

setupPlay(WATER.x, WATER.y);
P().invuln = 0;
run(12);
check('落水死亡', P().alive === false, 'alive=' + P().alive);
run(90);
check('死后重生且扣一命', P().alive === true && W().lives === 3, 'alive=' + P().alive + ' lives=' + W().lives);

setupPlay(W().level.pixelWidth - 30, 140);
run(6);
check('到终点进结算', dbg.state === 'clear', dbg.state);
tap('start'); run(3);
check('结算可回标题', dbg.state === 'title', dbg.state);
tap('start'); run(5);
check('可重新开始', dbg.state === 'play', dbg.state);
stopAll();

setupPlay(FLAT.x);
const OPS = ['left', 'right', 'up', 'down', 'jump', 'attack'];
let crashed = null;
try {
  for (let i = 0; i < 1000; i++) {
    stopAll();
    const op = OPS[(Math.random() * OPS.length) | 0];
    if (Math.random() < 0.3) tap(op); else hold(op);
    if (Math.random() < 0.2) hold(OPS[(Math.random() * OPS.length) | 0]);
    dbg.step();
    const pl = P();
    if (!isFinite(pl.x) || !isFinite(pl.y)) throw new Error('坐标 NaN @' + i);
    if (pl.y > 240) throw new Error('掉出屏幕 y=' + pl.y + ' @' + i);
    if (dbg.state !== 'play' && dbg.state !== 'gameover') dbg.state = 'play';
  }
} catch (e) { crashed = e; }
check('1000 tick 随机输入不崩', crashed === null, crashed ? String(crashed) : '');
stopAll();

console.log('\n' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
