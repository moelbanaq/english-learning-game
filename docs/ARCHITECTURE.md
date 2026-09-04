# Architecture

## The constraint that shaped everything

Zero budget, a real public product, and room to grow to C2. That rules out a runtime
backend, a database, paid auth, and any AI call during play. What remains is a static
site — and a static site, done properly, is genuinely enough for this product.

## Stack

| Decision | Choice | Why |
| --- | --- | --- |
| Framework | **None** — vanilla ES modules | No build step, no npm supply chain, no version rot. The first paint is ~35 KB of CSS+JS instead of a 150 KB framework bundle, which matters on mobile data. |
| Language | JavaScript with JSDoc | Types where they help, without a compiler between the source and the browser. |
| Routing | Hash router (`#/learn`) | Works on any static host with no rewrite rules or 404 fallback. |
| Styling | Hand-written CSS with custom properties | Themeable (light/dark), RTL-aware via logical properties, no utility-class build. |
| Content | Static JSON, lazily fetched per unit | A learner downloads only the unit they open. Adding content never touches code. |
| Storage | `localStorage` behind an adapter interface | Works offline, needs no account, costs nothing. |
| Hosting | GitHub Pages via Actions | Free, HTTPS, custom domains, and the repo *is* the deploy artifact. |
| Tests | `node --test` + a Playwright script | No test framework dependency in the repo. |

**Total runtime dependencies: zero.** Playwright is used only by the browser test and is
never installed for the app itself.

## Layers

```
content/*.json          ← curriculum, teaching text, question banks
      ↓  data/content.js (lazy loader + hydration)
      ↓  data/sessions.js (what goes into a session)
engine/*                ← pure logic: grading, mastery, SRS, selection, XP
      ↓  engine/record.js (the only writer of learner progress)
core/store.js           ← versioned state + persistence + migrations
      ↓
ui/                     ← views render state; they never compute learning logic
```

Nothing in `ui/` decides what the learner should see next, and nothing in `engine/`
touches the DOM. That split is what keeps the app testable without a browser.

## The learning engine

### Mastery (`engine/mastery.js`)
Each concept carries a **strength** score (0–100).

- Correct: `strength += (100 - strength) × gain`, where `gain` grows with question
  difficulty — answering a hard question proves more than answering an easy one.
- Wrong: `strength = strength × 0.55 − 6`, the streak resets, and the repetition
  count steps back. Mistakes cost more than correct answers earn, by design.

State is derived from strength **plus** repetitions **plus** a recent streak:

| State | Condition |
| --- | --- |
| New | never seen |
| Learning | strength < 38 |
| Familiar | strength ≥ 38 |
| Strong | strength ≥ 62 |
| Mastered | strength ≥ 85 **and** ≥ 4 repetitions **and** ≥ 3 in a row |

One lucky answer can never produce "Mastered".

### Spaced repetition
A deliberately simple SM-2 relative: successful repetitions walk up the interval ladder
`1 → 2 → 4 → 9 → 21 → 45 → 90` days, scaled by an ease factor that drifts with
performance. A wrong answer sets the interval to zero, so the concept is eligible again
in the same session. Simple, predictable, and good enough — an academically perfect SRS
would add complexity the learner would never feel.

### Adaptive selection (`engine/select.js`)
Every candidate question is scored:

```
score = conceptNeed × 3.0        // weak or overdue concepts
      + freshness   × 2.0        // not seen recently, not already reliable
      + difficultyFit × 1.2      // matched to current strength
      + mistakeBonus  (2.6+)     // an open mistake outranks almost everything
      − recentPenalty (3.5)      // seen in the last 20 minutes
```

The top-scoring questions are then spread across concepts (no more than ~⅓ of a session
on one idea) and ordered easy → hard so a session starts winnable.

Mini tests use a different picker: even coverage of every concept in the unit, shuffled,
because a test measures rather than teaches.

### Mistakes
A wrong answer creates a mistake record holding the question, concept, unit and how many
times it has been missed. It is retired only after **two** consecutive correct answers —
one is indistinguishable from a lucky guess.

## State model

`core/store.js` owns a single versioned object: settings, profile, streak, daily
counters, per-unit progress, per-concept mastery, per-question history, mistakes, session
history and achievements. Every write goes through `update()`, which persists (debounced)
and notifies subscribers.

`SCHEMA_VERSION` plus a `migrations` map means an old saved profile keeps working after a
release. Unknown-but-new keys are backfilled from defaults on load.

## The path to accounts, without a rewrite

Persistence is already behind an interface:

```js
interface StorageAdapter { get(key); set(key, value); remove(key); keys(); }
```

`LocalStorageAdapter` is today's implementation (`MemoryAdapter` takes over when a
browser blocks storage, so private mode still works). Adding accounts later means:

1. Implement `RemoteAdapter` against whatever free tier is chosen then.
2. Merge on login using `exportState()` / `importState()`, which already exist and are
   already exposed in Settings as backup/restore.
3. Nothing in `engine/` or `ui/` changes.

The same applies to leaderboards and analytics: they read the state that already exists.

## Accessibility & performance notes

- Semantic HTML, real `<button>`s, visible focus rings, `aria-live` on feedback,
  keyboard answering (1–9 to select, Enter to check/continue).
- Touch targets ≥ 44 px; bottom navigation on phones, top navigation on desktop.
- Light/dark themes follow the system by default and are overridable.
- Views are loaded with dynamic `import()`, so opening the app costs one small chunk.
- Unit content is fetched on demand and cached in memory for the session.
