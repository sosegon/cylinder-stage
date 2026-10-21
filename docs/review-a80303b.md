# Review: commit a80303b against SPEC.md

- **Commit:** `a80303b` "init commit" (Victory, 2026-10-19)
- **Reviewed against:** SPEC.md, last updated 2026-10-10
- **Review date:** 2026-10-21

## Summary

The infrastructure is in good shape, but the visible piece does not match the spec. Audio analysis, parameters, the debug panel, lifecycle timing and the choreography API are largely reusable. The stage shape, bar shape, viewpoint and both movements are either different from the spec or missing.

| Layer | How close to SPEC |
|---|---|
| Infrastructure (audio, debug panel, params, lifecycle timing, API) | ~80% |
| What the viewer sees and feels (stage, bars, viewpoint, movements) | ~10–20% |

Several deviations touch **confirmed** values (no `[provisional]` tag), which CLAUDE.md says must not change without a spec update. No spec change proposal for them exists in the repo.

## What matches the spec

- 32 bars rendered as a single `InstancedMesh` (one draw call); device pixel ratio capped at 2.
- Debug panel, enabled only with `?debug`, exposes every provisional parameter, plus "copy values" / "load values" (§9).
- 16 log-spaced audio bands with the mirrored mapping: lowest band drives the center bars, highest drives the outer bars (§6).
- Per-band attack/release envelope (§6).
- Rise/fall lifecycle with all four patterns: `simultaneous`, `centerOut`, `edgesIn`, `leftToRight` (§4).
- Public API `riseAll()`, `fallAll()`, `setBarState(i, state)`, `setBarColor(i, color)` on `window.stage`.
- `tempo` scales animation speed; color changes are timed interpolations scaled by `tempo` (§7).

## Where it departs from the spec

### 1. Stage geometry (§1, confirmed values)

- **Spec:** one half cylinder, 180° of arc in front of the viewer.
- **Code:** `ARC_DEGREES = 360` and `HALF_SHIFT = 1` (`src/mapping.js`) spread the bars around a full circle, then split it into two separate half-rings offset by ±R. On screen this is two rings side by side.

### 2. Bar shape (§2)

- **Spec:** tapered, double-sided ribbon with a curved dome-rib profile leaning toward the center.
- **Code:** straight round rods of constant diameter (`src/ribbon.js`). The curved profile is still computed (`src/profile.js`) but only used for the center line, not the bars. The default `tipWidthRatio` is 1.0 (no taper) instead of 0.3.

### 3. Camera (§3, confirmed position)

- **Spec:** first-person camera at the stage center (x = 0, z = 0), eye height below half the bar height, drag to look around within yaw/pitch limits.
- **Code:** the camera is pulled back 26 m (`viewDistance`, a parameter not in the spec), raised, and fixed at a downward pitch of about 31°. Look-around input is disabled (`src/look.js`).

### 4. Movement 1: tilt toward the camera (§5)

- **Spec:** each bar leans up to `maxTilt` toward the center.
- **Code:** tilt values are computed and sent to the GPU (`aTilt`), but the vertex shader never uses them. There is no visible tilt.

### 5. Movement 2: frequency-driven deformation (§6)

- **Spec:** band energy drives a vibration along the profile normal, computed in the vertex shader.
- **Code:** `uBands`, `uDeformAmplitude`, `uDeformWaves` and `aBand` are declared in the shader but never used. There is no deformation.

### 6. Behaviors and visuals not in the spec

- **Spinning rods:** bars rotate rigidly around their midpoint, with random 470°/540° spin bursts triggered by audio energy (`src/bars.js`, CPU side).
- **White center-line ribbons:** a ring through the middle of each half (`src/centerline.js`).
- **Palette colors:** colors sampled at random from `public/palette.png`, two per half, cycling over time. The palette and color system are listed as pending in §11.

### 7. Smaller items

- **§4:** bars rise automatically at load. The spec has them start flat, and the rise is triggered from the debug panel or API.
- **§8:** the Start gesture does not request fullscreen.
- **Changed provisional defaults:** these are tunable, so lower priority, but the defaults no longer match the spec.

| Parameter | SPEC | Code |
|---|---|---|
| `tipWidthRatio` | 0.3 | 1.0 |
| `riseDuration` | 3.0 s | 1.6 s |
| `riseStagger` | 0.08 s | 0.045 s |
| `deformAmplitude` | 0.08 · L | 0.22 · L |
| `deformWaves` | 2.5 | 3.5 |
| `deformSpeed` | 1.0 | 1.75 |

## Acceptance check script

`npm run check` reports all 77 checks passing. It is not reliable evidence of spec compliance, because it takes its expected values from the code's own constants (`ARC_DEGREES`, `HALF_SHIFT`). It therefore agrees with the 360° split layout instead of flagging it.

## Path forward

The fix is concentrated in the visual layer: the bar vertex shader, the bar geometry, the camera code and a few constants in `src/mapping.js`. The profile and clearance math needed for the dome ribs already exists (`src/profile.js`, `src/pose.js`, `src/clearance.js`), so this is a contained rewrite, not a restart.

Open question for the art director: were any of these changes requested? The changes in question are the two rings, the spinning rods, the overhead camera and the palette colors.

- **If yes:** they need a "Spec change proposal" and an update to SPEC.md before the code is accepted.
- **If no:** the visual layer should be brought back in line with SPEC §1–§6 and §8, and the check script should test against the spec's literal values.
