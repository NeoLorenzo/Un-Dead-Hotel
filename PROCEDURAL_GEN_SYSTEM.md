# Procedural Generation System (Current)

This document describes the generator currently running in `main.js`.

## Scope

- Active architecture: corridor-tile pipeline only
- Chunk size: `32x32`
- Main debug render: `6x6` chunks (`NEXTGEN_CHUNKS_X=6`, `NEXTGEN_CHUNKS_Y=6`)
- World-scale debug render: full-screen `20x20` chunks

## Runtime Views

- `Corridor Tile Generator (6x6)` panel
- `Corridor Tile Catalog`
- `Access Corridor Catalogue`
- `Room Catalogue`
- Full-screen `20x20` preview screen (`Open 20x20 Chunk Preview`)

## Core Seed Model

- Base seed: `WORLD_SEED`
- Version: `GENERATOR_VERSION`
- Composite generation seed: `NEXTGEN_SEED = WORLD_SEED|corridor-tiles|GENERATOR_VERSION`
- Random picks use deterministic `seededIndex(...)` hashing.

## Pipeline Per Chunk

For each chunk in active bounds:

1. Pick corridor tile id (`1-5`) + rotation (seeded).
2. Enforce inter-chunk connectivity with rerolls and deterministic force-pair fallback.
3. Carve base corridor tile map.
4. Place special spaces.
5. Place access corridor tiles from catalogue.
6. Place room prefabs in room-fillable space.
7. Run additional room placement pass on leftover room-fillable zones.
8. Run room growth pass (upgrade to next prefab when rear clearance rules pass).
9. Stamp room prefab floor/wall tiles.
10. Place room doors.
11. Clear remaining `TILE_ACCESS_RESERVED` to `0`.
12. Emit metrics/report fields.

## Corridor Tile Catalog

- Built from unique socket families (rotations collapsed).
- Displayed as `Tile 1` to `Tile 5`.
- Runtime rotates selected tiles per chunk.

## Connectivity Enforcement

- Each chunk must connect to at least one in-bounds neighbor by corridor sockets.
- Enforcement strategy:
  - reroll assignment up to configured limit,
  - if still disconnected, force a matching pair with a neighbor.

## Special Space Generation

Specials are processed in this order:

1. Terrace
2. Restaurant
3. Gym
4. Kitchen
5. SPA

Current rules:

- Roll chance per special: `SPECIAL_SPACE_CHANCE_PERMILLE = 30` (3%).
- Candidate placement must touch an existing corridor.
- Rotation is allowed.
- `15x7` specials (`kitchen`, `spa`) must touch top or bottom chunk edge.
- Gym base sizes: `15x15` or `32x15` (rotated variants allowed).
- Gym expansion rule:
  - a placed `15x15` gym may expand when adjacent empty strip exists,
  - expansion targets `17x15` or `15x17` (deterministic pick when multiple valid options exist).

## Access Corridor Catalogue (Single Source Of Truth)

Catalogue entries are precomputed and reused for both:

- visual catalogue rendering
- runtime placement in chunks

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
- Carve corridors and reserve non-corridor cells with `TILE_ACCESS_RESERVED`.

## Room Prefab System (Current)

Prefab catalogue:

- `4x5`
- `6x5`
- `8x5`
- `10x5`

Runtime also uses rotated variants from the same prefab definitions.

Room placement behavior:

1. Place corridor-accessible prefab candidates per fill zone.
2. Prefer candidates with short-side corridor access when available.
3. Run an additional pass over leftover fill zones.
4. Run growth pass:
   - choose corridor-facing door side (deterministic),
   - inspect opposite side rear clearance,
   - if rear clearance is at least `2` tiles and next size fits, upgrade to next prefab.
5. Place doors with side preference:
   - preferred side,
   - short-side candidates,
   - any corridor-adjacent side.

Room fillability:

- `isRoomFillableTile(tile)` is `true` for `0` and `TILE_ACCESS_RESERVED`.

Final cleanup:

- Remaining `TILE_ACCESS_RESERVED` tiles are reset to `0` in final room output.

## Tile Semantics

- `0`: empty
- `1`: corridor
- `2..(2+SPECIAL_SPACE_DEFS.length-1)`: special-space fills
- `9`: access reserved (transient; cleared to `0` at end of room pass)
- `10`: room floor
- `11`: room wall
- `12`: room door

## Room/Chunk Rendering (Current)

- Room floor and wall base are rendered as floor color.
- Thin room walls are rendered as exterior overlays (`0.2` tile thickness).
- Room wall overlays are drawn per room perimeter, so each room has four visible walls (including between adjacent rooms).
- Same wall rendering style is used by:
  - chunk generator view
  - room catalogue preview

## Reported Metrics Per Chunk

- `roomZoneCount`
- `doorCount`
- `doorlessRooms`
- `undersizedRooms`
- `unfilledCount`
- `uncoveredPrefabArea`

## 20x20 Preview Screen

- Opens as full-screen replacement (not modal).
- Generates and renders `20x20` chunks with no visible chunk gaps.
- Uses same seed model and generation pipeline as main debug view.
