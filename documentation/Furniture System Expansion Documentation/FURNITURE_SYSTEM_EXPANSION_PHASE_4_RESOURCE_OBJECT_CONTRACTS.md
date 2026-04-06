# Furniture System Expansion - Phase 4: Resource Object Contracts (Draft)

## Purpose

Implement MVP resource behavior for furniture-backed sources with locked sink and mini-bar policies.

## Status

- Draft created on **April 4, 2026**.
- Depends on Phase 3 interaction pipeline completion.

## Scope (Locked For Phase 4)

- Add furniture resource-source model.
- Implement sink behavior as infinite water source (no depletion/restock timer).
- Implement mini-bar behavior with deterministic daily restock cadence driven by simulation day index.
- Persist source state and timing data through save/load.

## Non-Goals (Locked For Phase 4)

- No full special-location spawn distribution system yet.
- No hunger/thirst full economy balancing pass yet.
- No non-MVP resource-source variants.

## Core Behavior Requirements (Locked)

1. Sink access cannot fail from depletion.
2. Mini-bar restock occurs once per deterministic simulation day boundary.
3. Save/load restores mini-bar restock timing correctly.
4. Resource-source behavior remains deterministic for equal input and simulation-clock state.

## File-Level Plan

1. `apps/phaser/furniture/furnitureResourceSourceModel.js` (new)
2. `apps/phaser/furniture/furnitureCatalog.js`
3. `engine/world/worldStore.js`

## Verification

1. Repeated sink use always returns available water.
2. Mini-bars restock at expected simulation day boundary and not before.
3. Save/load preserves post-use and pre/post-restock state correctly.

## Exit Criteria

- MVP furniture resource contracts are complete and stable.
