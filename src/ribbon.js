import * as THREE from 'three';
import { baseWidth } from './mapping.js';
import { integrateProfile } from './profile.js';

const RADIAL = 16;

/**
 * A straight round rod. The cross-section is a circle of constant diameter
 * (the bar width). position.xy holds the circle; the shader places it on
 * the rod axis. The profile is still returned for the center line.
 */
export function buildRibbon(params) {
  const offset = params.tipInwardOffset * params.barLength;
  const segments = params.lengthSegments | 0;
  const profile = integrateProfile(params.barLength, offset, params.profileCurvePower, segments);
  const radius = baseWidth(params.radius) * 0.5;

  const tubeVerts = RADIAL * 2;
  const capRim = RADIAL * 2;
  const vertCount = tubeVerts + capRim + 2;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const along = new Float32Array(vertCount);

  function write(vertex, t, px, py, nx, ny, nz) {
    const o = vertex * 3;
    positions[o] = px;
    positions[o + 1] = py;
    positions[o + 2] = 0;
    normals[o] = nx;
    normals[o + 1] = ny;
    normals[o + 2] = nz;
    along[vertex] = t;
  }

  for (let ring = 0; ring < 2; ring += 1) {
    for (let k = 0; k < RADIAL; k += 1) {
      const phi = (k / RADIAL) * Math.PI * 2;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      write(ring * RADIAL + k, ring, c * radius, s * radius, c, s, 0);
    }
  }

  let cursor = tubeVerts;
  for (let cap = 0; cap < 2; cap += 1) {
    const nz = cap === 0 ? -1 : 1;
    for (let k = 0; k < RADIAL; k += 1) {
      const phi = (k / RADIAL) * Math.PI * 2;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      write(cursor, cap, c * radius, s * radius, 0, 0, nz);
      cursor += 1;
    }
  }
  const baseCenter = cursor;
  write(cursor, 0, 0, 0, 0, 0, -1);
  cursor += 1;
  const tipCenter = cursor;
  write(cursor, 1, 0, 0, 0, 0, 1);

  const indices = new Uint32Array(RADIAL * 4 * 3);
  let w = 0;
  for (let k = 0; k < RADIAL; k += 1) {
    const k1 = (k + 1) % RADIAL;
    const a = k;
    const b = k1;
    const c = RADIAL + k;
    const d = RADIAL + k1;
    indices[w] = a;
    indices[w + 1] = c;
    indices[w + 2] = d;
    indices[w + 3] = a;
    indices[w + 4] = d;
    indices[w + 5] = b;
    w += 6;
  }
  const baseRim = tubeVerts;
  const tipRim = tubeVerts + RADIAL;
  for (let k = 0; k < RADIAL; k += 1) {
    const k1 = (k + 1) % RADIAL;
    indices[w] = baseCenter;
    indices[w + 1] = baseRim + k;
    indices[w + 2] = baseRim + k1;
    indices[w + 3] = tipCenter;
    indices[w + 4] = tipRim + k1;
    indices[w + 5] = tipRim + k;
    w += 6;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('aT', new THREE.BufferAttribute(along, 1));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return { geometry, profile };
}
