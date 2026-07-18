# Pitch Bugs

A **3D** insect cricket arcade game for the browser. Time your swing, smash **fours and sixes**, and chase a high score before the fielding beetles take your wicket.

**Boundaries only** — no run chase, no 1s/2s count. Two batting bugs stand at the creases (they don’t run between wickets). Celebrations fire only on 4 or 6.

Built with original art, audio, and code — **Three.js**, TypeScript, and Vite. Static site, no backend.

## Play locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Build (GitHub Pages)

```bash
npm run build
```

Static output is written to `dist/`. The Vite config uses `base: './'` so relative asset paths work on project pages.

Deploy `dist/` with GitHub Pages (branch or Actions). No backend required.

## Controls

| Action | Input |
|--------|--------|
| Swing | Click, tap, Space, or Enter |
| Pause | P or Esc (also on-screen button) |
| Mute | M (also on-screen button) |

## Features

- 3D stadium, pitch, crowd, and cinematic camera
- Stylized insect characters (striker, partner, bowler, fielders)
- Two batting-side players at the creases (no run animation / no run count)
- Score **only** on fours & sixes; celebratory banners + confetti on boundaries
- Bowled & caught dismissals
- Difficulty ramp (pace + tighter windows)
- High score via `localStorage`
- Procedural Web Audio SFX
- Responsive letterboxed WebGL view
- Respects `prefers-reduced-motion` for camera/particles

## Project layout

```
docs/                      Design notes
src/engine/                Game loop, input, WebGL shell
src/scenes/                3D play / match logic
src/world/                 Stadium, bugs, camera, FX
src/audio/                 Procedural sound
src/ui/                    DOM overlays + match HUD
src/config/                Constants
src/utils/                 Math, storage
```

## License

See [LICENSE](./LICENSE).
