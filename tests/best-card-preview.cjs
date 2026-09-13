// Offline, no site requests and no card purchases. Run with bundled Playwright + Edge.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const source = fs.readFileSync(path.join(__dirname, '..', 'AnimeSSS_best_card_preview.user.js'), 'utf8');
new vm.Script(source);
const output = path.join(__dirname, '..', 'output', 'best-card-preview');
fs.mkdirSync(output, {recursive:true});
let passed = 0;
function check(value, message) { assert.ok(value, message); passed++; }
const html = `<!doctype html><meta charset="utf-8"><style>body{background:#111;color:#ddd;font:14px Segoe UI;padding:24px}.packs-guarantees,#cv-pack-stats-card{border:1px solid #333;border-radius:12px;padding:24px;margin:16px 0;background:#191919}#cv-stats-btn{padding:10px 16px;margin-top:16px;background:#2c1b23;color:#f4aec5;border:1px solid #a63d61;border-radius:8px;cursor:pointer}.cv-pack-tool-title{display:block}</style><div class="packs-page"><div class="packs-guarantees">Бонусная A на выбор · Гарантированная S</div><div id="cv-pack-stats-card"><div class="cv-pack-tool-body"><strong class="cv-pack-tool-title">Статистика паков</strong><button id="cv-stats-btn">Открыть статистику →</button></div></div><div class="lootbox__row" data-pack-id="1"><button class="lootbox__card cv-best-card">Карта помощника</button></div></div>`;
(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1100,height:980}});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let requests = 0; await page.route('**/*', route => {requests++; return route.abort();});
    async function setup(markup = html, stored = null, failWrite = false) {
      await page.goto('about:blank'); await page.setContent(markup);
      await page.evaluate(({stored, failWrite}) => {
        window.store = stored; window.writes = []; window.statsClicks = 0; window.cardClicks = 0;
        window.GM_getValue = (_, fallback) => window.store ?? fallback;
        window.GM_setValue = (key, value) => { if (failWrite) throw Error('Storage unavailable'); window.store = structuredClone(value); window.writes.push(key); };
        window.GM_registerMenuCommand = (_, fn) => window.menuOpen = fn;
        document.getElementById('cv-stats-btn')?.addEventListener('click', () => window.statsClicks++);
        document.querySelector('.lootbox__card')?.addEventListener('click', () => window.cardClicks++);
      }, {stored, failWrite});
      await page.addScriptTag({content:source});
    }
    const q = s => page.locator('#abcp-modal-host').locator(s);
    async function open() { await page.locator('#abcp-launcher').getByRole('button').click(); }
    async function saved() { return page.evaluate(() => window.store); }
    await setup();
    check(await page.locator('#cv-pack-stats-card #abcp-launcher').count() === 1, 'launcher integrated');
    check(await page.locator('#abcp-preview-card').count() === 0, 'no duplicate fallback');
    check(await page.locator('.cv-pack-tool-title').innerText() === 'Статистика и лучшая карта', 'combined title');
    await page.locator('#cv-stats-btn').click();
    check(await page.evaluate(() => statsClicks) === 1, 'original statistics button untouched');
    await open();
    check(await q('dialog').isVisible(), 'separate modal opens');
    check(await q('#default-view').isVisible() && !await q('#custom-view').isVisible(), 'default explanation only');
    check(await q('#field-rank').isDisabled(), 'hidden settings disabled');
    check(await q('dialog').innerText().then(t => t.includes('не меняются')), 'preview disclaimer');
    await page.screenshot({path:path.join(output,'desktop-default.png')});
    // Switch geometry must match menu: 50x26 track, 20x20 thumb, 3px inset both positions.
    async function geometry() { return q('.slider').evaluate(el => { const r=el.getBoundingClientRect(),p=getComputedStyle(el,':before');return {w:r.width,h:r.height,thumb:parseFloat(p.width),transform:p.transform,pad:parseFloat(getComputedStyle(el).paddingLeft),border:parseFloat(getComputedStyle(el).borderLeftWidth)}; }); }
    let g = await geometry(); check(g.w === 50 && g.h === 26 && g.thumb === 20 && g.pad+g.border === 3, 'switch centered and menu-sized');
    const switchBefore = await q('.slider').boundingBox();
    await q('.toggle').click();
    const switchAfter = await q('.slider').boundingBox();
    check(switchBefore.x === switchAfter.x, 'switch does not shift horizontally between modes');
    check(await q('#custom-view').isVisible() && !await q('#default-view').isVisible(), 'custom fields shown');
    check(await q('.help').count() === 11, 'each of 10 settings and mode has help');
    await q('#field-rank').locator('..').locator('.help').hover();
    check(await q('#tooltip').isVisible(), 'hover tooltip visible');
    check((await q('#tooltip').innerText()).length > 100, 'detailed explanation');
    await page.mouse.move(1,1);
    check(await q('#field-profile, #field-gap, #field-protectRare, #field-wantedBonus, #field-duplicatePenalty, details').count() === 0, 'removed fields and advanced section absent');
    const values = id => q(id+' option').evaluateAll(options => options.map(o => o.value).join(','));
    check(await values('#field-rank') === 'a,ab,highest', 'exact three rank priorities');
    check(await values('#field-unowned') === 'low,always,never', 'exact three availability choices');
    check(await values('#field-duplicates') === 'normal,off', 'only standard or no duplicate penalty');
    check(await q('label[for=field-unowned]').innerText() === 'Нет в наличии', 'availability renamed');
    check(await q('#field-wanted option').allTextContents().then(v => v.join('|') === 'Обычный бонус (+15)|Усиленный бонус (+30)|Не в приоритете (+0)'), 'fixed wanted bonuses displayed');
    check(await q('.help').evaluateAll(items => items.every(el => el.dataset.help.length <= 210)), 'all hints kept short');
    await q('#field-wanted').selectOption('off');
    await q('#field-rank').selectOption('ab');
    await q('#field-unowned').selectOption('always');
    await q('#field-tie').selectOption('random');
    await q('#field-demandGap').fill('70'); await q('#field-demandGap').press('Tab');
    await q('.toggle').click(); await q('.toggle').click();
    check(await q('#field-demandGap').inputValue() === '70', 'mode preserves draft');
    await q('.primary').click();
    check((await saved()).demandGap === 70 && (await saved()).custom, 'settings saved separately');
    check((await saved()).rank === 'ab' && (await saved()).tie === 'random', 'new choices persisted');
    check((await saved()).wanted === 'off', 'zero bonus choice persists');
    check(await page.evaluate(() => writes.every(k => k === 'abcp_settings_v1')), 'only private key touched');
    await q('#field-demandGap').fill('25'); await q('.cancel').click(); await open();
    check(await q('#field-demandGap').inputValue() === '70', 'cancel discards unsaved edits');
    await q('.reset').click(); await q('.cancel').click(); await open();
    check(await q('#field-demandGap').inputValue() === '70', 'reset draft cancelled');
    await q('.reset').click(); await q('.primary').click();
    check((await saved()).demandGap === 40 && (await saved()).custom, 'reset saved without changing selected mode');
    check((await saved()).unowned === 'low', 'availability defaults to low value');
    await q('#field-demandA').uncheck();
    check(await q('#field-demandGap').isDisabled(), 'dependent demand field disabled');
    await q('#field-weak').uncheck();
    check(await q('#field-weakThreshold').isEnabled(), 'low-value availability still needs threshold');
    await q('#field-unowned').selectOption('never');
    check(await q('#field-weakThreshold').isDisabled(), 'unused threshold disabled');
    await q('#field-weak').check();
    await q('#field-wanted').selectOption('strong');
    await q('#field-duplicates').selectOption('off');
    await q('#field-weakThreshold').fill('101'); await q('.primary').click();
    check((await saved()).weakThreshold === 10, 'invalid input not saved');
    await q('#field-weakThreshold').fill('20'); await q('#field-tie').selectOption('random'); await q('.primary').click();
    const persisted = await saved(); check(persisted.weakThreshold === 20, 'valid threshold saved');
    check(persisted.protectRare === true, 'safety is mandatory');
    await q('.body').evaluate(el => el.scrollTop = 0);
    await page.screenshot({path:path.join(output,'desktop-custom.png')});
    check(await page.locator('.lootbox__card').getAttribute('class') === 'lootbox__card cv-best-card', 'helper card highlight untouched');
    check(await page.evaluate(() => cardClicks) === 0, 'no card clicks');
    await page.keyboard.press('Escape'); check(!await q('dialog').isVisible(), 'escape closes dialog');
    await setup(html, persisted); await open();
    check(await q('#field-wanted').inputValue() === 'strong', 'settings survive reload');
    await q('.close').click();
    // Helper disabled/re-enabled: launcher falls back, and existing statistics handlers remain owned by helper.
    await page.locator('#cv-pack-stats-card').evaluate(el => el.remove());
    await page.waitForSelector('#abcp-preview-card');
    check(await page.locator('#abcp-launcher').count() === 1, 'fallback without duplicates');
    await page.evaluate(() => document.querySelector('.packs-page').insertAdjacentHTML('beforeend','<div id="cv-pack-stats-card"><div class="cv-pack-tool-body"><strong class="cv-pack-tool-title">Статистика паков</strong><button id="cv-stats-btn">Статистика</button></div></div>'));
    await page.waitForSelector('#cv-pack-stats-card #abcp-launcher');
    check(await page.locator('#abcp-preview-card').count() === 0, 'late helper installation');
    await page.addScriptTag({content:source});
    check(await page.locator('#abcp-modal-host').count() === 1, 'double initialization guarded');
    await setup('<div class="packs-page"><div class="packs-guarantees">Гаранты</div></div>', null, true);
    await open(); await q('.primary').click();
    check((await q('.feedback').innerText()).includes('Не удалось сохранить'), 'storage write failure reported');
    check(await q('dialog').isVisible(), 'draft kept on write failure');
    await setup(html, {custom:true, gap:-99, profile:'invalid', rank:'value', wanted:'first', wantedBonus:99, duplicatePenalty:20, duplicates:'strong', protectRare:false, unowned:'close'});
    await open();
    check(await q('#field-rank').inputValue() === 'a' && await q('#field-duplicates').inputValue() === 'normal', 'obsolete choices normalized');
    check(await q('#field-unowned').inputValue() === 'low', 'legacy close migrates to low');
    check(await q('#field-wanted').inputValue() === 'off', 'replaced third choice migrates to zero bonus');
    await q('.primary').click();
    check((await saved()).protectRare === true, 'legacy disabled safety cannot persist');
    const clean = await saved();
    check(['profile','gap','wantedBonus','duplicatePenalty'].every(k => !(k in clean)), 'removed fields dropped from saved settings');
    for (const [legacy, modern] of [['first','always'],['off','never']]) {
      await setup(html, {custom:true, unowned:legacy}); await open();
      check(await q('#field-unowned').inputValue() === modern, 'migrate '+legacy);
    }
    // Mobile layout and touch help.
    await page.setViewportSize({width:390,height:844});
    await q('#field-rank').locator('..').locator('.help').click();
    check(await q('#tooltip').isVisible(), 'tap help visible');
    const tooltip = await q('#tooltip').boundingBox();
    check(tooltip.x >= 0 && tooltip.x+tooltip.width <= 390, 'tooltip stays inside viewport');
    await q('#field-rank').focus(); await q('.body').evaluate(el => el.scrollTop = 0);
    const dims = await q('dialog').evaluate(el => ({scroll:el.scrollWidth,client:el.clientWidth,rect:el.getBoundingClientRect().toJSON()}));
    check(dims.scroll === dims.client && dims.rect.x >= 0 && dims.rect.right <= 390, 'mobile no horizontal overflow');
    const footer = await q('footer').boundingBox(); check(footer.y+footer.height <= 844, 'footer reachable');
    await page.screenshot({path:path.join(output,'mobile-custom.png')});
    await q('.toggle').click(); await page.screenshot({path:path.join(output,'mobile-default.png')});
    await page.setViewportSize({width:320,height:640});
    check(await q('dialog').evaluate(el => el.scrollWidth === el.clientWidth && el.getBoundingClientRect().right <= 320), '320px no horizontal overflow');
    await q('.toggle').click();
    check(await q('.mode').evaluate(el => el.scrollWidth === el.clientWidth), '320px mode labels fit');
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('suite-best-card-integrated'));
      const button=document.createElement('button');button.id='cv-best-settings-btn';button.textContent='Main settings';document.body.append(button);
    });
    check(await page.locator('#abcp-modal-host,#abcp-launcher,#abcp-preview-card').count()===0,'preview yields to integrated helper');
    await page.addScriptTag({content:source});
    check(await page.locator('#abcp-modal-host').count()===0,'preview skips already integrated helper');
    check(requests === 0, 'no network requests');
    check(errors.length === 0, 'no runtime errors: '+errors.join('; '));
    console.log(`PASS ${passed} checks; screenshots: ${output}`);
  } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exitCode=1;});
