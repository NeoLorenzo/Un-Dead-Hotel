# Furniture System Expansion - Phase 5: Tactical Metadata and Debug Observability (Draft)

## Purpose

Expose tactical furniture metadata and add debug instrumentation so behavior and failures are inspectable in runtime.

## Status

- Draft created on **April 4, 2026**.
- Depends on Phase 2, Phase 3, and Phase 4 behavior availability.

## Scope (Locked For Phase 5)

- Expose furniture tactical metadata contracts:
  - cover,
  - barricade compatibility,
  - line-of-sight blocking.
- Expand debug overlays from earlier phases for furniture occupancy, movement profiles, and tactical tags.
- Add diagnostics lines/counters for interactions, rejection reasons, salvage events, and restock events.

## Non-Goals (Locked For Phase 5)

- No final combat system implementation.
- No fog-of-war rendering integration.
- No final art pass.

## Core Behavior Requirements (Locked)

1. Tactical metadata is queryable from furniture contracts.
2. Debug mode can render enough information to explain path/interaction outcomes.
3. Diagnostics include counts for attempts, failures, moves, dismantles, and restock events.

## File-Level Plan

1. `apps/phaser/debug/humanDebugOverlay.js`
2. `apps/phaser/debug/firstContactDiagnosticsPanel.js`
3. `apps/phaser/furniture/furnitureCatalog.js`

## Verification

1. Debug overlay shows occupancy/effect/tactical state for nearby furniture.
2. Rejection reason codes appear in diagnostics after failed interactions.
3. Counter metrics update reliably during interaction-heavy sessions.

## Exit Criteria

- Debug-first observability standard is met for furniture systems.
