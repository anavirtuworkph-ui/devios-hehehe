// Shared application singletons (save store, Phaser game, generated UI images).
import { SaveStore } from './systems/save.js';

export const app = {
  save: new SaveStore(),
  game: null,
  images: {},
  dpr: 1,
};

export function persistRun(run) {
  // Store a clean copy of the run (runtime-only fields start with "_").
  app.save.data.run = JSON.parse(JSON.stringify(run, (k, v) => (k.startsWith('_') ? undefined : v)));
  app.save.commit();
}
