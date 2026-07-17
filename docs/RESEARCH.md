# Phase 1 — Research: Google Cricket Doodle (2017)

**Source notes:** Public descriptions from Google Doodles blog, player discussions (forums/Reddit), and third-party how-to guides.  
**Constraint:** This document describes *observed gameplay* only. No original Google assets, sprites, sounds, or source code were copied or reverse-engineered for extraction.

---

## 1. Context

| Item | Detail |
|------|--------|
| Official name / tagline | “CrickHIT for Six” / ICC Champions Trophy 2017 Doodle |
| Launch | ~1 June 2017 (also revived for related cricket events) |
| Theme | Pest cricket: cricket-bug batsmen vs snail bowlers/fielders |
| Design goal | Smallest interactive Doodle at the time — load on slow mobile networks |
| Credits (public) | Eng: Jacob Howcroft; Art: Matt Cruickshank; Sound: Leon Hong; others |

The game is a **one-button endless batting** mini-game: score as many runs as possible before dismissal. There is no bowling control for the player.

---

## 2. Gameplay Loop

```
Title / idle logo
    → Start innings
        → Bowler run-up + delivery
        → Player swings (or not)
        → Resolve shot: miss / edge / runs / boundary / out
        → Score / celebration / crowd reaction
        → Next delivery (difficulty may increase)
    → On dismissal: Game Over → score + retry
```

**Core fantasy:** Timing-based arcade cricket — one input, deep feel through ball physics and shot outcomes.

**Session length:** Open-ended. No fixed overs; play until out. Typical casual sessions: tens of seconds to several minutes. High scores can climb into hundreds (or more with practice).

---

## 3. Controls

| Platform | Input |
|----------|--------|
| Desktop | Click (primary); often Space also expected in browser games |
| Mobile / tablet | Tap anywhere |

**Single action:** Swing the bat. No stick aim, no shot-type buttons, no fielding.

**Implication for recreation:** One unified “swing” event from pointerdown / click / touch / keyboard, with debounce so one press = one swing attempt per delivery.

---

## 4. Batting Mechanics

### Timing model (player-reported)

Swing timing relative to the ball’s arrival at the bat zone maps to outcomes:

| Timing | Typical outcome |
|--------|-----------------|
| Much too early | Miss or weak air shot; risk of mistimed loft |
| Slightly early | High trajectory — often associated with **sixes** in some guides |
| Ideal / on-time | Clean drive — strong ground or aerial power |
| Slightly late | Lower trajectory — often **fours** / powerful ground shots (many 2017 players reported **late** for sixes) |
| Much too late | Edge, thin contact, or miss |
| No swing / complete miss | Ball continues to stumps → **bowled** |

**Note:** Public tips disagree slightly on early vs late for sixes. Mechanically what matters is a **continuous timing error** (`t_swing − t_ideal`) mapped to loft angle, power, and contact quality — not a binary “hit/miss”.

### Contact quality (independent recreation model)

```
timingError = swingTime - idealContactTime

|error| < perfectWindow  → solid contact, max power
|error| < goodWindow     → good contact, reduced power
|error| < edgeWindow     → edge: low power, awkward angle, higher catch risk
else if swing happened   → miss (or air swing if early)
else                     → no swing → ball can hit stumps
```

Power and launch angle drive trajectory; trajectory + fielder positions drive score / catch.

---

## 5. Bowling Timing

- Bowler performs a short run-up / delivery animation.
- Ball travels down the pitch (often with bounce on the pitch).
- **Bounce is a key visual timing cue** for players (“watch the bounce, not the release”).
- Delivery variety (player reports): pace changes, short length easier to loft, slower/spinning balls harder, occasional “grubber” / low bounce surprises.
- Early innings: more consistent, readable pace. Higher scores: faster deliveries, less predictable timing.

**Recreation approach:** Parameterize each delivery with `speed`, `bouncePoint`, `bounceHeight`, `swing/drift`, and a small random seed. Increase speed and reduce timing windows as `deliveriesFaced` or `score` rises.

---

## 6. Scoring Rules

Simplified cricket scoring applied to arcade outcomes:

| Result | Runs | Notes |
|--------|------|--------|
| Dot / no score | 0 | Rare; usually weak contact still yields 1 or is an out |
| Single | 1 | Soft push, ball dies in infield |
| Two | 2 | Through a gap, fielded before boundary |
| Four | 4 | Ball reaches boundary on the bounce / along ground |
| Six | 6 | Ball clears boundary in the air |
| Bowled | Out | Miss / no contact; ball hits stumps |
| Caught | Out | Hit to a fielder in catching range (especially lofted) |

**No innings length limit.** Final score = total runs when dismissed.  
**High score:** Original doodle remembered scores across browser sessions (local persistence).

**Our recreation also includes:** optional “3” if desired for gap hits that travel farther than 2 but don’t boundary — original guides sometimes mention 2–3 for clean gap hits.

---

## 7. Difficulty Progression

Observed / reported:

1. **Bowling pace increases** as the innings continues.
2. **Less predictable length** (short, good length, full).
3. **Tighter effective timing** as ball flight time shortens.
4. Fielders remain a constant spatial threat (catch risk on lofted shots).

**Recreation curve (example):**

```
baseSpeed = 280 + min(score * 0.35, 220) + deliveries * 2
timingWindowScale = max(0.55, 1 - score / 800)
deliveryVariance = min(0.35, score / 500)
```

---

## 8. Animations

| Element | Behavior |
|---------|----------|
| Batter | Idle → swing arc → follow-through → recover |
| Bowler | Run-up → gather → release → follow-through |
| Ball | Flight + bounce + post-hit trajectory; shadow on ground |
| Stumps | Shatter / knock over on bowled |
| Fielders | Idle wobble; dive / leap for catches |
| Crowd | Subtle bob; cheer burst on boundaries |
| Score | Pop / float “+4”, “SIX!” on big hits |
| Celebrations | Batter pose + confetti-ish particles on 4/6 |

Style of original: hand-drawn, springy, slightly squashy insect characters.  
**Our recreation:** original cute insect-inspired characters with similar *feel* (elastic timing, readable silhouettes) — not the same designs.

---

## 9. Camera Behavior

- Mostly **fixed side-ish or slightly angled pitch view** framed like a stage.
- Focus stays on batter end + pitch; ball may leave frame on sixes.
- Subtle **screen shake** on hard hits / wicket.
- Possible light **zoom or pan** toward ball flight (optional polish).

**Recreation:** Fixed virtual camera in world space; canvas letterboxes; mild shake offset; optional brief follow of ball on six.

---

## 10. UI Layout

Typical layout for the doodle:

- **Center / main stage:** Pitch, players, ball
- **Scoreboard:** Current runs (large, readable)
- **High score:** Persistent best
- **Title state:** Play affordance; brand-free playful title
- **Game over:** Final score, play again
- Minimal chrome (homepage doodle constraint)

**Recreation additions (modern web game):** sound toggle, pause, instructions overlay, keyboard hints — without cluttering the stage.

---

## 11. Game States

```
BOOT → TITLE → INSTRUCTIONS (optional)
              → PLAYING
                    → DELIVERY (bowler active)
                    → BALL_IN_FLIGHT (pre-hit)
                    → SWING_RESOLVE
                    → SHOT_RESULT (runs / out animation)
                    → NEXT_BALL or GAME_OVER
              → PAUSED
              → GAME_OVER → TITLE / REPLAY
```

---

## 12. Sound Effects

Publicly, the doodle had custom sound design (Leon Hong). Typical arcade cricket set:

| Cue | When |
|-----|------|
| Bat hit | Contact |
| Crowd cheer | 4 / 6 / milestones |
| Wicket | Bowled / caught |
| UI click | Buttons |
| Ambience | Soft crowd / park bed (loop, low volume) |

**Recreation:** Generate **original** short sounds via Web Audio API (oscillators + noise) or tiny procedural buffers — no samples from Google.

---

## 13. Replayability

Drivers of “one more try”:

1. Instant restart after out  
2. High-score chasing  
3. Timing mastery skill curve  
4. Delivery variety  
5. Satisfying boundaries and celebration juice  
6. Very low friction (one button, fast load)

---

## 14. Performance Characteristics

Original design priorities:

- Extremely small download  
- Instant play on mobile  
- Stable animation on low-end devices  
- No heavy 3D or large texture atlases  

**Targets for this project:**

| Metric | Target |
|--------|--------|
| Bundle | Prefer &lt; 200 KB gzipped JS + tiny assets |
| FPS | 60 (requestAnimationFrame) |
| Assets | Procedural canvas / SVG paths; optional tiny PNGs |
| Memory | No unbounded particle lists; pool or cap effects |
| Network | Static site only; no backend |

---

## 15. Independent Recreation Mapping

| Original feel | Independent implementation |
|---------------|----------------------------|
| Cricket bugs vs snails | Original insect characters (e.g. “glowbug batters”, “shelled bowlers”) with new silhouettes/palettes |
| One-tap swing | Unified input → `trySwing()` |
| Bounce timing | Ball physics with pitch bounce + ideal contact window |
| 1/2/4/6 scoring | Trajectory vs boundary + fielder catch tests |
| Catch / bowled outs | Stump AABB + fielder catch cones |
| Difficulty ramp | Speed + window shrink + variance by score |
| Crowd juice | Canvas crowd sprites + cheer SFX + float text |
| High score | `localStorage` |
| Tiny payload | Canvas drawing, no engine, Vite tree-shaking |

---

## 16. What We Will Not Do

- Do not copy Google sprite sheets, audio, fonts, or code  
- Do not scrape or rehost the official doodle binary  
- Do not use Google’s branding, logo letterforms, or “CrickHIT” trademarking as product identity  

**Project identity (suggested):** *Pitch Bugs* — original insect cricket arcade game inspired by the *mechanics and feel* of the 2017 doodle, not a clone of its art.
