// Bootstrap: canvas, input, the animation loop, and the screenshot mode.
//   - Normal play: requestAnimationFrame with a fixed-step accumulator, so
//     the world advances in 1/60 s slices whatever the display does.
//   - Screenshot mode: ?shot=<name>&seed=<n> stages a deterministic scene
//     from shots.js and draws it once, so a headless browser captures the
//     same frame every time.
import { STEP, VIEW_H, VIEW_W } from './config.js';
import { makeGame, pressButton, pressKey, screenButtons, stepGame } from './game.js';
import { drawGame } from './render.js';
import { attachInput, clearPressed, makeInput, moveVector, takePressed } from './input.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? 1) || 1;

const input = makeInput();
attachInput(input, canvas);

let game = makeGame(0, seed);

if (shotName) {
  // Screenshot mode: stage the scene synchronously and draw it once.
  const staged = stageShot(shotName, game);
  game.screen = staged.screen;
  const draw = () => drawGame(ctx, game);
  draw();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  window.__game = game;
} else {
  game.screen = 'title';
  window.__game = game;

  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    // Schedule the next frame first: a throw in this frame's work must
    // never stop the loop.
    requestAnimationFrame(frame);
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    accumulator += elapsed;

    // Screen shortcuts (job select, retry, resume) from key presses.
    // Only off the play screen: on it, Digit1/Digit2 are the tools and
    // Escape pauses, and those presses belong to the input snapshot below.
    if (game.screen !== 'play') {
      for (const code of ['Digit1', 'Digit2', 'Digit3', 'KeyR', 'Enter', 'Escape']) {
        if (takePressed(input, code)) {
          const next = pressKey(game, code);
          if (next !== game) game = next;
          window.__game = game;
        }
      }
    }

    // Mouse: a click on a button acts on it; a click on the floor sets a
    // move target the thief walks toward.
    if (input.clicked) {
      const click = input.clicked;
      input.clicked = null;
      let hit = null;
      for (const button of screenButtons(game)) {
        if (click.x >= button.x && click.x <= button.x + button.w && click.y >= button.y && click.y <= button.y + button.h) {
          hit = button.id;
          break;
        }
      }
      if (hit) {
        const next = pressButton(game, hit);
        if (next !== game) game = next;
        window.__game = game;
      } else if (game.screen === 'play') {
        input.moveTarget = { x: click.x, y: click.y };
      }
    }

    // One input snapshot per frame, consumed by every fixed step in it.
    const vec = moveVector(input);
    let moveX = vec.x;
    let moveY = vec.y;
    if (moveX === 0 && moveY === 0 && input.moveTarget && game.screen === 'play') {
      const dx = input.moveTarget.x - game.player.x;
      const dy = input.moveTarget.y - game.player.y;
      if (Math.hypot(dx, dy) < 10) {
        input.moveTarget = null;
      } else {
        const len = Math.hypot(dx, dy);
        moveX = dx / len;
        moveY = dy / len;
      }
    }
    const snapshot = {
      moveX,
      moveY,
      sneak: vec.sneak,
      interact: input.keys.has('Space'),
      smoke: takePressed(input, 'Digit1'),
      jammer: takePressed(input, 'Digit2'),
      pause: takePressed(input, 'KeyP') || takePressed(input, 'Escape'),
    };

    while (accumulator >= STEP) {
      stepGame(game, snapshot);
      snapshot.smoke = false;
      snapshot.jammer = false;
      snapshot.pause = false;
      accumulator -= STEP;
    }
    clearPressed(input);

    drawGame(ctx, game);
  }
  requestAnimationFrame(frame);
}
