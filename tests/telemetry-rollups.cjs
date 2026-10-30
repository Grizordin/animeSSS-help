// Actual client logger/GM queue with shared storage and a deterministic clock.
// No external requests, game actions, or real browser-extension storage.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
function extract(name){
 const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(source);
 assert.ok(m,name);const lines=source.slice(m.index).split(/\r?\n/);
 for(let n=2;n<=lines.length;n++)if(lines[n-1]===m[1]+'}'){
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }throw Error(name);
}
const moduleCode=source.slice(source.indexOf('  // BEGIN ROUTINE TELEMETRY'),source.indexOf('  // END ROUTINE TELEMETRY'));
const constants=['SUITE_TELEMETRY_QUEUE_KEY','SUITE_TELEMETRY_MAX_EVENT_CHARS','SUITE_TELEMETRY_MAX_QUEUE_CHARS',
 'SUITE_TELEMETRY_MAX_BATCH_CHARS','SUITE_TELEMETRY_MAX_EVENTS','SUITE_TELEMETRY_BATCH_SIZE','SUITE_TELEMETRY_MAX_AGE_MS',
 'SUITE_SELF_DIAGNOSTIC_MAX_RECENT'].map(n=>source.match(new RegExp('^  const '+n+' = .*;$','m'))[0]).join('\n');
const functions=['suiteTelemetrySanitize','suiteTelemetryReadQueue','suiteTelemetryNormalizeRecord','suiteTelemetryWriteQueue',
 'suiteTelemetryTakeBatch','suiteTelemetryPersistPending','suiteSelfDiagnosticTrace','suiteTelemetryLog','suiteTelemetryFlush'];
const shared=new Map(),sent=[];let now=Date.parse('2026-10-30T08:00:00Z'),accept=true,failKey='',failOutboxClear=false,checks=0;
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const check=(v,label)=>{assert.ok(v,label);checks++;};
function tab(name){
 const context=vm.createContext({Date:Clock,console,Math,JSON,Set,Map,WeakSet,
  location:{pathname:'/accshop/'},document:{visibilityState:'visible'},
  setTimeout:()=>1,clearTimeout:()=>{},
  gmGet:(k,d)=>structuredClone(shared.has(k)?shared.get(k):d),
  gmSet:(k,v)=>{if(k===failKey||failOutboxClear&&k==='suite_telemetry_routine_v1'&&!v.chat_stone?.report)throw Error('mock storage write failure');shared.set(k,structuredClone(v));},
  gmDelete:k=>shared.delete(k),
  suiteTelemetryWithQueueLock:async fn=>fn(),suiteTelemetrySchedulePersist:()=>{},
  suiteReportEvent:async(type,payload)=>{if(!accept)return false;sent.push(structuredClone(payload));return true;}
 });
 vm.runInContext(`const GM_getValue=gmGet,GM_setValue=gmSet;
 const suiteTelemetrySessionId=${JSON.stringify(name)},suiteTelemetryInstallId='shared-install';
 const suiteSelfDiagnosticRecent=[];
 let suiteTelemetryPendingRecords=[],suiteTelemetryPersistTimer=null,suiteTelemetryPersistPromise=Promise.resolve(),suiteTelemetryFlushPromise=null;
 ${constants}\n${moduleCode}\n${functions.map(extract).join('\n')}
 globalThis.api={log:suiteTelemetryLog,flush:suiteTelemetryFlush,persist:suiteRoutineTelemetry.persist,queue:suiteTelemetryReadQueue};`,context);
 return context.api;
}
const flat=()=>sent.flatMap(x=>x.events);
(async()=>{
 const a=tab('tv-tab'),b=tab('com-tab');
 for(let n=0;n<500;n++){
  a.log('chat_stone','snapshot_started',{source:'watchdog'});
  a.log('chat_stone','snapshot_response',{status:'success',diamondCount:0,itemCount:20});
  a.log('chat_stone','snapshot_finished',{source:'watchdog'});
  a.log('autowatch','module_initialized',{data:{token:'PRIVATE',episode:n}});
  a.log('autowatch','next_attempt_scheduled',{data:{delayMs:300,nextRunAt:now+300}});
 }
 await a.flush('startup');check(sent.length===0,'2500 routine events generate no immediate network traffic');
 check(a.queue().length===0,'routine chatter does not occupy the 200-event important queue');
 check(shared.get('suite_telemetry_routine_v1').chat_stone.counts.snapshot_started===500,'counts checkpointed durably');
 b.log('chat_stone','snapshot_finished',{source:'startup'});await b.flush('pagehide');
 const reloaded=tab('reloaded-tab');await reloaded.flush('startup');
 check(sent.length===0,'reload and another domain do not reset the reporting period');
 now+=30*60*1000-1;await a.flush();check(sent.length===0,'nothing sent before half an hour');
 now++;await a.flush();await b.flush();
 check(flat().length===2,'one half-hour summary per module across all tabs');
 const chat=flat().find(e=>e.module==='chat_stone'),watch=flat().find(e=>e.module==='autowatch');
 check(chat.event==='routine_success_summary'&&chat.data.counts.snapshot_finished===501,'cross-tab totals merged');
 check(watch.data.counts.module_initialized===500,'reload-related activity remains countable');
 check(!JSON.stringify(flat()).includes('PRIVATE'),'summary samples never include credentials');
 const summaryCount=flat().length;
 a.log('chat_stone','snapshot_failed',{error:'mock failure'},'error');
 a.log('chat_stone','collect_response',{successful:true,amount:12},'info');
 a.log('autowatch','card_received',{data:{cardId:123}},'debug');
 a.log('suite','shop_roll_started',{options:{exp:true}},'info');
 a.log('suite','shop_roll_stopped',{reason:'Найден опыт: 420'},'info');
 a.log('autowatch','network_request_finished',{data:{status:429}},'debug');
 a.log('autowatch','network_request_finished',{data:{status:200,response:{error:'authentication required'}}},'debug');
 a.log('chat_stone','snapshot_response',{diamondCount:1},'debug');
 a.log('autowatch','module_initialized',{message:'abnormal'},'warn');
 await a.flush();
 check(flat().length===summaryCount+9,'errors, receipts, shop lifecycle, positive detection and warnings retained');
 for(let n=0;n<100;n++)b.log('chat_stone','snapshot_finished',{source:'watchdog'});
 await b.flush();check(flat().length===summaryCount+9,'frequent normal events do not trigger another summary');
 now+=30*60*1000;accept=false;await b.flush();
 check(b.queue().some(e=>e.event==='routine_success_summary'),'offline summary stays in the normal GM queue');
 accept=true;await reloaded.flush();
 check(flat().filter(e=>e.event==='routine_success_summary').length===3,'offline summary sent after reconnect without loss');
 // Checkpoints from a suspended tab join the next period, rather than disappear.
 b.log('chat_stone','snapshot_started',{source:'late-tab'});now+=60*60*1000;await reloaded.flush();
 await b.flush();
 check(flat().filter(e=>e.event==='routine_success_summary').at(-1).data.counts.snapshot_started===1,'suspended tab counts survive delayed persistence');
 const beforeFailure=flat().length;
 a.log('chat_stone','snapshot_finished',{source:'storage-test'});failKey='suite_telemetry_routine_v1';await a.persist();
 failKey='';await a.persist();now+=30*60*1000;await a.flush();
 check(flat().length===beforeFailure+1&&flat().at(-1).data.counts.snapshot_finished===1,'checkpoint retry does not duplicate counts');
 a.log('chat_stone','snapshot_finished',{source:'queue-test'});await a.persist();now+=30*60*1000;
 failKey='suite_telemetry_queue_v2';await a.persist();failKey='';await a.flush();
 check(flat().at(-1).data.counts.snapshot_finished===1,'failed summary enqueue retains accumulated state');
 const rowsBefore=flat().length;
 failKey='suite_telemetry_queue_v2';a.log('suite','important_result',{ok:true});await a.flush();
 failKey='';await a.flush();
 check(flat().length===rowsBefore+1&&flat().at(-1).event==='important_result','failed regular enqueue retains important pending records');
 const beforeOutbox=flat().length;
 a.log('chat_stone','snapshot_finished',{source:'outbox-failure'});await a.persist();now+=30*60*1000;
 failOutboxClear=true;await a.persist();
 a.log('chat_stone','snapshot_finished',{source:'new-period'});failOutboxClear=false;await a.flush();
 now+=30*60*1000;await a.flush();
 const recovered=flat().slice(beforeOutbox);
 check(recovered.length===2&&recovered.every(e=>e.data.counts.snapshot_finished===1),'outbox retry preserves events from the next reporting period');
 check(new Set(recovered.map(e=>e.id)).size===2,'outbox retry never repeats a summary in the event queue');
 const backlog=Array.from({length:200},(_,i)=>({id:'critical-'+i,module:'suite',timestamp:now,time:new Date(now).toISOString(),event:'important',data:{}}));
 shared.set('suite_telemetry_queue_v2',JSON.stringify(backlog));
 a.log('chat_stone','snapshot_finished',{source:'backpressure'});await a.persist();now+=30*60*1000;await a.persist();
 check(a.queue().length===200&&a.queue()[0].id==='critical-0','summary never evicts an important queued record');
 check(!!shared.get('suite_telemetry_routine_v1').chat_stone.report,'summary waits in its bounded outbox during backpressure');
 shared.set('suite_telemetry_queue_v2','[]');await a.flush();
 check(flat().at(-1).data.counts.snapshot_finished===1,'deferred summary drains once space is available');
 // Check the real health predicate, not just the fields named in the implementation.
 const health=vm.runInNewContext('('+extract('suiteLabyrinthEmissionRuntimeHealthy')+')');
 check(health({renderInterval:1,attachInterval:null,syncInterval:null}),'current emission runtime is healthy');
 check(!health(null)&&!health({renderInterval:null}),'missing emission timer still diagnosed');
 console.log(`TELEMETRY_ROLLUPS_OK ${checks} checks; shared mock GM storage, no network`);
})().catch(e=>{console.error(e);process.exitCode=1;});
