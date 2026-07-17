# Phase 2 — Technical Design: Pitch Bugs

A static, GitHub Pages–ready recreation of the *gameplay feel* of Google’s 2017 Cricket Doodle, using original art and code.

---

## 1. Goals

- One-button batting arcade game playable in any modern browser  
- Original insect-inspired art and procedural audio  
- 60 FPS on mid-range phones  
- Zero backend; `localStorage` for high score and mute preference  
- Modular TypeScript codebase without a game engine  

---

## 2. Tech Stack

| Choice | Why |
|--------|-----|
| **HTML5 + TypeScript + Vite** | Fast DX, type safety, simple static build |
| **Canvas 2D API** | Full control over sprites/FX; no React overhead; ideal for 60 FPS games |
| **No game engine** | Project is small; engines add bundle size and abstraction for little gain |
| **Web Audio API** | Procedural SFX without shipping large audio files |
| **CSS for shell only** | Full-screen canvas host, safe-area, reduced-motion media query |

---

## 3. Rendering Approach

**Single full-window canvas**, logical resolution fixed (e.g. **960×540** design space), scaled with **contain** letterboxing to fit any viewport.

```
devicePixelRatio aware:
  canvas.width  = logicalW * dpr
  canvas.height = logicalH * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  CSS size = fitted letterbox size
```

**Why:** Predictable gameplay coordinates; crisp on retina; works in portrait and landscape.

**Draw order (back → front):** sky → crowd → field → pitch → stumps → fielders → bowler → ball shadow → ball → batter → bat → VFX → HUD → overlays.

Art is **procedural canvas drawing** (paths, arcs, simple shapes) so we ship almost zero binary assets and stay fully original.

---

## 4. Animation System

Lightweight custom system:

```ts
// keyframe or parametric
type Anim = {
  t: number;        // elapsed
  duration: number;
  loop: boolean;
  update(t: number): void;
};
```

- **Batter swing:** ease-out rotation of bat from cocked → contact → follow-through  
- **Bowler:** phase machine (idle → run → plant → release → recover)  
- **Ball:** physics-driven position (not keyframed)  
- **Crowd:** sin-based bob + intensity on cheer  
- **Score floats:** position + alpha fade  
- **Particles:** pooled list, max N  

**Reduced motion:** if `prefers-reduced-motion: reduce`, shorten non-essential FX (shake, particles, crowd bob amplitude).

**Why custom:** Zero dependency, trivial to reason about, fits rAF loop.

---

## 5. Physics

**Arcade physics**, not realistic cricket simulation.

### Pre-hit ball flight

- Parametric path along pitch with optional **bounce** at configurable `bounceX`  
- Velocity derived from delivery speed  
- Height: parabola segments pre/post bounce  

### Post-hit ball

```
launchAngle, speed = f(timingError, contactQuality)
vx, vy = polar(speed, angle)
each frame:
  vy += gravity * dt
  x += vx * dt; y += vy * dt
  if y >= ground: bounce with restitution OR roll
```

### Scoring from trajectory

- If ball crosses boundary line in air with height > threshold → **6**  
- If ball reaches boundary while grounded → **4**  
- If ball stops / is “fielded” inside → **1** or **2** by distance  
- If path intersects fielder catch zone while lofted → **caught**  
- If no contact and ball reaches stump box → **bowled**  

**Why arcade:** Satisfying arcs and readable outcomes in 1–2 seconds per ball.

---

## 6. Game Loop

```
rAF(now):
  dt = clamp((now - last) / 1000, 0, 0.05)
  input.flush()
  state.update(dt)
  render(ctx)
```

- Fixed **logical** updates with clamped dt (avoid spiral of death on tab switch)  
- Single scene active at a time (`TitleScene`, `GameScene`, `GameOverScene` or one scene with mode enum)  
- Pause freezes update but may still render dimmed frame  

**Why rAF:** Browser-aligned vsync; battery-friendly when tab hidden (browser throttles).

---

## 7. Collision Detection

| Pair | Method |
|------|--------|
| Bat–ball contact | Time window + distance of ball to sweet spot during swing active frames (not pixel-perfect polygon) |
| Ball–stumps | AABB |
| Ball–fielder catch | Circle vs circle; only if ball height in catchable range and vy appropriate |
| Ball–boundary | x/y vs ellipse or radius from pitch center / side boundary line |

**Why:** Timing window is the skill test; continuous geometry collision is secondary polish.

---

## 8. Input Handling

```ts
class Input {
  swingPressed: boolean; // edge-triggered per frame
  // sources: pointerdown, keydown Space/Enter, touchstart
}
```

- Edge-trigger so hold doesn’t multi-swing  
- Ignore swing during non-playable phases (or queue one for late arrivals carefully)  
- UI buttons: separate hit-test on canvas or HTML overlay buttons  

**Recommendation:** HTML overlay for title/pause menus (accessibility + easy hit targets); canvas for gameplay.

---

## 9. Asset Organization

```
src/assets/      # procedural drawers + optional SVG strings
src/audio/       # AudioEngine + synth helpers
public/          # favicon only if needed
```

No large sprite sheets required. Characters drawn as functions:

```ts
drawBatter(ctx, x, y, pose)
drawBowler(ctx, x, y, phase)
drawBall(ctx, x, y, scale)
```

**Why:** Original IP, tiny payload, easy palette tweaks.

---

## 10. Responsive Layout

1. Measure `window.innerWidth/Height` (visual viewport when available)  
2. Compute scale = `min(w/960, h/540)`  
3. Center canvas with CSS  
4. On portrait phones: same letterbox (pillar/letter bars with themed background color)  
5. Touch targets for HUD ≥ 44px CSS pixels  

Optional: slightly raise batter on very short heights by adjusting world Y — not required if letterboxing is clean.

---

## 11. State Management

```ts
type AppState =
  | { mode: 'title' }
  | { mode: 'playing'; game: MatchState }
  | { mode: 'paused'; game: MatchState }
  | { mode: 'gameover'; score: number; high: number };

type MatchState = {
  score: number;
  deliveries: number;
  phase: DeliveryPhase;
  ball: Ball;
  batter: Batter;
  bowler: Bowler;
  fielders: Fielder[];
  // ...
};
```

- Immutable-ish updates inside scene classes for clarity  
- Persist: `{ highScore, muted }` via `localStorage` keys under `pitchbugs.*`  

**Why:** Explicit phases prevent timing bugs (e.g. swinging during celebration).

---

## 12. Module Structure

```
src/
  main.ts                 # bootstrap
  style.css
  config/constants.ts     # sizes, colors, difficulty
  engine/
    game.ts               # loop, scene manager
    input.ts
    camera.ts             # shake, scale helpers
    time.ts
  entities/
    ball.ts
    batter.ts
    bowler.ts
    fielder.ts
    crowd.ts
    stumps.ts
  scenes/
    title.ts
    play.ts
    gameover.ts
  assets/
    draw.ts               # all procedural art
  ui/
    hud.ts
    overlay.ts            # DOM overlay helpers
  audio/
    audio.ts
  utils/
    math.ts
    storage.ts
    random.ts
```

---

## 13. Difficulty Design

| Parameter | Start | Late game |
|-----------|-------|-----------|
| Ball speed | moderate | +~80% |
| Timing perfect window | ~80ms | ~45ms |
| Edge window | wider | tighter |
| Bounce variance | low | higher |
| Fielder catch radius | base | slight increase |

Ramp by `score` and `deliveries` with soft caps so the game stays fair.

---

## 14. Audio Plan

Procedural:

- **Hit:** short noise burst + low square thump  
- **Cheer:** filtered noise swell + random blips  
- **Wicket:** descending tones + wood knock  
- **Click:** soft UI blip  
- **Ambience:** very quiet looping noise bed + occasional distant murmur  

Master gain + mute flag; resume AudioContext on first user gesture.

---

## 15. Accessibility

- `prefers-reduced-motion` reduces shake/particles  
- Keyboard: Space/Enter swing; P pause; M mute; Esc pause/back  
- High contrast scoreboard colors  
- Focusable HTML buttons on title/game over  
- Don’t rely on color alone for out vs score (text labels)  

---

## 16. Build & Deploy

```bash
npm install
npm run dev      # local
npm run build    # dist/
```

**GitHub Pages:**  
- `vite.config.ts` → `base: './'` (relative paths)  
- Deploy `dist/` to `gh-pages` or Actions  

No SSR, no API routes.

---

## 17. Implementation Order

1. Scaffold Vite + TS + canvas shell  
2. Game loop + input + scenes  
3. Ball flight + swing timing + scoring  
4. Characters + field art  
5. Fielders / outs / difficulty  
6. Audio + HUD + storage  
7. Polish: FX, pause, responsive, reduced motion  
8. README + build verify  

---

## 18. Success Criteria

- [ ] Playable innings with 1/2/4/6 and outs  
- [ ] Timing clearly matters  
- [ ] Difficulty increases  
- [ ] Title, pause, restart, high score, mute  
- [ ] Mouse, keyboard, touch  
- [ ] 60 FPS feel on desktop  
- [ ] Static `dist/` works offline after load  
- [ ] No third-party Google assets  
