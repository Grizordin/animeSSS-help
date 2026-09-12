// Deterministic, offline entry navigation. No network or real card actions.
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
const context=vm.createContext({assert,console});
vm.runInContext(String.raw`
let passed=0;const check=(v,m)=>{assert.ok(v,m);passed++;};
let now=0,next=0,rank,select,forge,brickBusy=false,brickTradePending=false;
const timers=new Map(),listeners=new Map(),jumps=[],brickCleanup=[];
const brickAbort={signal:{aborted:false}},Date={now:()=>now};
const setTimeout=(fn,ms)=>{timers.set(++next,{fn,at:now+ms});return next;},clearTimeout=id=>timers.delete(id);
class Event{constructor(type,opts){this.type=type;Object.assign(this,opts);}}
const document={querySelector:()=>rank,getElementById:id=>id==='celestialForge'?forge:select,
 addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);}};
function advance(ms){const end=now+ms;for(;;){const entry=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!entry||entry[1].at>end)break;now=entry[1].at;timers.delete(entry[0]);entry[1].fn();}now=end;}
function reset(){brickCleanup.splice(0).forEach(fn=>fn());timers.clear();listeners.clear();jumps.length=0;now=0;brickBusy=false;brickTradePending=false;brickAbort.signal.aborted=false;
 rank={dataset:{rank:''}};forge={dataset:{filterBusy:'false'}};
 select={value:'1',disabled:false,options:[{value:'1'},{value:'2'},{value:'3'}],dispatchEvent(e){check(e.type==='change'&&e.bubbles,'native change event');jumps.push(this.value);}};
}
`,context);
vm.runInContext(['getPageSelect','getLastPage','getCurrentPage','goToPage','initBrickEntryPage'].map(extract).join('\n'),context);
vm.runInContext(String.raw`
reset();initBrickEntryPage();advance(299);check(!jumps.length,'wait for stable filter');advance(1);
check(jumps.join()==='3'&&select.value==='3','all ranks opens last page');advance(9000);check(jumps.length===1&&!timers.size&&!listeners.size,'one navigation with complete cleanup');
reset();rank.dataset.rank='a';initBrickEntryPage();advance(1000);check(!jumps.length&&!timers.size,'specific rank unchanged');
reset();select.value='3';initBrickEntryPage();advance(1000);check(!jumps.length,'already last page does not reload');
reset();select.options=[{value:'1'}];initBrickEntryPage();advance(1000);check(!jumps.length,'single page does not reload');
reset();forge.dataset.filterBusy='true';select.disabled=true;initBrickEntryPage();advance(1000);check(!jumps.length,'wait for loading filter');forge.dataset.filterBusy='false';select.disabled=false;advance(300);check(jumps.join()==='3','navigate after filter settles');
reset();initBrickEntryPage();advance(100);listeners.get('click')({target:{closest:()=>({})}});advance(1000);check(!jumps.length&&!listeners.size,'manual interaction cancels entry jump');
reset();initBrickEntryPage();advance(100);rank.dataset.rank='b';advance(1000);check(!jumps.length,'programmatic rank change cancels');
reset();initBrickEntryPage();brickAbort.signal.aborted=true;advance(1000);check(!jumps.length&&!timers.size&&!listeners.size,'module abort cancels');
reset();initBrickEntryPage();brickBusy=true;advance(1000);check(!jumps.length,'never navigate while filling cards');
reset();select=null;initBrickEntryPage();advance(9000);check(!jumps.length&&!timers.size&&!listeners.size,'missing pagination has bounded wait');
reset();const saved=select;select=null;rank=null;initBrickEntryPage();advance(1000);select=saved;rank={dataset:{rank:''}};advance(300);check(jumps.join()==='3','late initial markup supported');
reset();initBrickEntryPage();brickCleanup.at(-1)();advance(1000);check(!jumps.length&&!timers.size&&!listeners.size,'cleanup immediately removes pending work');
console.log('BRICK_ENTRY_PAGE_OK; assertions='+passed);
`,context);
