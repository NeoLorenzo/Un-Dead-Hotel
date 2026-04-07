# Phase 2: Hotel Map Generation Design (MVP 2)

## 1. The Core Problem
The legacy web version used an organic cellular-automata and noise-based pathway carving system. While great for generating randomized "dungeons" or "caves", this approach fundamentally failed to replicate the structure of a real-world hotel. 

Real hotels are hyper-structured and predictable. This new Unity 3D approach requires tearing down the organic cavern generator in favor of a **Structured Architectural Algorithm**.

## 2. Core Tenets of Hotel Architecture
To make the environment feel like an authentic hotel, our procedural generation must enforce:
*   **Linear Spines:** Hallways are long, straight, and rarely curve organically. They form a grid or a hub-and-spoke model.
*   **Identical Packing (The "Ribs"):** Rooms are manufactured to identical specifications and packed side-by-side along the hallways to maximize space.
*   **Centralized Cores:** Intersections of hallways contain elevator banks, stairwells, and utility rooms (ice machines, vending).
*   **End-Caps:** Hallways terminate in either a fire escape, a window, or a larger specialized Suite.

## 3. Dealing with Scale & Verticality (11x11 Chunks)
Instead of infinite 2D sprawl, the game will be procedurally generated in **height** (floor by floor in a colossal infinite tower). For the MVP, we are focusing on generating a single floor perfectly.

The map footprint is an **11x11 Chunk Block** (352x352 meters).
*   **The Colossal Atrium:** The dead center of the map (a 3x3 chunk area) is left entirely empty. This represents a massive hollow light-well stretching up and down the infinite tower.
*   **Patios & Bridges:** In the future, bridge-like structures will span across this foggy, bottomless atrium. These bridges will function as "Patios", allowing players to collect condensation rain and hunt birds roosting in the massive interior space.
*   **The Hotel Ring:** The hotel hallways and rooms generate in a square ring pattern surrounding this massive central abyss.

## 4. The "Prefab Layout" Strategy
We have pivoted away from complex 2D procedural generation logic. The new paradigm relies on Unity's greatest strength: **Hand-crafted Prefab Placement.**

### Generation Steps:
1.  **Block out Chunk Prefabs:**
    *   Assemble structural 32x32m Chunk prefabs populated with nested `Room_Base_6x7` prefabs and 2m wide corridors.
2.  **Manual Floor Assembly:**
    *   Drag and drop the Chunk prefabs into the Unity Scene following the 11x11 Grid footprint to manually assemble a mathematically perfect "Floor Layout".
3.  **Floor Prefabbing:**
    *   Group the 112 arranged chunks into a single overarching `Floor_01` prefab.
4.  **Runtime Vertical Stacking:**
    *   The generation scripts are restricted to only handling the Z-axis (height). The game loops procedurally stack `Floor_01` vertically on top of itself to create the infinite tower structure.

## 5. Unity Prefab Strategy
We will no longer "paint" individual wall and floor tiles for rooms. Instead, we assemble the world out of pre-designed chunks of geometry.

### Essential Prefabs Needed:
*   **Hallway Segments:** Modular floor/ceiling slices (e.g., 2m wide x 1m deep).
*   **Core Hubs:** Central intersection pieces covering standard 2-way, 3-way, and 4-way hallway joints.
*   **Standard Room Prefab:** A self-contained GameObject holding the floor, outer walls, interior bathroom walls, and the room entrance door. (e.g., 4m wide x 8m deep).
*   **Corner / Suite Prefab:** A larger variant placed exclusively at hallway terminations or 90-degree outer bends.

## 6. Technical Implementation Details
*   **Grid Constraint:** Everything aligns strictly to the **1m Standard Grid** using simple Transform Coordinates rather than heavy arrays.
*   **Execution Order:**
    1. Unity runtime starts.
    2. Map script reads the targeted number of floors for the current section.
    3. Map script calls `Instantiate()` on the massive `Floor_01` prefab dynamically at `[Y = Height Offset]`.
