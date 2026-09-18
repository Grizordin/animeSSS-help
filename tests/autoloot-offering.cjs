// Offline browser checks of the actual notification/profile functions; no site requests.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
function extract(name){
 const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(source);
 if(!m)throw Error(name);
 const lines=source.slice(m.index).split(/\r?\n/);
 for(let n=2;n<=lines.length;n++){
  if(lines[n-1]!==m[1]+'}')continue;
  const code=lines.slice(0,n).join('\n');
  try{new vm.Script('('+code+')');return code;}catch{}
 }
 throw Error('extract '+name);
}
const functions=['parseCardQuestFromHtml','updateCardCounter','queueOfferingProfileCheck','refreshProfileAfterOffering','cleanupOfferingProfileCheck','installSiteNotificationInterceptor','cleanupSiteNotificationInterceptor'].map(extract).join('\n');
const setup=String.raw`
let passed=0;const check=(v,m)=>{if(!v)throw Error(m);passed++;};
const currentUser='Test',cfg={modAutoLootCards:true};
let profileFetchInProgress=false,offeringRefreshTimer=null,offeringRefreshPending=false,offeringLastSeenAt=0,offeringRefreshDisposed=false;
let scriptEnabledWatch=true,isLoopRunning=false,visible=true,leader=true,auth=false,restored=false;
let fetches=0,scheduled=0,originalCalls=0,fetchGate=null,fetchError=false;
const logs=[],pushes=[],storage=new Map(),timers=new Map();let timerId=0;
const nativeTimeout=window.setTimeout.bind(window);
window.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;};
window.clearTimeout=id=>timers.delete(id);
const flush=()=>new Promise(r=>nativeTimeout(r,0));
const CARD_COUNT_CACHE_KEY='cache',LAST_PROFILE_FETCH_KEY='last',CARD_COUNT_SYNC_KEY='sync',COLLECTION_PAUSED_KEY='paused',PAUSE_DATE_KEY='date',STORAGE_KEY_WATCH='enabled',CARD_COUNT_UPDATE_INTERVAL=1800000,RESUME_DELAY_MS=300;
const GM_getValue=async(k,f)=>storage.has(k)?storage.get(k):f;
const GM_setValue=async(k,v)=>storage.set(k,v),GM_deleteValue=async k=>storage.delete(k);
const suiteGetAuthPause=()=>auth,saveDiagnosticLog=(event,data)=>logs.push({event,data});
const setKnownDailyLimit=async n=>storage.set('limit',n),setDailyProgress=async n=>storage.set('current',n);
const confirmCurrentServerDay=async()=>{},updateButtonState=()=>{},safePush=(...args)=>pushes.push(args),warn=()=>{},log=()=>{};
const isTabVisible=()=>visible,tryAcquireTabLock=()=>{},isThisTabLeader=()=>leader;
const restoreTimerFromStorage=async()=>restored,scheduleNext=()=>scheduled++;
const getKnownDailyLimit=async()=>storage.get('limit');
let html='<p>Получено карточек за просмотр аниме <b>30 из 35</b></p>';
async function fetchUserProfileHtml(){fetches++;if(fetchGate)await fetchGate;if(fetchError)throw Error('offline');return html;}
const unsafeWindow=window;
// Actual site shape: function DLEPush() {}, with static info/warning/error methods.
window.DLEPush=function DLEPush(){};
const originalInfo=function(){originalCalls++;return 'original-result';};
window.DLEPush.info=originalInfo;
const message='Подношение принято! Получено 200 камней духа и +1 ход в Лабиринте Бесконечности. Так же увеличен шанс познать просветление и лимит получения карточек за просмотр';
function reset(){
 timers.clear();storage.clear();logs.length=0;pushes.length=0;
 profileFetchInProgress=false;offeringRefreshTimer=null;offeringRefreshPending=false;offeringLastSeenAt=0;offeringRefreshDisposed=false;
 cfg.modAutoLootCards=true;scriptEnabledWatch=true;isLoopRunning=false;visible=true;leader=true;auth=false;restored=false;
 fetches=0;scheduled=0;fetchGate=null;fetchError=false;
 html='<p>Получено карточек за просмотр аниме <b>30 из 35</b></p>';
 storage.set('paused',true);storage.set('date','today');storage.set('enabled',true);storage.set('limit',30);storage.set('current',30);
 storage.set('cache',{text:'30 / 30'});storage.set('last',Date.now());
}
async function runPending(){check(timers.size===1,'one queued timer');const [id,timer]=[...timers][0];timers.delete(id);timer.fn();await flush();await flush();}
`;
const tests=String.raw`
reset();queueOfferingProfileCheck('Вы нашли небесный камень духа, ваша награда 200 камней духа');
check(timers.size===0,'ordinary stone reward ignored');
queueOfferingProfileCheck('Подношение не принято! лимит получения карточек за просмотр');
check(timers.size===0,'unsuccessful offering ignored');
queueOfferingProfileCheck(message);queueOfferingProfileCheck(message);
check(timers.size===1&&fetches===0,'duplicate signals coalesced');
await runPending();
check(fetches===1&&storage.get('limit')===35&&storage.get('current')===30,'fresh profile bypasses cache and supplies actual values');
check(storage.get('paused')===false&&!storage.has('date'),'only confirmed available slots clear limit pause');
check(storage.get('cache').text==='30 / 35'&&storage.get('sync').text==='30 / 35','profile counters synchronized');
check(scheduled===1&&storage.get('enabled')===true,'enabled leader resumes');
check(pushes[0][1].includes('После подношения')&&!pushes[0][1].includes('Новый день'),'accurate resume notification');
check(logs.some(e=>e.event==='offering_profile_checked'&&e.data.limit===35),'checked limit logged');
queueOfferingProfileCheck(message);check(timers.size===0,'late duplicate within debounce ignored');

reset();html='<p>Получено карточек за просмотр аниме 30 из 30</p>';queueOfferingProfileCheck(message);await runPending();
check(storage.get('paused')===true&&scheduled===0,'unchanged exhausted limit stays paused');
reset();html='<p>Получено карточек за просмотр аниме 30 из 42</p>';queueOfferingProfileCheck(message);await runPending();
check(storage.get('limit')===42,'no fixed plus-five assumption');
reset();html='<p>Войдите на сайт</p>';queueOfferingProfileCheck(message);await runPending();
check(storage.get('paused')===true&&storage.get('limit')===30&&scheduled===0,'unparseable profile preserves state');
check(logs.some(e=>e.event==='offering_profile_check_failed'),'parse failure logged');
reset();fetchError=true;queueOfferingProfileCheck(message);await runPending();
check(storage.get('paused')===true&&scheduled===0&&!offeringRefreshPending,'network failure leaves pause and clears pending');
reset();scriptEnabledWatch=false;storage.set('enabled',false);queueOfferingProfileCheck(message);await runPending();
check(fetches===1&&storage.get('enabled')===false&&scheduled===0,'manual stop is never enabled by offering');
reset();storage.set('enabled',false);queueOfferingProfileCheck(message);await runPending();
check(scheduled===0,'latest stored manual stop wins over stale runtime');
reset();visible=false;queueOfferingProfileCheck(message);await runPending();check(scheduled===0,'hidden tab does not collect');
reset();leader=false;queueOfferingProfileCheck(message);await runPending();check(scheduled===0,'nonleader does not collect');
reset();restored=true;queueOfferingProfileCheck(message);await runPending();check(scheduled===0,'normal request cooldown retained');
reset();isLoopRunning=true;queueOfferingProfileCheck(message);await runPending();check(scheduled===0,'no competing loop started');
reset();profileFetchInProgress=true;queueOfferingProfileCheck(message);await runPending();
check(fetches===0&&offeringRefreshPending&&timers.size===1,'offering waits for older profile request');
profileFetchInProgress=false;await runPending();check(fetches===1&&storage.get('limit')===35,'fresh fetch after older request finishes');
reset();queueOfferingProfileCheck(message);cleanupOfferingProfileCheck();check(timers.size===0&&!offeringRefreshPending,'cleanup cancels queued check');
queueOfferingProfileCheck(message);check(timers.size===0,'old interceptor inert after cleanup');
reset();let release;fetchGate=new Promise(r=>release=r);queueOfferingProfileCheck(message);await runPending();
check(fetches===1&&profileFetchInProgress,'profile fetch in flight');
cleanupOfferingProfileCheck();release();await flush();await flush();
check(storage.get('paused')===true&&scheduled===0,'late response after cleanup cannot resume');
reset();cfg.modAutoLootCards=false;queueOfferingProfileCheck(message);check(timers.size===0,'disabled module ignores offering');
reset();auth=true;queueOfferingProfileCheck(message);await runPending();check(fetches===0,'auth pause blocks request');

reset();installSiteNotificationInterceptor();const result=window.DLEPush.info('<b>'+message+'</b>');
check(timers.size===1&&originalCalls===1,'DLEPush wrapper detects HTML and preserves original notification');
check(result==='original-result'&&typeof window.DLEPush==='function','native notifier type and return value preserved');
check(!('success' in window.DLEPush),'missing site methods are not fabricated');
const installedInfo=window.DLEPush.info;installSiteNotificationInterceptor();
check(window.DLEPush.info===installedInfo,'second install does not stack hooks');
await runPending();check(fetches===1,'DLEPush integration refreshes profile');
reset();const unrelated=document.createElement('div');unrelated.textContent=message;document.body.append(unrelated);await flush();
check(timers.size===0,'quoted text outside notifications ignored');
const toast=document.createElement('div');toast.className='DLEPush-notification wrapper';
toast.innerHTML='<button class="DLEPush-close">&times;</button><div class="DLEPush-icon"></div><div class="DLEPush-header">Информация</div><div class="DLEPush-message">'+message+'</div>';
document.body.append(toast);await flush();
check(timers.size===1,'DOM-only native notification detected');await runPending();check(fetches===1,'DOM notification refreshes profile');
reset();const custom=document.createElement('div');custom.className='cpt-toast';
custom.innerHTML='<div class="cpt-title">Награда</div><div class="cpt-sub">'+message+'</div>';document.body.append(custom);await flush();
check(timers.size===1,'custom helper toast detected too');await runPending();
reset();const container=document.createElement('div');container.id='DLEPush';container.append(toast.cloneNode(true));document.body.append(container);await flush();
check(timers.size===1,'notification inside newly inserted container detected');await runPending();
reset();container.replaceWith(container.cloneNode(true));await flush();
check(timers.size===1,'replacement notification container still observed');await runPending();
reset();const delayed=toast.cloneNode(true);const body=delayed.querySelector('.DLEPush-message');body.textContent='';document.body.append(delayed);await flush();
check(timers.size===0,'empty native notification ignored');body.textContent=message;await flush();
check(timers.size===1,'message added after notification insertion detected');await runPending();
reset();body.firstChild.data=message+' ';await flush();
check(timers.size===1,'text-node updates detected');await runPending();
reset();window.DLEPush.info(message);document.body.append(toast.cloneNode(true));await flush();
check(timers.size===1,'real notifier and native DOM path deduplicated');await runPending();check(fetches===1,'one profile request for both paths');
reset();const decoy=toast.cloneNode(true);decoy.querySelector('.DLEPush-header').textContent=message;decoy.querySelector('.DLEPush-message').textContent='Другая награда';document.body.append(decoy);await flush();
check(timers.size===0,'notification header is not mistaken for message');
cleanupSiteNotificationInterceptor();
check(window.DLEPush.info===originalInfo&&!window.__awVisibleTabDleInstalled,'cleanup restores function notifier');
document.body.append(toast.cloneNode(true));await flush();check(timers.size===0,'cleanup disconnects DOM observer');
window.DLEPush={info:originalInfo};installSiteNotificationInterceptor();window.DLEPush.info(message);await runPending();
check(fetches===1,'object notifier variant still supported');cleanupSiteNotificationInterceptor();
check(window.DLEPush.info===originalInfo,'cleanup restores object notifier');
window.offeringTest={result:'AUTOLOOT_OFFERING_OK',passed};
`;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL||'msedge'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<body></body>');
  await page.evaluate(code=>new (Object.getPrototypeOf(async function(){}).constructor)(code)(),setup+'\n'+functions+'\n'+tests);
  if(errors.length)throw Error(errors.join('\n'));
  console.log(JSON.stringify(await page.evaluate(()=>window.offeringTest)));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
