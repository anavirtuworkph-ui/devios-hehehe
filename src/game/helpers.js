// Small helpers shared by the mode controllers.
import { TILE, DEPTH } from '../config.js';

export const tileCenter = (p) => ({ x: p.x * TILE + 8, y: p.y * TILE + 8 });

// Split door cells into connected groups (a room can mark several candidate side doors).
export function groupCells(cells) {
  const left = cells.slice();
  const groups = [];
  while (left.length) {
    const g = [left.shift()];
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = left.length - 1; i >= 0; i--) {
        if (g.some((c) => Math.abs(c.x - left[i].x) + Math.abs(c.y - left[i].y) === 1)) { g.push(left.splice(i, 1)[0]); grew = true; }
      }
    }
    groups.push(g);
  }
  return groups;
}

// Spawn point just inside a door.
export function insideDoor(room, cells) {
  const c = cells[0];
  let x = c.x, y = c.y;
  if (c.y === 0) y += 2; else if (c.y === room.H - 1) y -= 2; else if (c.x === 0) x += 2; else x -= 2;
  const gx = cells.reduce((s, k) => s + k.x, 0) / cells.length;
  const gy = cells.reduce((s, k) => s + k.y, 0) / cells.length;
  return { x: (c.y === 0 || c.y === room.H - 1 ? gx : x) * TILE + 8, y: (c.x === 0 || c.x === room.W - 1 ? gy : y) * TILE + 8 };
}

export function addNpc(scene, texture, x, y, name) {
  const sp = scene.add.sprite(x, y, texture, 0).setDepth(DEPTH.actor + y * 0.001);
  const sh = scene.add.image(x, y + 11, 'shadow').setDepth(DEPTH.actor - 1);
  const tag = scene.add.text(x, y - 20, name, { fontFamily: 'monospace', fontSize: '7px', color: '#fff8d0', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(DEPTH.text).setResolution(4);
  scene.tweens.add({ targets: sp, y: y - 1, yoyo: true, repeat: -1, duration: 700 });
  const anim = scene.time.addEvent({ delay: 400, loop: true, callback: () => sp.active && sp.setFrame(sp.frame.name === 0 ? 1 : 0) });
  const objs = [sp, sh, tag];
  scene.roomObjects.push(...objs, { destroy: () => anim.remove() });
  return { sprite: sp, destroy: () => { objs.forEach((o) => o.destroy()); anim.remove(); } };
}

export function addImage(scene, key, x, y, { origin = [0.5, 0.5], depth = null, bob = false } = {}) {
  const img = scene.add.image(x, y, key).setOrigin(origin[0], origin[1]).setDepth(depth ?? DEPTH.actor + y * 0.001);
  if (bob) scene.tweens.add({ targets: img, y: y - 2, yoyo: true, repeat: -1, duration: 600 });
  scene.roomObjects.push(img);
  return img;
}

export function addGlow(scene, x, y, color = 0xffd400, r = 10) {
  const g = scene.add.circle(x, y + 6, r, color, 0.2).setDepth(DEPTH.decal);
  scene.tweens.add({ targets: g, alpha: 0.05, scale: 1.3, yoyo: true, repeat: -1, duration: 700 });
  scene.roomObjects.push(g);
  return g;
}
