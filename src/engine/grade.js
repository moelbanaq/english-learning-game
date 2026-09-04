/**
 * Answer checking. Pure functions — unit-tested in tests/.
 */

/** Normalise a typed answer so trivial differences never count as mistakes. */
export function normalize(input) {
  return String(input == null ? '' : input)
    .replace(/[‘’ʼ٬]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    // Trailing punctuation is stripped last, once surrounding spaces are gone.
    .replace(/[.!?;,:]+$/g, '')
    .trim();
}

/** All strings that count as correct for a typed/ordered question. */
export function acceptedAnswers(q) {
  const list = [];
  if (typeof q.answer === 'string') list.push(q.answer);
  if (Array.isArray(q.answer)) list.push(...q.answer.filter((a) => typeof a === 'string'));
  if (Array.isArray(q.accept)) list.push(...q.accept);
  return list;
}

/** Human-readable correct answer, for feedback panels. */
export function correctText(q) {
  switch (q.type) {
    case 'choice':
      return q.options[q.answer];
    case 'text':
    case 'order':
      return acceptedAnswers(q)[0] || '';
    case 'match':
      return q.pairs.map(([a, b]) => `${a} → ${b}`).join(' · ');
    default:
      return '';
  }
}

/**
 * @param {object} q       question object
 * @param {any} response   choice: index | text: string | order: string[] | match: {wrong:number}
 * @returns {{correct: boolean, given: string}}
 */
export function grade(q, response) {
  switch (q.type) {
    case 'choice': {
      const idx = Number(response);
      return {
        correct: Number.isInteger(idx) && idx === q.answer,
        given: q.options[idx] !== undefined ? q.options[idx] : '',
      };
    }
    case 'text': {
      const given = String(response ?? '');
      const norm = normalize(given);
      const ok = norm.length > 0 && acceptedAnswers(q).some((a) => normalize(a) === norm);
      return { correct: ok, given };
    }
    case 'order': {
      const given = Array.isArray(response) ? response.join(' ') : String(response ?? '');
      const norm = normalize(given);
      const ok = norm.length > 0 && acceptedAnswers(q).some((a) => normalize(a) === norm);
      return { correct: ok, given };
    }
    case 'match': {
      const wrong = response && typeof response === 'object' ? Number(response.wrong || 0) : 1;
      return { correct: wrong === 0, given: wrong === 0 ? 'all matched' : `${wrong} wrong attempts` };
    }
    default:
      return { correct: false, given: '' };
  }
}

/**
 * Split "She ___ happy." into the text around its gaps, so each gap can be rendered
 * as its own element. A sentence with two gaps yields three segments.
 */
export function splitBlank(sentence) {
  return String(sentence || '').split('___');
}

/** Deterministic shuffle (seeded) so a session is stable across re-renders. */
export function shuffle(arr, seed = Date.now()) {
  const a = arr.slice();
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
