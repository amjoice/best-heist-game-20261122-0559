// Input: keyboard and mouse state for the game. Keys are tracked by code;
// presses are edge-triggered (true once, then consumed by the frame that
// reads them). A mouse click on the floor sets a move target the thief
// walks toward; clicks on menu buttons are reported separately so main.js
// can hit-test them.
export function makeInput() {
  return {
    keys: new Set(),
    pressed: new Set(),
    mouseX: 0,
    mouseY: 0,
    clicked: null, // { x, y } in canvas pixels, consumed by main.js
    moveTarget: null, // { x, y } in world pixels, or null
  };
}

export function attachInput(input, canvas) {
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(event.code);
    input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
    input.mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    input.clicked = { x, y };
  });
}

/** Movement vector from the keys, or toward the click target if no key. */
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) y -= 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) y += 1;
  if (x !== 0 || y !== 0) {
    input.moveTarget = null;
    return { x, y, sneak: input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') };
  }
  return { x: 0, y: 0, sneak: input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') };
}

/** Take one edge-triggered press; true only on the first read after it. */
export function takePressed(input, code) {
  if (input.pressed.has(code)) {
    input.pressed.delete(code);
    return true;
  }
  return false;
}

/** Clear all pending presses (called once per animation frame). */
export function clearPressed(input) {
  input.pressed.clear();
}
