// Offline tests of actual userscript functions, with a deterministic clock/DOM.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(src);
function extract(name){
  const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(src);
  assert.ok(m,name);const lines=src.slice(m.index).split(/\r?\n/);
  for(let n=2;n<=lines.length;n++){
    if(lines[n-1]!==m[1]+'}')continue;
    const code=lines.slice(0,n).join('\n');
    try{new vm.Script('('+code+')');return code;}catch{}
  }throw Error(name);
}
const ctx=vm.createContext({assert,console,URLSearchParams});
vm.runInContext(String.raw`
let passed=0;const check=(v,m)=>{assert.ok(v,m);passed++;};
let now=100000;const Date={now:()=>now};
let callback=null,disconnected=0,appended=0;
const document={head:null,visibilityState:'visible',querySelector:()=>({getAttribute:()=>stage})};
class MutationObserver{constructor(fn){callback=fn;}observe(target,opts){check(target===document&&opts.childList,'observe document before root exists');}disconnect(){disconnected++;}}
let stage='ready',ready=true,cards=true,best=1;
let suiteHealthVisibleSince=0;
const cfg={autoOpenEnabled:true,autoOpenTarget:0};
const AUTO_DIAGNOSTIC_STALL_MS=10000,AUTO_DELAY_AFTER_PICK=650,AUTO_DELAY_WAIT_CLOSE=350;
let autoExpectation=null,autoPendingChoice=null,autoPackRetry=null,autoWaitingManual=false;
let autoSchedulerMissingSinceAt=0,autoBusySinceAt=0,autoBusy=false,autoLoopTimer=1,autoOpenedCount=0;
const autoCountedPackIds=new Set();let scheduled=0,saved=0;
const issues=[],resolved=[];
const isAutoOpenAvailable=()=>true,autoPackReady=()=>ready,hasOpenCardsReady=()=>cards;
const getVisibleBestCards=()=>Array(best).fill({}),autoDiagnosticRecord=()=>{};
const autoReportDiagnosticStall=(code,details)=>issues.push({code,details});
const clearAutoChoiceWatch=()=>{},saveAutoOpenedCount=()=>saved++,updateAutoCount=()=>{};
const stopAutoOpen=()=>{cfg.autoOpenEnabled=false;},scheduleAutoLoop=()=>scheduled++,setAutoStatus=()=>{};
function wait(kind,age=11000){autoExpectation={kind,key:kind,startedAt:now-age,reported:false};}
function reset(){issues.length=0;autoPendingChoice=null;autoExpectation=null;cfg.autoOpenEnabled=true;stage='ready';ready=true;cards=true;best=1;autoLoopTimer=1;autoBusy=false;autoBusySinceAt=0;autoSchedulerMissingSinceAt=0;suiteHealthVisibleSince=0;document.visibilityState='visible';}
`,ctx);
vm.runInContext(['suiteAttachGlobalStyle','autoDiagnosticVisibleElapsed','autoReconcileDiagnosticExpectation','autoCheckDiagnosticProgress','autoCheckChoice','autoResolveExpectation','autoDiagnosticLikelyCauses','suiteRunLightweightHealthCheck'].map(extract).join('\n'),ctx);
vm.runInContext(String.raw`
const style={};suiteAttachGlobalStyle(style);
check(appended===0,'early style attachment does not throw');
callback();check(disconnected===0,'wait until head appears');
document.head={appendChild(node){check(node===style,'original style preserved');appended++;}};
callback();check(appended===1&&disconnected===1,'attach once and disconnect');
suiteAttachGlobalStyle(style);check(appended===2,'existing head attaches synchronously');
for(const kind of ['cards_after_buy','pack_animation_ready','best_card_highlight']){
 reset();wait(kind);autoCheckDiagnosticProgress();
 check(issues.length===0&&autoExpectation===null,'completed '+kind+' is not a stall');
}
reset();wait('pack_animation_ready');stage='revealing';ready=false;
autoCheckDiagnosticProgress();check(issues[0]?.code==='pack_animation_not_finished','real animation stall retained');
autoCheckDiagnosticProgress();check(issues.length===1,'expectation reported once');
reset();wait('cards_after_buy',9999);cards=false;
autoCheckDiagnosticProgress();check(issues.length===0,'not before 10 seconds');
now++;autoCheckDiagnosticProgress();check(issues[0]?.code==='pack_cards_not_appeared','at 10 seconds');
reset();wait('cards_after_buy',60000);cards=false;document.visibilityState='hidden';
autoCheckDiagnosticProgress();check(issues.length===0,'hidden time is not an incident');
document.visibilityState='visible';suiteHealthVisibleSince=now;
autoCheckDiagnosticProgress();check(issues.length===0,'resume grace');
now+=9999;autoCheckDiagnosticProgress();check(issues.length===0,'resume grace lasts 10 seconds');
now++;autoCheckDiagnosticProgress();check(issues.length===1,'continued visible stall diagnosed');
reset();wait('pack_close_after_card');
autoPendingChoice={packId:'old',startedAt:now-20000,row:{isConnected:true,getAttribute:()=> 'next'}};
autoCheckDiagnosticProgress();check(!autoPendingChoice&&!autoExpectation&&issues.length===0,'changed pack reconciled before warning');
check(autoOpenedCount===1&&saved===1,'choice counted once');autoCheckDiagnosticProgress();check(autoOpenedCount===1,'watchdog does not recount');
reset();wait('pack_close_after_card');
autoPendingChoice={packId:'same',startedAt:now-20000,row:{isConnected:true,getAttribute:()=> 'same'}};
document.visibilityState='hidden';autoCheckChoice();check(cfg.autoOpenEnabled&&issues.length===0,'hidden confirmation wait does not stop');
document.visibilityState='visible';suiteHealthVisibleSince=now;autoCheckChoice();check(cfg.autoOpenEnabled,'choice resume grace');
now+=10000;autoCheckChoice();check(!cfg.autoOpenEnabled&&issues[0]?.code==='pack_did_not_close_after_card_pick','real unconfirmed choice stops after grace');
reset();autoBusy=true;autoBusySinceAt=now-20000;autoCheckDiagnosticProgress();check(issues[0]?.code==='auto_open_busy_stalled','busy stall retained');
reset();autoLoopTimer=null;autoSchedulerMissingSinceAt=now-20000;autoCheckDiagnosticProgress();check(issues[0]?.code==='auto_open_loop_stalled','missing scheduler diagnosed');
reset();wait('best_card_highlight');best=0;autoCheckDiagnosticProgress();check(issues[0]?.code==='best_card_highlight_stalled','missing highlight diagnosed');
const snapshot={online:true,buyButton:{present:true,disabled:true,display:'none'},selectedPack20:false,visibleLoaders:[],stoneBalance:null};
check(autoDiagnosticLikelyCauses(snapshot,{kind:'pack_close_after_card'}).length===0,'normal hidden buy button not blamed while choosing');
check(autoDiagnosticLikelyCauses(snapshot,{kind:'cards_after_buy'}).includes('buy_button_disabled'),'buy diagnostics kept in buy stage');
reset();suiteHealthVisibleSince=now-60000;cfg.modCardValue=true;cfg.modBestCard=true;
const window={__suiteMainInitialized:true};window.top=window;
const location={pathname:'/cards/pack/',search:''},CLUB_WAR_ROUTE_RE=/clubs/;
const suiteGetCurrentUserName=()=>'',suiteDecodeNickname=v=>v;
const suiteSelfDiagnosticIssue=(_module,code)=>issues.push({code});
let valued=false,isPackCard=true;
const healthRow={querySelector:s=>s.includes('.card-value')&&valued?{}:null,querySelectorAll:()=>[healthCard]};
const healthCard={querySelectorAll:()=>Array(4).fill({}),querySelector:()=>valued?{}:null,matches:()=>isPackCard,closest:()=>healthRow};
const getActiveRow=()=>healthRow;
document.querySelector=()=>null;
document.querySelectorAll=s=>s==='.lootbox__card,.trade__main-item'?[healthCard]:[];
document.getElementById=id=>id==='suite-settings-btn'?{}:null;
ready=false;suiteRunLightweightHealthCheck();check(issues.length===0,'animation excluded from card value health contract');
ready=true;suiteRunLightweightHealthCheck();check(issues.length===1&&issues[0].code==='card_value_not_rendered','ready card missing values still reported');
issues.length=0;valued=true;ready=false;suiteRunLightweightHealthCheck();check(issues.length===0,'animation excluded from highlight health contract');
ready=true;suiteRunLightweightHealthCheck();check(issues.length===1&&issues[0].code==='best_card_not_highlighted','ready card missing highlight still reported');
issues.length=0;valued=false;ready=false;isPackCard=false;suiteRunLightweightHealthCheck();check(issues.length===1&&issues[0].code==='card_value_not_rendered','trade card diagnosis unaffected');
console.log('DIAGNOSTIC_PROGRESS_OK; assertions='+passed);
`,ctx);
