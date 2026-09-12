// Offline browser tests: no site requests, purchases or card selections are sent.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
function extract(name){
  const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(source);
  if(!m)throw Error(name);
  const lines=source.slice(m.index).split(/\r?\n/);
  for(let n=1;n<=lines.length;n++){
    if(n>1&&lines[n-1]!==m[1]+'}')continue;
    const code=lines.slice(0,n).join('\n');
    try{new vm.Script('('+code+')');return code;}catch{}
  }
  throw Error('extract '+name);
}
const map=source.slice(source.indexOf('  const CPT_MAP = ['),source.indexOf('  function cptResolve('));
const messages=[
 ['Не удалось получить ответ сервера. Повторите загрузку паков.','Паки'],
 ['В витрину можно выставить максимум три пробужденные карты SSS','Витрина'],
 ['Вы успешно приобрели "Звездное дитя эдит"','Покупка'],
 ['Сначала открой одни из врат испытания Дао','Дао'],
 ['Сменить испытание можно только с 06:00 до 23:58 по МСК.','Испытание'],
 ['Для переплавки нужны три карточки одинакового ранга','Переплавка'],
 ['Вы уже ставили реакцию на данный список','Реакция'],
 ['Вы получили 600 ACC.','ACC'],
 ['Вы получили 1 200 АСС.','ACC'],
 ['В витрину можно выставить максимум три пробуждённые карты SSS','Витрина'],
 ['Вы успешно приобрели «Другой товар»','Покупка']
];
let notificationChecks=0;
const context=vm.createContext({messages,check(v,m){if(!v)throw Error(m);notificationChecks++;}});
vm.runInContext(map+extract('cptResolve')+`
 for(const [text,title] of messages){
   const matches=CPT_MAP.filter(r=>r.r?r.r.test(text):text.toLowerCase().includes(r.s.toLowerCase()));
   check(matches.length===1,'exactly one rule: '+text+' matches='+matches.length);
   check(cptResolve(text)?.title===title,'category: '+text);
 }
 const keys=CPT_MAP.map(r=>r.r?'r:'+r.r.toString():'s:'+r.s.toLowerCase());
 check(new Set(keys).size===keys.length,'no duplicate rules');
 check(cptResolve('Вы получили неизвестную награду.')===null,'unknown reward remains unknown');
`,context);
const names=['suiteCardActionButtonReady','getActiveRow','getCardsFromActiveRow','hasOpenCardsReady','autoPackReady','getAutoPackRetryButton','autoHandlePackRetry','autoBeginChoice','autoCheckChoice','autoBuyPack','autoOpenStep','getCurrentStoneBalance','setupBuyButtonGuard','clickBuyButton'];
const setup=String.raw`
let suiteHealthVisibleSince=0;
${extract('autoDiagnosticVisibleElapsed')}
let passed=0;const check=(v,m)=>{if(!v)throw Error(m);passed++;};
let now=100000;Date.now=()=>now;
let cfg={autoOpenEnabled:true,autoOpenTarget:0,modGuard:true};
let autoPackRetry=null,autoPendingChoice=null,autoLastChosenPackId='',autoOpenedCount=0,autoBusy=false,autoExpectation=null;
let autoRunGeneration=0;const autoCountedPackIds=new Set(),watchAutoChoice=()=>{},clearAutoChoiceWatch=()=>{};
const AUTO_PACK_RETRY_DELAYS=[2000,5000,10000],AUTO_DIAGNOSTIC_STALL_MS=10000,AUTO_DELAY_WAIT_CLOSE=350,AUTO_DELAY_BEFORE_BUY=180,AUTO_DELAY_AFTER_BUY=1000,AUTO_DELAY_WAIT_HIGHLIGHT=500;
let status='',reports=[],records=[],stops=[],scheduled=0,bought=0,selected=0,chosen=0,confirms=0;
const setAutoStatus=s=>status=s;
const stopAutoOpen=s=>{stops.push(s);cfg.autoOpenEnabled=false;autoPackRetry=null;autoPendingChoice=null;};
const autoReportDiagnosticStall=(c,d)=>reports.push({c,d});
const autoDiagnosticRecord=(c,d)=>records.push({c,d});
const scheduleAutoLoop=()=>scheduled++;
const autoStartExpectation=(kind)=>autoExpectation={kind};
const autoResolveExpectation=()=>autoExpectation=null;
const saveAutoOpenedCount=()=>{},updateAutoCount=()=>{},getAutoCardIdentity=c=>c.dataset.id;
const autoCheckDiagnosticProgress=()=>{},isPremiumLockedSetting=()=>false,warnPremiumRequired=()=>{},warnCardStatsDemandRequired=()=>false,isAutoOpenAvailable=()=>true;
let activeCost=100;
const selectPack20=()=>{selected++;activeCost=1600;},isPack20Active=()=>true;
const addCardValue=()=>{},getVisibleBestCards=()=>[document.querySelector('.lootbox__card')],autoClickBestCard=()=>chosen++;
const getActivePack20Cost=()=>activeCost,showPackConfirmDialog=()=>confirms++;
let timer=null;window.setTimeout=(fn,delay)=>{timer={fn,delay};return 1;};
document.body.innerHTML='<div class="packs-stage" data-pack-state="error"><div class="lootbox__row" data-pack-id="old" style="display:none"><div class="lootbox__list"><div class="lootbox__card" data-id="1">Card</div></div></div></div><div class="lootbox__footer"><button class="lootbox__open-btn">Повторить загрузку</button></div><span class="lootbox__balance">0</span>';
const stage=document.querySelector('.packs-stage'),row=document.querySelector('.lootbox__row'),button=document.querySelector('button'),card=row.querySelector('.lootbox__card');
let loads=0;
button.addEventListener('click',()=>{
 if(button.textContent==='Повторить загрузку'){loads++;stage.dataset.packState='loading';button.disabled=true;}
 else bought++;
});
function reset(){
 cfg.autoOpenEnabled=true;cfg.autoOpenTarget=0;autoPackRetry=null;autoPendingChoice=null;autoLastChosenPackId='';autoOpenedCount=0;autoBusy=false;autoExpectation=null;autoCountedPackIds.clear();
 reports=[];records=[];stops=[];scheduled=0;bought=0;selected=0;chosen=0;loads=0;timer=null;activeCost=100;
 stage.dataset.packState='error';row.dataset.packId='old';row.style.display='none';button.disabled=false;button.style.display='';button.textContent='Повторить загрузку';
}
function loadReady(id='next'){
 stage.dataset.packState='ready';row.dataset.packId=id;row.style.display='';button.style.display='none';button.disabled=false;
}
`;
const tests=String.raw`
setupBuyButtonGuard();
check(!!getAutoPackRetryButton(),'recognizes visible retry');
button.disabled=true;check(!getAutoPackRetryButton(),'disabled retry ignored');button.disabled=false;
button.parentElement.style.display='none';check(!getAutoPackRetryButton(),'hidden ancestor ignored');button.parentElement.style.display='';
button.textContent='Купить';check(!getAutoPackRetryButton(),'purchase never classified as retry');button.textContent='Повторить загрузку';
autoOpenStep();check(loads===0&&!!autoPackRetry&&stops.length===0,'error schedules recovery, does not stop');
now+=1999;autoOpenStep();check(loads===0,'backoff respected');now++;autoOpenStep();
check(loads===1&&bought===0&&selected===0,'retry with zero stones never buys or changes pack count');
check(confirms===0,'retry bypasses purchase confirmation');
for(let i=0;i<20;i++)autoOpenStep();check(loads===1&&stops.length===0,'no overlapping reloads');
loadReady();autoOpenStep();check(autoPackRetry===null&&chosen===1&&autoOpenedCount===0,'loaded pack resumes choice, reload is not a chosen card');
reset();row.style.display='';autoBeginChoice(card);row.style.display='none';
autoOpenStep();now+=2000;autoOpenStep();loadReady();autoOpenStep();
check(autoOpenedCount===1&&chosen===1&&stops.length===0,'lost choice response reconciled by next loaded pack');
autoCheckChoice();check(autoOpenedCount===1,'choice only counted once');
reset();row.style.display='';autoBeginChoice(card);row.removeAttribute('data-pack-id');row.style.display='none';
autoOpenStep();now+=2000;autoOpenStep();loadReady();cfg.autoOpenTarget=1;autoOpenStep();
check(autoOpenedCount===1&&!cfg.autoOpenEnabled&&chosen===0&&bought===0,'successful choice then load error respects target');
reset();row.style.display='';autoBeginChoice(card);row.style.display='none';autoOpenStep();now+=2000;autoOpenStep();loadReady('old');autoOpenStep();
check(!cfg.autoOpenEnabled&&chosen===0&&autoOpenedCount===0,'same unresolved pack is not chosen again');
check(reports[0]?.c==='pack_choice_unconfirmed_after_reload','uncertainty diagnosed');
reset();row.style.display='';autoBeginChoice(card);row.style.display='none';autoOpenStep();now+=2000;autoOpenStep();
stage.dataset.packState='idle';row.removeAttribute('data-pack-id');button.textContent='Купить';button.disabled=false;cfg.autoOpenTarget=1;autoOpenStep();
check(autoOpenedCount===1&&!cfg.autoOpenEnabled&&bought===0,'empty loaded queue confirms choice and respects target');
reset();autoOpenStep();now+=2000;autoOpenStep();stage.dataset.packState='idle';row.removeAttribute('data-pack-id');button.textContent='Купить';button.disabled=false;
document.querySelector('.lootbox__balance').textContent='3200';autoOpenStep();
check(!!timer&&selected===1&&bought===0,'purchase only scheduled after successful empty load');
timer.fn();check(bought===1&&confirms===0,'ordinary 20-pack purchase resumes only after empty load');
reset();button.textContent='Купить';button.click();check(bought===0&&confirms===1,'small-pack purchase still protected by guard');
reset();autoOpenStep();
for(const [i,delay] of AUTO_PACK_RETRY_DELAYS.entries()){
 now+=delay;autoOpenStep();check(loads===i+1,'bounded retry '+i);
 stage.dataset.packState='error';button.disabled=false;autoOpenStep();
}
check(loads===3&&!cfg.autoOpenEnabled&&bought===0,'three failures stop with no purchase');
check(reports.at(-1)?.c==='pack_reload_failed','exhausted recovery diagnosed');
reset();autoOpenStep();now+=2000;autoOpenStep();now+=10001;autoOpenStep();
check(!cfg.autoOpenEnabled&&loads===1,'hung reload stops at ten seconds without another request');
reset();autoOpenStep();cfg.autoOpenEnabled=false;now+=2000;autoOpenStep();check(loads===0,'user stop cancels retry');
reset();button.textContent='Купить';autoOpenStep();check(!cfg.autoOpenEnabled&&loads===0&&bought===0,'unknown error fails closed');
reset();stage.dataset.packState='idle';row.removeAttribute('data-pack-id');button.textContent='Купить';
autoBuyPack();const delayed=timer;stage.dataset.packState='error';button.textContent='Повторить загрузку';delayed.fn();
check(bought===0&&loads===0&&autoPackRetry!==null&&!autoBusy,'buy callback rechecks changed button');
reset();stage.dataset.packState='idle';row.removeAttribute('data-pack-id');button.textContent='Купить';autoBuyPack();const delayed2=timer;loadReady();delayed2.fn();
check(bought===0&&!autoBusy,'buy callback cannot purchase over newly loaded cards');
reset();autoBuyPack();check(selected===0&&bought===0&&autoPackRetry!==null,'direct autobuy also routes retry separately');
window.retryResult={passed};
`;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL||'msedge'});
 try{
  const page=await browser.newPage();await page.route('**/*',r=>r.abort());
  await page.evaluate(setup+'\n'+names.map(extract).join('\n')+'\n'+tests);
  console.log(JSON.stringify({result:'PACK_RETRY_NOTIFICATIONS_OK',notificationChecks,...await page.evaluate(()=>window.retryResult)}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
