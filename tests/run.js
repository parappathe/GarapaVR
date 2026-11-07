// Testes automáticos: node tests/run.js (ou npm test). Não tocam som nem usam navegador.
import { Game, DT, LIVES, COUNTER, CUP, FILL, CATCH, CUSTOMER, POINTS, BOCAO, FREEZE, laneAngles, lanePoint, laneDir, locate } from '../js/sim.js';
import { LEVELS, WORLDS, LEVELS_PER_WORLD, starsFor } from '../js/levels.js';
import { makeRobot, HAND } from '../js/robot.js';

let fails = 0, count = 0;
function ok(cond, msg) {
  count++;
  if (!cond) { fails++; console.log('  FALHOU:', msg); }
}
const near = (a, b, e) => Math.abs(a - b) <= e;
const off = { hands: [{ on: false }, { on: false }] };
// jogo sem fila de fregueses (para montar cenas)
function empty(level = 0, opts = {}) {
  const g = new Game(level, opts);
  g.queue = []; g.total = 0;
  g.checkEnd = () => {};
  g.nextFire = g.nextGull = Infinity;
  return g;
}
const run = (g, sec, inp = off) => { const evs = []; for (let i = 0; i < Math.round(sec / DT); i++) { g.step(typeof inp === 'function' ? inp(g) : inp); evs.push(...g.events); } return evs; };
const has = (evs, type) => evs.some(e => e.type === type);
const cust = (g, lane, s, type = 'normal', extra = {}) => {
  const T = CUSTOMER[type];
  const c = { id: g.nextId++, lane, s, type, state: 'pause', t: 99, speed: T.speed * g.W.walk, push: T.push, pushLeft: 0, hp: T.hp || 0, maxHp: T.hp || 0, boss: !!T.hp, ...extra };
  g.customers.push(c); return c;
};
const hand = (p, trig = false, extra = {}) => ({ p, trig, on: true, ...extra });
// enche um copo na moenda do balcão `lane` com a mão 1 e desliza com a velocidade de mão `u`
function fillAndSlide(g, lane, u) {
  const az = g.angles[lane];
  const tap = lanePoint(az, 0.02, 1.1);
  run(g, FILL.time + 0.1, { hands: [{ on: false }, hand(tap, true)] });
  const dir = laneDir(az);
  let p = lanePoint(az, 0.0, CUP.y);
  const evs = [];
  for (let k = 0; k < Math.round(0.4 / u / DT); k++) {
    p = [p[0] + dir[0] * u * DT, CUP.y, p[2] + dir[2] * u * DT];
    g.step({ hands: [{ on: false }, hand(p, true)] }); evs.push(...g.events);
  }
  g.step({ hands: [{ on: false }, hand(p, false)] }); evs.push(...g.events);
  return evs;
}

console.log('Fases');
{
  ok(LEVELS.length === 12 && WORLDS.length === 3, '12 fases em 3 mundos');
  LEVELS.forEach((L, i) => {
    ok(L.world === Math.floor(i / LEVELS_PER_WORLD), `fase ${i + 1} no mundo certo`);
    ok(!!L.boss === (i % 4 === 3), `fase ${i + 1}: chefe só na 4ª de cada mundo`);
    ok(L.lanes === 3 || L.lanes === 4, `fase ${i + 1}: 3 ou 4 balcões`);
    ok(Object.keys(L.mix).every(k => CUSTOMER[k] && !CUSTOMER[k].hp), `fase ${i + 1}: só fregueses da lista`);
    ok(L.count > 0 && L.every > 1, `fase ${i + 1}: tem fregueses`);
  });
  ok(starsFor(0) === 3 && starsFor(1) === 2 && starsFor(2) === 1, 'estrelas pelas vidas perdidas');
}

console.log('Balcões');
{
  ok(laneAngles(3).length === 3 && laneAngles(4).length === 4, 'leque de 3 e de 4');
  for (const n of [3, 4]) {
    const a = laneAngles(n);
    a.forEach((az, i) => {
      const loc = locate(lanePoint(az, 0.5, 1.05), a);
      ok(loc.lane === i && near(loc.s, 0.5, 1e-6) && loc.lat < 1e-6, `ponto no balcão ${i + 1} de ${n} volta para ele`);
    });
    // as pontas cabem no alcance de quem está parado
    for (const az of a) { const p = lanePoint(az, 0, 1); ok(Math.hypot(p[0], p[2]) <= 0.65 && Math.abs(p[0]) < 0.4, `ponta do balcão ${az}° ao alcance`); }
  }
}

console.log('Encher e deslizar');
{
  const g = empty(0);
  const az = g.angles[1];
  const tap = lanePoint(az, 0.02, 1.1);
  let evs = run(g, FILL.time * 0.5, { hands: [{ on: false }, hand(tap, true)] });
  ok(has(evs, 'fill-start') && g.hands[1].holding && !g.hands[1].holding.full, 'copo começa a encher com o gatilho na moenda');
  evs = run(g, FILL.time * 0.6, { hands: [{ on: false }, hand(tap, true)] });
  ok(has(evs, 'full') && g.hands[1].holding.full, 'copo cheio depois do tempo de encher');
  // soltar longe do balcão derrama
  evs = run(g, DT, { hands: [{ on: false }, hand([0, 1.6, 0.2], false)] });
  ok(has(evs, 'spill') && !g.items.length, 'soltar longe do balcão derrama');
  // soltar parado deixa o copo parado
  run(g, FILL.time + 0.05, { hands: [{ on: false }, hand(tap, true)] });
  run(g, DT * 2, { hands: [{ on: false }, hand(lanePoint(az, 0.1, CUP.y), true)] });
  run(g, DT * 8, { hands: [{ on: false }, hand(lanePoint(az, 0.1, CUP.y), true)] });
  run(g, DT, { hands: [{ on: false }, hand(lanePoint(az, 0.1, CUP.y), false)] });
  ok(g.items.length === 1 && g.items[0].v === 0, 'soltar parado deixa o copo no balcão');
  // empurrão mais forte = mais longe
  const dist = (u) => { const h = empty(0); fillAndSlide(h, 1, u); run(h, 6); return h.items[0]?.s ?? 99; };
  const d1 = dist(0.8), d2 = dist(1.2);
  ok(d1 > 0.5 && d2 > d1 + 0.5, `empurrão mais forte vai mais longe (${d1.toFixed(2)} m, ${d2.toFixed(2)} m)`);
  // copo forte demais sem ninguém: cai lá no fim e tira vida
  const h = empty(0); fillAndSlide(h, 1, 2.6);
  const e2 = run(h, 6);
  ok(e2.some(e => e.type === 'life' && e.reason === 'cup-fell') && h.lives === LIVES - 1, 'copo que passa do fim cai e tira vida');
}

console.log('Fregueses');
{
  // freguês pega o copo, é empurrado, bebe e devolve o vazio
  const g = empty(0);
  const c = cust(g, 1, 1.2);
  let evs = fillAndSlide(g, 1, 1.3);
  evs.push(...run(g, 3));
  ok(has(evs, 'serve'), 'freguês pega o copo que chega nele');
  ok(c.s > 1.2 + 1.2 || c.state === 'gone' || c.state === 'drink' || has(evs, 'throw'), 'copo empurra o freguês para trás');
  ok(has(evs, 'throw') && g.items.some(it => it.kind === 'empty'), 'depois de beber ele devolve o copo vazio');
  // vazio que chega na ponta cai e tira vida
  const lives = g.lives;
  evs = run(g, 4);
  ok(evs.some(e => e.type === 'life' && e.reason === 'empty-fell') && g.lives === lives - 1, 'copo vazio não pego cai e tira vida');
  // pegar o vazio com a mão
  const h = empty(0);
  h.items.push({ id: 99, kind: 'empty', lane: 0, s: 1.5 });
  const p = lanePoint(h.angles[0], 0.3, CUP.y);
  evs = run(h, 2, { hands: [hand(p), { on: false }] });
  ok(has(evs, 'catch') && !h.items.length && h.lives === LIVES && h.score === POINTS.empty, 'mão parada na frente pega o copo vazio');
  // mão longe demais não pega
  const k = empty(0);
  k.items.push({ id: 99, kind: 'empty', lane: 0, s: 1.5 });
  evs = run(k, 2, { hands: [hand(lanePoint(k.angles[0], 0.3, CUP.y + 0.3)), { on: false }] });
  ok(!has(evs, 'catch'), 'mão 30 cm acima não pega');
  // empurrado para fora do balcão: vai embora satisfeito
  const m = empty(0);
  const c2 = cust(m, 0, m.len - 0.6);
  evs = fillAndSlide(m, 0, 1.6); evs.push(...run(m, 3));
  ok(c2.state === 'gone' && m.served === 1 && has(evs, 'leave'), 'empurrado para fora do balcão vai embora');
  // freguês que chega na ponta tira vida e todo mundo recua
  const r = empty(0);
  const c3 = cust(r, 2, 0.4, 'normal', { state: 'walk', t: 99 });
  const c4 = cust(r, 0, 1.0);
  evs = run(r, 2);
  ok(evs.some(e => e.type === 'life' && e.reason === 'reached'), 'freguês na ponta do balcão tira vida');
  ok(c3.s >= r.len * 0.7 - 1e-9 && c4.s >= r.len * 0.7 - 1e-9 && r.freeze > 0, 'depois todo mundo recua e o jogo pausa um pouco');
  // fila não atravessa
  const q = empty(0);
  const a = cust(q, 0, 1.0), b = cust(q, 0, 1.2, 'apressado', { state: 'walk', t: 99 });
  run(q, 1);
  ok(b.s >= a.s + 0.44, 'freguês de trás não atravessa o da frente');
  // apressado anda mais rápido, sedento é empurrado menos
  ok(CUSTOMER.apressado.speed > CUSTOMER.normal.speed && CUSTOMER.sedento.push < CUSTOMER.normal.push, 'apressado rápido, sedento empurra pouco');
  // copo parado: o freguês que chega nele pega
  const z = empty(0);
  z.items.push({ id: 50, kind: 'cup', lane: 1, s: 0.6, v: 0 });
  cust(z, 1, 1.0, 'normal', { state: 'walk', t: 99 });
  evs = run(z, 3);
  ok(has(evs, 'serve'), 'freguês pega o copo parado no balcão');
  // quem está bebendo não pega: o copo passa
  const d = empty(0);
  const cd = cust(d, 1, 1.0, 'normal', { state: 'drink', t: 5 });
  fillAndSlide(d, 1, 1.0); run(d, 1.2);
  ok(cd.state === 'drink', 'quem está bebendo deixa o copo passar');
}

console.log('Extras');
{
  // gorjeta: moeda desliza até o jogador e dá pontos
  const g = empty(4, { seed: 3 });
  g.L = { ...g.L, tip: 1 };
  cust(g, 1, 1.5);
  const catcher = { hands: [hand(lanePoint(g.angles[1], 0.3, CUP.y)), { on: false }] };
  const e0 = fillAndSlide(g, 1, 1.2);
  const s0 = g.score;
  const evs = e0.concat(run(g, 4, catcher));
  ok(has(evs, 'tip'), 'freguês satisfeito manda gorjeta');
  ok(has(evs, 'coin') && g.score >= s0 + POINTS.coin, 'pegar a gorjeta dá pontos');
  // busca-pé: chegando na ponta tira vida; a mão espanta; o copo apaga
  const f = empty(5);
  f.items.push({ id: 7, kind: 'fire', lane: 0, s: 1.0 });
  let e = run(f, 2);
  ok(e.some(x => x.type === 'life' && x.reason === 'fire'), 'busca-pé que chega na ponta tira vida');
  const f2 = empty(5);
  f2.items.push({ id: 7, kind: 'fire', lane: 0, s: 1.0 });
  e = run(f2, 2, { hands: [hand(lanePoint(f2.angles[0], 0.3, CUP.y)), { on: false }] });
  ok(has(e, 'fire-swat') && f2.lives === LIVES, 'a mão espanta o busca-pé');
  const f3 = empty(5);
  f3.items.push({ id: 7, kind: 'fire', lane: 0, s: 2.5 });
  e = fillAndSlide(f3, 0, 1.4); e.push(...run(f3, 2));
  ok(has(e, 'fire-out') && f3.lives === LIVES, 'copo deslizado apaga o busca-pé');
  // gaivota rouba o copo que passa por ela
  const s = empty(8);
  s.gulls.push({ lane: 2, s: 1.5, t: 5, leave: false });
  cust(s, 2, 3.0);
  e = fillAndSlide(s, 2, 1.6); e.push(...run(s, 2));
  ok(has(e, 'gull-steal') && !has(e, 'serve') && s.lives === LIVES, 'gaivota rouba o copo (sem tirar vida)');
  // aparecem sozinhos nas fases deles
  const auto = new Game(6, { seed: 2 });
  const e3 = run(auto, 20);
  ok(has(e3, 'fire'), 'busca-pés aparecem na fase 7');
  const auto2 = new Game(8, { seed: 2 });
  ok(has(run(auto2, 15), 'gull'), 'gaivotas aparecem na fase 9');
}

console.log('Chefes');
{
  // Boi-Bumbá: 8 copos para ir embora, devolve o vazio na hora
  const g = new Game(7, { seed: 1 });
  g.queue = g.queue.filter(q => q.type === 'boi'); g.total = 1;
  run(g, 3);
  const B = g.bossRef;
  ok(B && B.type === 'boi' && B.hp === 8 && B.lane === 1, 'Boi-Bumbá entra no balcão 2 com 8 de vida');
  const s0 = B.s;
  let evs = fillAndSlide(g, 1, 1.9); evs.push(...run(g, 2.6));
  ok(B.hp === 7 && has(evs, 'boss-hit') && B.s > s0 - 0.6, 'copo tira 1 de vida do Boi e empurra');
  ok(evs.some(e => e.type === 'throw' && e.boss) || g.items.some(it => it.kind === 'empty'), 'o Boi devolve o copo vazio');
  B.hp = 1; g.items = [];
  evs = fillAndSlide(g, 1, 2.0); evs.push(...run(g, 8));
  ok(has(evs, 'boss-down') && B.state === 'gone', 'último copo: o Boi vai embora dançando');
  // Seu Bocão: troca de balcão com aviso
  const k = new Game(11, { seed: 1 });
  k.queue = k.queue.filter(q => q.type === 'bocao'); k.total = 1;
  run(k, 3);
  const C = k.bossRef;
  ok(C && C.type === 'bocao' && C.hp === 12, 'Seu Bocão entra com 12 de vida');
  const lane0 = C.lane;
  evs = run(k, BOCAO.swapEvery + 0.5);
  const warn = evs.find(e => e.type === 'boss-warn'), swap = evs.find(e => e.type === 'boss-swap');
  ok(warn && swap && C.lane !== lane0 && C.lane === warn.to, 'Seu Bocão avisa e troca de balcão');
  k.items = []; k.freeze = 0;
  evs = fillAndSlide(k, C.lane, 1.9); evs.push(...run(k, 2.8));
  ok(evs.filter(e => e.type === 'throw' && e.boss).length === 2, 'Seu Bocão devolve dois copos de uma vez');
  // Excursão: muitos fregueses
  ok(new Game(3).total >= 20, 'Excursão traz mais de 20 fregueses');
}

console.log('Vencer e perder');
{
  const g = new Game(0, { seed: 5 });
  g.queue = []; g.total = 0;
  run(g, 0.1);
  ok(g.over && g.result.won && g.result.stars === 3 && g.result.bonus === LIVES * POINTS.life, 'sem fregueses: vence com 3 estrelas e bônus de vidas');
  const h = empty(0, { lives: 1 });
  h.checkEnd = Game.prototype.checkEnd;
  cust(h, 0, 0.3, 'normal', { state: 'walk', t: 99 });
  const evs = run(h, 1);
  ok(h.over && !h.result.won && has(evs, 'lost'), 'última vida perdida: fim de jogo');
  ok(FREEZE > 1, 'pausa depois de perder vida');
}

console.log('Robô (limites humanos)');
{
  const SEEDS = [1, 2, 3, 4, 5];
  let allOk = true;
  for (let i = 0; i < LEVELS.length; i++) {
    const res = [];
    for (const seed of SEEDS) {
      const g = new Game(i, { seed });
      const bot = makeRobot(seed * 31 + i);
      let steps = 0;
      while (!g.over && steps < 600 / DT) { g.step(bot.step(g)); steps++; }
      res.push(g.result || { won: false, stars: 0, livesLost: 9, time: 600 });
    }
    const won = res.filter(r => r.won).length;
    const two = res.filter(r => r.stars >= 2).length;
    const lost = res.map(r => r.livesLost).join(' ');
    const t = Math.round(res.reduce((s, r) => s + r.time, 0) / res.length);
    console.log(`  fase ${String(i + 1).padStart(2)} ${LEVELS[i].name.padEnd(18)} venceu ${won}/${SEEDS.length}  2+ estrelas ${two}/${SEEDS.length}  vidas perdidas: ${lost}  ~${t} s`);
    if (won < SEEDS.length || two < SEEDS.length - 1) allOk = false;
  }
  ok(allOk, 'robô vence todas as fases em todas as sementes, com 2 estrelas ou mais em quase todas');
  ok(HAND.speed <= 2.6 && HAND.push <= 2.8 && HAND.react >= 0.3, 'limites do robô são humanos');
}

console.log(fails ? `\n${fails} de ${count} verificações FALHARAM` : `\nTudo certo (${count} verificações)`);
process.exit(fails ? 1 : 0);
