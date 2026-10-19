import { parseColor, rgbToHex } from './color.js';
import { BAR_COUNT, DEG, barAngle, clamp01, easeInOutCubic, riseDelay } from './mapping.js';

/** Traveling tilt test wave. Tempo scales it (SPEC §7). The shape is fixed. */
const TILT_SIGNAL_HZ = 0.35;
const TILT_SIGNAL_SPATIAL = 0.55;

export function colorRate(tempo, base) {
  const safe = base > 0.0001 ? base : 0.0001;
  return tempo / safe;
}

export function deformRate(speed, tempo) {
  return speed * tempo;
}

export function createMotion(params) {
  const erect = new Float32Array(BAR_COUNT);
  const tilt = new Float32Array(BAR_COUNT);
  const color = new Float32Array(BAR_COUNT * 3);
  const tilt01 = new Float32Array(BAR_COUNT);
  const tiltTarget = new Float32Array(BAR_COUNT);
  const animFrom = new Float32Array(BAR_COUNT);
  const animTo = new Float32Array(BAR_COUNT);
  const animElapsed = new Float32Array(BAR_COUNT);
  const animDelay = new Float32Array(BAR_COUNT);
  const animOn = new Uint8Array(BAR_COUNT);
  const colorFrom = new Float32Array(BAR_COUNT * 3);
  const colorTo = new Float32Array(BAR_COUNT * 3);
  const colorT = new Float32Array(BAR_COUNT);
  const side = new Uint8Array(BAR_COUNT);
  const halfColor = new Float32Array(6);
  let palette = null;
  let halfHold = 1.6;
  for (let i = 0; i < BAR_COUNT; i += 1) side[i] = Math.sin(barAngle(i)) >= 0 ? 1 : 0;
  let deformPhase = 0;
  let tiltPhase = 0;

  const initial = parseColor(params.barColor) || [0.8, 0.8, 0.8];
  for (let i = 0; i < BAR_COUNT; i += 1) {
    const o = i * 3;
    color[o] = initial[0];
    color[o + 1] = initial[1];
    color[o + 2] = initial[2];
    colorFrom[o] = initial[0];
    colorFrom[o + 1] = initial[1];
    colorFrom[o + 2] = initial[2];
    colorTo[o] = initial[0];
    colorTo[o + 1] = initial[1];
    colorTo[o + 2] = initial[2];
    colorT[i] = 1;
  }

  function startAnim(index, to, delay) {
    animFrom[index] = erect[index];
    animTo[index] = to;
    animDelay[index] = delay > 0 ? delay : 0;
    animElapsed[index] = 0;
    animOn[index] = 1;
  }

  function riseAll() {
    for (let i = 0; i < BAR_COUNT; i += 1) {
      startAnim(i, 1, riseDelay(i, params.risePattern, params.riseStagger));
    }
  }

  function fallAll() {
    for (let i = 0; i < BAR_COUNT; i += 1) {
      startAnim(i, 0, riseDelay(i, params.risePattern, params.riseStagger));
    }
  }

  function setBarState(index, state) {
    if (index < 0 || index >= BAR_COUNT) return;
    const to = normalizeState(state);
    if (to < 0) return;
    startAnim(index, to, 0);
  }

  function setBarColor(index, input) {
    if (index < 0 || index >= BAR_COUNT) return;
    const rgb = parseColor(input);
    if (!rgb) return;
    const o = index * 3;
    colorFrom[o] = color[o];
    colorFrom[o + 1] = color[o + 1];
    colorFrom[o + 2] = color[o + 2];
    colorTo[o] = rgb[0];
    colorTo[o + 1] = rgb[1];
    colorTo[o + 2] = rgb[2];
    colorT[index] = 0;
  }

  function setAllColor(input) {
    for (let i = 0; i < BAR_COUNT; i += 1) setBarColor(i, input);
  }

  function snapAllColor(input) {
    const rgb = parseColor(input);
    if (!rgb) return;
    for (let i = 0; i < BAR_COUNT; i += 1) writeColor(i, rgb[0], rgb[1], rgb[2]);
  }

  function writeColor(index, r, g, b) {
    const o = index * 3;
    color[o] = r;
    color[o + 1] = g;
    color[o + 2] = b;
    colorFrom[o] = r;
    colorFrom[o + 1] = g;
    colorFrom[o + 2] = b;
    colorTo[o] = r;
    colorTo[o + 1] = g;
    colorTo[o + 2] = b;
    colorT[index] = 1;
  }

  function applyBars(bars, currentParams) {
    const maxTilt = currentParams.maxTilt * DEG;
    const count = bars.length < BAR_COUNT ? bars.length : BAR_COUNT;
    for (let i = 0; i < count; i += 1) {
      const bar = bars[i];
      if (!bar) continue;
      if (typeof bar.erect === 'number') {
        erect[i] = clamp01(bar.erect);
        animOn[i] = 0;
      }
      if (typeof bar.tilt === 'number') {
        tilt01[i] = clamp01(bar.tilt);
        tiltTarget[i] = tilt01[i];
        tilt[i] = tilt01[i] * maxTilt;
      }
      if (bar.color) {
        const rgb = parseColor(bar.color);
        if (rgb) writeColor(i, rgb[0], rgb[1], rgb[2]);
      }
    }
  }

  function update(dt) {
    const duration = params.riseDuration > 0.0001 ? params.riseDuration : 0.0001;
    for (let i = 0; i < BAR_COUNT; i += 1) {
      if (!animOn[i]) continue;
      let step = dt;
      if (animDelay[i] > 0) {
        animDelay[i] -= step;
        if (animDelay[i] > 0) continue;
        step = -animDelay[i];
        animDelay[i] = 0;
      }
      animElapsed[i] += step;
      let t = animElapsed[i] / duration;
      if (t > 1) t = 1;
      const eased = params.riseEasing === 'easeInOutCubic' ? easeInOutCubic(t) : t;
      erect[i] = animFrom[i] + (animTo[i] - animFrom[i]) * eased;
      if (t >= 1) animOn[i] = 0;
    }

    tiltPhase += dt * params.tempo;
    if (params.tiltTestSignal) {
      const wave = tiltPhase * TILT_SIGNAL_HZ * Math.PI * 2;
      for (let i = 0; i < BAR_COUNT; i += 1) {
        tiltTarget[i] = 0.5 + 0.5 * Math.sin(wave - i * TILT_SIGNAL_SPATIAL);
      }
    } else {
      const input = clamp01(params.tiltInput);
      for (let i = 0; i < BAR_COUNT; i += 1) tiltTarget[i] = input;
    }

    const tau = params.tiltSmoothing;
    const blend = tau <= 0.0001 ? 1 : 1 - Math.exp(-dt / tau);
    const maxTilt = params.maxTilt * DEG;
    for (let i = 0; i < BAR_COUNT; i += 1) {
      tilt01[i] += (tiltTarget[i] - tilt01[i]) * blend;
      if (tilt01[i] < 0) tilt01[i] = 0;
      else if (tilt01[i] > 1) tilt01[i] = 1;
      tilt[i] = tilt01[i] * maxTilt;
    }

    const rate = colorRate(params.tempo, params.colorTransitionBase);
    let fading = false;
    for (let i = 0; i < BAR_COUNT; i += 1) {
      if (colorT[i] >= 1) continue;
      fading = true;
      colorT[i] += dt * rate;
      if (colorT[i] > 1) colorT[i] = 1;
      const t = colorT[i];
      const o = i * 3;
      color[o] = colorFrom[o] + (colorTo[o] - colorFrom[o]) * t;
      color[o + 1] = colorFrom[o + 1] + (colorTo[o + 1] - colorFrom[o + 1]) * t;
      color[o + 2] = colorFrom[o + 2] + (colorTo[o + 2] - colorFrom[o + 2]) * t;
    }
    if (!fading && palette) {
      halfHold -= dt * params.tempo;
      if (halfHold <= 0) {
        paintHalves(false);
        halfHold = 2.2 + Math.random() * 2.8;
      }
    }

    deformPhase += dt * deformRate(params.deformSpeed, params.tempo);
  }

  function setPalette(colors) {
    if (!colors || colors.length < 3) return;
    palette = colors;
    paintHalves(true);
    halfHold = 2.2 + Math.random() * 2.8;
  }

  function paintHalves(snap) {
    chooseHalfColors();
    for (let i = 0; i < BAR_COUNT; i += 1) {
      const src = side[i] === 1 ? 3 : 0;
      const o = i * 3;
      if (snap) {
        color[o] = halfColor[src];
        color[o + 1] = halfColor[src + 1];
        color[o + 2] = halfColor[src + 2];
        colorFrom[o] = color[o];
        colorFrom[o + 1] = color[o + 1];
        colorFrom[o + 2] = color[o + 2];
        colorTo[o] = color[o];
        colorTo[o + 1] = color[o + 1];
        colorTo[o + 2] = color[o + 2];
        colorT[i] = 1;
      } else {
        colorFrom[o] = color[o];
        colorFrom[o + 1] = color[o + 1];
        colorFrom[o + 2] = color[o + 2];
        colorTo[o] = halfColor[src];
        colorTo[o + 1] = halfColor[src + 1];
        colorTo[o + 2] = halfColor[src + 2];
        colorT[i] = 0;
      }
    }
  }

  function chooseHalfColors() {
    const count = (palette.length / 3) | 0;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      writeSample(0, count);
      writeSample(3, count);
      const dr = halfColor[0] - halfColor[3];
      const dg = halfColor[1] - halfColor[4];
      const db = halfColor[2] - halfColor[5];
      if (dr * dr + dg * dg + db * db > 0.08) return;
    }
  }

  function writeSample(offset, count) {
    let pick = (Math.random() * count) | 0;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const s = pick * 3;
      const luma = palette[s] * 0.3 + palette[s + 1] * 0.5 + palette[s + 2] * 0.2;
      if (luma > 0.22) break;
      pick = (Math.random() * count) | 0;
    }
    const s = pick * 3;
    halfColor[offset] = palette[s];
    halfColor[offset + 1] = palette[s + 1];
    halfColor[offset + 2] = palette[s + 2];
  }

  function barSnapshots() {
    const maxTilt = params.maxTilt * DEG;
    const bars = [];
    for (let i = 0; i < BAR_COUNT; i += 1) {
      const o = i * 3;
      bars.push({
        erect: erect[i],
        tilt: maxTilt > 0 ? tilt[i] / maxTilt : 0,
        color: rgbToHex(color[o], color[o + 1], color[o + 2]),
      });
    }
    return bars;
  }

  return {
    erect,
    tilt,
    color,
    riseAll,
    fallAll,
    setBarState,
    setBarColor,
    setPalette,
    setAllColor,
    snapAllColor,
    applyBars,
    update,
    barSnapshots,
    getDeformPhase: () => deformPhase,
    setDeformPhase: (value) => {
      deformPhase = value;
    },
    getTiltPhase: () => tiltPhase,
    setTiltPhase: (value) => {
      tiltPhase = value;
    },
  };
}

function normalizeState(state) {
  if (state === 'erect' || state === 'Erect' || state === 1) return 1;
  if (state === 'rest' || state === 'Rest' || state === 0) return 0;
  return -1;
}
