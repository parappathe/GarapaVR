// Tudo que se vê no Garapeiro: os 3 cenários, a barraca, os balcões com moenda, os fregueses,
// copos, moedas, busca-pés, gaivotas, as mãos e o letreiro do placar. Texturas desenhadas em canvas.
import * as THREE from '../vendor/three/three.module.js';
import { COUNTER, CUP, lanePoint, laneDir } from './sim.js';

export const THEMES = [
  { name: 'feira', bg: '#8fd0f0', sky: ['#4aa8e8', '#bfe6f6'], fog: '#bfe6f6', fogNear: 14, fogFar: 45, hemi: ['#ffffff', '#8a7a5a', 1.6], sun: ['#fff2d8', 1.5], wood: '#b5793e', top: '#d9a066', glow: '#ffd25a', awning: ['#e8443a', '#fff4e0'], ground: 'feira' },
  { name: 'junina', bg: '#1a1e4a', sky: ['#0e1236', '#3a3a78'], fog: '#26285a', fogNear: 12, fogFar: 38, hemi: ['#ffd8a8', '#3a2a40', 1.5], sun: ['#ffb070', 1.2], wood: '#8a5a2e', top: '#c08850', glow: '#ff9a3a', awning: ['#2a7ae8', '#ffd25a'], ground: 'terra' },
  { name: 'praia', bg: '#24305e', sky: ['#18204a', '#5a4a8a'], fog: '#3a3a70', fogNear: 14, fogFar: 42, hemi: ['#c8d8ff', '#5a4a3a', 1.55], sun: ['#e0e8ff', 1.1], wood: '#a0784a', top: '#e0c08a', glow: '#5ff2e0', awning: ['#ff6ab8', '#fff4e0'], ground: 'areia' },
];

function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const rnd = (() => { let s = 4242; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

function woodTex(base, rep) {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 40; k++) {
      g.strokeStyle = `rgba(${rnd() < 0.5 ? '60,30,10' : '255,230,190'},${0.08 + rnd() * 0.12})`;
      g.lineWidth = 1 + rnd() * 2;
      const y = rnd() * h;
      g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + rnd() * 6 - 3, w * 0.6, y + rnd() * 6 - 3, w, y + rnd() * 4 - 2); g.stroke();
    }
    g.fillStyle = 'rgba(40,20,5,0.25)'; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2);
  }, rep);
}

function groundTex(kind) {
  return canvasTex(256, 256, (g, w, h) => {
    if (kind === 'feira') {
      g.fillStyle = '#8a8478'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 * 16; x < w; x += 32) {
        const v = 110 + Math.floor(rnd() * 50);
        g.fillStyle = `rgb(${v},${v - 6},${v - 16})`; g.fillRect(x + 2, y + 2, 28, 28);
      }
    } else if (kind === 'terra') {
      g.fillStyle = '#6a4a2a'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 900; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(220,180,90,0.35)' : 'rgba(40,25,10,0.3)'; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 6, 1); }
    } else {
      g.fillStyle = '#d8c08a'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 2000; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,240,200,0.5)' : 'rgba(150,120,70,0.35)'; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
    }
  }, [24, 24]);
}

function skyTex(th) {
  return canvasTex(64, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.55, th.sky[1]); gr.addColorStop(1, th.fog);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (th.name !== 'feira') for (let k = 0; k < 120; k++) { g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`; g.fillRect(rnd() * w, rnd() * h * 0.5, 1, 1); }
  });
}

function stripeTex(a, b) {
  return canvasTex(128, 32, (g, w, h) => {
    for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? b : a; g.fillRect(k * 16, 0, 16, h); }
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, h - 4, w, 4);
  });
}

function signTex() {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#2e7a2a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffe85a'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#ffe85a'; g.font = 'bold 72px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('GARAPA', w / 2, h / 2 + 4);
  });
}

function glowTexture() {
  return canvasTex(64, 64, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}

const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });

// ---------- cenários ----------
function buildFeira(g) {
  // barracas vizinhas, caixotes de fruta e postes
  const colors = ['#e8443a', '#3a8ae8', '#f0c020', '#3ac06a', '#e86ab8'];
  for (let k = 0; k < 10; k++) {
    const a = (-80 + k * 18) * Math.PI / 180, r = 9 + (k % 3) * 2;
    const x = Math.sin(a) * r, z = -Math.cos(a) * r;
    const tent = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.2), lam('#a87a4a'));
    base.position.y = 0.5; tent.add(base);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.9, 4, 1, true), new THREE.MeshLambertMaterial({ map: stripeTex(colors[k % 5], '#fff4e0'), side: THREE.DoubleSide }));
    roof.position.y = 2.6; roof.rotation.y = Math.PI / 4; tent.add(roof);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2), lam('#5a4030')); p.position.set(sx * 1.0, 1.1, sz * 0.55); tent.add(p); }
    for (let f = 0; f < 6; f++) { const fr = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lam(['#ff8a2a', '#e8302a', '#ffe040', '#6ad040'][f % 4])); fr.position.set(-0.8 + f * 0.32, 1.06, 0.2); tent.add(fr); }
    tent.position.set(x, 0, z); tent.lookAt(0, 0, 0);
    g.add(tent);
  }
  // nuvens
  const cloudM = basic('#ffffff', { transparent: true, opacity: 0.9 });
  for (let k = 0; k < 6; k++) {
    const c = new THREE.Group();
    for (let j = 0; j < 4; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1 + rnd(), 10, 8), cloudM); s.position.set(j * 1.3, rnd() * 0.5, 0); s.scale.y = 0.55; c.add(s); }
    const a = (-60 + k * 25) * Math.PI / 180;
    c.position.set(Math.sin(a) * 30, 12 + rnd() * 4, -Math.cos(a) * 30);
    g.add(c);
  }
}

function buildJunina(g, glowTex) {
  // varais de bandeirinhas
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.09, 0, 0, 0.09, 0, 0, 0, -0.2, 0], 3));
  flagGeo.computeVertexNormals();
  const flags = new THREE.InstancedMesh(flagGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), 360);
  const cols = ['#e8302a', '#f0c020', '#2a8ae8', '#3ac06a', '#ff6ab8', '#ffffff'];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  let n = 0;
  for (let line = 0; line < 6; line++) {
    const a0 = (-70 + line * 28) * Math.PI / 180, a1 = a0 + 0.5;
    const p0 = new THREE.Vector3(Math.sin(a0) * 3, 3.4, -Math.cos(a0) * 3), p1 = new THREE.Vector3(Math.sin(a1) * 9, 3.6, -Math.cos(a1) * 9);
    for (let k = 0; k < 60 && n < 360; k++, n++) {
      const t = k / 59;
      const p = p0.clone().lerp(p1, t); p.y -= Math.sin(t * Math.PI) * 0.6;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(p1.x - p0.x, p1.z - p0.z) + Math.PI / 2);
      m.compose(p, q, new THREE.Vector3(1, 1, 1));
      flags.setMatrixAt(n, m);
      flags.setColorAt(n, c.set(cols[(k + line) % cols.length]));
    }
  }
  flags.count = n;
  g.add(flags);
  // fogueira
  const fire = new THREE.Group();
  for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2), lam('#5a3a1a')); l.rotation.z = Math.PI / 2; l.rotation.y = k * Math.PI / 6; l.position.y = 0.1; fire.add(l); }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 10), basic('#ff8a2a', { transparent: true, opacity: 0.85 }));
  flame.position.y = 0.7; fire.add(flame);
  const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.8, 8), basic('#ffe85a'));
  flame2.position.y = 0.55; fire.add(flame2);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff9a3a', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(4); halo.position.y = 0.8; fire.add(halo);
  fire.position.set(5.5, 0, -8);
  g.add(fire);
  g.userData.flame = flame; g.userData.flame2 = flame2;
  // balões de São João (lanternas) e casinhas
  for (let k = 0; k < 8; k++) {
    const a = (-75 + k * 21) * Math.PI / 180, r = 10 + (k % 2) * 3;
    const h = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 1.6), lam(['#f0d8a0', '#e8a0a0', '#a0c8e8'][k % 3]));
    wall.position.y = 0.9; h.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.9, 4), lam('#a84a2a')); roof.position.y = 2.25; roof.rotation.y = Math.PI / 4; h.add(roof);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), basic('#ffd27a')); win.position.set(0.5, 1.0, 0.81); h.add(win);
    h.position.set(Math.sin(a) * r, 0, -Math.cos(a) * r); h.lookAt(0, 0, 0);
    g.add(h);
  }
}

function buildPraia(g, glowTex) {
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(120, 40), new THREE.MeshLambertMaterial({ color: '#2a4a8a', transparent: true, opacity: 0.95 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.02, -32);
  g.add(sea);
  const shine = new THREE.Mesh(new THREE.PlaneGeometry(4, 30), basic('#c8d8ff', { transparent: true, opacity: 0.25, depthWrite: false }));
  shine.rotation.x = -Math.PI / 2; shine.position.set(-6, 0.03, -30); g.add(shine);
  g.userData.shine = shine;
  const moon = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), basic('#fff8e0'));
  moon.position.set(-14, 16, -45); moon.lookAt(0, 1.6, 0); g.add(moon);
  const mh = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff2c0', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  mh.scale.setScalar(12); mh.position.copy(moon.position); g.add(mh);
  // coqueiros e tochas
  for (let k = 0; k < 9; k++) {
    const a = (-80 + k * 20) * Math.PI / 180, r = 7 + (k % 3) * 2.5;
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 4.5, 8), lam('#7a5a3a'));
    trunk.position.y = 2.25; trunk.rotation.z = 0.12; t.add(trunk);
    for (let j = 0; j < 7; j++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.25, 2.2, 4), lam('#2a8a4a'));
      leaf.position.set(0.25, 4.5, 0); leaf.rotation.set(0, j * Math.PI * 2 / 7, 1.9); t.add(leaf);
    }
    t.position.set(Math.sin(a) * r, 0, -Math.cos(a) * r);
    g.add(t);
    if (k % 2 === 0) {
      const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6), lam('#5a3a1a')); torch.position.set(Math.sin(a) * (r - 2), 0.8, -Math.cos(a) * (r - 2)); g.add(torch);
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff9a3a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      fl.scale.setScalar(0.9); fl.position.set(torch.position.x, 1.7, torch.position.z); g.add(fl);
    }
  }
  // varal de luzinhas
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), 40);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  for (let k = 0; k < 40; k++) {
    const a = (-60 + k * 3) * Math.PI / 180, r = 4.5;
    m.setPosition(Math.sin(a) * r, 3.0 - Math.sin(((k % 20) / 19) * Math.PI) * 0.5, -Math.cos(a) * r);
    bulbs.setMatrixAt(k, m); bulbs.setColorAt(k, c.set(['#ff6ab8', '#5ff2e0', '#ffd25a'][k % 3]));
  }
  g.add(bulbs);
}

// ---------- mundo ----------
export function buildWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#000', 10, 40);
  const hemi = new THREE.HemisphereLight('#fff', '#333', 1.4);
  const sun = new THREE.DirectionalLight('#fff', 1.2);
  sun.position.set(2, 6, 3);
  scene.add(hemi, sun);
  const glowTex = glowTexture();

  const themes = THEMES.map((th) => {
    const g = new THREE.Group();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(55, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex(th), side: THREE.BackSide, fog: false, depthWrite: false }));
    g.add(sky);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(50, 48), new THREE.MeshLambertMaterial({ map: groundTex(th.ground) }));
    ground.rotation.x = -Math.PI / 2; g.add(ground);
    if (th.name === 'feira') buildFeira(g);
    else if (th.name === 'junina') buildJunina(g, glowTex);
    else buildPraia(g, glowTex);
    g.visible = false;
    scene.add(g);
    return g;
  });

  // a barraca do garapeiro: parede atrás, toldo listrado em cima, cana encostada e a placa
  const stall = new THREE.Group();
  const backWood = woodTex('#9a6a3a', [3, 6]);
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 0.08), new THREE.MeshLambertMaterial({ map: backWood }));
  back.position.set(0, 1.3, 1.1); stall.add(back);
  const awningM = new THREE.MeshLambertMaterial({ map: stripeTex('#e8443a', '#fff4e0'), side: THREE.DoubleSide });
  awningM.map.wrapS = THREE.RepeatWrapping; awningM.map.repeat.set(4, 1);
  const awning = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), awningM);
  awning.position.set(0, 2.55, 0.25); awning.rotation.x = -Math.PI / 2 + 0.25; stall.add(awning);
  const flap = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.25), awningM);
  flap.position.set(0, 2.25, -0.62); stall.add(flap);
  for (const x of [-1.55, 1.55]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6), lam('#5a4030')); p.position.set(x, 1.3, -0.55); stall.add(p); }
  const caneM = lam('#9ac04a');
  for (let k = 0; k < 14; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.0, 6), caneM); c.position.set(-1.4 + k * 0.05, 1.0, 1.0); c.rotation.z = 0.08 - k * 0.004; stall.add(c); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), new THREE.MeshBasicMaterial({ map: signTex(), toneMapped: false }));
  sign.position.set(0, 2.05, 1.05); sign.rotation.y = Math.PI; stall.add(sign);
  scene.add(stall);

  // ---------- letreiro do placar (em cima, na frente) ----------
  const marquee = new THREE.Group();
  const MW = 2.2;
  const frameM = lam('#1a1420');
  marquee.add(new THREE.Mesh(new THREE.BoxGeometry(MW, 0.36, 0.08), frameM));
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 1024; boardCanvas.height = 128;
  const boardTex = new THREE.CanvasTexture(boardCanvas); boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 4;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(MW - 0.1, 0.3), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }));
  board.position.z = 0.041; marquee.add(board);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), 34);
  for (let k = 0; k < 34; k++) {
    const m = new THREE.Matrix4();
    if (k < 15) m.setPosition(-MW / 2 + 0.08 + k * (MW - 0.16) / 14, 0.17, 0.05);
    else if (k < 30) m.setPosition(MW / 2 - 0.08 - (k - 15) * (MW - 0.16) / 14, -0.17, 0.05);
    else m.setPosition((k < 32 ? -1 : 1) * (MW / 2 - 0.02), k % 2 ? 0.06 : -0.06, 0.05);
    bulbs.setMatrixAt(k, m); bulbs.setColorAt(k, new THREE.Color('#ffd25a'));
  }
  marquee.add(bulbs);
  marquee.position.set(0, 2.62, -2.3);
  marquee.rotation.x = 0.1;
  scene.add(marquee);

  let cur = -1;
  const world = {
    scene, themes, glowTex, marquee, awningM,
    setTheme(i) {
      if (i === cur) return;
      cur = i;
      const th = THEMES[i];
      themes.forEach((g, k) => { g.visible = k === i; });
      scene.background = new THREE.Color(th.bg);
      scene.fog.color.set(th.fog); scene.fog.near = th.fogNear; scene.fog.far = th.fogFar;
      hemi.color.set(th.hemi[0]); hemi.groundColor.set(th.hemi[1]); hemi.intensity = th.hemi[2];
      sun.color.set(th.sun[0]); sun.intensity = th.sun[1];
      awningM.map = stripeTex(th.awning[0], th.awning[1]); awningM.map.wrapS = THREE.RepeatWrapping; awningM.map.repeat.set(4, 1); awningM.needsUpdate = true;
    },
    get theme() { return THEMES[cur]; },
    update(dt, time) {
      const g = themes[cur];
      if (g?.userData.flame) { const f = 1 + Math.sin(time * 13) * 0.08 + Math.sin(time * 7.3) * 0.06; g.userData.flame.scale.set(f, 1 + Math.sin(time * 9) * 0.12, f); g.userData.flame2.scale.y = 1 + Math.sin(time * 11) * 0.15; }
      if (g?.userData.shine) g.userData.shine.material.opacity = 0.2 + 0.08 * Math.sin(time * 1.3);
      const c = new THREE.Color();
      for (let k = 0; k < 34; k++) { c.set((Math.floor(time * 6) + k) % 3 === 0 ? THEMES[cur].glow : '#3a2a1a'); bulbs.setColorAt(k, c); }
      bulbs.instanceColor.needsUpdate = true;
    },
    setBoard(lines) {
      const key = JSON.stringify(lines);
      if (key === this._board) return;
      this._board = key;
      const g = boardCanvas.getContext('2d'), w = 1024, h = 128;
      g.fillStyle = '#0a0610'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.04)';
      for (let x = 4; x < w; x += 8) for (let y = 4; y < h; y += 8) g.fillRect(x, y, 3, 3);
      g.textBaseline = 'middle';
      for (const l of lines) {
        g.font = `bold ${l.size || 54}px monospace`; g.textAlign = l.align || 'left';
        g.fillStyle = l.color || '#ffd25a'; g.shadowColor = l.color || '#ffd25a'; g.shadowBlur = 12;
        g.fillText(l.text, l.x, l.y ?? h / 2);
      }
      g.shadowBlur = 0;
      boardTex.needsUpdate = true;
    },
  };
  return world;
}

// ---------- balcões ----------
// grupo com os balcões da fase (ângulos e comprimento mudam por fase)
export function buildCounters(angles, len, th) {
  const g = new THREE.Group();
  const topTex = woodTex(th.top, [len * 2, 1]);
  const sideTex = woodTex(th.wood, [len * 2, 1]);
  const topM = new THREE.MeshLambertMaterial({ map: topTex });
  const sideM = new THREE.MeshLambertMaterial({ map: sideTex });
  const metal = lam('#8a9aa8'), green = lam('#2e8a3a'), red = lam('#c8302a');
  const glow = basic(th.glow);
  const doors = [];
  angles.forEach((az, i) => {
    const lane = new THREE.Group();
    const a = az * Math.PI / 180;
    lane.rotation.y = -a;
    // o grupo do balcão olha para -z; s vai de 0 a len a partir de r0
    const W = COUNTER.halfW * 2;
    const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.05, len + 0.2), topM);
    top.position.set(0, COUNTER.y - 0.025, -(COUNTER.r0 + len / 2 - 0.05));
    lane.add(top);
    const body = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, COUNTER.y - 0.05, len + 0.1), sideM);
    body.position.set(0, (COUNTER.y - 0.05) / 2, top.position.z);
    lane.add(body);
    // filete colorido na beira
    const trim = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.02, len + 0.22), lam(th.awning[0]));
    trim.position.set(0, COUNTER.y - 0.06, top.position.z); lane.add(trim);
    // moenda na ponta: dois rolos, a roda de girar e a bica
    const m = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.08), green); box.position.y = 0.04; m.add(box);
    for (const dz of [-0.02, 0.02]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 10), metal); r.rotation.z = Math.PI / 2; r.position.set(0, 0.1, dz); m.add(r); }
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 16), red); wheel.rotation.y = Math.PI / 2; wheel.position.set(0.075, 0.1, 0); m.add(wheel);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.013, 0.05), metal); spout.position.set(0, -0.015, -0.045); spout.rotation.x = 0.4; m.add(spout);
    const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), lam('#9ac04a')); cane.position.set(0, 0.16, 0.06); cane.rotation.x = -0.9; m.add(cane);
    m.position.set(0, 1.19, -(COUNTER.r0 - 0.06));
    lane.add(m);
    lane.userData.wheel = wheel;
    // marca de onde segurar o copo para encher (anel brilhante embaixo da bica)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.045, 0.06, 20), basic(th.glow, { transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, COUNTER.y + 0.004, -(COUNTER.r0 + 0.02));
    lane.add(ring);
    lane.userData.ring = ring;
    // porta no fim do balcão (por onde o freguês entra e sai)
    const door = new THREE.Group();
    const postM = lam(th.wood);
    for (const x of [-0.3, 0.3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.8, 0.05), postM); p.position.set(x + 0.28, 0.9, 0); door.add(p); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.07, 0.07), postM); beam.position.set(0.28, 1.8, 0); door.add(beam);
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.0), new THREE.MeshLambertMaterial({ map: stripeTex(th.awning[0], th.awning[1]), transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    curtain.position.set(0.28, 1.28, -0.05); door.add(curtain);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), glow); lamp.position.set(0.28, 1.9, 0.05); door.add(lamp);
    door.position.set(0, 0, -(COUNTER.r0 + len + 0.12));
    lane.add(door);
    doors.push(door);
    // número do balcão no chão
    g.add(lane);
    void i;
  });
  g.userData.lanes = g.children.slice();
  return g;
}

// ---------- fregueses ----------
const SKIN = ['#f2c8a0', '#d8a070', '#a86a40', '#7a4a2a', '#e8b890'];
const SHIRT = ['#e8443a', '#3a8ae8', '#f0c020', '#3ac06a', '#e86ab8', '#8a5ae8', '#ff8a3a', '#5ad0c0'];

function checkTex(a, b) {
  return canvasTex(64, 64, (g, w) => {
    g.fillStyle = a; g.fillRect(0, 0, w, w);
    g.fillStyle = b;
    for (let k = 0; k < 4; k++) { g.globalAlpha = 0.5; g.fillRect(k * 16, 0, 8, w); g.fillRect(0, k * 16, w, 8); }
    g.globalAlpha = 1;
  });
}

function faceTex(kind) {
  return canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#000'; g.clearRect(0, 0, w, w);
    g.fillStyle = '#1a1010';
    if (kind === 'bocao') {
      g.beginPath(); g.arc(40, 46, 9, 0, Math.PI * 2); g.arc(88, 46, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a1a1a'; g.beginPath(); g.ellipse(64, 88, 34, 22, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.fillRect(40, 70, 48, 8);
      g.fillStyle = '#3a2010'; g.beginPath(); g.ellipse(64, 66, 30, 7, 0, 0, Math.PI * 2); g.fill();
    } else {
      g.beginPath(); g.arc(46, 54, 6, 0, Math.PI * 2); g.arc(82, 54, 6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#5a1a1a'; g.lineWidth = 5; g.beginPath(); g.arc(64, 74, 16, 0.2, Math.PI - 0.2); g.stroke();
    }
  });
}
const FACE = {};

export class CustomerView {
  constructor(scene) {
    this.scene = scene;
    this.pool = new Map();
    this.theme = 0;
  }
  setTheme(i) { this.theme = i; for (const f of this.pool.values()) this.scene.remove(f.group); this.pool.clear(); }

  make(c) {
    const group = new THREE.Group();
    const seed = c.id * 7;
    const skin = lam(SKIN[seed % SKIN.length]);
    const shirtCol = SHIRT[(seed * 3) % SHIRT.length];
    const parts = {};
    if (c.type === 'boi') {
      // boi-bumbá: corpo enfeitado com saia de fita, cabeça com chifres e estrela na testa
      const bodyM = new THREE.MeshLambertMaterial({ map: checkTex('#1a1a1a', '#ffffff') });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.9), bodyM); body.position.y = 1.15; group.add(body);
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.7, 16, 1, true), new THREE.MeshLambertMaterial({ map: stripeTex('#e8302a', '#ffd25a'), side: THREE.DoubleSide }));
      skirt.position.y = 0.6; group.add(skirt);
      const head = new THREE.Group();
      const hm = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.4), bodyM); head.add(hm);
      for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.3, 8), lam('#f0e8d0')); h.position.set(s * 0.17, 0.2, 0); h.rotation.z = -s * 0.7; head.add(h); }
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), basic('#ffd25a')); star.position.set(0, 0.06, -0.21); head.add(star);
      head.position.set(0, 1.45, -0.5); group.add(head);
      for (let k = 0; k < 8; k++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.01), basic(SHIRT[k])); const a = k / 8 * Math.PI * 2; r.position.set(Math.cos(a) * 0.6, 0.55, Math.sin(a) * 0.6); r.rotation.y = -a; group.add(r); }
      parts.head = head; parts.body = body; parts.skirt = skirt;
    } else {
      const big = c.type === 'bocao' ? 1.45 : c.type === 'sedento' ? 1.05 : 1;
      const shirtM = this.theme === 1 ? new THREE.MeshLambertMaterial({ map: checkTex(shirtCol, '#ffffff') }) : lam(shirtCol);
      const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.8, 10), lam(['#2a3a6a', '#5a4030', '#3a3a3a'][seed % 3]));
      legs.position.y = 0.4; group.add(legs);
      const belly = c.type === 'sedento' || c.type === 'bocao' ? 1.35 : 1;
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), shirtM);
      body.scale.set(belly, 1.5, belly); body.position.y = 1.08; group.add(body);
      const headR = c.type === 'bocao' ? 0.2 : 0.13;
      const head = new THREE.Group();
      head.add(new THREE.Mesh(new THREE.SphereGeometry(headR, 16, 12), skin));
      const kind = c.type === 'bocao' ? 'bocao' : 'normal';
      FACE[kind] ||= faceTex(kind);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(headR * 1.6, headR * 1.6), new THREE.MeshBasicMaterial({ map: FACE[kind], transparent: true }));
      face.position.z = -headR * 0.93; face.rotation.y = Math.PI; head.add(face);
      // chapéu pelo tema
      if (c.type === 'bocao') {
        const toque = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.26, 14), lam('#ffffff')); toque.position.y = 0.25; head.add(toque);
      } else if (this.theme === 1) {
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.015, 16), lam('#e8c870')); brim.position.y = 0.08; head.add(brim);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.14, 12), lam('#e8c870')); crown.position.y = 0.15; head.add(crown);
      } else if (this.theme === 2) {
        for (let k = 0; k < 6; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), basic(['#ff6ab8', '#ffd25a', '#ffffff'][k % 3])); const a = k / 6 * Math.PI * 2; f.position.set(Math.cos(a) * 0.12, 0.09, Math.sin(a) * 0.12); head.add(f); }
      } else if (c.type === 'apressado' || seed % 3 === 0) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(SHIRT[(seed + 2) % SHIRT.length])); cap.position.y = 0.02; head.add(cap);
        const bill = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.1), cap.material); bill.position.set(0, 0.03, -0.14); head.add(bill);
      }
      head.position.y = 1.45 + (c.type === 'bocao' ? 0.1 : 0); group.add(head);
      const armGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.45, 8); armGeo.translate(0, -0.2, 0);
      const arms = [-1, 1].map(s => { const a = new THREE.Mesh(armGeo, shirtM); a.position.set(s * 0.2 * belly, 1.3, 0); group.add(a); return a; });
      group.scale.setScalar(big);
      parts.head = head; parts.body = body; parts.arms = arms;
    }
    group.userData.parts = parts;
    this.scene.add(group);
    return { group, parts, type: c.type, flash: 0 };
  }

  update(game, time, dt) {
    const seen = new Set();
    for (const c of game.customers) {
      if (c.state === 'gone') continue;
      seen.add(c.id);
      let f = this.pool.get(c.id);
      if (!f) { f = this.make(c); this.pool.set(c.id, f); }
      const az = game.angles[c.lane], a = az * Math.PI / 180;
      const p = lanePoint(az, c.s, 0);
      // fica do lado direito do balcão (de quem olha da moenda), um pouco mais perto quando o leque aperta
      const side = c.boss ? 0.5 : Math.min(0.33, 0.12 + (COUNTER.r0 + c.s) * 0.09);
      const rx = Math.cos(a), rz = Math.sin(a);
      f.group.position.set(p[0] + rx * side, 0, p[2] + rz * side);
      f.group.rotation.y = -a + Math.PI;  // de frente para o jogador
      const P = f.parts;
      const walking = c.state === 'walk', bob = walking ? Math.abs(Math.sin(time * 9 + c.id)) * 0.04 : 0;
      f.group.position.y = bob;
      if (P.arms) {
        const drink = c.state === 'drink', pushed = c.state === 'pushed';
        P.arms[0].rotation.x = drink ? -2.4 : pushed ? -1.2 : walking ? Math.sin(time * 9 + c.id) * 0.4 : -0.4;
        P.arms[1].rotation.x = drink ? -0.3 : pushed ? -1.2 : walking ? -Math.sin(time * 9 + c.id) * 0.4 : -0.9;
        P.head.rotation.x = drink ? -0.4 : 0;
      }
      if (c.type === 'boi') { P.head.rotation.x = Math.sin(time * 3) * 0.15; P.skirt.rotation.y = time * (c.state === 'leaving' ? 6 : 1.2); }
      if (c.state === 'leaving') f.group.rotation.y += time * 8;
      if (f.flash > 0) { f.flash -= dt; f.group.scale.setScalar((c.type === 'bocao' ? 1.45 : 1) * (1 + f.flash * 0.6)); }
    }
    for (const [id, f] of this.pool) if (!seen.has(id)) { this.scene.remove(f.group); this.pool.delete(id); }
  }
  hit(id) { const f = this.pool.get(id); if (f) f.flash = 0.25; }
}

// ---------- copos, moedas, busca-pés, gaivotas ----------
export function makeCup(fillFrac = 1) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.03, 0.11, 14, 1, true), new THREE.MeshLambertMaterial({ color: '#d8f0ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.y = 0.055; g.add(glass);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 14), new THREE.MeshLambertMaterial({ color: '#d8f0ff', transparent: true, opacity: 0.6 }));
  g.add(base);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.029, 0.1, 14), lam('#d8e060', { emissive: '#3a3a00' }));
  liquid.geometry.translate(0, 0.05, 0);
  liquid.position.y = 0.006;
  g.add(liquid);
  const foam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 14), lam('#fff8d0'));
  foam.position.y = 0.105; g.add(foam);
  g.userData = { liquid, foam };
  setCupFill(g, fillFrac);
  return g;
}
export function setCupFill(g, f) {
  const { liquid, foam } = g.userData;
  liquid.visible = f > 0.02; liquid.scale.y = Math.max(0.02, f);
  foam.visible = f > 0.95;
}

export class ItemView {
  constructor(scene, glowTex) {
    this.scene = scene; this.glowTex = glowTex;
    this.pool = new Map();
  }
  make(it) {
    let g;
    if (it.kind === 'cup' || it.kind === 'empty') { g = makeCup(it.kind === 'cup' ? 1 : 0); }
    else if (it.kind === 'coin') {
      g = new THREE.Group();
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.008, 18), lam('#ffd25a', { emissive: '#6a4a00' }));
      c.rotation.x = Math.PI / 2; c.position.y = 0.05; g.add(c);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: '#ffe85a', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(0.18); halo.position.y = 0.05; g.add(halo);
      g.userData.spin = c;
    } else {
      g = new THREE.Group();
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 10), lam('#e8302a'));
      tube.rotation.x = Math.PI / 2; tube.position.y = 0.03; g.add(tube);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.03, 10), lam('#ffd25a'));
      band.rotation.x = Math.PI / 2; band.position.set(0, 0.03, 0.03); g.add(band);
      const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: '#ffb02a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      spark.scale.setScalar(0.16); spark.position.set(0, 0.03, -0.09); g.add(spark);
      g.userData.spark = spark;
    }
    this.scene.add(g);
    return g;
  }
  update(game, time) {
    const seen = new Set();
    for (const it of game.items) {
      seen.add(it.id);
      let g = this.pool.get(it.id);
      if (!g) { g = this.make(it); this.pool.set(it.id, g); }
      const az = game.angles[it.lane];
      const p = lanePoint(az, it.s, COUNTER.y);
      g.position.set(p[0], p[1], p[2]);
      g.rotation.y = -az * Math.PI / 180;
      if (it.kind === 'empty') g.rotation.z = 0;
      if (g.userData.spin) g.userData.spin.rotation.z = time * 6;
      if (g.userData.spark) g.userData.spark.scale.setScalar(0.12 + Math.random() * 0.1);
    }
    for (const [id, g] of this.pool) if (!seen.has(id)) { this.scene.remove(g); this.pool.delete(id); }
  }
}

export class GullView {
  constructor(scene) {
    this.scene = scene; this.list = [];
  }
  make() {
    const g = new THREE.Group();
    const white = lam('#f4f4f4'), grey = lam('#9aa0aa'), orange = lam('#ffa020');
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), white); body.scale.set(1, 0.9, 1.6); body.position.y = 0.09; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), white); head.position.set(0, 0.16, -0.09); g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.05, 6), orange); beak.rotation.x = -Math.PI / 2; beak.position.set(0, 0.155, -0.14); g.add(beak);
    const wingGeo = new THREE.BoxGeometry(0.16, 0.01, 0.08); wingGeo.translate(0.08, 0, 0);
    const wings = [-1, 1].map(s => { const w = new THREE.Mesh(wingGeo, grey); w.position.set(s * 0.04, 0.12, 0); w.scale.x = s; g.add(w); return w; });
    g.userData.wings = wings;
    this.scene.add(g);
    return g;
  }
  update(game, time) {
    while (this.list.length < game.gulls.length) this.list.push(this.make());
    this.list.forEach((g, k) => {
      const gl = game.gulls[k];
      g.visible = !!gl;
      if (!gl) return;
      const az = game.angles[gl.lane];
      const p = lanePoint(az, gl.s, COUNTER.y);
      const land = Math.min(1, (5 - gl.t) * 2), leave = gl.t < 0.4 ? (0.4 - gl.t) * 4 : 0;
      g.position.set(p[0], p[1] + (1 - land) * 1.5 + leave * 1.5, p[2]);
      g.rotation.y = -az * Math.PI / 180 + Math.PI + Math.sin(time * 2 + k) * 0.4;
      const flap = land < 1 || leave > 0 ? Math.sin(time * 30) * 0.9 : -0.1;
      g.userData.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * flap; });
    });
  }
}

// mão do jogador (luva) com o copo que está enchendo
export function buildHand(color) {
  const g = new THREE.Group();
  const glove = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), lam(color));
  glove.scale.set(1, 0.7, 1.3); g.add(glove);
  const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), lam(color)); thumb.position.set(0.04, 0.01, -0.02); g.add(thumb);
  const cup = makeCup(0);
  cup.position.set(0, -0.035, -0.045);
  cup.visible = false;
  g.add(cup);
  return { group: g, cup, glove };
}

// ---------- partículas ----------
export class Particles {
  constructor(scene, cap = 1200) {
    this.cap = cap;
    this.p = new Float32Array(cap * 3); this.v = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
    this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.s0 = new Float32Array(cap); this.grav = new Float32Array(cap);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: 'attribute vec3 pcolor; attribute float size; attribute float alpha; uniform float uScale; varying vec3 vC; varying float vA; void main(){ vC = pcolor; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = min(128.0, size * uScale / max(0.05, -mv.z)); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); if (d > 0.5) discard; float a = vA * (1.0 - d * 1.6); gl_FragColor = vec4(vC * a, a); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.tmp = new THREE.Color();
  }
  spawn(x, y, z, vx, vy, vz, life, size, color, grav = 4) {
    const i = this.next; this.next = (this.next + 1) % this.cap;
    this.p.set([x, y, z], i * 3); this.v.set([vx, vy, vz], i * 3);
    this.tmp.set(color);
    this.col.set([this.tmp.r, this.tmp.g, this.tmp.b], i * 3);
    this.life[i] = this.max[i] = life; this.s0[i] = size; this.size[i] = size; this.alpha[i] = 1; this.grav[i] = grav;
  }
  burst(p, color, n, speed, life = 0.8, size = 0.04, grav = 4) {
    for (let k = 0; k < n; k++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), s = speed * (0.3 + Math.random() * 0.7);
      this.spawn(p[0], p[1], p[2], Math.cos(a) * r * s, u * s, Math.sin(a) * r * s, life * (0.5 + Math.random() * 0.6), size * (0.5 + Math.random()), color, grav);
    }
  }
  update(dt) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      this.v[i * 3 + 1] -= this.grav[i] * dt;
      for (let j = 0; j < 3; j++) { this.v[i * 3 + j] *= 1 - 0.8 * dt; this.p[i * 3 + j] += this.v[i * 3 + j] * dt; }
      if (this.p[i * 3 + 1] < 0.01) { this.p[i * 3 + 1] = 0.01; this.v[i * 3 + 1] *= -0.3; }
      const f = Math.max(0, this.life[i] / this.max[i]);
      this.alpha[i] = Math.min(1, f * 2);
      this.size[i] = this.s0[i] * (0.5 + 0.5 * f);
    }
    for (const a of ['position', 'size', 'alpha', 'pcolor']) this.geo.attributes[a].needsUpdate = true;
  }
}
void CUP; void laneDir;
