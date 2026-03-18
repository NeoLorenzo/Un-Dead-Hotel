# Un-Dead Hotel

Un-Dead Hotel is a browser-based procedural generation sandbox for an infinite hotel survival game.

## Current Debug Build

The app currently runs one active hotel generator architecture (the former "right side" panel).  
The legacy left-side generator and its validation panel are removed.

Implemented debug views:

- `3x3` chunk generator view (active architecture)
- Corridor tile catalog
- Access corridor catalogue
- Full-screen `20x20` chunk preview screen (opened from button)

## Current Procedural Rules (Implemented)

- Deterministic seeded generation per chunk coordinate.
- Corridor tile assignment uses a fixed tile catalog (`Tile 1-5`) with seeded rotation.
- A second pass enforces neighbor connectivity (reroll + deterministic forced pair fallback).
- Special spaces are placed chunk-locally in size-priority order.
- Special-space roll chance is `30%` per special (`SPECIAL_SPACE_CHANCE_PERMILLE = 300`).
- Access corridor placement uses a precomputed catalogue as the single source of truth.
- Remaining space is converted into rooms with:
  - minimum size target logic (`>= 5x5` intent),
  - corridor-adjacent doors,
  - merge behavior for invalid rooms,
  - no remaining fillable empty room space.

## Special Spaces

Special types currently in use:

- Terrace
- Restaurant
- Gym
- Kitchen
- SPA

Size/orientation and placement constraints are defined in `main.js` and documented in `PROCEDURAL_GEN_SYSTEM.md`.

## Running

Open `index.html` via the local static server workflow you already use in this repo, then use:

- main generator canvas for `3x3`,
- `Open 20x20 Chunk Preview` for full-screen world-scale inspection.

