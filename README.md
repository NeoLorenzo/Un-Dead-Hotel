# Un-Dead Hotel

Un-Dead Hotel is a web-based, real-time post-apocalyptic colony management game set inside an infinitely generated hotel.

## Runtime Entrypoints

- Default runtime (Phaser): `index.html`
- Canvas runtime fallback: `game.html`
- Debug runtime fallback: `debug.html`

## Documentation

All project documentation is in the `documentation/` folder.

- `documentation/README.md` (index)
- `documentation/GAME_OVERVIEW.md`
- `documentation/GAME_ARCHITECTURE.md`
- `documentation/PROCEDURAL_GENERATION.md`
- `documentation/GAME_RUNTIME.md`
- `documentation/MODULE_API_REFERENCE.md`
- `documentation/ENGINE_RUNTIME_CONTRACTS.md`
- `documentation/PHASER_FIRST_IMPLEMENTATION_PLAN.md`
- `documentation/PHASER_ADAPTER_API.md`

## Local Run

1. Start server: `node server.js`
2. Open `http://localhost:8080`
3. Use:
   - `/index.html` for default Phaser runtime
   - `/game.html` for canvas runtime fallback
   - `/debug.html` for procedural generation debug runtime
