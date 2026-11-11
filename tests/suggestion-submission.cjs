const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const source = fs.readFileSync(path.join(__dirname, '..', 'AnimeSSS_help.user.js'), 'utf8');
const watch = source.slice(source.indexOf('  function watchSuggestionSubmissions('), source.indexOf('  function cleanupSuggestionAuthors('));
assert.ok(watch.startsWith('  function watchSuggestionSubmissions('));

(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    async function open(route, flash='') {
      const page = await browser.newPage();
      await page.route('**/*', request => request.fulfill({
        contentType:'text/html; charset=utf-8',
        body:'<!doctype html><body>' + (flash ? '<div class="message-info__content">'+flash+'</div>' : '') + '</body>'
      }));
      await page.goto('https://animesss.tv'+route);
      await page.evaluate(code => {
        window.hints = [];
        window.suiteGetCurrentUserName = () => 'Тест';
        window.suiteTelemetryLog = () => {};
        window.GM_xmlhttpRequest = request => {
          hints.push({url:request.url, method:request.method, anonymous:request.anonymous, data:JSON.parse(request.data)});
          request.onload({status:202,responseText:'{"ok":true,"queued":true}'});
        };
        eval(code + '\nwatchSuggestionSubmissions();');
      }, watch);
      return page;
    }

    const create = await open('/cards/create/3511/');
    await create.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="DLEPush-notification"><button>×</button><div class="DLEPush-message">Карточка не отправлена на модерацию</div></div>' +
        '<div class="DLEPush-notification"><button>×</button><div class="DLEPush-message">Загруженная вами карточка была отправлена на модерацию!</div></div>' +
        '<div class="cpt-toast"><span>Модерация</span><div class="cpt-sub">Карточка отправлена на модерацию</div></div>');
    });
    await create.waitForFunction(() => hints.length > 0);
    assert.deepEqual(await create.evaluate(()=>hints),[{
      url:'https://predlojka-o4s8.onrender.com/api/submission-hints',method:'POST',anonymous:true,data:{nick:'Тест',kind:'created'}
    }]);
    await create.close();

    const replace = await open('/cards/replace_art/105676/');
    await replace.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="cpt-toast"><span>Заявка</span><div class="cpt-sub"></div></div>');
      document.querySelector('.cpt-sub').textContent = 'Заявка на замену арта отправлена на модерацию.';
    });
    await replace.waitForFunction(() => hints.length > 0);
    assert.deepEqual(await replace.evaluate(()=>hints.map(hint=>hint.data)),[{nick:'Тест',kind:'replacement',cardId:'105676'}]);
    await replace.close();

    const redirected = await open('/user/Тест/cards_created/', 'Карточка отправлена на модерацию');
    assert.deepEqual(await redirected.evaluate(()=>hints.map(hint=>hint.data)),[{nick:'Тест',kind:'created'}]);
    await redirected.close();
    console.log('SUGGESTION_SUBMISSION_OK: creation, replacement, duplicate notification, error text and redirect');
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
