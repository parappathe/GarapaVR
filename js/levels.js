// Os 3 mundos e as 12 fases do Garapeiro. Sem navegador (os testes rodam no Node).
//
// Cada fase: quantos balcões (lanes), comprimento do balcão (len, em metros), quantos fregueses
// chegam (count), de quanto em quanto tempo (every, em segundos), a mistura de tipos de freguês
// (mix: peso de cada tipo de CUSTOMER em sim.js) e os extras do mundo:
//   tip    chance de o freguês mandar gorjeta (moeda que desliza até você)
//   fire   de quanto em quanto tempo vem um busca-pé por um balcão (0 = nunca)
//   gull   de quanto em quanto tempo pousa uma gaivota num balcão (0 = nunca)
//   boss   'bus' (Excursão), 'boi' (Boi-Bumbá) ou 'bocao' (Seu Bocão)
export const LEVELS_PER_WORLD = 4;

export const WORLDS = [
  { name: 'Feira do Bairro', hint: 'Encha o copo na moenda e deslize pelo balcão!', walk: 0.2, empty: 1.5 },
  { name: 'Festa Junina', hint: 'Quatro balcões, gorjetas e busca-pés!', walk: 0.23, empty: 1.75 },
  { name: 'Luau na Praia', hint: 'Cuidado com as gaivotas: roubam o copo!', walk: 0.25, empty: 1.95 },
];

export const LEVELS = [
  // ---- Feira do Bairro ----
  { world: 0, name: 'Primeiro freguês', lanes: 3, len: 3.4, count: 6, every: 5.0, mix: { normal: 1 } },
  { world: 0, name: 'Fila de domingo', lanes: 3, len: 3.6, count: 10, every: 3.8, mix: { normal: 3, sedento: 1 } },
  { world: 0, name: 'Hora do almoço', lanes: 3, len: 3.6, count: 14, every: 3.0, mix: { normal: 3, sedento: 1, apressado: 1 } },
  { world: 0, name: 'Excursão', lanes: 3, len: 3.6, count: 22, every: 2.3, mix: { normal: 3, sedento: 1, apressado: 1 }, boss: 'bus' },
  // ---- Festa Junina ----
  { world: 1, name: 'Quadrilha', lanes: 4, len: 3.8, count: 12, every: 3.6, mix: { normal: 3, sedento: 1 }, tip: 0.35 },
  { world: 1, name: 'Busca-pé', lanes: 4, len: 3.8, count: 14, every: 3.4, mix: { normal: 3, sedento: 1, apressado: 1 }, tip: 0.25, fire: 9 },
  { world: 1, name: 'Arraiá lotado', lanes: 4, len: 4.0, count: 18, every: 2.8, mix: { normal: 3, sedento: 2, apressado: 1 }, tip: 0.3, fire: 8 },
  { world: 1, name: 'Boi-Bumbá', lanes: 4, len: 4.0, count: 8, every: 4.5, mix: { normal: 2, sedento: 1 }, tip: 0.2, boss: 'boi' },
  // ---- Luau na Praia ----
  { world: 2, name: 'Gaivotas', lanes: 4, len: 4.0, count: 14, every: 3.4, mix: { normal: 3, sedento: 1 }, tip: 0.25, gull: 7 },
  { world: 2, name: 'Maré cheia', lanes: 4, len: 4.2, count: 18, every: 2.9, mix: { normal: 2, sedento: 1, apressado: 2 }, tip: 0.25, gull: 6 },
  { world: 2, name: 'Luau', lanes: 4, len: 4.2, count: 20, every: 2.7, mix: { normal: 3, sedento: 2, apressado: 2 }, tip: 0.3, fire: 11, gull: 8 },
  { world: 2, name: 'Seu Bocão', lanes: 4, len: 4.2, count: 8, every: 4.2, mix: { normal: 2, apressado: 1 }, tip: 0.2, gull: 10, boss: 'bocao' },
];

// Estrelas pelas vidas perdidas: nenhuma = 3, uma = 2, mais = 1.
export function starsFor(livesLost) {
  return livesLost <= 0 ? 3 : livesLost === 1 ? 2 : 1;
}
