# Contributing

## Setup

```bash
git clone https://github.com/moelbanaq/english-learning-game.git
cd english-learning-game
npm start     # http://localhost:8080 — no install step, there are no dependencies
```

## Before every commit

```bash
npm test              # source parses, content validates, engine tests pass
npm run test:e2e      # optional: real browser run (needs Playwright available)
```

## Ground rules

1. **No runtime dependencies.** If a feature needs a library at runtime, it needs a
   discussion first.
2. **Content is data.** New questions and lessons never require code changes —
   see [CONTENT.md](CONTENT.md).
3. **Learning logic stays in `src/engine/`** and stays pure, so it can be unit-tested
   without a browser. Views render; they do not decide.
4. **Progress writes go through `src/engine/record.js`** and `store.update()`. Nothing
   else mutates learner state.
5. **Both languages.** Any learner-facing string needs an entry in both tables of
   `src/core/i18n.js`; any explanation should carry `en` and `ar`.
6. **Test on a phone-sized viewport.** The browser test asserts no horizontal overflow at
   390 px in both LTR and RTL — keep it that way.

## Reporting a content error

Open an issue with the question id (shown in the JSON, e.g. `a1u3-05`), what is wrong,
and the correction. Content accuracy issues are treated as bugs, not suggestions.
