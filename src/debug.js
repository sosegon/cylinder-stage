import GUI from 'lil-gui';
import { BAND_COUNT } from './mapping.js';
import { PARAM_GROUPS } from './params.js';

export function mountDebug(app) {
  const gui = new GUI({ title: 'Cylinder Stage' });
  gui.domElement.style.maxHeight = '100vh';
  gui.domElement.style.overflow = 'auto';
  gui.domElement.style.zIndex = '1000';

  const status = { export: '', audio: app.audio.getStatus() };
  const tone = { on: false, frequency: 80 };
  app._tone = tone;

  const actions = {
    riseAll: () => app.riseAll(),
    fallAll: () => app.fallAll(),
    copyValues: () => copyValues(app, status, exportController),
    loadValues: () => loadValues(app),
    playStop: () => app.audio.togglePlayback(),
    loadAudioFile: () => app.audio.pickAudioFile(),
  };

  gui.add(actions, 'riseAll').name('riseAll()');
  gui.add(actions, 'fallAll').name('fallAll()');
  gui.add(actions, 'copyValues').name('copy values');
  gui.add(actions, 'loadValues').name('load values');
  const exportController = gui.add(status, 'export').name('export').disable();
  const audioStatusController = gui.add(status, 'audio').name('audio status').disable();

  const controllers = [];
  for (let g = 0; g < PARAM_GROUPS.length; g += 1) {
    const group = PARAM_GROUPS[g];
    const folder = gui.addFolder(group.title);
    for (let i = 0; i < group.items.length; i += 1) {
      controllers.push(addParam(folder, app, group.items[i]));
    }
    if (group.id === 'audio') addAudioControls(folder, app, actions, tone);
  }

  const derived = {
    baseWidth: 0,
    tipWidth: 0,
    erectHeight: 0,
    tipInward: 0,
    eyeHeight: 0,
    profile: '',
    floorClearance: 0,
    neighborGap: 0,
    fps: 0,
  };
  const derivedFolder = gui.addFolder('Derived');
  const derivedKeys = [
    'baseWidth',
    'tipWidth',
    'erectHeight',
    'tipInward',
    'eyeHeight',
    'profile',
    'floorClearance',
    'neighborGap',
    'fps',
  ];
  const derivedControllers = [];
  for (let i = 0; i < derivedKeys.length; i += 1) {
    const label = derivedKeys[i] === 'neighborGap' ? 'neighborGap °' : derivedKeys[i];
    derivedControllers.push(derivedFolder.add(derived, derivedKeys[i]).name(label).disable());
  }

  const energy = {};
  const energyControllers = [];
  const energyFolder = gui.addFolder('Band energy');
  for (let b = 0; b < BAND_COUNT; b += 1) {
    const key = 'b' + b;
    energy[key] = 0;
    const name = b === 0 ? 'band 0 · center' : b === BAND_COUNT - 1 ? 'band 15 · outer' : 'band ' + b;
    energyControllers.push(energyFolder.add(energy, key, 0, 1, 0.001).name(name).disable());
  }

  function refreshControllers() {
    for (let i = 0; i < controllers.length; i += 1) controllers[i].updateDisplay();
    tone.on = app.audio.isTestToneOn();
    tone.frequency = app.audio.getTestToneFrequency();
    for (let i = 0; i < toneControllers.length; i += 1) toneControllers[i].updateDisplay();
  }

  const toneControllers = app._toneControllers || [];
  app.onSnapshotApplied = refreshControllers;

  let frames = 0;
  let windowStart = performance.now();
  app.stats = {
    addFrame() {
      frames += 1;
    },
  };

  const readTimer = window.setInterval(() => {
    const now = performance.now();
    const elapsed = (now - windowStart) / 1000;
    derived.fps = elapsed > 0 ? frames / elapsed : 0;
    frames = 0;
    windowStart = now;
    const info = app.readDerived();
    derived.baseWidth = info.baseWidth;
    derived.tipWidth = info.tipWidth;
    derived.erectHeight = info.erectHeight;
    derived.tipInward = info.tipInward;
    derived.eyeHeight = info.eyeHeight;
    derived.profile = info.profile;
    derived.floorClearance = info.floorClearance;
    derived.neighborGap = info.neighborGap;
    status.audio = app.audio.getStatus();
    for (let b = 0; b < BAND_COUNT; b += 1) energy['b' + b] = app.bands[b];
    for (let i = 0; i < derivedControllers.length; i += 1) derivedControllers[i].updateDisplay();
    for (let i = 0; i < energyControllers.length; i += 1) energyControllers[i].updateDisplay();
    audioStatusController.updateDisplay();
  }, 250);

  window.addEventListener('pagehide', () => window.clearInterval(readTimer));
  return gui;
}

function addParam(folder, app, item) {
  let controller;
  if (item.type === 'color') controller = folder.addColor(app.params, item.key);
  else if (item.type === 'select') controller = folder.add(app.params, item.key, item.options);
  else if (item.type === 'boolean') controller = folder.add(app.params, item.key);
  else if (item.type === 'text') controller = folder.add(app.params, item.key);
  else controller = folder.add(app.params, item.key, item.min, item.max, item.step);
  if (item.label) controller.name(item.label);
  if (item.on === 'geometry') controller.onChange(() => app.rebuild());
  if (item.on === 'barColor') controller.onChange((value) => app.motion.setAllColor(value));
  if (item.on === 'audioSrc') {
    controller.onFinishChange((value) => {
      if (app.audio.isUnlocked()) app.audio.loadUrl(value, true).catch(() => {});
    });
  }
  return controller;
}

function addAudioControls(folder, app, actions, tone) {
  folder.add(actions, 'loadAudioFile').name('load audio file');
  folder.add(actions, 'playStop').name('play / stop');
  const onController = folder.add(tone, 'on').name('test tone').onChange((on) => {
    app.audio.setTestTone(on, tone.frequency);
  });
  const freqController = folder.add(tone, 'frequency', 20, 16000, 1).name('test tone Hz').onChange((frequency) => {
    app.audio.setTestTone(tone.on, frequency);
  });
  app._toneControllers = [onController, freqController];
}

async function copyValues(app, status, exportController) {
  const json = JSON.stringify(app.getSnapshot(), null, 2);
  try {
    await navigator.clipboard.writeText(json);
    status.export = 'copied';
  } catch (err) {
    console.log(json);
    status.export = 'logged to console';
  }
  exportController.updateDisplay();
}

function loadValues(app) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;
    file.text().then((text) => {
      app.loadSnapshot(JSON.parse(text));
    }).catch(() => {
      console.warn('Could not read parameter JSON.');
    });
  };
  input.click();
}
