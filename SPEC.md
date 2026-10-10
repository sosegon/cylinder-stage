# SPEC — Immersive Audiovisual Web Experience

Single source of truth for implementation. Only sections confirmed by the art director are added here.

Last updated: 2026-10-10

## Section format
Each section must include:
- **Goal**
- **Expected behavior**
- **Tunable parameters** (with default values)
- **Acceptance criteria** (verifiable)
- **Performance notes** (if applicable)

## Conventions
- Units: meters and degrees unless stated otherwise.
- Coordinate system: Y up. The semicircle center is at the world origin. The stage axis (center of the 180° arc) points along −Z.
- Defaults marked **[provisional]** are placeholders chosen for prototyping. They are **not** art decisions and will be tuned by the art director. Every provisional value must be exposed in the debug panel (section 9).
- Values without that mark are confirmed decisions and must not be changed without updating this spec.

---

## 0. Project overview

**Goal**
Build the first version of the "instrument": a fullscreen, browser-based 3D audiovisual piece in which a semicircular fence of 32 bars moves and deforms with music. The narrative (three-act story) is not defined yet. This version must provide all mechanics with tunable parameters so the story can later be choreographed on top of them.

**Expected behavior**
- Runs in modern desktop and mobile browsers, fullscreen, built with three.js.
- First-person point of view from a fixed camera. The viewer only looks around; the camera never moves.
- The story is told only through the bars (movement and color) and the sound. No text, characters or other scene elements are required in this version.
- A single visual language is used throughout. There are no scene-specific rendering modes.

**Tunable parameters**
- None at this level.

**Acceptance criteria**
- The app loads from a static build (no server-side logic required) and runs on current Chrome, Safari and Firefox, on desktop and on iOS/Android.
- All tunable parameters listed in this spec are editable at runtime through the debug panel (section 9).

---

## 1. Stage geometry

**Goal**
Define the semicylindrical stage formed by 32 vertical bars around the viewer.

**Expected behavior**
- The stage is a half cylinder covering exactly 180° of arc, centered on the stage axis (−Z), from −90° to +90°.
- The arc is divided into 32 equal angular slots of 180° / 32 = 5.625° each. One bar is centered in each slot.
- At the base, bar width equals the gap between bars: each bar occupies half of its slot's arc length. Base width = π · R / 64.
- Bars taper toward the tip: tip width = base width × `tipWidthRatio`.
- The open side of the half cylinder (behind the viewer) and the space between bars render as a solid background color in this version. What is visible there is pending an art decision.

**Tunable parameters**
| Parameter | Default | Notes |
|---|---|---|
| `barCount` | 32 | Fixed. Not tunable at runtime. |
| `arcDegrees` | 180 | Fixed. |
| `radius` (R) | 8.0 | [provisional] Distance from origin to bar bases. |
| `barLength` (L) | 6.0 | [provisional] Arc length of a bar in its erect rest shape. |
| `baseWidth` | π · R / 64 | Derived. Not set directly. |
| `tipWidthRatio` | 0.3 | [provisional] Range 0.05–1.0. |
| `backgroundColor` | #000000 | [provisional] |

**Acceptance criteria**
- Exactly 32 bars are rendered, with centers at angles −90° + 5.625° · (i + 0.5) for i = 0…31.
- At the base, measured along the arc, each bar's width equals the gap to its neighbor (±1%).
- The tip width equals `baseWidth × tipWidthRatio` (±1%).
- With default parameters, adjacent bars never intersect, at any rotation within the allowed range and at maximum deformation amplitude.

---

## 2. Bar shape (erect pose)

**Goal**
Define the shape of a bar when standing, which is the base pose for all motion.

**Expected behavior**
- In its erect pose, each bar has a curved side profile, like the rib of a dome. It rises vertically from the floor and curves toward the camera, so the tip leans toward the stage center.
- The profile lies in the vertical plane that contains the bar's base point and the world Y axis (the radial plane).
- The profile is defined by a smooth parametric curve: tangent vertical at the base, with the tip displaced horizontally toward the center by `tipInwardOffset`.
- The bar is modeled as a thin, double-sided ribbon, subdivided along its length so that it can be deformed in the vertex shader. Cross-section, material and thickness are pending art decisions.

**Tunable parameters**
| Parameter | Default | Notes |
|---|---|---|
| `tipInwardOffset` | 0.35 · L | [provisional] Horizontal displacement of the tip toward the center. |
| `profileCurvePower` | 2.0 | [provisional] Shapes how the curvature is distributed along the bar (higher = curvature concentrated near the tip). |
| `lengthSegments` | 64 | [provisional] Subdivisions along the bar. |
| `barColor` | #CCCCCC | [provisional] Placeholder until the palette is defined. |

**Acceptance criteria**
- At the base, the tangent of the profile is vertical (±2°).
- The tip lies inside the semicircle, toward the center, displaced by `tipInwardOffset` (±2%).
- Seen from the camera, the bars read as a set of dome ribs curving over the viewer.

**Performance notes**
- All 32 bars share one geometry and are rendered as a single `InstancedMesh`, with per-instance attributes for angle, color, tilt and band index.

---

## 3. Camera and look controls

**Goal**
Provide a fixed first-person viewpoint with constrained look-around.

**Expected behavior**
- The camera is at the semicircle center (x = 0, z = 0). It does not translate.
- Eye height is slightly below half the vertical height of the erect bars.
- Yaw (horizontal rotation) is limited to the 180° of the stage. The view direction is clamped to [−90°, +90°] around the stage axis.
- Pitch (vertical tilt) is limited up and down. The exact angles are pending.
- Input: mouse drag on desktop and one-finger touch drag on mobile. Releasing the input keeps the current orientation. A short eased inertia is allowed.
- When rotation hits a limit, it stops smoothly with a short eased clamp, not an abrupt stop.

**Tunable parameters**
| Parameter | Default | Notes |
|---|---|---|
| `eyeHeightRatio` | 0.45 | [provisional] Eye height = ratio × vertical height of the erect bar. Must stay below 0.5. |
| `yawLimit` | ±90° | Confirmed. View direction clamp around the stage axis. |
| `pitchUpLimit` | 25° | [provisional] |
| `pitchDownLimit` | 15° | [provisional] |
| `fov` | 75° | [provisional] Vertical field of view. |
| `dragSensitivity` | 0.15 °/px | [provisional] |
| `inertiaDamping` | 0.9 | [provisional] Range 0 (none) to 0.99. |

**Acceptance criteria**
- Camera position is constant for the whole experience.
- The view direction can never point outside [−90°, +90°] of yaw, or outside the pitch limits, on either desktop or mobile.
- Eye height is strictly below 50% of the erect bar height.
- Mouse and touch input both rotate the view. Page scroll and pinch-zoom are disabled while interacting.

---

## 4. Bar lifecycle: rest → rise → erect

**Goal**
Bars start lying on the floor, rise, and hold their erect dome-rib pose.

**Expected behavior**
- **Rest:** at the start, all bars lie flat on the floor. They rotate around their base pivot toward the camera, so they lie pointing at the center.
- **Rise:** on a trigger, bars rotate about the base pivot from rest to the erect pose. The order and timing of the rise per bar is controlled by a per-bar delay, so the rise can be choreographed (simultaneous, wave from center outward, etc.).
- **Erect:** after rising, bars hold the erect pose. Motion from sections 5 and 6 is applied on top of it.
- The lifecycle must also play in reverse (erect → rest), so a fall can be triggered.
- In this version, rise and fall are triggered from the debug panel and through a public function (`riseAll()`, `fallAll()`, `setBarState(i, state)`) for future choreography.

**Tunable parameters**
| Parameter | Default | Notes |
|---|---|---|
| `riseDuration` | 3.0 s | [provisional] Per-bar duration of the rise. |
| `riseEasing` | easeInOutCubic | [provisional] |
| `risePattern` | centerOut | [provisional] One of: `simultaneous`, `centerOut`, `edgesIn`, `leftToRight`. |
| `riseStagger` | 0.08 s | [provisional] Delay between consecutive bars in the pattern. |

**Acceptance criteria**
- On load, all bars are flat on the floor.
- `riseAll()` brings all bars to the erect pose following `risePattern`, and `fallAll()` returns them to rest.
- No bar intersects the floor or its neighbors during the transition.

---

## 5. Movement 1 — Rotation toward the camera

**Goal**
Provide a single, subtle rotational gesture of each bar toward the viewer.

**Expected behavior**
- Each bar can rotate around a pivot at its base, about the horizontal axis tangent to the circle, so that the bar leans toward the camera.
- This is the only rotation that bars perform while erect.
- The rotation range is small (on the order of 10–15°, exact value to be refined).
- The rotation of each bar is driven by a per-bar input value in [0, 1], mapped to [0, `maxTilt`]. In this version the input comes from a test signal or from the debug panel. Mapping to music or to the story is pending.

**Tunable parameters**
| Parameter | Default | Notes |
|---|---|---|
| `maxTilt` | 12.5° | [provisional] Within the confirmed 10–15° range; final value pending. |
| `tiltSmoothing` | 0.15 s | [provisional] Time constant for easing toward the target tilt. |
| `tiltTestSignal` | off | [provisional] Debug: sine wave traveling along the bars. |

**Acceptance criteria**
- With input 0, the bar is in its erect pose. With input 1, it leans exactly `maxTilt` toward the center (±0.5°).
- Rotation happens only toward the camera (never away from it) and only around the base pivot.

---

## 6. Movement 2 — Frequency-driven deformation

**Goal**
Make the music's frequency content visibly deform the bars while keeping their dome-rib profile.

**Expected behavior**
- Audio is analyzed in real time with the Web Audio API (`AnalyserNode`).
- The spectrum is split into 16 bands, distributed logarithmically between `minFrequency` and `maxFrequency`.
- **Symmetric mapping:** the lowest band drives the two center bars (indices 15 and 16), and increasing bands move outward symmetrically. The highest band drives the outermost bars (indices 0 and 31). Bars at mirrored positions (i and 31 − i) share the same band.
- The energy of a bar's band drives a procedural vibration: a displacement along the profile's normal, within the radial plane. The amplitude is 0 at the base and grows toward the tip, and the pattern is animated over time.
- The dome-rib profile must remain recognizable at all amplitudes. Bar length may change as it vibrates. This is accepted and does not need to be compensated.
- Deformation is fully procedural (computed in the vertex shader). No physics simulation.

**Tunable parameters**
| Parameter | Default | Notes |
|---|---|---|
| `bandCount` | 16 | Confirmed (mirrored over 32 bars). |
| `minFrequency` | 30 Hz | [provisional] |
| `maxFrequency` | 16000 Hz | [provisional] |
| `fftSize` | 2048 | [provisional] |
| `analyserSmoothing` | 0.8 | [provisional] `AnalyserNode.smoothingTimeConstant`. |
| `attack` / `release` | 0.03 s / 0.25 s | [provisional] Envelope applied to each band's energy. |
| `deformAmplitude` | 0.08 · L | [provisional] Maximum normal displacement at full energy. |
| `deformWaves` | 2.5 | [provisional] Number of wave crests along the bar length. |
| `deformSpeed` | 1.0 | [provisional] Temporal speed of the vibration pattern (scaled by `tempo`, section 7). |

**Acceptance criteria**
- With silence, bars show no deformation.
- A low-frequency test tone deforms mainly the center bars. A high-frequency test tone deforms mainly the outermost bars.
- Mirrored bars (i, 31 − i) deform identically for any input.
- At maximum amplitude, the base stays fixed and the profile still reads as a dome rib.

**Performance notes**
- Band energies are uploaded once per frame as a uniform array (16 floats). All deformation happens in the vertex shader. No CPU-side geometry updates.

---

## 7. Mood: tempo and color change rate

**Goal**
Within the single visual language, mood is defined by the speed of movement and the speed of color change.

**Expected behavior**
- A global `tempo` value scales the temporal speed of all animated behaviors: deformation pattern speed, tilt test signal, and color transition rate.
- Each bar exposes a color that can be set at runtime. Color changes are interpolated over a duration that is inversely proportional to `tempo`.
- The palette, the color system (per-section, gradient or other) and color meanings are pending art decisions. This version only requires the per-bar color channel and the timing behavior.

**Tunable parameters**
| Parameter | Default | Notes |
|---|---|---|
| `tempo` | 1.0 | [provisional] Range 0.1–4.0. |
| `colorTransitionBase` | 1.5 s | [provisional] Effective duration = base / `tempo`. |

**Acceptance criteria**
- Doubling `tempo` halves the period of the deformation pattern and the duration of color transitions.
- `setBarColor(i, color)` changes a single bar's color with the timed interpolation described above.

---

## 8. Audio playback and start gate

**Goal**
Play the soundtrack and comply with browser autoplay rules.

**Expected behavior**
- Browsers require a user gesture before audio can play. The experience starts with a minimal start gate (a click or tap to enter). The visual design of this gate is pending (Typography & UI are not defined yet).
- The same gesture requests fullscreen.
- In this version, the audio source is a local test file, loadable from the debug panel.

**Tunable parameters**
| Parameter | Default | Notes |
|---|---|---|
| `audioSrc` | `/audio/test.mp3` | [provisional] |
| `volume` | 0.8 | [provisional] |

**Acceptance criteria**
- No audio plays before the user gesture. After it, audio and analysis start together and the app enters fullscreen where supported.
- If fullscreen is not supported (e.g., iOS Safari on iPhone), the experience still runs in the full viewport.

---

## 9. Debug panel (development only)

**Goal**
Let the art director tune every parameter live while prototyping.

**Expected behavior**
- A collapsible panel (e.g., lil-gui) exposes every tunable parameter in this spec, grouped by section, plus triggers for `riseAll()` and `fallAll()`, the tilt test signal, the audio file and a per-band energy readout.
- A "copy values" button exports the current parameter set as JSON, so tuned values can be written back into this spec.
- The panel is hidden in production builds and enabled with `?debug` in the URL.

**Acceptance criteria**
- Every parameter marked [provisional] can be changed at runtime and takes effect without reloading.
- The exported JSON reproduces the exact same visual state when loaded.

---

## 10. Performance

**Goal**
Keep the experience smooth on desktop and mid-range phones.

**Expected behavior and targets**
- Desktop: 60 fps at native resolution.
- Mid-range mobile (e.g., iPhone 12 / Pixel 6 class): 60 fps target, 30 fps minimum.
- Device pixel ratio capped at 2.
- Bars are rendered in one draw call (`InstancedMesh`). All motion is computed on the GPU.

**Acceptance criteria**
- An FPS counter in debug mode confirms the targets above with default parameters.
- No per-frame memory allocations in the render loop (verified with the browser's performance tools).

---

## 11. Pending (out of scope for this version)
- Story content and choreography of the three acts.
- Palette and color system.
- Exact pitch limits, radius, bar length, and final tilt range.
- What is visible between the bars and on the open side of the stage.
- Bar cross-section, material and thickness.
- Typography, start gate design and any UI.

---

## Changelog
| Date | Change |
|---|---|
| 2026-10-07 | Document created (empty skeleton). |
| 2026-10-10 | First full version: overview, stage geometry, bar shape, camera, lifecycle, rotation, frequency deformation, mood/tempo, audio gate, debug panel, performance, pending items. |
