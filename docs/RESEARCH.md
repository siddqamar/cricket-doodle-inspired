# Phase 1 — Research: One-Button Cricket Arcade

Design research for **Pitch Bugs** — a tiny browser cricket game where one swing decides everything.

This document captures the target gameplay feel and how each system can be built with original art and code.

---

## 1. Context

| Item | Detail |
|------|--------|
| Genre | Casual one-button sports arcade |
| Fantasy | Insect-themed backyard cricket |
| Session | Open-ended innings — bat until dismissed |
| Input | Single action: swing |

The game is a **one-button endless batting** mini-game: score as many runs as possible before dismissal. There is no bowling control for the player.

---

## 2. Gameplay Loop

```
Title / idle
    → Start innings
        → Bowler run-up + delivery
        → Player swings (or not)
        → Resolve shot: miss / edge / runs / boundary / out
        → Score / celebration / crowd reaction
        → Next delivery (difficulty may increase)
    → On dismissal: Game Over → score + retry
```

**Core fantasy:** Timing-based arcade cricket — one input, deep feel through ball physics and shot outcomes.

**Session length:** Open-ended. No fixed overs; play until out. Typical casual sessions: tens of seconds to several minutes.

---

## 3. Controls

| Platform | Input |
|----------|--------|
| Desktop | Click; Space / Enter |
| Mobile / tablet | Tap anywhere |

**Single action:** Swing the bat. No stick aim, no shot-type buttons, no fielding.

**Implementation:** One unified “swing” event from pointerdown / click / touch / keyboard, with debounce so one press = one swing attempt per delivery.

---

## 4. Batting Mechanics

### Timing model

Swing timing relative to the ball’s arrival at the bat zone maps to outcomes:

| Timing | Typical outcome |
|--------|-----------------|
| Much too early | Miss or weak air shot |
| Slightly early | Flatter drive — often strong ground shots |
| Ideal / on-time | Clean contact — max power |
| Slightly late | Higher loft — more six potential |
| Much too late | Edge, thin contact, or miss |
| No swing / complete miss | Ball continues to stumps → **bowled** |

What matters is a **continuous timing error** (`t_swing − t_ideal`) mapped to loft angle, power, and contact quality — not a binary hit/miss.

### Contact quality model

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
- Ball travels down the pitch with a **bounce** on the pitch.
- Bounce is a key visual timing cue (“watch the bounce, not the release”).
- Delivery variety: pace changes, short length easier to loft, fuller balls tighter windows.
- Early innings: more consistent pace. Higher scores: faster deliveries.

**Implementation:** Parameterize each delivery with `speed`, `bouncePoint`, `bounceHeight`, and light random variance. Increase speed and reduce timing windows as score / deliveries rise.

---

## 6. Scoring Rules

| Result | Runs | Notes |
|--------|------|--------|
| Single | 1 | Soft push / edge in the infield |
| Two | 2 | Through a gap, fielded before boundary |
| Four | 4 | Ball reaches boundary along the ground |
| Six | 6 | Ball clears boundary in the air |
| Bowled | Out | Miss / no contact; ball hits stumps |
| Caught | Out | Hit to a fielder in catching range (especially lofted) |

**No innings length limit.** Final score = total runs when dismissed.  
**High score:** Persist across sessions with `localStorage`.

---

## 7. Difficulty Progression

1. Bowling pace increases as the innings continues.
2. Less predictable length (short, good length, full).
3. Tighter effective timing as ball flight time shortens.
4. Fielders remain a constant spatial threat on lofted shots.

**Example curve:**

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
| Bowler | Run-up → plant → release → follow-through |
| Ball | Flight + bounce + post-hit trajectory; shadow on ground |
| Stumps | Shatter / knock over on bowled |
| Fielders | Idle wobble; arms up for catches |
| Crowd | Subtle bob; cheer burst on boundaries |
| Score | Pop / float “+4”, “SIX!” on big hits |
| Celebrations | Batter pose + particles on 4/6 |

Style target: springy, readable insect silhouettes with elastic timing juice.

---

## 9. Camera Behavior

- Mostly **fixed stage view** of pitch + batter end.
- Subtle **screen shake** on hard hits / wicket.
- Optional light pan toward ball flight on sixes.

**Implementation:** Fixed virtual camera in world space; canvas letterboxes; mild shake offset.

---

## 10. UI Layout

- **Main stage:** Pitch, players, ball
- **Scoreboard:** Current runs, best, ball count
- **Title:** Play, instructions, sound toggle
- **Game over:** Final score, play again
- **Modern extras:** Pause, keyboard hints — without cluttering the stage

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

| Cue | When |
|-----|------|
| Bat hit | Contact |
| Crowd cheer | 4 / 6 / milestones |
| Wicket | Bowled / caught |
| UI click | Buttons |
| Ambience | Soft park / crowd bed (loop, low volume) |

**Implementation:** Generate original short sounds via Web Audio API (oscillators + noise).

---

## 13. Replayability

1. Instant restart after out  
2. High-score chasing  
3. Timing mastery skill curve  
4. Delivery variety  
5. Satisfying boundaries and celebration juice  
6. Very low friction (one button, fast load)

---

## 14. Performance Characteristics

| Metric | Target |
|--------|--------|
| Bundle | Prefer under ~200 KB gzipped JS + tiny assets |
| FPS | 60 (`requestAnimationFrame`) |
| Assets | Procedural canvas drawing; optional tiny SVGs |
| Memory | Cap particles; no unbounded lists |
| Network | Static site only; no backend |

---

## 15. Implementation Mapping

| Feel | Implementation |
|------|----------------|
| One-tap swing | Unified input → `trySwing()` |
| Bounce timing | Ball physics with pitch bounce + ideal contact window |
| 1/2/4/6 scoring | Trajectory vs boundary + fielder catch tests |
| Catch / bowled outs | Stump AABB + fielder catch cones |
| Difficulty ramp | Speed + window shrink + variance by score |
| Crowd juice | Canvas crowd + cheer SFX + float text |
| High score | `localStorage` |
| Tiny payload | Canvas drawing, no engine, Vite tree-shaking |

---

## 16. Project Identity

**Pitch Bugs** — original insect cricket arcade. Cute characters, clear timing skill, and a tiny static build ready for GitHub Pages.
