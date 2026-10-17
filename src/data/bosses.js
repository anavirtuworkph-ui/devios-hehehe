// Boss definitions. All bosses are fictionalized arcade interpretations in an
// alternate-history comedy; their dialogue is invented and is not a factual claim.
//
// Pattern types (implemented in entities/Boss.js):
//  radial {count, speed}           ring of bullets
//  spiral {arms, duration, rate}   rotating bullet stream
//  aimed  {count, interval, speed} burst of shots at Anon
//  spread {count, arc, speed}      fan of shots at Anon
//  charge {speed, damage}          telegraphed dash
//  slam   {radius, damage, ring}   telegraphed ground pound around the boss
//  rain   {count, radius, damage}  telegraphed blasts around Anon
//  sweep  {radius, arc, damage}    telegraphed melee cone
//  lines  {count, damage}          telegraphed line strikes
//  summon {count, type}            calls era minions (capped)
//  blink  {}                       teleports to a safe spot
export const BOSSES = {
  magellan: {
    id: 'magellan', name: 'Ferdinand Magellan', title: 'Captain of the Phantom Armada', era: 'precolonial',
    hp: 900, speed: 55, scale: 2, bulletColor: 0xffd36b,
    look: { skin: '#d9b48f', hair: '#4a2a1a', hairStyle: 'short', top: '#b8b8c8', top2: '#8a1a1a', bottom: '#3a2a4a', shoes: '#2a1a0a', hat: 'morion', hatColor: '#d0d0d8', acc: ['beard', 'cape'], cape: '#8a1a1a', build: 'wide' },
    intro: ['Magellan: By order of the phantom armada, these shores are—', 'Anon: Sir, I checked. This does not end well for you.', 'Magellan: SILENCE! En garde!'],
    defeat: ['Magellan: Mactan… again?!', 'Lapu-Lapu: Some things history gets right.'],
    phases: [
      { until: 0.55, cooldown: 1300, patterns: [
        { name: 'Cutlass Sweep', type: 'sweep', radius: 52, arc: 150, damage: 4 },
        { name: 'Boarding Charge', type: 'charge', speed: 260, damage: 4 },
        { name: 'Cannon Volley', type: 'radial', count: 12, speed: 110 },
      ] },
      { until: 0, cooldown: 1050, patterns: [
        { name: 'Cutlass Sweep', type: 'sweep', radius: 58, arc: 170, damage: 4 },
        { name: 'Boarding Charge', type: 'charge', speed: 300, damage: 4 },
        { name: 'Broadside', type: 'spread', count: 7, arc: 70, speed: 140 },
        { name: 'Call the Crew', type: 'summon', count: 2, type2: 'grunt' },
      ] },
    ],
  },
  damaso: {
    id: 'damaso', name: 'Padre Dámaso', title: 'Fictional Friar of San Diego', era: 'spanish',
    hp: 1100, speed: 40, scale: 2, bulletColor: 0xc8a0ff,
    look: { skin: '#e8b89a', hair: '#7a6a5a', hairStyle: 'tonsure', top: '#6b4a2a', top2: '#c8a060', bottom: '#6b4a2a', shoes: '#3a2a1a', hat: null, acc: ['rosary'], build: 'wide' },
    intro: ['Padre Dámaso: A visitor, at MY sermon? Sit down, indio!', 'Anon: You’re literally a fictional villain from a novel.', 'Padre Dámaso: Then I shall be your fictional DOOM!'],
    defeat: ['Padre Dámaso: My… my sermon isn’t finished…', 'Anon: Rizal already wrote your ending. I just footnoted it.'],
    phases: [
      { until: 0.6, cooldown: 1400, patterns: [
        { name: 'Sermon Shockwave', type: 'slam', radius: 70, damage: 4, ring: 10 },
        { name: 'Rosary Spiral', type: 'spiral', arms: 3, duration: 1800, rate: 140, speed: 100 },
        { name: 'Censure Burst', type: 'aimed', count: 4, interval: 180, speed: 150 },
      ] },
      { until: 0, cooldown: 1150, patterns: [
        { name: 'Sermon Shockwave', type: 'slam', radius: 80, damage: 4, ring: 14 },
        { name: 'Rosary Spiral', type: 'spiral', arms: 4, duration: 2200, rate: 120, speed: 110 },
        { name: 'Excommunication Lines', type: 'lines', count: 3, damage: 4 },
        { name: 'Summon Sacristans', type: 'summon', count: 2, type2: 'runner' },
      ] },
    ],
  },
  mckinley: {
    id: 'mckinley', name: 'President William McKinley', title: 'Architect of "Benevolent Assimilation"', era: 'american',
    hp: 1300, speed: 45, scale: 2, bulletColor: 0xffa040,
    look: { skin: '#e7c3a0', hair: '#8a8a8a', hairStyle: 'receding', top: '#1d1d24', top2: '#ffffff', bottom: '#1d1d24', shoes: '#111', hat: null, acc: ['bowtie', 'carnation'] },
    intro: ['McKinley: I prayed on it, and the answer was… YOU must be assimilated!', 'Anon: Hard pass, Mr. President.', 'McKinley: Then it will be done by artillery!'],
    defeat: ['McKinley: This is… most un-benevolent!', 'Anon: History has notes, sir.'],
    phases: [
      { until: 0.5, cooldown: 1350, patterns: [
        { name: 'Artillery Barrage', type: 'rain', count: 5, radius: 34, damage: 4 },
        { name: 'Tariff Spread', type: 'spread', count: 5, arc: 60, speed: 150 },
        { name: 'Manifest Destiny Charge', type: 'charge', speed: 260, damage: 4 },
      ] },
      { until: 0, cooldown: 1100, patterns: [
        { name: 'Artillery Barrage', type: 'rain', count: 7, radius: 36, damage: 4 },
        { name: 'Tariff Spread', type: 'spread', count: 7, arc: 80, speed: 160 },
        { name: 'Gold Standard Ring', type: 'radial', count: 16, speed: 110 },
        { name: 'Reinforcements', type: 'summon', count: 2, type2: 'shooter' },
      ] },
    ],
  },
  saitoh: {
    id: 'saitoh', name: 'Colonel Yuta Saitoh', title: 'Fictionalized commander (inspired by GMA’s Pulang Araw)', era: 'japanese',
    hp: 1500, speed: 70, scale: 2, bulletColor: 0xff5050,
    look: { skin: '#e8c9a4', hair: '#101010', hairStyle: 'slick', top: '#5b5b3a', top2: '#c8a040', bottom: '#5b5b3a', shoes: '#1a1a1a', hat: 'officer', hatColor: '#4b4b2a', acc: ['katana', 'gloves'] },
    intro: ['Saitoh: You do not belong in this time.', 'Anon: Neither do you, technically. You’re a TV interpretation.', 'Saitoh: Then let this be our final scene.'],
    defeat: ['Saitoh: …So this is how the story turns.', 'Hiroshi: It is over. Let the town breathe again.'],
    phases: [
      { until: 0.66, cooldown: 1300, patterns: [
        { name: 'Iaido Dash', type: 'charge', speed: 340, damage: 5 },
        { name: 'Rifle Volley', type: 'aimed', count: 5, interval: 160, speed: 180 },
        { name: 'Katana Arc', type: 'sweep', radius: 56, arc: 160, damage: 5 },
      ] },
      { until: 0.33, cooldown: 1100, patterns: [
        { name: 'Iaido Dash', type: 'charge', speed: 380, damage: 5 },
        { name: 'Grenade Rain', type: 'rain', count: 6, radius: 32, damage: 4 },
        { name: 'Shadow Step', type: 'blink' },
        { name: 'Katana Arc', type: 'sweep', radius: 60, arc: 180, damage: 5 },
      ] },
      { until: 0, cooldown: 950, patterns: [
        { name: 'Crimson Sun Spiral', type: 'spiral', arms: 4, duration: 2200, rate: 110, speed: 120 },
        { name: 'Iaido Dash', type: 'charge', speed: 400, damage: 5 },
        { name: 'Grenade Rain', type: 'rain', count: 7, radius: 34, damage: 4 },
        { name: 'Patrol Call', type: 'summon', count: 2, type2: 'grunt' },
      ] },
    ],
  },
  marcos: {
    id: 'marcos', name: 'Ferdinand Marcos Sr.', title: 'Satirical alternate-history strongman, 1985', era: 'marcos',
    hp: 1800, speed: 45, scale: 2, bulletColor: 0xffd400,
    look: { skin: '#d9ad80', hair: '#111', hairStyle: 'slick', top: '#f2ecd8', top2: '#d4b040', bottom: '#2a2a2a', shoes: '#111', hat: null, acc: ['medals', 'sunglasses'] },
    intro: ['Marcos Sr.: Welcome to 1985! Everything here is perfectly normal and legal.', 'Anon: Your vault literally says "ILL-GOTTEN" on it.', 'Marcos Sr.: …Decree number 2,000-something: YOU are under arrest!'],
    defeat: ['Marcos Sr.: This… this snap election was not in the plan!', 'Ninoy: The people were never yours to keep.'],
    phases: [
      { until: 0.6, cooldown: 1300, patterns: [
        { name: 'Decree Barrage', type: 'spiral', arms: 2, duration: 2000, rate: 120, speed: 110 },
        { name: 'Gold Rain', type: 'rain', count: 6, radius: 32, damage: 4 },
        { name: 'Martial Lines', type: 'lines', count: 3, damage: 4 },
      ] },
      { until: 0.3, cooldown: 1100, patterns: [
        { name: 'Decree Barrage', type: 'spiral', arms: 3, duration: 2200, rate: 110, speed: 120 },
        { name: 'Crony Summons', type: 'summon', count: 3, type2: 'grunt' },
        { name: 'Shoe Closet Ring', type: 'radial', count: 18, speed: 120 },
        { name: 'Martial Lines', type: 'lines', count: 4, damage: 4 },
      ] },
      { until: 0, cooldown: 950, patterns: [
        { name: 'Gold Rain', type: 'rain', count: 8, radius: 34, damage: 4 },
        { name: 'Snap Charge', type: 'charge', speed: 300, damage: 5 },
        { name: 'Decree Barrage', type: 'spiral', arms: 4, duration: 2200, rate: 110, speed: 120 },
        { name: 'Helicopter Escape Blink', type: 'blink' },
      ] },
    ],
  },
  // Secret 202X duo. They share a "conductor" so their big attacks alternate.
  bbm: {
    id: 'bbm', name: 'BBM', title: 'Satirical 202X boss (fictional)', era: 'modern',
    hp: 1300, speed: 50, scale: 2, bulletColor: 0xff4fd8,
    look: { skin: '#d9ad80', hair: '#151515', hairStyle: 'slick', top: '#c8202a', top2: '#ffffff', bottom: '#2a2a3a', shoes: '#111', hat: null, acc: ['sunglasses'] },
    intro: ['BBM: Unity! Unity! Have you tried unity?', 'Anon: I’ve tried time travel. It’s going badly.'],
    defeat: ['BBM: My 20-peso rice… it was… conceptual…'],
    phases: [
      { until: 0.5, cooldown: 1500, patterns: [
        { name: 'Unity Spiral', type: 'spiral', arms: 2, duration: 1800, rate: 140, speed: 100 },
        { name: '20-Peso Rice Spread', type: 'spread', count: 7, arc: 70, speed: 140 },
        { name: 'Vlog Teleport', type: 'blink' },
      ] },
      { until: 0, cooldown: 1250, patterns: [
        { name: 'Unity Spiral', type: 'spiral', arms: 3, duration: 2000, rate: 120, speed: 110 },
        { name: '20-Peso Rice Spread', type: 'spread', count: 9, arc: 90, speed: 150 },
        { name: 'Trolls Assemble', type: 'summon', count: 2, type2: 'grunt' },
      ] },
    ],
  },
  duterte: {
    id: 'duterte', name: 'Duterte', title: 'Satirical 202X boss (fictional)', era: 'modern',
    hp: 1300, speed: 60, scale: 2, bulletColor: 0xff7a30,
    look: { skin: '#c99a70', hair: '#9a9a9a', hairStyle: 'receding', top: '#e8e2d0', top2: '#b02020', bottom: '#2a2a2a', shoes: '#111', hat: null, acc: ['fist'] },
    intro: ['Duterte: You! Time traveller! Ah… I will—', 'Anon: Please finish that sentence in a family-friendly way.'],
    defeat: ['Duterte: Ah, sige. Enough. I’m going home to Davao.'],
    phases: [
      { until: 0.5, cooldown: 1400, patterns: [
        { name: 'Iron Fist Slam', type: 'slam', radius: 72, damage: 5, ring: 10 },
        { name: 'Hotline Barrage', type: 'aimed', count: 6, interval: 140, speed: 170 },
        { name: 'Big Bike Charge', type: 'charge', speed: 300, damage: 5 },
      ] },
      { until: 0, cooldown: 1150, patterns: [
        { name: 'Iron Fist Slam', type: 'slam', radius: 82, damage: 5, ring: 14 },
        { name: 'Hotline Barrage', type: 'aimed', count: 8, interval: 120, speed: 180 },
        { name: 'Curfew Lines', type: 'lines', count: 3, damage: 4 },
        { name: 'Big Bike Charge', type: 'charge', speed: 330, damage: 5 },
      ] },
    ],
  },
};
