# Content authoring guide

Content is data, not code. Adding a unit means writing one JSON file and adding one entry
to `content/curriculum.json`. Run `npm test` and the validator will tell you if anything
is wrong before a learner ever sees it.

## 1. The curriculum spine

`content/curriculum.json` lists levels → units:

```json
{
  "id": "a1-u9",
  "file": "levels/a1/u9-my-topic.json",
  "title": { "en": "My topic", "ar": "موضوعي" },
  "questions": 16,
  "concepts": ["a1.mytopic.one", "a1.mytopic.two"]
}
```

`concepts` must list exactly the concept ids defined in the unit file — the review engine
uses it to find which unit owns a concept without downloading every file.

Add `"status": "planned"` to show a unit in the path as *coming soon* without a file.

## 2. A unit file

```json
{
  "id": "a1-u9",
  "goal": { "en": "What the learner will be able to do.", "ar": "..." },
  "passages": { "note": { "title": "A short text", "text": "…" } },
  "concepts": [ { "id": "...", "title": {...}, "teach": [ ... ] } ],
  "questions": [ ... ]
}
```

### Teaching blocks

| Block | Shape | Use it for |
| --- | --- | --- |
| `p` | `{ "type": "p", "text": { "en": "...", "ar": "..." } }` | Plain explanation |
| `rule` | same as `p` | The one sentence to remember (highlighted) |
| `tip` | same as `p` | A practical shortcut |
| `warn` | same as `p` | **The Arabic-speaker trap.** Use this often — it is the most valuable block in the app |
| `examples` | `{ "type": "examples", "items": [{ "en": "...", "ar": "...", "note": "..." }] }` | Model sentences |
| `table` | `{ "type": "table", "head": [...], "rows": [[...], ...] }` | Conjugations, comparisons |

Keep a concept to roughly 4–6 blocks. If it needs more, it is two concepts.

## 3. Questions

Four interaction types cover every exercise in the app:

| `type` | Learner does | Required fields |
| --- | --- | --- |
| `choice` | Picks one option | `options`, `answer` (index) |
| `text` | Types an answer | `answer` (string), optional `accept[]` |
| `order` | Taps words into order | `tokens[]`, `answer` (the full sentence) |
| `match` | Matches pairs | `pairs: [[left, right], ...]` |

`format` sets the chip shown above the question and should describe the *learning*
purpose: `fill_blank`, `choose_sentence`, `error_id`, `meaning`, `synonym`,
`collocation`, `phrasal`, `natural`, `register`, `transform`, `order`, `match`,
`comprehension`, `write`, `inference`.

```json
{
  "id": "a1u9-03",
  "concept": "a1.mytopic.one",
  "type": "choice",
  "format": "fill_blank",
  "difficulty": 2,
  "sentence": "She ___ a doctor.",
  "options": ["is", "am", "are", "be"],
  "answer": 0,
  "explanation": { "en": "he/she/it take “is”.", "ar": "الضمائر المفردة تأخذ is." },
  "commonMistake": { "en": "...", "ar": "..." }
}
```

Rules the validator enforces:

- Ids are globally unique.
- `difficulty` is 1–5.
- Every question has an English `explanation` (Arabic is a warning, not an error — but write it).
- `choice` options are distinct **after normalisation**, so two options cannot differ by
  punctuation alone.
- `order` tokens must be exactly the words of the answer (no stray `?` — punctuation is
  ignored when grading).
- `match` pairs must have unique left **and** right items, otherwise matching is ambiguous.
- Every declared concept needs at least 2 questions; every unit needs at least 8.
- **Options are shuffled when displayed**, so where you put the correct answer does not
  matter — but no option may refer to a position (`all of the above`, `both A and B`).
  The validator rejects those.
- **Length must not give the answer away.** The validator rejects a question whose correct
  option is 6+ characters longer than every distractor *and* 20% longer, and warns when a
  unit's answer is visibly the longest more than 45% of the time. The fix is almost always
  to make the distractors fuller, not to trim the answer — a curt distractor is easy to
  eliminate for the wrong reason.
- A sentence may contain more than one `___`. Write the answer as `is / am`, matching the
  gaps in order; both gaps are filled in when the learner checks.

### Reading questions

Put the text in the unit's `passages` map and reference it with `passageId`. Each question
is still answered one at a time, with the passage shown above it.

## 4. Writing quality bar

- **One learning point per question.** If a learner gets it wrong, it must be obvious what
  they need to study.
- **No ambiguity.** Exactly one option can be defended as correct.
- **Distractors must be plausible** — ideally the exact error an Arabic speaker would make.
- **Explain, don't announce.** "he/she/it take is" beats "Correct answer: is".
- **Arabic is not a translation.** Use it to say the thing English cannot: how the
  structure differs from Arabic, which literal translation goes wrong, what to remember.
- **Level-appropriate.** A1–A2 tests form. B1–B2 tests control. C1 tests precision and
  implication. C2 asks which sentence a proficient speaker would *actually say* —
  grammaticality is no longer the question.

## 5. Difficulty guide

| Level | Meaning |
| --- | --- |
| 1 | Recognition; the rule was just taught |
| 2 | Standard application |
| 3 | Requires a decision between two rules |
| 4 | Multiple rules at once, or a common trap |
| 5 | Nuance, register, naturalness, inference |

Selection targets difficulty to the learner's current strength, so a unit needs a spread —
not all 2s.

## 6. Checklist before committing

```bash
npm test          # content validity + engine tests
npm start         # click through the new unit yourself
```

Then play the unit as a learner: study it, practise it, deliberately answer wrongly, and
read the feedback. If the feedback does not teach you something, rewrite it.
