// All requests, storage and clocks are mocked. Never contacts AnimeSSS or telemetry services.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
const bundle=source.slice(source.indexOf('  // BEGIN EMBEDDED TRADE LIMITS'),source.indexOf('  // END EMBEDDED TRADE LIMITS'));
new vm.Script(source);
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const prefix='suite_trade_limits_v1:', key=prefix+'state:tester';
const now=Date.parse('2026-10-21T13:00:00+03:00');
const coreSource=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_trade_limits.user.js'),'utf8');
const mod={exports:{}};vm.runInNewContext(coreSource,{module:mod,URL,URLSearchParams});const C=mod.exports;
function storedPeer(status='pending'){
  const state=C.fresh('Tester',now);state.timingRepair=1;
  C.putTrade(state,{name:'Peer',offerId:'123',cardId:'7',sentAt:now,exact:true},now);
  const p=state.people.peer;p.trades[Object.keys(p.trades)[0]].status=status;
  if(status==='accepted'){p.next=0;Object.values(p.trades)[0].historyKey='confirmed';}
  return state;
}
const profile='<div class="header__group-menu"><a href="/user/Tester/">Tester</a></div><a href="/clubs/2/">Мой клуб</a><div class="ap-profile-actions"><a class="ap-profile-action" href="/user/Tester/">Профиль</a></div>';
const owners='<div class="card-show__owner-wrapper"><a class="card-show__owner card-show__owner--online" href="/user/Peer/">Peer</a><a class="card-show__owner" href="/user/Peer/">Peer</a><a class="card-show__owner" href="/user/Fresh/">Fresh</a></div><div class="leaderboard-top__list"><a class="leaderboard-top__item" href="/user/Peer/">Podium</a></div>';
const css='<style>body{background:#151515;color:white}.card-show__owner-wrapper{display:flex;gap:12px;flex-wrap:wrap}.card-show__owner{display:flex;flex-direction:column;width:108px;background:rgb(25,35,55);padding:8px;border:1px solid #777;border-radius:12px}</style>';
const offered=profile+'<a class="ncard__tabs-btn" href="/trades/offers/">Отправленные (1)</a><div class="trade__list"><a class="trade__list-item" href="/trades/offers/123/"><span class="trade__list-name">для Peer</span><span class="trade__list-date">21.10.2026 13:00:00</span></a></div>';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const context=await browser.newContext(),store=new Map(),calls=[],errors=[];
  let delay=null,fail=false;
  await context.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url());
   if(u.pathname==='/__gm__'){
    const d=JSON.parse(r.postData()),clone=v=>v===undefined?null:structuredClone(v);let result=null;
    if(d.op==='get')result=store.has(d.key)?clone(store.get(d.key)):d.fallback;
    if(d.op==='set')store.set(d.key,clone(d.value));
    if(d.op==='delete')store.delete(d.key);
    if(d.op==='list')result=[...store.keys()];
    return route.fulfill({contentType:'application/json',body:JSON.stringify({value:result})});
   }
   if(r.resourceType()==='document')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8">'+css+'</head><body>'+profile+owners+'</body></html>'});
   calls.push({url:u.href,method:r.method()});
   if(u.pathname==='/trades/offers/'){
    if(delay)await delay;
    return route.fulfill({status:fail?503:200,contentType:'text/html; charset=utf-8',body:offered});
   }
   if(u.pathname==='/index.php')return route.fulfill({contentType:'application/json',headers:{Date:new Date(now).toUTCString()},body:JSON.stringify({html:'<div class="message-info__content">Обмен отправлен, дождитесь его рассмотрения получателем</div>'})});
   return route.fulfill({contentType:'application/json',body:'{}'});
  });
  await context.addInitScript(({now})=>{
   const X=XMLHttpRequest,open=X.prototype.open,send=X.prototype.send;
   const gm=d=>{const x=new X();open.call(x,'POST','/__gm__',false);send.call(x,JSON.stringify(d));return JSON.parse(x.responseText).value;};
   const listeners=[];
   window.GM_getValue=(key,fallback)=>gm({op:'get',key,fallback});
   window.GM_setValue=(key,value)=>{const old=GM_getValue(key,null);gm({op:'set',key,value});for(const l of listeners)if(l.key===key)l.cb(key,old,value,false);};
   window.GM_deleteValue=key=>gm({op:'delete',key});window.GM_listValues=()=>gm({op:'list'});
   window.GM_addValueChangeListener=(key,cb)=>{listeners.push({key,cb});return listeners.length;};window.GM_removeValueChangeListener=()=>{};
   window.GM={getValue:async(k,d)=>GM_getValue(k,d),setValue:async(k,v)=>GM_setValue(k,v)};
   window.GM_info={script:{version:'3.75'}};window.GM_addStyle=text=>{const e=document.createElement('style');e.textContent=text;document.head.append(e);};
   window.GM_xmlhttpRequest=opts=>{setTimeout(()=>opts.onerror?.({status:0}),0);return {abort(){}};};
   window.testActive=false;window.testOffset=0;
   const realNow=Date.now,base=realNow();Date.now=()=>now+realNow()-base+window.testOffset;
   Object.defineProperty(document,'visibilityState',{get:()=>window.testActive?'visible':'hidden'});document.hasFocus=()=>window.testActive;
   window.testRemote=key=>{for(const l of listeners)if(l.key===key)l.cb(key,null,GM_getValue(key,null),true);};
  },{now});
  const a=await context.newPage(),b=await context.newPage();
  for(const page of [a,b])page.on('pageerror',e=>errors.push(e.message));
  await a.goto('https://animesss.tv/cards/users/?id=7');await b.goto('https://animesss.com/cards/users/?id=7');
  await a.evaluate(source=>(0,eval)(source),source);
  try{await a.waitForFunction(()=>window.__suiteMainInitialized===true,null,{timeout:12000});}
  catch(e){console.error({errors,phase:await a.evaluate(()=>window.__suiteMainInitPhase),telemetry:[...store].filter(([k])=>k.includes('telemetry')).map(([k,v])=>[k,JSON.stringify(v).slice(0,3500)])});throw e;}
  await a.locator('#suite-settings-btn').click();
  await a.getByRole('tab',{name:'Карты',exact:true}).click();
  const main=a.locator('[data-suite-trade-setting="modTradeLimits"] input');
  const numbers=a.locator('[data-suite-trade-setting="tradeLimitsNumbers"] input');
  ok(!(await main.isChecked()),'new module defaults off');ok(await numbers.isDisabled(),'linked numeric toggle disabled when parent off');
  eq(await a.locator('.astl-mark,#astl-bar,#astl-panel').count(),0,'no debug controls or markings while disabled');
  await main.locator('..').click();
  await a.waitForFunction(()=>document.querySelectorAll('.astl-mark').length===3);
  eq(await a.locator('.astl-dot').count(),9,'dots default, including repeated nick');
  eq(await a.locator('#astl-bar,#astl-panel').count(),0,'no standalone debugging UI in helper');
  ok(!(await numbers.isDisabled()),'numeric setting enabled with parent');
  await numbers.locator('..').click();
  await a.waitForFunction(()=>document.querySelector('.astl-mark')?.textContent==='3/3');
  eq(await a.locator('.leaderboard-top__item .astl-mark').count(),0,'podium excluded');
  await a.locator('[data-suite-trade-setting="modTradeLimits"]').hover();
  ok((await a.locator('#suite-menu-tooltip').textContent()).startsWith('Отображает доступные обмены с пользователем'),'agreed tooltip in actual menu');
  // Initial load on the other domain reads the same persistent preferences.
  await b.evaluate(source=>(0,eval)(source),source);
  await b.waitForFunction(()=>window.__suiteMainInitialized && document.querySelector('.astl-mark')?.textContent==='3/3');
  eq(calls.filter(c=>c.url.includes('/trades/')).length,0,'displaying unknown users sends no verification requests');
  store.set(key,storedPeer('accepted'));
  await a.waitForFunction(()=>document.querySelector('.astl-mark')?.textContent==='2/3');
  await b.waitForFunction(()=>document.querySelector('.astl-mark')?.textContent==='2/3');
  // Repeated toggles/wrapping cannot stack our own interceptors.
  const depth=()=>{
   let fn=window.fetch,count=0,seen=new Set();
   while(fn&&!seen.has(fn)){seen.add(fn);if(fn.__suiteTradeLimits)count++;fn=fn.__suiteTradeLimitsOriginal||fn.__suiteGlobalDiagnosticsOriginal||fn.__suiteCustomPushOriginal;}
   return count;
  };
  const before=await a.evaluate(depth);
  await main.locator('..').click();await a.waitForFunction(()=>!document.querySelector('.astl-mark'));
  ok(await numbers.isDisabled(),'off immediately disables numeric control');
  await main.locator('..').click();await a.waitForFunction(()=>document.querySelector('.astl-mark')?.textContent==='2/3');
  eq(await a.evaluate(depth),before,'no duplicate hooks after off/on');
  await a.evaluate(()=>{const original=window.fetch;const wrapped=function(...args){return original.apply(this,args);};wrapped.__suiteCustomPushOriginal=original;window.fetch=wrapped;});
  await a.waitForTimeout(2200);eq(await a.evaluate(depth),before,'coexists with later custom-push hook');
  // Native awakened fill, online outline, all stars levels.
  for(const page of [a,b])await page.evaluate(()=>history.pushState({},'','/cards/7/awakened/?variant=all'));
  await a.waitForFunction(()=>document.querySelector('.astl-tile')&&!document.querySelector('.astl-tile.astl-green'));
  eq(await a.locator('.astl-tile').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(25, 35, 55)','awakened native fill retained');
  ok((await a.locator('.astl-tile').first().evaluate(e=>getComputedStyle(e).boxShadow)).includes('inset'),'online border retained');
  for(let stars=1;stars<=5;stars++){
   await a.evaluate(stars=>history.pushState({},'',`/cards/7/stars/?stars=${stars}`),stars);
   await a.waitForFunction(()=>!!document.querySelector('.astl-tile.astl-green'));
   eq(await a.locator('.astl-mark').count(),3,'stars '+stars+' ordinary owners');
  }
  await a.setViewportSize({width:320,height:760});
  ok(await a.locator('.astl-mark').first().evaluate(e=>e.getBoundingClientRect().right<=innerWidth),'indicator fits mobile');
  // Real host coordinator, with two different origins and shared synchronous GM data.
  store.set(key,storedPeer());
  let release;delay=new Promise(r=>release=r);
  await a.evaluate(()=>{window.testActive=true;});
  await a.waitForFunction(()=>GM_getValue('suite_trade_limits_v1:state:tester',null)?.people.peer.checking,null,{timeout:10000});
  for(let i=0;i<30&&!calls.some(c=>c.url==='https://animesss.tv/trades/offers/');i++)await a.waitForTimeout(100);
  ok(calls.some(c=>c.url==='https://animesss.tv/trades/offers/'),'worker sends GET on current .tv origin');
  await a.evaluate(()=>{window.testActive=false;});await b.evaluate(()=>{window.testActive=true;});
  const beforeRelease=calls.filter(c=>c.url.includes('/trades/offers/')).length;
  await b.waitForTimeout(2200);
  eq(calls.filter(c=>c.url.includes('/trades/offers/')).length,beforeRelease,'other origin waits for in-flight owner, no parallel rounds');
  release();delay=null;
  await b.waitForFunction(()=>GM_getValue('suite_trade_limits_v1:state:tester',null)?.people.peer.lastFinished>0,null,{timeout:12000});
  await b.evaluate(()=>window.testOffset=65000);
  await b.waitForFunction(()=>GM_getValue('suite_trade_limits_v1:state:tester',null)?.log.some(e=>e.code==='CHECK_DONE'&&e.at>Date.parse('2026-10-21T10:01:00Z')),null,{timeout:12000});
  ok(calls.some(c=>c.url==='https://animesss.com/trades/offers/'),'handover continues on .com origin');
  eq(Object.keys(store.get(key).people).length,1,'no duplicate ledger from repeated tiles or domain switch');
  eq(store.get(key).metrics.requests,2,'both origins contribute to the same request counter');
  eq(store.get(prefix+'requests').length,1,'rolling budget drops requests older than a minute');
  // Disable during network: reply must not resolve a trade or start the next request.
  delay=new Promise(r=>release=r);await b.evaluate(()=>window.testOffset+=65000);
  await b.waitForFunction(()=>GM_getValue('suite_trade_limits_v1:state:tester',null)?.people.peer.checking,null,{timeout:12000});
  await a.locator('[data-suite-trade-setting="modTradeLimits"] input').evaluate(e=>e.click());
  await b.evaluate(()=>testRemote('suite_setting_value_v2:modTradeLimits'));release();delay=null;
  await b.waitForFunction(()=>!document.querySelector('.astl-mark'));
  await b.waitForTimeout(2400);const stopped=calls.filter(c=>c.url.includes('/trades/offers/')).length;
  await b.waitForTimeout(2400);eq(calls.filter(c=>c.url.includes('/trades/offers/')).length,stopped,'off stops background checks');
  eq(Object.values(store.get(key).people.peer.trades)[0].status,'pending','disabled in-flight response did not invent terminal outcome');
  // Daily summary uses existing totals, once across domains, no request for stats.
  const isolated=await context.newPage();await isolated.goto('https://animesss.tv/');
  await isolated.evaluate(({bundle})=>{
   window.reported=[];window.suiteTelemetryLog=(...args)=>reported.push(args);window.suiteGetCurrentUserName=()=> 'Tester';
   window.gmGet=GM_getValue;window.gmStoreSet=GM_setValue;window.readSettingPreference=()=>({value:true});window.SETTINGS_KEY='suite_settings_v1';
   window.suiteFunctionChainHas=()=>false;window.getPageWindow=()=>window;
   (0,eval)(bundle+'\nwindow.testHost=createTradeLimitsHost();');
  },{bundle});
  await isolated.evaluate(state=>{testHost.daily(state);testHost.daily(state);testHost.report({code:'CHECK_DONE',detail:'green'});testHost.report({code:'SEND_TIME_MISMATCH',name:'Peer',detail:{status:'mismatch'}});testHost.report({code:'SEND_TIME_MISMATCH',name:'Peer',detail:{status:'mismatch'}});},store.get(key));
  eq(await isolated.evaluate(()=>reported.filter(e=>e[1]==='daily_summary').length),1,'one daily summary, no duplicate');
  eq(await isolated.evaluate(()=>reported.filter(e=>e[1]==='send_time_mismatch').length),1,'anomaly deduplicated');
  eq(await isolated.evaluate(()=>reported.filter(e=>e[1]==='check_done').length),0,'routine success not sent');
  ok(await isolated.evaluate(()=>!JSON.stringify(reported.find(e=>e[1]==='daily_summary')).includes('Peer')),'daily aggregate excludes nick list');
  const mutual=await isolated.evaluate(async()=>{
    testActive=true;
    const first=createTradeLimitsHost(),second=createTradeLimitsHost();let inside=0,maximum=0,entered=0;
    const task=async()=>{inside++;entered++;maximum=Math.max(maximum,inside);await new Promise(r=>setTimeout(r,400));inside--;};
    await Promise.all([first.withLock(task),second.withLock(task)]);
    return {maximum,entered,released:!first.ownsLock()&&!second.ownsLock()};
  });
  eq(mutual.maximum,1,'simultaneous claims cannot run two writers');eq(mutual.entered,1,'losing claim waits for a later turn');ok(mutual.released,'claims released after work');
  const expired=await isolated.evaluate(async()=>{
    const old=createTradeLimitsHost();let was=false,after=true;
    await old.withLock(async()=>{was=old.ownsLock();testOffset+=16000;after=old.ownsLock();});return {was,after};
  });
  ok(expired.was&&!expired.after,'expired leader cannot resume writes after a suspended timer');
  // Actual .com fetch hook observes a synthetic user send, without running the queue.
  await b.evaluate(()=>{
    window.testActive=false;
    GM_setValue('suite_setting_value_v2:modTradeLimits',JSON.stringify({version:1,value:true}));
    document.body.insertAdjacentHTML('beforeend','<div id="tradeOffer" data-receiver="NewPeer" data-trade-id="789" data-original-id="7"><button class="trade__send-trade-btn">Отправить</button></div>');
  });
  await b.evaluate(async()=>{
    document.querySelector('#tradeOffer button').click();
    const result=await fetch('/index.php?controller=ajax&mod=trade_ajax',{method:'POST',body:'action=trade_card&trade_id=789&original_card=7&user_hash=must-not-be-stored'});
    await result.json();
  });
  await b.waitForTimeout(200);
  const send=[...store].find(([k,v])=>k.startsWith(prefix+'event:') && v.kind==='send' && v.data.name==='NewPeer')?.[1];
  ok(send,'.com successful send observed');eq(send.data.serverDateAt,now,'.com server Date captured');
  ok(Number.isFinite(send.data.requestDurationMs),'.com request duration captured');
  ok(!JSON.stringify([...store].filter(([k])=>k.startsWith(prefix))).includes('must-not-be-stored'),'session hash not stored');
  // Automatic midnight rollover emits the old day aggregate once and starts an empty ledger.
  const yesterday=store.get(key).day;store.delete(prefix+'daily:tester');
  await b.evaluate(()=>{window.testOffset+=24*3600000;window.testActive=true;});
  await b.waitForFunction(()=>GM_getValue('suite_trade_limits_v1:state:tester',null)?.day==='2026-10-22',null,{timeout:12000});
  eq(store.get(prefix+'daily:tester'),yesterday,'midnight sends completed-day aggregate');
  eq(Object.keys(store.get(key).people).length,0,'midnight resets ledger without carrying yesterday offers');
  // Reload enabled module, numbers preference and shared state persist.
  await b.reload();await b.evaluate(source=>(0,eval)(source),source);
  await b.waitForFunction(()=>window.__suiteMainInitialized && document.querySelector('.astl-mark')?.textContent==='3/3');
  eq(await b.locator('#astl-bar,#astl-panel').count(),0,'no debug element after reload');
  eq(errors,[],'no unhandled errors in full helper or integrated lifecycle');
  ok(calls.filter(c=>c.url.includes('/trades/')).every(c=>c.method==='GET'),'verification only uses GET');
  await context.close();console.log('TRADE_LIMITS_INTEGRATION_OK '+checks+' checks');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
