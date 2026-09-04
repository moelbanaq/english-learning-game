/**
 * Interface localisation (EN / AR).
 * Learning *content* carries its own bilingual fields; this file is UI chrome only.
 */
import { getState, update } from './store.js';

const STRINGS = {
  en: {
    'app.name': 'Masar English',
    'app.tagline': 'Learn English from A1 to C2 — free, no account.',
    'nav.home': 'Home', 'nav.learn': 'Learn', 'nav.review': 'Review', 'nav.stats': 'Stats', 'nav.settings': 'Settings',

    'home.greeting': 'Welcome back',
    'home.next': 'Continue learning',
    'home.today': "Today's mission",
    'home.streak': 'Day streak',
    'home.xp': 'Total XP',
    'home.mastered': 'Concepts mastered',
    'home.dueReview': 'Due for review',
    'home.weakAreas': 'Weak areas',
    'home.noWeak': 'Nothing weak right now. Keep going!',
    'home.recent': 'Recent sessions',
    'home.goalDone': 'Daily goal complete',
    'home.goalProgress': '{a} / {b} XP today',

    'mission.learn': 'Study a new concept',
    'mission.answer': 'Answer {n} questions',
    'mission.review': 'Review {n} items',
    'mission.test': 'Pass a mini test',

    'learn.title': 'Learning path',
    'learn.sub': 'Six CEFR levels. Each unit teaches, drills, then tests you.',
    'learn.locked': 'Not unlocked yet',
    'learn.lockedNote': 'You have not unlocked this level through practice yet — but you can still open any unit and try it.',
    'learn.units': '{done} / {total} units',
    'learn.soon': 'Content coming soon',
    'learn.openLevel': 'Show units',

    'unit.learn': 'Learn', 'unit.practice': 'Practice', 'unit.test': 'Mini test',
    'unit.learnDesc': 'Short explanation with examples in English and Arabic.',
    'unit.practiceDesc': 'Guided exercises with instant feedback.',
    'unit.testDesc': 'Short assessment. Beat {n}% to complete the unit.',
    'unit.locked.practice': 'Study the concepts first.',
    'unit.locked.test': 'Do some practice first.',
    'unit.best': 'Best {n}%', 'unit.attempts': '{n} attempts', 'unit.completed': 'Unit completed',
    'unit.concepts': 'What you will learn',

    'lesson.next': 'Next', 'lesson.prev': 'Back', 'lesson.toPractice': 'Start practice',
    'lesson.examples': 'Examples', 'lesson.rule': 'Rule', 'lesson.tip': 'Tip',
    'lesson.watch': 'Common mistake for Arabic speakers',

    'q.check': 'Check', 'q.continue': 'Continue', 'q.finish': 'See results',
    'q.correct': 'Correct', 'q.incorrect': 'Not quite', 'q.answerWas': 'Correct answer',
    'q.why': 'Why', 'q.typeHere': 'Type your answer…', 'q.tapWords': 'Tap the words in the right order',
    'q.clear': 'Clear', 'q.skip': 'Skip', 'q.yourAnswer': 'Your answer',
    'q.match': 'Match each pair',
    'q.of': 'Question {a} of {b}',
    'q.showArabic': 'Arabic explanation', 'q.hideArabic': 'Hide Arabic',

    'res.title': 'Session complete', 'res.score': 'Score', 'res.xp': '+{n} XP',
    'res.strong': 'You were strong on', 'res.work': 'Worth reviewing', 'res.again': 'Practise again',
    'res.review': 'Review mistakes', 'res.home': 'Back to home', 'res.continue': 'Continue',
    'res.passed': 'Unit passed!', 'res.notPassed': 'Not passed yet — {n}% needed.',
    'res.newBest': 'New best score',
    'res.perfect': 'Perfect score',

    'review.title': 'Review',
    'review.sub': 'Your mistakes and everything due for spaced repetition.',
    'review.mistakes': 'Open mistakes', 'review.due': 'Due today', 'review.start': 'Start review session',
    'review.empty': 'No mistakes saved. Answer some questions first.',
    'review.allClear': 'Nothing due right now — your memory is fresh.',
    'review.fixed': 'Fixed', 'review.times': 'wrong {n}×',
    'review.byConcept': 'By concept',
    'review.clearAll': 'Clear fixed mistakes',

    'stats.title': 'Your progress',
    'stats.activity': 'Last 14 days',
    'stats.accuracy': 'Accuracy', 'stats.answered': 'Answered', 'stats.sessions': 'Sessions',
    'stats.mastery': 'Concept mastery', 'stats.achievements': 'Achievements',
    'stats.noData': 'Answer a few questions to see your statistics.',
    'stats.level': 'Level progress',

    'set.title': 'Settings',
    'set.uiLang': 'Interface language', 'set.explainLang': 'Explanations',
    'set.theme': 'Theme', 'set.light': 'Light', 'set.dark': 'Dark', 'set.system': 'System',
    'set.both': 'English + Arabic', 'set.en': 'English only', 'set.ar': 'Arabic only',
    'set.goal': 'Daily XP goal',
    'set.data': 'Your data', 'set.dataDesc': 'Progress is stored in this browser only. Export a backup to move it to another device.',
    'set.export': 'Export backup', 'set.import': 'Import backup', 'set.reset': 'Reset all progress',
    'set.resetConfirm': 'This deletes all progress on this device. Continue?',
    'set.about': 'About', 'set.level': 'Current level', 'set.levelDesc': 'You can switch level at any time.',
    'set.placement': 'Retake placement test',
    'set.storageWarn': 'This browser is blocking storage, so progress will be lost when you close the tab.',

    'welcome.title': 'Learn English, step by step',
    'welcome.sub': 'From your first sentence to advanced nuance — with explanations in Arabic. Free, offline-friendly, no account needed.',
    'welcome.start': 'Take the 3-minute placement test',
    'welcome.pick': 'Or choose a level yourself',
    'welcome.begin': 'Start learning',

    'place.title': 'Placement test',
    'place.sub': '~20 questions, from easy to hard. Skip anything you do not know — that is useful information too.',
    'place.begin': 'Begin test',
    'place.result': 'We recommend starting at {lvl}',
    'place.resultSub': 'You can start anywhere you like — this is only a suggestion.',
    'place.accept': 'Start at {lvl}', 'place.choose': 'Choose a different level',
    'place.dontKnow': "I don't know",

    'common.back': 'Back', 'common.cancel': 'Cancel', 'common.save': 'Save', 'common.close': 'Close',
    'common.loading': 'Loading…', 'common.error': 'Something went wrong.', 'common.retry': 'Try again',
    'common.questions': '{n} questions', 'common.minutes': '~{n} min', 'common.xp': 'XP',
    'common.level': 'Level',
    'common.rank': 'Rank {n}',
  },

  ar: {
    'app.name': 'مسار الإنجليزية',
    'app.tagline': 'تعلَّم الإنجليزية من A1 إلى C2 — مجاناً وبدون حساب.',
    'nav.home': 'الرئيسية', 'nav.learn': 'التعلّم', 'nav.review': 'المراجعة', 'nav.stats': 'إحصائياتي', 'nav.settings': 'الإعدادات',

    'home.greeting': 'أهلاً بعودتك',
    'home.next': 'أكمل التعلّم',
    'home.today': 'مهمة اليوم',
    'home.streak': 'أيام متتالية',
    'home.xp': 'مجموع النقاط',
    'home.mastered': 'مفاهيم أتقنتها',
    'home.dueReview': 'حان وقت مراجعتها',
    'home.weakAreas': 'نقاط ضعفك',
    'home.noWeak': 'لا توجد نقاط ضعف الآن. واصل!',
    'home.recent': 'آخر الجلسات',
    'home.goalDone': 'أنجزت هدف اليوم',
    'home.goalProgress': '{a} / {b} نقطة اليوم',

    'mission.learn': 'ادرس مفهوماً جديداً',
    'mission.answer': 'أجب عن {n} سؤالاً',
    'mission.review': 'راجع {n} عناصر',
    'mission.test': 'اجتز اختباراً قصيراً',

    'learn.title': 'مسار التعلّم',
    'learn.sub': 'ستة مستويات حسب الإطار الأوروبي. كل وحدة تشرح ثم تدرّب ثم تختبر.',
    'learn.locked': 'لم يُفتح بعد',
    'learn.lockedNote': 'لم تفتح هذا المستوى بالتقدّم بعد، لكن يمكنك فتح أي وحدة وتجربتها متى شئت.',
    'learn.units': '{done} / {total} وحدة',
    'learn.soon': 'المحتوى قادم قريباً',
    'learn.openLevel': 'عرض الوحدات',

    'unit.learn': 'الشرح', 'unit.practice': 'تدريب', 'unit.test': 'اختبار قصير',
    'unit.learnDesc': 'شرح مختصر مع أمثلة بالإنجليزية والعربية.',
    'unit.practiceDesc': 'تمارين موجَّهة مع تصحيح فوري.',
    'unit.testDesc': 'اختبار قصير. تحتاج {n}% لإكمال الوحدة.',
    'unit.locked.practice': 'ادرس الشرح أولاً.',
    'unit.locked.test': 'تدرَّب قليلاً أولاً.',
    'unit.best': 'أفضل نتيجة {n}%', 'unit.attempts': '{n} محاولة', 'unit.completed': 'أكملت الوحدة',
    'unit.concepts': 'ما ستتعلّمه',

    'lesson.next': 'التالي', 'lesson.prev': 'السابق', 'lesson.toPractice': 'ابدأ التدريب',
    'lesson.examples': 'أمثلة', 'lesson.rule': 'القاعدة', 'lesson.tip': 'ملاحظة مفيدة',
    'lesson.watch': 'خطأ شائع عند الناطقين بالعربية',

    'q.check': 'تحقّق', 'q.continue': 'متابعة', 'q.finish': 'عرض النتيجة',
    'q.correct': 'إجابة صحيحة', 'q.incorrect': 'ليست صحيحة', 'q.answerWas': 'الإجابة الصحيحة',
    'q.why': 'لماذا', 'q.typeHere': 'اكتب إجابتك…', 'q.tapWords': 'رتِّب الكلمات بالضغط عليها',
    'q.clear': 'مسح', 'q.skip': 'تخطٍّ', 'q.yourAnswer': 'إجابتك',
    'q.match': 'صِل بين كل زوج',
    'q.of': 'سؤال {a} من {b}',
    'q.showArabic': 'الشرح بالعربية', 'q.hideArabic': 'إخفاء العربية',

    'res.title': 'انتهت الجلسة', 'res.score': 'النتيجة', 'res.xp': '+{n} نقطة',
    'res.strong': 'كنت قوياً في', 'res.work': 'يستحق المراجعة', 'res.again': 'تدرَّب مرة أخرى',
    'res.review': 'راجع أخطاءك', 'res.home': 'العودة للرئيسية', 'res.continue': 'متابعة',
    'res.passed': 'اجتزت الوحدة!', 'res.notPassed': 'لم تجتزها بعد — تحتاج {n}%.',
    'res.newBest': 'أفضل نتيجة جديدة',
    'res.perfect': 'نتيجة كاملة',

    'review.title': 'المراجعة',
    'review.sub': 'أخطاؤك وكل ما حان وقت مراجعته.',
    'review.mistakes': 'أخطاء مفتوحة', 'review.due': 'مستحق اليوم', 'review.start': 'ابدأ جلسة مراجعة',
    'review.empty': 'لا توجد أخطاء محفوظة. أجب عن بعض الأسئلة أولاً.',
    'review.allClear': 'لا شيء مستحق الآن — ذاكرتك منتعشة.',
    'review.fixed': 'صحّحتها', 'review.times': 'أخطأت {n} مرة',
    'review.byConcept': 'حسب المفهوم',
    'review.clearAll': 'حذف الأخطاء المصحَّحة',

    'stats.title': 'تقدّمك',
    'stats.activity': 'آخر ١٤ يوماً',
    'stats.accuracy': 'نسبة الصواب', 'stats.answered': 'أسئلة أجبتها', 'stats.sessions': 'جلسات',
    'stats.mastery': 'إتقان المفاهيم', 'stats.achievements': 'الإنجازات',
    'stats.noData': 'أجب عن بعض الأسئلة لتظهر إحصائياتك.',
    'stats.level': 'تقدّم المستوى',

    'set.title': 'الإعدادات',
    'set.uiLang': 'لغة الواجهة', 'set.explainLang': 'لغة الشرح',
    'set.theme': 'المظهر', 'set.light': 'فاتح', 'set.dark': 'داكن', 'set.system': 'حسب النظام',
    'set.both': 'إنجليزي + عربي', 'set.en': 'إنجليزي فقط', 'set.ar': 'عربي فقط',
    'set.goal': 'هدف النقاط اليومي',
    'set.data': 'بياناتك', 'set.dataDesc': 'يُحفظ تقدّمك في هذا المتصفح فقط. صدِّر نسخة احتياطية لنقله إلى جهاز آخر.',
    'set.export': 'تصدير نسخة', 'set.import': 'استيراد نسخة', 'set.reset': 'حذف كل التقدّم',
    'set.resetConfirm': 'سيُحذف كل تقدّمك على هذا الجهاز. هل تريد المتابعة؟',
    'set.about': 'عن التطبيق', 'set.level': 'المستوى الحالي', 'set.levelDesc': 'يمكنك تغيير المستوى في أي وقت.',
    'set.placement': 'إعادة اختبار تحديد المستوى',
    'set.storageWarn': 'هذا المتصفح يمنع التخزين، لذلك سيضيع تقدّمك عند إغلاق الصفحة.',

    'welcome.title': 'تعلَّم الإنجليزية خطوة بخطوة',
    'welcome.sub': 'من أول جملة إلى دقائق اللغة المتقدمة — مع شرح بالعربية. مجاناً وبدون حساب.',
    'welcome.start': 'ابدأ باختبار تحديد المستوى (٣ دقائق)',
    'welcome.pick': 'أو اختر مستواك بنفسك',
    'welcome.begin': 'ابدأ التعلّم',

    'place.title': 'اختبار تحديد المستوى',
    'place.sub': 'نحو ٢٠ سؤالاً من الأسهل إلى الأصعب. تخطَّ ما لا تعرفه — هذه معلومة مفيدة أيضاً.',
    'place.begin': 'ابدأ الاختبار',
    'place.result': 'نقترح أن تبدأ من المستوى {lvl}',
    'place.resultSub': 'يمكنك البدء من أي مستوى تريده — هذا اقتراح فقط.',
    'place.accept': 'ابدأ من {lvl}', 'place.choose': 'اختر مستوى آخر',
    'place.dontKnow': 'لا أعرف',

    'common.back': 'رجوع', 'common.cancel': 'إلغاء', 'common.save': 'حفظ', 'common.close': 'إغلاق',
    'common.loading': 'جارٍ التحميل…', 'common.error': 'حدث خطأ ما.', 'common.retry': 'أعد المحاولة',
    'common.questions': '{n} سؤالاً', 'common.minutes': '~{n} دقيقة', 'common.xp': 'نقطة',
    'common.level': 'المستوى',
    'common.rank': 'الرتبة {n}',
  },
};

export function lang() { return getState().settings.uiLang === 'ar' ? 'ar' : 'en'; }
export function isRTL() { return lang() === 'ar'; }

/** t('home.goalProgress', { a: 10, b: 30 }) */
export function t(key, vars) {
  const table = STRINGS[lang()] || STRINGS.en;
  let s = table[key] ?? STRINGS.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
  return s;
}

/** Pick the right side of a bilingual content field. */
export function bi(field, preferred) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  const want = preferred || lang();
  return field[want] || field.en || field.ar || '';
}

export function setLang(next) {
  update((s) => { s.settings.uiLang = next === 'ar' ? 'ar' : 'en'; }, 'lang');
  applyDocumentLang();
}

export function applyDocumentLang() {
  const l = lang();
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
}
