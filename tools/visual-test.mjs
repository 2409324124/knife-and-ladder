// 视觉冒烟：开真浏览器截图到 shots/，人工看一眼
// 需要：npm i puppeteer-core，机器上有 Chrome/Edge
// 用法：node tools/visual-test.mjs
import { existsSync, mkdirSync } from 'node:fs';

let puppeteer;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  console.log('需要 puppeteer-core：npm i puppeteer-core');
  process.exit(1);
}

const CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium-browser', '/usr/bin/chromium',
];
const exe = CANDIDATES.find(p => existsSync(p));
if (!exe) { console.log('找不到浏览器'); process.exit(1); }

const outDir = new URL('../shots/', import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

const b = await puppeteer.launch({ executablePath: exe, headless: 'new',
  args: ['--force-prefers-reduced-motion'], defaultViewport: { width: 768, height: 672 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

const url = new URL('../index.html', import.meta.url).href;
await p.goto(url);
await new Promise(r => setTimeout(r, 800));
await p.screenshot({ path: outDir + 'title.png' });
await p.click('canvas');
await new Promise(r => setTimeout(r, 2000));
await p.screenshot({ path: outDir + 'play.png' });
await b.close();

if (errs.length) { console.log('控制台报错：'); errs.forEach(e => console.log('  ' + e)); process.exit(1); }
console.log('已生成 shots/title.png 和 shots/play.png，0 报错');
