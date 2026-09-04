# Masar English — مسار الإنجليزية

A free, public English-learning game for Arabic speakers, from **CEFR A1 to C2**.
It teaches, drills, corrects and reviews — with every explanation available in both
English and Arabic.

**No account. No tracking. No server. No cost.**
It is a static website: HTML, CSS and ES modules, with the whole curriculum in JSON.

---

## Try it locally

```bash
git clone https://github.com/moelbanaq/english-learning-game.git
cd english-learning-game
npm start          # http://localhost:8080  (Node 20+, no dependencies to install)
```

Any static file server works — `python3 -m http.server` is fine too. The app must be
served over HTTP (not opened as `file://`) because it loads content with `fetch`.

## What it does

| Area | What the learner gets |
| --- | --- |
| **Learn** | Short bilingual explanations, examples, rules, and the specific traps Arabic speakers fall into |
| **Practice** | 10-question sessions with immediate, explanatory feedback |
| **Mini test** | Per-unit assessment; 75% unlocks the unit as complete |
| **Review** | Every mistake is saved, explained and re-tested until it is fixed |
| **Mastery** | Concepts move New → Learning → Familiar → Strong → Mastered based on real performance |
| **Adaptive practice** | Weak and overdue concepts appear more often; solid ones fade out |
| **Game layer** | XP, ranks, streaks, a daily mission and achievements — tied to learning, not to noise |
| **Placement** | 24 real questions estimate the right starting level |
| **Bilingual UI** | Full English and Arabic interface, with proper LTR/RTL handling |

Progress lives in `localStorage`, so a learner can close the tab and come back later.
It can be exported and re-imported as a JSON backup from **Settings**.

## Repository layout

```
index.html                 the whole app shell
assets/css/                design tokens, components, view styles
src/
  core/       dom, router, store (progress), storage adapter, i18n
  engine/     grading, mastery + spaced repetition, adaptive selection, XP, recording
  data/       content loader, session builders
  ui/         app shell, question renderer, views
content/
  curriculum.json          the CEFR spine: levels → units → files
  levels/<level>/*.json    teaching content + question banks
  placement.json           the placement test
  schema/                  JSON Schema for units and questions
docs/                      architecture, content authoring, roadmap, deployment
tests/                     content validator, unit tests, browser tests, dev server
```

## Tests

```bash
npm test         # source parses, content is valid, engine unit tests
npm run test:e2e # real browser run-through (needs Playwright installed)
```

`npm test` is the gate that matters when adding content: it checks every question for a
valid answer, unique ids, non-ambiguous options, matching order-tokens, an English
explanation, and full concept coverage.

Two guards stop a learner scoring without reading: options are shuffled when displayed, so
the first option is never reliably right, and the validator rejects questions whose correct
answer is visibly longer than every distractor. The browser test verifies the shuffle keeps
grading faithful to the content file and that the answer really does move position.

## Adding content

You do not need to touch application code. See **[docs/CONTENT.md](docs/CONTENT.md)** —
add a JSON file, register it in `content/curriculum.json`, run `npm test`.

## Deployment

Push to `main` and GitHub Pages publishes the repository as-is
(`.github/workflows/deploy.yml`). No build step, no secrets.
See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**, including how to link it from an
EasyOrder site and how to attach a custom domain later.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — why it is built this way, and how the learning engine works
- [docs/CONTENT.md](docs/CONTENT.md) — the content model and an authoring guide
- [docs/ROADMAP.md](docs/ROADMAP.md) — what is done and what comes next
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — hosting, custom domains, EasyOrder integration

## Licence

Code: MIT. Learning content: CC BY-SA 4.0 — reuse it, improve it, credit it.
