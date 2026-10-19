/** Every SPEC value tagged [provisional], plus the debug tilt input from §5. */

export const PARAM_GROUPS = [
  {
    id: 'stage',
    title: '1 · Stage geometry',
    items: [
      { key: 'radius', value: 8, min: 2, max: 30, step: 0.01, on: 'geometry' },
      { key: 'barLength', value: 6, min: 0.5, max: 20, step: 0.01, on: 'geometry', label: 'barLength (L)' },
      { key: 'tipWidthRatio', value: 1, min: 0.05, max: 1, step: 0.01, on: 'geometry' },
      { key: 'backgroundColor', value: '#000000', type: 'color' },
    ],
  },
  {
    id: 'shape',
    title: '2 · Bar shape',
    items: [
      { key: 'tipInwardOffset', value: 0.35, min: 0, max: 0.95, step: 0.01, on: 'geometry', label: 'tipInwardOffset × L' },
      { key: 'profileCurvePower', value: 2, min: 1.01, max: 8, step: 0.01, on: 'geometry' },
      { key: 'lengthSegments', value: 64, min: 4, max: 256, step: 1, on: 'geometry' },
      { key: 'barColor', value: '#CCCCCC', type: 'color', on: 'barColor' },
    ],
  },
  {
    id: 'camera',
    title: '3 · Camera',
    items: [
      { key: 'eyeHeightRatio', value: 0.45, min: 0.05, max: 0.49, step: 0.01 },
      { key: 'pitchUpLimit', value: 25, min: 0, max: 85, step: 0.5 },
      { key: 'pitchDownLimit', value: 15, min: 0, max: 85, step: 0.5 },
      { key: 'fov', value: 75, min: 30, max: 140, step: 0.5 },
      { key: 'viewDistance', value: 26, min: 0, max: 90, step: 0.5, label: 'viewDistance m (zoom out)' },
      { key: 'dragSensitivity', value: 0.15, min: 0.01, max: 1, step: 0.01, label: 'dragSensitivity °/px' },
      { key: 'inertiaDamping', value: 0.9, min: 0, max: 0.99, step: 0.01 },
    ],
  },
  {
    id: 'lifecycle',
    title: '4 · Lifecycle',
    items: [
      { key: 'riseDuration', value: 1.6, min: 0.05, max: 20, step: 0.01 },
      { key: 'riseEasing', value: 'easeInOutCubic', type: 'select', options: ['easeInOutCubic'] },
      {
        key: 'risePattern',
        value: 'centerOut',
        type: 'select',
        options: ['simultaneous', 'centerOut', 'edgesIn', 'leftToRight'],
      },
      { key: 'riseStagger', value: 0.045, min: 0, max: 2, step: 0.01 },
    ],
  },
  {
    id: 'tilt',
    title: '5 · Tilt',
    items: [
      { key: 'maxTilt', value: 12.5, min: 10, max: 15, step: 0.1 },
      { key: 'tiltSmoothing', value: 0.15, min: 0, max: 2, step: 0.01 },
      { key: 'tiltInput', value: 0, min: 0, max: 1, step: 0.01, label: 'tiltInput (all bars)' },
      { key: 'tiltTestSignal', value: false, type: 'boolean' },
    ],
  },
  {
    id: 'deform',
    title: '6 · Deformation',
    items: [
      { key: 'minFrequency', value: 30, min: 20, max: 2000, step: 1 },
      { key: 'maxFrequency', value: 16000, min: 200, max: 20000, step: 1 },
      { key: 'fftSize', value: 2048, type: 'select', options: [256, 512, 1024, 2048, 4096, 8192] },
      { key: 'analyserSmoothing', value: 0.8, min: 0, max: 1, step: 0.01 },
      { key: 'attack', value: 0.03, min: 0.001, max: 1, step: 0.001 },
      { key: 'release', value: 0.25, min: 0.01, max: 2, step: 0.01 },
      { key: 'deformAmplitude', value: 0.22, min: 0, max: 0.5, step: 0.001, label: 'deformAmplitude × L' },
      { key: 'deformWaves', value: 3.5, min: 0, max: 8, step: 0.1 },
      { key: 'deformSpeed', value: 1.75, min: 0, max: 4, step: 0.01 },
    ],
  },
  {
    id: 'mood',
    title: '7 · Mood',
    items: [
      { key: 'tempo', value: 1, min: 0.1, max: 4, step: 0.01 },
      { key: 'colorTransitionBase', value: 1.5, min: 0.05, max: 10, step: 0.01 },
    ],
  },
  {
    id: 'audio',
    title: '8 · Audio',
    items: [
      { key: 'audioSrc', value: '/audio/test.mp3', type: 'text', on: 'audioSrc' },
      { key: 'volume', value: 0.8, min: 0, max: 1, step: 0.01 },
    ],
  },
];

const UNITS = {
  tipInwardOffset: 'fraction of barLength (meters = fraction × barLength)',
  deformAmplitude: 'fraction of barLength (meters = fraction × barLength)',
  angles: 'degrees',
  lengths: 'meters',
  time: 'seconds',
  dragSensitivity: 'degrees per pixel',
};

export function createParams() {
  const params = {};
  for (let g = 0; g < PARAM_GROUPS.length; g += 1) {
    const items = PARAM_GROUPS[g].items;
    for (let i = 0; i < items.length; i += 1) {
      params[items[i].key] = items[i].value;
    }
  }
  return params;
}

export function applyParamValues(params, values) {
  if (!values || typeof values !== 'object') return;
  for (let g = 0; g < PARAM_GROUPS.length; g += 1) {
    const items = PARAM_GROUPS[g].items;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (values[item.key] === undefined) continue;
      const incoming = values[item.key];
      if (item.type === 'color' || item.type === 'text') {
        params[item.key] = String(incoming);
        continue;
      }
      if (item.type === 'boolean') {
        params[item.key] = coerceBoolean(incoming);
        continue;
      }
      if (item.type === 'select') {
        const match = item.options.find((option) => option === incoming || String(option) === String(incoming));
        if (match !== undefined) params[item.key] = match;
        continue;
      }
      let numeric = Number(incoming);
      if (Number.isNaN(numeric)) continue;
      if (item.min != null && numeric < item.min) numeric = item.min;
      if (item.max != null && numeric > item.max) numeric = item.max;
      if (item.step === 1) numeric = Math.round(numeric);
      params[item.key] = numeric;
    }
  }
}

function coerceBoolean(value) {
  if (value === 'off' || value === 'false') return false;
  if (value === 'on' || value === 'true') return true;
  return Boolean(value);
}

export function buildSnapshot(params, extras) {
  const values = {};
  for (let g = 0; g < PARAM_GROUPS.length; g += 1) {
    const items = PARAM_GROUPS[g].items;
    for (let i = 0; i < items.length; i += 1) {
      values[items[i].key] = params[items[i].key];
    }
  }
  return {
    spec: 'cylinder-stage/1',
    units: UNITS,
    values,
    bars: extras.bars,
    deformPhase: extras.deformPhase,
    tiltPhase: extras.tiltPhase,
    camera: extras.camera,
    debug: extras.debug,
  };
}
