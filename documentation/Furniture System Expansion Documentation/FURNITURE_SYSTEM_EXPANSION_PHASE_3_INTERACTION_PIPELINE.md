# Furniture System Expansion - Phase 3: Interaction Pipeline (Draft)

## Purpose

Implement survivor-issued furniture interactions and enforce deterministic mutation flow for move, store, use, and dismantle operations.

## Status

- Draft created on **April 4, 2026**.
- Depends on Phase 1 and Phase 2 completion.

## Scope (Locked For Phase 3)

- Add furniture interaction system and command dispatch.
- Integrate survivor command surfaces with furniture operations.
- Add storage insert/remove behavior for inventory-capable furniture.
- Add dismantle/salvage behavior with pre-removal stored-item policy.
- Add per-furniture mutation locking/serialization to avoid conflicting same-tick operations.
- Ensure move operations preserve identity and inventory state.

## Non-Goals (Locked For Phase 3)

- No sink/mini-bar restock cadence logic yet.
- No tactical metadata rendering yet.
- No full hardening/documentation sync pass yet.

## Core Behavior Requirements (Locked)

1. Interaction commands are legality-checked before state mutation.
2. Move operations preserve furniture ID and inventory contents.
3. Storage insert/remove operations are deterministic.
4. Dismantle resolves stored-item ejection/transfer before object removal.
5. Conflicting operations for the same furniture ID are serialized deterministically.
6. Salvage output is deterministic by furniture type policy.

## File-Level Plan

1. `apps/phaser/furniture/furnitureInteractionSystem.js` (new)
2. `apps/phaser/furniture/furnitureInventoryModel.js` (new)
3. `apps/phaser/furniture/furnitureSalvageModel.js` (new)
4. `apps/phaser/human/humanCommandController.js`
5. `apps/phaser/human/humanManager.js`

## Verification

1. Interaction operations succeed/fail deterministically with reason visibility.
2. Moving furniture never loses or mutates stored items unexpectedly.
3. Same-tick conflicting operations resolve in stable deterministic order.
4. Dismantle transitions remove occupancy and produce expected salvage output.

## Exit Criteria

- Core furniture interaction loop is stable and ready for resource subtype behavior.
