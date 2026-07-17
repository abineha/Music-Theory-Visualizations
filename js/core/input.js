const keysPressed = new Set();
const TRACKED_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

window.addEventListener('keydown', (e) => {
  if (TRACKED_KEYS.has(e.key)) {
    e.preventDefault(); // stop arrow keys from scrolling/nudging focused HUD elements
  }
  keysPressed.add(e.key);
});

window.addEventListener('keyup', (e) => {
  keysPressed.delete(e.key);
});

export function isKeyDown(key) {
  return keysPressed.has(key);
}
