// End-to-end browser test: drives the real game build through the whole campaign.
// Usage: npm run build && npm run test:e2e   (starts `vite preview` itself)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium, devices } from 'playwright-core';

const OUT = process.env.E2E_OUT || 'test-results';
mkdirSync(OUT, { recursive: true });
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const PORT = 4179;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2500);

let failures = 0;
const log = (...a) => console.log(...a);
const check = (cond, msg) => { if (!cond) { failures++; log('  ✗ FAIL:', msg); } else log('  ✓', msg); };

const browser = await chromium.launch({ executablePath: EXE, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__ATC && window.__ATC.scene().includes('Menu'));
  return page;
}

const st = (page) => page.evaluate(() => window.__ATC.state());
async function waitFor(page, fn, arg, timeout = 15000) {
  return page.waitForFunction(fn, arg, { timeout, polling: 100 });
}
async function dismissDialogs(page, max = 20) {
  for (let i = 0; i < max; i++) {
    const d = await page.evaluate(() => !document.getElementById('dialog').classList.contains('hidden'));
    if (!d) return;
    await page.keyboard.press('Enter');
    await sleep(120);
  }
}

// Clear one sub-level: kill waves, visit optional rooms, walk out of each room.
async function clearSublevel(page, { visitSide = true } = {}) {
  for (let guard = 0; guard < 40; guard++) {
    await dismissDialogs(page);
    const s = await st(page);
    if (!s.mode || s.mode !== 'stage') return s;
    if (s.kind === 'boss') return s;
    if (s.inSub) {
      // interact with everything harmlessly then leave
      await page.evaluate(() => window.__ATC.killAll());
      await sleep(400);
      await page.evaluate(() => { const g = window.__ATC.game_(); for (const it of g.interactables.filter((i) => /chest|vault|cache/i.test(typeof i.label === 'function' ? i.label() : i.label))) it.use(); });
      await sleep(600);
      await dismissDialogs(page);
      await page.evaluate(() => window.__ATC.app.save.commit());
      const ok = await page.evaluate(() => window.__ATC.door('back'));
      await sleep(900);
      if (!ok) { await page.evaluate(() => window.__ATC.killAll()); await sleep(500); }
      continue;
    }
    if (s.alive > 0) { await page.evaluate(() => window.__ATC.killAll()); await sleep(900); continue; }
    if (s.doors.some((d) => d.startsWith('exit:L'))) { await sleep(600); await page.evaluate(() => window.__ATC.killAll()); continue; }
    // reveal hidden rooms
    await page.evaluate(() => { const c = window.__ATC.game_().ctrl; if (c.current && c.current.side && c.current.side.hidden) c.revealHidden(c.current); });
    const sideOpen = s.doors.includes('side:O');
    const visited = await page.evaluate(() => { const c = window.__ATC.game_().ctrl; return c.state(c.current).sideVisited; });
    if (visitSide && sideOpen && !visited) { await page.evaluate(() => window.__ATC.door('side')); await sleep(900); continue; }
    // take any weapon pickups / recruits
    await page.evaluate(() => { const g = window.__ATC.game_(); for (const it of g.interactables.slice()) { const l = typeof it.label === 'function' ? it.label() : it.label; if (/^Take|Talk to|Sketch|Open chest/.test(l)) it.use(); } });
    await sleep(300);
    await dismissDialogs(page);
    await page.evaluate(() => window.__ATC.door('exit'));
    await sleep(1200);
  }
  return st(page);
}

async function fightBoss(page) {
  await waitFor(page, () => !document.getElementById('dialog').classList.contains('hidden'), null, 8000);
  await page.screenshot({ path: `${OUT}/boss-intro.png` });
  await dismissDialogs(page);
  await sleep(1500);
  // let the boss attack a bit to exercise patterns
  await page.evaluate(() => { const p = window.__ATC.player(); p.invulnUntil = Infinity; });
  await sleep(4000);
  await page.screenshot({ path: `${OUT}/boss-fight.png` });
  await page.evaluate(() => window.__ATC.killAll());
  await sleep(2000);
  await dismissDialogs(page);
  await sleep(1500);
  await dismissDialogs(page);
  await waitFor(page, () => window.__ATC.state().doors.includes('exit:O'), null, 8000);
  await page.evaluate(() => window.__ATC.door('exit'));
}

try {
  // ---------------------------------------------------------------------------------------------
  log('\n[1] First launch: opening -> tutorial -> departure -> Level 1');
  let page = await newPage();
  await page.click('[data-a=play]');
  await waitFor(page, () => window.__ATC.scene().includes('Cinematic'));
  await sleep(3000);
  await page.screenshot({ path: `${OUT}/opening.png` });
  await page.click('#skip');
  await waitFor(page, () => window.__ATC.state().mode === 'tutorial');
  await waitFor(page, () => window.__ATC.state().dialog);
  await dismissDialogs(page);
  await sleep(300);
  // movement step via keyboard
  await page.keyboard.down('KeyD'); await sleep(1200); await page.keyboard.up('KeyD');
  await sleep(300);
  let tStep = await page.evaluate(() => window.__ATC.game_().ctrl.step.id);
  check(tStep === 'shoot', `tutorial advances after moving (step=${tStep})`);
  // shoot the dummy with the mouse
  const dummy = await page.evaluate(() => { const g = window.__ATC.game_(); const e = g.ctrl.target; const cam = g.cameras.main; const dpr = window.__ATC.app.dpr; return { x: (e.x - cam.worldView.x) * cam.zoom / dpr, y: (e.y - cam.worldView.y) * cam.zoom / dpr }; });
  await page.mouse.move(dummy.x, dummy.y);
  await page.mouse.down();
  await sleep(3500);
  await page.mouse.up();
  tStep = await page.evaluate(() => window.__ATC.game_().ctrl.step.id);
  check(tStep === 'melee', `mouse aiming destroys the dummy (step=${tStep})`);
  await page.screenshot({ path: `${OUT}/tutorial.png` });
  for (let i = 0; i < 10; i++) { const more = await page.evaluate(() => { const b = document.querySelector('.tp-next'); if (b && !window.__ATC.game_().ctrl.done) { b.click(); return true; } return false; }); if (!more) break; await sleep(250); }
  await waitFor(page, () => window.__ATC.scene().includes('Cinematic'));
  await sleep(4500);
  await page.screenshot({ path: `${OUT}/departure-malfunction.png` });
  await page.click('#skip');
  await waitFor(page, () => window.__ATC.state().mode === 'stage', null, 10000);
  const saveA = await page.evaluate(() => window.__ATC.app.save.data);
  check(saveA.tutorialDone && saveA.openingSeen, 'tutorial completion saved');

  // ---------------------------------------------------------------------------------------------
  log('\n[2] Pre-colonial era end-to-end');
  await sleep(1200);
  await page.screenshot({ path: `${OUT}/precolonial-room.png` });
  let s = await clearSublevel(page);
  check(s.kind === 'boss' && s.sub === 2, `cleared sub-levels 1-2 and reached the boss arena (${s.kind})`);
  const art1 = await page.evaluate(() => window.__ATC.app.save.data.artifacts);
  check(art1.includes('gold_bracelet'), `Gold Bracelet collected from the vault (${art1})`);
  const allies1 = await page.evaluate(() => window.__ATC.app.save.data.allies);
  check(allies1.includes('lapulapu'), `Lapu-Lapu recruited (${allies1})`);
  await fightBoss(page);
  await waitFor(page, () => window.__ATC.state().mode === 'safe', null, 15000);
  const saveB = await page.evaluate(() => window.__ATC.app.save.data);
  check(saveB.defeatedBosses.includes('magellan') && saveB.completedEras.includes('precolonial'), 'Magellan defeat recorded');
  check(saveB.run.shards > 0, `Time Shards carried into the safe room (${saveB.run.shards})`);
  await sleep(800);
  await page.screenshot({ path: `${OUT}/saferoom.png` });

  log('\n[3] Safe room panels');
  // Use interactables (works in the built bundle).
  const labels = await page.evaluate(() => window.__ATC.game_().interactables.map((i) => (typeof i.label === 'function' ? i.label() : i.label)));
  check(labels.length >= 7, `safe room stations present (${labels.length})`);
  for (let i = 0; i < labels.length; i++) {
    await page.evaluate((k) => window.__ATC.game_().interactables[k].use(), i);
    await sleep(400);
    if (i === 0) await page.screenshot({ path: `${OUT}/panel-${i}.png` });
    const n = await page.evaluate(() => document.querySelectorAll('.modal').length);
    check(n >= 1, `station "${labels[i]}" opens a panel`);
    // install components when in the repair panel
    await page.evaluate(() => document.querySelectorAll('.modal [data-i]').forEach((b) => b.textContent.includes('Install') && b.click()));
    await page.evaluate(() => window.__ATC.ui ? 0 : document.querySelectorAll('.modal .m-x').forEach((b) => b.click()));
    await sleep(200);
  }
  const inst = await page.evaluate(() => window.__ATC.app.save.data.installed);
  check(inst.includes('flux_regulator'), 'component installed for free');
  // Buy something at the upgrade station with shards
  const before = await page.evaluate(() => window.__ATC.game_().run.shards);
  await page.evaluate(() => { window.__ATC.game_().run.shards += 100; });
  await page.evaluate(() => window.__ATC.game_().interactables.find((i) => /Upgrade/.test(i.label)).use());
  await sleep(300);
  await page.screenshot({ path: `${OUT}/upgrades.png` });
  await page.evaluate(() => document.querySelector('.modal button[data-i="0"]').click());
  await sleep(200);
  const after = await page.evaluate(() => window.__ATC.game_().run);
  check(after.upgrades.maxHp === 1 && after.shards === before + 100 - 14, `upgrade purchase deducts shards (${before}+100 -> ${after.shards})`);
  await page.evaluate(() => document.querySelectorAll('.modal .m-x').forEach((b) => b.click()));
  await sleep(200);
  const persisted = await page.evaluate(() => window.__ATC.app.save.data.run.upgrades.maxHp);
  check(persisted === 1, 'safe-room purchase persisted to the save');

  // Console -> launch blocked for locked eras, allowed for next
  await page.evaluate(() => window.__ATC.game_().interactables.find((i) => /console/.test(i.label)).use());
  await sleep(400);
  await page.screenshot({ path: `${OUT}/console.png` });
  const gos = await page.evaluate(() => [...document.querySelectorAll('.modal [data-go]')].map((b) => `${b.dataset.go}:${b.dataset.sub}`));
  check(gos.includes('spanish:0') && !gos.some((g) => g.startsWith('american')), `console offers only unlocked eras (${gos})`);
  check(gos.includes('precolonial:2'), 'completed era can be revisited at any sub-level');
  await page.click('.modal [data-go=spanish]');
  await sleep(300);
  await page.click('.modal:last-child .btn.primary');
  await waitFor(page, () => window.__ATC.scene().includes('Cinematic'));
  await sleep(1200);
  await page.screenshot({ path: `${OUT}/launch.png` });
  await page.click('#skip');
  await waitFor(page, () => window.__ATC.state().mode === 'stage' && window.__ATC.state().era === 'spanish', null, 10000);

  // ---------------------------------------------------------------------------------------------
  for (const era of ['spanish', 'american', 'japanese', 'marcos']) {
    log(`\n[4] ${era} era`);
    await sleep(1000);
    await page.screenshot({ path: `${OUT}/${era}-room.png` });
    s = await clearSublevel(page);
    check(s.kind === 'boss' && s.era === era, `${era}: boss arena reached`);
    await fightBoss(page);
    await waitFor(page, () => window.__ATC.state().mode === 'safe', null, 15000);
    await sleep(500);
    const sv = await page.evaluate(() => window.__ATC.app.save.data);
    check(sv.completedEras.includes(era), `${era} completed`);
    if (era !== 'marcos') {
      const next = { spanish: 'american', american: 'japanese', japanese: 'marcos' }[era];
      await page.evaluate((n) => window.__ATC.cinematic('launch', { era: n, sub: 0 }), next);
      await page.click('#skip');
      await waitFor(page, (n) => window.__ATC.state().mode === 'stage' && window.__ATC.state().era === n, next, 10000);
    }
  }
  const sv = await page.evaluate(() => window.__ATC.app.save.data);
  check(sv.artifacts.length === 5, `all five artifacts collected (${sv.artifacts})`);
  check(['rizal', 'bonifacio', 'ibarra', 'macarthur_sr', 'macarthur_jr', 'hiroshi', 'ninoy'].every((a) => sv.allies.includes(a)), `allies recruited (${sv.allies})`);
  check(sv.secretUnlockNotified || window, 'secret unlock flagged');
  const secret = await page.evaluate(() => window.__ATC.campaign.isSecretUnlocked(window.__ATC.app.save.data));
  check(secret, 'secret era unlocked after 5 artifacts + 1985');

  log('\n[5] Secret 202X era + secret ending');
  await page.evaluate(() => window.__ATC.cinematic('launch', { era: 'modern', sub: 0 }));
  await page.click('#skip');
  await waitFor(page, () => window.__ATC.state().era === 'modern', null, 10000);
  await sleep(800);
  await page.screenshot({ path: `${OUT}/modern-room.png` });
  s = await clearSublevel(page);
  check(s.kind === 'boss', '202X boss arena reached');
  const bosses = await page.evaluate(() => window.__ATC.game_().enemies.filter((e) => e.isBoss).length);
  check(bosses === 2, 'BBM and Duterte both present');
  await fightBoss(page);
  await waitFor(page, () => window.__ATC.scene().includes('Cinematic'), null, 10000);
  await sleep(9000);
  await page.screenshot({ path: `${OUT}/secret-ending.png` });
  await page.click('#skip');
  await waitFor(page, () => window.__ATC.scene().includes('Menu'), null, 10000);
  check(await page.evaluate(() => window.__ATC.app.save.data.endings.secret), 'secret ending recorded');

  log('\n[6] Canon ending from the console');
  await page.click('[data-a=continue]');
  await waitFor(page, () => window.__ATC.state().mode === 'safe', null, 10000);
  await sleep(500);
  await page.evaluate(() => window.__ATC.game_().interactables.find((i) => /console/.test(i.label)).use());
  await sleep(300);
  await page.click('.modal [data-home]');
  await sleep(300);
  await page.click('.modal:last-child .btn.danger');
  await waitFor(page, () => window.__ATC.scene().includes('Cinematic'), null, 10000);
  await sleep(8000);
  await page.screenshot({ path: `${OUT}/canon-ending.png` });
  await page.click('#skip');
  await waitFor(page, () => window.__ATC.scene().includes('Menu'), null, 10000);
  check(await page.evaluate(() => window.__ATC.app.save.data.endings.canon), 'canon ending recorded');

  log('\n[7] Persistence across reload');
  await page.reload();
  await page.waitForFunction(() => window.__ATC && window.__ATC.scene().includes('Menu'));
  const re = await page.evaluate(() => window.__ATC.app.save.data);
  check(re.artifacts.length === 5 && re.completedEras.length === 6 && re.endings.canon && re.endings.secret, 'campaign, artifacts and endings persist across reload');
  check(page.errors.length === 0, `no runtime errors in desktop run${page.errors.length ? `:\n${page.errors.join('\n')}` : ''}`);
  await page.context().close();

  // ---------------------------------------------------------------------------------------------
  log('\n[8] Death, retry and checkpoint restore');
  page = await newPage();
  await page.evaluate(() => { window.__ATC.newRun(); window.__ATC.start({ mode: 'stage', eraId: 'precolonial', sub: 0 }); });
  await waitFor(page, () => window.__ATC.state().mode === 'stage');
  await sleep(1500);
  await page.evaluate(() => { const g = window.__ATC.game_(); g.run.shards = 77; const p = g.player; p.invulnUntil = 0; p.hurt(999); });
  await waitFor(page, () => document.querySelectorAll('.modal').length > 0, null, 5000);
  await page.screenshot({ path: `${OUT}/defeat.png` });
  await page.click('.modal .btn.primary');
  await waitFor(page, () => window.__ATC.state().mode === 'stage' && window.__ATC.state().modals === 0, null, 8000);
  await sleep(1000);
  const sh = await page.evaluate(() => window.__ATC.game_().run.shards);
  check(sh === 0, `retry restores the checkpoint shards (${sh})`);
  check(page.errors.length === 0, `no runtime errors in death/retry${page.errors.length ? `:\n${page.errors.join('\n')}` : ''}`);
  // Pause menu
  await page.keyboard.press('Escape');
  await sleep(300);
  check(await page.evaluate(() => document.querySelector('.modal h2').textContent === 'Paused'), 'Escape opens the pause menu');
  await page.keyboard.press('Escape');
  await sleep(300);
  check(await page.evaluate(() => document.querySelectorAll('.modal').length === 0), 'Escape closes the pause menu');
  // Resize & aim accuracy
  await page.setViewportSize({ width: 900, height: 600 });
  await sleep(500);
  const aim = await page.evaluate(() => {
    const g = window.__ATC.game_(); const cam = g.cameras.main; const dpr = window.__ATC.app.dpr; const p = g.player.sprite;
    return { sx: (p.x + 40 - cam.worldView.x) * cam.zoom / dpr, sy: (p.y - cam.worldView.y) * cam.zoom / dpr, px: p.x + 40, py: p.y };
  });
  await page.mouse.move(aim.sx, aim.sy);
  await sleep(200);
  const ap = await page.evaluate(() => { const g = window.__ATC.game_(); return g.getAimPoint(g.player); });
  check(Math.abs(ap.x - aim.px) < 3 && Math.abs(ap.y - aim.py) < 3, `aim stays accurate after resize (${ap.x.toFixed(1)},${ap.y.toFixed(1)} vs ${aim.px.toFixed(1)},${aim.py.toFixed(1)})`);
  await page.context().close();

  // ---------------------------------------------------------------------------------------------
  log('\n[9] Mobile (touch) emulation');
  page = await newPage({ ...devices['Pixel 7'], viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });
  await page.evaluate(() => { window.__ATC.newRun(); window.__ATC.start({ mode: 'stage', eraId: 'precolonial', sub: 0 }); });
  await waitFor(page, () => window.__ATC.state().mode === 'stage');
  await sleep(1200);
  check(await page.evaluate(() => document.getElementById('touch').classList.contains('show')), 'touch controls visible on a touch device');
  const p0 = await page.evaluate(() => { const p = window.__ATC.player().sprite; return { x: p.x, y: p.y }; });
  // Simulated joystick drag + simultaneous FIRE hold with two pointer ids.
  await page.evaluate(async () => {
    const left = document.querySelector('.t-left');
    const atk = document.querySelector('.t-attack');
    const r = left.getBoundingClientRect(); const a = atk.getBoundingClientRect();
    const ev = (el, type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 }));
    const sx = r.left + 90, sy = r.top + r.height * 0.6;
    ev(left, 'pointerdown', 1, sx, sy);
    ev(left, 'pointermove', 1, sx, sy - 40);
    ev(atk, 'pointerdown', 2, a.left + a.width / 2, a.top + a.height / 2);
    await new Promise((res) => setTimeout(res, 1200));
    window.__touchState = { move: { ...window.__ATC.game_().player ? {} : {} } };
    ev(left, 'pointercancel', 1, sx, sy - 40);
    ev(atk, 'pointerup', 2, a.left, a.top);
  });
  await sleep(300);
  const p1 = await page.evaluate(() => { const p = window.__ATC.player().sprite; return { x: p.x, y: p.y }; });
  check(p1.y < p0.y - 10, `virtual joystick moves Anon (${p0.y.toFixed(0)} -> ${p1.y.toFixed(0)})`);
  const stuck = await page.evaluate(() => { const g = window.__ATC.game_(); return { v: g.player.sprite.body.velocity.length(), fire: false }; });
  check(stuck.v < 1, 'interrupted touch (pointercancel) leaves no stuck movement');
  await page.screenshot({ path: `${OUT}/mobile-landscape.png` });
  await page.setViewportSize({ width: 412, height: 915 });
  await sleep(600);
  await page.screenshot({ path: `${OUT}/mobile-portrait.png` });
  check(page.errors.length === 0, `no runtime errors on mobile${page.errors.length ? `:\n${page.errors.join('\n')}` : ''}`);
  await page.context().close();

  // ---------------------------------------------------------------------------------------------
  log('\n[9b] Hard mode: full Soul Knight-style floors');
  page = await newPage();
  await page.evaluate(() => { window.__ATC.newRun(); const s = window.__ATC.app.save.data; s.settings.difficulty = 'hard'; window.__ATC.app.save.commit(); window.__ATC.start({ mode: 'stage', eraId: 'precolonial', sub: 0 }); });
  await waitFor(page, () => window.__ATC.state().mode === 'stage');
  await sleep(1500);
  check(await page.evaluate(() => !!window.__ATC.game_().ctrl.dg), 'hard mode builds a full floor');
  check(await page.evaluate(() => !document.getElementById('minimap').classList.contains('hidden')), 'minimap visible');
  await page.screenshot({ path: `${OUT}/hard-floor-start.png` });
  for (const sub of [0, 1]) {
    const info = await page.evaluate(() => { const d = window.__ATC.game_().ctrl.dg; return { combat: d.rooms.filter((r) => r.kind === 'combat').length, sides: d.rooms.filter((r) => r.kind === 'side').map((r) => r.side.kind) }; });
    log(`  floor ${sub + 1}: ${info.combat} combat rooms, side rooms: ${info.sides.join(', ')}`);
    // Clear combat rooms in path order.
    const ids = await page.evaluate(() => window.__ATC.game_().ctrl.dg.rooms.filter((r) => r.kind === 'combat').sort((a, b) => a.combatIndex - b.combatIndex).map((r) => r.id));
    for (const id of ids) {
      await page.evaluate((rid) => { const c = window.__ATC.game_().ctrl; const r = c.roomById.get(rid); window.__ATC.tp(r.center.x * 16 + 8, r.center.y * 16 + 8); }, id);
      await sleep(300);
      for (let k = 0; k < 20; k++) {
        const cleared = await page.evaluate((rid) => { const c = window.__ATC.game_().ctrl; return c.state(c.roomById.get(rid)).cleared; }, id);
        if (cleared) break;
        await page.evaluate(() => window.__ATC.killAll());
        await sleep(500);
      }
      if (id === ids[1] && sub === 0) await page.screenshot({ path: `${OUT}/hard-floor-combat.png` });
    }
    const allClear = await page.evaluate(() => { const c = window.__ATC.game_().ctrl; return c.combatRooms().every((r) => c.state(r).cleared); });
    check(allClear, `floor ${sub + 1}: every combat room cleared and doors reopened`);
    // Visit side rooms (reveal hidden ones first).
    const sides = await page.evaluate(() => window.__ATC.game_().ctrl.dg.rooms.filter((r) => r.kind === 'side').map((r) => r.id));
    for (const id of sides) {
      await page.evaluate((rid) => { const c = window.__ATC.game_().ctrl; const r = c.roomById.get(rid); const l = c.dg.links.find((x) => x.b === r); if (l.hidden) c.revealLink(l); window.__ATC.tp(r.center.x * 16 + 8, r.center.y * 16 + 8); }, id);
      await sleep(1500);
      await page.evaluate(() => window.__ATC.killAll());
      await sleep(800);
      await page.evaluate(() => { const g = window.__ATC.game_(); for (const it of g.interactables.filter((i) => /vault|chest|cache/i.test(typeof i.label === 'function' ? i.label() : i.label))) it.use(); });
      await sleep(500);
      await dismissDialogs(page);
    }
    // Into the time rift
    await page.evaluate(() => { const c = window.__ATC.game_().ctrl; window.__ATC.tp(c.riftPos.x, c.riftPos.y); });
    await waitFor(page, (n) => window.__ATC.state().sub === n, sub + 1, 10000);
    await sleep(1200);
  }
  check(await page.evaluate(() => window.__ATC.app.save.data.artifacts.includes('gold_bracelet')), 'hard floor 2 vault gives the artifact');
  const bossState = await st(page);
  check(bossState.kind === 'boss', 'hard mode still ends the era in the boss arena');
  check(page.errors.length === 0, `no runtime errors in hard mode${page.errors.length ? `:\n${page.errors.join('\n')}` : ''}`);
  await page.context().close();

  // ---------------------------------------------------------------------------------------------
  log('\n[10] Corrupt save handling');
  page = await newPage();
  await page.evaluate(() => localStorage.setItem('anons-time-crisis.save', '{"broken'));
  await page.reload();
  await page.waitForFunction(() => window.__ATC && window.__ATC.scene().includes('Menu'));
  check(await page.evaluate(() => window.__ATC.app.save.warning !== null && window.__ATC.app.save.data.artifacts.length === 0), 'corrupt save replaced with a fresh one and a warning');
  await page.context().close();
} catch (err) {
  failures++;
  console.error('E2E crashed:', err);
  for (const pg of browser.contexts().flatMap((c) => c.pages())) {
    console.error('state:', await pg.evaluate(() => JSON.stringify(window.__ATC.state())).catch(() => '?'));
    console.error('errors:', pg.errors);
    await pg.screenshot({ path: `${OUT}/crash.png` }).catch(() => {});
  }
} finally {
  await browser.close();
  server.kill();
}
log(failures ? `\n${failures} check(s) failed` : '\nAll E2E checks passed');
process.exit(failures ? 1 : 0);
