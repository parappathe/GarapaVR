// Liga as regras (sim.js) à tela, ao Quest (controles e mãos) e ao mouse/teclado.
import * as THREE from '../vendor/three/three.module.js';
import { Game, DT, LIVES, COUNTER, CUP, FILL, lanePoint, locate } from './sim.js';
import { LEVELS, WORLDS, LEVELS_PER_WORLD } from './levels.js';
import { makeRobot } from './robot.js';
import { buildWorld, buildCounters, CustomerView, ItemView, GullView, buildHand, setCupFill, Particles, THEMES } from './scene.js';
import { Panel, Label, C as UI } from './ui.js';
import { Sfx } from './audio.js';
import { loadSave, storeSave, rankOf, addScore } from './save.js';

const save = loadSave();
const sfx = new Sfx();
sfx.on = save.sound;
sfx.musicOn = save.music;
const IS_QUEST = /OculusBrowser|Quest/i.test(navigator.userAgent);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SIDES = ['left', 'right'];
const BOSS_NAME = { bus: 'Excursão', boi: 'Boi-Bumbá', bocao: 'Seu Bocão' };
const LIFE_MSG = {
  'cup-fell': 'O copo passou do fim do balcão e caiu!',
  'empty-fell': 'Um copo vazio caiu no chão!',
  reached: 'Um freguês chegou na moenda bravo!',
  'boss-reached': 'O chefe chegou na moenda!',
  fire: 'O busca-pé estourou na barraca!',
};

// ---------- Render e cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_QUEST ? 1 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation?.(1);
document.getElementById('app').appendChild(renderer.domElement);

const world = buildWorld();
const { scene } = world;
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.03, 120);
const rig = new THREE.Group();
scene.add(rig);
rig.add(camera);
const PC_CAM = new THREE.Vector3(0, 1.9, 0.6);

const customersView = new CustomerView(scene);
const itemsView = new ItemView(scene, world.glowTex);
const gullsView = new GullView(scene);
const particles = new Particles(scene);
const hands = [buildHand('#f0e0c8'), buildHand('#f0e0c8')];
for (const h of hands) { h.group.visible = false; scene.add(h.group); }
let counters = null, countersKey = '';

const panel = new Panel(0.9);
const fpsLabel = new Label(0.12);
fpsLabel.mesh.position.set(0.16, -0.14, -0.6);
fpsLabel.mesh.visible = false;
camera.add(fpsLabel.mesh);
const msgLabel = new Label(0.9, 1024, 128);
scene.add(msgLabel.mesh);
msgLabel.mesh.visible = false;

// ---------- Estado ----------
let app = 'menu';            // 'menu' | 'playing' | 'paused' | 'done' | 'initials'
let mode = 'level';          // 'level' | 'arcade'
let level = 0;
let game = null;
let robot = makeRobot();
let demo = true;
let msg = null;
let doneTimer = 0;
let lastResult = null, newRecord = false;
const arcade = { score: 0, lives: LIVES, rank: -1, over: false, letters: [0, 0, 0], slot: 0 };
const unlocked = (i) => i === 0 || !!save.done[i - 1];
const nextLevel = () => { let n = 0; while (n < LEVELS.length - 1 && save.done[n]) n++; return n; };
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function newGame(lv, opts = {}) {
  level = clamp(lv, 0, LEVELS.length - 1);
  const L = LEVELS[level];
  world.setTheme(L.world);
  customersView.setTheme(L.world);
  game = new Game(level, opts);
  const key = `${L.world}:${L.lanes}:${L.len}`;
  if (key !== countersKey) {
    if (counters) scene.remove(counters);
    counters = buildCounters(game.angles, game.len, THEMES[L.world]);
    scene.add(counters);
    countersKey = key;
  }
  robot.reset();
  acc = 0;
  sfx.setSong(L.world, !demo);
}

function startLevel(lv, m = mode) {
  mode = m;
  demo = false;
  arcade.counted = false;
  newGame(lv, { seed: Math.floor(Math.random() * 1e6), lives: mode === 'arcade' ? arcade.lives : LIVES });
  app = 'playing';
  doneTimer = 0;
  panel.hide();
  const L = LEVELS[level], W = WORLDS[L.world];
  const head = level % LEVELS_PER_WORLD === 0 ? `${W.name}. ${W.hint}` : L.boss ? `Chefe: ${L.name}!` : `Fase ${level + 1}: ${L.name}`;
  showMsg(head, 5, '#fbf6e6');
  sfx.coinStart();
  updateHint();
}
function startArcade() { arcade.score = 0; arcade.lives = LIVES; arcade.rank = -1; arcade.over = false; startLevel(0, 'arcade'); }
function togglePause() {
  if (app === 'playing') { app = 'paused'; showScreen('pause'); }
  else if (app === 'paused') { app = 'playing'; panel.hide(); }
  sfx.setSong(LEVELS[level].world, app === 'playing');
  updateHint();
}
function goMenu() {
  app = 'menu';
  demo = !renderer.xr.isPresenting;
  newGame(nextLevel(), { seed: Math.floor(Math.random() * 1e6) });
  showScreen('main');
  updateHint();
}
function showMsg(text, t = 2, color = '#ffe14a') { msg = { text, t, color }; }
const pad6 = (n) => String(Math.max(0, Math.round(n))).padStart(6, '0');
const totalStars = () => Object.values(save.done).reduce((s, d) => s + (d.stars || 0), 0);

// ---------- Menus ----------
function showScreen(name) {
  const vr = renderer.xr.isPresenting;
  placePanel();
  panel.show((p) => {
    if (name === 'main') {
      p.title('Garapeiro', 76, 76);
      p.text('Encha o copo de garapa na moenda e deslize pelo balcão até o freguês.', 512, 136, { size: 25, color: UI.dim });
      const next = nextLevel();
      p.button(save.done[0] ? `Continuar: fase ${next + 1}` : 'Começar', () => startLevel(next, 'level'), 262, 172, 500, 86, { size: 38 });
      p.button('Fliperama (as 12 seguidas)', () => startArcade(), 262, 272, 500, 74, { size: 30 });
      p.button('Escolher fase', () => showScreen('levels'), 262, 360, 245, 70, { size: 28 });
      p.button('Recordes', () => showScreen('scores'), 517, 360, 245, 70, { size: 28 });
      p.button('Como jogar', () => showScreen('help'), 262, 444, 500, 66, { size: 28 });
      const opt = (label, key, x, after) => p.button(`${label}: ${save[key] ? 'sim' : 'não'}`, () => { save[key] = !save[key]; storeSave(save); after?.(); showScreen('main'); }, x, 526, 220, 60, { size: 24 });
      opt('Som', 'sound', 152, () => sfx.setOn(save.sound));
      opt('Música', 'music', 402, () => sfx.setMusic(save.music));
      opt('FPS', 'fps', 652);
      p.text(`Estrelas: ${totalStars()} de ${LEVELS.length * 3}${save.scores[0] ? `   ·   Recorde: ${save.scores[0].name} ${save.scores[0].score}` : ''}`, 512, 622, { size: 25, color: UI.star });
      p.text(vr ? 'Aponte e aperte o gatilho para escolher' : 'No Quest: abra esta página no navegador do óculos e aperte "Entrar em VR"', 512, 670, { size: 21, color: UI.dim });
    } else if (name === 'levels') {
      p.title('Escolher fase', 56, 48);
      WORLDS.forEach((W, w) => {
        const y = 100 + w * 190;
        p.text(W.name, 512, y + 6, { size: 26, bold: true, color: ['#ffb05a', '#5ab0ff', '#ff6ab8'][w] });
        for (let k = 0; k < LEVELS_PER_WORLD; k++) {
          const i = w * LEVELS_PER_WORLD + k, L = LEVELS[i], d = save.done[i];
          p.tile(112 + k * 205, y + 26, 190, 140, { num: i + 1, name: L.boss ? `Chefe: ${L.name}` : L.name, stars: d?.stars || 0, done: !!d, locked: !unlocked(i), master: !!L.boss, action: () => startLevel(i, 'level') });
        }
      });
      p.button('Voltar', () => showScreen(app === 'paused' ? 'pause' : 'main'), 362, 652, 300, 56, { size: 28 });
    } else if (name === 'scores') {
      p.title('Recordes do fliperama', 60, 50);
      if (!save.scores.length) p.text('Ninguém ainda. Jogue o Fliperama: as 12 fases seguidas!', 512, 300, { size: 28, color: UI.dim });
      save.scores.forEach((e, i) => {
        const y = 130 + i * 56, hl = mode === 'arcade' && arcade.over && i === arcade.rank;
        p.text(`${i + 1}.`, 250, y, { size: 34, bold: true, color: hl ? UI.edge : UI.dim, align: 'right' });
        p.text(e.name, 300, y, { size: 38, bold: true, color: hl ? UI.edge : UI.text, align: 'left' });
        p.text(pad6(e.score), 620, y, { size: 38, bold: true, color: hl ? UI.edge : UI.star, align: 'right' });
        p.text(e.level >= 12 ? 'zerou!' : `fase ${e.level}`, 660, y, { size: 26, color: UI.dim, align: 'left' });
      });
      p.button('Fliperama', () => startArcade(), 262, 588, 245, 80, { size: 30 });
      p.button('Voltar', () => showScreen('main'), 517, 588, 245, 80, { size: 30 });
    } else if (name === 'help') {
      p.title('Como jogar', 56);
      const rows = vr ? [
        'Segure o gatilho com a mão embaixo da moenda (anel amarelo) até o copo encher.',
        'Ainda segurando, empurre a mão para a frente sobre o balcão e solte.',
        'Empurrão forte vai longe; fraco para no meio. Passou do fim: o copo cai!',
        'Encoste a mão nos copos vazios e moedas que voltam. As duas mãos servem.',
      ] : [
        'Clique e segure no anel amarelo embaixo da moenda até o copo encher.',
        'Ainda segurando, arraste o mouse para a frente (para cima) e solte.',
        'Arrasto rápido vai longe; devagar para no meio. Passou do fim: o copo cai!',
        'Passe o mouse na ponta do balcão para pegar copos vazios e moedas.',
      ];
      rows.forEach((t, i) => p.text(t, 50, 112 + i * 46, { size: 23, align: 'left' }));
      const sp = [
        ['Freguês empurrado até a porta vai embora', '#fbf6e6'], ['Sedento: volta pouco, pede mais', '#ffb05a'],
        ['Apressado: anda rápido', '#5ab0ff'], ['Gorjeta: moeda vale 500', '#ffe14a'],
        ['Busca-pé: apague com um copo ou a mão', '#ff6a5a'], ['Gaivota: rouba o copo que passa', '#e8e8f0'],
      ];
      sp.forEach(([t, c], i) => p.text(t, 70 + (i % 2) * 460, 316 + Math.floor(i / 2) * 50, { size: 23, align: 'left', color: c }));
      p.text('Perde vida: freguês na moenda, copo no chão ou busca-pé estourado. 3 estrelas sem perder vida.', 512, 490, { size: 20, color: UI.dim });
      p.text('Chefes na 4ª fase de cada mundo.', 512, 530, { size: 22, color: UI.dim });
      p.button('Voltar', () => showScreen(app === 'paused' ? 'pause' : 'main'), 362, 600, 300, 76);
    } else if (name === 'pause') {
      p.title('Pausa', 64);
      p.text(`Fase ${level + 1}: ${LEVELS[level].name}${mode === 'arcade' ? '  ·  fliperama' : ''}`, 512, 122, { size: 28, color: UI.dim });
      p.button('Continuar', () => togglePause(), 262, 160, 500, 84);
      p.button(mode === 'arcade' ? 'Recomeçar o fliperama' : 'Recomeçar a fase', () => (mode === 'arcade' ? startArcade() : startLevel(level)), 262, 258, 500, 80, { size: 30 });
      p.button('Recentralizar', () => { recenter(); togglePause(); }, 262, 352, 245, 80, { size: 28, locked: !vr });
      p.button('Como jogar', () => showScreen('help'), 517, 352, 245, 80, { size: 28 });
      p.button(`Som: ${save.sound ? 'sim' : 'não'}`, () => { save.sound = !save.sound; storeSave(save); sfx.setOn(save.sound); showScreen('pause'); }, 262, 446, 245, 72, { size: 26 });
      p.button(`Música: ${save.music ? 'sim' : 'não'}`, () => { save.music = !save.music; storeSave(save); sfx.setMusic(save.music); showScreen('pause'); }, 517, 446, 245, 72, { size: 26 });
      p.button('Menu principal', () => goMenu(), 262, 560, 500, 80);
    } else if (name === 'done') {
      const r = lastResult, d = save.done[level];
      if (r.won) {
        p.title(newRecord ? 'Freguesia satisfeita! Recorde!' : 'Freguesia satisfeita!', 66, 50);
        p.stars(r.stars, 512, 140, 74);
        p.text(`Atendidos ${r.served}  ·  vidas perdidas ${r.livesLost}  ·  tempo ${r.time.toFixed(0)} s`, 512, 212, { size: 28 });
        p.text(`Pontos ${r.score}  (bônus ${r.bonus})`, 512, 256, { size: 34, bold: true, color: UI.edge });
        p.text('3 estrelas sem perder vida · 2 perdendo uma', 512, 298, { size: 21, color: UI.dim });
        if (d) p.text(`Melhor: ${d.stars} estrela${d.stars === 1 ? '' : 's'} · ${d.score} pontos`, 512, 332, { size: 22, color: UI.dim });
      } else {
        p.title(mode === 'arcade' ? 'Fim de jogo' : 'Acabaram as vidas', 70, 58);
        p.text(`Faltaram ${game.left} fregueses`, 512, 160, { size: 32, color: UI.red });
        p.text('Dica: não mande copo onde não tem ninguém esperando.', 512, 214, { size: 25 });
      }
      if (mode === 'arcade') {
        p.text(`Fliperama: ${pad6(arcade.score)} pontos  ·  vidas ${arcade.lives}`, 512, 384, { size: 30, bold: true, color: UI.star });
        if (r.won && level < LEVELS.length - 1) p.button('Próxima fase', () => startLevel(level + 1, 'arcade'), 262, 420, 500, 92, { size: 38 });
        else p.button('Recordes', () => showScreen('scores'), 262, 420, 500, 92, { size: 38 });
        p.button('Menu principal', () => goMenu(), 262, 540, 500, 78);
      } else {
        if (level < LEVELS.length - 1) p.button('Próxima fase', () => startLevel(level + 1, 'level'), 262, 372, 500, 90, { size: 36, locked: !unlocked(level + 1) });
        else if (r.won) p.text('Você matou a sede da feira inteira!', 512, 416, { size: 34, bold: true, color: UI.edge });
        p.button(r.won ? 'Repetir' : 'Tentar de novo', () => startLevel(level, 'level'), 262, 478, 245, 80);
        p.button('Fases', () => showScreen('levels'), 517, 478, 245, 80);
        p.button('Menu principal', () => goMenu(), 262, 576, 500, 78);
      }
    } else if (name === 'initials') {
      p.title('Novo recorde!', 70, 60);
      p.text(`${pad6(arcade.score)} pontos  ·  ${arcade.rank + 1}º lugar`, 512, 140, { size: 34, bold: true, color: UI.star });
      p.text('Escolha suas 3 letras', 512, 190, { size: 26, color: UI.dim });
      for (let k = 0; k < 3; k++) {
        const x = 292 + k * 160;
        p.button('▲', () => { arcade.letters[k] = (arcade.letters[k] + 1) % LETTERS.length; showScreen('initials'); }, x, 220, 120, 70, { size: 36 });
        p.text(LETTERS[arcade.letters[k]], x + 60, 345, { size: 96, bold: true, color: UI.edge });
        p.button('▼', () => { arcade.letters[k] = (arcade.letters[k] + LETTERS.length - 1) % LETTERS.length; showScreen('initials'); }, x, 400, 120, 70, { size: 36 });
      }
      p.button('Gravar', () => {
        const nm = arcade.letters.map(i => LETTERS[i]).join('');
        save.name = nm;
        addScore(save, nm, arcade.score, arcade.reached);
        storeSave(save);
        app = 'done';
        updateHint();
        showScreen('scores');
      }, 262, 520, 500, 90, { size: 40 });
      p.text(vr ? 'Aponte e aperte o gatilho' : 'Teclado: digite as letras (Enter grava)', 512, 650, { size: 22, color: UI.dim });
    }
  });
}

function placePanel() {
  if (renderer.xr.isPresenting) {
    if (panel.mesh.parent !== scene) scene.add(panel.mesh);
    panel.mesh.scale.setScalar(1);
    const e = new THREE.Euler().setFromQuaternion(xrHeadQuat(), 'YXZ');
    const head = xrHeadPos();
    panel.mesh.position.set(head.x - Math.sin(e.y) * 1.1, head.y - 0.05, head.z - Math.cos(e.y) * 1.1);
    panel.mesh.rotation.set(0, e.y, 0);
    return;
  }
  if (panel.mesh.parent !== camera) camera.add(panel.mesh);
  const half = THREE.MathUtils.degToRad(camera.fov / 2);
  const visH = 2 * 0.8 * Math.tan(half), visW = visH * camera.aspect;
  panel.mesh.position.set(0, 0, -0.8);
  panel.mesh.rotation.set(0, 0, 0);
  panel.mesh.scale.setScalar(Math.min(1, visW * 0.94 / 0.9, visH * 0.92 / 0.633));
}

function finishLevel() {
  const r = game.result;
  lastResult = r;
  const prev = save.done[level];
  newRecord = false;
  if (r.won) {
    newRecord = !!prev && r.score > prev.score;
    save.done[level] = { stars: Math.max(r.stars, prev?.stars || 0), score: Math.max(r.score, prev?.score || 0), time: Math.min(r.time, prev?.time ?? 1e9) };
    storeSave(save);
  }
  if (mode === 'arcade') {
    arcade.score += r.score;
    arcade.counted = true;
    arcade.lives = r.lives + (r.won && LEVELS[level].boss ? 1 : 0);
    arcade.reached = r.won ? level + 2 : level + 1;
    if (!r.won || level === LEVELS.length - 1) {
      arcade.over = true;
      arcade.rank = rankOf(save, arcade.score);
      if (arcade.rank >= 0) {
        arcade.letters = [...(save.name || 'AAA')].map(ch => Math.max(0, LETTERS.indexOf(ch)));
        app = 'initials';
        showScreen('initials');
        updateHint();
        return;
      }
    }
  }
  app = 'done';
  showScreen('done');
  for (let k = 0; k < r.stars; k++) setTimeout(() => sfx.star(k), 300 + k * 220);
  updateHint();
}

// ---------- Controles do VR ----------
const ctrls = [];
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
for (let i = 0; i < 2; i++) {
  const ctrl = renderer.xr.getController(i);
  rig.add(ctrl);
  const laser = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xffe14a }));
  laser.visible = false;
  ctrl.add(laser);
  const entry = { ctrl, laser, source: null, side: null, prevButtons: [], hoverIndex: -1, select: false, squeeze: false };
  ctrls.push(entry);
  ctrl.addEventListener('connected', (e) => { entry.source = e.data; entry.side = e.data.handedness; });
  ctrl.addEventListener('disconnected', () => { entry.source = null; entry.side = null; entry.select = entry.squeeze = false; });
  ctrl.addEventListener('selectstart', () => { entry.select = true; onSelect(entry); });
  ctrl.addEventListener('selectend', () => { entry.select = false; });
  ctrl.addEventListener('squeezestart', () => { entry.squeeze = true; });
  ctrl.addEventListener('squeezeend', () => { entry.squeeze = false; });
}
const entryFor = (side) => ctrls.find(e => e.side === side && e.source);
function pulse(side, v, ms) { try { entryFor(side)?.source?.gamepad?.hapticActuators?.[0]?.pulse?.(clamp(v, 0, 1), ms); } catch { /* sem vibração */ } }
const both = (v, ms) => { pulse('left', v, ms); pulse('right', v, ms); };
function onSelect(entry) {
  sfx.unlock();
  if (panel.visible && entry.hoverIndex >= 0) { const a = panel.actionAt(entry.hoverIndex); if (a) { sfx.click(); a(); } }
}
function pollButtons() {
  for (const e of ctrls) {
    const gp = e.source?.gamepad;
    if (!gp || e.source.hand) continue;
    const b = gp.buttons.map(x => x.pressed);
    if (b[5] && !e.prevButtons[5] && (app === 'playing' || app === 'paused')) togglePause();
    e.prevButtons = b;
  }
}

// ---------- VR: sessão e recentralizar ----------
let recenterIn = 0;
function xrHeadPos() { return renderer.xr.isPresenting ? renderer.xr.getCamera().getWorldPosition(new THREE.Vector3()) : camera.getWorldPosition(new THREE.Vector3()); }
function xrHeadQuat() { return renderer.xr.isPresenting ? renderer.xr.getCamera().getWorldQuaternion(new THREE.Quaternion()) : camera.getWorldQuaternion(new THREE.Quaternion()); }
function recenter() {
  if (!renderer.xr.isPresenting) return;
  // cabeça em x = 0, z = 0 olhando para os balcões; a altura fica
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  rig.rotation.set(0, -e.y, 0);
  const head = camera.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -e.y);
  rig.position.set(-head.x, 0, -head.z);
  if (panel.visible) placePanel();
}
renderer.xr.addEventListener('sessionstart', () => {
  recenterIn = 6;
  camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
  if (app === 'menu') goMenu();
  if (panel.visible) setTimeout(placePanel, 150);
  updateHint();
});
renderer.xr.addEventListener('sessionend', () => {
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  if (app === 'menu') goMenu();
  if (panel.visible) placePanel();
  onResize();
  updateHint();
});

// ---------- Mouse e teclado (PC) ----------
const mouse = { ndc: new THREE.Vector2(0, -0.3), has: false, down: false };
const raycaster = new THREE.Raycaster();
const canvas = renderer.domElement;
const handPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(CUP.y + 0.02));
const pc = { raw: null, lastRaw: null, v: [0, 0, 0] };
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  mouse.ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  mouse.has = true;
  if (panel.visible) {
    raycaster.setFromCamera(mouse.ndc, camera);
    const a = panel.actionAt(panel.pick(raycaster.intersectObject(panel.mesh)[0]?.uv));
    if (a) { sfx.click(); a(); }
    return;
  }
  if (e.button === 0) mouse.down = true;
});
window.addEventListener('pointerup', (e) => { if (e.button === 0) mouse.down = false; });
canvas.addEventListener('pointermove', (e) => {
  mouse.ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  mouse.has = true;
});
window.addEventListener('blur', () => { mouse.down = false; });
window.addEventListener('keydown', (e) => {
  sfx.unlock();
  const k = e.key.toLowerCase();
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  if (app === 'initials') {
    if (/^[a-z0-9]$/.test(k)) { arcade.letters[arcade.slot] = LETTERS.indexOf(k.toUpperCase()); arcade.slot = (arcade.slot + 1) % 3; showScreen('initials'); }
    else if (k === 'enter') panel.buttons.at(-1)?.action?.();
    return;
  }
  if (e.repeat) return;
  if (k === 'escape' || k === 'p') { if (app === 'playing' || app === 'paused') togglePause(); return; }
  if (k === 'f') { save.fps = !save.fps; storeSave(save); }
});
function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (panel.visible) placePanel();
}
window.addEventListener('resize', onResize);

// mão do PC: o mouse aponta um ponto no plano dos balcões; a mão fica no balcão mais perto e
// não passa do alcance (como no VR). A força do arrasto vem do ponto sem limite.
function updatePcHand(dt) {
  raycaster.setFromCamera(mouse.ndc, camera);
  const hit = raycaster.ray.intersectPlane(handPlane, _v);
  if (!hit) return null;
  const raw = [hit.x, hit.y, hit.z];
  if (pc.lastRaw) {
    const k = Math.min(1, dt * 25);
    for (let j = 0; j < 3; j++) pc.v[j] += ((raw[j] - pc.lastRaw[j]) / Math.max(1e-4, dt) - pc.v[j]) * k;
  }
  pc.lastRaw = raw;
  const H = game?.hands[1];
  const loc = locate(raw, game.angles);
  const lane = H?.holding ? H.holding.lane : loc.lane;
  const az = game.angles[lane];
  const s = clamp(loc.s, -0.1, 0.85);
  const p = lanePoint(az, s, CUP.y + 0.02);
  const sp = Math.hypot(pc.v[0], pc.v[2]);
  const v = sp > 4 ? pc.v.map(x => x * 4 / sp) : pc.v.slice();
  return { p, trig: mouse.down, on: true, v, reach: 0.26 };
}

// ---------- Entrada para o jogo ----------
let pcInput = null;
function vrHandPose(i) {
  const e = entryFor(SIDES[i]);
  if (!e) return { on: false };
  e.ctrl.updateMatrixWorld(true);
  _v.set(0, -0.01, -0.04).applyMatrix4(e.ctrl.matrixWorld);
  return { p: [_v.x, _v.y, _v.z], trig: e.select || e.squeeze, on: true };
}
let poseNow = [{ on: false }, { on: false }], posePrev = poseNow;
function readPoses() {
  posePrev = poseNow;
  if (app !== 'playing' || dev.autoplay || demo) poseNow = [{ on: false }, { on: false }];
  else if (renderer.xr.isPresenting) poseNow = [vrHandPose(0), vrHandPose(1)];
  else poseNow = [{ on: false }, pcInput || { on: false }];
}
const lerpA = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);
function buildInput(f) {
  if (dev.autoplay || demo) return robot.step(game);
  return { hands: poseNow.map((b, i) => { const a = posePrev[i]; return !b.on || !a.on ? b : { ...b, p: lerpA(a.p, b.p, f) }; }) };
}

// mãos (luvas) e o copo que estão enchendo
function placeHands(vr) {
  for (let i = 0; i < 2; i++) {
    const h = hands[i], g = h.group;
    let p = null;
    if (dev.autoplay || demo) p = robot.hands[i]?.p;
    else if (vr) { const e = entryFor(SIDES[i]); if (e) { e.ctrl.updateMatrixWorld(true); _v.set(0, -0.01, -0.04).applyMatrix4(e.ctrl.matrixWorld); p = [_v.x, _v.y, _v.z]; } }
    else if (i === 1 && app !== 'menu') p = pcInput?.p;
    g.visible = !!p && !(demo && vr);
    if (!p) continue;
    g.position.set(p[0], p[1], p[2]);
    const loc = locate(p, game.angles);
    g.rotation.set(0, -game.angles[loc.lane] * Math.PI / 180, 0);
    const H = game.hands[i].holding;
    h.cup.visible = !!H;
    if (H) setCupFill(h.cup, H.fill);
  }
}

function updatePcCamera() {
  if (renderer.xr.isPresenting) return;
  camera.position.copy(PC_CAM);
  camera.lookAt(0, 0.8, -2.2);
}

// ---------- Raios do menu ----------
const rayOrigin = new THREE.Vector3(), rayDir = new THREE.Vector3();
function updateMenuRays() {
  const vr = renderer.xr.isPresenting;
  let hover = -1;
  for (const e of ctrls) {
    e.hoverIndex = -1;
    e.laser.visible = false;
    if (!vr || !e.source || !panel.visible) continue;
    e.ctrl.getWorldPosition(rayOrigin);
    e.ctrl.getWorldQuaternion(_q);
    rayDir.set(0, 0, -1).applyQuaternion(_q);
    raycaster.set(rayOrigin, rayDir);
    const hit = raycaster.intersectObject(panel.mesh)[0];
    e.laser.visible = true;
    e.laser.scale.z = hit ? hit.distance : 1.2;
    e.hoverIndex = panel.pick(hit?.uv);
    if (e.hoverIndex >= 0) hover = e.hoverIndex;
  }
  if (!vr && panel.visible) {
    raycaster.setFromCamera(mouse.ndc, camera);
    hover = panel.pick(raycaster.intersectObject(panel.mesh)[0]?.uv);
    canvas.style.cursor = hover >= 0 && panel.actionAt(hover) ? 'pointer' : 'default';
  } else if (!vr) canvas.style.cursor = app === 'playing' ? 'none' : 'default';
  if (panel.visible) panel.setHover(hover);
}

// ---------- HUD ----------
const hintEl = document.getElementById('hint');
const hudEl = document.getElementById('hud');
const msgEl = document.getElementById('msg');
const fpsEl = document.getElementById('fps');
function updateHint() {
  if (renderer.xr.isPresenting) { hintEl.textContent = ''; return; }
  hintEl.innerHTML = app === 'playing'
    ? '<span>Segure o clique no anel da moenda até encher · arraste para cima e solte · passe na ponta para pegar copos vazios · Esc: pausa</span>'
    : app === 'initials' ? '<span>Digite as 3 letras e aperte Enter</span>' : '<span>Clique nas opções do painel</span>';
}
function bossBar() {
  const B = game.bossRef;
  if (!B) return null;
  const k = Math.round(10 * Math.max(0, B.hp) / B.maxHp);
  return `${BOSS_NAME[B.type].toUpperCase()} ${'■'.repeat(k)}${'□'.repeat(10 - k)}`;
}
function updateBoard() {
  if (!game || (app === 'menu' && !demo)) { world.setBoard([{ text: 'GARAPEIRO', x: 512, align: 'center', size: 76, color: '#ffe14a' }]); return; }
  if (app === 'menu') {
    const best = save.scores[0];
    world.setBoard([
      { text: 'GARAPEIRO', x: 30, size: 62, color: '#ffe14a' },
      { text: best ? `RECORDE ${best.name} ${pad6(best.score)}` : 'INSIRA FICHA', x: 994, align: 'right', size: 44, color: '#ff6ab8' },
    ]);
    return;
  }
  const score = mode === 'arcade' ? arcade.score + (arcade.counted ? 0 : game.score) : game.score;
  const bb = bossBar();
  const left = bb || (game.boss === 'bus' ? `EXCURSÃO ${game.left}` : `FASE ${level + 1}`);
  world.setBoard([
    { text: left, x: 26, size: bb ? 36 : 50, color: game.boss ? '#ff6ab8' : '#5ff2e0' },
    { text: pad6(score), x: 610, align: 'center', size: 70, color: '#ffe14a' },
    { text: '♥'.repeat(Math.max(0, game.lives)), x: 1000, align: 'right', size: 56, color: '#ff5a6a' },
  ]);
}
function updateHud(dt) {
  const vr = renderer.xr.isPresenting;
  const playing = (app === 'playing' || app === 'done' || app === 'paused') && !!game && !demo;
  if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
  updateBoard();
  if (!vr) {
    msgLabel.mesh.visible = false;
    hudEl.style.display = playing ? 'block' : 'none';
    if (playing) {
      const L = LEVELS[level];
      const html = `<b>${level + 1}. ${L.name}</b><br><em>${WORLDS[L.world].name}${mode === 'arcade' ? ' · fliperama' : ''}</em>`
        + `<div>Tempo ${Math.floor(game.result?.time ?? game.t)} s · faltam ${game.left} fregueses</div>`
        + `<div>Vidas ${'♥'.repeat(Math.max(0, game.lives))}</div>`
        + (game.bossRef && game.bossRef.state !== 'gone' ? `<div style="color:#ff6ab8">${BOSS_NAME[game.bossRef.type]}: faltam ${game.bossRef.hp} copos</div>` : '');
      if (hudEl.dataset.last !== html) { hudEl.innerHTML = html; hudEl.dataset.last = html; }
    }
    const mtxt = msg && playing ? msg.text : '';
    if (msgEl.dataset.last !== mtxt) { msgEl.textContent = mtxt; msgEl.style.color = msg?.color || '#fff'; msgEl.dataset.last = mtxt; }
    msgEl.style.display = mtxt ? 'block' : 'none';
    return;
  }
  hudEl.style.display = msgEl.style.display = 'none';
  msgLabel.mesh.visible = playing && !!msg;
  if (!playing) return;
  const hp = xrHeadPos(), hq = xrHeadQuat();
  const fwd = _v.set(0, 0, -1).applyQuaternion(hq);
  const up = _v2.set(0, 1, 0).applyQuaternion(hq);
  const k = Math.min(1, dt * 2.5);
  const tgt = hp.clone().addScaledVector(fwd, 1.4).addScaledVector(up, 0.34);
  msgLabel.mesh.position.lerp(tgt, msgLabel.mesh.visible ? k : 1);
  msgLabel.mesh.lookAt(hp);
  if (msg) msgLabel.set([{ text: msg.text, size: 0.62, color: msg.color, bold: false }]);
}

// ---------- Eventos do jogo -> som, vibração, avisos, efeitos ----------
function handleEvents(evs) {
  const quiet = demo;
  for (const ev of evs) {
    switch (ev.type) {
      case 'fill-start': break;
      case 'full': if (!quiet) { sfx.full(ev.p || lanePoint(game.angles[ev.lane], 0, 1.1)); pulse(SIDES[ev.hand], 0.5, 40); } break;
      case 'slide': if (!quiet) { sfx.slide(ev.v, ev.p); pulse(SIDES[ev.hand], 0.3, 25); } break;
      case 'spill': particles.burst(ev.p, '#d8e060', 18, 1.2, 0.6, 0.02); if (!quiet) { sfx.spill(ev.p); if (ev.full) showMsg('Derramou! Solte o copo em cima do balcão', 1.6, '#ffb05a'); } break;
      case 'serve': particles.burst(ev.p, '#d8e060', 10, 1, 0.4, 0.02, 1); if (!quiet) sfx.serve(ev.p); break;
      case 'drink': if (!quiet) sfx.gulp(ev.p); break;
      case 'throw': if (!quiet) sfx.throwBack(ev.p); break;
      case 'catch': particles.burst(ev.p, '#ffffff', 8, 0.8, 0.3, 0.02, 0); if (!quiet) { sfx.catchCup(ev.p); pulse(SIDES[ev.hand], 0.35, 25); } break;
      case 'tip': if (!quiet) showMsg('Gorjeta! Pegue a moeda', 1.4, '#ffe14a'); break;
      case 'coin': particles.burst(ev.p, '#ffe14a', 20, 1.4, 0.5, 0.025, 1); if (!quiet) { sfx.coin(ev.p); pulse(SIDES[ev.hand], 0.4, 30); } break;
      case 'leave': particles.burst(ev.p, ev.boss ? '#ff6ab8' : '#ffe14a', ev.boss ? 50 : 12, 1.5, 0.7, 0.04, 1); if (!quiet) sfx.leave(ev.p); break;
      case 'arrive': if (!quiet) sfx.arrive(ev.p); break;
      case 'fire': if (!quiet) { sfx.fuse(ev.p); showMsg('Busca-pé! Apague com um copo ou espante com a mão', 2, '#ff6a5a'); } break;
      case 'fire-out': particles.burst(ev.p, '#c8d8e8', 25, 1.2, 0.8, 0.04, -0.5); if (!quiet) sfx.fireOut(ev.p); break;
      case 'fire-swat': particles.burst(ev.p, '#ffb02a', 20, 1.5, 0.4, 0.025, 1); if (!quiet) { sfx.fireOut(ev.p); pulse(SIDES[ev.hand], 0.6, 50); } break;
      case 'gull': if (!quiet) { sfx.gull(ev.p); showMsg('Gaivota no balcão! Ela rouba o copo', 1.6, '#e8e8f0'); } break;
      case 'gull-steal': particles.burst(ev.p, '#ffffff', 14, 1.2, 0.6, 0.03, 0.5); if (!quiet) sfx.steal(ev.p); break;
      case 'gull-off': break;
      case 'life':
        if (ev.p) particles.burst(ev.p, ev.reason === 'fire' ? '#ff8a3a' : '#d8f0ff', 40, 2.4, 0.8, 0.04);
        if (!quiet) {
          if (ev.reason === 'fire') sfx.boom(ev.p);
          sfx.life(); both(0.9, 300);
          showMsg(`${LIFE_MSG[ev.reason] || 'Perdeu uma vida!'}${ev.lives > 0 ? (ev.lives === 1 ? ' Última vida!' : ` Restam ${ev.lives}.`) : ''}`, 2.6, '#ff5a6a');
        }
        break;
      case 'boss-in': if (!quiet) { sfx.bossIn(lanePoint(game.angles[ev.lane], game.len, 1.4)); showMsg(ev.kind === 'boi' ? 'Chegou o Boi-Bumbá! 8 copos para ele dançar de volta' : 'Seu Bocão chegou com fome! 12 copos, e ele troca de balcão', 3, '#ff6ab8'); } break;
      case 'boss-hit': particles.burst(ev.p, '#ff6ab8', 18, 1.5, 0.5, 0.035, 1); if (game.bossRef) customersView.hit(game.bossRef.id); if (!quiet) sfx.bossHit(ev.p); break;
      case 'boss-warn': if (!quiet) { sfx.bossWarn(ev.p); showMsg('Seu Bocão vai trocar de balcão!', 1.3, '#ffb05a'); } break;
      case 'boss-swap': particles.burst(ev.p, '#ffffff', 20, 1.2, 0.5, 0.04, 1); break;
      case 'boss-grab': if (!quiet) showMsg('Ele levou o copo junto!', 1.2, '#ffb05a'); break;
      case 'boss-down': if (!quiet) { sfx.bossDown(ev.p); showMsg(`${BOSS_NAME[ev.kind]} satisfeito!`, 3, '#ffe14a'); } break;
      case 'won': if (!quiet) { sfx.won(); doneTimer = 2.2; showMsg('Freguesia satisfeita!', 2.2, '#ffe14a'); } break;
      case 'lost': if (!quiet) { sfx.lost(); both(1, 400); doneTimer = 2.5; } break;
    }
  }
}

// ---------- Botão de VR ----------
const vrBtn = document.getElementById('vr');
async function setupVR() {
  const okXR = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!okXR) { vrBtn.textContent = window.isSecureContext ? 'VR não disponível neste navegador' : 'VR precisa de HTTPS'; vrBtn.disabled = true; return; }
  vrBtn.textContent = 'Entrar em VR';
  vrBtn.disabled = false;
  vrBtn.onclick = async () => {
    sfx.unlock();
    if (renderer.xr.isPresenting) { renderer.xr.getSession()?.end(); return; }
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      await renderer.xr.setSession(session);
      vrBtn.textContent = 'Sair do VR';
      session.addEventListener('end', () => { vrBtn.textContent = 'Entrar em VR'; });
    } catch (err) { vrBtn.textContent = 'Erro ao entrar em VR'; console.error(err); }
  };
}
setupVR();

// ---------- Laço principal ----------
let acc = 0, lastT = performance.now(), time = 0;
let fpsFrames = 0, fpsTime = 0;
const _lf = new THREE.Vector3(), _lu = new THREE.Vector3();

function tick(dt) {
  time += dt;
  const vr = renderer.xr.isPresenting;
  if (recenterIn > 0 && --recenterIn === 0) recenter();
  pollButtons();
  rig.updateMatrixWorld(true);
  updatePcCamera();
  camera.updateMatrixWorld(true);
  if (!vr) pcInput = mouse.has && app === 'playing' ? updatePcHand(dt) : null;

  const running = app === 'playing' || app === 'done' || app === 'menu' || app === 'initials';
  if (running) {
    acc += dt;
    const n = Math.min(12, Math.floor(acc / DT));
    if (n > 0) readPoses();
    for (let i = 0; i < n; i++) { game.step(buildInput((i + 1) / n)); handleEvents(game.events); }
    acc -= n * DT;
    if (demo && game.over) newGame(Math.floor(Math.random() * LEVELS.length), { seed: Math.floor(Math.random() * 1e6) });
  } else acc = 0;
  if (app === 'playing' && doneTimer > 0) { doneTimer -= dt; if (doneTimer <= 0) finishLevel(); }

  // visual
  placeHands(vr);
  customersView.update(game, time, dt);
  itemsView.update(game, time);
  gullsView.update(game, time);
  // moendas: o rolo gira e sai garapa enquanto alguém enche; o anel pisca no balcão com freguês perto
  if (counters) counters.userData.lanes.forEach((ln, i) => {
    const filling = game.hands.some(H => H.holding && !H.holding.full && H.holding.lane === i && H.trig);
    if (filling) {
      ln.userData.wheel.rotation.x += dt * 12;
      if (app !== 'paused') { const sp = lanePoint(game.angles[i], 0.02, 1.17); particles.spawn(sp[0], sp[1], sp[2], 0, -0.6, 0, 0.18, 0.02, '#d8e060', 3); if (!demo) sfx.grind(sp); }
    }
    const danger = game.customers.some(c => c.lane === i && c.state !== 'gone' && c.s < 1.0);
    ln.userData.ring.material.opacity = danger ? 0.5 + 0.5 * Math.sin(time * 12) : 0.7;
    ln.userData.ring.material.color.set(danger ? '#ff5a4a' : THEMES[LEVELS[level].world].glow);
  });
  if (app !== 'paused') {
    for (const it of game.items) if (it.kind === 'fire') { const p = lanePoint(game.angles[it.lane], it.s - 0.09, CUP.y + 0.03); particles.spawn(p[0], p[1], p[2], (Math.random() - 0.5) * 0.8, Math.random() * 0.8, (Math.random() - 0.5) * 0.8, 0.3, 0.02, Math.random() < 0.5 ? '#ffd25a' : '#ff6a2a', 1); }
    particles.update(dt);
  }
  particles.mat.uniforms.uScale.value = vr ? 800 : renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  world.update(app === 'paused' ? 0 : dt, time);
  updateHud(dt);
  updateMenuRays();

  if (sfx.ctx) {
    const hq = xrHeadQuat();
    sfx.setListener(xrHeadPos(), _lf.set(0, 0, -1).applyQuaternion(hq), _lu.set(0, 1, 0).applyQuaternion(hq));
  }
  fpsFrames++; fpsTime += dt;
  if (fpsTime >= 0.5) {
    const f = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0; fpsTime = 0;
    fpsEl.style.display = save.fps && !vr ? 'block' : 'none';
    fpsEl.textContent = `${f} FPS`;
    fpsLabel.mesh.visible = save.fps && vr;
    fpsLabel.set(`${f} FPS`);
  }
}

function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  tick(dt);
  renderer.render(scene, camera);
}

// ---------- Depuração (console do navegador) ----------
// dev.loadLevel(5) abre a fase 5 · dev.autoplay = true o robô joga · dev.advance(20) avança 20 s
// dev.state() resumo · dev.snapshot() imagem da tela · dev.arcade() fliperama · dev.resetSave()
const dev = {
  _auto: false,
  get autoplay() { return this._auto; },
  set autoplay(v) { this._auto = !!v; robot.reset(); updateHint(); },
  loadLevel(n) { startLevel(clamp(n, 1, LEVELS.length) - 1, 'level'); return this.state(); },
  arcade() { startArcade(); return this.state(); },
  advance(sec, step = 1 / 72) {
    const frames = Math.round(sec / step);
    for (let i = 0; i < frames; i++) tick(step);
    lastT = performance.now();
    renderer.render(scene, camera);
    return this.state();
  },
  state() {
    return {
      tela: app, modo: mode, fase: level + 1, nome: LEVELS[level].name, mundo: WORLDS[LEVELS[level].world].name,
      tempo: +game.t.toFixed(1), vidas: game.lives, pontos: game.score, fliperama: mode === 'arcade' ? arcade.score : null,
      faltam: game.left, fregueses: game.customers.filter(c => c.state !== 'gone').map(c => ({ balcao: c.lane + 1, s: +c.s.toFixed(2), tipo: c.type, estado: c.state })),
      copos: game.items.map(it => ({ tipo: it.kind, balcao: it.lane + 1, s: +it.s.toFixed(2) })),
      chefe: game.bossRef ? { tipo: game.bossRef.type, vida: game.bossRef.hp } : null,
      resultado: game.result, salvo: save.done[level] || null,
    };
  },
  snapshot(w = 960) {
    renderer.render(scene, camera);
    const src = renderer.domElement, c = document.createElement('canvas');
    c.width = w; c.height = Math.round(w * src.height / src.width);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.88);
  },
  resetSave() { save.done = {}; save.scores = []; storeSave(save); },
};
window.dev = dev;
window.garapa = { dev, get game() { return game; }, save, sfx, robot, startLevel, startArcade, goMenu, camera, scene, renderer };
void FILL; void COUNTER;

goMenu();
renderer.setAnimationLoop(frame);
