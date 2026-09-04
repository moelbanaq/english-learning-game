# Roadmap

The rule: every phase ends with something a learner can actually use.

## Shipped

### Phase 0 — Architecture ✅
Zero-dependency static app, content/logic/UI separation, versioned progress store behind
a swappable storage adapter, JSON schemas, content validator, unit and browser tests.

### Phase 1 — Playable MVP ✅
Learn → Practice → Mini test → Results → Review → Continue, with immediate bilingual
feedback. Four exercise interactions (choice, typed, word-ordering, matching) covering
sixteen pedagogical formats including reading comprehension and naturalness judgement.

### Phase 2 — Game layer ✅
XP tied to difficulty, ranks, streaks, a four-part daily mission, 13 achievements,
per-unit completion at 75%, and level unlocking once 75% of a level's units are done.

### Phase 3 — Mistakes, mastery and adaptation ✅
Saved mistakes with explanations, a dedicated Review section, five mastery states, a
lightweight spaced-repetition schedule, and adaptive question selection that pushes weak
and overdue concepts forward.

### Phase 4 — Content foundation ✅

### Phase 5 — A2 completion ✅
Four more units taking A2 to eight: future forms (will vs going to vs arrangements),
-ed/-ing adjectives with adverbs and word order, the make/do/have/take/get collocation
set, and a reading-led unit built on real notices and message threads.

### Phase 6 — B1 completion ✅
Six more units taking B1 to eight: the passive and why it exists, relative clauses,
modals of deduction with `should have` regret, linking words and paragraph shape,
phrasal verbs with object placement, and opinion/argument language — the last three
built around longer reading passages with inference questions.

### Phase 7 — B2 completion ✅
Seven more units taking B2 to eight: wishes and the unreal past (including inversion
without `if`), graded likelihood with `needn't have` versus `didn't need to`, cohesion
and reference, word formation and confusable pairs, emphasis through clefts and end
focus, reading a longer argument for attitude and evidence, and writing emails and
reports that are formal without being padded.

### Phase 8 — C1 completion ✅
Seven more units taking C1 to eight: academic stance through reporting verbs and
impersonal structures, lexical precision (support verbs, fixed intensifiers, and
near-synonyms that describe different events), complex noun phrases and participle
clauses, signposting and concession across a long argument, implication and
presupposition — what a text assumes rather than states — register shifting with the
line between kind euphemism and evasive euphemism, and taking an argument apart fairly.

### Phase 9 — C2 depth ✅
Seven more units taking C2 to eight: connotation and framing, irony and understatement,
ambiguity (chosen and accidental), rhythm and rhetoric, idiom and cliché, voice and
authorial distance, and editing your own prose as a stranger would read it.

| Level | Units | Concepts | Questions |
| --- | --- | --- | --- |
| A1 | 8 | 23 | 141 |
| A2 | 8 | 24 | 127 |
| B1 | 8 | 24 | 120 |
| B2 | 8 | 26 | 120 |
| C1 | 8 | 25 | 120 |
| C2 | 8 | 25 | 120 |
| **Total** | **48** | **147** | **748** |

Plus a 24-question placement test spanning all six levels.

**All six CEFR levels are now complete at eight units each.** A learner can start from no
English and work through to C2 without leaving the app. The levels are deliberately
different in kind, not just in difficulty: A1–A2 build form, B1–B2 build control, C1 asks
what a sentence commits you to, and C2 asks what it does to a reader who did not write it.

## Next

### Phase 10 — Content and pedagogy expansion (next up)
- A vocabulary track (word families, collocations, phrasal verbs) alongside grammar.
- More reading passages per level, with graded difficulty.
- Optional writing prompts with self-assessment checklists (no AI needed).
- Audio, if a free and licence-clean source can be found — this is a *want*, not a blocker.

### Phase 11 — Public polish
Offline support via a service worker, install-to-home-screen, shareable progress cards,
a lightweight landing page for the Learn English button, and a first accessibility audit
with a screen reader.

### Phase 12 — Optional accounts and sync
Only when there is a real reason (learners asking to move between devices) and a free
tier that fits. The storage adapter and the export/import format already exist, so this
is an addition rather than a rewrite. Leaderboards and cohort stats become possible at
the same time.

## Deliberately not planned

- Any AI call during gameplay. The app must work with no key, no account and no network.
- A backend before it is needed. Every feature above works statically.
- Heavier gamification (lives, gems, paid streak repair). Mechanics must serve learning.
