import { HALF_SHIFT } from './mapping.js';

// Each bar is a straight rod. It spins rigidly around the center line
// (the axis through its center, 90° to the rod). The circle is split
// into a left half and a right half.

export const vertexShader = /* glsl */ `
precision highp float;

in vec3 position;
in vec3 aNormal;
in float aT;
in float aAngle;
in float aIndex;
in float aSpin;
in float aTilt;
in float aErect;
in float aBand;
in vec3 aColor;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uRadius;
uniform float uBarLength;
uniform float uDeformAmplitude;
uniform float uDeformWaves;
uniform float uPhase;
uniform float uTime;
uniform float uMidY;
uniform float uMidZ;
uniform float uBands[16];

out vec3 vColor;
out vec3 vNormal;

const float HALF_PI = 1.5707963267948966;

void main() {
  float erect = aErect;
  float sLen = aT * uBarLength;
  float ang = (1.0 - erect) * HALF_PI;
  float cosAng = cos(ang);
  float sinAng = sin(ang);
  float y = sLen * cosAng + position.y * sinAng;
  float z = sLen * sinAng - position.y * cosAng;
  float halfLen = 0.5 * uBarLength;
  float centerY = halfLen * cosAng;
  float centerZ = halfLen * sinAng;

  float spin = aSpin * erect;
  float c = cos(spin);
  float s = sin(spin);
  float oy = y - centerY;
  float oz = z - centerZ;
  float lx = position.x;
  float ly = centerY + oy * c - oz * s;
  float lz = centerZ + oy * s + oz * c;

  float nx = aNormal.x;
  float ny = aNormal.y * sinAng + aNormal.z * cosAng;
  float nz = -aNormal.y * cosAng + aNormal.z * sinAng;
  float nly = ny * c - nz * s;
  float nlz = ny * s + nz * c;

  float cosTheta = cos(aAngle);
  float sinTheta = sin(aAngle);
  vec3 world;
  world.x = lx * cosTheta - lz * sinTheta + uRadius * sinTheta;
  world.y = ly;
  world.z = lx * sinTheta + lz * cosTheta - uRadius * cosTheta;
  float side = sinTheta >= 0.0 ? 1.0 : -1.0;
  world.x += side * uRadius * ${HALF_SHIFT.toFixed(1)};

  vec3 nWorld;
  nWorld.x = nx * cosTheta - nlz * sinTheta;
  nWorld.y = nly;
  nWorld.z = nx * sinTheta + nlz * cosTheta;

  vColor = aColor;
  vNormal = mat3(modelViewMatrix) * nWorld;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
}
`;

export const fragmentShader = /* glsl */ `
precision highp float;

in vec3 vColor;
in vec3 vNormal;
out vec4 fragColor;

void main() {
  vec3 n = normalize(vNormal);
  vec3 lightDir = normalize(vec3(0.4, 0.85, 0.7));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  float diff = clamp(dot(n, lightDir), 0.0, 1.0);
  float spec = pow(clamp(dot(n, normalize(lightDir + viewDir)), 0.0, 1.0), 36.0);
  float rim = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 2.4);
  vec3 lit = vColor * (0.16 + 0.84 * diff) + vec3(spec) + vColor * rim * 0.55;
  fragColor = vec4(lit, 1.0);
}
`;
