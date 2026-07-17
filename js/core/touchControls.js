import { simulateKeyDown, simulateKeyUp } from './input.js';

const buttons = document.querySelectorAll('.dpad-btn');

buttons.forEach((button) => {
  const key = button.dataset.key;

  const press = (e) => {
    e.preventDefault();
    simulateKeyDown(key);
  };
  const release = (e) => {
    e.preventDefault();
    simulateKeyUp(key);
  };

  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointerleave', release);
  button.addEventListener('pointercancel', release);
});
