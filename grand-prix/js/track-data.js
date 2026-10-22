/* =====================================================================
   TRACK DATA: everything that makes each circuit itself.
   Geometry comes from track-geometry.js (real centrelines in metres).
   Positions along the lap are given as a fraction of the lap (0 = start line).
   Widths are set so three cars fit side by side (room to overtake), wider than the real circuits.
   To add a circuit: add its centreline to TRACK_GEOMETRY and an entry here.
   ===================================================================== */
window.F1 = window.F1 || {};

F1.TRACKS = {
  monza: {
    id: 'monza', name: 'Monza', fullName: 'Autodromo Nazionale Monza', country: 'Italy',
    realLength: 5793, raceType: 'Sprint', difficulty: 'Fast', difficultyLevel: 1,
    feel: ['Fast', 'Open', 'Straight', 'High speed'],
    realLapRecord: '1:21',
    width: 18, runoff: 12, runoffSurface: 'gravel', wall: 'tyres',
    pitSide: 1,
    midPit: { at: 0.56, side: 1 },   // the half-way pit stop (garages centred at this share of the lap)
    theme: { ground: '#78B84F', groundDark: '#6AA845', runoff: '#E3C98E', asphalt: '#4C5560', asphaltHi: '#56606B', line: '#F4F4F4', accent: '#2EA44F', props: 'park' },
    corners: [
      [0.108, 'Variante del Rettifilo'], [0.21, 'Curva Grande'], [0.32, 'Variante della Roggia'],
      [0.395, 'Lesmo 1'], [0.444, 'Lesmo 2'], [0.52, 'Serraglio'], [0.645, 'Variante Ascari'],
      [0.85, 'Curva Parabolica'],
    ],
    elevation: [[0, 162], [0.3, 166], [0.45, 168], [0.65, 163], [0.85, 160], [1, 162]],
    itemRows: [0.045, 0.25, 0.53, 0.74],
    grandstands: [0.97, 0.02, 0.1, 0.84, 0.88],
  },

  monaco: {
    id: 'monaco', name: 'Monaco', fullName: 'Circuit de Monaco', country: 'Monaco',
    realLength: 3337, raceType: 'Grand Prix', difficulty: 'Technical', difficultyLevel: 2,
    feel: ['Tight', 'Technical', 'Narrow', 'Dangerous'],
    realLapRecord: '1:12',
    width: 15, runoff: 1.5, runoffSurface: 'kerb', wall: 'armco',
    scale: 1.6,
    pitSide: -1,                   // pit lane on the left of the start straight                    // the real streets are too tight for three cars side by side, so the whole layout is drawn 1.6x larger
    theme: { ground: '#B9B4AA', groundDark: '#A9A398', runoff: '#8E959C', asphalt: '#454C55', asphaltHi: '#4E5660', line: '#F4F4F4', accent: '#D9302C', props: 'city' },
    corners: [
      [0.059, 'Sainte Dévote'], [0.15, 'Beau Rivage'], [0.246, 'Massenet'], [0.267, 'Casino'],
      [0.334, 'Mirabeau Haute'], [0.375, 'Grand Hotel Hairpin'], [0.40, 'Mirabeau Bas'], [0.428, 'Portier'],
      [0.5, 'Tunnel'], [0.628, 'Nouvelle Chicane'], [0.71, 'Tabac'], [0.763, 'Swimming Pool'],
      [0.875, 'La Rascasse'], [0.901, 'Anthony Noghes'],
    ],
    elevation: [[0, 7], [0.06, 8], [0.15, 26], [0.246, 40], [0.267, 44], [0.334, 38], [0.375, 28], [0.43, 12], [0.56, 9], [0.63, 6], [0.9, 5], [1, 7]],
    tunnels: [[0.452, 0.56]],
    itemRows: [0.13, 0.585, 0.82],
    grandstands: [0.97, 0.03, 0.7, 0.86],
  },

  spa: {
    id: 'spa', name: 'Spa-Francorchamps', fullName: 'Circuit de Spa-Francorchamps', country: 'Belgium',
    realLength: 7004, raceType: 'Endurance', difficulty: 'Hard', difficultyLevel: 3,
    feel: ['Long', 'Fast', 'Varied', 'Technical'],
    realLapRecord: '1:46',
    width: 17, runoff: 10, runoffSurface: 'grass', wall: 'tyres',
    pitSide: 1,
    midPit: { at: 0.26, side: -1 },   // the half-way pit stop (garages centred at this share of the lap)
    theme: { ground: '#4E8F43', groundDark: '#427E39', runoff: '#6FA75A', asphalt: '#4A535C', asphaltHi: '#5E6873', line: '#F4F4F4', accent: '#F2B800', props: 'forest' },
    corners: [
      [0.035, 'La Source'], [0.13, 'Eau Rouge'], [0.147, 'Raidillon'], [0.24, 'Kemmel Straight'],
      [0.33, 'Les Combes'], [0.359, 'Malmedy'], [0.422, 'Bruxelles'], [0.45, 'No Name'],
      [0.535, 'Pouhon'], [0.636, 'Fagnes'], [0.70, 'Stavelot'], [0.78, 'Courbe Paul Frère'],
      [0.866, 'Blanchimont'], [0.948, 'Bus Stop Chicane'],
    ],
    // approximate height above sea level (m): Eau Rouge dips, Raidillon climbs to Les Combes, the lap falls to Stavelot and climbs back
    elevation: [[0, 400], [0.035, 396], [0.13, 374], [0.15, 402], [0.24, 445], [0.326, 470], [0.36, 462], [0.42, 440], [0.45, 432],
                [0.53, 405], [0.62, 390], [0.66, 381], [0.70, 373], [0.72, 373], [0.80, 381], [0.866, 392], [0.948, 399], [1, 400]],
    itemRows: [0.22, 0.48, 0.6, 0.8],
    grandstands: [0.98, 0.03, 0.125, 0.94],
  },
  vegas: {
    id: 'vegas', name: 'Las Vegas', fullName: 'Las Vegas Strip Circuit', country: 'USA',
    realLength: 6201, raceType: 'Night race', difficulty: 'Fast', difficultyLevel: 2,
    feel: ['Night', 'Neon', 'Long straights', 'Street circuit'],
    realLapRecord: '1:35',
    width: 16, runoff: 2, runoffSurface: 'kerb', wall: 'armco',
    pitSide: 1,
    midPit: { at: 0.63, side: 1 },   // the half-way pit stop (garages centred at this share of the lap)
    theme: { ground: '#3A3F4A', groundDark: '#30343D', runoff: '#5A606B', asphalt: '#3C424C', asphaltHi: '#454C57', line: '#F4F4F4', accent: '#FF3EA5', props: 'vegas', night: true },
    corners: [[0.06, 'Turn 1'], [0.16, 'Koval Straight'], [0.33, 'Sphere Corner'], [0.42, 'Harmon Zone'], [0.55, 'Strip Straight'], [0.86, 'Harmon Chicane']],
    elevation: [[0, 610], [1, 610]],
    itemRows: [0.2, 0.6, 0.8],
    grandstands: [0.97, 0.02, 0.3, 0.7],
  },
};
// Monaco stays defined (with its tunnel and city) for use elsewhere, but is not in this game's rotation.
F1.TRACK_ORDER = ['vegas'];   // Monza and Spa retired 17 October 2026 (see retired/README.md); their data stays above
