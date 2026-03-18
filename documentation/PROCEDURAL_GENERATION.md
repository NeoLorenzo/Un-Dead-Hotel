# Procedural Generation

## Overview

Procedural generation is implemented in `engine/generation/chunkGenerator.js`.

The system is deterministic for fixed inputs:

- world seed,
- generator version,
- chunk coordinate.

Both debug and game runtime consume this same generation module.

## Seed Model

- Base seed: `WORLD_SEED`
- Generator version: `GENERATOR_VERSION`
- Composite seed: `NEXTGEN_SEED = WORLD_SEED|corridor-tiles|GENERATOR_VERSION`
- Deterministic random selection: `seededIndex(...)`

## Chunk Pipeline

Per chunk, generation proceeds in this order:

1. Corridor tile assignment (tile id + rotation).
2. Connectivity correction (reroll and deterministic force-pair fallback).
3. Base corridor carving.
4. Special-space placement.
5. Access-corridor placement.
6. Room placement from fillable space.
7. Additional room pass on leftovers.
8. Room growth pass.
9. Room stamp + door placement.
10. Reserved tile cleanup (`TILE_ACCESS_RESERVED` -> `0`).
11. Validation and metrics output.

## Connectivity Rules

- Each chunk is expected to connect to at least one in-bounds neighbor.
- Enforcement strategy:
  - reroll within configured limits,
  - force a deterministic matching neighbor pair if still disconnected.

## Special Spaces

Current generation order:

1. Terrace
2. Restaurant
3. Gym
4. Kitchen
5. SPA

Rules include:

- roll chance per special,
- corridor adjacency requirement,
- edge constraints for specific footprints,
- deterministic gym expansion behavior where applicable.

## Access Corridors

Access corridor catalogue acts as single source of truth for:

- tile previews,
- runtime placement.

Placement strategy:

- derive remaining empty spaces,
- process largest spaces first,
- try larger footprints first,
- require corridor contact,
- mark non-corridor area as reserved during placement.

## Room Generation

Room generation includes:

- prefab candidate selection,
- corridor-accessibility checks,
- additional placement passes,
- growth upgrades with rear-clearance rules,
- deterministic door placement,
- cleanup and validation.

## Tile Semantics

- `0`: empty
- `1`: corridor
- `2..`: special spaces
- `9`: transient access-reserved
- `10`: room floor
- `11`: room wall
- `12`: room door

## Validator and Metrics

Chunk outputs include diagnostics such as:

- connection validity,
- doorless/undersized room warnings,
- reserved-residue failures,
- room coverage/growth telemetry,
- aggregated reason-code summaries.

## Current Scope Boundaries

In-scope now:

- single-floor chunk generation,
- deterministic chunk-local generation with neighbor-aware connectivity.

Not yet in-scope:

- vertical/multi-floor generation,
- fully cross-chunk semantic space planning,
- gameplay simulation systems beyond world generation/runtime rendering.
