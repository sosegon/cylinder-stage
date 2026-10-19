import * as THREE from 'three';
import { vertexShader, fragmentShader } from './shaders.js';
import { buildRibbon } from './ribbon.js';
import { BAR_COUNT, BAND_COUNT, barAngle, bandIndexForBar } from './mapping.js';

const INSTANCE_KEYS = ['aAngle', 'aBand', 'aIndex', 'aSpin', 'aTilt', 'aErect', 'aColor'];
const TAU = Math.PI * 2;
const BURST_470 = 470 / 360;
const BURST_540 = 540 / 360;

export function createBars(scene, params, shared) {
  const angles = new Float32Array(BAR_COUNT);
  const bands = new Float32Array(BAR_COUNT);
  const indices = new Float32Array(BAR_COUNT);
  for (let i = 0; i < BAR_COUNT; i += 1) {
    angles[i] = barAngle(i);
    bands[i] = bandIndexForBar(i);
    indices[i] = i;
  }

  const angleAttr = new THREE.InstancedBufferAttribute(angles, 1);
  const bandAttr = new THREE.InstancedBufferAttribute(bands, 1);
  const indexAttr = new THREE.InstancedBufferAttribute(indices, 1);
  const spinAngle = new Float32Array(BAR_COUNT);
  const burstLeft = new Float32Array(BAR_COUNT);
  const spinDir = new Float32Array(BAR_COUNT);
  const burstCool = new Float32Array(BAR_COUNT);
  const heard = new Float32Array(BAR_COUNT);
  for (let i = 0; i < BAR_COUNT; i += 1) {
    spinDir[i] = i % 2 === 0 ? 1 : -1;
    burstCool[i] = Math.random() * 1.5;
  }
  const spinAttr = new THREE.InstancedBufferAttribute(spinAngle, 1);
  const tiltAttr = new THREE.InstancedBufferAttribute(shared.tilt, 1);
  const erectAttr = new THREE.InstancedBufferAttribute(shared.erect, 1);
  const colorAttr = new THREE.InstancedBufferAttribute(shared.color, 3);
  angleAttr.setUsage(THREE.StaticDrawUsage);
  bandAttr.setUsage(THREE.StaticDrawUsage);
  indexAttr.setUsage(THREE.StaticDrawUsage);
  spinAttr.setUsage(THREE.DynamicDrawUsage);
  tiltAttr.setUsage(THREE.DynamicDrawUsage);
  erectAttr.setUsage(THREE.DynamicDrawUsage);
  colorAttr.setUsage(THREE.DynamicDrawUsage);

  const built = buildRibbon(params);
  attach(built.geometry, angleAttr, bandAttr, indexAttr, spinAttr, tiltAttr, erectAttr, colorAttr);

  const uniforms = {
    uRadius: { value: params.radius },
    uBarLength: { value: params.barLength },
    uDeformAmplitude: { value: params.deformAmplitude * params.barLength },
    uDeformWaves: { value: params.deformWaves },
    uPhase: { value: 0 },
    uTime: { value: 0 },
    uMidY: { value: 0 },
    uMidZ: { value: 0 },
    uBands: { value: shared.bands },
  };

  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.FrontSide,
  });

  const mesh = new THREE.InstancedMesh(built.geometry, material, BAR_COUNT);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  scene.add(mesh);

  let profile = built.profile;
  let previousTime = 0;

  function setCenter(nextProfile) {
    const mid = nextProfile.segments >> 1;
    uniforms.uMidY.value = nextProfile.y[mid];
    uniforms.uMidZ.value = nextProfile.z[mid];
  }

  setCenter(profile);

  function rebuild(nextParams) {
    const next = buildRibbon(nextParams);
    const previous = mesh.geometry;
    for (let i = 0; i < INSTANCE_KEYS.length; i += 1) previous.deleteAttribute(INSTANCE_KEYS[i]);
    previous.dispose();
    attach(next.geometry, angleAttr, bandAttr, indexAttr, spinAttr, tiltAttr, erectAttr, colorAttr);
    mesh.geometry = next.geometry;
    profile = next.profile;
    setCenter(profile);
    return profile;
  }

  function sync(nextParams, phase, time) {
    uniforms.uRadius.value = nextParams.radius;
    uniforms.uBarLength.value = nextParams.barLength;
    uniforms.uDeformAmplitude.value = nextParams.deformAmplitude * nextParams.barLength;
    uniforms.uDeformWaves.value = nextParams.deformWaves;
    uniforms.uPhase.value = phase;
    uniforms.uTime.value = time;
    const dt = time >= previousTime ? time - previousTime : 0;
    previousTime = time;
    advanceSpin(dt);
    spinAttr.needsUpdate = true;
    setCenter(profile);
    tiltAttr.needsUpdate = true;
    erectAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  function advanceSpin(dt) {
    if (dt <= 0) return;
    const bandEnergy = shared.bands;
    for (let i = 0; i < BAR_COUNT; i += 1) {
      const band = bands[i];
      const energy = band < bandEnergy.length ? bandEnergy[band] : 0;
      const delta = energy - heard[i];
      heard[i] = energy;
      if (burstCool[i] > 0) burstCool[i] -= dt;
      if (burstLeft[i] > 0) {
        const step = dt * 3.4;
        const used = step < burstLeft[i] ? step : burstLeft[i];
        spinAngle[i] += used * spinDir[i] * TAU;
        burstLeft[i] -= used;
      } else {
        spinAngle[i] += dt * (0.18 + 1.15 * energy) * spinDir[i] * TAU;
        const hit = delta > 0.1 || (energy > 0.5 && delta > 0.035);
        if (burstCool[i] <= 0 && hit && Math.random() < 0.55 + energy * 0.4) {
          burstLeft[i] = Math.random() < 0.5 ? BURST_470 : BURST_540;
          spinDir[i] = Math.random() < 0.5 ? 1 : -1;
          burstCool[i] = 2.2 + Math.random() * 4.2;
        }
      }
    }
  }

  function bandIndex(index) {
    return bandAttr.getX(index);
  }

  return {
    mesh,
    rebuild,
    sync,
    bandIndex,
    getProfile: () => profile,
    bandCount: BAND_COUNT,
  };
}

function attach(geometry, angleAttr, bandAttr, indexAttr, spinAttr, tiltAttr, erectAttr, colorAttr) {
  geometry.setAttribute('aAngle', angleAttr);
  geometry.setAttribute('aBand', bandAttr);
  geometry.setAttribute('aIndex', indexAttr);
  geometry.setAttribute('aSpin', spinAttr);
  geometry.setAttribute('aTilt', tiltAttr);
  geometry.setAttribute('aErect', erectAttr);
  geometry.setAttribute('aColor', colorAttr);
}
