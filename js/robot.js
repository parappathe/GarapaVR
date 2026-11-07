// Robô que joga o Garapeiro com limites humanos: as duas mãos andam no máximo a HAND.speed,
// o empurrão do copo no máximo a HAND.push, as decisões só mudam a cada HAND.react segundos e a
// força do empurrão tem erro. Usado nos testes (prova que toda fase dá para vencer) e no
// dev.autoplay / demonstração do menu. Sem navegador.
import { DT, COUNTER, CUP, FILL, CATCH, SPEED, lanePoint, laneDir } from './sim.js';
import { Rng, clamp } from './vec.js';

export const HAND = { speed: 2.4, push: 2.6, react: 0.3, err: 0.08 };
const REST = [[-0.22, 1.08, -0.4], [0.22, 1.08, -0.4]];
const CATCH_S = 0.28;

export function makeRobot(seed = 7) {
  const rng = new Rng(seed);
  const R = {
    hands: [],
    reset() {
      this.hands = REST.map(p => ({ p: p.slice(), trig: false, task: null, wait: 0 }));
      this.think = 0;
    },
    step(game) {
      this.think -= DT;
      const decide = this.think <= 0;
      if (decide) this.think = HAND.react;
      const snap = game.snapshot();
      const out = [];
      for (let i = 0; i < 2; i++) {
        const H = this.hands[i];
        if (game.freeze > 0) { H.task = null; H.trig = false; }
        if (decide) this.plan(game, snap, i);
        this.act(game, H, i);
        out.push({ p: H.p.slice(), trig: H.trig, on: true, n: [0, 0, -1] });
      }
      return { hands: out };
    },

    // tempo até um objeto que vem para o jogador chegar ao ponto de pegar
    arrival(game, it) {
      const sp = it.kind === 'empty' ? game.W.empty * (it.fast || 1) : it.kind === 'coin' ? SPEED.coin : SPEED.fire;
      return (it.s - CATCH_S) / sp;
    },
    travel(H, target) { return Math.hypot(H.p[0] - target[0], H.p[1] - target[1], H.p[2] - target[2]) / HAND.speed; },

    plan(game, snap, i) {
      const H = this.hands[i], other = this.hands[1 - i];
      if (game.freeze > 0) return;
      // 1) pegar o que vem voltando (copo vazio, busca-pé, moeda)
      const taken = new Set(this.hands.filter(h => h.task?.kind === 'catch').map(h => h.task.id));
      const incoming = snap.items.filter(it => it.kind !== 'cup' && it.s > CATCH_S - 0.05 && !taken.has(it.id))
        .map(it => ({ it, t: this.arrival(game, it) })).sort((a, b) => (a.it.kind === 'coin') - (b.it.kind === 'coin') || a.t - b.t);
      const busy = H.task && H.task.kind === 'catch' && snap.items.some(it => it.id === H.task.id);
      if (!busy && incoming.length) {
        for (const { it, t } of incoming) {
          const target = lanePoint(game.angles[it.lane], CATCH_S, CUP.y);
          const mine = this.travel(H, target) + 0.08;
          const theirs = other.task?.kind === 'serve' && other.task.phase === 'fill' ? 9 : this.travel(other, target) + (other.task ? 0.25 : 0);
          // só larga um copo no meio se for preciso; a outra mão vai se estiver mais perto e livre
          const urgent = t < 1.4 || it.kind === 'fire';
          if (!urgent && H.task?.kind === 'serve') continue;
          if (mine > t + 0.05) continue;
          if (theirs + 0.05 < mine && !other.task && it.kind !== 'coin') continue;
          if (H.task?.kind === 'serve' && H.task.phase === 'stroke') continue;
          if (it.kind === 'coin' && t > 2.5) continue;
          H.task = { kind: 'catch', id: it.id, lane: it.lane };
          H.trig = false;
          return;
        }
      }
      if (H.task) return;
      // 2) servir: o balcão com o freguês mais apertado que ainda não tem copo indo para ele
      const choice = this.pickLane(game, snap, i);
      if (choice) H.task = { kind: 'serve', lane: choice.lane, target: choice.target, phase: 'go' };
    },

    pickLane(game, snap, i) {
      const other = this.hands[1 - i].task;
      let best = null;
      game.angles.forEach((_, lane) => {
        if (other?.kind === 'serve' && other.lane === lane) return;
        const row = snap.customers.filter(c => c.lane === lane).sort((a, b) => a.s - b.s);
        const catchers = row.filter(c => c.state === 'walk' || c.state === 'pause');
        const cups = snap.items.filter(it => it.kind === 'cup' && it.lane === lane).length;
        const fire = snap.items.find(it => it.kind === 'fire' && it.lane === lane);
        let need = catchers.length - cups;
        if (catchers.some(c => c.boss) && cups < 1) need = Math.max(need, 1);
        let target = null, urg = 99;
        if (fire && cups === 0) { target = fire.s; urg = fire.s / SPEED.fire - 1.5; }
        if (need > 0) {
          const c = catchers[cups] || catchers[0];
          const u = c.s / Math.max(0.05, c.speed);
          if (u < urg) { urg = u; target = c.s; }
        }
        if (target == null) return;
        // Seu Bocão vai trocar de balcão antes do copo chegar: não serve ele agora
        if (catchers.some(c => c.type === 'bocao') && game.swapAt - game.clock < 2.4 && target === catchers.find(c => c.type === 'bocao').s) return;
        // gaivota no caminho: espera ela ir embora
        const g = snap.gulls.find(g => g.lane === lane && g.s < target + 0.2 && g.t > 0.9);
        if (g) return;
        if (!best || urg < best.urg) best = { lane, target, urg };
      });
      return best;
    },

    moveTo(H, target, speed = HAND.speed) {
      const d = [target[0] - H.p[0], target[1] - H.p[1], target[2] - H.p[2]];
      const l = Math.hypot(...d), m = speed * DT;
      if (l <= m) { H.p = target.slice(); return true; }
      for (let k = 0; k < 3; k++) H.p[k] += d[k] / l * m;
      return false;
    },

    act(game, H, i) {
      const T = H.task;
      const gH = game.hands[i];
      if (!T) { H.trig = false; this.moveTo(H, REST[i]); return; }
      const az = game.angles[T.lane];
      if (T.kind === 'catch') {
        H.trig = false;
        const it = game.items.find(o => o.id === T.id);
        if (!it) { H.task = null; return; }
        this.moveTo(H, lanePoint(az, Math.min(CATCH_S, Math.max(0.05, it.s)), CUP.y));
        return;
      }
      if (T.phase === 'go') {
        H.trig = false;
        if (this.moveTo(H, lanePoint(az, 0.02, 1.12))) T.phase = 'fill';
        return;
      }
      if (T.phase === 'fill') {
        H.trig = true;
        if (gH.holding?.full) {
          // força para o copo chegar no alvo e ir um pouco além (o freguês anda até ele)
          const target = clamp(this.retarget(game, T), 0.4, game.len - 0.25);
          const v = Math.sqrt(2 * CUP.friction * (target + 0.35)) * (1 + (rng.next() * 2 - 1) * HAND.err);
          T.u = clamp(v / CUP.boost, 0.3, HAND.push);
          T.phase = 'back';
        } else if (!gH.holding && H.trig && game.hands[i].trig) {
          // não começou a encher: encosta mais na moenda
          this.moveTo(H, lanePoint(az, 0.0, 1.12));
        }
        return;
      }
      if (T.phase === 'back') {
        H.trig = true;
        if (this.moveTo(H, lanePoint(az, 0.0, CUP.y), HAND.speed)) { T.phase = 'stroke'; }
        return;
      }
      if (T.phase === 'stroke') {
        H.trig = true;
        const dir = laneDir(az);
        for (let k = 0; k < 3; k++) H.p[k] += dir[k] * T.u * DT;
        H.p[1] = CUP.y;
        const loc = Math.hypot(H.p[0], H.p[2]) - COUNTER.r0;
        if (loc >= 0.42) { H.trig = false; H.task = null; }
      }
    },
    retarget(game, T) {
      const catchers = game.catchers(T.lane);
      const cups = game.items.filter(it => it.kind === 'cup' && it.lane === T.lane).length;
      const fire = game.items.find(it => it.kind === 'fire' && it.lane === T.lane);
      const c = catchers[cups] || catchers[0];
      if (fire && (!c || fire.s < c.s)) return fire.s;
      return c ? c.s : T.target;
    },
  };
  R.reset();
  void FILL; void CATCH;
  return R;
}
