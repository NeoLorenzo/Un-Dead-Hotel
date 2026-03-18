# Procedural Generation Plan

Project: Un-Dead Hotel  
Module: Hotel floor generation (current debug implementation + production hardening path)

This plan is intentionally detailed and execution-oriented. It reflects the **current single active generator architecture** (corridor-tile pipeline only) and defines the next build sequence.

## 1) Purpose

Build a robust, deterministic, scalable hotel floor generator that:

- preserves strong connectivity and path readability,
- places special spaces and access corridors coherently,
- fills all remaining usable area with valid rooms,
- scales from debug `3x3` sampling to broader `20x20` inspection and future runtime chunk streaming.

## 2) Current State (Accurate Baseline)

The current system (documented in `PROCEDURAL_GEN_SYSTEM.md`) already has:

- deterministic seeded generation (`NEXTGEN_SEED` + coordinate hashing),
- corridor tile catalog (`Tile 1-5`) with seeded rotation,
- connectivity enforcement pass (reroll + forced pair fallback),
- chunk-local special-space placement by size priority,
- access corridor catalog used as single source of truth (catalog + generation),
- room pass with merge behavior and corridor-adjacent door targeting,
- full-screen `20x20` preview with no visible chunk gaps.

Known current constraints:

- generation is still debug-oriented and centralized in `main.js`,
- cross-chunk special placement is not implemented,
- validation/reporting exists but is not formalized as strict fail criteria in all flows.

## 3) Design Objectives

### 3.1 Determinism

For fixed `(world seed, generator version, chunk coordinate)`, geometry and placement outcomes must be identical across runs.

### 3.2 Structural Reliability

Generated chunks should satisfy:

- no disconnected chunk in active bounds after connectivity pass,
- no room-fillable leftover voids after room fill stage,
- no final room without a corridor-adjacent door,
- no final room below minimum size target after merge resolution.

### 3.3 Controlled Variety

Variation should come from:

- tile choice/rotation,
- special-space roll/fit ordering,
- access-corridor tile fitting,
- room partition and merge decisions,

while preserving deterministic replay.

### 3.4 Scale Readiness

The same generation rules should hold for:

- local debug windows (`3x3`),
- larger sampled windows (`20x20`),
- eventual chunk streaming at runtime.

## 4) Non-Goals (For This Plan Horizon)

- Multi-floor navigation generation (`Z > 0`) is deferred.
- Full gameplay entity simulation (AI, combat, loot economy) is deferred.
- Artistic tile rendering and final UX polish are secondary to generation correctness.

## 5) Generation Contract (Target)

Per chunk, pipeline order remains:

1. corridor assignment (seeded tile + rotation),
2. connectivity correction pass,
3. base corridor carving,
4. special-space placement,
5. access-corridor placement from catalog,
6. room generation/merge/door pass,
7. validation + metrics emission.

Any future stage added to pipeline must declare:

- deterministic input keys,
- mutation boundaries (what tile states it may change),
- post-stage invariants.

## 6) Data and Rule Contracts

### 6.1 Tile Semantics

Keep clear semantic ownership:

- `1` corridor network,
- special-space fill codes,
- access-reserved fill state,
- room floor/wall/door states.

No stage may overwrite an earlier stage's protected semantic state unless explicitly allowed by policy.

### 6.2 Catalog Ownership

Access corridor catalog remains single source of truth:

- precomputed `tileMap` entries,
- same entries used by visual catalog and placement logic,
- no duplicate procedural carving path for runtime-only variants.

### 6.3 Special-Space Priority and Constraints

Specials continue largest-to-smallest allocation with deterministic roll + pick logic.

Constraint examples currently in scope:

- corridor contact requirement,
- edge constraints for `15x7` types,
- allowed rotation behavior,
- gym-specific expansion rule from `15x15` to `17x15`/`15x17` when adjacent strip exists.

## 7) Execution Roadmap

## Phase A: Validation Hardening (Highest Priority)

Goal: turn existing soft metrics into explicit generation quality guarantees.

Deliverables:

1. Formal validators per chunk:
   - `unfilled === 0`,
   - `doorless === 0`,
   - `undersized === 0`,
   - connectivity satisfied.
2. Standard validation result object emitted by both `3x3` and `20x20` flows.
3. UI summary for failed coordinates + reason codes.
4. Debug toggle: stop-on-first-failure / collect-all-failures.

Acceptance criteria:

- For approved seed list and bounds list, validator pass rate is 100%.
- Validator outputs are deterministic and stable across reload.

## Phase B: Corridor and Access Catalog Quality

Goal: increase meaningful variation while preserving navigability.

Deliverables:

1. Weighted selection support for corridor tiles.
2. Weighted selection support for access tiles per footprint set.
3. Rule-based filtering tags (example: high-throughput, branch-heavy, dead-end-light).
4. Catalog-level sanity checks:
   - connectivity touch potential,
   - duplicate-equivalent pruning,
   - footprint compatibility indexing.

Acceptance criteria:

- Distribution report shows non-flat, controlled usage by weights.
- No increase in validator failures from Phase A baseline.

## Phase C: Special Spaces Expansion

Goal: improve special-space placement quality and reduce awkward fragmentation.

Deliverables:

1. Special placement scoring (corridor exposure, compactness impact, residual-space quality).
2. Optional cross-chunk special-space prototype for large types.
3. Conflict resolver policy between special footprint and access-corridor opportunities.
4. Deterministic fallback ladder for no-fit cases.

Acceptance criteria:

- Higher placement success for intended specials at same roll chance.
- Residual-space quality improves (fewer pathological slivers).

## Phase D: Room System Refinement

Goal: ensure room topology feels intentional and production-safe.

Deliverables:

1. Better merge heuristics beyond simple rectangular adjacency tie-breaks.
2. Door scoring that prefers useful circulation over arbitrary pick.
3. Optional archetype tagging for room metadata (future gameplay hook).
4. Room graph extraction (room-to-corridor and room-to-room adjacency map).

Acceptance criteria:

- Maintains zero invalid-room metrics.
- Improves room graph connectivity quality metrics over baseline.

## Phase E: Runtime Integration

Goal: decouple generator from debug page and prepare chunk streaming.

Deliverables:

1. Extract generator modules from `main.js` into reusable engine files.
2. Define clean API:
   - `generateChunk(seed, version, x, y, options)`,
   - returns tile map + metadata + validation bundle.
3. Add chunk manager interfaces for load/unload radius and caching.
4. Add persistent delta strategy for world mutations (IndexedDB-backed).

Acceptance criteria:

- Debug page and runtime share the same generation core.
- Chunk reload replays deterministic static geometry and persisted deltas correctly.

## 8) Validation and Test Plan

### 8.1 Determinism Tests

- Golden seed snapshots for:
  - `3x3` around `(0,0)`,
  - `20x20` around configured origin,
  - selected edge-case coordinates (negative/positive quadrants).

### 8.2 Invariant Tests

Per generated chunk:

- connectivity invariant,
- no room-fillable leftovers,
- no doorless final room,
- no undersized final room.

### 8.3 Distribution/Balance Tests

- Special spawn rate observed over large sample should match configured probability envelope.
- Tile usage distribution should match configured weights within tolerance.

### 8.4 Performance Sampling

- `3x3` generation latency budget for interactive debugging.
- `20x20` preview generation latency budget for one-shot view generation.
- Memory footprint tracking for large sample renders.

## 9) Metrics To Track

Track and display (at minimum):

- connection passes and total rerolls,
- chunk-level validator failures by type,
- special-space placements by type and size,
- access tile usage by set/tile id,
- room totals, door totals, and merge counts.

## 10) Risks and Mitigations

Risk: Rule interactions create hidden invalid states.  
Mitigation: enforce strict post-stage validation and fail-fast diagnostics.

Risk: Increased tile variety harms readability.  
Mitigation: weighting + tag filtering + connectivity-aware scoring.

Risk: Cross-chunk specials destabilize deterministic ordering.  
Mitigation: deterministic region ordering and explicit ownership resolution rules.

Risk: Refactor to modular engine causes behavior drift.  
Mitigation: snapshot tests before/after extraction.

## 11) Milestone Definition of Done

A milestone is complete only when all are true:

1. Feature behavior implemented.
2. Determinism preserved on baseline seeds.
3. Invariant validators pass on milestone test bounds.
4. Documentation updated in:
   - `PROCEDURAL_GEN_SYSTEM.md` (what exists),
   - `PROCEDURAL_GEN_PLAN.md` (what's next),
   - `README.md` (high-level user-facing summary).

## 12) Immediate Next Implementation Slice

Recommended next coding slice (small, high impact):

1. Implement formal chunk validator object.
2. Add validator aggregation for `20x20` screen.
3. Surface failing chunk coordinates in preview metadata/report.
4. Add deterministic test harness script for baseline seeds.
