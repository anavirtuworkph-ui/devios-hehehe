// DeVios components scattered by the malfunction. Each main-era boss guards one.
// Repairs never cost Time Shards.
export const COMPONENTS = [
  { id: 'flux_regulator', name: 'Temporal Flux Regulator', era: 'precolonial', desc: 'Keeps the flux-style reactor from melting the trunk.' },
  { id: 'nav_gyro', name: 'Chrono-Navigation Gyro', era: 'spanish', desc: 'The part that was supposed to stop all of this from happening.' },
  { id: 'circuit_board', name: 'Time Circuit Board', era: 'american', desc: 'Drives the DESTINATION / PRESENT / LAST DEPARTED displays.' },
  { id: 'arc_coils', name: 'Arc Coil Assembly', era: 'japanese', desc: 'Rear-mounted coils that throw the blue-white lightning.' },
  { id: 'power_cell', name: 'Sedan-Spec Power Cell', era: 'marcos', desc: 'Final 1.21-ish gigawatt cell, custom-fit under the Vios rear seat.' },
];
export const COMPONENT_BY_ERA = Object.fromEntries(COMPONENTS.map((c) => [c.era, c]));
