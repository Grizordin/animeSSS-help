const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const source = fs.readFileSync(path.join(__dirname, '..', 'AnimeSSS_help.user.js'), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
}
const layout = section('  const suiteViewportItems', '  const observedContainers');
const suggestion = section('    function setupDraggableSuggestionButton', '    function lockModalScroll');
const loot = section('        function installPanelDrag', '        function startPanelTicker');
const fixture = `<!doctype html><style>
  button,article { box-sizing:border-box;position:fixed;width:110px;height:42px;margin:0 }
  #aw-active-tab-panel {width:150px;height:80px;left:12px;bottom:80px}
  #suite-suggestion-authors-button {right:18px;bottom:18px}
  #suite-settings-btn {left:12px;top:12px}
  .aw-head {height:35px}
</style><button id="suite-settings-btn">Settings</button>
<article id="aw-active-tab-panel"><div class="aw-head">Loot</div></article>
<button id="suite-suggestion-authors-button">Suggestion</button>`;
const cacheKey = 'suite_suggestion_authors_cache_v1';
const positionKey = 'aw_active_tab_panel_position_v2';
const storedLoot = {left:'680px',top:'405px'};
const storedButton = {x:540,bottom:34};

(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1000,height:650}});
    await page.route('**/*', route => route.fulfill({contentType:'text/html',body:fixture}));
    await page.goto('https://fixture.invalid/');
    await page.evaluate(({cacheKey,positionKey,storedLoot,storedButton}) => {
      localStorage.setItem(cacheKey,JSON.stringify({suggestionButtonPosition:storedButton}));
      localStorage.setItem(positionKey,JSON.stringify(storedLoot));
    },{cacheKey,positionKey,storedLoot,storedButton});
    const mount = () => page.evaluate(`(async () => {
      window.writes=[]; window.opens=0;
      const CACHE_KEY='${cacheKey}', PANEL_POSITION_KEY='${positionKey}';
      const gmStoreGet=(k,d)=>JSON.parse(localStorage.getItem(k)) ?? d;
      const gmStoreSet=(k,v)=>{writes.push(k);localStorage.setItem(k,JSON.stringify(v))};
      const GM_getValue=gmStoreGet,GM_setValue=gmStoreSet;
      const loadCache=()=>gmStoreGet(CACHE_KEY,{}),saveCache=v=>gmStoreSet(CACHE_KEY,v);
      const on=(target,type,fn,opts)=>target.addEventListener(type,fn,opts),openModal=()=>window.opens++;
      let panelDragAbortController=null;
      ${layout}
      ${suggestion}
      ${loot}
      const button=document.querySelector('#suite-suggestion-authors-button');
      const panel=document.querySelector('#aw-active-tab-panel');
      panel._suitePersistFloatingPosition=()=>GM_setValue(PANEL_POSITION_KEY,{left:panel.style.left,top:panel.style.top});
      suiteKeepInViewport(document.querySelector('#suite-settings-btn'),{margin:8,constrainSize:false});
      setupDraggableSuggestionButton(button);
      installPanelDrag(panel);
      await applyPanelPosition(panel);
      suiteKeepInViewport(panel);
      window.layoutNow=suiteRefreshViewportItems;
      window.layoutNow();
    })()`);
    const rect = id => page.locator(id).evaluate(el=>{
      const r=el.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y)};
    });
    const positions = async () => [await rect('#suite-suggestion-authors-button'),await rect('#aw-active-tab-panel')];
    const button = page.locator('#suite-suggestion-authors-button');
    const update = () => page.evaluate(()=>window.layoutNow());
    await mount();
    const initial = await positions();
    assert.deepEqual(initial,[{x:540,y:574},{x:680,y:405}]);
    await page.evaluate(()=>{const s=document.querySelector('#suite-settings-btn');s.style.left='540px';s.style.top='574px';});
    await update();
    assert.notDeepEqual(await rect('#suite-suggestion-authors-button'), initial[0]);
    assert.deepEqual(await page.evaluate(()=>writes),[], 'overlap must not write positions');
    await button.click();
    assert.equal(await page.evaluate(()=>opens),1);
    assert.deepEqual(await page.evaluate(()=>writes),[], 'click must not save temporary coordinates');
    await page.locator('#suite-settings-btn').evaluate(e=>e.style.display='none');
    await update();
    assert.deepEqual(await positions(),initial,'recover after an obstruction closes');
    await page.setViewportSize({width:360,height:280});await update();
    for(const {x,y} of await positions()) assert.ok(x>=0 && y>=0 && x<360 && y<280);
    await page.setViewportSize({width:1000,height:650});await update();
    assert.deepEqual(await positions(),initial,'recover after shrinking/restoring the window');
    await page.mouse.move(700,421);await page.mouse.down();await page.mouse.move(450,160,{steps:4});
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await page.mouse.up();
    assert.deepEqual(await positions(),initial,'interrupted drag returns to the last chosen position');
    assert.deepEqual(await page.evaluate(()=>writes),[]);
    await page.mouse.move(700,421);await page.mouse.down();await page.mouse.move(450,160,{steps:4});
    await page.setViewportSize({width:2,height:2});
    await page.waitForFunction(()=>innerWidth===2 && document.querySelector('.aw-head').style.cursor==='grab');
    await page.mouse.up();
    await page.setViewportSize({width:1000,height:650});await update();
    assert.deepEqual(await positions(),initial,'size change without a hide event cancels the drag');
    assert.deepEqual(await page.evaluate(()=>writes),[]);
    for(const [selector,x,y] of [['#suite-suggestion-authors-button',310,350],['.aw-head',440,95]]){
      const r=await rect(selector);
      await page.mouse.move(r.x+12,r.y+12);await page.mouse.down();
      if(selector==='#suite-suggestion-authors-button'){
        await button.evaluate(el=>{
          window.suggestionSizeReads=0;
          for(const property of ['offsetWidth','offsetHeight']){
            const original=Object.getOwnPropertyDescriptor(HTMLElement.prototype,property);
            Object.defineProperty(el,property,{configurable:true,get(){
              window.suggestionSizeReads++;
              return original.get.call(this);
            }});
          }
        });
      }
      await page.mouse.move(x+12,y+12,{steps:5});
      if(selector==='#suite-suggestion-authors-button'){
        assert.deepEqual(await rect(selector),{x,y},'the suggestion button follows the pointer during a drag');
        assert.equal(await page.evaluate(()=>window.suggestionSizeReads),0,'drag movement reuses its initial dimensions');
        assert.deepEqual(await page.evaluate(()=>writes),[],'dragging does not persist temporary coordinates');
        assert.ok(await button.evaluate(el=>el.classList.contains('suite-transform-drag') && el.style.transform.startsWith('translate3d(')));
      }
      await page.mouse.up();
    }
    assert.deepEqual(await positions(),[{x:310,y:350},{x:440,y:95}]);
    assert.equal(await page.evaluate(()=>opens),1,'drag is not a click');
    assert.equal(await page.evaluate(()=>writes.length),2,'one write per completed drag');
    await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({cards:[]})),cacheKey);
    await page.setViewportSize({width:300,height:240});await page.reload();await mount();
    await page.setViewportSize({width:1000,height:650});await update();
    assert.deepEqual(await positions(),[{x:310,y:350},{x:440,y:95}],'small startup and stale card cache preserve both drops');
    assert.deepEqual(await page.evaluate(()=>writes),[]);
    const touch=await page.context().newCDPSession(page);
    await touch.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    const touchAt=(type,x,y)=>touch.send('Input.dispatchTouchEvent',{type,touchPoints:x===undefined?[]:[{x,y}]});
    await touchAt('touchStart',330,368);await touchAt('touchEnd');
    assert.equal(await page.evaluate(()=>opens),1,'touch tap opens the suggestion window once');
    assert.deepEqual(await page.evaluate(()=>writes),[]);
    await touchAt('touchStart',330,368);await touchAt('touchMove',230,188);await touchAt('touchCancel');
    assert.deepEqual(await rect('#suite-suggestion-authors-button'),{x:310,y:350},'cancelled touch does not commit');
    await touchAt('touchStart',330,368);await touchAt('touchMove',230,188);await touchAt('touchEnd');
    assert.deepEqual(await rect('#suite-suggestion-authors-button'),{x:210,y:170});
    assert.equal(await page.evaluate(()=>opens),1);
    assert.equal(await page.evaluate(()=>writes.length),1);
    console.log('FLOATING_POSITIONS_OK');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
