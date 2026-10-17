// The DeVios safe room: a garage around the time machine where Anon prepares between eras.
import { DEPTH } from '../config.js';
import { ui } from '../ui/ui.js';
import { audio } from '../systems/audio.js';
import * as campaign from '../systems/campaign.js';
import { SAFE_ROOM } from '../data/rooms.js';
import { ERAS } from '../data/eras.js';
import { tileCenter, addImage, addGlow } from './helpers.js';
import { openConsole, openArmory, openUpgrades, openRepair, openAllies, openArtifacts, openSupplies } from '../ui/safepanels.js';
import { rand } from '../systems/rng.js';

const STATIONS = [
  { key: 'st_armory', label: 'Armory', prompt: 'Inventory & equipment', open: (sc) => openArmory(sc, { allowStash: true }) },
  { key: 'st_upgrade', label: 'Upgrades', prompt: 'Upgrade station', open: (sc) => openUpgrades(sc) },
  { key: 'st_repair', label: 'Repairs', prompt: 'Repair station (free)', open: (sc) => openRepair(sc) },
  { key: 'st_bench', label: 'Allies', prompt: 'Ally bench — choose a companion', open: (sc) => openAllies(sc) },
  { key: 'st_case', label: 'Artifacts', prompt: 'Artifact collection', open: (sc) => openArtifacts(sc) },
  { key: 'st_locker', label: 'Supplies', prompt: 'Supply locker (shop)', open: (sc) => openSupplies(sc) },
];

export class SafeRoomController {
  constructor(scene, data) { this.scene = scene; this.data = data || {}; }

  start() {
    const sc = this.scene;
    sc.safeMode = true;
    const save = sc.save.data;
    sc.run.location = null;
    const r = sc.buildRoom(SAFE_ROOM, 'lab', { propTypes: ['crate_tech'] });
    const p = tileCenter(r.spots.P[0]);
    sc.spawnPlayer(p.x, p.y);
    sc.wirePhysics();
    sc.player.hp = sc.player.maxHp;
    sc.checkpoint();
    audio.music('safe');

    // The DeVios (top-down Vios), solid, with the time-circuit console inside.
    const c = tileCenter(r.spots.c[0]);
    this.car = sc.physics.add.staticImage(c.x + 40, c.y + 8, 'devios_top').setDepth(DEPTH.actor + (c.y + 40) * 0.001);
    this.car.body.setSize(40, 70).setOffset(2, 5);
    this.car.refreshBody();
    this.carGlow = sc.add.image(this.car.x, this.car.y, 'devios_top_glow').setDepth(this.car.depth + 0.0001).setAlpha(0);
    sc.roomObjects.push(this.car, this.carGlow);
    sc.roomColliders.push(sc.physics.add.collider(sc.player.sprite, this.car));
    const tag = sc.add.text(this.car.x, this.car.y - 50, 'DeVios', { fontFamily: 'monospace', fontSize: '9px', color: '#47e0ff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(DEPTH.text).setResolution(4);
    sc.roomObjects.push(tag);
    sc.addInteractable({ x: this.car.x - 26, y: this.car.y - 6, r: 30, label: 'Time-circuit console (destinations & launch)', use: () => this.openConsole() });
    sc.addInteractable({ x: this.car.x + 26, y: this.car.y - 6, r: 30, label: 'Time-circuit console (destinations & launch)', use: () => this.openConsole() });
    this.sparkT = 0;
    this.onRepairGlow();

    // Stations
    r.spots.m.forEach((spot, i) => {
      const st = STATIONS[i];
      if (!st) return;
      const pt = tileCenter(spot);
      addImage(sc, st.key, pt.x, pt.y, { origin: [0.5, 0.75] });
      const t = sc.add.text(pt.x, pt.y - 22, st.label, { fontFamily: 'monospace', fontSize: '7px', color: '#fff8d0', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(DEPTH.text).setResolution(4);
      sc.roomObjects.push(t);
      sc.addInteractable({ x: pt.x, y: pt.y, r: 26, label: st.prompt, use: () => st.open(sc) });
    });
    sc.onRepair = () => this.onRepairGlow();

    ui.banner('DeVios Safe Room', 'No enemies here. Shop, upgrade, repair, then launch.', 2200);
    if (this.data.fresh) ui.toast('New run started: Time Shards and run upgrades reset. Campaign progress kept.', 'gold');
    const prog = campaign.repairProgress(save);
    if (prog.recovered > prog.installed) ui.toast('A recovered component is waiting at the Repair station!', 'gold');
    if (campaign.isSecretUnlocked(save) && !save.secretUnlockNotified) {
      save.secretUnlockNotified = true;
      sc.save.commit();
      sc.time.delayedCall(1200, () => ui.banner('Secret destination unlocked!', 'All five artifacts: the time circuits now accept 202X.', 3200));
    }
  }

  onRepairGlow() {
    const save = this.scene.save.data;
    this.stability = campaign.repairProgress(save).installed / 5;
  }

  openConsole() {
    openConsole(this.scene, (choice) => {
      const sc = this.scene;
      sc.checkpoint({ location: null });
      if (choice.home) sc.goto('Cinematic', { kind: 'canon' });
      else sc.goto('Cinematic', { kind: 'launch', era: choice.era, sub: choice.sub });
    });
  }

  hudTitle() { return 'DeVios Safe Room'; }

  objective() {
    const save = this.scene.save.data;
    const prog = campaign.repairProgress(save);
    if (prog.recovered > prog.installed) return 'Install the recovered component at the Repair station, then use the DeVios console.';
    const next = campaign.nextEra(save);
    if (next) return `Next destination: ${ERAS[next].name}. Use the DeVios console to launch.`;
    if (campaign.isSecretUnlocked(save) && !save.endings.secret) return 'The DeVios is repaired! Go home to 205X… or visit the secret 202X.';
    return 'The DeVios is repaired! Use the console to return to 205X.';
  }

  describe() { return 'DeVios safe room'; }

  update(dt) {
    // Flickering time-machine energy: more stable as repairs progress.
    this.sparkT -= dt;
    if (this.sparkT <= 0 && this.car) {
      this.sparkT = 500 + rand.next() * (600 + this.stability * 2500);
      const unstable = 1 - this.stability;
      this.carGlow.setAlpha(0.6 + unstable * 0.4);
      this.scene.tweens.add({ targets: this.carGlow, alpha: this.stability >= 1 ? 0.25 : 0, duration: 400 });
      if (rand.chance(0.3 + unstable * 0.6)) {
        const x = this.car.x + (rand.next() - 0.5) * 40, y = this.car.y + 20 + rand.next() * 18;
        this.scene.combat.lightning(x, y, x + (rand.next() - 0.5) * 30, y + (rand.next() - 0.5) * 20, 0x9ff6ff, 160);
        audio.play('zap', { gap: 200 });
      }
    }
  }

  destroy() { this.scene.onRepair = null; }
}

export { addGlow };
