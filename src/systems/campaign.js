// Campaign progression rules. Pure functions over the save object so they can be
// unit-tested and so the UI can never bypass them.
import { MAIN_ERAS, SECRET_ERA, ERAS } from '../data/eras.js';
import { ARTIFACTS } from '../data/artifacts.js';
import { COMPONENT_BY_ERA } from '../data/components.js';

export const bossIdsFor = (eraId) => (ERAS[eraId] && ERAS[eraId].boss) || [];

export function isEraComplete(save, eraId) {
  return save.completedEras.includes(eraId);
}

export function hasAllArtifacts(save) {
  return ARTIFACTS.every((a) => save.artifacts.includes(a.id));
}

export function isEraUnlocked(save, eraId) {
  if (eraId === SECRET_ERA) return isSecretUnlocked(save);
  const idx = MAIN_ERAS.indexOf(eraId);
  if (idx < 0) return false;
  if (idx === 0) return true;
  return isEraComplete(save, MAIN_ERAS[idx - 1]);
}

// The secret era requires all five artifacts AND clearing the fifth main era.
export function isSecretUnlocked(save) {
  return hasAllArtifacts(save) && isEraComplete(save, 'marcos');
}

export function canReturnHome(save) {
  return isEraComplete(save, 'marcos');
}

export function nextEra(save) {
  return MAIN_ERAS.find((e) => !isEraComplete(save, e)) || null;
}

export function destinations(save) {
  const list = MAIN_ERAS.map((id) => ({
    id,
    unlocked: isEraUnlocked(save, id),
    complete: isEraComplete(save, id),
    artifactFound: ARTIFACTS.some((a) => a.era === id && save.artifacts.includes(a.id)),
  }));
  list.push({ id: SECRET_ERA, unlocked: isSecretUnlocked(save), complete: isEraComplete(save, SECRET_ERA), secret: true });
  return list;
}

// Called once per boss kill. Idempotent: repeat calls never duplicate progression.
// Returns { newlyCompleted, component } describing what changed.
export function recordBossDefeat(save, bossId) {
  if (!save.defeatedBosses.includes(bossId)) save.defeatedBosses.push(bossId);
  const eraId = Object.keys(ERAS).find((e) => bossIdsFor(e).includes(bossId));
  if (!eraId) return { newlyCompleted: false };
  const allDown = bossIdsFor(eraId).every((b) => save.defeatedBosses.includes(b));
  if (!allDown || save.completedEras.includes(eraId)) return { newlyCompleted: false, eraId };
  save.completedEras.push(eraId);
  const comp = COMPONENT_BY_ERA[eraId];
  if (comp && !save.components.includes(comp.id)) save.components.push(comp.id);
  return { newlyCompleted: true, eraId, component: comp || null };
}

export function collectArtifact(save, artifactId) {
  if (save.artifacts.includes(artifactId)) return false;
  save.artifacts.push(artifactId);
  return true;
}

export function unlockAlly(save, allyId) {
  if (save.allies.includes(allyId)) return false;
  save.allies.push(allyId);
  if (!save.activeAlly) save.activeAlly = allyId;
  return true;
}

// Repairs are free: any recovered component can be installed.
export function installComponent(save, compId) {
  if (!save.components.includes(compId) || save.installed.includes(compId)) return false;
  save.installed.push(compId);
  return true;
}

export function repairProgress(save) {
  return { installed: save.installed.length, recovered: save.components.length, total: MAIN_ERAS.length };
}

// Validate a launch request. The safe-room UI only offers valid choices, but this is the
// authority: the stage loader calls it before building a level.
export function validateLaunch(save, eraId, sub = 0) {
  if (!ERAS[eraId] || eraId === 'lab') return { ok: false, reason: 'Unknown destination.' };
  if (!isEraUnlocked(save, eraId)) return { ok: false, reason: 'The time circuits refuse: that destination is still locked.' };
  if (sub < 0 || sub > 2) return { ok: false, reason: 'Unknown sub-level.' };
  // Uncompleted eras can only be entered mid-way by resuming the run's own checkpoint
  // (retrying a sub-level or boss). Completed eras can be revisited at any sub-level.
  const loc = save.run && save.run.location;
  const resuming = loc && loc.era === eraId && loc.sub >= sub;
  if (sub > 0 && !isEraComplete(save, eraId) && !resuming) return { ok: false, reason: 'Start uncompleted eras from the first sub-level.' };
  return { ok: true };
}
