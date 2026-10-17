// Versioned, defensive localStorage save system.
// Permanent campaign progress lives here; the current *run* (Time Shards, loadout,
// temporary upgrades) is stored as a checkpoint snapshot under `run`.
export const SAVE_KEY = 'anons-time-crisis.save';
export const SAVE_VERSION = 2;

export function defaultSettings() {
  return { difficulty: 'easy', master: 0.8, music: 0.45, sfx: 0.8, muted: false, uiScale: 1, autoAim: true, touchControls: 'auto' };
}

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    openingSeen: false,
    tutorialDone: false,
    defeatedBosses: [],
    completedEras: [],
    artifacts: [],
    allies: [],
    activeAlly: null,
    components: [],
    installed: [],
    endings: { canon: false, secret: false },
    secretUnlockNotified: false,
    permanent: { maxHp: 0, shardBonus: 0 },
    settings: defaultSettings(),
    run: null,
    stats: { runs: 0, deaths: 0 },
  };
}

const uniqStrings = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string'))] : []);
const num = (v, d, min = -Infinity, max = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);

// Migrate older save shapes forward. Each step must be idempotent.
export function migrate(raw) {
  const s = { ...raw };
  if (!s.version || s.version < 2) {
    // v1 stored artifacts as an object map {id: true}.
    if (s.artifacts && !Array.isArray(s.artifacts) && typeof s.artifacts === 'object') {
      s.artifacts = Object.keys(s.artifacts).filter((k) => s.artifacts[k]);
    }
    s.version = 2;
  }
  return s;
}

export function sanitize(raw) {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const s = migrate(raw);
  const out = {
    ...d,
    version: SAVE_VERSION,
    openingSeen: !!s.openingSeen,
    tutorialDone: !!s.tutorialDone,
    defeatedBosses: uniqStrings(s.defeatedBosses),
    completedEras: uniqStrings(s.completedEras),
    artifacts: uniqStrings(s.artifacts),
    allies: uniqStrings(s.allies),
    activeAlly: typeof s.activeAlly === 'string' ? s.activeAlly : null,
    components: uniqStrings(s.components),
    installed: uniqStrings(s.installed),
    endings: { canon: !!(s.endings && s.endings.canon), secret: !!(s.endings && s.endings.secret) },
    secretUnlockNotified: !!s.secretUnlockNotified,
    permanent: {
      maxHp: num(s.permanent && s.permanent.maxHp, 0, 0, 3),
      shardBonus: num(s.permanent && s.permanent.shardBonus, 0, 0, 2),
    },
    stats: { runs: num(s.stats && s.stats.runs, 0, 0), deaths: num(s.stats && s.stats.deaths, 0, 0) },
  };
  const st = s.settings || {};
  out.settings = {
    difficulty: ['easy', 'normal', 'hard'].includes(st.difficulty) ? st.difficulty : 'easy',
    master: num(st.master, d.settings.master, 0, 1),
    music: num(st.music, d.settings.music, 0, 1),
    sfx: num(st.sfx, d.settings.sfx, 0, 1),
    muted: !!st.muted,
    uiScale: num(st.uiScale, 1, 0.8, 1.4),
    autoAim: st.autoAim !== false,
    touchControls: ['auto', 'on', 'off'].includes(st.touchControls) ? st.touchControls : 'auto',
  };
  if (out.activeAlly && !out.allies.includes(out.activeAlly)) out.activeAlly = null;
  out.run = sanitizeRun(s.run);
  return out;
}

export function sanitizeRun(r) {
  if (!r || typeof r !== 'object') return null;
  if (!Array.isArray(r.loadout) || r.loadout.length === 0) return null;
  const loadout = r.loadout
    .filter((w) => w && typeof w.id === 'string')
    .slice(0, 4)
    .map((w) => ({ id: w.id, ammo: num(w.ammo, 0, 0), reserve: w.reserve === null ? null : num(w.reserve, 0, 0), level: num(w.level, 0, 0, 3) }));
  if (!loadout.length) return null;
  return {
    id: typeof r.id === 'string' ? r.id : String(Date.now()),
    shards: Math.floor(num(r.shards, 0, 0, 99999)),
    loadout,
    current: Math.floor(num(r.current, 0, 0, loadout.length - 1)),
    stash: uniqStrings(r.stash),
    hp: num(r.hp, 0, 0),
    consumables: {
      bomb: Math.floor(num(r.consumables && r.consumables.bomb, 0, 0, 9)),
      patch: Math.floor(num(r.consumables && r.consumables.patch, 0, 0, 9)),
      shield: Math.floor(num(r.consumables && r.consumables.shield, 0, 0, 9)),
    },
    upgrades: {
      damage: Math.floor(num(r.upgrades && r.upgrades.damage, 0, 0, 5)),
      maxHp: Math.floor(num(r.upgrades && r.upgrades.maxHp, 0, 0, 5)),
      dodge: Math.floor(num(r.upgrades && r.upgrades.dodge, 0, 0, 3)),
      armor: Math.floor(num(r.upgrades && r.upgrades.armor, 0, 0, 3)),
      magnet: Math.floor(num(r.upgrades && r.upgrades.magnet, 0, 0, 3)),
      ammo: Math.floor(num(r.upgrades && r.upgrades.ammo, 0, 0, 3)),
    },
    bossRewarded: uniqStrings(r.bossRewarded),
    location: r.location && typeof r.location === 'object' && typeof r.location.era === 'string'
      ? { era: r.location.era, sub: Math.floor(num(r.location.sub, 0, 0, 2)) }
      : null,
    lastEra: typeof r.lastEra === 'string' ? r.lastEra : null,
  };
}

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

function pickStorage() {
  try {
    const ls = globalThis.localStorage;
    const probe = '__atc_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return memoryStorage();
  }
}

export class SaveStore {
  constructor(storage = pickStorage()) {
    this.storage = storage;
    this.warning = null;
    this.data = this.load();
  }

  load() {
    let raw = null;
    try {
      raw = this.storage.getItem(SAVE_KEY);
    } catch {
      raw = null;
    }
    if (!raw) return defaultSave();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error('bad save');
      return sanitize(parsed);
    } catch {
      this.warning = 'Your save data was unreadable, so a fresh save was started. (A backup copy was kept.)';
      try {
        this.storage.setItem(SAVE_KEY + '.corrupt-backup', raw);
      } catch { /* ignore */ }
      return defaultSave();
    }
  }

  commit() {
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      return false;
    }
  }

  update(fn) {
    fn(this.data);
    this.commit();
    return this.data;
  }

  // Reset campaign progress but keep settings.
  reset() {
    const settings = this.data.settings;
    this.data = defaultSave();
    this.data.settings = settings;
    this.commit();
  }
}
