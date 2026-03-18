# Un-Dead Hotel

**Un-Dead Hotel** is a web-based, real-time post-apocalyptic colony management game hosted on GitHub Pages. Inspired by games like *RimWorld*, *Fallout Shelter*, and *Project Zomboid*, players must manage a group of survivors, scavenge for resources, and defend against the undead. 

The catch? The game takes place entirely within **"Hilbert's"**—a procedurally generated, infinitely expanding hotel. 

## 🏨 The Setting: Hilbert's Hotel
The hotel acts as the infinite, procedurally generated world of the game. The name "Hilbert's" is an ode to the famous infinite hotel paradox. While the game doesn't implement any complex paradox mechanics, the infinite nature of the building is the core flavor of the environment.
* **Infinite Layout:** There is no top and no bottom to the hotel. Because it is procedurally generated, players can stumble upon multiple gyms, restaurants, SPAs, kitchens, and rooms.
* **The "Rooftops":** Every floor features large exterior balconies and terraces that act as "rooftops," meaning players have outdoor access regardless of what floor they are on.
* **Base Building:** There are no arbitrary base boundaries or "room claiming" mechanics. Your base is defined simply by survivor presence. You can make your safe zone as large or as small as you want.

## 🎮 Core Gameplay & Visuals
* **Perspective:** Top-down view with simplistic graphics.
* **Real-Time Strategy:** The game runs in real-time (not turn-based).
* **Fog of War:** A strict fog of war is in effect. Unexplored areas, or areas not currently being looked at, are hidden. Visibility is determined by a "cone of vision" attached to each survivor.
* **The Goal:** There is no end game. The immediate short-term goal is simply to stay alive by finding food; the long-term goal is infinite survival.

---

## 🚀 Development Roadmap

### Phase 1: Minimum Viable Product (MVP)
The MVP will focus on establishing the core survival loop, basic AI, and world generation on a single horizontal plane.

* **World Generation:** The entire MVP takes place on a single, infinitely generating floor of Hilbert's Hotel. 
* **Survivors:** * Spawn inside locked hotel rooms for the player to discover.
  * Players have **full, direct control** over survivor actions (simple worker units).
  * Survivors can scavenge and craft basic weapons.
* **Zombies:** * Modeled after *The Walking Dead*: slow, dumb, and aimlessly wandering.
  * They will attack players on sight.
  * Infinite zombie spawns are explained by their access to the hotel's infinite stairwells.
* **Resources (Early Game):** * Scavenge for food and supplies in hotel kitchens and mini-bars. 

### Phase 2: Advanced Mechanics & Expansions
Once the MVP is stable, development will shift toward realism, automation, and expanding the Z-axis.

* **Vertical Expansion:** Expanding the procedural generation to include multiple stories (navigated via stairs).
* **Resource Shut-offs:** Like *Project Zomboid*, the hotel's infinite water and electricity will eventually shut off as the apocalypse progresses.
* **Self-Sustainability (Late Game):**
  * **Power:** Scavenging solar power banks to set up on the terrace/rooftops.
  * **Water:** Setting up rainwater collection systems on the terraces.
  * **Food:** Building bootleg hydroponics, setting up window-sill farms, and hunting birds on the exterior rooftops.
* **Survivor Evolution:**
  * **Spawning Logic:** To maintain realism (as locked-in survivors would eventually starve), the probability of finding survivors in locked rooms will decrease over time. New survivors will instead arrive via the stairwells.
  * **Autonomy:** Transitioning from direct control to giving survivors free will, personalities, and autonomous behaviors.