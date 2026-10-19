import { DEG, YAW_LIMIT, soften } from './mapping.js';

/** Short eased approach to the yaw/pitch stops. SPEC §3. */
const SOFT_ZONE = 4 * DEG;

export function createLook(params, camera) {
  let yaw = 0;
  let pitch = 0;
  let velYaw = 0;
  let velPitch = 0;
  let pendingYaw = 0;
  let pendingPitch = 0;
  let dragging = false;
  let activeId = -1;
  let lastX = 0;
  let lastY = 0;

  camera.rotation.order = 'YXZ';

  function pitchMin() {
    return -params.pitchDownLimit * DEG;
  }

  function pitchMax() {
    return params.pitchUpLimit * DEG;
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0 && event.pointerType === 'mouse') return;
    if (activeId !== -1) return;
    const target = event.target;
    if (target && target.closest && (target.closest('.lil-gui') || target.closest('#start-gate'))) return;
    activeId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    dragging = true;
    velYaw = 0;
    velPitch = 0;
  }

  function onPointerMove(event) {
    if (event.pointerId !== activeId) return;
    if (event.cancelable) event.preventDefault();
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    const scale = params.dragSensitivity * DEG;
    pendingYaw += dx * scale;
    pendingPitch += -dy * scale;
  }

  function onPointerUp(event) {
    if (event.pointerId !== activeId) return;
    activeId = -1;
    dragging = false;
  }

  // Look-around is off. The camera stays aimed at the circle.
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('gesturestart', preventGesture, { passive: false });
  window.addEventListener('gesturechange', preventGesture, { passive: false });

  function onWheel(event) {
    const target = event.target;
    if (target && target.closest && target.closest('.lil-gui')) return;
    event.preventDefault();
  }

  function onTouchMove(event) {
    const target = event.target;
    if (target && target.closest && target.closest('.lil-gui')) return;
    event.preventDefault();
  }

  function preventGesture(event) {
    event.preventDefault();
  }

  function update() {
    camera.rotation.order = 'YXZ';
    camera.rotation.y = 0;
    camera.rotation.x = -0.55;
  }

  function getAngles() {
    return {
      yaw: yaw / DEG,
      pitch: pitch / DEG,
    };
  }

  function setAngles() {
    yaw = 0;
    pitch = 0;
    velYaw = 0;
    velPitch = 0;
    pendingYaw = 0;
    pendingPitch = 0;
    camera.rotation.y = 0;
    camera.rotation.x = -0.55;
  }

  return { update, getAngles, setAngles };
}
