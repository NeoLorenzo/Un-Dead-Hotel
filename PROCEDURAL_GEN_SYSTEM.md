# Procedural Generation System (Current)

This document describes the generator that is actually running in `main.js` right now.

## Scope

- Active architecture: corridor-tile pipeline only
- Legacy left-side generator: removed from UI and runtime flow
- Chunk size: `32x32`
- Main debug render: `3x3` chunks
- World-scale debug render: full-screen `20x20` chunks

## Runtime Views

- `Corridor Tile Generator (3x3)` panel
- `Corridor Tile Catalog`
- `Access Corridor Catalogue`
- Full-screen `20x20` preview screen (`Open 20x20 Chunk Preview`)

## Core Seed Model

- Base seed: `WORLD_SEED`
- Version: `GENERATOR_VERSION`
- Composite generation seed: `NEXTGEN_SEED = WORLD_SEED|corridor-tiles|GENERATOR_VERSION`
- Random picks use deterministic `seededIndex(...)` hashing.

## Pipeline Per Chunk

For each chunk in the active view bounds:

1. Pick corridor tile id (`1-5`) + rotation (seeded).
2. Enforce inter-chunk connectivity with rerolls and deterministic force-pair fallback.
3. Carve base corridor tile map.
4. Place special spaces.
5. Place access corridor tiles from catalogue.
6. Generate rooms over remaining room-fillable space.

## Corridor Tile Catalog

- Built from unique socket families (rotations collapsed).
- Displayed as `Tile 1` to `Tile 5`.
- Runtime rotates selected tiles per chunk instead of storing rotated variants.

## Connectivity Enforcement

- Chunk must connect to at least one in-bounds neighbor by corridor sockets.
- Passes:
  - reroll assignment up to configured limit,
  - if still disconnected, force a matching pair with a neighbor.

## Special Space Generation

Specials are processed in order (largest to smallest):

1. Terrace
2. Restaurant
3. Gym
4. Kitchen
5. SPA

Current rules:

- Roll chance per special: `30%` (`SPECIAL_SPACE_CHANCE_PERMILLE = 300`)
- Must touch an existing corridor.
- Rotation is allowed.
- `15x7` specials (`kitchen`, `spa`) are constrained to top/bottom chunk edges.
- Gym sizes: `15x15` or `32x15` (with rotation allowed).
- Gym expansion rule:
  - if a placed `15x15` gym has adjacent empty `2x15` or `15x2` strip,
  - it may expand to `17x15` or `15x17` (seeded side choice when multiple valid strips exist).

## Access Corridor Catalogue (Single Source Of Truth)

Catalogue entries are precomputed once and reused for both:

- visual catalogue rendering
- actual placement in chunks

Footprint sets:

- Set 1: `17x15`, `15x17`
- Set 2: `15x15`
- Set 3: `32x15`, `15x32`
- Set 4: `15x8` (blank-only currently)

Placement behavior:

- Identify remaining empty spaces.
- Process spaces largest-first.
- Try footprint sets largest-first.
- Candidate tile must touch existing corridor.
- Carve corridors and reserve non-corridor cells for room pass.

## Room Generation

Rooms are generated after specials and access corridors.

Implemented behavior:

- Room-fillable tiles are `EMPTY` and `ACCESS_RESERVED`.
- Initial room partitioning uses target size heuristics.
- Invalid rooms are merged into adjacent rectangular neighbors when possible.
- Room considered invalid if undersized or lacking corridor-adjacent door candidates.
- Doors are placed only on corridor-adjacent, non-corner wall tiles.
- Fillable leftovers are consumed so no room-fillable empty tiles remain.

Reported per chunk:

- room count
- door count
- doorless count
- undersized count
- unfilled count

## 20x20 Preview Screen

- Opens as full-screen page replacement (not modal).
- Generates and renders `20x20` chunks with no visual gaps between chunks.
- Uses same pipeline and seed model as the 3x3 panel.
- Shows summary metrics (passes, rerolls, rooms, doors, etc.).

