// Offline browser fixtures, including the logged "59%" failure. No live site access.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { chromium } = require('playwright');
const source = fs.readFileSync(path.join(__dirname, '..', 'AnimeSSS_help.user.js'), 'utf8');
function extract(name) {
  const m = new RegExp('^([ \\t]*)(?:async )?function ' + name + '\\(', 'm').exec(source);
  const lines = source.slice(m.index).split(/\r?\n/);
  for (let n = 2; n <= lines.length; n++) {
    if (lines[n - 1] !== m[1] + '}') continue;
    const code = lines.slice(0, n).join('\n'); try { new vm.Script('(' + code + ')'); return code; } catch {}
  }
  throw Error(name);
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER_CHANNEL || 'msedge' });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<body></body>' }));
    await page.goto('https://fixture.invalid/labyrinth/');
    const result = await page.evaluate(code => {
      let passed = 0;
      const check = (v, label) => { if (!v) throw Error(label); passed++; };
      const normalize = text => text.toLowerCase();
      const QUESTION_PREFIXES = ['Лабиринт повторил чужую судьбу.'];
      const QUESTION_SUFFIX_PATTERNS = [];
      let quizDbReady = true, lastProcessedQuestion = '', resetTimer = 0, searches = 0;
      const logs = [], reports = [], pending = [];
      let scheduled = 0;
      const scheduleProcessQuiz = () => { scheduled++; };
      const requestIdleCallback = fn => pending.push(fn);
      const suiteTelemetryLog = (...args) => logs.push(args);
      const sendQuizReport = (...args) => reports.push(args);
      const getLocalDB = () => ({ questions: [] });
      const quizHash = text => text;
      const findQuestion = () => { searches++; return { score: 1, match: { answer: 'Шерке' } }; };
      const findAnswerButton = (answer, buttons) => ({ btn: buttons.find(b => b.textContent === answer), score: 1 });
      const EXACT_THRESHOLD = 0.99;
      const quizLog = () => {}, observeQuizResult = () => {};
      window.__suiteLabyrinthQuizInstalled = true;
      eval(code);
      const fixture = inner => { document.body.innerHTML = `<div class="event-text">Посторонняя реклама</div><section class="labyrinth">${inner}<div id="labyrinthQuiz"><button class="labyrinth__quiz-btn">Шерке</button><button class="labyrinth__quiz-btn">Каска</button></div></section>`; return document.getElementById('labyrinthQuiz'); };
      let quiz = fixture('<div class="labyrinth__progress-text">59%</div>');
      check(getQuizQuestionText(quiz) === '', 'percentage must not become a question');
      quiz = fixture('<div id="labyrinthEventText">59%</div>');
      check(getQuizQuestionText(quiz) === '', 'percentage rejected even in primary element');
      for (const label of ['Загрузка…', 'Загрузка 59%', 'Усталость: 59%', '00:15', 'Аниме-викторина', 'Правильный ответ! Награда начислена.']) {
        quiz = fixture(`<div id="labyrinthEventText">${label}</div>`);
        check(getQuizQuestionText(quiz) === '', 'UI-only text rejected: ' + label);
      }
      const question = 'Как зовут ведьму из аниме Берсерк?';
      quiz = fixture(`<div class="labyrinth__progress-text">59%</div><div id="labyrinthEventText">${question}</div>`);
      check(getQuizQuestionText(quiz) === question, 'real site event question wins over percentage');
      quiz = fixture(`<div class="labyrinth__text">${question}</div>`);
      check(getQuizQuestionText(quiz) === question, 'scoped legacy fallback supported');
      quiz = fixture('<div id="labyrinthEventText">Загрузка…</div>');
      check(getQuizQuestionText(quiz) === '', 'wait for asynchronous question');
      document.getElementById('labyrinthEventText').textContent = question;
      check(getQuizQuestionText(quiz) === question, 'question arriving later can be processed');
      quiz = fixture(`<div id="labyrinthEventText" style="display:none">Старый вопрос?</div><div class="labyrinth__text">${question}</div>`);
      check(getQuizQuestionText(quiz) === question, 'hidden previous question ignored');
      quiz = fixture(`<div id="labyrinthEventText">${question}<span role="progressbar">59%</span><span hidden>Мусор</span></div>`);
      check(getQuizQuestionText(quiz) === question, 'nested progress and hidden text stripped');
      quiz = fixture('<div id="labyrinthEventText">Кто использовал 100% силы?</div>');
      check(getQuizQuestionText(quiz) === 'Кто использовал 100% силы?', 'percentage within real question preserved');
      quiz = fixture('<div id="labyrinthEventText">Лабиринт повторил чужую судьбу.</div>');
      check(getQuizQuestionText(quiz) === '', 'prefix alone is not question');
      quiz = fixture(`<div id="labyrinthEventText">${question}</div>`); quiz.style.display = 'none';
      check(getQuizQuestionText(quiz) === '', 'closed quiz ignored');
      quiz = fixture('<div id="labyrinthEventText">59%</div>');
      processQuiz();
      check(logs.length === 0 && reports.length === 0 && pending.length === 0 && !lastProcessedQuestion, 'invalid text does not create an attempt, search or report');
      document.getElementById('labyrinthEventText').textContent = question;
      processQuiz(); pending.shift()();
      check(searches === 1 && quiz.querySelector('.labyrinth__quiz-btn--correct'), 'real question is processed after percentage is replaced');
      check(reports.length === 0, 'no false NEW report for percentage');
      lastProcessedQuestion = ''; processQuiz();
      document.getElementById('labyrinthEventText').textContent = 'Другой вопрос?';
      pending.shift()();
      check(searches === 1, 'deferred search cannot highlight a changed question');
      lastProcessedQuestion = ''; processQuiz(); quiz.remove(); pending.shift()();
      check(searches === 1, 'deferred search cannot process removed quiz');

      quiz = fixture(`<div id="labyrinthEventText">${question}</div>`);
      processQuiz(); processQuiz();
      check(pending.length === 1, 'repeated mutations share one pending search');
      const answer = quiz.querySelector('.labyrinth__quiz-btn');
      answer.style.display = 'none';
      pending.shift()();
      check(!lastProcessedQuestion && !processQuiz.pendingSearch && scheduled > 0, 'cancelled search releases question and schedules recheck');
      answer.style.display = '';
      processQuiz(); pending.shift()();
      check(searches === 2 && answer.classList.contains('labyrinth__quiz-btn--correct'), 'restored answer is highlighted without waiting 60 seconds');
      const selections = logs.filter(row => row[1] === 'answer_selected').length;
      answer.click();
      check(logs.filter(row => row[1] === 'answer_selected').length === selections + 1, 'cancelled search leaves no duplicate click listener');

      lastProcessedQuestion = '';
      quiz = fixture(`<div id="labyrinthEventText">${question}</div>`);
      processQuiz();
      document.getElementById('labyrinthEventText').textContent = 'Новый вопрос?';
      processQuiz();
      pending.shift()();
      check(!!processQuiz.pendingSearch && !lastProcessedQuestion, 'stale callback cannot clear a newer pending search');
      pending.shift()();
      check(lastProcessedQuestion === 'Новый вопрос?' && searches === 3, 'newer question is processed normally');

      lastProcessedQuestion = '';
      quiz = fixture(`<div id="labyrinthEventText">${question}</div>`);
      processQuiz();
      quiz.querySelectorAll('.labyrinth__quiz-btn')[1].textContent = 'Другой ответ';
      pending.shift()();
      check(!lastProcessedQuestion && searches === 3, 'changing answer options cancels stale search');
      processQuiz(); pending.shift()();
      check(searches === 4, 'updated answer options can be searched again');
      clearTimeout(resetTimer);
      return { result: 'QUIZ_QUESTION_OK', passed };
    }, ['cleanQuestionText', 'isQuizVisible', 'getQuizRoot', 'getQuizQuestionText', 'processQuiz'].map(extract).join('\n'));
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
