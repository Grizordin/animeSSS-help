// Production functions with mock network only. No account actions or live HTTP.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
function extract(name){const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(source);if(!m)throw Error(name);const lines=source.slice(m.index).split(/\r?\n/);for(let n=2;n<=lines.length;n++)if(lines[n-1]===m[1]+'}'){const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}}throw Error(name);}
let checks=0;function ok(value,message){assert.ok(value,message);checks++;}
async function authors(browser){
 const page=await browser.newPage();let live=0;
 await page.route('**/*',r=>{if(r.request().resourceType()!=='document')live++;return r.fulfill({contentType:'text/html',body:'<body><div class="anime-cards__item-wrapper"><div class="anime-cards__item" data-id="123"></div><div class="card-votes"><button data-kind="0"></button></div></div></body>'});});
 await page.goto('https://animesss.tv/cards/');
 await page.evaluate(code=>{
  window.cfg={modSuggestionAuthors:true};window.RANK_COLORS={};window.storage={};window.requests=[];window.testHidden=false;
  Object.defineProperty(document,'hidden',{get:()=>testHidden});
  window.gmStoreGet=(k,d)=>k in storage?structuredClone(storage[k]):d;window.gmStoreSet=(k,v)=>storage[k]=structuredClone(v);
  window.suiteGetCurrentUserName=()=> 'Tester';window.suiteKeepInViewport=()=>{};
  const d=new Date();storage.suite_suggestion_authors_cache_v1={cards:[],lastHourKey:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'-'+String(d.getHours()).padStart(2,'0')};
  window.GM_xmlhttpRequest=o=>{requests.push(o.url);const keys=new URL(o.url).searchParams.get('keys').split(',');setTimeout(()=>o.onload({status:200,responseText:JSON.stringify({results:keys.map(task_key=>{const pending=task_key==='999'&&requests.filter(url=>url.includes('999')).length<2;return {task_key,author:task_key==='456'||pending?'':'KnownAuthor',status:task_key==='456'?'not_found':pending?'pending':'found'};})})}),10);};
  (0,eval)(code+'\ninitSuggestionAuthors();');
 },extract('initSuggestionAuthors'));
 await page.waitForTimeout(3100);
 ok(await page.evaluate(()=>requests.length)===1,'resolved author does not self-poll (formerly 12 requests)');
 await page.evaluate(()=>{for(let i=0;i<20;i++)document.body.appendChild(document.createElement('div'));});
 await page.waitForTimeout(2300);
 ok(await page.evaluate(()=>requests.length)===1,'unrelated DOM mutations reuse cache');
 await page.evaluate(()=>document.body.insertAdjacentHTML('beforeend','<div class="anime-cards__item-wrapper"><div class="anime-cards__item" data-id="456"></div><div class="card-votes"><button data-kind="0"></button></div></div>'));
 await page.waitForFunction(()=>requests.length===2);await page.waitForTimeout(500);
 ok(await page.evaluate(()=>new URL(requests[1]).searchParams.get('keys'))==='456','only new key fetched');
 ok(await page.locator('.suite-author-badge').last().textContent()==='Автор: не найдено','terminal not_found rendered');
 await page.evaluate(()=>{testHidden=true;document.dispatchEvent(new Event('visibilitychange'));document.body.insertAdjacentHTML('beforeend','<div class="anime-cards__item-wrapper"><div class="anime-cards__item" data-id="789"></div><div class="card-votes"><button data-kind="0"></button></div></div>');});
 await page.waitForTimeout(5200);
 ok(await page.evaluate(()=>requests.length)===2,'hidden tab starts no author requests');
 await page.evaluate(()=>{testHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(()=>requests.length===3);await page.waitForTimeout(700);
 ok(await page.evaluate(()=>new URL(requests[2]).searchParams.get('keys'))==='789','visible tab resumes new key only');
 await page.evaluate(()=>document.body.insertAdjacentHTML('beforeend','<div class="anime-cards__item-wrapper"><div class="anime-cards__item" data-id="999"></div><div class="card-votes"><button data-kind="0"></button></div></div>'));
 await page.waitForFunction(()=>requests.length===4);await page.waitForTimeout(1000);
 ok(await page.evaluate(()=>requests.length)===4,'pending author does not accelerate via own DOM');
 await page.waitForFunction(()=>requests.length===5);await page.waitForTimeout(600);
 ok(await page.locator('.suite-author-badge').last().textContent()==='Автор: KnownAuthor','pending author eventually resolves through normal polling');
 await page.evaluate(()=>{storage.suite_suggestion_authors_cache_v1.authorResults['123'].checkedAt=1;document.body.appendChild(document.createElement('section'));});
 await page.waitForFunction(()=>requests.length===6);
 ok(await page.evaluate(()=>new URL(requests[5]).searchParams.get('keys'))==='123','expired author cache refreshes without reloading fresh keys');
 ok(live===0,'author network fully mocked');await page.close();
}
async function clubs(browser){
 const page=await browser.newPage();await page.route('**/*',r=>r.abort());await page.setContent('<div class="labyrinth__club-war-club" data-club-id="2"></div>');
 const result=await page.evaluate(async code=>{
  const cfg={modLabyrinthClubWar:true},CLUB_WAR_ROUTE_RE=/.*/,CLUB_WAR_CACHE_MS=180000,CLUB_WAR_RELATIONS_URL='https://example.invalid/relations';
  let clubWarTimer=null,clubWarObserver=null,clubWarRelations=null,clubWarLoadedAt=0,clubWarLoadPromise=null,clubWarRetryAt=0,applied=0,requests=0,fallbacks=0,fail=false;
  const getClubWarCards=()=>[...document.querySelectorAll('.labyrinth__club-war-club')];
  const injectClubWarStyles=()=>{},bindClubWarClickGuard=()=>{},cleanupClubWarRelations=()=>{};
  const getClubWarCardId=card=>card.dataset.clubId;
  const publishClubWarDebug=data=>{if(data.appliedAt)applied++;};
  const fetch=async()=>{requests++;await new Promise(r=>setTimeout(r,20));if(fail)throw Error('offline');return {ok:true,json:async()=>({allies:['2'],enemies:['3']})};};
  const GM_xmlhttpRequest=o=>{fallbacks++;o.onerror({status:0});};
  eval(code+ '\ninitClubWarRelations();');
  await new Promise(r=>setTimeout(r,650));const first={applied,requests};
  document.querySelector('[data-club-id]').dataset.clubId='3';await new Promise(r=>setTimeout(r,300));
  const changed=document.querySelector('[data-club-id]').classList.contains('suite-club-war-enemy');
  clubWarLoadedAt=0;await Promise.all([loadClubWarRelations(),loadClubWarRelations(),loadClubWarRelations()]);
  const joined=requests;
  clubWarLoadedAt=0;fail=true;await loadClubWarRelations();await loadClubWarRelations();await loadClubWarRelations();
  const afterFailure={requests,fallbacks,retry:clubWarRetryAt>Date.now(),stale:!!clubWarRelations};
  clubWarObserver.disconnect();clearTimeout(clubWarTimer);return {first,changed,joined,afterFailure};
 },['readClubWarIds','buildClubWarRelations','loadClubWarRelations','getClubWarRelationType','scheduleClubWarApply','applyClubWarRelations','initClubWarRelations'].map(extract).join('\n'));
 ok(result.first.applied===1,'club relation applies once, no feedback loop');ok(result.first.requests===1,'one initial club load');
 ok(result.changed,'native club id change reapplies relation');ok(result.joined===2,'concurrent stale loads joined into one request');
 ok(result.afterFailure.requests===3 && result.afterFailure.fallbacks===1,'failure cooldown prevents fetch/fallback storm');
 ok(result.afterFailure.retry && result.afterFailure.stale,'failure retains good cache and sets retry cooldown');await page.close();
}
async function queues(){
 const base=()=>({console:{error(){},warn(){},debug(){}},Date,URLSearchParams,setTimeout:()=>0,clearTimeout(){},DOMParser:class{parseFromString(){return {querySelectorAll:()=>[]};}},document:{getElementById:()=>null},noNeedQueuePaused:false,noNeedBlockedUntil:0,noNeedPauseReason:'',cancelScan:false,isScanning:false,noNeedQueueRunning:false,autoNoNeedRunning:false,noNeedRetryCount:0,noNeedQueue:[{type:'batch',ids:['1']}],QUEUE_MAX_ATTEMPTS:3,QUEUE_DELAY_BASE:1000,QUEUE_DELAY_MAX:10000,QUEUE_DELAY_SUCCESS:2500,scanSent:0,scanFound:0,scanBuffer:[],scanCurPage:0,scanTotalPages:0,scanBaseURL:'https://example.invalid/?page=',REQUEST_DELAY_SCAN:1000,missingIds:new Set(),calls:0,delays:[],messages:[],nnDelay:async function(ms){this.delays.push(ms);},showQueueInd(){},showScanInd(){},updateScanInd(){},renderPanel(){},hideInd(){},markBtns(){},updateStopBtn(){},saveMissing(){},rememberHashFromHtml(){},collectNoNeed:()=>[],getPendingCount:()=>0,flushBuffer(){}});
 const context=()=>{const c=base();c.nnDelay=async ms=>c.delays.push(ms);c.showQueueInd=m=>c.messages.push(m);c.showScanInd=m=>c.messages.push(m);vm.createContext(c);vm.runInContext(['noNeedHttpError','pauseNoNeedQueue','runQueue','scanAllPages','scanLocked'].map(extract).join('\n'),c);return c;};
 let c=context();c.sendIds=async()=>{c.calls++;throw Error('temporary');};await vm.runInContext('runQueue()',c);
 ok(c.calls===3 && c.noNeedQueue.length===1 && c.noNeedQueuePaused,'retry bounded, failed task retained');ok(c.delays.join(',')==='1000,2000','bounded exponential backoff');
 await vm.runInContext('runQueue()',c);ok(c.calls===3,'enqueue/run does not bypass pause');
 c.sendIds=async()=>{c.calls++;return {count:1};};c.noNeedQueuePaused=false;await vm.runInContext('runQueue()',c);
 ok(c.noNeedQueue.length===0 && c.scanSent===1,'explicit resume processes saved task');
 c=context();c.sendIds=async()=>{c.calls++;throw Object.assign(Error('response lost'),{uncertain:true});};await vm.runInContext('runQueue()',c);
 ok(c.calls===1 && c.noNeedQueuePaused,'uncertain mutation not retried');
 c=context();const limited=vm.runInContext("noNeedHttpError({status:429,headers:{get:()=> '600'}})",c);c.sendIds=async()=>{c.calls++;throw limited;};await vm.runInContext('runQueue()',c);
 ok(c.calls===0 && c.noNeedBlockedUntil>Date.now()+590000,'Retry-After blocks subsequent queue before request');
 c=context();c.getTotalPages=async()=>100;c.fetch=async()=>{c.calls++;return {ok:false,status:500,headers:{get:()=>null}};};await vm.runInContext('scanAllPages()',c);
 ok(c.calls===1 && c.delays[0]===1000 && c.noNeedQueuePaused && !c.isScanning,'failed scan stops with delay, retains queue');
 c=context();c.getTotalPages=async()=>100;c.fetch=async()=>{c.calls++;return {ok:false,status:403,headers:{get:()=>null}};};await vm.runInContext('scanLocked()',c);
 ok(c.calls===1 && c.delays[0]===1000 && !c.isScanning && c.missingIds.size===0,'locked scan stops without partial commit');
 c=context();c.getTotalPages=async()=>{throw Error('pagination failed');};await vm.runInContext('scanLocked()',c);
 ok(!c.isScanning && c.missingIds.size===0,'pagination failure releases scanner state');
 c=context();c.getTotalPages=async()=>3;c.fetch=async()=>{c.calls++;return {ok:true,text:async()=>'<html></html>'};};await vm.runInContext('scanAllPages()',c);
 ok(c.calls===3 && c.delays.join(',')==='1000,1000,1000' && !c.cancelScan,'successful scanning retains page delays and full traversal');
 c=context();c.noNeedQueue.push({type:'batch',ids:['2']});c.sendIds=async()=>{c.calls++;c.pauseNoNeedQueue(Error('other scanner failed'));return {count:1};};await vm.runInContext('runQueue()',c);
 ok(c.calls===1 && c.noNeedQueue.length===1 && c.noNeedQueuePaused,'external pause stops queue after in-flight success');
 c=context();c.noNeedQueue=[{type:'page',value:'1'}];c.fetchHtml=async()=>{c.pauseNoNeedQueue(Error('scan stopped'));return '';};c.sendIds=async()=>{c.calls++;return {count:1};};await vm.runInContext('runQueue()',c);
 ok(c.calls===0 && c.noNeedQueue.length===1 && c.noNeedQueuePaused,'pause during preliminary GET prevents subsequent POST');
 c=context();c.cachedUserHash='fixture';c.saveUserHash=x=>x;c.nnGetHash=()=> 'fixture';c.fetch=async()=>{c.calls++;throw Error('connection lost');};
 vm.runInContext(extract('parseResp')+'\n'+extract('sendIds'),c);await vm.runInContext('runQueue()',c);
 ok(c.calls===1 && c.noNeedQueuePaused,'real sendIds network rejection is uncertain and not resent');
 c=context();c.cachedUserHash='fixture';c.saveUserHash=x=>x;c.nnGetHash=()=> 'fixture';c.fetch=async()=>{c.calls++;return {ok:true,text:async()=> '{}'};};
 vm.runInContext(extract('parseResp')+'\n'+extract('sendIds'),c);await vm.runInContext('runQueue()',c);
 ok(c.calls===1 && c.noNeedQueuePaused,'unrecognised mutation response not resent');
}
async function queueControls(browser){
 const page=await browser.newPage();await page.route('**/*',r=>r.abort());await page.setContent('<div id="no-need-queue-indicator" style="width:230px"><p class="message"></p></div>');
 const result=await page.evaluate(code=>{
  let noNeedQueuePaused=false,noNeedPauseReason='',noNeedBlockedUntil=0,cancelScan=false,isScanning=false,noNeedQueueRunning=false,autoNoNeedRunning=false;
  let noNeedQueue=[{type:'batch',ids:['1']}],scanBuffer=['2'],runs=0,allow=false;
  const runQueue=()=>{runs++;},confirm=()=>allow;
  const showQueueInd=message=>document.querySelector('.message').textContent=message;
  eval(code);
  pauseNoNeedQueue(Error('fixture'));
  hideInd('no-need-queue-indicator');const visible=!!document.querySelector('.nn-queue-controls');
  noNeedBlockedUntil=Date.now()+60000;
  document.querySelector('.nn-queue-controls button').click();const blocked=runs===0&&noNeedQueuePaused;
  noNeedBlockedUntil=0;isScanning=true;document.querySelector('.nn-queue-controls button').click();const busy=runs===0;
  isScanning=false;document.querySelector('.nn-queue-controls button').click();const resumed=runs===1&&!noNeedQueuePaused&&noNeedQueue.length===1;
  pauseNoNeedQueue(Error('fixture'));document.querySelector('.nn-queue-controls button:last-child').click();const kept=noNeedQueue.length===1;
  allow=true;document.querySelector('.nn-queue-controls button:last-child').click();const cancelled=noNeedQueue.length===0&&scanBuffer.length===0&&!noNeedQueuePaused;
  pauseNoNeedQueue(Error('empty'));document.querySelector('.nn-queue-controls button').click();const emptyResume=runs===1&&!noNeedQueuePaused;
  return {visible,blocked,busy,resumed,kept,cancelled,emptyResume};
 },['hideInd','pauseNoNeedQueue'].map(extract).join('\n'));
 for(const [key,value] of Object.entries(result))ok(value,'queue controls: '+key);
 await page.close();
}
(async()=>{await queues();const browser=await chromium.launch({headless:true,channel:'msedge'});try{await authors(browser);await clubs(browser);await queueControls(browser);}finally{await browser.close();}console.log('REQUEST_LOAD_REGRESSION_OK '+checks+' checks');})().catch(e=>{console.error(e);process.exitCode=1;});
