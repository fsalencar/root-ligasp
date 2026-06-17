// Dados do jogo: facções, expansões, mapas, naipes

const FACTIONS = {
  marquise:   { name: 'Marqueses',               reach: 10, type: 'militant',  exp: 'base',       accent: 'marquise' },
  eyrie:      { name: 'Dinastia das Rapinas',    reach: 7,  type: 'militant',  exp: 'base',       accent: 'eyrie' },
  alliance:   { name: 'Aliança da Floresta',     reach: 3,  type: 'insurgent', exp: 'base',       accent: 'alliance' },
  vagabond:   { name: 'Malandro',                reach: 5,  type: 'insurgent', exp: 'base',       accent: 'vagabond' },
  lizard:     { name: 'Lagartos Cultistas',      reach: 2,  type: 'insurgent', exp: 'riverfolk',  accent: 'lizard' },
  riverfolk:  { name: 'Compania Ribeirinha',     reach: 5,  type: 'insurgent', exp: 'riverfolk',  accent: 'riverfolk' },
  duchy:      { name: 'Ducado Subterrâneo',      reach: 8,  type: 'militant',  exp: 'underworld', accent: 'duchy' },
  corvid:     { name: 'Conspiração Corvídea',    reach: 3,  type: 'insurgent', exp: 'underworld', accent: 'corvid' },
  hundreds:   { name: 'Senhor das Centenas',     reach: 9,  type: 'militant',  exp: 'marauder',   accent: 'hundreds' },
  keepers:    { name: 'Guardiões de Ferro',      reach: 8,  type: 'militant',  exp: 'marauder',   accent: 'keepers' },
  diaspora:   { name: 'Diáspora dos Nenúfares', reach: 7,  type: 'militant',  exp: 'homeland',   accent: 'diaspora' },
  council:    { name: 'Conselho do Crepúsculo',  reach: 4,  type: 'insurgent', exp: 'homeland',   accent: 'council' },
  knaves:     { name: 'Patifes da Floresta',     reach: 4,  type: 'insurgent', exp: 'homeland',   accent: 'knaves' },
  vagabond2:  { name: 'Malandro 2',              reach: 2,  type: 'insurgent', exp: 'riverfolk',  accent: 'vagabond' },
};

const EXPANSIONS = [
  { id: 'base',       name: 'Root — Jogo Base',        facs: ['marquise','eyrie','alliance','vagabond'],  desc: 'Marqueses, Dinastia das Rapinas, Aliança da Floresta, Malandro' },
  { id: 'riverfolk',  name: 'Expansão Ribeirinhos',     facs: ['riverfolk','lizard'],                      desc: 'Compania Ribeirinha, Lagartos Cultistas', hasV2: true },
  { id: 'underworld', name: 'Expansão Submundo',        facs: ['duchy','corvid'],                          desc: 'Ducado Subterrâneo, Conspiração Corvídea' },
  { id: 'marauder',   name: 'Expansão Saqueadores',     facs: ['hundreds','keepers'],                      desc: 'Senhor das Centenas, Guardiões de Ferro' },
  { id: 'homeland',   name: 'Expansão Pátria',          facs: ['diaspora','council','knaves'],             desc: 'Diáspora dos Nenúfares, Conselho do Crepúsculo, Patifes' },
];

// =====================================================================
// DADOS REAIS DOS MAPAS
// Posições SVG: [x,y] dentro de um viewBox 500x500
// suits: naipe padrão de cada clareira (F=Raposa/Vermelho, R=Rato/Laranja, C=Coelho/Amarelo)
// corners: índices das clareiras de canto
// connections: pares de índices conectados por caminho
// =====================================================================

const MAPS = [
  {
    id: 'autumn', name: 'Outono', icon: '🍂', desc: 'Mapa padrão simétrico',
    img: 'outono', viewBox: '0 0 758 696',
    suits: ['C','R','C','F','R','R','R','F','F','R','C','C'],
    clearings: [
      {n:1,  x:90,  y:90,  r:52},
      {n:2,  x:415, y:60,  r:52},
      {n:3,  x:660, y:150, r:52},
      {n:4,  x:320, y:200, r:52},
      {n:5,  x:80,  y:280, r:52},
      {n:6,  x:240, y:380, r:52},
      {n:7,  x:475, y:335, r:60},
      {n:8,  x:690, y:360, r:52},
      {n:9,  x:85,  y:570, r:52},
      {n:10, x:275, y:620, r:52},
      {n:11, x:435, y:540, r:52},
      {n:12, x:635, y:600, r:52},
    ],
  },
  {
    id: 'winter', name: 'Inverno', icon: '❄️', desc: 'Mapa assimétrico com rio central',
    img: 'inverno', viewBox: '0 0 950 871',
    suits: ['C','R','C','R','C','F','R','C','F','R','F','F'],
    clearings: [
      {n:1,  x:125, y:111, r:65},
      {n:2,  x:356, y:147, r:65},
      {n:3,  x:563, y:198, r:65},
      {n:4,  x:830, y:209, r:65},
      {n:5,  x:128, y:369, r:65},
      {n:6,  x:352, y:432, r:65},
      {n:7,  x:584, y:408, r:65},
      {n:8,  x:854, y:508, r:65},
      {n:9,  x:558, y:631, r:65},
      {n:10, x:132, y:691, r:65},
      {n:11, x:356, y:751, r:65},
      {n:12, x:801, y:750, r:65},
    ],
  },
  {
    id: 'lake', name: 'Lago', icon: '🌊', desc: 'Grande lago central com docas',
    img: 'lago', viewBox: '0 0 950 869',
    suits: ['R','C','F','R','C','C','F','R','F','R','C','F'],
    clearings: [
      {n:1,  x:137, y:157, r:65},
      {n:2,  x:421, y:98,  r:65},
      {n:3,  x:656, y:186, r:65},
      {n:4,  x:860, y:284, r:65},
      {n:5,  x:95,  y:415, r:65},
      {n:6,  x:296, y:299, r:65},
      {n:7,  x:624, y:418, r:65},
      {n:8,  x:839, y:504, r:65},
      {n:9,  x:325, y:590, r:65},
      {n:10, x:108, y:700, r:65},
      {n:11, x:422, y:768, r:65},
      {n:12, x:807, y:742, r:65},
    ],
  },
  {
    id: 'mountain', name: 'Montanha', icon: '⛰️', desc: 'Passagens de montanha com torre central',
    img: 'montanha', viewBox: '0 0 950 874',
    suits: ['F','R','C','C','R','F','F','C','R','R','C','F'],
    clearings: [
      {n:1,  x:107, y:137, r:65},
      {n:2,  x:275, y:296, r:65},
      {n:3,  x:510, y:138, r:65},
      {n:4,  x:789, y:188, r:65},
      {n:5,  x:467, y:357, r:65},
      {n:6,  x:82,  y:494, r:65},
      {n:7,  x:326, y:575, r:65},
      {n:8,  x:599, y:537, r:65},
      {n:9,  x:863, y:436, r:65},
      {n:10, x:140, y:721, r:65},
      {n:11, x:549, y:737, r:65},
      {n:12, x:827, y:681, r:65},
    ],
  },
];

const SUIT_COLORS = { F: '#d9453f', R: '#e8772e', C: '#f0c93b' };
const SUIT_NAMES  = { F: 'Raposa', R: 'Rato', C: 'Coelho' };
const CLEARING_LABELS = ['1','2','3','4','5','6','7','8','9','10','11','12'];

const REACH_MIN = { 2: 17, 3: 18, 4: 21, 5: 25, 6: 28 };