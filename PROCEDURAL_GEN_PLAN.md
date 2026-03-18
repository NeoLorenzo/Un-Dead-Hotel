# Procedural Generation Implementation Plan
Project: Un-Dead Hotel
Module: Infinite World Generation (MVP - Single Floor)

## Overview
This document defines the MVP world generation strategy for Hilbert's Hotel on a single infinite floor (`Z = 0`). The system must be:

- Deterministic: the same world seed and chunk coordinates always regenerate the same static layout.
- Seamless: chunk borders always stitch correctly.
- Traversable: the global world graph must never isolate players in chunk islands.
- Performant: only nearby chunks are loaded.
- Persistent: player impact survives unload/reload via durable delta state.

The architecture uses chunked generation, shared edge keys, an artery-grid connectivity guarantee, zone-first hallway layout, prefab insertion, and BSP room subdivision.

## Core Constants
- Scale: `1 tile = 1 meter`
- Chunk size: `32 x 32 tiles` (indices `0..31`)
- Main inter-chunk hall width: `2 tiles`
- Center hall indices on a 32-wide chunk: `15` and `16`
- Standard room door width: `1 tile`
- MVP floors: `Z = 0` only
- Artery spacing: every `4` chunks
- Autosave interval: every `60` seconds
- Generator version (current): `v1`

## Deterministic Seed Model
Each chunk has a master seed:

`chunkSeed = hash(WorldSeed, ChunkX, ChunkY, "chunk_v1")`

That seed is immediately split into independent streams to avoid sequence drift:

- `rng_geo = RNG(hash(chunkSeed, "geo"))` for walls, rooms, halls, sockets
- `rng_loot = RNG(hash(chunkSeed, "loot"))` for item placement
- `rng_ai = RNG(hash(chunkSeed, "ai"))` for ambient zombie/survivor spawn state

Changing loot or AI rules must not alter geometry.

## Shared Edge Key Contract (Socket Matching + Canonicalization)
Sockets are never rolled independently per chunk side. They are rolled from shared, canonical edge keys.

Canonical edge construction:
1. Build the two chunk endpoints for that boundary: `A(x1,y1)` and `B(x2,y2)`.
2. Sort endpoints lexicographically (`min` then `max`) so negative coordinates are stable.
3. Build edge id:
   - Vertical boundary: `V_[minX]_[minY]_[maxX]_[maxY]`
   - Horizontal boundary: `H_[minX]_[minY]_[maxX]_[maxY]`
4. Hash that id:
   - `edgeKey = hash(WorldSeed, edgeId, "edge_v1")`

Because both neighboring chunks canonicalize first, both sides always query the exact same key.

Example:
- West edge of chunk `(0,0)` and east edge of chunk `(-1,0)` both canonicalize to `V_-1_0_0_0`.

## Global Traversability Guarantee (Artery Grid Rule)
To prevent isolated chunk islands, arterial connectors override random edge activation.

- If `ChunkX % 4 === 0`, force `East` and `West` sockets active.
- If `ChunkY % 4 === 0`, force `North` and `South` sockets active.
- Non-artery edges may still use RNG.

Result:
- Infinite guaranteed hallway lattice across the world.
- Local chunks between arteries can still produce dead-ends, loops, and variation without breaking global reachability.

## Generation Pipeline (Zone-First / Cross-Hall)
When generating a new `32x32` chunk:

1. Resolve edge sockets from canonical shared edge keys.
2. Apply artery-grid overrides (`X % 4`, `Y % 4`) to force required global connectors.
3. Draw main `2 tile` halls from active sockets straight to center (`15-16` lanes).
4. Merge center overlaps into cross or T/L topology.
5. Derive rectangular sub-zones formed by straight hallway slices.
6. Prefab placement (fail-fast, no retries):
   - Evaluate each sub-zone for eligible prefab fit (gym, spa, restaurant, etc.).
   - Place prefab only if it fits and keeps required hall connectivity.
   - If no valid fit exists, skip prefab immediately.
   - Do not reroll, do not reshape chunk, do not loop.
7. BSP room generation:
   - Run BSP only on untouched rectangular sub-zones.
   - Stop at minimum room size (for example `4x4`).
   - Place `1 tile` doors from rooms to hallway network.
8. Validation pass (single pass, O(1) behavior):
   - Ensure all active sockets are connected to the main hall network.
   - Ensure placed prefab entrances connect to the hall network.
   - On violation, apply deterministic one-shot degradation (remove offending prefab footprint only), then continue.

This order prevents irregular leftovers from breaking BSP and avoids prefab-caused corridor severing.

## Static Geometry vs Dynamic World State (Event-Sourced Delta Model)
Static geometry is regenerated from seed. Dynamic player impact is stored separately as mutation events.

- Static (not saved per chunk): floors, walls, room partitions, base hallway layout.
- Dynamic (saved in `WorldDelta`): dropped items, broken doors, barricades, corpse state, opened containers, etc.

`WorldDelta` contract:
- Key: `"x,y,z"`
- Value: `{ generatorVersion, events[] }`
- Event example: `{ action: "DESTROY_DOOR", x: 5, y: 5 }`

### Persistence Backend (Web / GitHub Pages)
Durable storage is IndexedDB.

- In-memory `WorldDelta` cache is the hot runtime copy.
- Flush cache to IndexedDB every `60` seconds.
- Force flush on `window.onbeforeunload`.

### Chunk Load Flow
1. Generate static chunk geometry from deterministic pipeline.
2. Read `WorldDelta[x,y,z]` from memory/IndexedDB.
3. Replay `events[]` to mutate static geometry/entity state.
4. Spawn/render final resolved state.

### Chunk Unload Flow
1. Do not diff against baseline geometry.
2. Persist already-recorded mutation events for that chunk.
3. Release chunk memory.

## Generator Versioning and Migration (Legacy Preservation)
Goal: protect existing player bases when generation logic changes.

- Every chunk delta records `generatorVersion` at first visit (for example `v1`).
- New game updates may introduce `v2`, `v3`, etc., but old generator code paths remain in codebase.
- On load:
  - If chunk delta says `v1`, generate static chunk with `v1`.
  - If chunk is unexplored, generate with current version and store that version.

This enables backward compatibility: old explored chunks remain stable while new territory uses newer generation rules.

## Data Structures (Conceptual)
```javascript
const TILE_TYPES = {
  EMPTY: 0,
  FLOOR_HALL: 1,
  FLOOR_ROOM: 2,
  WALL: 3,
  DOOR: 4,
  PREFAB_FLOOR: 5,
  PREFAB_WALL: 6
};

class Chunk {
  constructor(x, y, z, worldSeed) {
    this.x = x;
    this.y = y;
    this.z = z; // MVP: always 0
    this.worldSeed = worldSeed;
    this.seed = hash(worldSeed, x, y, "chunk_v1");
    this.tiles = new Uint16Array(32 * 32);
    this.entities = [];
  }
}

// Runtime cache of durable chunk deltas.
const worldDelta = new Map(); // key: "x,y,z" -> { generatorVersion, events[] }
```

## Performance Notes
- Chunk activation: load/generate only chunks near survivors and camera bounds.
- Render culling: draw only visible viewport tiles and in-FOV tiles.
- Pooling: recycle chunk objects/arrays where practical.
- Delta compaction: periodically squash old event chains into minimal snapshot + tail events.
- Persistence batching: coalesce IndexedDB writes on autosave tick to reduce IO overhead.

## MVP Success Criteria
- Adjacent chunks always stitch with matching sockets.
- Geometry is deterministic across reloads for same seed and coordinates.
- Global chunk network remains traversable due to artery-grid guarantees.
- Prefab placement is fail-fast and never causes retry loops.
- BSP executes only on valid rectangles.
- Player-made changes persist after tab refresh/restart via IndexedDB.
- Explored chunks preserve historical generator versions across game updates.
