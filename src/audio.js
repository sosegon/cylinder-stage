import { BAND_COUNT } from './mapping.js';

/**
 * Soundtrack, analyser, and per-band attack/release envelope. SPEC §6 and §8.
 * Band energy is the loudest bin in that logarithmic band, scaled to 0–1.
 * A pure test tone then reads clearly in one band instead of being diluted
 * across a wide average. Silence stays at 0, so the bars do not deform.
 */
export function createAudio(params, bands) {
  let ctx = null;
  let master = null;
  let analyser = null;
  let freqData = null;
  let toneOsc = null;
  let toneGain = null;
  let fileGain = null;
  let fileSource = null;
  let buffer = null;
  let unlocked = false;
  let toneOn = false;
  let toneFrequency = 80;
  let playing = false;
  let status = 'locked';
  let onEnded = null;
  let playGeneration = 0;
  const env = new Float32Array(BAND_COUNT);
  const edges = new Float32Array(BAND_COUNT + 1);

  function ensure() {
    if (ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = params.volume;
    fileGain = ctx.createGain();
    toneGain = ctx.createGain();
    toneGain.gain.value = 0;
    analyser = ctx.createAnalyser();
    analyser.fftSize = params.fftSize | 0;
    analyser.smoothingTimeConstant = clamp01(params.analyserSmoothing);
    fileGain.connect(master);
    toneGain.connect(master);
    master.connect(analyser);
    analyser.connect(ctx.destination);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    toneOsc = ctx.createOscillator();
    toneOsc.type = 'sine';
    toneOsc.frequency.value = toneFrequency;
    toneOsc.connect(toneGain);
    toneOsc.start();
    status = 'ready';
  }

  async function unlockAndPlay() {
    ensure();
    try {
      await ctx.resume();
    } catch (err) {
      status = 'audio blocked';
    }
    unlocked = true;
    try {
      await loadUrl(params.audioSrc, true);
    } catch (err) {
      if (status !== 'playing') status = 'no file';
    }
  }

  async function loadUrl(url, play) {
    ensure();
    const generation = playGeneration;
    status = 'loading';
    const response = await fetch(url);
    if (generation !== playGeneration) return;
    const type = response.headers.get('content-type') || '';
    if (!response.ok || type.includes('text/html')) {
      status = 'no file';
      throw new Error('missing audio');
    }
    const data = await response.arrayBuffer();
    if (generation !== playGeneration) return;
    await loadArrayBuffer(data, play);
  }

  async function loadArrayBuffer(arrayBuffer, play) {
    ensure();
    const generation = playGeneration;
    try {
      buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    } catch (err) {
      if (generation !== playGeneration) return;
      status = 'decode failed';
      buffer = null;
      return;
    }
    if (generation !== playGeneration) return;
    status = 'loaded';
    if (play) startFile();
  }

  function startFile() {
    if (!buffer || !ctx) return;
    stopFile();
    if (toneOn) setTestTone(false, toneFrequency);
    fileSource = ctx.createBufferSource();
    fileSource.buffer = buffer;
    fileSource.connect(fileGain);
    fileGain.gain.value = 1;
    fileSource.onended = () => {
      playing = false;
      if (status === 'playing') status = 'ended';
      if (onEnded) onEnded();
    };
    fileSource.start();
    playing = true;
    status = 'playing';
  }

  function stopFile() {
    if (!fileSource) return;
    fileSource.onended = null;
    try {
      fileSource.stop();
    } catch (err) {
      // Already stopped.
    }
    fileSource.disconnect();
    fileSource = null;
    playing = false;
  }

  function stop() {
    playGeneration += 1;
    stopFile();
    if (status === 'playing' || status === 'loading' || status === 'loaded') status = 'stopped';
  }

  function isPlaying() {
    return playing;
  }

  function setOnEnded(fn) {
    onEnded = fn;
  }

  function togglePlayback() {
    if (!unlocked) {
      unlockAndPlay();
      return;
    }
    if (playing) {
      stopFile();
      status = 'stopped';
      return;
    }
    if (!buffer) {
      loadUrl(params.audioSrc, true).catch(() => {
        status = 'no file';
      });
      return;
    }
    startFile();
  }

  function pickAudioFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      params.audioSrc = file.name;
      file.arrayBuffer().then((data) => loadArrayBuffer(data, true)).catch(() => {
        status = 'decode failed';
      });
    };
    input.click();
  }

  function setTestTone(on, frequency) {
    if (!on && !ctx) {
      toneOn = false;
      if (typeof frequency === 'number') toneFrequency = frequency;
      return;
    }
    ensure();
    ctx.resume();
    if (typeof frequency === 'number' && frequency > 0) {
      toneFrequency = frequency;
      toneOsc.frequency.value = frequency;
    }
    toneOn = Boolean(on);
    toneGain.gain.value = toneOn ? 1 : 0;
    if (toneOn) {
      stopFile();
      status = 'test tone';
    } else if (status === 'test tone') {
      status = 'ready';
    }
  }

  function update(dt) {
    if (!analyser) return;
    const fft = params.fftSize | 0;
    if (analyser.fftSize !== fft) {
      analyser.fftSize = fft;
      freqData = new Uint8Array(analyser.frequencyBinCount);
    }
    const smoothing = clamp01(params.analyserSmoothing);
    if (analyser.smoothingTimeConstant !== smoothing) {
      analyser.smoothingTimeConstant = smoothing;
    }
    if (master.gain.value !== params.volume) master.gain.value = params.volume;

    analyser.getByteFrequencyData(freqData);
    const nyquist = ctx.sampleRate * 0.5;
    const binCount = analyser.frequencyBinCount;
    let minF = params.minFrequency;
    let maxF = params.maxFrequency;
    if (minF < 1) minF = 1;
    if (maxF > nyquist - 1) maxF = nyquist - 1;
    if (maxF <= minF) maxF = Math.min(nyquist - 1, minF * 2);
    const logMin = Math.log(minF);
    const logMax = Math.log(maxF);
    for (let i = 0; i <= BAND_COUNT; i += 1) {
      const freq = Math.exp(logMin + (logMax - logMin) * (i / BAND_COUNT));
      edges[i] = (freq / nyquist) * binCount;
    }
    for (let b = 0; b < BAND_COUNT; b += 1) {
      let i0 = edges[b] | 0;
      let i1 = Math.ceil(edges[b + 1]);
      if (i0 < 0) i0 = 0;
      if (i1 > binCount) i1 = binCount;
      if (i1 <= i0) i1 = Math.min(binCount, i0 + 1);
      let max = 0;
      for (let i = i0; i < i1; i += 1) {
        const sample = freqData[i];
        if (sample > max) max = sample;
      }
      const raw = max / 255;
      const tau = raw > env[b] ? params.attack : params.release;
      const k = tau <= 0.0001 ? 1 : 1 - Math.exp(-dt / tau);
      env[b] += (raw - env[b]) * k;
      bands[b] = env[b];
    }
  }

  function isTestToneOn() {
    return toneOn;
  }

  function getTestToneFrequency() {
    return toneFrequency;
  }

  function getStatus() {
    return status;
  }

  function isUnlocked() {
    return unlocked;
  }

  return {
    unlockAndPlay,
    loadUrl,
    stop,
    isPlaying,
    setOnEnded,
    togglePlayback,
    pickAudioFile,
    setTestTone,
    update,
    isTestToneOn,
    getTestToneFrequency,
    getStatus,
    isUnlocked,
  };
}

function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
