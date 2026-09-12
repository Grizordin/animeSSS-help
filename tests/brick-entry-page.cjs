// Actual entry function + deterministic native-filter mock. No real requests.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(src);
function extract(name){
 const m=new RegExp('^([ \\t]*)function '+name+'\\(','m').exec(src);
 assert.ok(m,name);const lines=src.slice(m.index).split(/\r?\n/);
 for(let n=1;n<=lines.length;n++){
  if(n>1&&lines[n-1]!==m[1]+'}')continue;
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }throw Error(name);
}
const ctx=vm.createContext({assert,console});
vm.runInContext(String.raw`
let passed=0;const check=(v,m)=>{assert.ok(v,m);passed++;};
let now=0,next=0,rank,select,forge,list,counter,brickBusy=false,brickTradePending=false;
let pages=3,delay=50,reply=true,sync=false,wrong=false;
const timers=new Map(),listeners=new Map(),jumps=[],issues=[],brickCleanup=[];
const brickAbort={signal:{aborted:false}},Date={now:()=>now};
const setTimeout=(fn,ms)=>{timers.set(++next,{fn,at:now+ms});return next;},clearTimeout=id=>timers.delete(id);
const suiteSelfDiagnosticIssue=(...args)=>issues.push(args);
const document={querySelector:()=>rank,getElementById:id=>id==='celestialForge'?forge:select,
 addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);}};
function advance(ms){const end=now+ms;for(;;){const entry=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!entry||entry[1].at>end)break;now=entry[1].at;timers.delete(entry[0]);entry[1].fn();}now=end;}
function render(page,count){counter.textContent=(count?page:0)+' / '+count;list.firstChild={};select.firstChild=count?{}:null;select.options=Array.from({length:count},(_,i)=>({value:String(i+1)}));select.value=count?String(page):'';select.disabled=!count;forge.dataset.filterBusy='false';}
const nativeFilter=page=>{jumps.push(page);forge.dataset.filterBusy='true';if(!reply)return;
 const complete=()=>render(wrong&&page>1?1:Math.min(page,pages),pages);
 if(sync)complete();else setTimeout(complete,delay);
};
let pageWindow={CelestianFilterAjax:nativeFilter};const getPageWindow=()=>pageWindow;
function reset(){brickCleanup.splice(0).forEach(fn=>fn());timers.clear();listeners.clear();jumps.length=0;issues.length=0;now=0;brickBusy=false;brickTradePending=false;brickAbort.signal.aborted=false;
 pages=3;delay=50;reply=true;sync=false;wrong=false;pageWindow={CelestianFilterAjax:nativeFilter};
 rank={dataset:{rank:''}};list={firstChild:null};counter={textContent:'0 / 0'};
 forge={dataset:{filterBusy:'false',initialized:'true'},querySelector:s=>s==='#info_filter_page'?counter:list};
 select={value:'',disabled:true,options:[],firstChild:null};
}
function manual(trusted=true){listeners.get('click')?.({isTrusted:trusted,target:{closest:()=>({})}});}
`,ctx);
vm.runInContext(['getPageSelect','getLastPage','getCurrentPage','initBrickEntryPage'].map(extract).join('\n'),ctx);
vm.runInContext(String.raw`
reset();initBrickEntryPage();advance(99);check(!jumps.length,'no premature request');advance(1);check(jumps.join()==='1','empty pager refreshed immediately');advance(1000);
check(jumps.join()==='1,3'&&counter.textContent==='3 / 3','fresh last page loaded');check(!timers.size&&!listeners.size&&!issues.length,'confirmed navigation cleans up');
reset();render(1,286);pages=4;initBrickEntryPage();advance(1000);check(jumps.join()==='1,4','stale HTML count never requested');
reset();render(4,4);pages=4;initBrickEntryPage();advance(1000);check(jumps.join()==='1,4','existing last page refreshed against current collection');
reset();pages=1;initBrickEntryPage();advance(1000);check(jumps.join()==='1'&&counter.textContent==='1 / 1','one page refresh only');
reset();pages=0;initBrickEntryPage();advance(1000);check(jumps.join()==='1'&&!issues.length&&!listeners.size,'genuinely empty filter stops without retry');
reset();rank.dataset.rank='a';initBrickEntryPage();advance(1000);check(!jumps.length&&!listeners.size,'specific rank unchanged');
reset();forge.dataset.initialized='false';initBrickEntryPage();advance(12000);check(!jumps.length,'wait beyond old eight-second cutoff');forge.dataset.initialized='true';advance(1000);check(jumps.join()==='1,3','late site initialization supported');
reset();delay=12000;initBrickEntryPage();advance(25000);check(jumps.join()==='1,3'&&counter.textContent==='3 / 3','slow AJAX supported without duplicate requests');
reset();sync=true;initBrickEntryPage();advance(1000);check(jumps.join()==='1,3'&&!issues.length,'synchronous response recognized');
reset();initBrickEntryPage();manual();advance(1000);check(!jumps.length&&!listeners.size,'manual interaction before request cancels');
reset();delay=2000;initBrickEntryPage();advance(100);manual();advance(3000);check(jumps.join()==='1'&&!listeners.size,'manual interaction during refresh cancels next navigation');
reset();initBrickEntryPage();manual(false);advance(1000);check(jumps.join()==='1,3','synthetic site events do not cancel startup');
reset();initBrickEntryPage();advance(100);rank.dataset.rank='b';advance(1000);check(jumps.join()==='1','programmatic rank change prevents last-page jump');
reset();initBrickEntryPage();brickAbort.signal.aborted=true;advance(1000);check(!jumps.length&&!listeners.size,'abort cleans up');
reset();initBrickEntryPage();brickBusy=true;advance(1000);check(!jumps.length,'never starts during fill');
reset();pageWindow={};initBrickEntryPage();advance(61000);check(!jumps.length&&issues.length===1&&!timers.size&&!listeners.size,'missing native API bounded and diagnosed');
reset();reply=false;initBrickEntryPage();advance(61000);check(jumps.join()==='1'&&issues.length===1,'unconfirmed request not retried');
reset();wrong=true;initBrickEntryPage();advance(1000);check(jumps.join()==='1,3'&&issues.length===1,'wrong rendered page diagnosed, not assumed from select');
reset();initBrickEntryPage();brickCleanup.at(-1)();advance(1000);check(!jumps.length&&!timers.size&&!listeners.size,'module cleanup immediately stops pending work');
console.log('BRICK_ENTRY_PAGE_OK; assertions='+passed);
`,ctx);
