# Game Roadmap

Last updated: **April 4, 2026**

## Scope Lock

This document is future-only.

- Include: planned features and future delivery targets.
- Exclude: currently shipped state and historical implementation summaries.

For current shipped state, use `GAME_OVERVIEW.md`.

## Planned Feature Set (Locked)

1. Furniture System Expansion.
2. Survivor-only fog-of-war display system with persistent explored-memory visibility rules.
3. Naturally spawning food sources such as mini-bars.
4. Naturally spawning water sources such as sinks.
5. Renewable food sources such as hunting birds in patios.
6. Renewable water sources such as rain collectors in patios, crafted using garbage bags or other found containers.
7. Hunger and thirst needs for all humans.

## Phase Ordering (Locked)

1. Phase 1 focus: Planned Feature Set item `1` (Furniture System Expansion).
2. Phase 2 focus: Planned Feature Set item `2` (Survivor-Only Fog-of-War Display).

### Planned Feature 1: Furniture System Expansion

Implementation detail for Planned Feature Set item `1` is maintained only in:

- `documentation/Furniture System Expansion Documentation/FURNITURE_SYSTEM_EXPANSION_IMPLEMENTATION_PLAN.md`

### Planned Feature 2: Survivor-Only Fog-of-War Display (Locked)

This section defines Planned Feature Set item `2`.

### Fog Visibility States

1. Unseen areas are permanently black.
2. Areas that have been seen before but are not currently observed are darkened.
3. Areas currently observed by survivor vision are fully visible.

### Information Visibility Rules

1. Previously seen darkened areas only reveal environment memory:
   - room geometry,
   - furniture,
   - semi-permanent structures.
2. Previously seen darkened areas must not reveal dynamic agents:
   - survivors,
   - guests,
   - zombies,
   - other moving entities.

### Ownership and Scope

1. Fog-of-war is a player display/visibility system.
2. Fog-of-war applies only to survivor-side player presentation.
3. Non-player agents keep their own built-in perception behavior and are not governed by this display layer.

### Planned Feature 3: Natural Food Spawn Policy (Locked)

This section defines Planned Feature Set item `3`.

1. Natural food spawning is restricted to designated special locations.
2. Full special-location distribution logic is deferred to a later (post-MVP) phase.
3. MVP rule: mini-bars restock daily.

### Planned Feature 4: Natural Water Spawn Policy (Locked)

This section defines Planned Feature Set item `4`.

1. Natural water spawning is restricted to designated special locations.
2. Full special-location distribution logic is deferred to a later (post-MVP) phase.
3. MVP rule: sinks are infinite and do not restock on a timer.

## Roadmap Maintenance Rule

When roadmap priorities change:

1. Update this file first.
2. Keep this file future-only.
3. Keep the planned feature set explicit and ordered.
