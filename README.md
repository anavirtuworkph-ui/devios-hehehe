# Anon's Time Crisis

A 2D top-down action roguelike for desktop and mobile browsers. Anon, an eccentric scientist from 205X, turns a 2026 Toyota Vios into the **DeVios** time machine. The navigation fails and strands him in Philippine history. He has to recover the DeVios's parts, beat each era's boss, recruit allies and collect five artifacts.

The combat, room-by-room structure and bosses are inspired by Soul Knight. All art is generated procedurally at runtime and all audio is synthesized with WebAudio. The project contains no third-party game art, film stills or sound files.

> Alternate-history comedy and satire. Real historical and political figures appear only as fictionalized arcade characters. All dialogue and events are invented and are not factual claims.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173 (also reachable from phones on the same LAN)
npm test           # unit tests for rules: save, campaign, economy, sub-rooms, data, room templates
npm run build      # production build in dist/
npm run test:e2e   # plays the built game in headless Chromium (needs `npm run build` first)
```

`test:e2e` uses the Chromium headless shell at `/opt/pw-browsers/...`. To use a different browser, set `CHROMIUM_PATH=/path/to/chrome`. Screenshots are written to `test-results/`, or to `E2E_OUT` if set.

## Deployment

`npm run build` produces a fully static site in `dist/` with relative asset paths (`base: './'`). Upload that folder to any static host: GitHub Pages, Netlify, Vercel, itch.io (as an HTML5 zip), S3, or nginx. You don't need a server, a launcher or a native app.

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Move | WASD / arrows | Left-side virtual joystick (touch anywhere on the left) |
| Aim | Mouse | Drag the FIRE button, or auto-aim (toggle in Settings) |
| Fire / attack | Left click (hold) | Hold FIRE |
| Dodge (i-frames) | Space / Shift | DODGE |
| Interact | E | USE (appears when something is nearby) |
| Switch weapon | 1–4, Tab, mouse wheel | SWAP |
| Reload | R | RELOAD |
| Use / cycle item | Q / C | ITEM |
| Pause | Esc / P / ‖ button | ‖ button |

Keyboard, mouse and touch all feed one shared action layer (`src/systems/input.js`), so desktop and mobile run the same combat code. Several touches work at the same time, each tracked by its own pointer id. A touch that gets interrupted (pointercancel, focus loss, a hidden tab) releases every control, so nothing stays stuck. The game pauses itself when the tab is backgrounded.

## Campaign

1. **Tutorial, 205X:** movement, shooting, melee, dodge, pickups, health, interaction, then the time-circuit malfunction. It can be skipped, and replayed from the menu.
2. **Pre-Colonial:** boss Magellan; Poison Spear, Kris; ally Lapu-Lapu; Gold Bracelet.
3. **Spanish Colonial:** boss Padre Dámaso; Bolo, Rolling Block, M93, C96, Rizal's Quill and Book; allies Rizal, Bonifacio and Ibarra (sketched on an easel with the Quill); Noli Me Tangere original.
4. **American Colonial:** boss McKinley; Howitzer, Colt Single Action, Springfield, Model 1987; allies Arthur MacArthur and MacArthur Jr.; Conant Coin.
5. **Japanese Occupation:** boss Col. Yuta Saitoh (3 phases); Type 38, Type 99, Nambu, Katana, BAR, Thompson, Bayonet; ally Hiroshi Tanaka; Mickey Mouse Money. This era uses a more muted palette.
6. **Marcos Era, 1985:** boss Marcos Sr. (3 phases); M1 Garand, M1 Carbine, BAR, Grease Gun, M60, Bongbong Rocket Launcher, Thompson, M1911; ally Ninoy Aquino (reconstructed in an alternate timeline); Rolex 12.
7. **Secret 202X:** BBM and Duterte as a duo boss fight with separate health bars and alternating big attacks; Beretta, Barrett, IWI Galil ACE, Balisong, MMAW, Improvised RPG.

Each era has three short sub-levels: two with combat rooms, and a boss arena. In sub-level 2, an **Artifact Vault** side room is guaranteed until you have that era's artifact. You can revisit any cleared era, at any sub-level, from the DeVios console. The secret era opens only when all five artifacts are collected **and** 1985 is cleared. `systems/campaign.js` enforces this, not the UI.

**Endings:** after 1985, *Return to 205X* in the console plays the **canon ending**. Beating the 202X duo plays the **non-canon secret ending**.

## Systems

- **Weapons** (`src/data/weapons.js`): data-driven damage, cooldown, range, speed, magazine, reload, reserve, spread, pellets, AoE, pierce and special abilities. Specials include poison, lobbed shells with a visible blast radius, en-bloc ping, wobble, confetti, split rockets, movement slow while firing, knockback, and the literary weapon. Melee swings destroy enemy bullets.
- **Rizal's Quill:** each shot is El Filibusterismo (3 ink shots, 4–6 damage) or Noli Me Tangere (one blot, 10–15 damage). There is a 1-in-200 chance per firing event of **Mi Último Adiós**, which instantly defeats ordinary enemies within 3 m (1 m = 24 px). Bosses are immune to the instant kill and take a flat 40 damage instead.
- **Model 1987:** the name is kept as supplied. Its exact historical identity is ambiguous, so the game interprets it as a lever/pump-era scattergun with fictional, game-balanced stats.
- **Enemies** (`src/data/enemies.js`): melee, ranged, fast, armored and bomber archetypes, plus elites and era-specific variants. In the story they are *temporal echoes* created by the malfunction, so no real group is portrayed as hostile. If an enemy gets stuck or leaves the room bounds, it is relocated so a room can always be completed.
- **Bosses** (`src/entities/Boss.js`, `src/data/bosses.js`): an intro, a health bar, at least 3 telegraphed attacks per phase, multiple phases, and a defeat sequence. Victory is guarded so it fires only once, and recording progression is idempotent.
- **Companions:** one active ally at a time, chosen in the DeVios. Each has a distinct role (melee, ranged, healer, damage buff, slow, stun). Allies can't be hurt, never collide with Anon or doors, and teleport back if they are left behind or stuck. They deal reduced damage to bosses.
- **Time Shards:** one currency, styled differently in each era. Drops are 1–3 per enemy, 4–8 per elite, 15–30 per boss (paid once per boss per run), 5–10 per small chest and 10–20 per large chest. Rooms magnet all remaining shards when cleared and again when you leave, so nothing is lost moving between rooms.
- **Historical Archive:** every non-boss sub-level of the five main eras, on every difficulty, has one archive side room (`src/data/history.js`, built in `src/game/subroomContent.js`); the secret 202X era has none. It holds plaques with real facts about that era and a curator's multiple-choice quiz. A correct answer pays 8 Time Shards, once per visit; a wrong answer shows the right one and costs nothing. Examples: the Katipunan's full name, *Kataastaasan, Kagalanggalangang Katipunan ng mga Anak ng Bayan* (founded 7 July 1892), and the EDSA People Power Revolution, 22–25 February 1986. The facts are real history; only the boss fights are fiction.
- **Optional sub-rooms** (weighted: Shop 25, Treasure 25, Healing 15, Trial 10, Anomaly 10, Rest 10, Hidden 5): there is a 75% chance of an optional room after the first combat room. Hidden rooms sit behind a cracked wall: shoot it or inspect it. There are never detours before a boss.
- **DeVios safe room:** time-circuit console with destinations, repair status and launch; armory and stash; upgrade station; free repair station; ally bench; artifact case; supply locker. You can't take damage there, and purchases are saved immediately.
- **Upgrades:** run upgrades (max HP, damage, dodge, armor, shard magnet, ammo) reset with each new run. Permanent upgrades are capped and modest: +2 max HP ×3 and +5% shards ×2.
- **Difficulty:** Easy is the default. Normal raises enemy HP, damage and count, adds second waves, shortens telegraphs and makes bosses faster. Nothing is locked behind difficulty.
- **Hard mode (full floors):** only on Hard, sub-levels 1 and 2 of every era become Soul Knight-style floors (`src/systems/dungeon.js`, `src/game/hardstage.js`):
  - **Layout:** one connected map on a 5×3 or 5×4 grid of rooms, joined by corridors. A floor has a start room, 5 or 6 combat rooms on the main path, 2 or 3 side branches (weighted sub-room types; floor 2 always includes the artifact vault while that artifact is missing), and an exit room with a time rift.
  - **Combat:** walking into an uncleared combat room seals its doorways until every wave is down.
  - **Hidden branches:** sealed by a cracked wall you can shoot or inspect.
  - **Minimap:** shows visited rooms, plus rooms you can see through an open doorway.
  - **Stats:** enemies get 1.3× HP and damage, more elites, faster bullets, shorter telegraphs and quicker bosses. Anon starts with 18 HP.
  - **Boss arenas** stay the same, with the tougher stats.
  - **Testing:** a unit test generates 480 floors and checks that every room, spot and doorway is reachable and enclosed.

## Save data

The save lives in `localStorage` under the key `anons-time-crisis.save`. It is versioned (v2) and migrates older formats. Unreadable data is backed up under `…corrupt-backup` and replaced with a fresh save, and the player sees a notice. Settings → Reset progress, after a confirmation, erases campaign progress and keeps settings.

**Saved permanently:** tutorial completion, completed eras, defeated bosses, artifacts (saved the moment you collect them), allies, DeVios components, endings, difficulty and settings, and permanent upgrades.

**Run (checkpoint):** Time Shards, loadout, stash, consumables, run upgrades and location. The checkpoint is written at the start of each sub-level and on every safe-room action. Dying or reloading returns you to the latest checkpoint. *New Run* resets the run but keeps the campaign.

## Code map

```
src/main.js                 boot, DPR-aware resizing, global input/audio wiring
src/app.js / settings.js    shared singletons, settings application
src/config.js               tuning constants and difficulty tables
src/data/                   eras, weapons, enemies, bosses, allies, artifacts, components, room templates
src/systems/                save, campaign rules, run state, economy/shops, sub-room planning,
                            combat (projectiles, telegraphs, pickups, FX), weapons, input, audio, textures, rng
src/entities/               Player, Enemy (AI framework), Boss (pattern executor), Companion
src/game/                   mode controllers: stage flow, sub-room contents, tutorial, DeVios safe room
src/scenes/                 Boot, Menu, Cinematic (opening/departure/launch/return/endings), Game
src/ui/                     DOM HUD, modals, dialogue, time circuits, touch controls, shop & safe-room panels
tests/                      node:test unit tests
scripts/e2e.mjs             Playwright end-to-end run through the whole campaign
```

## Testing performed

- **Unit tests** (`npm test`, 11 suites, all passing): save corruption, migration and round-trips; era unlock order; secret unlock rules; idempotent boss rewards; launch validation that prevents skipping eras; free repairs; loadout and stash; purchase validation (funds, stock, duplicates, caps); sub-room weights and guaranteed vaults; presence and price ranges of every required weapon; ≥3 attacks per boss phase; a recruit event for every ally; room templates that are enclosed with everything reachable.
- **End-to-end** (`npm run test:e2e`, headless Chromium 1280×720), all checks passing. Besides the items below, it plays two Hard-mode floors: every combat room, every side room including the vault, and the time rift into the boss arena.
  - Real input: keyboard movement and mouse-aimed shooting in the tutorial.
  - Full play-through: the tutorial, all 5 main eras, every boss, every vault artifact, all 8 allies, the safe-room stations and purchases, launch validation, the secret era with both duo bosses, the secret ending and the canon ending.
  - Persistence across reload, defeat followed by checkpoint retry, the pause menu, and aim accuracy after a window resize.
  - Mobile emulation (Pixel 7, landscape and portrait): touch controls, joystick movement while firing with a second touch, pointercancel recovery.
  - Corrupt-save recovery.
- To get through the whole campaign quickly, the E2E script uses a debug hook (`window.__ATC`) to defeat enemies and walk through doors. Boss attack patterns run for several seconds in every fight.

## Known limitations

- **Not tested on real phones or on Safari, Firefox or Edge.** Mobile was checked only through Chromium device emulation; the game uses only standard Pointer Events, WebAudio and Canvas/WebGL APIs.
- **Balance is a first pass.** Boss HP, enemy counts and prices follow the spec's starting values, but there has been no extended human playtesting, especially on Normal.
- **Art and audio are procedural placeholders.** Characters are 16×24 parametric pixel sprites with two walk frames. Historical figures are simple caricatures, not likenesses. Music is a small generated chiptune loop per era.
- **The UI scaling setting** scales DOM text and panels, not the game world.
- **Run state is checkpointed per sub-level.** Leaving mid-sub-level loses the Time Shards and pickups gathered since the checkpoint. Artifacts and allies are saved instantly.
- **Allies can't be hurt**, so the spec's health/respawn mechanic for companions isn't needed and isn't implemented.
- **Cosmetic rewards from hidden rooms** are limited to unique dialogue.
- `window.__ATC` is always present. It is a single-player testing hook, so it can be used to cheat from the browser console.
