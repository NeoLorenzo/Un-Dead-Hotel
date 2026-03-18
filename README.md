# Un-Dead Hotel

**Un-Dead Hotel** is a web-based, real-time post-apocalyptic colony management game hosted on GitHub Pages. Inspired by games like *RimWorld*, *Fallout Shelter*, and *Project Zomboid*, players must manage a group of survivors, scavenge for resources, and defend against the undead.

The catch? The game takes place entirely within **"Hilbert's"** - a procedurally generated, infinitely expanding hotel.

## Current Build Status

Current debug build (implemented now):

- Single active procedural generator architecture (corridor-tile pipeline).
- Legacy left-side generator panel removed.
- Active debug views:
  - `3x3` chunk generator view,
  - corridor tile catalog,
  - access corridor catalogue,
  - full-screen `20x20` chunk preview.

Current procedural highlights:

- Deterministic seeded generation by chunk coordinate.
- Corridor tile assignment from a fixed tile catalog (`Tile 1-5`) with seeded rotation.
- Connectivity enforcement pass (reroll + deterministic forced-pair fallback).
- Special spaces generated chunk-locally with current roll chance at `30%` (`SPECIAL_SPACE_CHANCE_PERMILLE = 300`).
- Access corridor placement uses the catalogue as single source of truth.
- Remaining fillable space is converted into rooms with room merge/door rules.

Detailed technical state and roadmap are tracked in:

- `PROCEDURAL_GEN_SYSTEM.md`
- `PROCEDURAL_GEN_PLAN.md`

## The Setting: Hilbert's Hotel

The hotel acts as the infinite, procedurally generated world of the game. The name "Hilbert's" is an ode to the famous infinite hotel paradox. While the game does not implement complex paradox mechanics, the infinite nature of the building is the core flavor of the environment.

- **Infinite Layout:** There is no top and no bottom to the hotel. Because it is procedurally generated, players can encounter multiple gyms, restaurants, SPAs, kitchens, and rooms.
- **The "Rooftops":** Every floor features large exterior balconies and terraces that act as rooftops, meaning players have outdoor access regardless of floor.
- **Base Building:** There are no arbitrary base boundaries or room-claiming mechanics. Your base is defined by survivor presence.

## Core Gameplay & Visuals

- **Perspective:** Top-down view with simple graphics.
- **Real-Time Strategy:** The game runs in real-time (not turn-based).
- **Fog of War:** Unexplored areas, or areas not currently observed, are hidden. Visibility is determined by a cone of vision attached to each survivor.
- **The Goal:** There is no final end state. Short term is survival (food/resources), long term is indefinite survival.

---

## Development Roadmap

### Phase 1: Minimum Viable Product (MVP)

The MVP focuses on the core survival loop, basic AI, and world generation on a single horizontal plane.

- **World Generation:** The MVP takes place on one infinitely generating floor of Hilbert's Hotel.
- **Survivors:**
  - Spawn inside locked hotel rooms for discovery.
  - Player has full direct control over survivor actions (worker-unit style).
  - Survivors can scavenge and craft basic weapons.
- **Zombies:**
  - Modeled after *The Walking Dead*: slow, simple, wandering.
  - Attack players on sight.
  - Infinite zombie presence is explained by access to infinite stairwells.
- **Resources (Early Game):**
  - Scavenge food and supplies in kitchens and mini-bars.

### Phase 2: Advanced Mechanics & Expansions

After MVP stabilization, development shifts toward realism, automation, and vertical expansion.

- **Vertical Expansion:** Extend procedural generation to multiple stories (via stairs).
- **Resource Shut-offs:** Infinite water/electricity eventually fail as the apocalypse progresses.
- **Self-Sustainability (Late Game):**
  - **Power:** Scavenge solar power banks for terrace setups.
  - **Water:** Build rainwater collection on terraces.
  - **Food:** Build improvised hydroponics, window-sill farms, and hunt birds from rooftop-like exterior spaces.
- **Survivor Evolution:**
  - **Spawning Logic:** Over time, locked-room survivor discovery probability decreases; new survivors increasingly arrive via stairwells.
  - **Autonomy:** Progress from direct control to personality-driven autonomous survivor behavior.

