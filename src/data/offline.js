/**
 * Pre-download the whole course.
 *
 * Units are normally fetched the first time they are opened, which is right for a
 * learner on metered data. But someone about to lose signal — a commute, a flight,
 * a village with no coverage — wants the opposite. The entire curriculum is under a
 * megabyte, so one tap can put all of it in the service worker's cache.
 *
 * This is a plain fetch loop on purpose: the worker's caching rules already apply to
 * every request, so there is nothing here that needs to know how caching works.
 */
import { getCurriculum, contentUrl } from './content.js';

/** How many requests to keep in flight. Enough to be quick, few enough to survive 3G. */
const BATCH = 6;

/** Every content file the app can ask for, in the order a learner would meet them. */
export function contentFiles(curriculum) {
  const files = ['curriculum.json', 'concept-index.json', 'placement.json'];
  for (const level of curriculum.levels || []) {
    for (const unit of level.units || []) {
      if (unit.file) files.push(unit.file);
    }
  }
  return files;
}

/**
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<{total: number, failed: number, bytes: number}>}
 */
export async function downloadAllContent(onProgress) {
  const curriculum = await getCurriculum();
  const files = contentFiles(curriculum);
  let done = 0;
  let failed = 0;
  let bytes = 0;

  for (let i = 0; i < files.length; i += BATCH) {
    await Promise.all(files.slice(i, i + BATCH).map(async (rel) => {
      try {
        const res = await fetch(contentUrl(rel));
        if (!res.ok) throw new Error(String(res.status));
        bytes += (await res.arrayBuffer()).byteLength;
      } catch {
        failed += 1;
      }
      done += 1;
      if (onProgress) onProgress(done, files.length);
    }));
  }

  return { total: files.length, failed, bytes };
}
