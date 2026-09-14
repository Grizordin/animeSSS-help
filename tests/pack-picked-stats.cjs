// Offline browser regression: use real statistics and choice handlers, no site/network calls.
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
const names=['recordCard','saveStats','saveSeenPicks','getCountForFilter','buildStatsHTML',
 'parseStat','getRareFactor','stretchToOne','calcCardValue','calcTradeSValue','calcBadCardValue','getCardRank','isGoldSCard','getCardId','computeCardValue',
 'capturePackPick','captureAutoPackPick','recordConfirmedPackPick','clearManualPackPick','checkManualPackPick','onCardPicked','handlePackCardClick','getActiveRow',
 'autoPackReady','autoBeginChoice','autoCheckChoice','watchAutoChoice','clearAutoChoiceWatch','autoClickBestCard','handleAutoManualPick'];
const constants=source.slice(source.indexOf('  const rankMap ='),source.indexOf('  const todayKey ='));
const setup=String.raw`
let passed=0;function check(v,m){if(!v)throw Error(m);passed++;}
const cfg={modStats:true,modGuard:false,guardThreshold:0,autoOpenEnabled:true,autoOpenTarget:0};
let stats={allCards:{},pickedCards:{}},seenPickIds=new Set(),statsFilter='all';
const lastRank={S:0,PLUS:0,ASS:0,currentS:0,currentPlus:0,currentASS:0};
const todayKey='2026-09-14',STATS_KEY='cardStats_v4',saved={};
const gmSet=(k,v)=>saved[k]=JSON.parse(JSON.stringify(v)),renderStatsTab=()=>{};
let manualPackPick=null,manualPackPickObserver=null,autoPendingChoice=null;
let autoChoiceObserver=null,autoChoiceTimer=null,autoRunGeneration=0,autoOpenedCount=0;
const autoCountedPackIds=new Set();let autoBusy=false,autoWaitingManual=false,autoOpenSuppressGuard=false;
let autoLastChosenPackId='',autoManualPackId='',confirmedCard=null,guardOpen=false;
const isConfirmDialogOpen=()=>guardOpen,showConfirmDialog=c=>{guardOpen=true;confirmedCard=c;};
const hideBestCardReasonsForPack=()=>{},autoStartExpectation=()=>{},autoResolveExpectation=()=>{},autoDiagnosticRecord=()=>{};
const autoReportDiagnosticStall=()=>{},saveAutoOpenedCount=()=>{},updateAutoCount=()=>{};
const autoDiagnosticVisibleElapsed=at=>Date.now()-at,stopAutoOpen=()=>cfg.autoOpenEnabled=false;
const setAutoStatus=()=>{},scheduleAutoLoop=()=>{},getAutoCardIdentity=c=>c.dataset.id;
const needsAutoRareViewDelay=()=>false,highlightBestCard=()=>{},isAutoOpenAvailable=()=>true;
const AUTO_DIAGNOSTIC_STALL_MS=10000,AUTO_DELAY_AFTER_PICK=650,AUTO_DELAY_WAIT_CLOSE=350,AUTO_DELAY_RARE_VIEW=3000;
document.body.innerHTML='<div class="lootbox"><section class="packs-stage" data-pack-state="ready"></section></div>';
const stage=document.querySelector('.packs-stage');
const flush=()=>new Promise(r=>setTimeout(r,0));
function makeCard(id,rank='B',numbers=true){
 stage.dataset.packState='ready';
 stage.innerHTML='<div class="lootbox__row" data-pack-id="'+id+'"><div class="lootbox__list"><button class="lootbox__card cv-best-card" data-id="c-'+id+'" data-rank="'+rank+'">Card'+(numbers?'<div class="card-stats"><span>1000</span><span>100</span><span>50</span><span>1</span></div>':'')+'</button></div></div>';
 return stage.querySelector('.lootbox__card');
}
function success(card){
 card.closest('.lootbox__row').removeAttribute('data-pack-id');
 card.remove();stage.dataset.packState='loading';
}
function total(){return Object.values(stats.pickedCards).reduce((n,s)=>n+s.count,0);}
function reset(){
 clearAutoChoiceWatch();manualPackPickObserver?.disconnect();manualPackPickObserver=null;manualPackPick=null;
 autoPendingChoice=null;seenPickIds.clear();autoCountedPackIds.clear();autoOpenedCount=0;
 stats={allCards:{},pickedCards:{}};cfg.modStats=true;cfg.modGuard=false;cfg.autoOpenEnabled=true;
 autoWaitingManual=false;autoOpenSuppressGuard=false;confirmedCard=null;guardOpen=false;
}
`;
const tests=String.raw`
// Direct auto path deliberately has NO click listener from the helper installed.
for(let i=0;i<200;i++){
 const card=makeCard('auto-'+i);card.addEventListener('click',()=>success(card));
 autoClickBestCard(card);await flush();
}
check(autoOpenedCount===200&&total()===200,'200 automatic choices produce 200 received cards without click tracking');
check(saved.cardStats_v4.pickedCards.B.count===200&&saved.seenPickIds.length===200,'200 selections persisted and deduplicated');
check(!autoPendingChoice&&!autoChoiceObserver,'auto watcher cleaned up');

reset();let card=makeCard('late-auto');autoBeginChoice(card);
const snapshot=autoPendingChoice.statsPick;check(Object.isFrozen(snapshot),'immutable automatic snapshot');
card.dataset.rank='E';card.querySelector('.card-stats').remove();
cfg.autoOpenEnabled=false;success(card);await flush();
check(autoOpenedCount===1&&stats.pickedCards.B.count===1,'late success after auto stop uses original rank and value');
check(recordConfirmedPackPick(snapshot)===false&&total()===1,'duplicate confirmation ignored');

reset();card=makeCard('auto-error');autoBeginChoice(card);stage.dataset.packState='error';await flush();
check(total()===0&&seenPickIds.size===0,'auto error not counted or marked seen');
stage.dataset.packState='ready';await flush();check(total()===0,'same pack after retry not counted');
success(card);await flush();check(total()===1&&autoOpenedCount===1,'recovered automatic choice counts once');

reset();card=makeCard('next-load-error');autoBeginChoice(card);success(card);stage.dataset.packState='error';await flush();
check(total()===0&&!!autoPendingChoice,'next-pack error retains snapshot until reconciliation');
makeCard('next-ready');await flush();check(total()===1,'next-pack recovery reconciles previous choice');

reset();document.addEventListener('click',handlePackCardClick,true);
card=makeCard('manual-fast');const expected=computeCardValue(card).value;
card.addEventListener('click',()=>success(card));card.click();await flush();
check(total()===1&&stats.pickedCards.B.totalValue===expected,'immediate manual DOM removal preserves choice');
check(autoOpenedCount===0,'ordinary manual choice does not change auto counter');
check(!manualPackPick&&!manualPackPickObserver,'manual watcher disconnected after success');

card=makeCard('manual-slow');card.click();await flush();
check(total()===1&&!seenPickIds.has('manual-slow'),'click alone does not count');
stage.dataset.packState='choosing';card.click();await flush();
check(total()===1,'duplicate click during choosing does not count');
success(card);await flush();check(total()===2,'delayed manual success counts');

card=makeCard('manual-fail');card.click();stage.dataset.packState='error';await flush();
check(total()===2&&!seenPickIds.has('manual-fail'),'failed manual choice does not count');
stage.dataset.packState='ready';card.dataset.rank='A';card.click();success(card);await flush();
check(total()===3&&stats.pickedCards.A.count===1,'manual retry captures the card actually selected');

reset();card=makeCard('auto-with-click');card.addEventListener('click',()=>success(card));autoClickBestCard(card);await flush();
check(total()===1&&autoOpenedCount===1&&!manualPackPickObserver,'auto and click paths do not double-count');
card=makeCard('manual-pause');autoWaitingManual=true;autoManualPackId='manual-pause';
card.addEventListener('click',()=>success(card));card.click();await flush();
check(total()===2&&autoOpenedCount===2&&!autoWaitingManual,'manual choice in auto pause shares auto confirmation');

reset();card=makeCard('manual-to-auto');card.click();stage.dataset.packState='error';await flush();
stage.dataset.packState='ready';card.dataset.rank='A';card.dataset.id='another-card';
card.addEventListener('click',()=>success(card));autoClickBestCard(card);await flush();
check(total()===1&&stats.pickedCards.A.count===1&&!stats.pickedCards.B,'auto retry replaces failed manual snapshot');

reset();card=makeCard('auto-to-manual');autoClickBestCard(card);stage.dataset.packState='error';await flush();
clearAutoChoiceWatch(); // The stopped run's bounded watcher may already have expired.
cfg.autoOpenEnabled=false;stage.dataset.packState='ready';card.dataset.rank='A';card.dataset.id='another-card';
card.addEventListener('click',()=>success(card));card.click();await flush();
check(total()===1&&stats.pickedCards.A.count===1&&!stats.pickedCards.B,'manual retry replaces failed auto snapshot');

reset();card=makeCard('guard');cfg.modGuard=true;card.click();await flush();
check(guardOpen&&total()===0&&!manualPackPick,'guard first click neither dispatches nor counts');
guardOpen=false;confirmedCard=null;check(total()===0,'cancelled guard not counted');
card.click();guardOpen=false;card.addEventListener('click',()=>success(card));card.click();await flush();
check(total()===1,'confirmed guarded choice counted');

reset();card=makeCard('unknown-value','C',false);card.click();success(card);await flush();
check(total()===1&&stats.pickedCards.C.missingValueCount===1,'known rank still counted without value data');
check(stats.pickedCards.C.totalValue===0&&buildStatsHTML('pickedCards').includes('— / —'),'unknown value not invented as zero minimum');
card=makeCard('known-value','C');const value=computeCardValue(card).value;card.click();success(card);await flush();
check(stats.pickedCards.C.count===2&&stats.pickedCards.C.minValue===value,'known minimum ignores unknown value');
check(buildStatsHTML('pickedCards').includes('>'+value.toFixed(2)+'</td>'),'average excludes missing values');

reset();card=makeCard('missing-rank');card.removeAttribute('data-rank');card.click();await flush();
check(total()===0&&seenPickIds.size===0,'missing rank not marked seen');
card.dataset.rank='B';card.click();success(card);await flush();check(total()===1,'retry with valid rank works');

reset();cfg.modStats=false;card=makeCard('stats-disabled');card.addEventListener('click',()=>success(card));autoClickBestCard(card);await flush();
check(total()===0&&autoOpenedCount===1,'stats setting respected independently of auto counter');
reset();card=makeCard('hidden-row');card.click();card.closest('.lootbox__row').style.display='none';await flush();
check(total()===0,'hidden row alone is not confirmation');
success(card);await flush();check(total()===1,'hidden row later confirmed');
reset();
window.testResult={passed};
`;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL||'msedge'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.abort());
  await page.setContent('<!doctype html><body></body>');
  await page.evaluate('(async()=>{'+constants+setup+names.map(extract).join('\n')+tests+'})()');
  if(errors.length)throw Error(errors.join('\n'));
  console.log(JSON.stringify({result:'PACK_PICKED_STATS_OK',...await page.evaluate(()=>window.testResult)}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
