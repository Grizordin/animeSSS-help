// Local browser fixtures with mocked native shop handlers; no live game requests.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');new vm.Script(source);
const moduleCode=source.slice(source.indexOf('  // BEGIN LABYRINTH SHOP ROLL'),source.indexOf('  // END LABYRINTH SHOP ROLL'));
const css=source.match(/globalStyle\.textContent = `([\s\S]*?)`;/)[1];
function extract(name){
 const match=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(source);if(!match)throw Error(name);
 const lines=source.slice(match.index).split(/\r?\n/);
 for(let n=2;n<=lines.length;n++)if(lines[n-1]===match[1]+'}'){
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }throw Error(name);
}
const neonCode=['insertNeonGradients','addNeonToCard','clearNeonFromCard','getNeonCardType','applyNeonToCard','handleNeonEntry','setupNeonObservers','syncTradeWantNeon','isPackCard','cleanupNeonUi','applyNeonAnimationSetting'].map(extract).join('\n');
let checks=0;function check(value,message){assert.ok(value,message);checks++;}
function card(kind,amount,id=1,extra=''){
 const special=kind==='exp'||kind==='brick';
 return `<div class="accshop__card ${special?'accshop__card--special accshop__card--'+kind:''} ${extra}"><div class="accshop__card-name">${kind==='exp'?'Опыт пользователя':kind==='brick'?'Небесный кирпич':'Карта'}</div><div class="accshop__card-rank">${special?'Будет начислено: +'+amount+(kind==='exp'?' опыта':' шт.'):'Ранг: a'}</div><div class="accshop__card-price">${special?'2&nbsp;500':'35'} AСС</div><button ${special?'data-slot':'data-card-id'}="${id}" class="${special?'accshop__buy-special-btn':'accshop__buy-btn'}" disabled>Не хватает АСС</button></div>`;
}
const baseOptions={exp:true,expMin:400,brick:false,brickMin:2644,wishlist:true};
let browser;
async function fixture({initial=card('exp',100),options={},balance=62,price=3,responses=[],mode='fetch',delay=60,fastTimeout=false,store={},origin='https://fixture.invalid'}={}){
 const page=await browser.newPage();
 await page.route('**/*',route=>{
  if(route.request().isNavigationRequest())return route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><html><head><meta charset="utf-8"></head><body><div class="accshop accshop--redesign"><div class="accshop__actions"><span id="accshopBalance">${balance}</span><button id="accshopRerollBtn">Обновить витрину <span id="accshopRerollPrice">${price}</span></button></div><div id="accshopCardsWrap">${initial}</div><div data-accshop-notice hidden></div></div></body></html>`});
  const url=new URL(route.request().url());
  if(url.pathname==='/index.php')return route.fulfill({contentType:'text/html; charset=utf-8',body:JSON.stringify(responses[0]||{})});
  return route.abort();
 });
 await page.goto(origin+'/accshop/');
 await page.evaluate(({options,responses,mode,delay,fastTimeout,store,css})=>{
  const storage={...store,suite_shop_roll_settings_v1:{...options}};
  window.cfg={modLabyrinthShop:true,modNeon:true,modNeonAnimation:false};
  window.logs=[];window.storage=storage;window.GM_getValue=(k,d)=>storage[k]??d;
  window.GM_setValue=(k,v)=>{storage[k]=structuredClone(v);};window.GM_deleteValue=k=>delete storage[k];window.GM_listValues=()=>Object.keys(storage);
  window.gmStoreGet=GM_getValue;window.gmStoreSet=GM_setValue;
  window.getPageWindow=()=>window;window.suiteTelemetryLog=(module,event,data,level)=>logs.push({module,event,data:structuredClone(data),level});
  window.nativeCalls=[];window.identityPreserved=true;window.siteConsumed=0;window.purchases=0;
  const timer=window.setTimeout;
  if(fastTimeout)window.setTimeout=(fn,ms,...args)=>timer(fn,ms===20000?350:ms,...args);
  let responseIndex=0;
  window.fetch=function(){
   const entry=responses[Math.min(responseIndex++,responses.length-1)]||{};
   if(entry.networkError){window.nativePromise=Promise.reject(new TypeError('mock network error'));return nativePromise;}
   const body=entry.raw??JSON.stringify(entry);
   window.nativePromise=new Promise(resolve=>timer(()=>resolve(new Response(body,{status:entry.httpStatus||200,headers:{'Content-Type':'text/html; charset=utf-8'}})),delay));
   return nativePromise;
  };
  document.getElementById('accshopRerollBtn').addEventListener('click',async event=>{
   const button=event.currentTarget;
   nativeCalls.push({at:Date.now(),balance:document.getElementById('accshopBalance').textContent});
   if(mode==='no-request')return;
   button.disabled=true;button.setAttribute('aria-disabled','true');document.querySelector('.accshop').dataset.accshopBusy='reroll';
   const apply=result=>{
    siteConsumed++;
    if(!result.noUI){
     if(result.success){document.getElementById('accshopCardsWrap').innerHTML=result.cards_html;document.getElementById('accshopBalance').textContent=result.balance;document.getElementById('accshopRerollPrice').textContent=result.reroll_price;}
     button.disabled=false;button.setAttribute('aria-disabled','false');delete document.querySelector('.accshop').dataset.accshopBusy;
    }
   };
   if(mode==='xhr'){
    const xhr=new XMLHttpRequest();xhr.open('POST','/index.php?controller=ajax&mod=animesss_game_shop');
    xhr.onload=()=>apply(JSON.parse(xhr.responseText));xhr.send('action=reroll&user_hash=secret_fixture_hash');return;
   }
   try{
    const promise=fetch('/index.php?controller=ajax&mod=animesss_game_shop',{method:'POST',body:'action=reroll&user_hash=secret_fixture_hash'});
    identityPreserved=identityPreserved&&promise===nativePromise;
    const result=await (await promise).json();timer(()=>apply(result),30);
   }catch{}
  });
  document.addEventListener('click',e=>{if(e.target.matches('.accshop__buy-btn,.accshop__buy-special-btn'))purchases++;});
  const style=document.createElement('style');style.textContent=css;document.head.append(style);
 },{options:{...baseOptions,...options},responses,mode,delay,fastTimeout,store,css});
 await page.addScriptTag({content:moduleCode+'\ninitLabyrinthShopRoll();'});
 return page;
}
const state=page=>page.evaluate(()=>({calls:nativeCalls.length,logs,status:document.querySelector('[data-shop-status]')?.textContent,storage,identityPreserved,siteConsumed,purchases}));
const start=page=>page.locator('#suite-shop-roll .suite-toggle').click();
const stopped=page=>page.waitForFunction(()=>{
 const toggle=document.querySelector('[data-shop-toggle]');
 return !toggle.checked&&!toggle.disabled||document.querySelector('[data-shop-status]').textContent.includes('Результат не подтверждён');
},{},{timeout:5000});
async function scenario(options,run){const page=await fixture(options);try{await run(page);}finally{await page.close();}}
(async()=>{
 browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  await scenario({},async page=>{
   await page.waitForTimeout(250);check((await state(page)).calls===0,'enabling does not start automation');
   check(await page.getByRole('switch',{name:'Ролл магазина',exact:true}).count()===1,'one accessible run switch');
   check(await page.locator('[data-shop-start],[data-shop-stop]').count()===0,'separate run buttons removed');
   const parsed=await page.evaluate(html=>suiteShopOffers(new DOMParser().parseFromString(html,'text/html')),card('brick',2644)+card('exp',497,2)+card('card',0,3,'is-wishlist-card'));
   check(parsed[0].amount===2644&&parsed[0].kind==='brick','supplied brick format');check(parsed[1].amount===497,'experience parsed');
   check(parsed[2].wanted.includes('is-wishlist-card'),'assumed native wishlist marker');
   check(await page.evaluate(()=>suiteShopNumber('2\u00a0644')===2644&&suiteShopNumber('')===null&&suiteShopNumber('4x')===null),'strict numeric parser');
   await page.locator('[data-shop-settings]').click();await page.locator('[data-shop-option="expMin"]').fill('425');await page.locator('[data-shop-option="expMin"]').dispatchEvent('change');
   check((await state(page)).storage.suite_shop_roll_settings_v1.expMin===425,'threshold saved');
   await page.evaluate(()=>{initLabyrinthShopRoll();initLabyrinthShopRoll();});check(await page.locator('#suite-shop-roll').count()===1,'idempotent module install');
  });
  await scenario({initial:card('exp',450)},async page=>{
   await page.getByRole('switch',{name:'Ролл магазина',exact:true}).press('Space');await stopped(page);
   check((await state(page)).calls===0,'keyboard switch respects initial matching showcase');
  });
  await scenario({initial:card('exp',497)},async page=>{await start(page);await stopped(page);const s=await state(page);check(s.calls===0&&s.status.includes('497'),'current desired offer stops before spending');});
  await scenario({initial:card('brick',2644),balance:3,options:{brick:true,exp:false,wishlist:false}},async page=>{await start(page);await stopped(page);const s=await state(page);check(s.calls===0&&s.status.includes('2644'),'inclusive brick threshold despite unaffordable purchase');});
  for(const extra of ['is-wishlist-card','anime-cards__owned-by-user-want'])await scenario({initial:card('card',0,7,extra)},async page=>{
   await page.evaluate(()=>document.querySelector('.accshop__card').hidden=true);
   await start(page);await stopped(page);check((await state(page)).calls===0,'hidden wishlist condition stops independently: '+extra);
  });
  await scenario({initial:card('card',0,7).replace('Карта</div>','Карта</div><small class="accshop__wish-label">В вашем списке желаний</small>')},async page=>{await start(page);await stopped(page);const s=await state(page);check(s.calls===0,'wishlist label recognized '+JSON.stringify(s));});
  await scenario({initial:card('card',0,7).replace('Карта</div>','Карта</div><span title="Хотят получить: 400"><i class="fal fa-sign-in-alt"></i>400</span>'),balance:0},async page=>{await start(page);await stopped(page);const s=await state(page);check(s.calls===0&&!s.logs.some(e=>e.event==='shop_roll_match'),'public demand is not personal wishlist');});
  await scenario({options:{exp:false,brick:false,wishlist:false}},async page=>{await start(page);check((await state(page)).calls===0&&await page.locator('[data-shop-options]').isVisible(),'no conditions means no requests');});
  await scenario({responses:[{success:true,balance:59,reroll_price:3,cards_html:card('exp',399)},{success:true,balance:56,reroll_price:3,cards_html:card('exp',400)}]},async page=>{
   await start(page);await stopped(page);const s=await state(page);
   check(s.calls===2&&s.status.includes('Найден опыт: 400'),'continue below threshold and stop on equality');
   check(s.identityPreserved&&s.siteConsumed===2,'native fetch promise and body preserved');
   check(await page.locator('[data-shop-spent]').textContent()==='6','actual confirmed update costs');check(s.purchases===0,'no purchases');
   check(!await page.getByRole('switch',{name:'Ролл магазина',exact:true}).isChecked(),'match resets run switch');
   check(await page.locator('[data-shop-rolls]').textContent()==='2','confirmed updates displayed separately');
   check(await page.evaluate(()=>nativeCalls[1].at-nativeCalls[0].at>=995),'one-second minimum between native clicks');
   check(!JSON.stringify(s.logs).includes('secret_fixture_hash'),'telemetry has no request hash');
  });
  await scenario({mode:'xhr',responses:[{success:true,balance:59,reroll_price:3,cards_html:card('card',0,7,'is-wishlist-card')}]},async page=>{await start(page);await stopped(page);const s=await state(page);check(s.calls===1&&s.siteConsumed===1&&s.status.includes('Найдена карта'),'real XHR JSON with text/html header');});
  for(const response of [{success:false,text:'Слишком часто'},{raw:'broken json'},{httpStatus:429,success:false},{networkError:true}])await scenario({responses:[response]},async page=>{
   await start(page);await stopped(page);check((await state(page)).calls===1,'refusal or uncertain network result never blindly retried');
  });
  await scenario({fastTimeout:true,mode:'no-request'},async page=>{await start(page);await stopped(page);const s=await state(page);check(s.calls===1&&s.status.includes('Результат не подтверждён'),'missing capture times out safely');check(s.storage.suite_shop_roll_uncertain_until_v1>Date.now(),'uncertainty cooldown shared across origins');});
  await scenario({fastTimeout:true,responses:[{success:true,balance:59,reroll_price:3,cards_html:card('exp',450),noUI:true}]},async page=>{await start(page);await stopped(page);check((await state(page)).calls===1&&(await state(page)).status.includes('Результат не подтверждён'),'server success without rendered UI does not continue');});
  await scenario({balance:3,responses:[{success:true,balance:0,reroll_price:3,cards_html:card('exp',399)}]},async page=>{await start(page);await stopped(page);check((await state(page)).calls===1&&(await state(page)).status.includes('Не хватает'),'stop when currency exhausted');});
  await scenario({responses:[{success:true,balance:59,reroll_price:4,cards_html:card('exp',399)},{success:true,balance:55,reroll_price:4,cards_html:card('exp',450)}]},async page=>{await start(page);await stopped(page);check(await page.locator('[data-shop-spent]').textContent()==='7','updated reroll price used for next click');});
  await scenario({delay:250,responses:[{success:true,balance:59,reroll_price:3,cards_html:card('exp',300)}]},async page=>{
   await start(page);await page.waitForFunction(()=>nativeCalls.length===1);await page.locator('#suite-shop-roll .suite-toggle').click();
   check(await page.locator('[data-shop-toggle]').isDisabled(),'stop does not allow overlapping restart');
   check(Object.keys((await state(page)).storage).some(k=>k.startsWith('suite_shop_roll_claim_v1:')),'claim held during pending stop');
   await stopped(page);check((await state(page)).calls===1,'manual stop prevents next click');
   check(!Object.keys((await state(page)).storage).some(k=>k.startsWith('suite_shop_roll_claim_v1:')),'claim released after pending result');
  });
  await scenario({delay:250,responses:[{success:true,balance:59,reroll_price:3,cards_html:card('exp',300)}]},async page=>{
   await start(page);await page.waitForFunction(()=>nativeCalls.length===1);
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
   await stopped(page);check((await state(page)).calls===1,'hidden tab cannot send next update');
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
   await page.waitForTimeout(150);check((await state(page)).calls===1,'becoming visible does not restart manually stopped run');
  });
  await scenario({store:{'suite_shop_roll_claim_v1:other-domain':{token:'other',ticket:1,choosing:false,until:Date.now()+30000}}},async page=>{
   await start(page);await stopped(page);check((await state(page)).calls===0&&(await state(page)).status.includes('другой вкладке'),'GM claim from another domain blocks writer');
  });
  await scenario({delay:300,responses:[{success:true,balance:59,reroll_price:3,cards_html:card('exp',300)}]},async page=>{
   const original=await page.evaluate(()=>__suiteShopCaptureV1.sequence);
   await start(page);await page.waitForFunction(()=>nativeCalls.length===1);
   await page.evaluate(()=>{cleanupLabyrinthShopRoll();initLabyrinthShopRoll();});
   check(await page.evaluate(()=>__suiteShopCaptureV1.listeners.size===2),'old in-flight observer survives module reenable');
   await page.waitForFunction(()=>__suiteShopCaptureV1.listeners.size===1);
   check((await state(page)).calls===1,'disable and reenable do not trigger another update');
   check(await page.evaluate(()=>__suiteShopCaptureV1.sequence)===original+1,'no duplicate network capture after reenable');
   check(!Object.keys((await state(page)).storage).some(k=>k.startsWith('suite_shop_roll_claim_v1:')),'disabled run releases claim when server responds');
  });
  await scenario({initial:card('exp',300)},async page=>{
   await page.addScriptTag({content:`let neonObserver,neonMutationObserver;let neonObservedSet=new WeakSet(),neonStateMap=new WeakMap(),tradeWantNeonState=new WeakMap();${neonCode}\ninsertNeonGradients();applyNeonAnimationSetting();setupNeonObservers();`});
   await page.evaluate(html=>{document.getElementById('accshopCardsWrap').innerHTML=html;},card('card',0,5,'is-wishlist-card')+card('card',0,6).replace('Карта</div>','Карта</div><div class="accshop__card-metrics"><span aria-label="Дубли на руках: 1">1</span></div>')+card('exp',497));
   await page.waitForFunction(()=>document.querySelector('.cv-neon-green')&&document.querySelector('.cv-neon-orange'));
   check(true,'new native cards get wishlist green and duplicate orange');
   check(await page.locator('.accshop__card--special.cv-neon-outline').count()===0,'special rewards do not receive card outline');
   await page.waitForTimeout(100);
   const perf=await page.evaluate(async()=>{
    let changes=0,scans=0;const obs=new MutationObserver(m=>changes+=m.length);obs.observe(document.querySelector('.accshop'),{subtree:true,childList:true,attributes:true,characterData:true});
    const original=document.querySelectorAll;document.querySelectorAll=function(selector){if(selector.includes('.accshop__card'))scans++;return original.call(this,selector);};
    const unrelated=document.createElement('aside');document.body.append(unrelated);for(let i=0;i<100;i++)unrelated.append(document.createElement('span'));
    await new Promise(r=>setTimeout(r,150));document.querySelectorAll=original;obs.disconnect();return{changes,scans};
   });
   check(perf.changes===0,'idle shop and neon produce no repeated DOM writes');check(perf.scans===0,'unrelated mutations do not rescan page cards');
   for(const width of [360,1280]){
    await page.setViewportSize({width,height:900});await page.locator('[data-shop-settings]').click();
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'shop panel fits viewport '+width);
   }
   await page.evaluate(()=>{cfg.modNeon=false;cleanupNeonUi();});check(await page.locator('.cv-neon-outline').count()===0,'neon disable removes shop outlines');
   await page.evaluate(()=>{cleanupLabyrinthShopRoll();initLabyrinthShopRoll();});check(await page.locator('#suite-shop-roll').count()===1,'shop disable and reenable mounted once');
   const capture=await page.evaluate(()=>({listeners:__suiteShopCaptureV1.listeners.size,sequence:__suiteShopCaptureV1.sequence}));check(capture.listeners===1,'capture ownership reused after reenable');
  });
  if(process.env.SHOP_SCREENSHOTS){
   const page=await fixture({initial:card('exp',100)});
   try{
    const out=path.join(__dirname,'..','output','shop-roll-preview');fs.mkdirSync(out,{recursive:true});
    const nativeCss=path.join(out,'site-shop.css');
    if(fs.existsSync(nativeCss))await page.addStyleTag({content:fs.readFileSync(nativeCss,'utf8')});
    await page.addStyleTag({content:'body{margin:0;padding:24px;font-family:Manrope,Arial,sans-serif;background:var(--bg);color:var(--tt)}'});
    await page.locator('[data-shop-settings]').click();
    for(const [theme,width] of [['light',1100],['dark',1100],['light',360],['dark',360]]){
     await page.setViewportSize({width,height:900});
     await page.evaluate(theme=>{
      document.body.className=theme==='dark'?'dt-is-active':'';
      const colors=theme==='dark'?{'--bg':'#1c1a21','--bg-2':'#25222b','--tt':'#f0eaf0','--tt-2':'#b7acb8','--bdc':'#3d3441'}:{'--bg':'#fff','--bg-2':'#f7f5f8','--tt':'#30283b','--tt-2':'#736b7b','--bdc':'#e5dfe9'};
      for(const [name,value] of Object.entries(colors))document.body.style.setProperty(name,value);
     },theme);
     check(await page.locator('#suite-shop-roll').evaluate(e=>e.scrollWidth<=e.clientWidth&&e.getBoundingClientRect().right<=innerWidth),'native themed panel fits '+theme+' '+width);
     await page.locator('#suite-shop-roll').screenshot({path:path.join(out,theme+'-'+width+'.png')});
    }
    await page.setViewportSize({width:1100,height:900});
    await page.locator('[data-shop-settings]').click();
    check(!await page.locator('[data-shop-options]').isVisible(),'compact panel hides settings by default control');
    await page.locator('#suite-shop-roll').screenshot({path:path.join(out,'dark-collapsed.png')});
   }finally{await page.close();}
  }
  check(source.includes("makeToggle('modLabyrinthShop'")&&source.includes("suiteStartModule('shop_roll'"),'settings and startup integration');
  check(source.match(/@version\s+(\d+\.\d+)/)?.[1]===JSON.parse(fs.readFileSync(path.join(__dirname,'..','version.json'),'utf8')).version,'userscript and release manifest versions agree');
  console.log(`SHOP_ROLL_OK: ${checks} checks; local fixtures only, no live game actions`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
