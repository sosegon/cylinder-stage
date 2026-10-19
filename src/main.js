import './style.css';
import * as THREE from 'three';
import { createAudio } from './audio.js';
import { createBars } from './bars.js';
import { createCenterLines } from './centerline.js';
import { measureClearance } from './clearance.js';
import { parseColor } from './color.js';
import { createLook } from './look.js';
import { BAR_COUNT, baseWidth } from './mapping.js';
import { createMotion } from './motion.js';
import { loadPalette } from './palette.js';
import { applyParamValues, buildSnapshot, createParams } from './params.js';

const debugEnabled = new URLSearchParams(window.location.search).has('debug');

const app = {
  params: createParams(),
  bands: new Float32Array(16),
  stats: null,
  onSnapshotApplied: null,
};

const gate = document.getElementById('start-gate');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: debugEnabled,
  });
} catch (err) {
  gate.textContent = 'WebGL is required.';
  throw err;
}

if (!renderer.getContext()) {
  gate.textContent = 'WebGL is required.';
  throw new Error('WebGL unavailable');
}

renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const background = new THREE.Color();
scene.background = background;
const camera = new THREE.PerspectiveCamera(app.params.fov, 1, 0.05, 250);
camera.position.set(0, 1, 0);

const motion = createMotion(app.params);
const audio = createAudio(app.params, app.bands);
const bars = createBars(scene, app.params, {
  tilt: motion.tilt,
  erect: motion.erect,
  color: motion.color,
  bands: app.bands,
});
const look = createLook(app.params, camera);

const geometryCache = {
  radius: null,
  barLength: null,
  tipWidthRatio: null,
  tipInwardOffset: null,
  profileCurvePower: null,
  lengthSegments: null,
};
let currentProfile = bars.getProfile();
const centerLines = createCenterLines(scene);
centerLines.setProfile(currentProfile);
let measured = measureClearance(currentProfile, app.params);
let bgHex = '';
const sized = { dpr: 0, w: 0, h: 0 };

function rememberGeometry(profile) {
  currentProfile = profile;
  geometryCache.radius = app.params.radius;
  geometryCache.barLength = app.params.barLength;
  geometryCache.tipWidthRatio = app.params.tipWidthRatio;
  geometryCache.tipInwardOffset = app.params.tipInwardOffset;
  geometryCache.profileCurvePower = app.params.profileCurvePower;
  geometryCache.lengthSegments = app.params.lengthSegments;
  measured = measureClearance(profile, app.params);
  if (centerLines) centerLines.setProfile(profile);
}

function geometryStale() {
  return app.params.radius !== geometryCache.radius
    || app.params.barLength !== geometryCache.barLength
    || app.params.tipWidthRatio !== geometryCache.tipWidthRatio
    || app.params.tipInwardOffset !== geometryCache.tipInwardOffset
    || app.params.profileCurvePower !== geometryCache.profileCurvePower
    || app.params.lengthSegments !== geometryCache.lengthSegments;
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

function readDerived() {
  const base = baseWidth(app.params.radius);
  const ratio = app.params.eyeHeightRatio > 0.499 ? 0.499 : app.params.eyeHeightRatio;
  let profile = currentProfile.valid ? 'ok' : 'tip offset clamped';
  if (measured.minY < -0.001 || measured.angularGap < 0) profile += ' · may intersect';
  return {
    baseWidth: round4(base),
    tipWidth: round4(base * app.params.tipWidthRatio),
    erectHeight: round4(currentProfile.height),
    tipInward: round4(currentProfile.tipInward),
    eyeHeight: round4(ratio * currentProfile.height),
    profile,
    floorClearance: round4(measured.minY),
    neighborGap: round4(measured.angularGap * 180 / Math.PI),
  };
}

function rebuild() {
  rememberGeometry(bars.rebuild(app.params));
  syncView();
}

function syncView() {
  const ratio = app.params.eyeHeightRatio > 0.499 ? 0.499 : app.params.eyeHeightRatio;
  const eye = ratio * currentProfile.height;
  camera.position.x = 0;
  camera.position.z = app.params.viewDistance;
  const overview = eye + app.params.viewDistance * 0.55;
  if (camera.position.y !== overview) camera.position.y = overview;
  if (camera.fov !== app.params.fov) {
    camera.fov = app.params.fov;
    camera.updateProjectionMatrix();
  }
  if (bgHex !== app.params.backgroundColor) {
    bgHex = app.params.backgroundColor;
    const rgb = parseColor(bgHex);
    if (rgb) background.setRGB(rgb[0], rgb[1], rgb[2], THREE.LinearSRGBColorSpace);
  }
}

function applySize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (dpr === sized.dpr && w === sized.w && h === sized.h) return;
  sized.dpr = dpr;
  sized.w = w;
  sized.h = h;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}

function getSnapshot() {
  return buildSnapshot(app.params, {
    bars: motion.barSnapshots(),
    deformPhase: motion.getDeformPhase(),
    tiltPhase: motion.getTiltPhase(),
    camera: look.getAngles(),
    debug: {
      testTone: audio.isTestToneOn(),
      testToneFrequency: audio.getTestToneFrequency(),
    },
  });
}

function loadSnapshot(data) {
  const source = typeof data === 'string' ? JSON.parse(data) : data;
  applyParamValues(app.params, source.values || source);
  if (Array.isArray(source.bars)) motion.applyBars(source.bars, app.params);
  else motion.snapAllColor(app.params.barColor);
  if (typeof source.deformPhase === 'number') motion.setDeformPhase(source.deformPhase);
  if (typeof source.tiltPhase === 'number') motion.setTiltPhase(source.tiltPhase);
  if (source.camera) look.setAngles(source.camera.yaw || 0, source.camera.pitch || 0);
  if (source.debug && source.debug.testTone) {
    audio.setTestTone(true, source.debug.testToneFrequency || 80);
  } else if (audio.isUnlocked()) {
    audio.setTestTone(false, source.debug ? source.debug.testToneFrequency : undefined);
  }
  rebuild();
  if (app.onSnapshotApplied) app.onSnapshotApplied();
}

app.audio = audio;
app.motion = motion;
app.rebuild = rebuild;
app.readDerived = readDerived;
app.riseAll = motion.riseAll;
app.fallAll = motion.fallAll;
app.getSnapshot = getSnapshot;
app.loadSnapshot = loadSnapshot;

window.stage = {
  riseAll: motion.riseAll,
  fallAll: motion.fallAll,
  setBarState: motion.setBarState,
  setBarColor: motion.setBarColor,
  getSnapshot,
  loadSnapshot,
};

if (debugEnabled) {
  window.stage.debug = {
    meshCount: () => bars.mesh.count,
    getCameraState: () => ({
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      yaw: look.getAngles().yaw,
      pitch: look.getAngles().pitch,
    }),
    getBands: () => Array.from(app.bands),
    getErect: () => Array.from(motion.erect),
    getTilt: () => Array.from(motion.tilt),
    getColor: (index) => {
      const o = index * 3;
      return [motion.color[o], motion.color[o + 1], motion.color[o + 2]];
    },
    getBandIndex: (index) => bars.bandIndex(index),
    getDerived: readDerived,
    setTestTone: (on, frequency) => audio.setTestTone(on, frequency),
    readPixel: (x, y) => {
      const gl = renderer.getContext();
      const buf = new Uint8Array(4);
      gl.readPixels(x | 0, y | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return [buf[0], buf[1], buf[2], buf[3]];
    },
    barCount: BAR_COUNT,
  };
}

rememberGeometry(currentProfile);
syncView();
applySize();

let running = true;
let runId = 0;
let showTime = 0;
motion.riseAll();

audio.setOnEnded(() => {
  if (!running) return;
  running = false;
  runId += 1;
  gate.textContent = 'Start';
  motion.fallAll();
});

gate.addEventListener('click', () => {
  if (audio.isPlaying()) {
    running = false;
    runId += 1;
    audio.stop();
    motion.fallAll();
    gate.textContent = 'Start';
    return;
  }
  if (!running) {
    running = true;
    motion.riseAll();
  }
  const id = (runId += 1);
  gate.textContent = 'Stop';
  audio.unlockAndPlay().then(() => {
    if (id !== runId) return;
    if (!audio.isPlaying()) gate.textContent = 'Start';
  });
});

let lastTime = 0;
function frame(now) {
  // SPEC §10: this loop only writes numbers and reuses existing buffers.
  if (lastTime === 0) lastTime = now;
  let dt = (now - lastTime) * 0.001;
  lastTime = now;
  if (dt > 0.1) dt = 0.1;
  if (dt < 0) dt = 0;

  look.update(dt);
  motion.update(dt);
  centerLines.update(app.params, motion.erect, motion.tilt);
  audio.update(dt);
  if (geometryStale()) rebuild();
  syncView();
  applySize();
  showTime += dt;
  bars.sync(app.params, motion.getDeformPhase(), showTime);
  if (app.stats) app.stats.addFrame();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

loadPalette('/palette.png').then((colors) => {
  if (colors) motion.setPalette(colors);
});

async function boot() {
  if (debugEnabled) {
    const { mountDebug } = await import('./debug.js');
    mountDebug(app);
  }
  requestAnimationFrame(frame);
}

boot();
