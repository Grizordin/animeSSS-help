// Actual storage/reward functions, simulated independent tabs. No site requests.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
function extract(name){
 const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(source);
 if(!m)throw Error(name);
 const lines=source.slice(m.index).split(/\r?\n/);
 for(let n=2;n<=lines.length;n++){
  if(lines[n-1]!==m[1]+'}')continue;
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }
 throw Error(name);
}
const names=['getGmStoreKey','getGmStore','setGmStore','saveCardReceipt','getAllReceipts','clearCardReceipts','processCardReward','buildRankStats'];
const storage=new Map(),clone=v=>structuredClone(v),wait=()=>new Promise(r=>setImmediate(r));
let writeFailure=false,progressFailure=false,checks=0;
function check(v,msg){assert.ok(v,msg);checks++;}
function tab(user='Tester'){
 const notices=[],logs=[];
 const ctx=vm.createContext({
  AW_GM_DB_PREFIX:`test_${user}_`,AW_GM_STORES:['card_receipts','anime_history','skipped_episodes'],
  GM_getValue:async(k,f)=>{const value=clone(storage.has(k)?storage.get(k):f);await wait();return value;},
  GM_setValue:async(k,v)=>{if(writeFailure&&k.includes('receipt_v2_'))return;storage.set(k,clone(v));await wait();},
  GM_listValues:async()=>[...storage.keys()],GM_deleteValue:async k=>storage.delete(k),
  LAST_SUCCESSFUL_REQUEST_KEY:'last',SMART_PROGRESSION_KEY:'smart',RECEIPTS_PER_EP_COMPLETE:5,
  RANK_CONFIG:[{key:'a'},{key:'b'},{key:'s'},{key:'e'}],getMskDateKey:()=> '2026-09-19',
  getMoscowTimeString:()=> '2026-09-19 12:00:00',parsePayload:()=>({watched_news_id:1,episode:2,season:1}),
  buildOrderedPool:async()=>{if(progressFailure)throw Error('progress failure');return [{anime_id:1}];},
  saveRequestLog:async()=>{},incrementDailyProgress:async()=>({current:1}),updateButtonState:()=>{},
  safePush:(...args)=>notices.push(args),saveDiagnosticLog:(...args)=>logs.push(args),error:()=>{},diagnosticSanitizeBody:v=>v,
 });
 vm.runInContext(names.map(extract).join('\n'),ctx);return {ctx,notices,logs};
}
const rc=(id,ownerId)=>({cardId:id,ownerId,receivedAt:Date.now(),dateMsk:'2026-09-19 12:00:00',rank:'a',cardName:'Card '+id,source:'auto'});
(async()=>{
 // Reproduce the old read/append/write race before verifying the replacement.
 const oldTab=tab().ctx;
 async function oldSave(r){const a=await oldTab.getGmStore('card_receipts');a.push(r);await oldTab.setGmStore('card_receipts',a);}
 await Promise.all([oldSave(rc(1,101)),oldSave(rc(2,102))]);
 check((await oldTab.getGmStore('card_receipts')).length===1,'old implementation loses one concurrent write');
 storage.clear();const a=tab(),b=tab();
 const legacy=rc(9,null);storage.set('test_Tester_card_receipts',[legacy]);
 await Promise.all(Array.from({length:35},(_,i)=>(i%2?a:b).ctx.saveCardReceipt(rc(i,100+i))));
 let all=await a.ctx.getAllReceipts();
 check(all.length===36,'all 35 parallel receipts plus legacy preserved');
 check(new Set(all.map(r=>r.cardId)).size===35,'duplicate card types are separate issued copies');
 check(await a.ctx.saveCardReceipt(rc(1,101))===false,'same owner id is idempotent');
 await Promise.all([a.ctx.saveCardReceipt(rc(50,500)),b.ctx.saveCardReceipt(rc(50,500))]);
 all=await b.ctx.getAllReceipts();check(all.filter(r=>r.ownerId===500).length===1,'concurrent duplicate callbacks store one receipt');
 await b.ctx.setGmStore('card_receipts',[legacy]);
 check((await a.ctx.getAllReceipts()).length===37,'legacy stale-tab array write cannot erase new receipts');
 await a.ctx.saveCardReceipt(rc(60,null));await b.ctx.saveCardReceipt(rc(60,null));
 check((await a.ctx.getAllReceipts()).filter(r=>r.cardId===60).length===2,'separate fallback receipts retained');
 const other=tab('Other');await other.ctx.saveCardReceipt(rc(70,700));
 check(!(await a.ctx.getAllReceipts()).some(r=>r.ownerId===700),'accounts isolated');
 const reload=tab();check((await reload.ctx.getAllReceipts()).length===39,'reload reads persisted journal');
 const stats=await reload.ctx.buildRankStats();
 check(stats.totalAll===39&&stats.totalToday===39&&stats.todayCounts.a===39,'statistics uses every real receipt and rank');
 storage.set('smart',{index:0,cards_collected:0});progressFailure=true;
 await a.ctx.processCardReward({cards:{id:80,owner_id:800,name:'Actual card',rank:'s',news_id:1}},'', 'auto');
 check((await a.ctx.getAllReceipts()).some(r=>r.ownerId===800&&r.cardName==='Actual card'&&r.rank==='s'),'receipt survives later progression error');
 check(a.logs.some(r=>r[0]==='process_card_reward_error'),'later error remains diagnostic');
 progressFailure=false;writeFailure=true;
 await b.ctx.processCardReward({cards:{id:81,owner_id:810,name:'Not saved',rank:'b'}},'', 'auto');
 check(b.notices.length===0,'no success notification if storage readback fails');
 check(b.logs.some(r=>r[0]==='process_card_reward_error'),'storage failure logged');
 writeFailure=false;
 await b.ctx.processCardReward({cards:{id:82,owner_id:820,name:'Saved',rank:'b',news_id:1}},'', 'auto');
 check(b.notices.length===1,'success notification after verified save');
 await b.ctx.processCardReward({cards:{id:82,owner_id:820,name:'Saved',rank:'b',news_id:1}},'', 'site');
 check(b.notices.length===1,'duplicate response does not notify again');
 await a.ctx.clearCardReceipts();
 check((await b.ctx.getAllReceipts()).length===0,'clear removes legacy and current-account journal');
 check((await b.ctx.buildRankStats()).totalAll===0,'cleared statistics remains empty');
 check((await other.ctx.getAllReceipts()).length===1,'clear leaves other account untouched');
 console.log(JSON.stringify({result:'AUTOLOOT_RECEIPTS_OK',passed:checks}));
})().catch(e=>{console.error(e);process.exitCode=1;});
