# Procedural Generation System (Current Implementation)

This document describes what is actually implemented right now, how it works, and what is still missing compared to `PROCEDURAL_GEN_PLAN.md`.

## Scope
- Status: implemented baseline only
- Floor: `Z = 0` only
- Chunk size: `32 x 32`
- Implemented output: deterministic halls + zones + fail-fast prefabs + pattern-catalog rooms/walls/doors

## Code Map
- Generator core: `engine/procgen.js`
- Debug visualizer and seam checks: `main.js`
- Static file hosting for browser: `server.js`

## What The Current Generator Does

### 1. Deterministic hash utilities
`engine/procgen.js` implements:
- `fnv1a32(input)` for stable 32-bit hashing
- `hashParts(...parts)` to hash joined key parts

This is used for chunk and edge determinism.

### 2. Canonical shared edge IDs
For each side (`N/S/E/W`) of a chunk:
1. Find neighbor coordinates for that side.
2. Sort the two chunk endpoints lexicographically.
3. Build edge id:
- Vertical: `V_minX_minY_maxX_maxY`
- Horizontal: `H_minX_minY_maxX_maxY`
4. Hash edge id with world seed and version key.

Result:
- Both chunks touching the same border compute the same edge id and hash.
- Socket seam agreement is deterministic.

### 3. Socket activation from edge hashes
Each canonical edge hash currently uses:
- `open = edgeKey % 100 < 35`

So base socket probability is 35% before artery forcing.

### 4. Artery-grid forcing (global traversability backbone)
Artery forcing is boundary-based (not chunk-local), which fixed prior seam mismatches.

Rules:
- `E` forced when `(chunkX + 1) % 4 === 0`
- `W` forced when `chunkX % 4 === 0`
- `S` forced when `(chunkY + 1) % 4 === 0`
- `N` forced when `chunkY % 4 === 0`

This guarantees both sides of the same boundary make the same artery decision.

### 5. Hallway carving to center lanes
If a side socket is active, halls are carved:
- Vertical halls use center columns `15` and `16`
- Horizontal halls use center rows `15` and `16`
- Tile type used: `FLOOR_HALL`
- If a chunk has zero active sockets, a center `2x2` hall anchor is carved so room-door connectivity remains possible.

Current tile set:
- `EMPTY`
- `FLOOR_HALL`
- `FLOOR_PREFAB`
- `FLOOR_ROOM`
- `WALL`
- `DOOR`

### 6. API output
`generateChunkGeometry(x, y, worldSeed, generatorVersion)` returns:
- `chunkX`, `chunkY`, `chunkSize`
- `tiles` (`Uint8Array`)
- `prefabs` (`[{id,x,y,w,h,rollPermille}]`)
- `zoneCandidates` (pre-prefab empty-space rectangles)
- `zones` (`[{x,y,w,h,area}]`) covering all untouched empty tiles
- `rooms` (`[{id,zoneIndex,x,y,w,h,area,doors[],connectedToHall}]`)
- `unresolvedZones` (zones too small for current BSP constraints)
- `roomCoverageArea`
- `allRoomsConnected`
- `accessReservedArea`
- `buildZones` (post-access, pre-room empty rectangles)
- `activeSockets` (`N/S/E/W`)
- `seedInfo` (`chunkSeed`, per-edge metadata, forced-by-artery flags)

### 7. Debug tooling
`main.js` renders a 3x3 chunk window around `(0,0)` and reports:
- Deterministic replay check (same chunk generated twice)
- Seam consistency check (`E` vs neighbor `W`, `S` vs neighbor `N`)
- Center-chunk zone summary and zone coverage validation
- Center-chunk prefab summary and prefab rectangle overlay
- Center-chunk room connectivity summary and room overlays

### 8. Prefab fit/skip (implemented)
- Catalog currently includes one test prefab: `gym_test`.
- Spawn roll is deterministic per chunk and prefab id.
- If rolled, generator searches `zoneCandidates` for an eligible zone.
- Special buildings claim entire selected zones (`full_zone` mode), not partial fixed-size footprints.
- Candidate zones must be hallway-adjacent (prefabs always touch hall network).
- If no fit exists, prefab is skipped immediately.
- No retries, no rerolls, no geometry reshaping.

### 9. BSP room generation (implemented)
- Remaining `zones` are processed with a two-pass approach:
- Pass A: reserve deterministic 2-tile access corridors per zone.
- Pass B: run BSP room generation on post-access `buildZones`.
- BSP splitting is deterministic (`MIN_ROOM_W/H`, recursion cap).
- Each leaf room is carved with:
- Border tiles as `WALL`
- Interior tiles as `FLOOR_ROOM`
- Access corridors are carved as `FLOOR_HALL` and are `2 tiles` wide.
- Corridors are reserved before room carving, so they do not cut through existing rooms.
- Hall doors are placed where rooms face hall tiles.
- Invariant in current implementation:
- room placement never retries
- room overlaps are prevented by carving only from post-access empty parcels
- each carved room receives at least one hall door

## What Is Missing (Compared To Plan)

## Generation pipeline gaps
- Missing: formal post-generation connectivity validation/degradation policy in docs (code currently applies practical fallbacks but not a separately declared policy contract).

## Data model gaps
- Missing: geometry layer separation beyond halls.
- Missing: entity placement hooks.

## Persistence gaps
- Missing: `WorldDelta` event schema in runtime.
- Missing: event recording on world mutations.
- Missing: chunk load replay of delta events.
- Missing: IndexedDB persistence and hydration.
- Missing: autosave timer and unload flush implementation.

## Versioning/migration gaps
- Partial: `generatorVersion` is accepted by API.
- Missing: version-router that dispatches to legacy generators (`v1`, `v2`, etc).
- Missing: per-chunk saved `generatorVersion` contract in durable state.

## Performance/system gaps
- Missing: chunk manager (load/unload radius around survivors/camera).
- Missing: memory pooling/reuse policy.
- Missing: delta compaction system.
- Missing: runtime telemetry for generation cost.

## Current Risks
- Visual repetition risk from fixed artery spacing (`4`) is not mitigated yet.
- No persistent state means refresh loses all dynamic changes (once gameplay starts).
- Current debug seam checks are local to rendered 3x3 view unless separately scripted.

## Recommended Next Build Order
1. Implement `WorldDelta` event schema in memory.
2. Record mutations during runtime and replay on chunk load.
3. Add IndexedDB persistence + autosave/on-unload flush.
4. Add generator version router + per-chunk saved generator version.
5. Add chunk manager for load/unload radius and pooling.

## Definition of Done For This Baseline
The current baseline is considered done when:
- Any tested adjacent chunk pair has matching seams.
- Generation is deterministic for fixed `(seed, x, y, version)`.
- Artery boundaries are enforced symmetrically across chunk borders.

Those conditions are currently met.
