export function createGameOverOverlay({
  parentElement = null,
  titleText = "GAME OVER",
  subtitleText = "All humans have died.",
  hintText = "Refresh the page to restart.",
} = {}) {
  if (!parentElement) {
    throw new Error("createGameOverOverlay requires parentElement.");
  }

  const root = document.createElement("div");
  root.id = "game-over-overlay";
  root.hidden = true;

  const card = document.createElement("div");
  card.className = "game-over-card";

  const title = document.createElement("h2");
  title.className = "game-over-title";
  title.textContent = titleText;

  const subtitle = document.createElement("p");
  subtitle.className = "game-over-subtitle";
  subtitle.textContent = subtitleText;

  const hint = document.createElement("p");
  hint.className = "game-over-hint";
  hint.textContent = hintText;

  card.appendChild(title);
  card.appendChild(subtitle);
  card.appendChild(hint);
  root.appendChild(card);
  parentElement.appendChild(root);

  let visible = false;

  function setVisible(nextVisible) {
    visible = Boolean(nextVisible);
    root.hidden = !visible;
  }

  function isVisible() {
    return visible;
  }

  function destroy() {
    root.remove();
  }

  return {
    setVisible,
    isVisible,
    destroy,
  };
}
