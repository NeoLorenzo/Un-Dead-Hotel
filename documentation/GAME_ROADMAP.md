# Game Roadmap

Last updated: **April 1, 2026**

## Scope Lock

This document is future-only.

- Include: planned features and future delivery targets.
- Exclude: currently shipped state and historical implementation summaries.

For current shipped state, use `GAME_OVERVIEW.md`.

## Planned Feature Set (Locked)

1. Strict fog-of-war gameplay enforcement tied to survivor vision.
2. Furniture System Expansion (see detailed lock below), including improved visuals/lighting/assets and fully furnished hotel rooms.
3. Naturally spawning food sources such as mini-bars.
4. Naturally spawning water sources such as sinks.
5. Renewable food sources such as hunting birds in patios.
6. Renewable water sources such as rain collectors in patios, crafted using garbage bags or other found containers.
7. Hunger and thirst needs for all humans.

### Planned Feature 2: Furniture System Expansion (Locked)

This section defines Planned Feature Set item `2`.

### Furniture as World Objects

1. Furniture must exist as explicit world objects/assets, not baked into static room art only.
2. Furniture objects are placed on grid tiles and tracked by runtime state.
3. Furniture object data must include:
   - object type (bed, nightstand, closet, sink, etc.),
   - position/orientation on grid,
   - movement interaction profile (`blocks` or `slows`),
   - optional inventory capability.

### Player Interaction: Pick Up and Move

1. Players can select valid furniture and issue move/reposition actions.
2. Furniture repositioning must resolve to legal tile placement (collision-valid and bounds-valid).
3. Placement preview/validation should reject invalid placement before commit.
4. Furniture move actions must preserve object identity and state (including inventory contents).

### Movement Interaction Rules

1. Each furniture object must define one movement effect:
   - `block`: tile is non-traversable,
   - `slow`: tile is traversable with movement penalty (climb-over/obstacle delay).
2. Furniture movement effects must be respected by AI and player-controlled locomotion/pathing.
3. Movement-effect behavior must be deterministic for equal world state and policy.

### Furniture Storage Objects

1. Inventory-capable furniture (for example nightstands and closets) must expose item storage slots/capacity.
2. Items can be inserted/removed through explicit interactions.
3. Inventory state persists when furniture is moved.
4. Furniture inventory must support future loot/spawn integrations (mini-bars, rooms, scavenging flow).

### Furniture Breakdown/Salvage

1. Furniture objects can be dismantled into resource outputs.
2. Dismantle action must remove the furniture object from the grid and world state.
3. Resource yields are determined by furniture type and stay deterministic for equal conditions.
4. Breakdown must respect inventory handling rules (stored items are ejected/transferred before object removal).

## Roadmap Maintenance Rule

When roadmap priorities change:

1. Update this file first.
2. Keep this file future-only.
3. Keep the planned feature set explicit and ordered.
