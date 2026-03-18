import { cameraMoveFromKey } from "./cameraController.js";

export function createKeyboardPanInput({
  stepTiles,
  onMove,
  target = document,
} = {}) {
  function handleKeydown(event) {
    const move = cameraMoveFromKey(event.key, stepTiles);
    if (!move) {
      return;
    }
    onMove(move);
  }

  function start() {
    target.addEventListener("keydown", handleKeydown);
  }

  function stop() {
    target.removeEventListener("keydown", handleKeydown);
  }

  return {
    start,
    stop,
  };
}
