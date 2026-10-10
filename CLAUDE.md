# CLAUDE.md

## Project
Immersive audiovisual web experience: a fullscreen, browser-based 3D piece in which a semicircular fence of 32 bars moves and deforms with music. Built with three.js and the Web Audio API.

Roles:
- **Art director:** owns all art and experience decisions. Final authority on SPEC.md.
- **Developer:** owns the technical implementation.

## Source of truth
**SPEC.md is the single source of truth.** Read it before starting any task, and re-read the relevant section before changing related code.

- **Confirmed values** (no `[provisional]` tag) must not be changed. If a task seems to require changing one, stop and flag it instead of working around it.
- **Provisional values** (`[provisional]`) are placeholders for prototyping. Implement them as defaults and expose every one of them in the debug panel (SPEC section 9).
- **Do not add** visual elements, features or behaviors that are not in the spec. Items listed in SPEC section 11 (Pending) are out of scope.
- **If the spec is ambiguous**, ask before guessing. If an assumption is unavoidable, keep it minimal, make it tunable, and list it in the commit or PR description.

## Changing the spec
Only the art director changes SPEC.md. If you find a problem (technical limit, performance cost, contradiction), propose the change in an issue or PR titled "Spec change proposal: …", explaining the problem and the options. Do not edit SPEC.md unilaterally.

## Implementation rules
- Static build only, no server-side logic. Build tool at the developer's choice (e.g., Vite).
- All bars rendered as a single `InstancedMesh`. All bar motion (lifecycle, tilt, deformation) computed on the GPU in the vertex shader.
- No per-frame memory allocations in the render loop.
- Device pixel ratio capped at 2.
- Debug panel (lil-gui or similar) enabled only with `?debug` in the URL and excluded from production behavior.
- Public choreography API as defined in the spec (`riseAll()`, `fallAll()`, `setBarState(i, state)`, `setBarColor(i, color)`). Keep these stable, as future story choreography will be built on them.

## Conventions
- English for code, comments, commit messages, issues and PRs.
- Reference SPEC section numbers in commits and PRs (e.g., "SPEC §6: band envelope").
- When a feature is done, check it against that section's acceptance criteria and state which ones were verified and how.
