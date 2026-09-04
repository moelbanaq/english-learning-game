/**
 * XP, ranks, streaks, daily mission and achievements.
 * Game layer only — it never decides what the learner sees next (that is select.js).
 */
import { dayKey, daysBetween } from '../core/store.js';

export function xpForAnswer({ correct, difficulty = 2, wasMistake = false, kind = 'practice' }) {
  if (!correct) return 2;                                  // effort still counts
  let xp = 8 + Math.min(difficulty, 5) * 2;                // 10 .. 18
  if (wasMistake) xp += 4;                                 // fixing an old mistake is worth more
  if (kind === 'test') xp = Math.round(xp * 1.15);
  if (kind === 'review') xp += 2;
  return Math.round(xp);
}

/** Rank curve: fast early ranks, gradually slower — 50 XP for rank 2, ~4500 for rank 10. */
export function rankFromXp(xp) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1);
}
export function xpForRank(rank) {
  return Math.pow(Math.max(0, rank - 1), 2) * 50;
}
export function rankProgress(xp) {
  const rank = rankFromXp(xp);
  const from = xpForRank(rank);
  const to = xpForRank(rank + 1);
  return { rank, from, to, pct: Math.max(0, Math.min(100, ((xp - from) / (to - from)) * 100)) };
}

/** Update the streak for activity today. Returns true when the streak grew. */
export function touchStreak(state, xpGained = 0) {
  const today = dayKey();
  const st = state.streak;
  st.days[today] = (st.days[today] || 0) + xpGained;
  // keep ~90 days of activity for the chart
  const keys = Object.keys(st.days).sort();
  while (keys.length > 90) delete st.days[keys.shift()];

  if (st.lastDay === today) return false;
  if (st.lastDay && daysBetween(st.lastDay, today) === 1) st.current += 1;
  else st.current = 1;
  st.lastDay = today;
  st.best = Math.max(st.best, st.current);
  return true;
}

/** The four small tasks that make up a day. */
export function dailyTasks(state) {
  const d = state.daily;
  const goal = { learn: 1, answer: 12, review: 5, test: 1 };
  return [
    { id: 'learn', key: 'mission.learn', done: d.learned >= goal.learn, have: d.learned, need: goal.learn },
    { id: 'answer', key: 'mission.answer', done: d.answered >= goal.answer, have: d.answered, need: goal.answer },
    { id: 'review', key: 'mission.review', done: d.reviewed >= goal.review, have: d.reviewed, need: goal.review },
    { id: 'test', key: 'mission.test', done: d.tests >= goal.test, have: d.tests, need: goal.test },
  ];
}

export const ACHIEVEMENTS = [
  { id: 'first_answer', icon: '🌱', name: { en: 'First step', ar: 'الخطوة الأولى' }, desc: { en: 'Answer your first question', ar: 'أجب عن أول سؤال' },
    test: (s) => totalAnswered(s) >= 1 },
  { id: 'ten_correct', icon: '✅', name: { en: 'Ten right', ar: 'عشر إجابات' }, desc: { en: '10 correct answers', ar: '١٠ إجابات صحيحة' },
    test: (s) => totalCorrect(s) >= 10 },
  { id: 'hundred_answers', icon: '💯', name: { en: 'Century', ar: 'المئة' }, desc: { en: 'Answer 100 questions', ar: 'أجب عن ١٠٠ سؤال' },
    test: (s) => totalAnswered(s) >= 100 },
  { id: 'first_unit', icon: '🏅', name: { en: 'Unit cleared', ar: 'أنهيت وحدة' }, desc: { en: 'Complete your first unit', ar: 'أكمل أول وحدة' },
    test: (s) => completedUnits(s) >= 1 },
  { id: 'five_units', icon: '🏆', name: { en: 'Five units', ar: 'خمس وحدات' }, desc: { en: 'Complete 5 units', ar: 'أكمل ٥ وحدات' },
    test: (s) => completedUnits(s) >= 5 },
  { id: 'perfect_test', icon: '🎯', name: { en: 'Flawless', ar: 'بلا خطأ' }, desc: { en: 'Score 100% on a mini test', ar: 'احصل على ١٠٠٪ في اختبار' },
    test: (s) => Object.values(s.units).some((u) => u.testBest === 100) },
  { id: 'fixer', icon: '🔧', name: { en: 'Mistake fixer', ar: 'مُصلِح الأخطاء' }, desc: { en: 'Fix 10 saved mistakes', ar: 'صحّح ١٠ أخطاء محفوظة' },
    test: (s) => Object.values(s.mistakes).filter((m) => m.status === 'fixed').length >= 10 },
  { id: 'streak_3', icon: '🔥', name: { en: '3-day streak', ar: '٣ أيام متتالية' }, desc: { en: 'Practise 3 days in a row', ar: 'تدرَّب ٣ أيام متتالية' },
    test: (s) => s.streak.best >= 3 },
  { id: 'streak_7', icon: '⚡', name: { en: 'Week on', ar: 'أسبوع كامل' }, desc: { en: 'Practise 7 days in a row', ar: 'تدرَّب ٧ أيام متتالية' },
    test: (s) => s.streak.best >= 7 },
  { id: 'streak_30', icon: '💎', name: { en: 'A month strong', ar: 'شهر كامل' }, desc: { en: 'Practise 30 days in a row', ar: 'تدرَّب ٣٠ يوماً متتالياً' },
    test: (s) => s.streak.best >= 30 },
  { id: 'ten_mastered', icon: '🧠', name: { en: 'Ten mastered', ar: 'عشرة متقنة' }, desc: { en: 'Master 10 concepts', ar: 'أتقن ١٠ مفاهيم' },
    test: (s) => Object.values(s.concepts).filter((c) => c.state === 'mastered').length >= 10 },
  { id: 'level_up', icon: '🚪', name: { en: 'Level up', ar: 'مستوى جديد' }, desc: { en: 'Unlock a new CEFR level', ar: 'افتح مستوى جديداً' },
    test: (s) => s.profile.unlocked.length >= 2 },
  { id: 'xp_1000', icon: '⭐', name: { en: '1000 XP', ar: '١٠٠٠ نقطة' }, desc: { en: 'Earn 1000 XP', ar: 'اجمع ١٠٠٠ نقطة' },
    test: (s) => s.profile.xp >= 1000 },
];

function totalAnswered(s) { return Object.values(s.questions).reduce((n, q) => n + q.seen, 0); }
function totalCorrect(s) { return Object.values(s.questions).reduce((n, q) => n + q.correct, 0); }
function completedUnits(s) { return Object.values(s.units).filter((u) => u.completedAt).length; }

export { totalAnswered, totalCorrect, completedUnits };

/** Returns achievement objects newly earned by the current state (and records them). */
export function checkAchievements(state) {
  const earned = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id]) continue;
    let ok = false;
    try { ok = a.test(state); } catch { ok = false; }
    if (ok) { state.achievements[a.id] = Date.now(); earned.push(a); }
  }
  return earned;
}
