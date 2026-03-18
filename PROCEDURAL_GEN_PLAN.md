# Procedural Generation Plan

Project: Un-Dead Hotel  
Module: Hotel floor generation

This plan reflects the current running architecture in `main.js` and lists the next implementation priorities.

## 1) Purpose

Build a deterministic, scalable hotel floor generator that:

- maintains corridor connectivity,
- places specials and access corridors coherently,
- uses room prefabs efficiently,
- supports both `6x6` debug inspection and `20x20` large preview,
- is ready to move from debug page code to reusable runtime modules.

## 2) Current Baseline

Current runtime baseline (see `PROCEDURAL_GEN_SYSTEM.md`):

- corridor-tile generator with seeded assignment + rotation,
- deterministic connectivity enforcement pass,
- special-space placement and access-corridor placement,
- prefab-driven room placement (`4x5`, `6x5`, `8x5`, `10x5` + rotations),
- additional leftover-zone room placement pass,
- room growth pass (rear-clearance-driven upgrades),
- room door placement with side preference,
- cleanup pass that clears remaining `TILE_ACCESS_RESERVED` to `0`,
- shared thin exterior room-wall rendering in chunk view + room catalogue.

Known constraints:

- generation remains centralized in `main.js`,
- cross-chunk special placement is still not implemented,
- validators are reported as metrics, not enforced as hard failures in all flows.

## 3) Core Objectives

### 3.1 Determinism

For fixed `(seed, version, chunk coordinate)`, output must be stable across runs.

### 3.2 Structural Reliability

Target outcomes:

- no disconnected chunks in active bounds after connectivity pass,
- no non-corridor-accessible room persisted in final chunk,
- no `TILE_ACCESS_RESERVED` in final room output,
- predictable room-door behavior with deterministic tie-breaking.

### 3.3 Space Utilization

Improve usable-area coverage while preserving corridor access constraints:

- maximize valid prefab packing,
- reduce avoidable uncovered pockets,
- keep growth pass collision-safe and deterministic.

### 3.4 Runtime Readiness

Prepare extraction from debug UI into reusable generation modules.

## 4) Non-Goals (Current Horizon)

- multi-floor generation (`Z > 0`),
- gameplay simulation systems,
- final art/UX polish beyond generation-debug needs.

## 5) Generation Contract

Per chunk, stage order remains:

1. corridor assignment + rotation
2. connectivity correction
3. base corridor carving
4. special-space placement
5. access-corridor placement
6. initial room prefab placement
7. additional room placement pass
8. room growth pass
9. room stamp + doors
10. reserved-tile cleanup
11. metrics/report emission

Any new stage must define:

- deterministic input keys,
- allowed tile mutations,
- post-stage invariants.

## 6) Execution Roadmap

## Phase A: Validation Hardening

Goal: convert soft metrics into explicit pass/fail validation outputs.

Deliverables:

1. formal chunk validator object,
2. aggregated validator summary for `6x6` and `20x20`,
3. failing chunk coordinate list + reason codes,
4. stop-on-first-failure debug toggle.

Acceptance criteria:

- deterministic validator results for baseline seeds,
- validator pass/fail visible in both debug views.

## Phase B: Room Space Utilization Quality

Goal: reduce wasted fill space under current corridor-access constraints.

Deliverables:

1. improved candidate scoring for leftover passes,
2. growth-pass diagnostics (growth attempts/success/fail reasons),
3. optional extra placement iteration cap with deterministic ordering,
4. metrics for uncovered-area distribution by chunk.

Acceptance criteria:

- lower average `uncoveredPrefabArea` with no determinism regressions.

## Phase C: Special/Access Conflict Quality

Goal: reduce fragmentation introduced by earlier stages.

Deliverables:

1. special placement scoring for residual-space quality,
2. access-corridor placement quality scoring against room opportunity cost,
3. deterministic fallback ladder when high-cost placements block room fill.

Acceptance criteria:

- improved room coverage without connectivity regressions.

## Phase D: Generator Modularization

Goal: move generation core out of debug UI code.

Deliverables:

1. extract core generation functions from `main.js`,
2. expose a chunk API (`generateChunk(...)`) returning tile map + metadata,
3. keep debug page as consumer of shared core.

Acceptance criteria:

- identical outputs before/after extraction on baseline seeds.

## 7) Test and Metrics Plan

### 7.1 Determinism Tests

- golden snapshots for:
  - `6x6` window around configured origin,
  - `20x20` preview bounds,
  - selected edge-case coordinates.

### 7.2 Invariant Tests

Per chunk:

- connectivity status,
- doorless room count,
- undersized room count,
- reserved-tile residue check,
- uncovered-area metrics.

### 7.3 Performance Checks

- interactive latency budget for `6x6`,
- one-shot latency budget for `20x20`,
- memory footprint sampling.

## 8) Immediate Next Slice

1. Add formal chunk validator object and reason codes.
2. Add explicit reserved-tile residue validator (`TILE_ACCESS_RESERVED` must be zero in final output).
3. Add growth-pass telemetry to debug report (`attempted`, `upgraded`, `blocked` counts).
4. Add deterministic snapshot test harness for baseline seeds.
