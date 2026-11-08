// @ts-check
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Simulated milliseconds handed to the engine per step. 16.6ms ~= 60fps, Excalibur's default.
 */
const STEP_MS = 16.6;

/** Matches the BrowserWindow size requested in src/electron-main.js. */
const VIEWPORT = { width: 800, height: 600 };

/**
 * Installed via page.addInitScript so it runs before any renderer script.
 *
 * A running Excalibur game is driven by requestAnimationFrame wall-clock time, so a naive
 * "launch, then screenshot" captures whatever happened to be on screen when Playwright got
 * around to it. This replaces wall-clock time with *simulated* time, making a snapshot a pure
 * function of how many milliseconds of game time have elapsed:
 *
 *  1. Math.random is replaced with a seeded PRNG. Several engine subsystems (particle
 *     emitters, camera shake) fall back to raw Math.random() for variance when no seeded
 *     ex.Random is supplied, which is otherwise genuinely nondeterministic run to run.
 *  2. The engine Clock is frozen the instant the Engine constructor registers itself on
 *     window.___EXCALIBUR_DEVTOOL, and from then on only advances when the test asks.
 *
 * Why hook ___EXCALIBUR_DEVTOOL with a setter rather than polling for it: Engine's constructor
 * assigns window.___EXCALIBUR_DEVTOOL = this as its last statement, and clock.start() only
 * happens later in Engine.start(). Defining a setter freezes the clock synchronously, before a
 * single real frame can tick, so there is no leaked-real-milliseconds drift to tolerate.
 *
 * Why drive the existing Clock instead of swapping in a TestClock: swapping silently drops
 * everything already registered through clock.schedule() on the original clock -- most
 * importantly a Loader's own 200ms "show the play button" delay -- leaving it stuck forever.
 */
const INSTALL_DETERMINISM_HOOKS = `
(function () {
  var seed = 0x2f6e2b1;
  Math.random = function () {
    seed |= 0;
    seed = (seed + 0x9e3779b9) | 0;
    var t = Math.imul(seed ^ (seed >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };

  var engine;
  function freeze(e) {
    if (!e || !e.clock || e.clock.__exFrozen) return;
    if (e.clock.isRunning) {
      e.clock.stop();
    }
    e.clock.__exFrozen = true;
    // Belt and braces: Engine.start() and the "window regained focus" handler both call
    // clock.start(), which would resume the real rAF loop and undo the freeze.
    e.clock.start = function () {};
  }
  Object.defineProperty(window, '___EXCALIBUR_DEVTOOL', {
    configurable: true,
    get: function () { return engine; },
    set: function (e) { engine = e; freeze(e); }
  });

  window.__exStep = async function (steps, stepMs) {
    if (!engine || !engine.clock) return false;
    freeze(engine);
    var YIELD_EVERY = 3;
    for (var i = 0; i < steps; i++) {
      engine.clock.update(stepMs || ${STEP_MS});
      if ((i + 1) % YIELD_EVERY === 0 || i === steps - 1) {
        await new Promise(function (resolve) { requestAnimationFrame(resolve); });
      }
    }
    return true;
  };
})();
`;

/** Advance the frozen clock by a number of simulated frames. False if no engine exists yet. */
async function step(page, steps) {
  return await page.evaluate((s) => window.__exStep(s), steps);
}

/** Advance the frozen clock by `ms` of simulated game time (rounded up to whole frames). */
async function advanceGameTime(page, ms) {
  const advanced = await step(page, Math.ceil(ms / STEP_MS));
  expect(advanced, 'no Excalibur engine found on window.___EXCALIBUR_DEVTOOL').toBe(true);
}

/**
 * Read the live scene back out of the running game. Pixel comparison is a backstop for "the
 * scene renders at all"; this is what actually asserts the game logic.
 */
async function readScene(page) {
  return await page.evaluate(() => {
    const game = window.___EXCALIBUR_DEVTOOL;
    // No constructor.name here: the parcel production bundle is minified, so ex.Label comes
    // back as something like 'ar'. Identify actors by their observable state instead.
    const actors = game.currentScene.actors.map((a) => ({
      name: a.name,
      text: a.text ?? null,
      x: Math.round(a.pos.x),
      y: Math.round(a.pos.y)
    }));
    return { started: game.clock.__exFrozen === true, screen: { w: game.screen.width, h: game.screen.height }, actors };
  });
}

/**
 * Launch the app exactly the way `electron .` would: the main process
 * (src/electron-main.js) loads the parcel bundle out of dist/index.html. Run
 * `npm run build-game` first.
 */
async function launchGame() {
  const app = await electron.launch({ args: ['.'] });

  const isPackaged = await app.evaluate(async ({ app }) => app.isPackaged);
  expect(isPackaged, 'the suite exercises the unpackaged app from the repo root').toBe(false);

  const page = await app.firstWindow();

  // Pin the render surface. BrowserWindow asks for 800x600, but whether it *gets* that is up
  // to the window manager -- a tiling compositor hands the app whatever size it likes, and the
  // screenshot (and, through DisplayMode.FitScreenAndFill, the layout inside it) follows along.
  // setViewportSize overrides the renderer's metrics directly, so the captured frame is the
  // same size on a developer desktop as it is under CI's xvfb.
  await page.setViewportSize(VIEWPORT);

  // firstWindow() only resolves after the main process has already called loadFile(), which is
  // too late for addInitScript to beat the game's own scripts -- so install the hooks and
  // reload once. The reload re-runs the same file:// document with the hooks in place.
  await page.addInitScript(INSTALL_DETERMINISM_HOOKS);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect
    .poll(() => page.evaluate(() => ({ width: innerWidth, height: innerHeight })), {
      message: 'renderer should report the pinned viewport'
    })
    .toEqual(VIEWPORT);

  // Excalibur appends its canvas to <body> during Engine construction.
  await page.locator('canvas').first().waitFor({ state: 'visible' });

  // The clock is frozen by the setter above the moment the Engine exists; poll until the
  // engine is actually there so nothing downstream races the bundle finishing evaluation.
  await expect
    .poll(() => step(page, 1), { message: 'excalibur engine should boot and expose its clock' })
    .toBe(true);

  await dismissLoader(page);

  return { app, page };
}

/**
 * Games booted with a Loader draw a loading bar on the canvas and show a real DOM "Play game"
 * button that must be clicked before the game starts. This template calls game.start() with no
 * loader, so the button never exists -- the helper stays so the check keeps working if you add
 * one.
 *
 * It reads the button's *inline* style.display (Loader.showPlayButton() sets it to 'flex',
 * hidePlayButton() back to 'none') rather than its computed style: the loader's stylesheet
 * ships two competing `button#excalibur-play` rules and the later one is display:flex, so the
 * computed value reads 'flex' from the very first frame and is useless as a readiness signal.
 * (`#excalibur-play-root[aria-busy]` would be tidier but is not in published Excalibur builds.)
 */
async function dismissLoader(page) {
  const playButton = page.locator('#excalibur-play');
  for (let i = 0; i < 300; i++) {
    if ((await playButton.count()) === 0) {
      break; // no Loader in this game
    }
    if ((await playButton.evaluate((el) => el.style.display)) === 'flex') {
      await playButton.click();
      break;
    }
    await step(page, 2);
  }
  // Passes for a button that is hidden *or* never existed. Guarantees the boot screen
  // (Excalibur logo / loading bar / play button) is never what gets captured.
  await expect(playButton, 'loader play button should be dismissed before capturing').toBeHidden();
}

/**
 * Capture and compare a single frame.
 *
 * page.screenshot() + toMatchSnapshot rather than toHaveScreenshot: the latter retries until
 * two consecutive frames are identical, which by design never converges on a scene that is
 * animating -- and animating scenes are exactly what a snapshot suite exists to guard. With
 * the clock frozen there is nothing to wait for.
 *
 * On the tolerance: a ratio budget has to be calibrated against the size of the smallest real
 * signal, not picked by feel. The usual 0.01 is far too loose here -- 1% of this 800x600
 * viewport is 4,800 pixels, and the whole "Hello Electron!" label is worth less than that.
 * Measured on this template (run the frame through toMatchSnapshot at ratio 0 to reproduce):
 *
 *   deleting the label       4,454 px  (ratio 0.0093)  <- smallest real signal
 *   nudging it 10px right    4,970 px  (ratio 0.0104)
 *   0.32 -> v1 font change      26 px  (ratio 0.000054)
 *   run-to-run                   0 px  (byte-identical baselines)
 *
 * So 0.01 would stay green with the label deleted outright. 0.002 (960 px) sits ~4.6x under
 * the smallest real signal and ~37x over the largest observed noise.
 */
const MAX_DIFF_PIXEL_RATIO = 0.002;

async function expectFrameToMatch(page, name) {
  const screenshot = await page.screenshot();
  expect(screenshot).toMatchSnapshot(name, { maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO });
}

test('renders the opening frame in the electron shell', async () => {
  const { app, page } = await launchGame();
  try {
    await advanceGameTime(page, 10 * STEP_MS);

    const scene = await readScene(page);
    expect(scene.screen, 'engine should size itself to the pinned viewport').toEqual({
      w: VIEWPORT.width,
      h: VIEWPORT.height
    });
    expect(scene.actors, 'the demo scene should contain the Hello Electron label').toEqual([
      { name: 'HelloLabel', text: 'Hello Electron! \u{1F496}\u{1F389}', x: 400, y: 300 }
    ]);

    await expectFrameToMatch(page, 'expected-start.png');
  } finally {
    await app.close();
  }
});

test('stays stable after 2s of simulated time', async () => {
  const { app, page } = await launchGame();
  try {
    // 2s of *game* time with the clock frozen: no wall-clock wait, and no dependence on how
    // fast this machine renders.
    //
    // The stock template's scene is a single static Label, so this frame is expected to be
    // identical to the opening one -- there is no moving actor here to regress (unlike the
    // browser templates, whose demo Player patrols after an actions.delay(2000)). The case
    // exists so that anything you animate in src/index.ts -- actor actions, tweens, sprite
    // animations -- is captured at a deterministic point in simulated time rather than
    // wherever the screenshot happened to land, and so that a scene which silently stops
    // rendering after a couple of seconds is caught.
    await advanceGameTime(page, 2000);

    const scene = await readScene(page);
    expect(scene.actors, 'the label should still be in the scene after 2s').toEqual([
      { name: 'HelloLabel', text: 'Hello Electron! \u{1F496}\u{1F389}', x: 400, y: 300 }
    ]);

    await expectFrameToMatch(page, 'expected-settled.png');
  } finally {
    await app.close();
  }
});
