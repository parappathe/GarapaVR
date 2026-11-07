// Sons sintetizados na hora (sem arquivos), com áudio 3D (PannerNode HRTF) para o que acontece nos
// balcões, e uma musiquinha de baião por mundo (zabumba, triângulo e sanfona de onda quadrada).
// Só começa depois de um clique, tecla ou da entrada no VR (regra do navegador).
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// [baixo/zabumba (16 passos), melodia (16 passos), passos por segundo]
const SONGS = [
  [[43, 0, 0, 43, 0, 0, 50, 0, 43, 0, 0, 43, 0, 0, 47, 0], [74, 0, 76, 78, 79, 0, 78, 76, 74, 0, 71, 0, 74, 76, 74, 0], 7],
  [[41, 0, 0, 41, 0, 0, 48, 0, 36, 0, 0, 36, 0, 0, 43, 0], [72, 74, 76, 0, 77, 76, 74, 72, 70, 0, 72, 0, 74, 0, 72, 0], 7.5],
  [[45, 0, 0, 45, 0, 0, 52, 0, 41, 0, 0, 41, 0, 0, 48, 0], [76, 0, 79, 0, 81, 79, 76, 0, 77, 0, 76, 74, 72, 0, 74, 0], 6.5],
];

export class Sfx {
  constructor() { this.ctx = null; this.on = true; this.musicOn = true; this.last = {}; this.song = 0; this.playing = false; }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.on ? 0.9 : 0;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.09 : 0;
      this.musicBus.connect(this.master);
      this.step = 0; this.nextT = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 50);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.05); }
  setMusic(v) { this.musicOn = v; if (this.musicBus) this.musicBus.gain.setTargetAtTime(v ? 0.09 : 0, this.ctx.currentTime, 0.1); }
  setSong(i, playing) { this.song = i; this.playing = playing; }

  schedule() {
    const c = this.ctx;
    if (!c) return;
    const [bass, mel, rate] = SONGS[this.song];
    const dt = 1 / rate;
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.02;
    while (this.nextT < c.currentTime + 0.2) {
      const k = this.step % 16, t = this.nextT - c.currentTime;
      if (this.playing) {
        if (bass[k]) { this.tone(NOTE(bass[k]), dt * 0.8, { type: 'triangle', vol: 0.9, at: t, bus: this.musicBus, attack: 0.01 }); this.tone(70, 0.12, { type: 'sine', vol: 0.8, at: t, slide: 0.5, bus: this.musicBus }); }
        if (mel[k]) { this.tone(NOTE(mel[k]), dt * 0.7, { type: 'square', vol: 0.14, at: t, bus: this.musicBus }); this.tone(NOTE(mel[k] - 12), dt * 0.7, { type: 'sawtooth', vol: 0.05, at: t, bus: this.musicBus }); }
        // triângulo: aberto no tempo, abafado no contratempo
        this.tone(k % 2 ? 4200 : 5200, k % 2 ? 0.03 : 0.12, { type: 'sine', vol: k % 2 ? 0.08 : 0.14, at: t, bus: this.musicBus });
      }
      this.step++;
      this.nextT += dt;
    }
  }

  setListener(p, f, u) {
    const L = this.ctx?.listener;
    if (!L) return;
    if (L.positionX) {
      const t = this.ctx.currentTime;
      L.positionX.setValueAtTime(p.x, t); L.positionY.setValueAtTime(p.y, t); L.positionZ.setValueAtTime(p.z, t);
      L.forwardX.setValueAtTime(f.x, t); L.forwardY.setValueAtTime(f.y, t); L.forwardZ.setValueAtTime(f.z, t);
      L.upX.setValueAtTime(u.x, t); L.upY.setValueAtTime(u.y, t); L.upZ.setValueAtTime(u.z, t);
    } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z); }
  }
  out(pos, ref = 2, bus = null) {
    const c = this.ctx;
    if (bus) return bus;
    if (!pos) return this.master;
    const p = c.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
    p.refDistance = ref; p.maxDistance = 50; p.rolloffFactor = 0.8;
    if (p.positionX) { p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2]; }
    else p.setPosition(pos[0], pos[1], pos[2]);
    p.connect(this.master);
    return p;
  }
  tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, slide = 0, attack = 0.005, pos = null, ref, bus = null } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out(pos, ref, bus));
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, { vol = 0.1, freq = 1200, q = 1, at = 0, type = 'bandpass', pos = null, ref, slide = 0, bus = null } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    if (!this.nbuf) {
      this.nbuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this.nbuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.nbuf; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out(pos, ref, bus));
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  gate(key, gap) {
    const t = this.ctx?.currentTime ?? 0;
    if (t - (this.last[key] || -9) < gap) return false;
    this.last[key] = t;
    return true;
  }

  // ---------- jogo ----------
  // moenda girando enquanto enche (chamado a cada ~0,12 s)
  grind(pos) { if (this.gate('grind', 0.11)) { this.noise(0.12, { vol: 0.12, freq: 380, q: 2, pos, ref: 0.8 }); this.tone(1100 + Math.random() * 300, 0.06, { type: 'sine', vol: 0.03, pos, ref: 0.8 }); } }
  full(pos) { this.tone(NOTE(84), 0.12, { type: 'triangle', vol: 0.14, pos, ref: 0.8 }); this.tone(NOTE(91), 0.16, { type: 'triangle', vol: 0.1, at: 0.07, pos, ref: 0.8 }); }
  slide(v, pos) { const k = Math.min(1, v / 4); this.noise(0.25 + k * 0.4, { vol: 0.18, freq: 1600 + k * 1600, q: 1.5, slide: 0.5, pos, ref: 1 }); }
  spill(pos) { this.noise(0.4, { vol: 0.25, freq: 900, q: 0.7, slide: 0.4, pos, ref: 1 }); }
  serve(pos) { this.tone(NOTE(79), 0.1, { type: 'square', vol: 0.1, pos, ref: 3 }); this.noise(0.08, { vol: 0.15, freq: 3000, q: 3, pos, ref: 3 }); }
  gulp(pos) { [0, 0.18, 0.36].forEach(a => this.tone(220, 0.1, { type: 'sine', vol: 0.12, slide: 0.6, at: a, pos, ref: 3 })); this.tone(NOTE(76), 0.2, { type: 'triangle', vol: 0.06, at: 0.55, slide: 1.3, pos, ref: 3 }); }
  throwBack(pos) { this.noise(0.5, { vol: 0.14, freq: 2400, q: 2, slide: 0.6, pos, ref: 2 }); }
  catchCup(pos) { this.tone(NOTE(88), 0.08, { type: 'triangle', vol: 0.16, pos, ref: 0.6 }); this.tone(NOTE(95), 0.1, { type: 'sine', vol: 0.08, at: 0.03, pos, ref: 0.6 }); }
  coin(pos) { [83, 88].forEach((n, i) => this.tone(NOTE(n), i ? 0.35 : 0.08, { type: 'square', vol: 0.12, at: i * 0.08, pos, ref: 1 })); }
  leave(pos) { [72, 76, 79].forEach((n, i) => this.tone(NOTE(n), 0.1, { type: 'triangle', vol: 0.08, at: i * 0.06, pos, ref: 3 })); }
  arrive(pos) { if (this.gate('arrive', 0.3)) this.tone(NOTE(67), 0.15, { type: 'triangle', vol: 0.06, pos, ref: 3 }); }
  fuse(pos) { this.noise(0.6, { vol: 0.12, freq: 5000, q: 1, pos, ref: 2 }); }
  fireOut(pos) { this.noise(0.5, { vol: 0.3, freq: 2500, q: 0.6, slide: 0.3, pos, ref: 2 }); }
  boom(pos) { this.noise(0.9, { vol: 0.7, freq: 700, q: 0.6, type: 'lowpass', slide: 0.2, pos, ref: 2 }); this.tone(90, 0.6, { type: 'sine', vol: 0.5, slide: 0.4, pos, ref: 2 }); }
  gull(pos) { [0, 0.15].forEach(a => this.tone(1400, 0.14, { type: 'sawtooth', vol: 0.05, slide: 0.7, at: a, pos, ref: 3 })); }
  steal(pos) { this.gull(pos); this.noise(0.2, { vol: 0.2, freq: 1500, q: 1, pos, ref: 2 }); }
  life() { [67, 63, 60, 55].forEach((n, i) => this.tone(NOTE(n), 0.22, { type: 'square', vol: 0.12, at: i * 0.14, slide: 0.95 })); this.noise(0.3, { vol: 0.4, freq: 2000, q: 0.8 }); }
  bossIn(pos) { [48, 48, 55, 48].forEach((n, i) => this.tone(NOTE(n), 0.25, { type: 'sawtooth', vol: 0.15, at: i * 0.22, pos, ref: 4 })); }
  bossHit(pos) { this.tone(140, 0.25, { type: 'sawtooth', vol: 0.22, slide: 0.6, pos, ref: 4 }); this.gulp(pos); }
  bossWarn(pos) { [0, 0.25, 0.5].forEach(a => this.tone(NOTE(81), 0.12, { type: 'square', vol: 0.1, at: a, pos, ref: 3 })); }
  bossDown(pos) { [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), 0.3, { type: 'square', vol: 0.12, at: 0.2 + i * 0.09, pos, ref: 4 })); }
  coinStart() { [83, 88].forEach((n, i) => this.tone(NOTE(n), i ? 0.4 : 0.08, { type: 'square', vol: 0.12, at: i * 0.08 })); }
  won() { [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => this.tone(NOTE(n), 0.22, { type: 'square', vol: 0.12, at: i * 0.12 })); }
  lost() { [67, 66, 65, 64, 52].forEach((n, i) => this.tone(NOTE(n), i === 4 ? 0.8 : 0.25, { type: 'square', vol: 0.12, at: i * 0.22 })); }
  click() { this.tone(880, 0.05, { vol: 0.07, type: 'square' }); }
  star(n) { this.tone(NOTE(84 + n * 4), 0.3, { vol: 0.12, type: 'triangle' }); }
}
