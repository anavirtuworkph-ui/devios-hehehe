// Procedural pixel-art texture generation. Everything visual in the game is drawn here at
// boot time with Canvas2D, then used as ordinary Phaser textures. No external art assets.
import { ERAS } from '../data/eras.js';
import { ALLIES } from '../data/allies.js';
import { BOSSES } from '../data/bosses.js';
import { ERA_ENEMIES, ARCHETYPES } from '../data/enemies.js';
import { WEAPONS } from '../data/weapons.js';

const OUTLINE = '#120e18';

function canvas(scene, key, w, h, draw, { outline = null, crisp = true } = {}) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  if (crisp || outline) postProcess(ctx, w, h, outline);
  tex.refresh();
  return tex;
}

// Hard-edge alpha (keeps the pixel look even for path-drawn shapes) + optional 1px outline.
function postProcess(ctx, w, h, outline) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 110 ? 0 : 255;
  if (outline) {
    const [r, g, b] = hex(outline);
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] === 255;
    const marks = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (solid(x, y)) continue;
        if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) marks.push((y * w + x) * 4);
      }
    }
    for (const i of marks) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
  }
  ctx.putImageData(img, 0, 0);
}

function hex(c) {
  const n = parseInt(c.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(c, amt) {
  const [r, g, b] = hex(c);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * (amt > 0 ? 255 - v : v))));
  return `#${[f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const R = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

// ---------------------------------------------------------------------------------------
// Characters (18x26 per frame, two walk frames side by side)
// ---------------------------------------------------------------------------------------
function drawHumanoid(ctx, look, ox, oy, frame) {
  const L = { skin: '#d9a87a', hair: '#222', hairStyle: 'short', top: '#888', top2: '#bbb', bottom: '#444', shoes: '#222', acc: [], ...look };
  const acc = L.acc || [];
  const x0 = ox + 1, y0 = oy + 1;
  const P = (c, x, y, w, h) => R(ctx, c, x0 + x, y0 + y, w, h);
  const wide = L.build === 'wide', slim = L.build === 'slim';
  const bx = wide ? 2 : slim ? 4 : 3, bw = wide ? 12 : slim ? 8 : 10;

  // Cape / long coat behind body
  if (acc.includes('cape')) P(L.cape || '#8a1a1a', bx - 1, 11, bw + 2, 10);
  // Legs
  const legShift = frame === 1 ? 1 : 0;
  P(L.bottom, 5, 18, 3, 4 - legShift);
  P(L.bottom, 9, 18, 3, 3 + legShift);
  P(L.shoes, 5, 22 - legShift, 3, 2);
  P(L.shoes, 9, 21 + legShift, 3, 2);
  // Body
  P(L.top, bx, 11, bw, 7);
  P(shade(L.top, -0.25), bx, 17, bw, 1);
  P(L.top2, 7, 11, 3, 2); // collar
  if (acc.includes('labcoat')) {
    P('#f2f2f2', bx, 11, 3, 10);
    P('#f2f2f2', bx + bw - 3, 11, 3, 10);
    P('#d0d0d8', bx + 2, 12, 1, 9);
  }
  if (acc.includes('sash')) for (let i = 0; i < 6; i++) P(L.top2, bx + 1 + i, 11 + i, 2, 1);
  if (acc.includes('medals')) { P('#ffd400', bx + 2, 13, 1, 2); P('#e04040', bx + 3, 13, 1, 2); P('#40a0ff', bx + 4, 13, 1, 2); }
  if (acc.includes('bowtie')) { P('#b02020', 7, 11, 3, 1); P('#801010', 8, 11, 1, 1); }
  if (acc.includes('carnation')) P('#ff3060', bx + 1, 12, 2, 2);
  if (acc.includes('rosary')) { for (let i = 0; i < 4; i++) P('#e8e0c0', 6 + i, 13 + (i % 2), 1, 1); P('#e8e0c0', 8, 15, 1, 2); }
  // Arms
  P(L.top, bx - 1, 12, 1, 5);
  P(L.top, bx + bw, 12, 1, 5);
  const fist = acc.includes('fist');
  P(acc.includes('gloves') ? '#f0f0f0' : L.skin, bx - 1, 17, fist ? 2 : 1, fist ? 2 : 1);
  P(acc.includes('gloves') ? '#f0f0f0' : L.skin, bx + bw - (fist ? 1 : 0), 17, fist ? 2 : 1, fist ? 2 : 1);
  if (acc.includes('tattoo')) { P('#2a1a40', bx - 1, 13, 1, 1); P('#2a1a40', bx + bw, 14, 1, 1); P('#2a1a40', 6, 14, 1, 1); P('#2a1a40', 10, 15, 1, 1); }
  if (acc.includes('katana')) { P('#2a2a2a', bx + bw + 1, 13, 1, 8); P('#c8a040', bx + bw + 1, 13, 1, 1); }
  // Head
  P(L.skin, 4, 3, 9, 8);
  P(shade(L.skin, -0.18), 4, 10, 9, 1);
  // Hair styles
  const H = L.hair;
  switch (L.hairStyle) {
    case 'long': P(H, 3, 2, 11, 3); P(H, 3, 2, 2, 9); P(H, 12, 2, 2, 9); break;
    case 'messy': P(H, 3, 1, 11, 3); P(H, 2, 2, 2, 5); P(H, 13, 2, 2, 5); P(H, 5, 0, 2, 1); P(H, 10, 0, 2, 1); P(H, 1, 3, 1, 2); P(H, 15, 3, 1, 2); break;
    case 'slick': P(H, 4, 2, 9, 2); P(H, 4, 2, 1, 4); P(shade(H, 0.3), 6, 2, 3, 1); break;
    case 'bun': P(H, 4, 2, 9, 2); P(H, 6, 0, 5, 2); P(H, 4, 2, 1, 5); P(H, 12, 2, 1, 5); break;
    case 'receding': P(H, 4, 3, 2, 3); P(H, 11, 3, 2, 3); P(H, 5, 2, 7, 1); break;
    case 'tonsure': P(H, 4, 4, 2, 3); P(H, 11, 4, 2, 3); P(H, 5, 3, 7, 1); P(L.skin, 6, 2, 5, 2); break;
    case 'bald': break;
    default: P(H, 4, 2, 9, 2); P(H, 4, 2, 1, 3); P(H, 12, 2, 1, 3);
  }
  // Face
  const eye = L.echo ? '#7ff6ff' : '#141018';
  P(eye, 6, 6, 1, 2);
  P(eye, 10, 6, 1, 2);
  if (acc.includes('glasses')) { P('#2a2a2a', 5, 6, 3, 1); P('#2a2a2a', 9, 6, 3, 1); P('#2a2a2a', 8, 6, 1, 1); }
  if (acc.includes('sunglasses')) { P('#0a0a0a', 5, 6, 7, 2); P('#6a6aff', 6, 6, 1, 1); }
  if (acc.includes('goggles')) { P('#7a5a2a', 4, 3, 9, 1); P('#47e0ff', 5, 2, 3, 2); P('#47e0ff', 9, 2, 3, 2); }
  if (acc.includes('mustache')) P(shade(H, 0.1), 6, 9, 5, 1);
  if (acc.includes('beard')) { P(H, 4, 8, 9, 3); P(L.skin, 6, 8, 5, 1); P('#5a2020', 7, 9, 3, 1); }
  else P(shade(L.skin, -0.35), 7, 9, 3, 1); // mouth
  if (acc.includes('pipe')) { P('#c8a060', 10, 9, 3, 1); P('#c8a060', 12, 8, 1, 1); }
  // Hats
  const HC = L.hatColor || '#555';
  switch (L.hat) {
    case 'helmet': P(HC, 3, 1, 11, 4); P(shade(HC, -0.3), 2, 4, 13, 1); P(shade(HC, 0.25), 5, 1, 4, 1); break;
    case 'cap': P(HC, 4, 1, 9, 3); P(shade(HC, -0.3), 4, 4, 10, 1); break;
    case 'officer': P(HC, 3, 0, 11, 3); P('#c8a040', 4, 3, 9, 1); P('#111', 4, 4, 10, 1); P('#ffd400', 8, 1, 1, 1); break;
    case 'kepi': P(HC, 4, 0, 9, 4); P('#111', 4, 4, 10, 1); P('#d9b44a', 4, 3, 9, 1); break;
    case 'morion': P(HC, 3, 1, 11, 3); P(shade(HC, -0.25), 1, 4, 15, 1); P(HC, 7, -1, 3, 2); P('#ff4040', 8, -1, 1, 1); break;
    case 'headband': P(HC, 4, 4, 9, 1); P(HC, 13, 4, 2, 3); break;
    case 'bandana': P(HC, 4, 1, 9, 3); P(HC, 13, 3, 2, 2); P('#f0f0f0', 6, 2, 1, 1); break;
    case 'tophat': P(HC, 5, -1, 7, 4); P('#c02020', 5, 2, 7, 1); P(HC, 3, 3, 11, 1); break;
    case 'campaign': P(HC, 5, 0, 7, 3); P(shade(HC, -0.2), 2, 3, 13, 1); P(shade(HC, -0.4), 8, 0, 1, 2); break;
    case 'beret': P(HC, 3, 1, 10, 3); break;
    default: break;
  }
  if (L.glitch) { P('#ff4fd8', 2, 8 + frame, 2, 1); P('#47e0ff', 13, 14 - frame, 2, 1); }
}

function drawRobot(ctx, look, ox, oy, frame) {
  const x0 = ox + 1, y0 = oy + 1;
  const P = (c, x, y, w, h) => R(ctx, c, x0 + x, y0 + y, w, h);
  const big = look.big;
  const body = look.top || '#5d6b7a';
  P('#999', 8, 0, 1, 3);
  P(look.top2 || '#47e0ff', 7, 0, 3, 1);
  P(body, big ? 1 : 3, 3, big ? 15 : 11, 8);
  P('#0c0c14', 5, 5, 7, 3);
  P(look.top2 || '#47e0ff', 6 + frame, 6, 2, 1);
  P(shade(body, -0.25), big ? 1 : 3, 11, big ? 15 : 11, 1);
  P(body, big ? 2 : 4, 12, big ? 13 : 9, 6);
  P(look.top2 || '#47e0ff', 7, 14, 3, 2);
  P('#333', 4, 18, 3, 4 - frame);
  P('#333', 10, 18, 3, 3 + frame);
  P('#222', 3, 21, 5, 2);
  P('#222', 9, 21, 5, 2);
  if (big) { P('#ffd400', 1, 12, 1, 4); P('#ffd400', 15, 12, 1, 4); }
}

function drawBeast(ctx, look, ox, oy, frame) {
  const x0 = ox + 1, y0 = oy + 1;
  const P = (c, x, y, w, h) => R(ctx, c, x0 + x, y0 + y, w, h);
  const c = look.top;
  P(c, 2, 11, 12, 7);
  P(shade(c, 0.2), 3, 11, 10, 2);
  P(c, 11, 8, 5, 6); // head
  P(look.top2, 15, 11, 1, 2);
  P('#111', 13, 9, 1, 1);
  if (look.beast === 'boar') { P('#f0f0e0', 15, 13, 1, 2); P(shade(c, -0.3), 3, 10, 8, 1); }
  else { P(c, 12, 6, 2, 2); P(shade(c, -0.2), 1, 10, 2, 3); }
  P(shade(c, -0.3), 3, 18, 2, 3 - frame);
  P(shade(c, -0.3), 7, 18, 2, 2 + frame);
  P(shade(c, -0.3), 11, 18, 2, 3 - frame);
}

export function characterTexture(scene, key, look) {
  const fw = 18, fh = 26;
  const tex = canvas(scene, key, fw * 2, fh, (ctx) => {
    for (let f = 0; f < 2; f++) {
      if (look.robot) drawRobot(ctx, look, f * fw, 0, f);
      else if (look.beast) drawBeast(ctx, look, f * fw, 0, f);
      else drawHumanoid(ctx, look, f * fw, 0, f);
    }
  }, { outline: look.echo ? '#1a4a5a' : OUTLINE });
  tex.add(0, 0, 0, 0, fw, fh);
  tex.add(1, 0, fw, 0, fw, fh);
  return tex;
}

export const ANON_LOOK = { skin: '#e8c4a0', hair: '#e8e8f0', hairStyle: 'messy', top: '#e07a2a', top2: '#2a2a3a', bottom: '#3a3a5a', shoes: '#2a2a2a', acc: ['labcoat', 'goggles'] };

// ---------------------------------------------------------------------------------------
// DeVios — a 2026 Toyota Vios sedan with DeLorean-style time-machine gear (original art)
// ---------------------------------------------------------------------------------------
const VIOS = { body: '#c9ced6', bodyDark: '#8e95a1', bodyLight: '#eef1f5', glass: '#1d2a44', glassHi: '#3c5a8a', grille: '#15161c', tail: '#d02030', cable: ['#ff6a1a', '#1a1a1a', '#e8d040'], glow: '#7ff6ff' };

// Top-down (car faces up). 44 x 80.
function drawViosTop(ctx, glow) {
  const g = glow ? '#e8ffff' : VIOS.glow;
  // Flight-mode wheels: folded flat, so from above they show as hover discs under the body
  for (const [wx, wy] of [[6, 20], [38, 20], [6, 60], [38, 60]]) {
    ctx.fillStyle = glow ? '#e8ffff' : VIOS.glow; ctx.beginPath(); ctx.arc(wx, wy, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(wx, wy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9aa0aa'; ctx.beginPath(); ctx.arc(wx, wy, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = glow ? '#e8ffff' : VIOS.glow; ctx.beginPath(); ctx.arc(wx, wy, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  // Body silhouette (rounded sedan)
  ctx.fillStyle = VIOS.body;
  ctx.beginPath();
  ctx.moveTo(12, 4); ctx.quadraticCurveTo(22, 1, 32, 4);
  ctx.quadraticCurveTo(39, 7, 39, 16); ctx.lineTo(40, 64);
  ctx.quadraticCurveTo(40, 75, 31, 77); ctx.lineTo(13, 77);
  ctx.quadraticCurveTo(4, 75, 4, 64); ctx.lineTo(5, 16);
  ctx.quadraticCurveTo(5, 7, 12, 4); ctx.fill();
  // Hood crease lines
  R(ctx, VIOS.bodyLight, 14, 7, 1, 12); R(ctx, VIOS.bodyLight, 29, 7, 1, 12);
  // Front: wide trapezoid lower grille + slim headlights (Vios face)
  ctx.fillStyle = VIOS.grille;
  ctx.beginPath(); ctx.moveTo(13, 2); ctx.lineTo(31, 2); ctx.lineTo(28, 5); ctx.lineTo(16, 5); ctx.fill();
  R(ctx, '#dfe9ff', 7, 5, 6, 2); R(ctx, '#dfe9ff', 31, 5, 6, 2);
  R(ctx, '#9ab0ff', 8, 6, 3, 1); R(ctx, '#9ab0ff', 33, 6, 3, 1);
  R(ctx, '#c02020', 21, 3, 2, 1); // badge
  // Windshield
  ctx.fillStyle = VIOS.glass;
  ctx.beginPath(); ctx.moveTo(10, 22); ctx.lineTo(34, 22); ctx.lineTo(31, 31); ctx.lineTo(13, 31); ctx.fill();
  R(ctx, VIOS.glassHi, 14, 24, 6, 1);
  // Roof
  R(ctx, VIOS.bodyLight, 12, 31, 20, 16);
  R(ctx, VIOS.bodyDark, 12, 31, 1, 16); R(ctx, VIOS.bodyDark, 31, 31, 1, 16);
  R(ctx, '#20232a', 21, 45, 2, 2); // shark-fin antenna
  // Roof-mounted flux light bar (time machine add-on)
  R(ctx, '#333', 15, 36, 14, 4); R(ctx, g, 16, 37, 12, 2);
  // Rear window
  ctx.fillStyle = VIOS.glass;
  ctx.beginPath(); ctx.moveTo(13, 47); ctx.lineTo(31, 47); ctx.lineTo(33, 55); ctx.lineTo(11, 55); ctx.fill();
  R(ctx, VIOS.glassHi, 15, 49, 5, 1);
  // Mirrors
  R(ctx, VIOS.bodyDark, 2, 23, 3, 3); R(ctx, VIOS.bodyDark, 39, 23, 3, 3);
  // Rear-mounted temporal reactor on the trunk
  R(ctx, '#555b66', 10, 57, 24, 14);
  R(ctx, '#2a2e36', 11, 58, 22, 12);
  ctx.fillStyle = '#7a808c'; ctx.beginPath(); ctx.arc(22, 64, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(22, 64, 3, 0, Math.PI * 2); ctx.fill();
  // Y-shaped flux core
  R(ctx, '#fff', 22, 63, 1, 3); R(ctx, '#fff', 20, 62, 1, 1); R(ctx, '#fff', 24, 62, 1, 1);
  // Vents / coils
  for (let i = 0; i < 4; i++) { R(ctx, '#1a1a1a', 12, 59 + i * 3, 4, 1); R(ctx, '#1a1a1a', 28, 59 + i * 3, 4, 1); }
  // Exposed cables running along both sides
  VIOS.cable.forEach((c, i) => { R(ctx, c, 6 + i, 20, 1, 44); R(ctx, c, 37 - i, 20, 1, 44); });
  R(ctx, '#ff6a1a', 9, 56, 4, 1); R(ctx, '#ff6a1a', 31, 56, 4, 1);
  // Side glow strips (activation coils)
  R(ctx, g, 4, 30, 1, 22); R(ctx, g, 39, 30, 1, 22);
  // Tail lights
  R(ctx, VIOS.tail, 8, 74, 7, 2); R(ctx, VIOS.tail, 29, 74, 7, 2);
  // Exhaust-style tri-vents on the rear bumper
  R(ctx, g, 18, 77, 2, 2); R(ctx, g, 21, 77, 2, 2); R(ctx, g, 24, 77, 2, 2);
}

// Side view (car faces right). 132 x 52. Traced from a reference photo of a silver
// Toyota Vios sedan (3rd-gen facelift): notchback roof, long flat trunk deck, wedge tail
// lamp, black B-pillar, sloping hood with swept headlight and a deep front bumper.
// Wheels are folded flat underneath in DeLorean-style "flight mode", with hover glow.
function drawViosSide(ctx, glow, tc = true) {
  const g = glow ? '#e8ffff' : VIOS.glow;
  const W1 = 29.5, W2 = 104.5, AY = 42; // wheel-arch centres (wheelbase ~61% of length)
  // Hover glow beneath the car
  ctx.fillStyle = g;
  ctx.globalAlpha = 0.55;
  ctx.beginPath(); ctx.ellipse(W1, 49, 11, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(W2, 49, 11, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  R(ctx, g, 42, 46, 50, 1);
  // Body silhouette
  ctx.fillStyle = VIOS.body;
  ctx.beginPath();
  ctx.moveTo(6, 41.5); // rear bumper bottom
  ctx.quadraticCurveTo(4, 36, 4.4, 20); // rear face
  ctx.lineTo(6, 18.2); // trunk lid edge
  ctx.lineTo(19, 17.6); // long flat trunk deck
  ctx.quadraticCurveTo(28, 15, 36, 10.8); // rear window
  ctx.quadraticCurveTo(58, 6, 82.4, 11.2); // gently arched roof
  ctx.quadraticCurveTo(89, 15, 96, 20.3); // windshield
  ctx.quadraticCurveTo(107, 22.5, 114, 25.6); // sloping hood
  ctx.quadraticCurveTo(122, 27, 125.5, 29.4); // nose
  ctx.quadraticCurveTo(128.5, 31, 128, 36); // front bumper face
  ctx.lineTo(127.5, 42.6);
  ctx.lineTo(122.5, 44.5); // chin
  ctx.lineTo(8, 44.5);
  ctx.closePath();
  ctx.fill();
  // Black rocker / lower sill between the wheels
  R(ctx, '#2a2d34', 39, 42, 56, 2);
  R(ctx, VIOS.bodyDark, 6, 39, 120, 3);
  // Wheel arches (empty: wheels are folded flat for flight)
  ctx.fillStyle = '#15161c';
  for (const wx of [W1, W2]) { ctx.beginPath(); ctx.arc(wx, AY + 1, 10, Math.PI, 0); ctx.lineTo(wx + 10, 45); ctx.lineTo(wx - 10, 45); ctx.fill(); }
  // Greenhouse: dark window frame, then glass
  ctx.fillStyle = '#20232a';
  ctx.beginPath(); ctx.moveTo(30.5, 20); ctx.lineTo(36.5, 11.3); ctx.quadraticCurveTo(58, 7, 82.8, 12.3); ctx.lineTo(94, 20.8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = VIOS.glass;
  ctx.beginPath(); ctx.moveTo(32.5, 19.3); ctx.lineTo(37.5, 12.5); ctx.quadraticCurveTo(58, 8.4, 82, 13.4); ctx.lineTo(91.5, 20.2); ctx.closePath(); ctx.fill();
  R(ctx, '#20232a', 59, 9.5, 2, 11); // black B-pillar
  R(ctx, '#20232a', 87, 13, 1, 7); // front quarter-glass divider
  R(ctx, VIOS.glassHi, 64, 13, 10, 1);
  R(ctx, VIOS.glassHi, 40, 13, 9, 1);
  // Time circuits glow through the front side window
  if (tc) { R(ctx, '#ff3030', 65, 16, 4, 1); R(ctx, '#30ff60', 70, 16, 4, 1); R(ctx, '#ffb020', 75, 16, 4, 1); }
  // Shoulder character line (headlight -> tail lamp)
  for (let x = 21; x <= 118; x++) R(ctx, VIOS.bodyLight, x, Math.round(23.1 + (x - 21) * 0.043), 1, 1);
  // Lower door crease, rising slightly toward the rear
  for (let x = 40; x <= 93; x++) R(ctx, VIOS.bodyDark, x, Math.round(37.3 - (x - 40) * 0.02), 1, 1);
  // Door shut lines and handles
  R(ctx, VIOS.bodyDark, 32, 21, 1, 15);
  R(ctx, VIOS.bodyDark, 60, 21, 1, 21);
  R(ctx, VIOS.bodyDark, 94, 21, 1, 18);
  R(ctx, VIOS.bodyDark, 37, 24, 4, 1); R(ctx, VIOS.bodyDark, 65, 25, 4, 1);
  // Door mirror
  R(ctx, VIOS.bodyDark, 86, 18, 5, 3); R(ctx, '#20232a', 88, 21, 2, 1);
  // Shark-fin antenna at the rear of the roof
  ctx.fillStyle = '#20232a'; ctx.beginPath(); ctx.moveTo(35, 11); ctx.lineTo(38, 8.4); ctx.lineTo(40, 10.6); ctx.fill();
  // Swept-back headlight
  ctx.fillStyle = '#dfe9ff'; ctx.beginPath(); ctx.moveTo(109, 24.8); ctx.lineTo(125.5, 28.6); ctx.lineTo(124.5, 30.6); ctx.lineTo(112, 27.4); ctx.fill();
  R(ctx, '#9ab0ff', 115, 28, 8, 1);
  // Deep front bumper with black lower grille and corner intake
  ctx.fillStyle = VIOS.grille; ctx.beginPath(); ctx.moveTo(123, 34); ctx.lineTo(128.3, 34); ctx.lineTo(127.8, 42); ctx.lineTo(122.5, 43.5); ctx.fill();
  for (let y = 35; y < 42; y += 2) for (let x = 124 + (y % 4 === 1 ? 1 : 0); x < 128; x += 2) R(ctx, '#3a3d46', x, y, 1, 1);
  R(ctx, VIOS.grille, 117, 37, 4, 2);
  // Long wedge tail lamp wrapping onto the rear fender
  ctx.fillStyle = VIOS.tail; ctx.beginPath(); ctx.moveTo(4.6, 21.4); ctx.lineTo(20, 22.4); ctx.lineTo(18.5, 24.6); ctx.lineTo(4.8, 25.6); ctx.fill();
  R(ctx, '#ff7080', 6, 22.5, 11, 1);
  R(ctx, '#8a1020', 5, 37, 3, 1); // rear bumper reflector
  // Plate
  R(ctx, '#f0f0f0', 5, 28, 6, 3); R(ctx, '#2040a0', 6, 29, 4, 1);
  // ---- Time-machine hardware ----
  // Rear-mounted temporal reactor sitting on the long trunk deck, twin exhaust vents
  // (kept compact and against the rear edge so the sedan's trunk notch stays visible)
  R(ctx, '#555b66', 4, 11, 10, 7);
  R(ctx, '#2a2e36', 5, 12, 8, 4);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(9, 14, 1.8, 0, Math.PI * 2); ctx.fill();
  R(ctx, '#7a808c', 5, 8, 2, 3); R(ctx, '#7a808c', 11, 8, 2, 3);
  R(ctx, g, 5, 7, 1, 1); R(ctx, g, 12, 7, 1, 1);
  // Exposed cables from the reactor along the body to the front arch
  ctx.lineWidth = 1.5;
  VIOS.cable.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.beginPath(); ctx.moveTo(13, 14 + i); ctx.quadraticCurveTo(24, 30 + i, 60, 31 + i); ctx.quadraticCurveTo(84, 30, 94, 34 + i); ctx.stroke();
  });
  // DeLorean-style coil housings on the rear door
  for (let i = 0; i < 3; i++) R(ctx, '#2a2e36', 44 + i * 4, 29, 2, 4);
  // Flight-mode wheels: folded 90 degrees, tread facing down, hover discs glowing
  for (const wx of [W1, W2]) {
    R(ctx, '#2a2e36', wx - 1, 36, 2, 9); // folding strut
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(wx, 46, 10, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9aa0aa'; ctx.beginPath(); ctx.ellipse(wx, 45.5, 6.5, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    R(ctx, g, wx - 2, 45, 4, 1);
    R(ctx, g, wx - 8, 48, 16, 1);
  }
}

function drawRuinedViosSide(ctx) {
  drawViosSide(ctx, false, false);
  const img = ctx.getImageData(0, 0, 132, 52);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
    d[i] = Math.min(255, v * 0.9 + 40); d[i + 1] = v * 0.75 + 15; d[i + 2] = v * 0.6;
  }
  ctx.putImageData(img, 0, 0);
  R(ctx, '#3a7a8a', 14, 16, 3, 2);
}

// ---------------------------------------------------------------------------------------
// Tiles: 0-2 floor variants, 3 wall top, 4 wall face, 5 hazard, 6 cracked wall face
// ---------------------------------------------------------------------------------------
function noiseDots(ctx, x0, color, n, seed) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) R(ctx, color, x0 + Math.floor(r() * 16), Math.floor(r() * 16), 1, 1);
}

function drawFloor(ctx, x0, eraId, pal, v) {
  const base = pal.floor[v];
  R(ctx, base, x0, 0, 16, 16);
  switch (eraId) {
    case 'lab': case 'safe':
      R(ctx, shade(base, 0.12), x0, 0, 16, 1); R(ctx, shade(base, -0.3), x0, 15, 16, 1);
      R(ctx, shade(base, -0.3), x0 + 15, 0, 1, 16);
      R(ctx, '#5a6a80', x0 + 2, 2, 1, 1); R(ctx, '#5a6a80', x0 + 13, 13, 1, 1);
      if (v === 2) R(ctx, '#47e0ff', x0 + 6, 8, 4, 1);
      break;
    case 'precolonial':
      noiseDots(ctx, x0, shade(base, 0.25), 10, 7 + v * 13);
      noiseDots(ctx, x0, shade(base, -0.2), 8, 3 + v * 5);
      if (v === 1) { R(ctx, '#e8d870', x0 + 4, 5, 1, 1); R(ctx, '#ff8080', x0 + 11, 10, 1, 1); }
      if (v === 2) { R(ctx, pal.sand, x0, 0, 16, 16); noiseDots(ctx, x0, shade(pal.sand, -0.15), 12, 99); }
      break;
    case 'spanish':
      for (let y = 0; y < 16; y += 4) for (let x = (y % 8 ? 2 : 0); x < 16; x += 5) { R(ctx, shade(base, 0.1), x0 + x, y, 4, 3); R(ctx, shade(base, -0.25), x0 + x, y + 3, 4, 1); }
      break;
    case 'american':
      noiseDots(ctx, x0, shade(base, -0.2), 14, 11 + v * 7);
      noiseDots(ctx, x0, shade(base, 0.15), 8, 5 + v * 3);
      if (v === 2) { R(ctx, shade(base, -0.25), x0 + 2, 7, 12, 1); R(ctx, shade(base, -0.25), x0 + 2, 10, 12, 1); }
      break;
    case 'japanese':
      noiseDots(ctx, x0, shade(base, -0.25), 10, 17 + v * 9);
      if (v === 1) { R(ctx, shade(base, -0.4), x0 + 3, 4, 6, 1); R(ctx, shade(base, -0.4), x0 + 8, 5, 1, 5); }
      if (v === 2) { R(ctx, '#3a3530', x0 + 5, 6, 4, 3); }
      break;
    case 'marcos':
      noiseDots(ctx, x0, shade(base, 0.12), 12, 21 + v * 5);
      if (v === 2) R(ctx, '#d8c040', x0 + 6, 0, 3, 8);
      break;
    case 'modern':
      R(ctx, shade(base, 0.1), x0, 0, 16, 1); R(ctx, shade(base, 0.1), x0, 0, 1, 16);
      if (v === 1) R(ctx, '#ff4fd8', x0 + 7, 7, 2, 2);
      if (v === 2) { R(ctx, '#47e0ff', x0, 8, 16, 1); }
      break;
    default: break;
  }
}

function drawWallTop(ctx, x0, eraId, pal) {
  R(ctx, pal.wallTop, x0, 0, 16, 16);
  R(ctx, shade(pal.wallTop, -0.15), x0, 12, 16, 4);
  if (eraId === 'precolonial') for (let x = 0; x < 16; x += 4) R(ctx, shade(pal.wallTop, -0.25), x0 + x, 0, 1, 16);
  if (eraId === 'modern') R(ctx, '#ff4fd8', x0, 14, 16, 1);
}

function drawWallFace(ctx, x0, eraId, pal, cracked) {
  const c = pal.wall;
  R(ctx, c, x0, 0, 16, 16);
  switch (eraId) {
    case 'precolonial':
      for (let x = 0; x < 16; x += 4) { R(ctx, shade(c, 0.2), x0 + x, 0, 3, 16); R(ctx, shade(c, -0.3), x0 + x + 3, 0, 1, 16); R(ctx, shade(c, -0.15), x0 + x, 7, 3, 1); }
      break;
    case 'spanish': case 'japanese': case 'american':
      for (let y = 0; y < 16; y += 5) for (let x = (y % 10 ? 4 : 0); x < 16; x += 8) { R(ctx, shade(c, 0.12), x0 + x, y, 7, 4); }
      R(ctx, shade(c, -0.35), x0, 15, 16, 1);
      if (eraId === 'japanese') { R(ctx, '#222', x0 + 9, 3, 2, 5); R(ctx, '#222', x0 + 10, 8, 1, 3); }
      break;
    case 'marcos':
      R(ctx, shade(c, 0.1), x0, 0, 16, 2); R(ctx, '#e8e0d0', x0 + 3, 4, 6, 8); R(ctx, '#c03030', x0 + 4, 5, 4, 2); R(ctx, '#333', x0 + 4, 8, 4, 1);
      break;
    case 'modern':
      R(ctx, '#20203a', x0 + 1, 1, 14, 12); R(ctx, '#47e0ff', x0 + 1, 13, 14, 1); R(ctx, '#3a3a6a', x0 + 3, 3, 4, 8);
      break;
    default:
      R(ctx, shade(c, 0.15), x0, 0, 16, 2); R(ctx, '#2a3040', x0 + 2, 5, 12, 6); R(ctx, '#47e0ff', x0 + 3, 7, 2, 1); R(ctx, '#ff7a47', x0 + 7, 7, 2, 1);
  }
  if (cracked) {
    R(ctx, '#0a0808', x0 + 7, 2, 1, 4); R(ctx, '#0a0808', x0 + 8, 6, 1, 3); R(ctx, '#0a0808', x0 + 6, 9, 1, 4);
    R(ctx, '#0a0808', x0 + 9, 9, 2, 1); R(ctx, '#ffe9a0', x0 + 8, 11, 1, 1);
  }
}

function drawHazard(ctx, x0, pal) {
  R(ctx, '#1a1a24', x0, 0, 16, 16);
  for (let i = 0; i < 16; i += 4) R(ctx, '#e8d040', x0 + i, 0, 2, 2);
  R(ctx, '#47e0ff', x0 + 3, 6, 10, 1); R(ctx, '#47e0ff', x0 + 6, 9, 6, 1); R(ctx, '#9ff', x0 + 8, 7, 1, 2);
}

function eraTileset(scene, eraId) {
  const pal = (ERAS[eraId] || ERAS.lab).palette;
  canvas(scene, `tiles_${eraId}`, 16 * 7, 16, (ctx) => {
    for (let v = 0; v < 3; v++) drawFloor(ctx, v * 16, eraId, pal, v);
    drawWallTop(ctx, 48, eraId, pal);
    drawWallFace(ctx, 64, eraId, pal, false);
    drawHazard(ctx, 80, pal);
    drawWallFace(ctx, 96, eraId, pal, true);
  }, { crisp: false });
}

// ---------------------------------------------------------------------------------------
// Props (16 x 24, anchored at bottom)
// ---------------------------------------------------------------------------------------
const PROPS = {
  palm: (c) => { R(c, '#7a5a3a', 7, 8, 2, 16); R(c, '#5a3a20', 7, 12, 2, 1); R(c, '#5a3a20', 7, 17, 2, 1); R(c, '#2f8a3a', 1, 4, 14, 3); R(c, '#3faa4a', 3, 2, 10, 3); R(c, '#2f8a3a', 0, 7, 4, 2); R(c, '#2f8a3a', 12, 7, 4, 2); R(c, '#8a5a2a', 7, 7, 2, 2); },
  nipa: (c) => { R(c, '#c8a060', 0, 6, 16, 6); R(c, '#a88040', 1, 12, 14, 1); R(c, '#8a6030', 2, 13, 12, 7); R(c, '#3a2a1a', 6, 15, 4, 5); R(c, '#5a3a20', 2, 20, 2, 4); R(c, '#5a3a20', 12, 20, 2, 4); R(c, '#e0c080', 3, 5, 10, 1); },
  bamboo: (c) => { for (const x of [2, 7, 12]) { R(c, '#7aaa3a', x, 2, 3, 22); R(c, '#4a7a2a', x, 8, 3, 1); R(c, '#4a7a2a', x, 15, 3, 1); } R(c, '#3faa4a', 4, 1, 4, 2); },
  rock: (c) => { R(c, '#7a7a80', 2, 12, 12, 10); R(c, '#9a9aa0', 4, 11, 7, 4); R(c, '#5a5a60', 2, 20, 12, 2); },
  pillar: (c) => { R(c, '#c8b8a0', 4, 2, 8, 20); R(c, '#e0d0b8', 2, 0, 12, 3); R(c, '#a89880', 2, 21, 12, 3); R(c, '#a89880', 6, 4, 1, 16); },
  bookshelf: (c) => { R(c, '#5a3a20', 1, 2, 14, 22); for (let y = 4; y < 22; y += 6) { R(c, '#3a2410', 2, y, 12, 5); ['#a03030', '#3050a0', '#30a060', '#c0a040', '#8040a0'].forEach((col, i) => R(c, col, 3 + i * 2, y + 1, 2, 4)); } },
  barrel: (c) => { R(c, '#8a5a2a', 3, 10, 10, 13); R(c, '#5a5a5a', 3, 12, 10, 1); R(c, '#5a5a5a', 3, 19, 10, 1); R(c, '#a87a4a', 5, 10, 6, 2); },
  cart: (c) => { R(c, '#8a6030', 1, 10, 14, 7); R(c, '#5a3a20', 1, 10, 14, 1); R(c, '#3a2a1a', 2, 17, 4, 4); R(c, '#3a2a1a', 10, 17, 4, 4); R(c, '#c0a060', 3, 8, 10, 3); },
  sandbag: (c) => { for (let i = 0; i < 3; i++) { R(c, '#b8a070', 1 + i * 5, 16, 5, 4); R(c, '#a08858', 1 + i * 5, 19, 5, 1); } for (let i = 0; i < 2; i++) R(c, '#c8b080', 3 + i * 5, 12, 5, 4); },
  tent: (c) => { c.fillStyle = '#8a8a5a'; c.beginPath(); c.moveTo(8, 4); c.lineTo(16, 22); c.lineTo(0, 22); c.fill(); R(c, '#3a3a2a', 7, 13, 2, 9); R(c, '#6a6a40', 0, 22, 16, 2); },
  crate: (c) => { R(c, '#a07040', 2, 10, 12, 12); R(c, '#704a20', 2, 10, 12, 1); R(c, '#704a20', 2, 15, 12, 1); R(c, '#704a20', 7, 10, 1, 12); R(c, '#704a20', 2, 21, 12, 1); },
  ruin: (c) => { R(c, '#5a5650', 1, 8, 6, 16); R(c, '#5a5650', 7, 14, 8, 10); R(c, '#3a3632', 3, 10, 2, 3); R(c, '#6a645c', 7, 13, 3, 2); R(c, '#2a2622', 10, 18, 3, 2); },
  barrier: (c) => { R(c, '#e8e0d0', 0, 12, 16, 5); for (let i = 0; i < 16; i += 6) R(c, '#c02020', i, 12, 3, 5); R(c, '#555', 2, 17, 2, 6); R(c, '#555', 12, 17, 2, 6); },
  car: (c) => { R(c, '#3a6a9a', 0, 10, 16, 10); R(c, '#2a4a6a', 0, 18, 16, 2); R(c, '#9ab8d8', 3, 8, 10, 4); R(c, '#111', 1, 19, 4, 4); R(c, '#111', 11, 19, 4, 4); },
  sign: (c) => { R(c, '#555', 7, 10, 2, 14); R(c, '#e8d040', 1, 2, 14, 9); R(c, '#111', 3, 4, 10, 1); R(c, '#111', 3, 7, 7, 1); },
  server: (c) => { R(c, '#20203a', 2, 2, 12, 22); for (let y = 4; y < 22; y += 4) { R(c, '#3a3a5a', 3, y, 10, 3); R(c, y % 8 ? '#47e0ff' : '#ff4fd8', 11, y + 1, 1, 1); } },
  billboard: (c) => { R(c, '#555', 3, 14, 2, 10); R(c, '#555', 11, 14, 2, 10); R(c, '#ff4fd8', 0, 2, 16, 12); R(c, '#20203a', 1, 3, 14, 10); R(c, '#47e0ff', 3, 5, 6, 2); R(c, '#ffd400', 3, 9, 9, 2); },
  console: (c) => { R(c, '#3a4250', 1, 8, 14, 14); R(c, '#20262f', 2, 9, 12, 6); R(c, '#47e0ff', 3, 10, 4, 2); R(c, '#ff7a47', 9, 10, 3, 1); R(c, '#9dff6a', 9, 12, 2, 1); R(c, '#5a6a80', 2, 17, 12, 2); },
  crate_tech: (c) => { R(c, '#4a5568', 2, 10, 12, 12); R(c, '#47e0ff', 3, 11, 10, 1); R(c, '#2a3140', 4, 14, 8, 6); R(c, '#e8d040', 7, 15, 2, 2); },
  tank: (c) => { R(c, '#5a6a80', 3, 2, 10, 20); R(c, '#2a4a5a', 4, 4, 8, 14); R(c, '#7ff6ff', 5, 6, 6, 10); R(c, '#e8ffff', 6, 8, 1, 6); R(c, '#3a4250', 2, 20, 12, 4); },
};

// ---------------------------------------------------------------------------------------
// Stations / interactables (24 x 24)
// ---------------------------------------------------------------------------------------
const STATIONS = {
  stall: (c) => { R(c, '#c03030', 0, 2, 24, 4); for (let i = 0; i < 24; i += 6) R(c, '#f0f0f0', i, 2, 3, 4); R(c, '#8a5a2a', 1, 6, 1, 10); R(c, '#8a5a2a', 22, 6, 1, 10); R(c, '#a07040', 0, 14, 24, 8); R(c, '#704a20', 0, 14, 24, 1); R(c, '#ffd400', 4, 11, 3, 3); R(c, '#5fff8a', 10, 11, 3, 3); R(c, '#47e0ff', 16, 11, 3, 3); },
  shrine: (c) => { R(c, '#3a2a4a', 6, 16, 12, 7); R(c, '#5a4a6a', 4, 21, 16, 3); c.fillStyle = '#c080ff'; c.beginPath(); c.arc(12, 9, 6, 0, Math.PI * 2); c.fill(); R(c, '#f0e0ff', 10, 6, 3, 3); R(c, '#7a40c0', 6, 9, 12, 1); },
  fountain: (c) => { R(c, '#8a9aa8', 2, 14, 20, 8); R(c, '#5fb0ff', 4, 15, 16, 3); R(c, '#aab8c8', 10, 4, 4, 11); R(c, '#5fb0ff', 9, 3, 6, 2); R(c, '#5fff8a', 11, 8, 2, 2); R(c, '#e0fff0', 7, 1, 1, 2); R(c, '#e0fff0', 16, 1, 1, 2); },
  easel: (c) => { R(c, '#8a5a2a', 4, 6, 2, 18); R(c, '#8a5a2a', 18, 6, 2, 18); R(c, '#8a5a2a', 11, 2, 2, 22); R(c, '#f2e6c8', 3, 3, 18, 13); R(c, '#2a2a5a', 8, 6, 6, 2); R(c, '#2a2a5a', 10, 8, 2, 5); R(c, '#2a2a5a', 7, 10, 8, 1); },
  reconstructor: (c) => { R(c, '#3a4250', 2, 18, 20, 6); R(c, '#47e0ff', 4, 19, 16, 1); R(c, '#5a6a80', 3, 2, 3, 17); R(c, '#5a6a80', 18, 2, 3, 17); R(c, '#7ff6ff', 6, 4, 12, 1); R(c, '#7ff6ff', 6, 10, 12, 1); R(c, '#e8ffff', 11, 5, 2, 12); },
  console: (c) => { R(c, '#2a2e36', 1, 6, 22, 16); R(c, '#111', 3, 8, 18, 3); R(c, '#ff3030', 4, 9, 5, 1); R(c, '#111', 3, 12, 18, 3); R(c, '#30ff60', 4, 13, 5, 1); R(c, '#111', 3, 16, 18, 3); R(c, '#ffb020', 4, 17, 5, 1); R(c, '#5a6a80', 0, 21, 24, 3); },
  armory: (c) => { R(c, '#4a3a2a', 1, 2, 22, 21); R(c, '#2a2018', 3, 4, 18, 17); R(c, '#9aa0aa', 5, 5, 2, 14); R(c, '#9aa0aa', 10, 5, 2, 14); R(c, '#9aa0aa', 15, 5, 2, 14); R(c, '#5a3a1e', 5, 14, 2, 5); R(c, '#5a3a1e', 15, 13, 2, 6); },
  upgrade: (c) => { R(c, '#5a6a80', 0, 12, 24, 10); R(c, '#3a4250', 1, 13, 22, 3); R(c, '#e8d040', 3, 8, 6, 4); R(c, '#9aa0aa', 13, 6, 2, 7); R(c, '#9aa0aa', 11, 5, 6, 2); R(c, '#47e0ff', 18, 9, 3, 3); },
  repair: (c) => { R(c, '#3a4250', 2, 14, 20, 9); c.fillStyle = '#9aa0aa'; c.beginPath(); c.arc(12, 9, 7, 0, Math.PI * 2); c.fill(); c.fillStyle = '#3a4250'; c.beginPath(); c.arc(12, 9, 3, 0, Math.PI * 2); c.fill(); for (let a = 0; a < 8; a++) R(c, '#9aa0aa', 11 + Math.round(Math.cos(a * 0.785) * 8), 8 + Math.round(Math.sin(a * 0.785) * 8), 2, 2); R(c, '#ffb020', 5, 17, 14, 1); },
  bench: (c) => { R(c, '#8a5a2a', 0, 12, 24, 4); R(c, '#5a3a20', 2, 16, 2, 7); R(c, '#5a3a20', 20, 16, 2, 7); R(c, '#a07040', 0, 6, 24, 3); },
  case: (c) => { R(c, '#3a2a1a', 1, 14, 22, 9); R(c, '#9ad8ff', 2, 3, 20, 12); R(c, '#c8f0ff', 3, 4, 3, 10); R(c, '#ffd400', 8, 9, 3, 3); R(c, '#e8e0c0', 13, 8, 3, 4); },
  dummy: (c) => { R(c, '#8a6030', 11, 12, 2, 12); R(c, '#c8a060', 6, 4, 12, 12); R(c, '#e04040', 9, 7, 6, 6); R(c, '#f0f0f0', 11, 9, 2, 2); R(c, '#8a6030', 3, 9, 18, 2); },
  locker: (c) => { R(c, '#4a5568', 2, 2, 20, 21); R(c, '#2a3140', 3, 3, 8, 19); R(c, '#2a3140', 13, 3, 8, 19); R(c, '#47e0ff', 9, 11, 1, 3); R(c, '#47e0ff', 14, 11, 1, 3); R(c, '#5fff8a', 5, 5, 3, 2); },
  note: (c) => { R(c, '#8a5a2a', 3, 14, 18, 3); R(c, '#5a3a20', 5, 17, 2, 6); R(c, '#5a3a20', 17, 17, 2, 6); R(c, '#f2e6c8', 6, 7, 12, 8); R(c, '#555', 8, 9, 8, 1); R(c, '#555', 8, 11, 6, 1); },
};

// ---------------------------------------------------------------------------------------
// Weapons (32 x 12, pointing right, grip roughly at x=8)
// ---------------------------------------------------------------------------------------
function drawWeapon(ctx, look) {
  const c = look.color, a = look.accent || '#333';
  switch (look.type) {
    case 'pistol': R(ctx, c, 8, 3, 10, 3); R(ctx, shade(c, -0.3), 8, 6, 4, 4); R(ctx, a, 16, 3, 2, 1); break;
    case 'revolver': R(ctx, c, 8, 3, 12, 2); R(ctx, shade(c, -0.2), 10, 3, 4, 4); R(ctx, a, 7, 5, 3, 5); break;
    case 'rifle': { const len = look.long ? 26 : 22; R(ctx, c, 2, 4, 9, 4); R(ctx, c, 10, 4, len - 10, 2); R(ctx, a, 10, 3, len - 6, 1); R(ctx, shade(c, -0.3), 2, 7, 5, 2); if (look.scope) R(ctx, '#111', 12, 1, 7, 2); break; }
    case 'smg': R(ctx, c, 4, 4, 16, 3); R(ctx, a, 2, 5, 4, 3); R(ctx, shade(c, -0.3), 10, 7, look.drum ? 5 : 2, look.drum ? 4 : 5); if (look.long) R(ctx, c, 20, 4, 6, 1); break;
    case 'heavy': R(ctx, c, 2, 3, 26, 4); R(ctx, a, 10, 7, 4, 4); R(ctx, shade(c, 0.2), 4, 3, 10, 1); R(ctx, a, 26, 2, 2, 2); break;
    case 'shotgun': R(ctx, c, 2, 4, 8, 4); R(ctx, '#555', 10, 4, 14, 2); R(ctx, a, 12, 6, 6, 2); break;
    case 'launcher': R(ctx, c, 2, 2, 26, 6); R(ctx, shade(c, -0.3), 0, 3, 3, 4); R(ctx, a, 10, 8, 3, 3); R(ctx, a, 26, 3, 3, 4); if (look.tape) { R(ctx, '#c0c0c0', 8, 2, 2, 6); R(ctx, '#c0c0c0', 18, 2, 2, 6); } break;
    case 'blade': R(ctx, a, 2, 4, 6, 3); R(ctx, c, 8, 3, 16, 4); R(ctx, shade(c, 0.3), 9, 3, 14, 1); break;
    case 'katana': R(ctx, a, 1, 5, 7, 2); R(ctx, '#c8a040', 8, 4, 1, 4); R(ctx, c, 9, 4, 19, 2); R(ctx, '#fff', 10, 4, 17, 1); break;
    case 'kris': R(ctx, a, 2, 5, 6, 2); for (let i = 0; i < 14; i++) R(ctx, c, 8 + i, 4 + (Math.floor(i / 2) % 2), 1, 2); break;
    case 'spear': R(ctx, c, 0, 5, 24, 2); R(ctx, '#c8c8c8', 24, 4, 6, 4); R(ctx, a, 25, 5, 3, 2); break;
    case 'knife': R(ctx, a, 4, 5, 6, 2); R(ctx, c, 10, 4, look.long ? 16 : 9, 2); break;
    case 'wrench': R(ctx, c, 4, 5, 16, 2); R(ctx, c, 19, 2, 5, 8); R(ctx, '#20262f', 21, 4, 3, 4); R(ctx, a, 6, 5, 4, 2); break;
    case 'book': R(ctx, c, 6, 1, 12, 10); R(ctx, look.accent, 7, 2, 10, 8); R(ctx, '#2a2a5a', 18, 2, 1, 8); R(ctx, '#ffffff', 20, 0, 1, 7); R(ctx, '#2a2a5a', 20, 7, 1, 2); break;
    default: R(ctx, c, 4, 4, 16, 3);
  }
}

// ---------------------------------------------------------------------------------------
// Pickups, artifacts, bullets, fx
// ---------------------------------------------------------------------------------------
const SHARDS = {
  lab: ['#47e0ff', '#e8ffff', null],
  gold: ['#d4a017', '#fff3a0', '#7a6a4a'],
  coin: ['#c8a040', '#fff3c0', '#8a6a20'],
  brass: ['#b88a3a', '#ffe0a0', '#5a4a2a'],
  crystal: ['#9ad8ff', '#ffffff', '#5a6a7a'],
  retro: ['#ff4fd8', '#47e0ff', '#ffd400'],
  digital: ['#9dff6a', '#ffffff', '#ff4fd8'],
};
function drawShard(ctx, kind) {
  const [m, hi, extra] = SHARDS[kind];
  if (kind === 'gold') { R(ctx, extra, 1, 3, 7, 5); R(ctx, m, 3, 1, 3, 4); R(ctx, hi, 4, 2, 1, 2); return; }
  if (kind === 'coin') { ctx.fillStyle = m; ctx.beginPath(); ctx.arc(4.5, 4.5, 3.6, 0, Math.PI * 2); ctx.fill(); R(ctx, extra, 4, 2, 1, 5); R(ctx, hi, 3, 2, 1, 1); return; }
  if (kind === 'brass') { R(ctx, m, 2, 2, 5, 5); R(ctx, m, 4, 0, 1, 9); R(ctx, m, 0, 4, 9, 1); R(ctx, extra, 4, 4, 1, 1); R(ctx, hi, 2, 2, 1, 1); return; }
  if (kind === 'digital') { R(ctx, m, 1, 1, 3, 3); R(ctx, extra, 5, 1, 3, 3); R(ctx, hi, 3, 5, 3, 3); return; }
  if (kind === 'retro') { R(ctx, m, 3, 0, 3, 9); R(ctx, hi, 1, 3, 7, 3); R(ctx, extra, 4, 4, 1, 1); return; }
  // diamond crystal
  ctx.fillStyle = m; ctx.beginPath(); ctx.moveTo(4.5, 0); ctx.lineTo(8.5, 4.5); ctx.lineTo(4.5, 9); ctx.lineTo(0.5, 4.5); ctx.fill();
  R(ctx, hi, 3, 2, 2, 2);
  if (extra) R(ctx, extra, 5, 5, 1, 2);
}

const ARTIFACT_ART = {
  gold_bracelet: (c) => { c.strokeStyle = '#ffd400'; c.lineWidth = 2.5; c.beginPath(); c.arc(8, 8, 5, 0, Math.PI * 2); c.stroke(); R(c, '#fff3a0', 4, 4, 2, 2); R(c, '#e04040', 7, 2, 2, 2); },
  noli_original: (c) => { R(c, '#6b2a1a', 2, 2, 12, 12); R(c, '#f2e6c8', 3, 3, 10, 10); R(c, '#6b2a1a', 4, 5, 8, 1); R(c, '#6b2a1a', 4, 8, 6, 1); R(c, '#c8a040', 2, 2, 1, 12); },
  conant_coin: (c) => { c.fillStyle = '#d8d8e0'; c.beginPath(); c.arc(8, 8, 6, 0, Math.PI * 2); c.fill(); R(c, '#9a9aa8', 6, 5, 4, 6); R(c, '#ffffff', 5, 4, 2, 2); },
  mickey_money: (c) => { R(c, '#c8b880', 1, 4, 14, 8); R(c, '#8a7a50', 2, 5, 12, 6); R(c, '#c8b880', 3, 6, 10, 4); R(c, '#5a4a2a', 6, 7, 4, 2); },
  rolex_12: (c) => { R(c, '#c8a040', 6, 0, 4, 16); c.fillStyle = '#ffd400'; c.beginPath(); c.arc(8, 8, 5, 0, Math.PI * 2); c.fill(); R(c, '#1a3a2a', 5, 5, 6, 6); R(c, '#fff', 8, 6, 1, 3); R(c, '#fff', 8, 8, 2, 1); },
};

const BULLETS = {
  b_energy: [6, 6, (c) => { R(c, '#47e0ff', 1, 1, 4, 4); R(c, '#e8ffff', 2, 2, 2, 2); }],
  b_small: [5, 5, (c) => { R(c, '#ffe08a', 1, 1, 3, 3); R(c, '#fff', 2, 2, 1, 1); }],
  b_rifle: [10, 4, (c) => { R(c, '#fff1a8', 0, 1, 10, 2); R(c, '#ffffff', 6, 1, 4, 2); }],
  b_pellet: [4, 4, (c) => { R(c, '#ffd080', 1, 1, 2, 2); }],
  b_ink: [7, 7, (c) => { R(c, '#2a2a5a', 1, 1, 5, 5); R(c, '#5a5aa0', 2, 2, 2, 2); }],
  b_ink_big: [12, 12, (c) => { c.fillStyle = '#1a1a4a'; c.beginPath(); c.arc(6, 6, 5, 0, Math.PI * 2); c.fill(); R(c, '#6a6ac0', 3, 3, 3, 2); }],
  b_shell: [8, 8, (c) => { c.fillStyle = '#5a5a40'; c.beginPath(); c.arc(4, 4, 3.5, 0, Math.PI * 2); c.fill(); R(c, '#ffa040', 3, 3, 2, 2); }],
  b_rocket: [12, 6, (c) => { R(c, '#c0c0c0', 2, 1, 8, 4); R(c, '#e04040', 9, 1, 3, 4); R(c, '#ffd400', 0, 2, 2, 2); }],
  b_enemy: [7, 7, (c) => { c.fillStyle = '#ff3a3a'; c.beginPath(); c.arc(3.5, 3.5, 3.4, 0, Math.PI * 2); c.fill(); R(c, '#ffd0d0', 2, 2, 2, 2); }],
  b_enemy_big: [11, 11, (c) => { c.fillStyle = '#ff3a3a'; c.beginPath(); c.arc(5.5, 5.5, 5.3, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffd0d0'; c.beginPath(); c.arc(5.5, 5.5, 2.5, 0, Math.PI * 2); c.fill(); }],
  b_grenade: [7, 7, (c) => { R(c, '#3a4a2a', 1, 1, 5, 5); R(c, '#9a9a6a', 3, 0, 1, 2); }],
};

export function generateAll(scene) {
  // Characters
  characterTexture(scene, 'ch_anon', ANON_LOOK);
  for (const a of ALLIES) characterTexture(scene, `ch_${a.id}`, a.look);
  for (const b of Object.values(BOSSES)) characterTexture(scene, `ch_boss_${b.id}`, b.look);
  for (const [eraId, era] of Object.entries(ERAS)) if (era.merchant) characterTexture(scene, `ch_merchant_${eraId}`, era.merchant.look);
  for (const [eraId, types] of Object.entries(ERA_ENEMIES)) for (const [type, v] of Object.entries(types)) if (ARCHETYPES[type]) characterTexture(scene, `en_${eraId}_${type}`, v.look);
  characterTexture(scene, 'ch_villager', { skin: '#b97c4f', hair: '#222', top: '#4a7aaa', top2: '#e0e0e0', bottom: '#3a3a3a' });

  // DeVios
  canvas(scene, 'devios_top', 44, 80, (ctx) => drawViosTop(ctx, false), { outline: OUTLINE });
  canvas(scene, 'devios_top_glow', 44, 80, (ctx) => drawViosTop(ctx, true), { outline: '#47e0ff' });
  canvas(scene, 'devios_side', 132, 52, (ctx) => drawViosSide(ctx, false), { outline: OUTLINE });
  canvas(scene, 'devios_side_glow', 132, 52, (ctx) => drawViosSide(ctx, true), { outline: '#47e0ff' });
  canvas(scene, 'devios_side_ruined', 132, 52, (ctx) => drawRuinedViosSide(ctx), { outline: OUTLINE });

  // Tilesets
  for (const eraId of Object.keys(ERAS)) eraTileset(scene, eraId);

  // Props & stations
  for (const [k, fn] of Object.entries(PROPS)) canvas(scene, `prop_${k}`, 16, 24, fn, { outline: OUTLINE });
  for (const [k, fn] of Object.entries(STATIONS)) canvas(scene, `st_${k}`, 24, 24, fn, { outline: OUTLINE });

  // Doors (32 x 16)
  canvas(scene, 'door_locked', 32, 16, (c) => { R(c, '#1a1418', 0, 0, 32, 16); for (let i = 2; i < 32; i += 5) R(c, '#ff4040', i, 1, 2, 14); R(c, '#601818', 0, 7, 32, 2); }, { crisp: false });
  canvas(scene, 'door_open', 32, 16, (c) => { R(c, '#050408', 0, 0, 32, 16); R(c, '#5fff8a', 0, 0, 2, 16); R(c, '#5fff8a', 30, 0, 2, 16); R(c, '#2a7a4a', 2, 0, 28, 1); }, { crisp: false });
  canvas(scene, 'door_side', 16, 32, (c) => { R(c, '#050408', 0, 0, 16, 32); R(c, '#ffd400', 0, 0, 16, 2); R(c, '#ffd400', 0, 30, 16, 2); }, { crisp: false });
  canvas(scene, 'door_side_locked', 16, 32, (c) => { R(c, '#1a1418', 0, 0, 16, 32); for (let i = 2; i < 32; i += 5) R(c, '#ff4040', 1, i, 14, 2); }, { crisp: false });

  // Pickups
  for (const k of Object.keys(SHARDS)) canvas(scene, `shard_${k}`, 9, 9, (c) => drawShard(c, k), { outline: OUTLINE });
  canvas(scene, 'heart', 10, 9, (c) => { R(c, '#ff3a5a', 1, 1, 3, 3); R(c, '#ff3a5a', 6, 1, 3, 3); R(c, '#ff3a5a', 1, 3, 8, 3); R(c, '#ff3a5a', 3, 6, 4, 2); R(c, '#ffd0d8', 2, 2, 1, 1); }, { outline: OUTLINE });
  canvas(scene, 'ammo', 10, 8, (c) => { R(c, '#4a5a3a', 0, 2, 10, 6); R(c, '#e8d040', 2, 0, 2, 3); R(c, '#e8d040', 6, 0, 2, 3); R(c, '#2a3a1a', 0, 4, 10, 1); }, { outline: OUTLINE });
  canvas(scene, 'chest_small', 16, 13, (c) => { R(c, '#8a5a2a', 0, 4, 16, 9); R(c, '#a87a4a', 0, 1, 16, 4); R(c, '#e8d040', 7, 5, 2, 3); R(c, '#5a3a20', 0, 5, 16, 1); }, { outline: OUTLINE });
  canvas(scene, 'chest_large', 20, 15, (c) => { R(c, '#3a4a8a', 0, 5, 20, 10); R(c, '#5a6aaa', 0, 1, 20, 5); R(c, '#ffd400', 9, 6, 3, 4); R(c, '#ffd400', 0, 6, 20, 1); R(c, '#ffd400', 0, 1, 2, 14); R(c, '#ffd400', 18, 1, 2, 14); }, { outline: OUTLINE });
  canvas(scene, 'chest_vault', 22, 17, (c) => { R(c, '#5a1a6a', 0, 5, 22, 12); R(c, '#8a3aaa', 0, 1, 22, 5); R(c, '#ffd400', 10, 6, 3, 5); R(c, '#7ff6ff', 2, 3, 2, 2); R(c, '#7ff6ff', 18, 3, 2, 2); R(c, '#ffd400', 0, 6, 22, 1); }, { outline: OUTLINE });
  canvas(scene, 'chest_open', 16, 13, (c) => { R(c, '#5a3a20', 0, 4, 16, 9); R(c, '#2a1a10', 1, 4, 14, 3); R(c, '#a87a4a', 0, 0, 16, 3); }, { outline: OUTLINE });
  canvas(scene, 'component', 14, 14, (c) => { c.fillStyle = '#9aa0aa'; c.beginPath(); c.arc(7, 7, 5, 0, Math.PI * 2); c.fill(); R(c, '#47e0ff', 5, 5, 4, 4); R(c, '#9aa0aa', 6, 0, 2, 14); R(c, '#9aa0aa', 0, 6, 14, 2); }, { outline: OUTLINE });
  for (const [k, fn] of Object.entries(ARTIFACT_ART)) canvas(scene, `art_${k}`, 16, 16, fn, { outline: OUTLINE });

  // Weapons
  for (const w of WEAPONS) canvas(scene, `w_${w.id}`, 32, 12, (c) => drawWeapon(c, w.look), { outline: OUTLINE });

  // Bullets
  for (const [k, [w, h, fn]] of Object.entries(BULLETS)) canvas(scene, k, w, h, fn, { crisp: false });

  // FX
  canvas(scene, 'shadow', 14, 5, (c) => { c.fillStyle = 'rgba(0,0,0,0.6)'; c.beginPath(); c.ellipse(7, 2.5, 6.5, 2.2, 0, 0, Math.PI * 2); c.fill(); }, { crisp: false });
  canvas(scene, 'px', 2, 2, (c) => R(c, '#ffffff', 0, 0, 2, 2), { crisp: false });
  canvas(scene, 'spark', 3, 3, (c) => { R(c, '#ffffff', 1, 0, 1, 3); R(c, '#ffffff', 0, 1, 3, 1); }, { crisp: false });
  canvas(scene, 'ring', 32, 32, (c) => { c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.arc(16, 16, 14, 0, Math.PI * 2); c.stroke(); }, { crisp: false });
  canvas(scene, 'reticle', 11, 11, (c) => { R(c, '#ffffff', 5, 0, 1, 3); R(c, '#ffffff', 5, 8, 1, 3); R(c, '#ffffff', 0, 5, 3, 1); R(c, '#ffffff', 8, 5, 3, 1); R(c, '#ff4040', 5, 5, 1, 1); }, { crisp: false });
  canvas(scene, 'portal', 20, 20, (c) => { c.strokeStyle = '#c080ff'; c.lineWidth = 2; c.beginPath(); c.arc(10, 10, 8, 0, Math.PI * 2); c.stroke(); c.strokeStyle = '#7ff6ff'; c.beginPath(); c.arc(10, 10, 4, 0, Math.PI * 2); c.stroke(); }, { crisp: false });
  canvas(scene, 'star', 2, 2, (c) => R(c, '#ffffff', 0, 0, 1, 1), { crisp: false });
}
