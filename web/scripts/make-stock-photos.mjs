// Draws the placeholder "stock" photo bank as SVG so the repo needs no downloaded
// images (and no licences). Run `node scripts/make-stock-photos.mjs` to regenerate;
// real photos dropped into the device's photos folder show up alongside these.
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../public/photos/', import.meta.url);
mkdirSync(new URL('stock/', OUT), { recursive: true });
const W = 1200;
const H = 800;

const sky = (a, b) => `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#s)"/>`;
const sun = (x, y, r, c = '#fff2b0') => `<circle cx="${x}" cy="${y}" r="${r * 1.8}" fill="${c}" opacity=".25"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const hill = (y, c, amp = 80, seed = 0) => {
  let d = `M0 ${H} L0 ${y}`;
  for (let x = 0; x <= W; x += 100) d += ` L${x} ${y - Math.sin(x / 170 + seed) * amp - Math.cos(x / 90 + seed * 2) * amp * 0.3}`;
  return `<path d="${d} L${W} ${H}Z" fill="${c}"/>`;
};
const mountain = (x, w, h, c, snow = true) =>
  `<path d="M${x - w} ${H * 0.62} L${x} ${H * 0.62 - h} L${x + w} ${H * 0.62}Z" fill="${c}"/>` +
  (snow ? `<path d="M${x - w * 0.22} ${H * 0.62 - h * 0.78} L${x} ${H * 0.62 - h} L${x + w * 0.22} ${H * 0.62 - h * 0.78} L${x + w * 0.08} ${H * 0.62 - h * 0.7} L${x} ${H * 0.62 - h * 0.78} L${x - w * 0.08} ${H * 0.62 - h * 0.7}Z" fill="#fff"/>` : '');
const pine = (x, y, s, c = '#1f5d3a') => `<path d="M${x} ${y - 140 * s} l${40 * s} ${70 * s} h${-22 * s} l${34 * s} ${60 * s} h${-104 * s} l${34 * s} ${-60 * s} h${-22 * s}z" fill="${c}"/><rect x="${x - 6 * s}" y="${y - 20 * s}" width="${12 * s}" height="${30 * s}" fill="#5a3b22"/>`;
const round = (x, y, s, c, trunk = '#5a3b22') => `<rect x="${x - 7 * s}" y="${y - 50 * s}" width="${14 * s}" height="${60 * s}" fill="${trunk}"/><circle cx="${x}" cy="${y - 90 * s}" r="${55 * s}" fill="${c}"/><circle cx="${x - 35 * s}" cy="${y - 62 * s}" r="${38 * s}" fill="${c}"/><circle cx="${x + 35 * s}" cy="${y - 62 * s}" r="${38 * s}" fill="${c}"/>`;
const cloud = (x, y, s = 1, c = '#fff', o = 0.9) => `<g fill="${c}" opacity="${o}"><ellipse cx="${x}" cy="${y}" rx="${90 * s}" ry="${32 * s}"/><ellipse cx="${x - 45 * s}" cy="${y - 18 * s}" rx="${45 * s}" ry="${30 * s}"/><ellipse cx="${x + 30 * s}" cy="${y - 28 * s}" rx="${50 * s}" ry="${36 * s}"/></g>`;
const flower = (x, y, c, r = 22, stem = '#3c8a3c') => `<path d="M${x} ${y} V${H}" stroke="${stem}" stroke-width="7"/>` + [0, 72, 144, 216, 288].map((a) => `<ellipse cx="${x}" cy="${y - r * 0.9}" rx="${r * 0.55}" ry="${r}" fill="${c}" transform="rotate(${a} ${x} ${y})"/>`).join('') + `<circle cx="${x}" cy="${y}" r="${r * 0.45}" fill="#f6c343"/>`;
const stars = (n) => Array.from({ length: n }, (_, i) => `<circle cx="${(i * 197) % W}" cy="${(i * 113) % (H * 0.6)}" r="${1 + (i % 3)}" fill="#fff" opacity="${0.5 + (i % 5) / 10}"/>`).join('');
const table = (c1 = '#c99a6b', c2 = '#b4814f') => `<rect width="${W}" height="${H}" fill="${c1}"/>` + Array.from({ length: 8 }, (_, i) => `<rect y="${i * 100}" width="${W}" height="4" fill="${c2}" opacity=".5"/>`).join('');
const plate = (cx, cy, r) => `<ellipse cx="${cx}" cy="${cy + 14}" rx="${r}" ry="${r * 0.7}" fill="#000" opacity=".18"/><ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.7}" fill="#fff"/><ellipse cx="${cx}" cy="${cy}" rx="${r * 0.82}" ry="${r * 0.56}" fill="#f2efe8"/>`;

const photos = [
  ['Landscapes', 'Mountain lake', () => sky('#9fd0f2', '#e8f4fb') + mountain(380, 330, 300, '#6d7f99') + mountain(780, 380, 360, '#7a8cab') + hill(520, '#3f7d4f', 40) + `<rect y="${H * 0.62}" width="${W}" height="${H * 0.38}" fill="#4f9bc4"/><rect y="${H * 0.62}" width="${W}" height="60" fill="#6fb4d6" opacity=".6"/>` + pine(120, 560, 1.4) + pine(1080, 570, 1.6) + cloud(300, 150) + cloud(900, 110, 1.3)],
  ['Landscapes', 'Prairie sunset', () => sky('#2d3a73', '#ff9a5a') + sun(600, 520, 70, '#ffd27a') + hill(600, '#3a2f4a', 25, 1) + hill(680, '#2a2236', 20, 3) + cloud(250, 200, 1.2, '#ffb48a', 0.7) + cloud(900, 260, 1, '#ff9a8a', 0.6)],
  ['Landscapes', 'Pine forest', () => sky('#bfe0e8', '#eaf5f1') + hill(560, '#4a8a5a', 50) + [60, 180, 300, 420, 560, 700, 830, 960, 1090].map((x, i) => pine(x, 640 + (i % 3) * 40, 1.1 + (i % 4) * 0.18)).join('') + cloud(700, 130, 1.4)],
  ['Landscapes', 'Rolling hills', () => sky('#8ec9f0', '#f3fbff') + sun(980, 160, 55) + hill(430, '#8cc56a', 70, 0) + hill(540, '#6fb050', 70, 2) + hill(660, '#549a3e', 60, 4) + cloud(300, 150, 1.3) + cloud(640, 230, 0.9)],
  ['Seasons', 'Spring blossoms', () => sky('#cfe9ff', '#f7fbff') + hill(600, '#9bd27a', 40) + round(300, 640, 2.2, '#f7b6cf') + round(820, 660, 2.6, '#f9c9dc') + [100, 200, 520, 600, 1020, 1100].map((x, i) => flower(x, 700 + (i % 2) * 20, ['#ff7aa8', '#ffd24a', '#fff'][i % 3], 20)).join('') + cloud(650, 120)],
  ['Seasons', 'Summer field', () => sky('#5bb6f2', '#cdeeff') + sun(200, 150, 70, '#fff6a8') + hill(480, '#e8c648', 50, 1) + hill(600, '#d3ae2f', 40, 2) + [150, 330, 520, 720, 900, 1060].map((x, i) => flower(x, 640 + (i % 3) * 30, '#f6c20a', 34)).join('') + cloud(700, 170, 1.4)],
  ['Seasons', 'Autumn trees', () => sky('#f6d9a8', '#fdf1dc') + hill(560, '#c58a3c', 40) + round(240, 640, 2.4, '#d9531e') + round(620, 660, 2.8, '#f0a020') + round(980, 650, 2.3, '#b8341a') + `<ellipse cx="600" cy="760" rx="520" ry="30" fill="#a8602a" opacity=".5"/>`],
  ['Seasons', 'Winter snow', () => sky('#b9cde6', '#eef3fa') + hill(560, '#fafcff', 40) + hill(660, '#e6eef8', 30, 2) + pine(250, 640, 1.5, '#2c5a4a') + pine(900, 620, 1.9, '#2c5a4a') + pine(1080, 660, 1.2, '#2c5a4a') + Array.from({ length: 60 }, (_, i) => `<circle cx="${(i * 211) % W}" cy="${(i * 97) % H}" r="${2 + (i % 4)}" fill="#fff"/>`).join('')],
  ['Food', 'Fresh bread', () => table() + `<ellipse cx="600" cy="450" rx="340" ry="150" fill="#000" opacity=".2"/><ellipse cx="600" cy="420" rx="330" ry="140" fill="#d89a4a"/><ellipse cx="600" cy="400" rx="300" ry="110" fill="#e9b266"/>` + [380, 500, 620, 740].map((x) => `<path d="M${x} 330 q40 40 20 100" stroke="#c07a2e" stroke-width="12" fill="none" stroke-linecap="round"/>`).join('')],
  ['Food', 'Pancake stack', () => table('#e8dcc8', '#d7c8ae') + plate(600, 480, 330) + [0, 1, 2, 3, 4].map((i) => `<ellipse cx="600" cy="${470 - i * 38}" rx="210" ry="62" fill="${i % 2 ? '#e2a85a' : '#eab96d'}"/><ellipse cx="600" cy="${460 - i * 38}" rx="210" ry="56" fill="#f1c47c"/>`).join('') + `<ellipse cx="600" cy="270" rx="120" ry="38" fill="#a8441c" opacity=".85"/><rect x="565" y="215" width="70" height="34" rx="6" fill="#ffe27a"/>`],
  ['Food', 'Tomato soup', () => table('#d8d2c4', '#c7bfae') + plate(600, 430, 360) + `<ellipse cx="600" cy="420" rx="250" ry="150" fill="#c7351e"/><ellipse cx="600" cy="410" rx="225" ry="130" fill="#e0502d"/><ellipse cx="620" cy="400" rx="60" ry="26" fill="#fff" opacity=".8"/>` + [[470, 380], [700, 440], [560, 470]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="22" ry="10" fill="#4a8a3a" transform="rotate(20 ${x} ${y})"/>`).join('')],
  ['Food', 'Garden salad', () => table('#efe7d6', '#ddd2bb') + plate(600, 430, 360) + [[480, 380, '#4a9a3c'], [620, 350, '#5cb04a'], [720, 420, '#3f8a34'], [520, 470, '#5cb04a'], [640, 480, '#4a9a3c']].map(([x, y, c]) => `<ellipse cx="${x}" cy="${y}" rx="100" ry="46" fill="${c}"/>`).join('') + [[480, 400], [680, 380], [600, 450], [740, 460]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="26" fill="#e03a2a"/>`).join('') + [[560, 360], [700, 430]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="18" fill="#f7d44a"/>`).join('')],
  ['Garden', 'Tulips', () => sky('#d9efff', '#f5fbff') + hill(560, '#8cc56a', 30) + Array.from({ length: 14 }, (_, i) => { const x = 70 + i * 80; const c = ['#e8324c', '#ffd23a', '#ff8fb0', '#a64cd0'][i % 4]; return `<path d="M${x} ${420 + (i % 3) * 30} V${H}" stroke="#3c8a3c" stroke-width="9"/><path d="M${x - 26} ${410 + (i % 3) * 30} q26 70 52 0 l-12 -40 l-14 22 l-14 -22z" fill="${c}"/>`; }).join('')],
  ['Garden', 'Sunflowers', () => sky('#79c6f5', '#d8f1ff') + hill(520, '#6fb050', 40) + [200, 450, 700, 960].map((x, i) => `<path d="M${x} ${300 + i * 20} V${H}" stroke="#3c8a3c" stroke-width="14"/>` + Array.from({ length: 16 }, (_, k) => `<ellipse cx="${x}" cy="${300 + i * 20 - 70}" rx="22" ry="60" fill="#f6b90a" transform="rotate(${k * 22.5} ${x} ${300 + i * 20})"/>`).join('') + `<circle cx="${x}" cy="${300 + i * 20}" r="46" fill="#5a3b22"/>`).join('')],
  ['Garden', 'Vegetable rows', () => sky('#bfe3f7', '#f2faff') + `<rect y="440" width="${W}" height="${H - 440}" fill="#7a5233"/>` + [0, 1, 2, 3].map((r) => `<rect y="${480 + r * 80}" width="${W}" height="14" fill="#5f3f26"/>` + Array.from({ length: 10 }, (_, c) => `<circle cx="${60 + c * 120 + (r % 2) * 40}" cy="${462 + r * 80}" r="${22 + r * 3}" fill="${['#4a9a3c', '#5cb04a', '#3f8a34', '#6fc05a'][r]}"/>`).join('')).join('') + cloud(300, 180, 1.3)],
  ['Garden', 'Herb pots', () => `<rect width="${W}" height="${H}" fill="#e7ddc9"/><rect y="560" width="${W}" height="240" fill="#b98a5a"/>` + [230, 600, 970].map((x, i) => `<path d="M${x - 90} 520 h180 l-24 200 h-132z" fill="#c8643a"/>` + Array.from({ length: 9 }, (_, k) => `<ellipse cx="${x - 70 + k * 18}" cy="${430 - (k % 3) * 30}" rx="24" ry="62" fill="${['#4a9a3c', '#5cb04a', '#3f8a34'][i]}" transform="rotate(${-40 + k * 10} ${x} 520)"/>`).join('')).join('')],
  ['Sky', 'Sunrise', () => sky('#5a63b8', '#ffc58a') + sun(600, 560, 90, '#fff0b0') + hill(620, '#3a3358', 30, 5) + hill(700, '#241f3d', 25, 1) + cloud(300, 260, 1.2, '#ffd9b0', 0.7) + cloud(900, 200, 1, '#ffc4a0', 0.7)],
  ['Sky', 'Starry night', () => sky('#0b1230', '#2b3a73') + stars(90) + `<circle cx="900" cy="170" r="70" fill="#f5f0d0"/><circle cx="925" cy="155" r="64" fill="#0f1a3d" opacity=".25"/>` + hill(640, '#10162d', 30) + pine(200, 690, 1.6, '#0a1a1a') + pine(1000, 700, 1.9, '#0a1a1a')],
  ['Sky', 'Rainbow', () => sky('#8cc7ee', '#e5f4ff') + ['#e8324c', '#f58a2a', '#f6d33a', '#4aa84a', '#3a8ae0', '#6a4ac0'].map((c, i) => `<path d="M${120 + i * 18} 620 A${480 - i * 18} ${480 - i * 18} 0 0 1 ${1080 - i * 18} 620" stroke="${c}" stroke-width="18" fill="none" opacity=".85"/>`).join('') + hill(640, '#6fb050', 40) + cloud(160, 600, 1.4) + cloud(1050, 600, 1.4)],
  ['Sky', 'Passing storm', () => sky('#46506b', '#9aa6bd') + cloud(300, 200, 2, '#5b6580', 1) + cloud(800, 160, 2.4, '#4d576f', 1) + cloud(1000, 300, 1.6, '#69738c', 1) + Array.from({ length: 70 }, (_, i) => `<path d="M${(i * 173) % W} ${300 + ((i * 89) % 380)} l-12 38" stroke="#cfe0f5" stroke-width="3" opacity=".7"/>`).join('') + `<path d="M620 300 l-50 110 h50 l-40 130 l120 -160 h-60 l40 -80z" fill="#ffe66a"/>` + hill(700, '#2e3b36', 30)],
];

const manifest = photos.map(([category, title, draw], i) => {
  const id = `${category}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const file = `stock/${id}.svg`;
  writeFileSync(new URL(file, OUT), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${draw()}</svg>\n`);
  return { id, title, category, file, stock: true };
});
writeFileSync(new URL('manifest.json', OUT), JSON.stringify({ photos: manifest }, null, 2) + '\n');
console.log(`Wrote ${manifest.length} photos`);
