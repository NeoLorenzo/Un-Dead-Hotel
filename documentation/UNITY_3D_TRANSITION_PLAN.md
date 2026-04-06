# Unity 3D Transition Plan: Un-Dead Hotel

## Overview

This document outlines the architectural and mechanical changes required to transition "Un-Dead Hotel" from a 2D HTML/Phaser web game to a 3D Unity application. The objective is to leverage Unity's built-in 3D capabilities for pathfinding and physics while retaining the core visual top-down aesthetic and grid-based logic. 

## 1. Engine and Project Setup

*   **Engine:** Unity (C#)
*   **Camera Configuration:** Strict **Orthographic** projection oriented top-down. This provides a flat 2D perspective feel while allowing elements to possess 3D volume, maintaining the readable visual silhouettes established in the web version.
*   **Visual Direction:** Simplistic, readable visuals using 3D primitives to start before eventually scaling to fully-fledged 3D models.

## 2. World Architecture & Grids

The environment shifts from a 2D tile matrix to a physical 3D space driven by a three-tiered layout system:

*   **Macro Grid / Chunk Grid (32x32 meters):** Used for rendering boundaries, hierarchical organization, and world management.
*   **Standard Grid (1x1 meter):** The primary grid for macroscopic level generation (walls, room outlines, and floors). 
*   **Micro Grid / Sub-Grid (0.25x0.25 meters):** Used for precise, high-fidelity placement of interactables, doors, and furniture. This enables organic interior layouts without being chained to full 1x1 meter blocks. 

## 3. Map Generation Constraints (MVP)

To accelerate development and simplify boundary testing during the Unity transition, **infinite procedural generation will be temporarily paused**.

*   **Map Size:** The game will utilize a fixed, static boundary of **10x10 Chunks** (320x320 meters total space).
*   **Generation Strategy:** C#-translated generation scripts will pre-populate this 10x10 chunk space on startup, filling the bounds with corridors, rooms, and special spaces without needing to dynamically calculate chunk neighbor seams at runtime.

## 4. Pathfinding and Movement

To take advantage of the transition to a 3D engine, custom A* grid pathing will be sunset in favor of Unity's native solutions.

*   **Navigation System:** Unity **NavMesh**.
*   **Implementation Mechanics:** 
    *   The 1x1 meter walls and structure will serve as static geometry for the NavMesh baking process.
    *   Furniture placed on the 0.25 micro-grid will utilize `NavMeshObstacle` components (with carving enabled when appropriate) to dynamically update the walking space.
*   **Execution:** All agents (Survivors, Guests, Zombies) will use the `NavMeshAgent` component. This provides out-of-the-box local avoidance, steering, and path smoothing, replacing the custom `lineTileRasterizer` entirely.

## 5. Agent Visuals & Components

Sprite-based rendering will be replaced by Unity 3D primitive capsules to immediately establish physical presence, eye-lines, and hitboxes.

*   **Survivors:** Dark Blue Capsule.
*   **Guests:** Light Blue Capsule.
*   **Zombies:** Green Capsule.

All characters will be driven by dedicated `MonoBehaviour` controllers (e.g., `SurvivorController`, `ZombieController`) that interface directly with their attached `NavMeshAgent`.

## 6. Input Mapping & Mouse Selection

The transition necessitates converting web DOM coordinates to 3D world space coordinates for player commands.

*   **Screen-to-World Translation:** All mouse clicks (survivor selection, movement commands) will utilize `Camera.main.ScreenPointToRay` to cast a ray intersecting a 0-level Y-plane (or the floor geometry) to determine the exact 3D coordinate for NavMesh destinations.
*   **Drag-Box Selection:** Rebuilding the multi-select drag-box will involve capturing initial and final screen coordinates, generating a perspective camera frustum (or orthographic bounding box), and using `Physics.OverlapBox` to select `Survivor` tagged capsules within.
*   **Commands:** `Shift + Left Click` (toggle select) and `Ctrl + Left Click` (group move) will map directly to Unity's new Input System actions.

## 7. Physics, Combat, and Perception

Custom JavaScript collision detection is replaced by Unity's robust Physics engine.

*   **Perception (Cone + Line-of-Sight):** Guest and Zombie vision lines will be executed using standard `Physics.Raycast` against layermasks (e.g., `WallLayer`, `AgentLayer`). The cone angle checks will utilize `Vector3.Angle` combined with a raycast to ensure walls obstruct vision correctly.
*   **Touch Attacks & Conversions:** Zombies colliding with Humans (interactions for 20 HP damage / survivor conversion) will utilize `OnTriggerEnter` or `OnCollisionEnter` events via attached `Rigidbody` (set to `IsKinematic = true` to allow NavMesh priority) and `CapsuleCollider` components.

## 8. UI and HUD 

Elements previously residing in HTML/CSS layers will be translated to Unity Canvas elements.

*   **World Space GUI:** HP bars and Zombie cooldown bars will be implemented as World Space Canvases pinned above agent transforms. An attached script will restrict their rotation to force them to constantly billboard/face the orthographic camera.
*   **Screen Space HUD:** The extinction Game-Over overlay and the Backquote (`\``) debug diagnostics panel will be created on a Screen Space (Overlay) Canvas.

## 9. Development Phasing

### Phase 1: Project Setup & Core Grid System (MVP 1)
The immediate focus is standing up the Unity environment and establishing the spatial grid foundations.
*(No active game mechanics during this phase.)*

1.  **Project Skeleton & Camera**
    *   Initialize the Unity project.
    *   Configure the Orthographic camera to replicate the top-down perspective.
2.  **Grid Visualization & Data Structure**
    *   Implement C# data structures to manage coordinate tracking across the three grid layers: 32m (Chunk), 1m (Standard Area), and 0.25m (Micro-Grid).
    *   Build debug visualizers (gizmos) for the 32x32m chunks to validate spatial boundaries visually in the Editor.

### Phase 2: Hotel Map Generation Framework (MVP 2)
Focus shifts to porting the JavaScript map generation into Unity, dealing with procedural layout constraints in C#.

1.  **Static Bounded Corridor Translation**
    *   Translate the base JavaScript `chunkGenerator.js` logic to place corridors and high-level zones across the static 10x10 chunk plane.
2.  **Prefab-Based Room Generation (TBD)**
    *   *Note: Room generation strategy is currently marked TBD.*
    *   We intend to transition to instantiating distinct Unity Prefabs for each room type instead of single-tile painting. The exact design, connectivity mapping, and technical implementation for this prefab workflow will be deeply strategized before code is written.

### Phase 3: Navigation & Agents (Post-MVP)
1.  **NavMesh Baking** - Configure static flags on the generated floor/wall geometry and bake the Unity NavMesh.
2.  **Agent Primitives** - Introduce the colored NavMeshAgent capsules (Green, Dark Blue, Light Blue) into the world.
3.  **Basic Locomotion** - Convert JS agent managers/controllers to `MonoBehaviour` equivalents and execute standard NavMesh pathing.

### Phase 4: Gameplay Systems & UI (Post-MVP)
1.  **Input Translation** - Implement `Camera.main.ScreenPointToRay` for point-and-click movement and bounding-box `Physics.OverlapBox` for multi-selection.
2.  **Physics Perception** - Rebuild the guest/zombie vision cones using Unity `Physics.Raycast`, and wire up combat loops via `OnTriggerEnter`.
3.  **UI & Canvas** - Build out the World-Space HP bars that billboard/face the camera, and the Screen-Space overlay panels for game state context.
