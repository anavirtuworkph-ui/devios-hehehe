// The five historical artifacts. Collecting all five opens the secret 202X destination.
export const ARTIFACTS = [
  {
    id: 'gold_bracelet',
    name: 'Gold Bracelet',
    era: 'precolonial',
    desc: 'A finely worked gold bracelet, echoing the goldsmithing traditions of the islands long before 1521.',
    clue: 'Locals whisper that a glinting vault lies beyond the village defenses.',
  },
  {
    id: 'noli_original',
    name: 'Original Copy of Noli Me Tangere',
    era: 'spanish',
    desc: 'An early printed copy of Rizal’s 1887 novel. (Not the weapon — this one is for reading.)',
    clue: 'A sealed reading room is said to hide behind the fortified library.',
  },
  {
    id: 'conant_coin',
    name: 'Conant Coin',
    era: 'american',
    desc: 'A silver peso of the Philippine currency reform named after economist Charles Conant.',
    clue: 'The encampment paymaster keeps a strongbox somewhere past the barracks.',
  },
  {
    id: 'mickey_money',
    name: 'Mickey Mouse Money',
    era: 'japanese',
    desc: 'Occupation-era fiat notes, nicknamed for how little they could buy as inflation soared.',
    clue: 'Resistance fighters stash supplies in a hidden cache near the battlefield.',
  },
  {
    id: 'rolex_12',
    name: 'Rolex 12 Watch',
    era: 'marcos',
    desc: 'A luxury wristwatch — a satirical nod to the "Rolex 12" nickname. Very shiny. Suspiciously so.',
    clue: 'An extravagant vault sits somewhere in the government district.',
  },
];

export const ARTIFACT_BY_ID = Object.fromEntries(ARTIFACTS.map((a) => [a.id, a]));
export const ARTIFACT_BY_ERA = Object.fromEntries(ARTIFACTS.map((a) => [a.era, a]));
