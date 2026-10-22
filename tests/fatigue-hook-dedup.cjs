// Real hook functions with in-memory transports only. No network or account actions.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
// Pin the pre-fix release: HEAD changes after publishing this regression test.
const baseline=process.argv.includes('--baseline-repro')?require('node:child_process').execFileSync('git',['show','505de56:AnimeSSS_help.user.js'],{encoding:'utf8',maxBuffer:8*1024*1024}):null;
function extract(name){
 const input=baseline&&['installLabyrinthFatigueStepHook','suiteLabyrinthFatigueHookHealth'].includes(name)?baseline:source;
 const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(input);
 assert(m,name);const lines=input.slice(m.index).split(/\r?\n/);
 for(let n=2;n<=lines.length;n++)if(lines[n-1]===m[1]+'}'){
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }throw Error(name);
}
const names=['suiteFunctionChainHas','suiteLabyrinthFatigueBodyText','suiteLabyrinthFatigueIsStepRequest',
 'suiteLabyrinthFatigueNumber','suiteLabyrinthFatigueLimit','suiteLabyrinthFatigueResponseSummary',
 'suiteLabyrinthFatigueHookContexts','suiteLabyrinthFatigueCaptureState','suiteLabyrinthFatigueEnsureHook',
 'suiteLabyrinthFatigueHookPresent','suiteLabyrinthFatigueRecordDuplicate','suiteLabyrinthFatigueHookHealth',
 'installLabyrinthFatigueStepHook'];
let passed=0;function check(v,label){assert(v,label);passed++;}
const url='/index.php?controller=ajax&mod=animesss_game';
function fixture(shared=true){
 let time=1000000,requests=0,clones=0;
 const timers=[],payloads=[],logs=[];
 class Xhr extends EventTarget{
  constructor(){super();if(baseline)require('node:events').setMaxListeners(0,this);this.status=200;this.responseType='';this.responseText='{"step":1,"total_steps":1,"fatigue_counter":{"value":1}}';this.listeners=0;}
  open(method,url){this.nativeUrl=url;}
  send(){requests++;if(this.throwSend)throw Error('send failed');}
  addEventListener(type,fn,opts){if(type==='loadend')this.listeners++;super.addEventListener(type,fn,opts);}
  finish(){this.dispatchEvent(new Event('loadend'));}
 }
 const nativeFetch=function(){requests++;return Promise.resolve({status:200,clone(){clones++;return {text:async()=>'{"step":1,"fatigue_counter":{"value":1}}'};}});};
 const window={XMLHttpRequest:Xhr,fetch:nativeFetch,__suiteLabyrinthFatigueStepHandler:p=>payloads.push(p)};
 const page=shared?{XMLHttpRequest:Xhr,fetch:nativeFetch}:window;
 const c=vm.createContext({window,getPageWindow:()=>page,URLSearchParams,Date:{now:()=>time},
  setTimeout:fn=>(timers.push(fn),timers.length),suiteTelemetryLog:(...args)=>logs.push(args),
  suiteSelfDiagnosticIssue:(...args)=>logs.push(args)});
 vm.runInContext(names.map(extract).join('\n'),c);
 const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();while(timers.length)timers.shift()();};
 return {c,window,page,Xhr,payloads,logs,flush,install:()=>c.installLabyrinthFatigueStepHook(),advance:ms=>time+=ms,
  requests:()=>requests,clones:()=>clones,nativeFetch,nativeOpen:Xhr.prototype.open,nativeSend:Xhr.prototype.send};
}
function opaque(owner,key){const original=owner[key];owner[key]=function(){return original.apply(this,arguments);};return owner[key];}
(async()=>{
 if(baseline){
  const f=fixture(false);f.install();let listeners=0;
  for(let i=0;i<200;i++){
   opaque(f.Xhr.prototype,'open');opaque(f.Xhr.prototype,'send');f.advance(1500);f.install();
   const x=new f.Xhr();x.open('POST',url);x.send('action=step');listeners+=x.listeners;x.finish();await f.flush();
  }
  assert.equal(f.requests(),200);assert(f.payloads.length>200);
  console.log(JSON.stringify({result:'BASELINE_AMPLIFICATION_REPRODUCED',requests:f.requests(),listeners,captures:f.payloads.length}));return;
 }
 const f=fixture();f.install();const first=f.Xhr.prototype.send;
 for(let i=0;i<1000;i++){f.advance(1500);f.install();}
 check(f.Xhr.prototype.send===first,'watchdog leaves installed hook stable across both contexts');
 check(f.requests()===0,'installation and watchdog never send requests');
 const x=new f.Xhr();x.open('POST',url);x.send('action=step');x.finish();await f.flush();
 check(f.requests()===1&&f.payloads.length===1&&x.listeners===1,'shared XHR prototype captured once');
 x.open('POST',url);x.send('action=step');x.finish();await f.flush();
 check(f.requests()===2&&f.payloads.length===2,'reused XHR remains capturable');
 x.open('POST',url);x.send('action=other');x.finish();await f.flush();
 check(f.payloads.length===2,'non-step ignored');
 // Third-party wrappers without original-function markers used to cause rewrapping.
 const roots={};for(const key of ['open','send'])roots[key]=opaque(f.Xhr.prototype,key);
 f.install();const probe=f.Xhr.prototype.send;
 for(let i=0;i<35;i++){f.advance(1500);f.install();}
 check(f.Xhr.prototype.send===probe,'one probe while waiting, no 1.5-second hook stacking');
 const y=new f.Xhr();y.open('POST',url);y.send('action=step');y.finish();await f.flush();
 check(y.listeners===1&&f.payloads.length===3,'opaque nested observers install only one listener');
 check(f.Xhr.prototype.send===roots.send&&f.Xhr.prototype.open===roots.open,'redundant top probes removed without removing third-party hooks');
 for(let i=0;i<1000;i++){f.advance(1500);f.install();}
 check(f.Xhr.prototype.send===roots.send,'observed opaque chain remains stable indefinitely');
 check(f.c.suiteLabyrinthFatigueHookHealth().every(h=>h.xhrHookPresent),'health recognises observed opaque chain');
 // A genuine replacement still gets repaired.
 f.Xhr.prototype.send=f.nativeSend;f.install();
 const z=new f.Xhr();z.open('POST',url);z.send('action=step');z.finish();await f.flush();
 check(z.listeners===1&&f.payloads.length===4,'genuine send replacement repaired');
 z.throwSend=true;z.open('POST',url);assert.throws(()=>z.send('action=step'),/send failed/);
 z.throwSend=false;z.send('action=step');z.finish();await f.flush();
 check(f.payloads.length===5,'synchronous send failure leaves no stale listener or pending flag');
 z.open('POST',url);z.send('action=step');z.open('POST',url);z.send('action=step');z.finish();await f.flush();
 check(f.payloads.length===6,'reopen discards old request callback');
 f.window.__suiteLabyrinthFatigueStepHandler=null;
 const off=new f.Xhr();off.open('POST',url);off.send('action=step');off.finish();await f.flush();
 check(off.listeners===0,'disabled module adds no capture listener');
 f.window.__suiteLabyrinthFatigueStepHandler=p=>f.payloads.push(p);f.install();
 off.open('POST',url);off.send('action=step');off.finish();await f.flush();
 check(f.payloads.length===7,'module restart uses new handler without reinstalling');
 const g=fixture(false);g.install();const p=g.window.fetch(url,{body:'action=step'});await p;await g.flush();
 check(g.requests()===1&&g.clones()===1&&g.payloads.length===1,'fetch returns one captured response');
 const fetchRoot=opaque(g.window,'fetch');g.install();
 await g.window.fetch(url,{body:'action=step'});await g.flush();
 check(g.requests()===2&&g.clones()===2&&g.payloads.length===2,'nested fetch observers clone once');
 check(g.window.fetch===fetchRoot,'redundant fetch probe removed');
 for(let i=0;i<1000;i++){g.advance(1500);g.install();}
 check(g.window.fetch===fetchRoot,'opaque fetch chain not repeatedly wrapped');
 // Different promises resolving to the same actual response must not clone twice.
 const orig=g.window.fetch;g.window.fetch=function(...args){return orig.apply(this,args).then(r=>r);};g.install();
 await g.window.fetch(url,{body:'action=step'});await g.flush();
 check(g.clones()===3&&g.payloads.length===3,'response identity also deduplicates transformed promises');
 g.window.fetch=g.nativeFetch;g.install();await g.window.fetch(url,{body:'action=step'});await g.flush();
 check(g.clones()===4&&g.payloads.length===4,'genuine fetch replacement repaired');
 // Separate response objects for simultaneous requests must not be collapsed.
 await Promise.all([g.window.fetch(url,{body:'action=step'}),g.window.fetch(url,{body:'action=step'})]);await g.flush();
 check(g.clones()===6&&g.payloads.length===6,'concurrent real requests stay distinct');
 const expected=Promise.reject(new Error('network'));expected.catch(()=>{});
 g.window.fetch=()=>expected;g.install();check(g.window.fetch(url,{body:'action=step'})===expected,'original promise identity retained');
 await g.flush();check(g.payloads.length===7&&g.payloads.at(-1).status===0,'network failure observed');
 const before=g.logs.length;for(let i=0;i<5000;i++)g.c.suiteLabyrinthFatigueRecordDuplicate('same-step');
 check(g.logs.length===before+1,'5000 duplicate steps produce one compact log instead of 5000 responses');
 g.advance(60000);g.c.suiteLabyrinthFatigueRecordDuplicate('next-step');
 const last=g.logs.at(-1);check(last[1]==='duplicate_steps_suppressed'&&last[2].count===5000&&last[2].total===5001,'suppression summary retains exact counts');
 check(!JSON.stringify(last).includes('response'),'summary has no repeated full response');
 // Reproduce the actual amplification mechanism: another script adds opaque
 // wrappers between every watchdog tick. Our observer count must not grow.
 const h=fixture(false);h.install();
 let listeners=0;
 for(let i=0;i<200;i++){
  for(const key of ['open','send']){
   const original=h.Xhr.prototype[key];
   h.Xhr.prototype[key]=function(){return original.apply(this,arguments);};
   h.Xhr.prototype[key].__testOriginal=original; // intentionally not a recognised marker
  }
  h.advance(1500);h.install();
  const xhr=new h.Xhr();xhr.open('POST',url);xhr.send('action=step');listeners+=xhr.listeners;xhr.finish();await h.flush();
 }
 check(h.requests()===200&&h.payloads.length===200&&listeners===200,'200 opaque replacements cause 200 requests, listeners and captures, not quadratic callbacks');
 let observers=0,fn=h.Xhr.prototype.send;
 while(fn){if(fn.__suiteLabyrinthFatigueHooked)observers++;fn=fn.__testOriginal||fn.__suiteXhrOriginal;}
 check(observers===1,'only one permanent helper observer survives repeated wrapper conflicts');
 // A third-party change to a property descriptor during send must not make
 // our rollback throw after the actual transport already succeeded.
 const safe=fixture(false);safe.install();const warm=new safe.Xhr();warm.open('POST',url);warm.send('action=step');warm.finish();await safe.flush();
 const previous=safe.Xhr.prototype.send;
 safe.Xhr.prototype.send=function(){Object.defineProperty(safe.Xhr.prototype,'send',{writable:false});return previous.apply(this,arguments);};
 safe.install();const locked=new safe.Xhr();locked.open('POST',url);locked.send('action=step');locked.finish();await safe.flush();
 check(safe.payloads.length===2,'read-only wrapper property cannot break a successful request');
 console.log(JSON.stringify({result:'FATIGUE_HOOK_DEDUP_OK',passed}));
})().catch(e=>{console.error(e);process.exitCode=1;});
