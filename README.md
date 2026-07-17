# Pitch Bugs

A cute insect cricket arcade game for the browser. Time your swing, send the ball to the boundary, and chase a high score before the fielding beetles take your wicket.

Built with original art, audio, and code — HTML5 Canvas, TypeScript, and Vite. Static site, no backend.

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

- Title screen, instructions, pause, restart
- Timing-based shots: miss, edge, 1, 2, 4, 6
- Bowled & caught dismissals
- Difficulty ramp (pace + tighter windows)
- High score via `localStorage`
- Procedural canvas art & Web Audio SFX
- Responsive letterboxed canvas (desktop / tablet / mobile)
- Respects `prefers-reduced-motion` for shake/particles

## Project layout

```
docs/RESEARCH.md           Phase 1 design research notes
docs/TECHNICAL_DESIGN.md   Phase 2 technical design
src/engine/                Game loop, input, camera
src/entities/              VFX helpers
src/scenes/                Play scene / match logic
src/assets/                Procedural drawing
src/audio/                 Procedural sound
src/ui/                    DOM overlays
src/config/                Constants
src/utils/                 Math, storage
```

## License

See `LICENSE` in this repository.
