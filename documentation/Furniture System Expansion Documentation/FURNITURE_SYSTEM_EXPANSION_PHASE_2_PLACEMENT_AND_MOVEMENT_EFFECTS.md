# Furniture System Expansion - Phase 2: Placement and Movement Effects (Draft)

## Purpose

Implement placement validation and integrate furniture movement profiles into traversal/pathing behavior.

## Status

- Draft created on **April 4, 2026**.
- Depends on Phase 1 furniture domain + persistence completion.

## Scope (Locked For Phase 2)

- Add furniture placement validator with deterministic reason codes.
- Validate bounds, occupancy, collisions, and footprint legality.
- Add deterministic placement-preview evaluation hooks used by later interaction commands.
- Integrate movement profiles into traversal:
  - `block` -> non-traversable,
  - `slow` -> traversable with penalty.
- Keep behavior deterministic for equal world state and inputs.

## Non-Goals (Locked For Phase 2)

- No full interaction command pipeline yet.
- No storage/dismantle behavior yet.
- No sink/mini-bar restock behavior yet.

## Core Behavior Requirements (Locked)

1. Invalid placement attempts are rejected before commit.
2. Reject responses include stable reason codes.
3. Placement preview checks return the same reason codes as commit validation.
4. Traversal/pathing respects furniture `block` and `slow` profiles.
5. Movement/pathing output remains deterministic for equal conditions.

## File-Level Plan

1. `apps/phaser/furniture/furniturePlacementValidator.js` (new)
2. `engine/world/subTilePathfinder.js`
3. `apps/phaser/phaserRuntimeAdapter.js`
4. `apps/phaser/human/humanCommandController.js`

## Verification

1. Placement preview/validation rejects illegal tiles consistently.
2. Preview reason codes match commit-time reason codes for identical requests.
3. Agents route around `block` furniture and account for `slow` penalties.
4. Repeated identical test inputs yield identical pathing decisions.

## Exit Criteria

- Placement legality and movement-effect contracts are stable for Phase 3 interaction work.
