// Regras do Garapeiro. Sem navegador e sem Three.js (os testes rodam no Node).
//
// O jogador fica em x = 0, z = 0. Os balcões saem em leque na frente dele: cada um é uma reta no
// chão com ângulo próprio (az, em graus; 0 = em frente, positivo = para a direita). A posição de
// qualquer coisa num balcão é só "s" (metros a partir da ponta perto do jogador, que fica a
// COUNTER.r0 do centro). A moenda fica em cima da ponta (s ≈ 0).
import { Rng, clamp } from './vec.js';
import { LEVELS, WORLDS, starsFor } from './levels.js';

export const DT = 1 / 120;
export const LIVES = 3;
export const COUNTER = { y: 1.0, r0: 0.6, halfW: 0.09 };
export const FILL = { time: 0.55, sMin: -0.14, sMax: 0.18, lat: 0.14, yMin: 0.98, yMax: 1.32 };
export const PLACE = { sMin: -0.12, sMax: 0.95, lat: 0.17, yMin: 0.95, yMax: 1.3 };
export const CUP = { friction: 1.0, boost: 1.6, max: 4.5, minSlide: 0.25, y: 1.06 };
export const CATCH = { radius: 0.17, sMax: 1.0 };
export const SPEED = { pushed: 2.6, coin: 1.1, fire: 0.85, leave: 1.3 };
export const GAP = 0.45;              // distância mínima entre dois fregueses no mesmo balcão
export const FREEZE = 1.6;            // pausa depois de perder vida
export const POINTS = { serve: 50, leave: 100, empty: 100, coin: 500, fireOut: 250, fireSwat: 150, bossHit: 300, bossDown: 3000, life: 1000 };

// tipos de freguês: velocidade (x a do mundo), quanto o copo empurra para trás, gole
export const CUSTOMER = {
  normal: { speed: 1.0, push: 1.5, drink: 1.4 },
  sedento: { speed: 0.9, push: 0.85, drink: 1.2 },
  apressado: { speed: 1.55, push: 1.5, drink: 1.0 },
  boi: { speed: 0.55, push: 0.45, drink: 0, hp: 8 },
  bocao: { speed: 0.6, push: 0.5, drink: 0, hp: 12 },
};
export const BOCAO = { swapEvery: 7, warn: 1.3 };
export const GULL = { stay: 5 };

export function laneAngles(n) {
  return n === 3 ? [-24, 0, 24] : [-33, -11, 11, 33];
}
// ponto 3D num balcão
export function lanePoint(az, s, y = COUNTER.y) {
  const a = az * Math.PI / 180, r = COUNTER.r0 + s;
  return [r * Math.sin(a), y, -r * Math.cos(a)];
}
export function laneDir(az) {
  const a = az * Math.PI / 180;
  return [Math.sin(a), 0, -Math.cos(a)];
}
// onde a mão está em relação a cada balcão: o mais perto pelo ângulo
export function locate(p, angles) {
  const r = Math.hypot(p[0], p[2]);
  const az = Math.atan2(p[0], -p[2]) * 180 / Math.PI;
  let best = -1, bd = 1e9;
  angles.forEach((a, i) => { const d = Math.abs(az - a); if (d < bd) { bd = d; best = i; } });
  const da = (az - angles[best]) * Math.PI / 180;
  return { lane: best, s: r * Math.cos(da) - COUNTER.r0, lat: Math.abs(r * Math.sin(da)), y: p[1] };
}
const inZone = (loc, Z) => loc.s >= Z.sMin && loc.s <= Z.sMax && loc.lat <= Z.lat && loc.y >= Z.yMin && loc.y <= Z.yMax;

export class Game {
  constructor(levelIndex = 0, opts = {}) {
    this.levelIndex = levelIndex;
    const L = this.L = LEVELS[levelIndex];
    this.W = WORLDS[L.world];
    this.rng = new Rng(opts.seed ?? 1);
    this.angles = laneAngles(L.lanes);
    this.len = L.len;
    this.t = 0;              // tempo total
    this.clock = 0;          // tempo de jogo (para na pausa depois de perder vida)
    this.lives = opts.lives ?? LIVES;
    this.livesLost = 0;
    this.score = 0;
    this.served = 0;
    this.events = [];
    this.over = false;
    this.result = null;
    this.freeze = 0;
    this.nextId = 1;
    this.customers = [];
    this.items = [];         // copos cheios, copos vazios, moedas, busca-pés
    this.gulls = [];
    this.throws = [];        // copos vazios que o chefe ainda vai jogar
    this.hands = [0, 1].map(() => ({ hist: [], holding: null, trig: false, loc: null }));
    // fila de chegada dos fregueses
    this.queue = [];
    const types = Object.entries(L.mix);
    const totalW = types.reduce((s, [, w]) => s + w, 0);
    for (let k = 0; k < L.count; k++) {
      let r = this.rng.next() * totalW, type = types[0][0];
      for (const [name, w] of types) { if ((r -= w) < 0) { type = name; break; } }
      this.queue.push({ at: 1.5 + k * L.every * this.rng.range(0.85, 1.15), type });
    }
    this.boss = L.boss || null;
    this.bossRef = null;
    if (this.boss === 'boi' || this.boss === 'bocao') this.queue.unshift({ at: 2.5, type: this.boss, lane: this.boss === 'boi' ? 1 : 2 });
    this.queue.sort((a, b) => a.at - b.at);
    this.total = this.queue.length;
    this.nextFire = L.fire ? L.fire * 0.8 : Infinity;
    this.nextGull = L.gull ? L.gull * 0.7 : Infinity;
    this.swapAt = Infinity; this.swapWarned = false; this.swapTo = -1;
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }
  get left() { return this.total - this.served; }
  pos(lane, s, y) { return lanePoint(this.angles[lane], s, y); }
  catchers(lane) {
    return this.customers.filter(c => c.lane === lane && (c.state === 'walk' || c.state === 'pause')).sort((a, b) => a.s - b.s);
  }

  // input: { hands: [{ p: [x,y,z], trig: bool, on: bool, v?: [x,y,z] (velocidade pronta, PC), reach? }] }
  step(input) {
    this.events = [];
    if (this.over) return;
    this.t += DT;
    const hands = input?.hands || [];
    if (this.freeze > 0) {
      this.freeze -= DT;
      for (let i = 0; i < 2; i++) { const H = this.hands[i]; H.trig = !!hands[i]?.trig; H.hist.length = 0; }
      return;
    }
    this.clock += DT;
    this.spawn();
    for (let i = 0; i < 2; i++) this.handStep(i, hands[i] || { on: false });
    this.moveItems(hands);
    this.moveCustomers();
    this.extras();
    if (!this.over) this.checkEnd();
  }

  spawn() {
    while (this.queue.length && this.queue[0].at <= this.clock) {
      const q = this.queue[0];
      let lane = q.lane;
      if (lane == null) {
        const counts = this.angles.map((_, i) => this.customers.filter(c => c.lane === i && c.state !== 'gone').length);
        const ok = counts.map((n, i) => i).filter(i => !this.customers.some(c => c.lane === i && c.state !== 'gone' && c.s > this.len - GAP));
        if (!ok.length) { q.at += 0.4; this.queue.sort((a, b) => a.at - b.at); return; }
        const min = Math.min(...ok.map(i => counts[i]));
        lane = this.rng.pick(ok.filter(i => counts[i] <= min + 1 && (this.boss !== 'boi' || i !== 1 || !this.bossRef || this.bossRef.state === 'gone')));
        if (lane == null) lane = ok[0];
      }
      this.queue.shift();
      const T = CUSTOMER[q.type];
      const c = {
        id: this.nextId++, lane, s: this.len, type: q.type, state: 'walk', t: this.rng.range(1.2, 2.0),
        speed: T.speed * this.W.walk, push: T.push, pushLeft: 0, hp: T.hp || 0, maxHp: T.hp || 0, boss: !!T.hp,
      };
      this.customers.push(c);
      if (c.boss) { this.bossRef = c; this.emit('boss-in', { kind: c.type, lane }); if (c.type === 'bocao') this.swapAt = this.clock + BOCAO.swapEvery; }
      this.emit('arrive', { id: c.id, lane, ctype: c.type, p: this.pos(lane, c.s, 1.4) });
    }
  }

  handVel(H, inp) {
    if (inp.v) return inp.v;
    const h = H.hist;
    if (h.length < 2) return [0, 0, 0];
    const a = h[0], b = h[h.length - 1], dt = (h.length - 1) * DT;
    return [(b[0] - a[0]) / dt, (b[1] - a[1]) / dt, (b[2] - a[2]) / dt];
  }

  handStep(i, inp) {
    const H = this.hands[i];
    if (!inp.on || !inp.p) {
      if (H.holding) { H.holding = null; }
      H.trig = false; H.hist.length = 0; H.loc = null;
      return;
    }
    H.hist.push(inp.p.slice());
    if (H.hist.length > 5) H.hist.shift();
    const loc = H.loc = locate(inp.p, this.angles);
    const trig = !!inp.trig;
    if (trig && H.holding?.full) {
      const dir = laneDir(this.angles[loc.lane]), vel = this.handVel(H, inp);
      const f = vel[0] * dir[0] + vel[2] * dir[2];
      H.fwdHist = (H.fwdHist || []).concat(f).slice(-4);
      H.fwd = Math.max(...H.fwdHist);
    } else if (!H.holding) { H.fwdHist = []; H.fwd = 0; }
    if (trig && !H.holding && inZone(loc, FILL)) {
      H.holding = { fill: 0, full: false, lane: loc.lane };
      this.emit('fill-start', { hand: i, lane: loc.lane, p: this.pos(loc.lane, 0, 1.2) });
    }
    if (trig && H.holding && !H.holding.full && inZone(loc, FILL)) {
      H.holding.fill = Math.min(1, H.holding.fill + DT / FILL.time);
      H.holding.lane = loc.lane;
      if (H.holding.fill >= 1) { H.holding.full = true; this.emit('full', { hand: i, lane: loc.lane }); }
    }
    if (!trig && H.trig && H.holding) {
      const cup = H.holding;
      H.holding = null;
      if (cup.full && inZone(loc, PLACE)) {
        const dir = laneDir(this.angles[loc.lane]);
        const vel = this.handVel(H, inp);
        // no quadro de soltar a mão às vezes já parou: vale o maior empurrão dos últimos quadros
        let v = Math.max(vel[0] * dir[0] + vel[2] * dir[2], H.fwd || 0) * CUP.boost;
        v = v < CUP.minSlide ? 0 : Math.min(CUP.max, v);
        const it = { id: this.nextId++, kind: 'cup', lane: loc.lane, s: clamp(loc.s, 0.04, PLACE.sMax), v };
        this.items.push(it);
        this.emit('slide', { hand: i, lane: loc.lane, v, p: this.pos(loc.lane, it.s, CUP.y) });
      } else if (cup.fill > 0.15) this.emit('spill', { hand: i, p: inp.p.slice(), full: cup.full });
    }
    H.trig = trig;
  }

  moveItems(hands) {
    const kill = new Set();
    for (const it of this.items) {
      if (kill.has(it)) continue;
      if (it.kind === 'cup') {
        const s0 = it.s;
        it.s += it.v * DT;
        it.v = Math.max(0, it.v - CUP.friction * DT);
        // gaivota rouba
        const g = this.gulls.find(g => g.lane === it.lane && g.s >= Math.min(s0, it.s) - 0.12 && g.s <= it.s + 0.12);
        if (g) { kill.add(it); g.leave = true; this.emit('gull-steal', { lane: it.lane, p: this.pos(it.lane, g.s, 1.15) }); continue; }
        // busca-pé apagado pelo copo
        const f = this.items.find(o => o.kind === 'fire' && !kill.has(o) && o.lane === it.lane && o.s - it.s <= 0.1 && o.s - it.s >= -0.25);
        if (f) {
          kill.add(it); kill.add(f);
          this.score += POINTS.fireOut;
          this.emit('fire-out', { lane: it.lane, p: this.pos(it.lane, f.s, CUP.y) });
          continue;
        }
        // freguês pega o copo
        const c = this.catchers(it.lane).find(c => c.s >= it.s - 0.2 && c.s - it.s <= 0.12);
        if (c) { kill.add(it); this.serve(c); continue; }
        if (it.s > this.len + 0.05) { kill.add(it); this.loseLife('cup-fell', it.lane, this.pos(it.lane, this.len, CUP.y)); return; }
      } else {
        const sp = it.kind === 'empty' ? this.W.empty * (it.fast || 1) : it.kind === 'coin' ? SPEED.coin : SPEED.fire;
        it.s -= sp * DT;
        if (it.s < CATCH.sMax) {
          const p = this.pos(it.lane, it.s, CUP.y);
          const hi = hands.findIndex(h => h?.on && h.p && Math.hypot(h.p[0] - p[0], h.p[1] - p[1], h.p[2] - p[2]) <= (h.reach || CATCH.radius));
          if (hi >= 0) {
            kill.add(it);
            if (it.kind === 'empty') { this.score += POINTS.empty; this.emit('catch', { hand: hi, p }); }
            else if (it.kind === 'coin') { this.score += POINTS.coin; this.emit('coin', { hand: hi, p }); }
            else { this.score += POINTS.fireSwat; this.emit('fire-swat', { hand: hi, p }); }
            continue;
          }
        }
        if (it.kind === 'fire' && it.s < 0.05) { kill.add(it); this.loseLife('fire', it.lane, this.pos(it.lane, 0.05, CUP.y)); return; }
        if (it.s < -0.08) {
          kill.add(it);
          if (it.kind === 'empty') { this.loseLife('empty-fell', it.lane, this.pos(it.lane, -0.08, CUP.y)); return; }
          if (it.kind === 'coin') this.emit('coin-lost', { p: this.pos(it.lane, -0.08, CUP.y) });
        }
      }
    }
    if (kill.size) this.items = this.items.filter(o => !kill.has(o));
  }

  serve(c) {
    this.score += POINTS.serve;
    const p = this.pos(c.lane, c.s, 1.2);
    if (c.boss) {
      c.hp--;
      this.score += POINTS.bossHit;
      this.emit('boss-hit', { kind: c.type, hp: c.hp, p });
      if (c.hp <= 0) { c.state = 'leaving'; this.score += POINTS.bossDown; this.emit('boss-down', { kind: c.type, p }); this.swapAt = Infinity; return; }
      c.state = 'pushed'; c.pushLeft = c.push;
      this.throws.push({ at: this.clock + 0.35, lane: c.lane, ref: c, fast: c.type === 'bocao' ? 1.15 : 1 });
      if (c.type === 'bocao') this.throws.push({ at: this.clock + 0.85, lane: c.lane, ref: c, fast: 1.15 });
      return;
    }
    c.state = 'pushed'; c.pushLeft = c.push;
    this.emit('serve', { id: c.id, lane: c.lane, ctype: c.type, p });
    if (this.L.tip && this.rng.next() < this.L.tip) {
      this.items.push({ id: this.nextId++, kind: 'coin', lane: c.lane, s: c.s });
      this.emit('tip', { lane: c.lane, p });
    }
  }

  moveCustomers() {
    for (const c of this.customers) {
      if (c.state === 'gone') continue;
      if (c.state === 'walk' || c.state === 'pause') {
        c.t -= DT;
        if (c.state === 'walk') {
          c.s -= c.speed * DT;
          if (c.t <= 0) { c.state = c.boss ? 'walk' : 'pause'; c.t = c.boss ? 9 : this.rng.range(0.6, 1.1); }
        } else if (c.t <= 0) { c.state = 'walk'; c.t = this.rng.range(1.2, 2.0); }
      } else if (c.state === 'pushed') {
        const d = SPEED.pushed * DT;
        c.s += d; c.pushLeft -= d;
        if (c.s >= this.len && !c.boss) {
          c.state = 'gone'; this.served++; this.score += POINTS.leave;
          this.emit('leave', { id: c.id, lane: c.lane, p: this.pos(c.lane, this.len, 1.3) });
          continue;
        }
        if (c.pushLeft <= 0) {
          if (c.boss) { c.state = 'walk'; c.t = 9; }
          else { c.state = 'drink'; c.t = CUSTOMER[c.type].drink; this.emit('drink', { id: c.id, p: this.pos(c.lane, c.s, 1.3) }); }
        }
      } else if (c.state === 'drink') {
        c.t -= DT;
        if (c.t <= 0) {
          c.state = 'walk'; c.t = this.rng.range(1.0, 1.8);
          this.items.push({ id: this.nextId++, kind: 'empty', lane: c.lane, s: c.s - 0.1 });
          this.emit('throw', { lane: c.lane, p: this.pos(c.lane, c.s, CUP.y) });
        }
      } else if (c.state === 'leaving') {
        c.s += SPEED.leave * DT;
        if (c.s >= this.len + 0.3) { c.state = 'gone'; this.served++; this.emit('leave', { id: c.id, lane: c.lane, boss: true, p: this.pos(c.lane, this.len, 1.3) }); }
      }
    }
    // fila: quem vem atrás não atravessa quem está na frente
    for (let lane = 0; lane < this.angles.length; lane++) {
      const row = this.customers.filter(c => c.lane === lane && c.state !== 'gone').sort((a, b) => a.s - b.s);
      for (let k = 1; k < row.length; k++) {
        const a = row[k - 1], b = row[k];
        const gap = a.boss || b.boss ? GAP * 1.6 : GAP;
        if ((b.state === 'walk' || b.state === 'pause') && b.s < a.s + gap) b.s = Math.min(this.len, a.s + gap);
      }
    }
    // alguém chegou na ponta do balcão?
    const r = this.customers.find(c => (c.state === 'walk' || c.state === 'pause') && c.s <= 0.25);
    if (r) this.loseLife(r.boss ? 'boss-reached' : 'reached', r.lane, this.pos(r.lane, 0.25, 1.3));
  }

  extras() {
    if (this.over || this.freeze > 0) return;
    // copos que o chefe joga de volta
    for (let k = this.throws.length - 1; k >= 0; k--) {
      const th = this.throws[k];
      if (this.clock < th.at) continue;
      this.throws.splice(k, 1);
      const c = th.ref;
      if (c.state === 'gone') continue;
      this.items.push({ id: this.nextId++, kind: 'empty', lane: c.lane, s: c.s - 0.15, fast: th.fast });
      this.emit('throw', { lane: c.lane, p: this.pos(c.lane, c.s, CUP.y), boss: true });
    }
    // Seu Bocão troca de balcão
    const B = this.bossRef;
    if (B && B.type === 'bocao' && B.state !== 'gone' && B.state !== 'leaving') {
      if (!this.swapWarned && this.clock >= this.swapAt - BOCAO.warn) {
        const opts = this.angles.map((_, i) => i).filter(i => i !== B.lane);
        this.swapTo = this.rng.pick(opts);
        this.swapWarned = true;
        this.emit('boss-warn', { from: B.lane, to: this.swapTo, p: this.pos(this.swapTo, B.s, 1.4) });
      }
      if (this.clock >= this.swapAt) {
        // ele leva junto os copos cheios que vinham para ele (não tem ninguém para pegar lá)
        const old = B.lane;
        const others = this.catchers(old).filter(c => c !== B);
        const grabbed = this.items.filter(it => it.kind === 'cup' && it.lane === old && !others.some(c => c.s > it.s));
        if (grabbed.length) { this.items = this.items.filter(it => !grabbed.includes(it)); this.emit('boss-grab', { n: grabbed.length, p: this.pos(old, B.s, 1.2) }); }
        B.lane = this.swapTo;
        // quem estava no caminho é empurrado para trás dele
        for (const c of this.customers) if (c !== B && c.lane === B.lane && c.state !== 'gone' && Math.abs(c.s - B.s) < GAP * 1.6) c.s = Math.min(this.len, B.s + GAP * 1.6);
        this.swapAt = this.clock + BOCAO.swapEvery; this.swapWarned = false;
        this.emit('boss-swap', { lane: B.lane, p: this.pos(B.lane, B.s, 1.4) });
      }
    }
    const active = this.customers.some(c => c.state !== 'gone') || this.queue.length;
    // busca-pé
    if (this.clock >= this.nextFire) {
      this.nextFire = this.clock + this.L.fire * this.rng.range(0.8, 1.2);
      if (active) {
        const lane = Math.floor(this.rng.next() * this.angles.length);
        this.items.push({ id: this.nextId++, kind: 'fire', lane, s: this.len });
        this.emit('fire', { lane, p: this.pos(lane, this.len, CUP.y) });
      }
    }
    // gaivotas
    for (const g of this.gulls) { g.t -= DT; if (g.t <= 0) g.leave = true; }
    const gone = this.gulls.filter(g => g.leave);
    for (const g of gone) this.emit('gull-off', { lane: g.lane, p: this.pos(g.lane, g.s, 1.15) });
    if (gone.length) this.gulls = this.gulls.filter(g => !g.leave);
    if (this.clock >= this.nextGull) {
      this.nextGull = this.clock + this.L.gull * this.rng.range(0.8, 1.2);
      const free = this.angles.map((_, i) => i).filter(i => !this.gulls.some(g => g.lane === i));
      if (active && free.length) {
        const lane = this.rng.pick(free);
        const g = { lane, s: this.rng.range(1.3, this.len - 0.7), t: GULL.stay, leave: false };
        this.gulls.push(g);
        this.emit('gull', { lane, p: this.pos(lane, g.s, 1.15) });
      }
    }
  }

  loseLife(reason, lane, p) {
    if (this.over) return;
    this.lives--; this.livesLost++;
    this.emit('life', { reason, lane, lives: this.lives, p });
    if (this.lives <= 0) { this.finish(false); return; }
    // como no balcão de verdade: todo mundo dá uns passos para trás e os copos somem
    this.freeze = FREEZE;
    this.items = [];
    this.gulls = [];
    this.throws = [];
    for (const c of this.customers) {
      if (c.state === 'gone' || c.state === 'leaving') continue;
      c.state = 'walk'; c.t = this.rng.range(1.2, 2.0); c.pushLeft = 0;
      c.s = Math.max(c.s, this.len * 0.7);
    }
    for (const H of this.hands) H.holding = null;
  }

  checkEnd() {
    if (this.queue.length) return;
    if (this.customers.some(c => c.state !== 'gone')) return;
    this.finish(true);
  }

  finish(won) {
    this.over = true;
    const bonus = won ? this.lives * POINTS.life : 0;
    this.score += bonus;
    this.result = {
      won, stars: won ? starsFor(this.livesLost) : 0, score: this.score, bonus, time: this.t,
      livesLost: this.livesLost, lives: this.lives, served: this.served,
    };
    this.emit(won ? 'won' : 'lost', {});
  }

  // o que está no balcão (para a tela e o robô)
  snapshot() {
    return { items: this.items, customers: this.customers.filter(c => c.state !== 'gone'), gulls: this.gulls };
  }
}
