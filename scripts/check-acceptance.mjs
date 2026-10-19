import { measureClearance } from '../src/clearance.js';
import { ARC_DEGREES, BAR_COUNT, BAND_COUNT, HALF_SHIFT, SLOT_ANGLE, YAW_LIMIT, bandIndexForBar, barAngle, baseWidth, easeInOutCubic, halfWidthAt, riseDelay, soften } from '../src/mapping.js';
import { colorRate, deformRate } from '../src/motion.js';
import { applyParamValues, PARAM_GROUPS, buildSnapshot, createParams } from '../src/params.js';
import { integrateProfile } from '../src/profile.js';
import { localPose, placeOnArc } from '../src/pose.js';
import { fragmentShader, vertexShader } from '../src/shaders.js';

const DEG = Math.PI / 180;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log('ok   ' + name);
    return;
  }
  failed += 1;
  console.error('FAIL ' + name + (detail ? ' — ' + detail : ''));
}

const REQUIRED = [
  'radius', 'barLength', 'tipWidthRatio', 'backgroundColor',
  'tipInwardOffset', 'profileCurvePower', 'lengthSegments', 'barColor',
  'eyeHeightRatio', 'pitchUpLimit', 'pitchDownLimit', 'fov', 'viewDistance', 'dragSensitivity', 'inertiaDamping',
  'riseDuration', 'riseEasing', 'risePattern', 'riseStagger',
  'maxTilt', 'tiltSmoothing', 'tiltTestSignal',
  'minFrequency', 'maxFrequency', 'fftSize', 'analyserSmoothing', 'attack', 'release',
  'deformAmplitude', 'deformWaves', 'deformSpeed',
  'tempo', 'colorTransitionBase',
  'audioSrc', 'volume',
];

const present = new Set();
for (const group of PARAM_GROUPS) {
  for (const item of group.items) present.add(item.key);
}
for (const key of REQUIRED) {
  check('debug exposes ' + key, present.has(key));
}

const params = createParams();
check('eye height ratio below 0.5', params.eyeHeightRatio < 0.5);
check('max tilt inside 10–15°', params.maxTilt >= 10 && params.maxTilt <= 15);
check('32 bars', BAR_COUNT === 32);
check('16 bands', BAND_COUNT === 16);

for (let i = 0; i < BAR_COUNT; i += 1) {
  const expected = (-90 + (ARC_DEGREES / 32) * (i + 0.5)) * DEG;
  if (Math.abs(barAngle(i) - expected) > 1e-12) {
    check('bar angle ' + i, false, barAngle(i));
    break;
  }
  if (i === BAR_COUNT - 1) check('bar center angles', true);
}

check('bars 15 and 16 share the lowest band', bandIndexForBar(15) === 0 && bandIndexForBar(16) === 0);
check('bars 0 and 31 share the highest band', bandIndexForBar(0) === 15 && bandIndexForBar(31) === 15);
let mirrors = true;
for (let i = 0; i < BAR_COUNT; i += 1) {
  if (bandIndexForBar(i) !== bandIndexForBar(BAR_COUNT - 1 - i)) mirrors = false;
}
check('mirrored bars share a band', mirrors);

check('centerOut starts at the center', riseDelay(15, 'centerOut', 0.08) === 0 && riseDelay(16, 'centerOut', 0.08) === 0);
check('centerOut delays the edge', Math.abs(riseDelay(0, 'centerOut', 0.08) - 15 * 0.08) < 1e-12);
check('edgesIn starts at the edge', riseDelay(0, 'edgesIn', 0.08) === 0 && riseDelay(31, 'edgesIn', 0.08) === 0);
check('leftToRight follows index', riseDelay(7, 'leftToRight', 0.08) === 7 * 0.08);
check('simultaneous has no delay', riseDelay(10, 'simultaneous', 0.08) === 0);

check('ease endpoints', easeInOutCubic(0) === 0 && easeInOutCubic(1) === 1 && easeInOutCubic(0.5) === 0.5);
check('ease starts slowly', easeInOutCubic(0.25) < 0.25);

const radius = params.radius;
const width = baseWidth(radius);
const slotArc = radius * SLOT_ANGLE;
const barAngleWidth = 2 * Math.atan((width / 2) / radius);
const gap = SLOT_ANGLE - barAngleWidth;
const gapRatio = gap / barAngleWidth;
check('base arc width matches πR/64', Math.abs(width - Math.PI * radius / 64) < 1e-12);
check('full-circle gap is three bar widths ±1%', Math.abs(gapRatio - 3) < 0.01, 'ratio ' + gapRatio.toFixed(4));
check('tip width ratio', Math.abs(halfWidthAt(1, radius, params.tipWidthRatio) * 2 / width - params.tipWidthRatio) < 1e-12);
check('slot is four times the base width', Math.abs(slotArc - width * 4) / slotArc < 0.01);

const offset = params.tipInwardOffset * params.barLength;
const profile = integrateProfile(params.barLength, offset, params.profileCurvePower, params.lengthSegments);
const tipError = Math.abs(profile.tipInward - offset) / offset;
check('profile valid at defaults', profile.valid);
check('tip inward offset ±2%', tipError < 0.02, 'error ' + (tipError * 100).toFixed(3) + '%');
const baseTangent = Math.abs(Math.atan2(profile.z[1] - profile.z[0], profile.y[1] - profile.y[0]) * 180 / Math.PI);
check('base tangent within 2° of vertical', baseTangent < 2, baseTangent.toFixed(3) + '°');
const arcError = Math.abs(profile.arcLength - params.barLength) / params.barLength;
check('profile arc length within 1% of L', arcError < 0.01, 'error ' + (arcError * 100).toFixed(3) + '%');
check('eye below half the erect height', params.eyeHeightRatio * profile.height < profile.height * 0.5);

const clearance = measureClearance(profile, params);
check('bars stay off the floor', clearance.minY >= -1e-4, 'minY ' + clearance.minY.toFixed(5));
check('neighbors do not intersect', clearance.angularGap > 0, 'gap ' + (clearance.angularGap * 180 / Math.PI).toFixed(3) + '°');

const origin = placeOnArc({ x: 0, y: 0, z: 0 }, barAngle(0), radius);
const side0 = Math.sin(barAngle(0)) >= 0 ? 1 : -1;
const angle0 = Math.atan2(origin.x - side0 * radius * HALF_SHIFT, -origin.z);
check('bar 0 sits on its angle', Math.abs(angle0 - barAngle(0)) < 1e-9);
check('bar base radius is R', Math.abs(Math.hypot(origin.x - side0 * radius * HALF_SHIFT, origin.z) - radius) < 1e-9);

const restTip = localPose(0, profile.y[profile.segments], profile.z[profile.segments], 0, 0, 1, 0, 0, 0, params.barLength);
check('rest tip lies on the floor', Math.abs(restTip.y) < 1e-6, 'y ' + restTip.y);
check('rest tip points inward by L', Math.abs(restTip.z - params.barLength) < 1e-6);

const erectTip = localPose(
  0,
  profile.y[profile.segments],
  profile.z[profile.segments],
  profile.ny[profile.segments],
  profile.nz[profile.segments],
  1,
  1,
  0,
  0,
  params.barLength,
);
check('erect tip keeps its inward offset', Math.abs(erectTip.z - profile.tipInward) < 1e-6);
check('erect tip keeps its height', Math.abs(erectTip.y - profile.height) < 1e-6);

const slammed = soften(0, 5, -YAW_LIMIT, YAW_LIMIT, 4 * DEG);
check('fast look eases into the yaw stop', slammed < YAW_LIMIT - 1e-4 && slammed > YAW_LIMIT - 4 * DEG, String(slammed));
let yaw = slammed;
for (let i = 0; i < 80; i += 1) yaw = soften(yaw, 0.2, -YAW_LIMIT, YAW_LIMIT, 4 * DEG);
check('yaw never leaves ±90°', yaw <= YAW_LIMIT && yaw > YAW_LIMIT - 0.01, String(yaw));
check('small look delta is unchanged away from the stop', Math.abs(soften(0, 0.01, -1, 1, 0.2) - 0.01) < 1e-12);

check('doubling tempo doubles deform rate', deformRate(1, 2) === 2 * deformRate(1, 1));
check('doubling tempo doubles color rate', Math.abs(colorRate(2, 1.5) / colorRate(1, 1.5) - 2) < 1e-12);

const snapshot = buildSnapshot(params, {
  bars: [{ erect: 0, tilt: 0, color: '#CCCCCC' }],
  deformPhase: 1.25,
  tiltPhase: 0.5,
  camera: { yaw: 10, pitch: -3 },
  debug: { testTone: false, testToneFrequency: 80 },
});
const restored = createParams();
restored.radius = 3;
applyParamValues(restored, JSON.parse(JSON.stringify(snapshot)).values);
let same = true;
for (const key of REQUIRED) {
  if (restored[key] !== params[key]) same = false;
}
check('JSON roundtrip restores parameters', same);

check('each bar turns on its own', vertexShader.includes('float spin = aSpin * erect'));
check('straight rod spins around the center line', vertexShader.includes('sLen * cosAng') && vertexShader.includes('oy * c - oz * s'));
check('bar is a round rod', vertexShader.includes('position.y * sinAng') && vertexShader.includes('- position.y * cosAng'));
check('bars catch a shiny highlight', fragmentShader.includes('pow(clamp(dot(n, normalize(lightDir + viewDir))'));

console.log('');
console.log('erect height ' + profile.height.toFixed(4) + ' m');
console.log('tip inward ' + profile.tipInward.toFixed(4) + ' m');
console.log('base width ' + width.toFixed(4) + ' m');
console.log('floor clearance ' + clearance.minY.toFixed(4) + ' m');
console.log('neighbor gap ' + (clearance.angularGap * 180 / Math.PI).toFixed(3) + '°');

if (failed > 0) {
  console.error(failed + ' checks failed');
  process.exit(1);
}
console.log('all checks passed');
