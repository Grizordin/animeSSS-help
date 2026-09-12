// Actual Worker functions, in-memory D1. No deployment or external writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const src=fs.readFileSync(path.join(__dirname,'..','cloudflare-report-worker.js'),'utf8');
const context=vm.createContext({crypto:webcrypto,TextEncoder,Uint8Array});
vm.runInContext(src.replace('export default {','const worker = {'),context);
const batches=new Map(),incidents=new Map();let failOnce=false,checks=0;
function check(v,m){assert.ok(v,m);checks++;}
const db={prepare(sql){return {bind(...args){return {async run(){
  const table=sql.includes('telemetry_batches')?batches:incidents;
  if(table===incidents&&failOnce){failOnce=false;throw Error('transient D1 failure');}
  const changes=table.has(args[0])?0:1;if(changes)table.set(args[0],args);
  return {meta:{changes}};
}};}};}};
const event=(id,code)=>({id,event:'self_diagnostic_incident',time:'2026-09-12T07:00:00Z',data:{code,details:{reason:'server_rejected',token:'private'}}});
const base={batchId:'b1',module:'suite',nick:'User',installId:'i',sessionId:'s',events:[event('e1','brick_exchange_not_confirmed'),event('e2','remelt_not_confirmed')]};
const store=(payload)=>context.storeTelemetryBatch({TELEMETRY_DB:db},payload,{time:'2026-09-12T07:01:00Z',country:''});
(async()=>{
 const result=await store(base);check(!result.duplicate&&!result.quizIncident,'self diagnostics do not trigger quiz delivery');
 check(incidents.size===2,'all incidents in batch indexed');
 const first=[...incidents.values()][0];check(first[3]==='suite'&&first[4]==='brick_exchange_not_confirmed','module and code indexed');
 check(!first[6].includes('private')&&first[6].includes('[redacted]'),'details sanitized');
 check((await store(base)).duplicate&&incidents.size===2,'batch retry deduplicated');
 await store({...base,batchId:'b2'});check(incidents.size===2,'event resend under new batch deduplicated');
 await store({...base,batchId:'b3',nick:'Another'});check(incidents.size===4,'different users not collapsed');
 await store({...base,batchId:'b4',sessionId:'new'});check(incidents.size===6,'different sessions not collapsed');
 const recovery={...base,batchId:'recovery',events:[event('recover','pack_cards_not_appeared')]};
 failOnce=true;await assert.rejects(store(recovery));
 check(batches.has('recovery'),'batch committed before simulated failure');
 await store(recovery);check(incidents.size===7,'duplicate retry repairs partial indexing');
 const anonymous={...base,batchId:'noid',events:[{event:'self_diagnostic_incident',time:'t',data:{code:'x'}}]};
 await store(anonymous);await store({...anonymous,batchId:'noid2'});check(incidents.size===8,'stable fallback without event id');
 await store({...base,batchId:'normal',events:[{event:'normal_event'}]});check(incidents.size===8,'ordinary events not incidents');
 const quiz={...base,batchId:'quiz',module:'quiz',events:[{event:'quiz_answer_mismatch',data:{question:'Q',selectedAnswer:'A',expectedAnswer:'B',result:'wrong'}}]};
 check(!!(await store(quiz)).quizIncident,'quiz notification preserved');
 check(!(await store({...quiz,batchId:'quiz2'})).quizIncident,'quiz fingerprint dedupe preserved');
 console.log('WORKER_INCIDENTS_OK; assertions='+checks);
})().catch(e=>{console.error(e);process.exitCode=1;});
