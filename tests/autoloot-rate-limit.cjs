// Actual production functions, fake clock/storage/network. No live account requests.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
function extract(name){
 const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(source);if(!m)throw Error(name);
 const lines=source.slice(m.index).split(/\r?\n/);
 for(let n=2;n<=lines.length;n++)if(lines[n-1]===m[1]+'}'){
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }
 throw Error('extract '+name);
}
const funcs=['autoLootRateLimitError','readAutoLootRateLimit','checkAutoLootRateLimit','pauseAutoLootForRateLimit',
 'confirmAutoLootRateLimitRecovery','fetchData','scheduleNext','restoreTimerFromStorage','mainCardCheckLogic',
 'saveDiagnosticLog','installStorageListener','removeStorageListener','getPanelCountdown','handleCardError'].map(extract).join('\n');
let checks=0;function check(v,m){assert.ok(v,m);checks++;}
function runtime(storage=new Map()){
 const c=vm.createContext({Response,Headers,URL,Date,storage,structuredClone});
 vm.runInContext(`
 let now=Date.parse('2026-10-24T12:00:00Z');const RealDate=Date;
 Date=class extends RealDate {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
 const RATE_LIMIT_PAUSE_MS=60000,RATE_LIMIT_STATE_KEY='rate_Test',LAST_SUCCESSFUL_REQUEST_KEY='last';
 const CHECK_NEW_CARD_INTERVAL=177000,EMPTY_DB_RECHECK_MS=60000,RESUME_DELAY_MS=300;
 const STORAGE_KEY_WATCH='enabled',PAUSE_ON_LIMIT_ENABLED_KEY='pauseOnLimit',COLLECTION_PAUSED_KEY='paused',PAUSE_DATE_KEY='date',SMART_PROGRESSION_KEY='progress';
 const RETRY_NO_HASH_MS=5000,NEXT_LOOP_EXTRA_DELAY=0,NO_CARD_RETRY_DELAY_MS=15000,MAX_FAILED_ATTEMPTS_KEY='maxFailures';
 const TAB_LOCK_KEY='lock',TAB_ID='tab',ANIME_DB_KEY='db';let storageListenerId=null,storageHandler=null,rateLimitStorageListenerId=null;
 let rateLimitUntil=0,scriptEnabledWatch=true,checkNewCardTimeoutId=null,nextRunAt=0,isLoopRunning=false;
 let visible=true,leader=true,animeDbEmpty=false,pauseOnLimitEnabled=true,diagnosticRequestSequence=0,panelPaused=false;
 const formatMs=ms=>String(ms);
 const currentUser='Test',cfg={modAutoLootCards:true},unsafeWindow={dle_login_hash:'test-only'};
 const window={__suiteAutoLootCardsInstalled:true,addEventListener(){},removeEventListener(){}},document={hasFocus:()=>true,visibilityState:'visible'};
 const location={href:'https://animesss.tv/labyrinth/'};
 const logs=[],requests=[],replies=[],notices=[],skippedEpisodes=[],timers=new Map(),listeners=new Map();let tid=0,lid=0,processed=0;
 const cptShow=(...args)=>notices.push(args);
 const GM_getValue=async(k,d)=>structuredClone(storage.has(k)?storage.get(k):d);
 const GM_setValue=async(k,v)=>{const old=storage.get(k);storage.set(k,structuredClone(v));for(const l of listeners.values())if(l.key===k)l.fn(k,old,v);};
 const GM_deleteValue=async k=>storage.delete(k);
 const GM_addValueChangeListener=(key,fn)=>{listeners.set(++lid,{key,fn});return lid;},GM_removeValueChangeListener=id=>listeners.delete(id);
 const setTimeout=(fn,ms)=>{timers.set(++tid,{fn,ms});return tid;},clearTimeout=id=>timers.delete(id);
 const suiteTelemetryLog=(module,event,data,level)=>logs.push({module,event,data:data.data,level});
 const diagnosticSanitizeHeaders=()=>({}),diagnosticSanitizeBody=()=>null,diagnosticSanitize=v=>v,diagnosticParseResponse=v=>v;
 const getMoscowTimeString=()=>'',readTabLock=()=>null,suiteGetAuthPause=()=>false,suiteIsAuthenticationError=()=>false;
 const log=()=>{},warn=()=>{},error=()=>{},updateButtonState=()=>{},renderPanelLiveState=()=>{},safePush=()=>{};
 const stopMainCardCheckLogic=()=>{nextRunAt=0;isLoopRunning=false;};
 const isTabVisible=()=>visible,isThisTabLeader=()=>leader,tryAcquireTabLock=()=>leader,claimTabLock=()=>leader,isLockStale=()=>false;
 const refreshAnimeDbEmptyState=async()=>false,clearAnimeDbEmptyState=async()=>{},getMskDateKey=()=> '2026-10-24';
 const updateCardCounter=async()=>{},setDailyProgress=async()=>{},getMsUntilMskMidnight=()=>3600000;
 const state={index:0,ep_offset:2,failed_attempts:1,cards_collected:3};
 const buildOrderedPool=async()=>[{anime_id:1,min_ep:1,s:1,t_id:1,t_title:'T'}],updateSmartTarget=async()=>state,getEpOrder=async()=>[1,2,3];
 const isCurrentServerDayConfirmed=async()=>false,confirmCurrentServerDay=async()=>{},ensureDailyKodikWarmup=async()=>{};
 const processCardReward=async()=>{processed++;},saveRequestLog=async()=>{};
 const saveSkippedEpisode=async data=>skippedEpisodes.push(data);
 const fetch=async(url,opts)=>{requests.push({url,at:now});const reply=replies.shift();if(!reply)throw Error('unexpected network');if(reply instanceof Error)throw reply;return reply;};
 `+funcs,c);
 return {c,run:s=>vm.runInContext(s,c),storage};
}
async function main(){
 // Every stage stops immediately even when requireOk=false on preparation requests.
 for(const stage of [0,1,2]){
  const r=runtime();
  r.run(`for(let i=0;i<${stage};i++)replies.push(new Response('{}'));replies.push(new Response('limited',{status:429}));`);
  await r.run('mainCardCheckLogic()');
  check(r.run('requests.length')===stage+1,'chain stopped at stage '+stage);
  check(r.run('rateLimitUntil-now')===60000,'fixed one minute at stage '+stage);
  check(r.run('state.failed_attempts===1 && state.ep_offset===2 && state.cards_collected===3'),'429 preserves progress');
  check(r.run('skippedEpisodes.length')===0,'429 never skips an episode');
  check(r.run('nextRunAt-now')===60000,'timer schedules cooldown, not 15s');
  check(r.run('getPanelCountdown().full').includes('429'),'existing countdown explains HTTP pause');
  check(r.run("logs.filter(e=>e.event==='rate_limit_paused').length")===1,'one pause record per actual 429');
  check(r.run("logs.find(e=>e.event==='rate_limit_paused').level")==='warn','pause is warning');
  r.run('now+=59999');await r.run('mainCardCheckLogic()');
  check(r.run('requests.length')===stage+1,'no traffic during pause');
  r.run('now+=1;replies.push(new Response("{}"),new Response("{}"),new Response(JSON.stringify({cards:[{id:1}]})))');
  await r.run('mainCardCheckLogic()');
  check(r.run('processed')===1,'reward processing resumes normally');
  check(!r.storage.has('rate_Test'),'successful card response clears cooldown');
  check(r.run("logs.filter(e=>e.event==='rate_limit_resumed').length")===1,'one resume event for entire chain');
  check(r.run("logs.find(e=>e.event==='rate_limit_resumed').data.waitedMs")===60000,'actual wait logged');
  check(r.run("logs.find(e=>e.event==='rate_limit_recovered').level")==='info','recovery is not an error');
 }
 const repeat=runtime();
 for(let i=0;i<4;i++){
  repeat.run("replies.push(new Response('{}',{status:429}))");await repeat.run('mainCardCheckLogic()');
  check(repeat.run('nextRunAt-now')===60000,'repeated 429 does not increase wait '+i);
  repeat.run('now+=60000');
 }
 for(const [header,expected] of [[null,60000],['30',60000],['120',120000],['garbage',60000],['Sat, 24 Oct 2026 12:03:00 GMT',180000]]){
  const r=runtime();r.c.retryHeader=header;
  r.run("replies.push(new Response('limited',{status:429,headers:retryHeader?{'Retry-After':retryHeader}:{}}))");
  await r.run('mainCardCheckLogic()');
  check(r.run('rateLimitUntil-now')===expected,'Retry-After policy '+header);
 }
 const first=runtime();first.run("replies.push(new Response('limited',{status:429}))");await first.run('mainCardCheckLogic()');
 const other=runtime(first.storage);other.run('now+=20000');
 check(await other.run('restoreTimerFromStorage()'),'reload restores pending pause');
 check(other.run('nextRunAt-now')>=40000,'reload retains remaining time');
 other.run('scheduleNext(300)');check(other.run('nextRunAt-now')===40000,'focus cannot shorten known pause');
 await other.run('mainCardCheckLogic()');check(other.run('requests.length')===0,'new tab reads shared pause before any request');
 other.run('now+=40000;visible=false');await other.run('mainCardCheckLogic()');check(other.run('requests.length')===0,'hidden tab does not resume');
 other.run('visible=true;leader=false');await other.run('mainCardCheckLogic()');check(other.run('requests.length')===0,'nonleader does not resume');
 const listener=runtime();listener.run('installStorageListener()');
 await listener.run("GM_setValue(RATE_LIMIT_STATE_KEY,{blockedAt:now,until:now+60000})");
 check(listener.run('nextRunAt-now')===60000,'GM notification updates active timer');
 listener.run('removeStorageListener()');check(listener.run('listeners.size')===0,'all listeners cleaned up');
 // Partial resumption followed by another restriction must not be reported recovered.
 const again=runtime();again.run("replies.push(new Response('limited',{status:429}))");await again.run('mainCardCheckLogic()');
 again.run("now+=60000;replies.push(new Response('{}'),new Response('limited',{status:429}))");await again.run('mainCardCheckLogic()');
 check(again.run("!logs.some(e=>e.event==='rate_limit_recovered')"),'preparatory success is not recovery');
 check(again.run('requests.length')===3,'second restriction prevents reward request');
 await again.run('confirmAutoLootRateLimitRecovery({cards:[]})');check(again.storage.has('rate_Test'),'late successful response cannot clear current pause');
 again.run('now+=60000');await again.run("checkAutoLootRateLimit('/ajax/card_for_watch/')");
 await again.run('confirmAutoLootRateLimitRecovery(null)');check(again.storage.has('rate_Test'),'null response is not recovery');
 const failed=runtime();failed.run("replies.push(new Response('limited',{status:429}))");await failed.run('mainCardCheckLogic()');
 failed.run("now+=60000;replies.push(new Error('offline'))");await failed.run('mainCardCheckLogic()');
 check(failed.run("!logs.some(e=>e.event==='rate_limit_recovered')"),'network failure after pause is not recovery');
 const empty=runtime();empty.run('state.failed_attempts=0');
 empty.run("replies.push(new Response('{}'),new Response('{}'),new Response(JSON.stringify({reason:'no'})))");await empty.run('mainCardCheckLogic()');
 check(empty.run("notices[0][2]==='Карта не выпала' && notices[0][3]==='Повторим через 15 секунд.'"),'first empty response has short retry notice');
 check(empty.run('state.failed_attempts===1 && skippedEpisodes.length===0 && nextRunAt-now===15000'),'ordinary retry logic unchanged');
 empty.run("now+=15000;replies.push(new Response('{}'),new Response('{}'),new Response(JSON.stringify({reason:'no'})))");await empty.run('mainCardCheckLogic()');
 check(empty.run("notices[1][2]==='Переходим к следующей серии' && notices[1][3]==='Карта не выпала за 2 попытки.'"),'threshold uses attempt count before reset');
 check(empty.run('state.failed_attempts===0 && skippedEpisodes.length===1'),'threshold still skips and resets');
 check(empty.run("notices.every(n=>n[4]==='cpt-neon-blue')"),'empty result stays informational blue');
 const custom=runtime();custom.storage.set('maxFailures',5);custom.run('state.failed_attempts=4');
 custom.run("replies.push(new Response('{}'),new Response('{}'),new Response(JSON.stringify({reason:'no'})))");await custom.run('mainCardCheckLogic()');
 check(custom.run("notices[0][3]==='Карта не выпала за 5 попыток.'"),'custom attempt threshold appears in notice');
 custom.run("handleCardError('no','site')");check(custom.run("notices[1][2]==='Карта не выпала' && notices[1][3]===''"),'site response does not promise an automatic retry');
 console.log(JSON.stringify({result:'AUTOLOOT_RATE_LIMIT_OK',checks}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
