import * as THREE from 'three';
import { BAR_COUNT, HALF_SHIFT, barAngle } from './mapping.js';

const LINE_HALF = 0.1;

/**
 * A ribbon through the pivot of every bar, one polyline per semicircle.
 * Positions are written into buffers allocated once.
 */
export function createCenterLines(scene) {
  const left = [];
  const right = [];
  for (let i = 0; i < BAR_COUNT; i += 1) {
    const angle = barAngle(i);
    if (Math.sin(angle) >= 0) right.push(i);
    else left.push(i);
  }
  left.sort(byArc);
  right.sort(byArc);
  const groups = [left, right];

  let vertexCount = 0;
  let indexCount = 0;
  for (let g = 0; g < groups.length; g += 1) {
    const count = groups[g].length;
    vertexCount += count * 2;
    indexCount += (count - 1) * 6;
  }

  const positions = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(indexCount);
  const spans = [];
  let vBase = 0;
  let cursor = 0;
  for (let g = 0; g < groups.length; g += 1) {
    const count = groups[g].length;
    spans.push({ bars: groups[g], vBase, count });
    for (let i = 0; i < count - 1; i += 1) {
      const a = vBase + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices[cursor] = a;
      indices[cursor + 1] = c;
      indices[cursor + 2] = b;
      indices[cursor + 3] = b;
      indices[cursor + 4] = c;
      indices[cursor + 5] = d;
      cursor += 6;
    }
    vBase += count * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  scene.add(mesh);

  const maxCount = Math.max(left.length, right.length);
  const cx = new Float32Array(maxCount);
  const cy = new Float32Array(maxCount);
  const cz = new Float32Array(maxCount);
  let midY = 0;
  let midZ = 0;

  function setProfile(profile) {
    const mid = profile.segments >> 1;
    midY = profile.y[mid];
    midZ = profile.z[mid];
  }

  function update(params, erect, tilt) {
    const radius = params.radius;
    const length = params.barLength;
    for (let g = 0; g < spans.length; g += 1) {
      const span = spans[g];
      const count = span.count;
      for (let i = 0; i < count; i += 1) {
        const index = span.bars[i];
        writeCenter(index, erect[index], tilt[index], radius, length, midY, midZ, cx, cy, cz, i);
      }
      for (let i = 0; i < count; i += 1) {
        let dx;
        let dz;
        if (i < count - 1) {
          dx = cx[i + 1] - cx[i];
          dz = cz[i + 1] - cz[i];
        } else {
          dx = cx[i] - cx[i - 1];
          dz = cz[i] - cz[i - 1];
        }
        const len = Math.hypot(dx, dz) || 1;
        const px = (-dz / len) * LINE_HALF;
        const pz = (dx / len) * LINE_HALF;
        const o = (span.vBase + i * 2) * 3;
        positions[o] = cx[i] - px;
        positions[o + 1] = cy[i];
        positions[o + 2] = cz[i] - pz;
        positions[o + 3] = cx[i] + px;
        positions[o + 4] = cy[i];
        positions[o + 5] = cz[i] + pz;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  }

  return { setProfile, update };
}

function byArc(a, b) {
  return wrap(barAngle(a)) - wrap(barAngle(b));
}

function wrap(angle) {
  return angle < 0 ? angle + Math.PI * 2 : angle;
}

function writeCenter(index, erect, tilt, radius, length, midY, midZ, xs, ys, zs, slot) {
  const ang = (1 - erect) * Math.PI * 0.5;
  const half = 0.5 * length;
  const y = half * Math.cos(ang);
  const z = half * Math.sin(ang);
  const theta = barAngle(index);
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const side = sinTheta >= 0 ? 1 : -1;
  xs[slot] = -z * sinTheta + radius * sinTheta + side * radius * HALF_SHIFT;
  ys[slot] = y;
  zs[slot] = z * cosTheta - radius * cosTheta;
}
