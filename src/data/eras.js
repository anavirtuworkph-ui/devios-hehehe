// Era configuration: visuals, sub-levels, bosses, recruit events and flavour text.
// Time labels feed the DeVios time-circuit displays.
export const ERAS = {
  lab: {
    id: 'lab', name: '205X — Anon’s Laboratory', short: '205X', year: '205X', date: 'OCT 26 205X',
    palette: { floor: ['#2a3140', '#2e3646', '#262c3a'], wall: '#4a5568', wallTop: '#6b7a90', accent: '#47e0ff', bg: '#0d1018' },
    props: ['console', 'crate_tech', 'tank'], shard: 'lab', music: 'lab',
  },
  precolonial: {
    id: 'precolonial', name: 'Pre-Colonial Philippines', short: 'Pre-Colonial', year: '1521', date: 'APR 27 1521',
    subs: ['Coastal Settlement', 'Forest & Village Defenses', 'Shores of Mactan (Boss)'],
    boss: ['magellan'],
    palette: { floor: ['#5f8a3a', '#6a9440', '#55803a'], wall: '#6b4a2a', wallTop: '#8b6a3a', accent: '#ffd36b', bg: '#14240f', sand: '#d9c48a' },
    props: ['palm', 'nipa', 'bamboo', 'rock'], shard: 'gold', music: 'precolonial',
    merchant: { name: 'Mang Gintong, the Gold Trader', look: { skin: '#a8693f', hair: '#222', hairStyle: 'long', top: '#d4a017', top2: '#7a2a1a', bottom: '#3b2a1a', hat: 'headband', hatColor: '#d4a017' } },
    recruits: [{ ally: 'lapulapu', sub: 0, room: 1 }],
    guaranteed: [{ weapon: 'poison_spear', sub: 0, room: 0 }, { weapon: 'kris', sub: 1, room: 0 }],
    notes: [
      'Long before 1521, island communities across the archipelago traded with China, Borneo and beyond. Gold work was common.',
      'Barangays were led by datus. Many settlements were coastal, built from bamboo, wood and nipa palm.',
      'On 27 April 1521, Lapu-Lapu’s forces defeated Magellan’s landing party at the Battle of Mactan.',
    ],
  },
  spanish: {
    id: 'spanish', name: 'Spanish Colonial Era', short: 'Spanish Era', year: '1887', date: 'MAR 21 1887',
    subs: ['Colonial Streets', 'Fortified District & Library', 'The Pulpit (Boss)'],
    boss: ['damaso'],
    palette: { floor: ['#9a8a74', '#a39380', '#8f806b'], wall: '#7a6a5a', wallTop: '#b8a48a', accent: '#c8a0ff', bg: '#1d1a16' },
    props: ['pillar', 'bookshelf', 'barrel', 'cart'], shard: 'coin', music: 'spanish',
    merchant: { name: 'Doña Tindera of the Plaza', look: { skin: '#d8a676', hair: '#222', hairStyle: 'bun', top: '#8a2a4a', top2: '#f0e0c0', bottom: '#2a2a3a' } },
    recruits: [{ ally: 'rizal', sub: 0, room: 1 }, { ally: 'bonifacio', sub: 1, room: 0 }],
    special: [{ kind: 'easel', ally: 'ibarra', needs: 'rizal_quill', sub: 1, room: 1 }],
    guaranteed: [{ weapon: 'rizal_quill', sub: 0, room: 0 }, { weapon: 'bolo', sub: 0, room: 1 }],
    notes: [
      'Jose Rizal published Noli Me Tangere in Berlin in 1887, and El Filibusterismo in 1891.',
      'Crisostomo Ibarra and Padre Dámaso are fictional characters from Noli Me Tangere.',
      'Andres Bonifacio co-founded the Katipunan in 1892. Rizal was executed in 1896; his farewell poem became known as Mi Último Adiós.',
    ],
  },
  american: {
    id: 'american', name: 'American Colonial Era', short: 'American Era', year: '1903', date: 'JUL 04 1903',
    subs: ['Town Outskirts', 'Military Encampment', 'The Executive Lawn (Boss)'],
    boss: ['mckinley'],
    palette: { floor: ['#8a7a52', '#94845a', '#7f704a'], wall: '#5a5a4a', wallTop: '#8a8a6a', accent: '#ffa040', bg: '#1a1a12' },
    props: ['sandbag', 'tent', 'crate', 'barrel'], shard: 'brass', music: 'american',
    merchant: { name: 'Uncle Sammy’s Travelling Peddler', look: { skin: '#e7c3a0', hair: '#aaa', hairStyle: 'short', top: '#3a4a7a', top2: '#c02020', bottom: '#e0e0e0', hat: 'tophat', hatColor: '#3a4a7a' } },
    recruits: [{ ally: 'macarthur_sr', sub: 0, room: 1 }, { ally: 'macarthur_jr', sub: 1, room: 1 }],
    guaranteed: [{ weapon: 'colt_saa', sub: 0, room: 0 }, { weapon: 'howitzer', sub: 1, room: 0 }],
    notes: [
      'After the 1898 Treaty of Paris, the United States took control of the Philippines; the Philippine-American War followed.',
      'The 1903 currency reform introduced a new silver peso, nicknamed the "Conant" after economist Charles Conant.',
      'President McKinley described US policy as "benevolent assimilation" in an 1898 proclamation.',
    ],
  },
  japanese: {
    id: 'japanese', name: 'Japanese Occupation Era', short: 'Occupation Era', year: '1943', date: 'OCT 14 1943',
    subs: ['Occupied Town', 'Resistance Hideout & Battlefield', 'The Garrison Courtyard (Boss)'],
    boss: ['saitoh'],
    restrained: true,
    palette: { floor: ['#5a5650', '#625e57', '#534f49'], wall: '#3e3a36', wallTop: '#6a645c', accent: '#d05050', bg: '#121110' },
    props: ['ruin', 'sandbag', 'crate', 'barrel'], shard: 'crystal', music: 'japanese',
    merchant: { name: 'Lola Remedios (black-market sari-sari)', look: { skin: '#b97c4f', hair: '#bbb', hairStyle: 'bun', top: '#6a5a4a', top2: '#d8d0c0', bottom: '#3a3a3a' } },
    recruits: [{ ally: 'hiroshi', sub: 1, room: 0 }],
    guaranteed: [{ weapon: 'nambu', sub: 0, room: 0 }, { weapon: 'katana', sub: 1, room: 1 }],
    notes: [
      'The Japanese occupation (1942–1945) brought severe hardship; many civilians suffered and many joined guerrilla resistance groups.',
      'Occupation pesos were printed in such quantities that people nicknamed them "Mickey Mouse money".',
      'Pulang Araw (2024) is a GMA drama; Colonel Yuta Saitoh and Hiroshi Tanaka are fictional characters from it.',
    ],
  },
  marcos: {
    id: 'marcos', name: 'Marcos Era, 1985', short: '1985', year: '1985', date: 'NOV 03 1985',
    subs: ['City Streets', 'Checkpoints & Government District', 'The Palace Ballroom (Boss)'],
    boss: ['marcos'],
    palette: { floor: ['#4a4a52', '#52525a', '#44444c'], wall: '#5a3a3a', wallTop: '#8a5a5a', accent: '#ffd400', bg: '#150f12' },
    props: ['barrier', 'car', 'crate', 'sign'], shard: 'retro', music: 'marcos',
    merchant: { name: 'Kuya Boy’s Sari-Sari Store', look: { skin: '#c99a70', hair: '#111', hairStyle: 'short', top: '#f0f0f0', top2: '#2a6ac0', bottom: '#2a2a3a', hat: 'cap', hatColor: '#2a6ac0' } },
    recruits: [{ ally: 'ninoy', sub: 0, room: 1 }],
    guaranteed: [{ weapon: 'm1911', sub: 0, room: 0 }, { weapon: 'bongbong_rl', sub: 1, room: 0 }],
    notes: [
      'Martial law was declared in 1972 and formally lifted in 1981, though many powers remained.',
      'Ninoy Aquino was assassinated in 1983. In this game he appears only in an explicitly alternate, fictional timeline.',
      'A snap election was called for early 1986; the People Power Revolution followed that February.',
    ],
  },
  modern: {
    id: 'modern', name: 'Secret Era — 202X', short: '202X', year: '202X', date: 'MAY 09 202X',
    subs: ['Modern Urban District', 'High-Tech Combat Zone', 'Final Arena (Boss)'],
    boss: ['bbm', 'duterte'],
    secret: true,
    palette: { floor: ['#2e2e3a', '#353542', '#292934'], wall: '#3a3a5a', wallTop: '#5a5a8a', accent: '#ff4fd8', bg: '#0c0c16' },
    props: ['server', 'billboard', 'car', 'barrier'], shard: 'digital', music: 'modern',
    merchant: { name: 'ShopeeBot 3000 (online seller)', look: { robot: true, top: '#ff7a30', top2: '#ffffff' } },
    recruits: [],
    guaranteed: [{ weapon: 'beretta', sub: 0, room: 0 }, { weapon: 'barrett', sub: 1, room: 0 }],
    notes: [
      'This era is a satirical, fictional 202X. Nothing here depicts real events.',
      'The timeline is visibly unstable: billboards glitch and the sky flickers between years.',
    ],
  },
};

export const MAIN_ERAS = ['precolonial', 'spanish', 'american', 'japanese', 'marcos'];
export const SECRET_ERA = 'modern';
export const ALL_STAGE_ERAS = [...MAIN_ERAS, SECRET_ERA];
