// Offline only. Supplied HTML is parsed in inert templates; no site scripts execute.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_trade_limits.user.js'),'utf8');
new vm.Script(source);
const mod={exports:{}};vm.runInNewContext(source,{module:mod,URL,URLSearchParams,Date,Map,Set,Object,Number,String,JSON,Infinity});
const C=mod.exports;let checks=0;
const withoutExports=process.argv.includes('--without-exports');
const ok=(v,msg)=>{assert.ok(v,msg);checks++;};
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const now=Date.parse('2026-10-17T12:00:00+03:00');
eq(C.ownerTileSelector('/cards/users/trade/'),'a.card-show__owner','traders page supported');
eq(C.ownerTileSelector('/cards/16518/stars/'),'a.card-show__owner','stars excludes podium blocks');
ok(C.ownerTileSelector('/cards/66728/awakened/'),'awakened owners supported');
eq(C.ownerTileSelector('/user/Tester/'),'','unrelated rankings not decorated');
eq(C.responseDate('Sun, 18 Oct 2026 17:53:43 GMT'),C.msk('18.10.2026 20:53:43'),'server Date uses UTC and matches observed Moscow time');
eq(C.responseDate(null),null,'missing header unavailable');eq(C.responseDate('bad date'),null,'invalid header unavailable');
eq(C.responseDate('Sun, 31 Feb 2026 17:53:43 GMT'),null,'invalid calendar header rejected');
const endpoint='https://animesss.tv/index.php?controller=ajax&mod=trade_ajax';
const requestFields='action=trade_card&trade_id=123&original_card=7&user_hash=secret-not-stored';
eq(JSON.stringify(C.sendRequestIds(endpoint,'POST',requestFields)),JSON.stringify({ownerCardId:'123',cardId:'7'}),'only safe request IDs retained');
eq(C.sendRequestIds(endpoint,'GET',requestFields),null,'GET not a send');
eq(C.sendRequestIds(endpoint,'POST',requestFields.replace('trade_card','cancel_trade')),null,'cancellation not a send');
eq(C.sendRequestIds(endpoint.replace('animesss.tv','evil.test'),'POST',requestFields),null,'foreign request excluded');
const timed=C.fresh('Me',now);
for(let i=0;i<2;i++)C.putTrade(timed,{name:'Peer',ownerCardId:String(100+i),cardId:'7',startedAt:now+i*2000-100,sentAt:now+i*2000,serverDateAt:now+i*2000,observedAt:now+i*2000+3000,exact:true},now+6000);
C.putOffers(timed,[{name:'Peer',offerId:'201',sentAt:now+2000,exact:true},{name:'Peer',offerId:'200',sentAt:now,exact:true}],now+6000);
eq(Object.keys(timed.people.peer.trades).length,2,'two close sends with server times link without duplicates');
eq(C.summary(timed.people.peer).free,1,'two sends leave one slot');
eq(timed.log.filter(l=>l.code==='SEND_TIME_MATCHED').length,2,'both exact matches diagnosed');
const timeLogCount=timed.log.length;C.auditSendTimes(timed,now+7000);eq(timed.log.length,timeLogCount,'unchanged time result not logged repeatedly');
const offTime=C.fresh('Me',now);
C.putTrade(offTime,{name:'Peer',ownerCardId:'300',cardId:'7',startedAt:now,sentAt:now,serverDateAt:now,exact:true},now);
C.putOffers(offTime,[{name:'Peer',offerId:'400',sentAt:now+1000,exact:true}],now+1000);
eq(Object.keys(offTime.people.peer.trades).length,2,'one-second mismatch not linked by old five-second window');
eq(offTime.log.at(-1).code,'SEND_TIME_MISMATCH','time mismatch diagnosed');
eq(offTime.log.at(-1).detail.candidates[0].deltaSeconds,1,'diagnostic difference in seconds');
const lateTime=C.fresh('Me',now);
const localTime={name:'Peer',ownerCardId:'500',cardId:'7',startedAt:now,sentAt:now+4000,exact:false};
C.putTrade(lateTime,localTime,now+4000);
C.putTrade(lateTime,{...localTime,sentAt:now,serverDateAt:now,observedAt:now+4000,exact:true},now+4000);
eq(Object.keys(lateTime.people.peer.trades).length,1,'late header enriches DOM record without duplicate');
eq(Object.values(lateTime.people.peer.trades)[0].sentAt,now,'late header replaces local observation time');
const delayRecord=(overrides={})=>({name:'Peer',ownerCardId:'800',cardId:'2190',startedAt:now-30000,requestStartedAt:now-6000,observedAt:now,requestDurationMs:5140,durationSource:'request',sentAt:now,serverDateAt:now,exact:true,...overrides});
const delayed=C.fresh('Me',now);C.putTrade(delayed,delayRecord(),now);
C.putOffers(delayed,[{name:'Peer',offerId:'801',sentAt:now-5000,exact:true}],now);
eq(Object.keys(delayed.people.peer.trades).length,1,'delayed Date links sole proposal within request window');
const delayedLinked=Object.values(delayed.people.peer.trades)[0];
eq(delayedLinked.sentAt,now-5000,'proposal timestamp becomes authoritative');
eq(delayedLinked.serverDateAt,now,'raw Date retained');
eq(delayedLinked.timeMatch.method,'request-window','interval method logged');
eq(delayed.log.at(-1).code,'SEND_TIME_ADJUSTED','adjusted match diagnostic');
eq(C.timingWindow(delayedLinked).estimatedAt,now-5140,'estimate uses request duration not click delay');
ok(!C.timeMatch(delayedLinked,now-4000),'confirmed proposal timestamp cannot drift');
ok(!C.timeMatch(delayRecord(),now-6141),'outside interval rejected');
ok(!C.timeMatch(delayRecord(),now+1001),'beyond upper rounding bound rejected');
ok(!C.timeMatch(delayRecord({requestDurationMs:120001}),now-5000),'excessively long interval rejected');
ok(!C.timeMatch(delayRecord({requestDurationMs:-1}),now-5000),'negative duration rejected');
const multiple=C.fresh('Me',now);C.putTrade(multiple,delayRecord(),now);
C.putOffers(multiple,[{name:'Peer',offerId:'811',sentAt:now-5000,exact:true},{name:'Peer',offerId:'812',sentAt:now-4000,exact:true}],now);
eq(Object.keys(multiple.people.peer.trades).length,3,'two interval candidates not merged');
eq(multiple.log.at(-1).code,'SEND_TIME_AMBIGUOUS','ambiguous interval diagnosed');
const preferExact=C.fresh('Me',now);C.putTrade(preferExact,delayRecord(),now);
C.putOffers(preferExact,[{name:'Peer',offerId:'821',sentAt:now-5000,exact:true},{name:'Peer',offerId:'822',sentAt:now,exact:true}],now);
eq(Object.values(preferExact.people.peer.trades).find(t=>t.ownerCardId).offerId,'822','exact candidate takes priority');
const conflict=C.fresh('Me',now);
C.putTrade(conflict,delayRecord(),now);C.putTrade(conflict,delayRecord({ownerCardId:'802'}),now);
C.putOffers(conflict,[{name:'Peer',offerId:'831',sentAt:now,exact:true},{name:'Peer',offerId:'832',sentAt:now-5000,exact:true}],now);
eq(Object.keys(conflict.people.peer.trades).length,4,'ambiguous exact matches do not fall through to intervals');
const historyRow={sentAt:now-5000,gained:['2190'],lost:['5'],key:'delay-history'};
const delayedHistory=C.fresh('Me',now);C.putTrade(delayedHistory,delayRecord(),now);
C.reconcile(delayedHistory.people.peer,[historyRow],false);
eq(C.summary(delayedHistory.people.peer).accepted,0,'incomplete history cannot validate interval');
C.reconcile(delayedHistory.people.peer,[{...historyRow,gained:['999']}],true);
eq(C.summary(delayedHistory.people.peer).accepted,0,'received card required');
C.auditSendTimes(delayedHistory,now);
ok(delayedHistory.log.some(l=>l.code==='HISTORY_TIME_CHECK' && l.detail.candidates.some(r=>!r.cardMatches)),'history diagnostic includes wrong-card candidate');
C.reconcile(delayedHistory.people.peer,[historyRow],true);
eq(C.summary(delayedHistory.people.peer).accepted,1,'delayed accepted history resolved');
C.auditSendTimes(delayedHistory,now);
eq(Object.values(delayedHistory.people.peer.trades)[0].timeMatch.deltaSeconds,-5,'history delta retained');
const cancelledDelay=C.fresh('Me',now);C.putTrade(cancelledDelay,delayRecord(),now);
C.reconcileCancelled(cancelledDelay.people.peer,[{...historyRow,outcome:'rejected'}],true);
eq(C.summary(cancelledDelay.people.peer).free,3,'cancelled history uses same interval');
const historyAmbiguous=C.fresh('Me',now);C.putTrade(historyAmbiguous,delayRecord(),now);
C.reconcile(historyAmbiguous.people.peer,[historyRow,{...historyRow,key:'other',sentAt:now-4000}],true);
eq(C.summary(historyAmbiguous.people.peer).accepted,0,'ambiguous history remains pending');
const timingExportPath='C:/Users/BETEP_B_TYMAHE/Downloads/animesss-trade-limits-2026-10-20 (1).json';
if(fs.existsSync(timingExportPath)){
 const raw=fs.readFileSync(timingExportPath,'utf8'),snapshot=JSON.parse(raw),repaired=snapshot.state;
 const result=C.repairPendingTimes(repaired,Date.parse(snapshot.exportedAt));
 eq(result.merged,1,'real PiсyaPopa duplicate repaired');
 eq(Object.keys(repaired.people['писяпопа'].trades).length,2,'real user has two outgoing trades');
 eq(C.summary(repaired.people['писяпопа']).free,1,'real user one available slot');
 const repairedSend=Object.values(repaired.people['писяпопа'].trades).find(t=>t.offerId==='13817525');
 eq(repairedSend.durationSource,'legacy-click-span','old timing is labelled approximate');
 eq(repairedSend.timeMatch.deltaSeconds,-5,'real duplicate uses five-second discrepancy');
 const unchanged=JSON.stringify(repaired);ok(!C.repairPendingTimes(repaired).changed,'repair idempotent');eq(JSON.stringify(repaired),unchanged,'second repair does not mutate state');
 // Time from user's screenshot; received card from recorded send, not fetched from live site.
 C.reconcile(repaired.people.upuk3412,[{sentAt:C.msk('20.10.2026 08:11:13'),gained:['2190'],lost:['1','2'],key:'screen-upuk'}],true,repaired.people.upuk3412.signals);
 eq(C.summary(repaired.people.upuk3412).accepted,1,'real Upuk send reconciles with screenshot time');
 eq(fs.readFileSync(timingExportPath,'utf8'),raw,'original diagnostic untouched');
}else console.log('SKIP: October 20 timing export unavailable; synthetic timing regressions still run');
eq(C.day(Date.parse('2026-10-16T20:59:59Z')),'2026-10-16','before Moscow midnight');
eq(C.day(Date.parse('2026-10-16T21:00:00Z')),'2026-10-17','Moscow midnight');
eq(C.msk('17.10.2026 09:01:45'),Date.parse('2026-10-17T06:01:45Z'),'MSK date');
ok(Number.isNaN(C.msk('31.02.2026 09:01:45')),'invalid calendar date rejected');
ok(Number.isNaN(C.msk('17.10.2026 25:01:45')),'invalid time rejected');
eq(C.ownerName('/user/cards/?name=%D0%9C%D1%8F%D1%82%D0%B0+%2B&card_id=1'),'Мята +','full decoded nickname');
eq(C.ownerName('https://evil.test/user/Alice/'),'','foreign links rejected');
eq(C.ownerName('/user/A%2BB/'),'A+B','plus preserved');
eq(C.nick(' Graff 007 '),'graff 007','nickname key');
let state=C.fresh('Me',now);
eq(C.summary(null).color,'green','no records use green background');
eq(C.summary(null).free,3,'no records show three free slots');
eq(Object.keys(state.people).length,0,'default display does not create queue entries');
const badgeState=C.fresh('Me',now);
C.observeBadge(badgeState,1,now);
eq(badgeState.notificationDue,now+20000,'first unread counter waits twenty seconds');
C.observeBadge(badgeState,1,now+5000);
eq(badgeState.notificationDue,now+20000,'same counter does not postpone pending fallback');
badgeState.notificationDue=0;badgeState.listAt=now+10000;
C.observeBadge(badgeState,1,now+60000);
eq(badgeState.notificationDue,0,'unchanged counter on new page does not request again');
C.observeBadge(badgeState,0,now+61000);
C.observeBadge(badgeState,1,now+62000);
eq(badgeState.notificationDue,now+82000,'decrease then increase triggers fresh check');
C.observeBadge(badgeState,0,now+63000);
eq(badgeState.notificationDue,0,'reading all notifications cancels fallback');
badgeState.listAt=now+64000;
C.observeBadge(badgeState,1,now+65000);
eq(badgeState.notificationDue,now+85000,'increase just after site response is not lost');
const freshBadge=C.fresh('Me',now);freshBadge.listAt=now;
C.observeBadge(freshBadge,1,now+1000);
eq(freshBadge.notificationDue,0,'first badge reuses fresh site list');
const deletedBadge=C.fresh('Me',now);
C.putTrade(deletedBadge,{offerId:'88',name:'Peer',cardId:'7',sentAt:now,exact:true},now);
deletedBadge.badge=5;deletedBadge.listAt=now;
const beforeDelete=JSON.stringify(deletedBadge.people);
C.observeBadge(deletedBadge,3,now+30000);
eq(deletedBadge.badge,3,'partial deletion updates shared counter baseline');
eq(deletedBadge.notificationDue,0,'partial deletion does not fetch notification list');
C.observeBadge(deletedBadge,4,now+31000);
eq(deletedBadge.notificationDue,now+51000,'new notification after partial deletion schedules check below old maximum');
C.observeBadge(deletedBadge,0,now+32000);
eq(deletedBadge.notificationDue,0,'deleting all notifications cancels queued check');
eq(JSON.stringify(deletedBadge.people),beforeDelete,'deleting notifications leaves trade records untouched');
const send=(id,time=now,name='Other',cardId='9441')=>({offerId:id,name,cardId,sentAt:time,exact:true});
ok(C.putTrade(state,send('1'),now),'new send');
ok(!C.putTrade(state,send('1'),now),'deduplicated send');
ok(!C.putTrade(state,send('2',now-86400000),now),'yesterday excluded');
let p=state.people.other;
eq(C.summary(p).pending,1,'one reserved slot');
eq(C.summary(p).color,'green','pending with free slots is green');
C.putTrade(state,send('2',now+1000),now+1000);C.putTrade(state,send('3',now+2000),now+2000);
eq(C.summary(p).color,'yellow','three pending yellow');
const rows=[{sentAt:now,gained:['9441'],lost:['42'],key:'one'}];
C.reconcile(p,rows,true);
eq(p.trades['offer:1'].status,'accepted','matching history confirms send');
eq(C.summary(p).color,'yellow','one accepted two pending yellow');
C.reconcile(p,rows,true);
eq(C.summary(p).accepted,1,'same history cannot count twice');
C.reconcile(p,[],true,[{kind:'rejected',noticeId:'9',at:now+3000}]);
eq(C.summary(p).pending,2,'ambiguous rejection does not release arbitrary slot');
const state2=C.fresh('Me',now);C.putTrade(state2,send('x'),now);const q=state2.people.other;
C.reconcile(q,[],false,[{kind:'rejected',noticeId:'9',at:now}]);
eq(q.trades['offer:x'].status,'pending','incomplete history is not rejection');
C.reconcile(q,[],true);
eq(q.trades['offer:x'].status,'pending','absence alone is not rejection');
C.reconcile(q,[],true,[{kind:'rejected',noticeId:'9',at:now}]);
eq(q.trades['offer:x'].status,'pending','refusal alone cannot release a different current offer');
const cancellation={sentAt:now,gained:['9441'],lost:['42'],outcome:'rejected',key:'cancelled-one'};
C.reconcileCancelled(q,[cancellation],false);
eq(q.trades['offer:x'].status,'pending','incomplete cancelled history does not release slot');
C.reconcileCancelled(q,[{...cancellation,sentAt:now-86400000}],true);
eq(q.trades['offer:x'].status,'pending','yesterday cancellation does not release current offer');
C.reconcile(q,[cancellation],true);
eq(q.trades['offer:x'].status,'pending','cancelled row cannot become accepted');
C.reconcileCancelled(q,[cancellation],true,[],new Set(['x']));
eq(q.trades['offer:x'].status,'pending','still-listed offer is not closed using contradictory snapshot');
C.reconcileCancelled(q,[cancellation],true);
eq(q.trades['offer:x'].status,'rejected','matching cancelled history releases slot');
eq(C.summary(q).free,3,'freed slot');
const late=C.fresh('Me',now),notice={kind:'rejected',name:'Peer',noticeId:'901',at:now+1000};
C.bufferNotices(late,[notice]);eq(C.drainNotices(late,now+2000).length,0,'notice waits for its send');
ok(!late.notices['901'],'unmatched notice is not marked consumed');
C.putTrade(late,{name:'Peer',offerId:'991',cardId:'7',sentAt:now,exact:true},now+3000);
eq(C.drainNotices(late,now+3000).length,1,'late send receives buffered notification');
C.bufferNotices(late,[notice]);eq(C.drainNotices(late,now+4000).length,0,'buffered notification deduplicated');
eq(late.people.peer.signals.length,1,'one signal after repeated notice');
const batch=C.fresh('Me',now);batch.badge=1;
C.observeNoticeBatch(batch,{notices:[],count:2,source:'response'},now);
C.observeBadge(batch,2,now);
eq(batch.notificationDue,0,'response and its own updated badge do not cause duplicate request');
C.observeBadge(batch,1,now-1);eq(batch.badge,2,'older badge cannot overwrite response baseline');
C.observeBadge(batch,3,now+1);eq(batch.notificationDue,now+20001,'genuinely later increase schedules request');
C.observeNoticeBatch(batch,{notices:[],source:'dom'},now+2);
eq(batch.notificationDue,now+20001,'stale DOM list does not cancel new fallback');
const fair=C.fresh('Me',now);for(let i=0;i<40;i++)C.person(fair,'user'+i).next=now;
const counts={};let clock=now;
for(let i=0;i<200;i++){
 let key=C.nextCheckKey(fair,clock);
 if(key===null){clock=Math.min(...Object.values(fair.people).map(p=>p.next));key=C.nextCheckKey(fair,clock);}
 counts[key]=(counts[key]||0)+1;clock+=2000;fair.people[key].next=clock+60000;
}
eq(Object.keys(counts).length,40,'all forty users checked despite long queue');
ok(Math.max(...Object.values(counts))-Math.min(...Object.values(counts))<=1,'rounds finish before repeating early users');
const round=C.fresh('Me',now);C.person(round,'first').next=now;C.person(round,'second').next=now;
eq(C.nextCheckKey(round,now),'first','first round begins');round.people.first.next=now;
eq(C.nextCheckKey(round,now),'second','old round finishes before repeat');
eq(C.nextCheckKey(round,now),'first','next round can repeat first');
const state3=C.fresh('Me',now);C.putTrade(state3,send('a'),now);C.putTrade(state3,send('b'),now);
C.reconcile(state3.people.other,rows,true);
eq(C.summary(state3.people.other).accepted,0,'identical sends not falsely matched');
const r={...send('z'),offerId:undefined,ownerCardId:'99',exact:false,startedAt:now-2000};
ok(C.matches({sentAt:now-1000,gained:['9441']},r),'small observation latency');
ok(!C.matches({sentAt:now-60000,gained:['9441']},r),'old same card is not a match');
ok(!C.matches({sentAt:now,gained:['42']},r),'lost card does not match gained');
eq(C.rateWait([],now),0,'initial request allowed');
eq(C.rateWait([now-200],now),500,'700ms spacing');
ok(C.rateWait(Array(90).fill(now-30000),now)>=30000,'rolling 90-request window');
eq(C.rateWait(Array(90).fill(now-60000),now),0,'expired request reservations');
C.putTrade(state,send('4',now,'__proto__'),now);ok(Object.hasOwn(state.people,'__proto__'),'special nickname safe');

// Regression: the owner's card instance and the sent proposal have DISTINCT IDs.
const observed={name:'Peer',ownerCardId:'189740050',cardId:'60501',sentAt:now+1100,startedAt:now,exact:false};
const sent={name:'Peer',offerId:'13780514',sentAt:now+1000,exact:true};
for(const reverse of [false,true]) {
 const s=C.fresh('Me',now);
 if(reverse){C.putOffers(s,[sent],now+2000);C.putTrade(s,observed,now+2000);}
 else {C.putTrade(s,observed,now+2000);C.putOffers(s,[sent],now+2000);}
 const records=Object.values(s.people.peer.trades);eq(records.length,1,'different IDs link in both arrival orders');
 eq(records[0].ownerCardId,'189740050','owner instance retained');eq(records[0].offerId,'13780514','proposal ID retained');
 C.putOffers(s,[sent],now+2000);eq(Object.keys(s.people.peer.trades).length,1,'repeated list does not re-create duplicate');
 C.putTrade(s,observed,now+2000);eq(Object.keys(s.people.peer.trades).length,1,'repeated send does not re-create duplicate');
}
const ambiguous=C.fresh('Me',now);C.putTrade(ambiguous,observed,now+2000);
C.putOffers(ambiguous,[sent,{...sent,offerId:'13780515',sentAt:now+2000}],now+3000);
eq(Object.keys(ambiguous.people.peer.trades).length,3,'ambiguous batch is not greedily merged');
ok(!Object.values(ambiguous.people.peer.trades).some(t=>t.offerId&&t.ownerCardId),'no guessed ID link');
const partial=C.fresh('Me',now);C.putOffers(partial,[{...sent,offerId:'11',sentAt:now}],now);
C.putTrade(partial,{...observed,sentAt:now+20000,startedAt:now+19000},now+21000);
C.reconcile(partial.people.peer,[{sentAt:now+20000,gained:['60501'],lost:['8'],key:'known'}],true);
eq(C.summary(partial.people.peer).accepted,1,'unknown other card does not block known history match');
const exportPath=process.env.ANIMESSS_TRADE_DIAGNOSTIC||'C:/Users/BETEP_B_TYMAHE/Downloads/animesss-trade-limits-2026-10-17.json';
if(!withoutExports){
const originalExport=fs.readFileSync(exportPath,'utf8'),diagnostic=JSON.parse(originalExport),old=diagnostic.state;
const beforeAccepted=Object.values(old.people).flatMap(p=>Object.values(p.trades)).filter(t=>t.status==='accepted').map(t=>t.historyKey).sort();
const migration=C.migrate(old,Date.parse(diagnostic.exportedAt));
eq(migration.merged,10,'real export: ten duplicate pairs merged');
eq(Object.values(old.people).reduce((n,p)=>n+Object.keys(p.trades).length,0),14,'real export: 24 records become 14');
eq(Object.keys(old.people.dreamlight.trades).length,3,'DreamLight retains three sends');
eq(Object.keys(old.people.paratruper.trades).length,2,'Paratruper retains two sends');
eq(Object.keys(old.people['настикнани'].trades).length,1,'НастикНани duplicate repaired');
eq(Object.values(old.people).flatMap(p=>Object.values(p.trades)).filter(t=>t.status==='accepted').map(t=>t.historyKey).sort(),beforeAccepted,'confirmed history retained');
ok(old.people.upuk3412.confirmedLimit,'confirmed full limit retained');
eq(Object.values(old.people).reduce((n,p)=>n+p.signals.length,0),7,'all unresolved notification signals retained');
const once=JSON.stringify(old);ok(!C.migrate(old).changed,'migration runs once');eq(JSON.stringify(old),once,'migration idempotent');
eq(fs.readFileSync(exportPath,'utf8'),originalExport,'user export not modified');
// No new status is invented by migration: only structural duplicate repair.
eq(Object.values(old.people).flatMap(p=>Object.values(p.trades)).filter(t=>t.status==='accepted').length,2,'migration does not infer acceptance');
}else console.log('SKIP: historical Downloads export migration checks (--without-exports)');

const attachmentRoot=process.env.ANIMESSS_ATTACHMENTS;
const fixtureIds={owners:'524fcb91-7dac-44b4-8b39-b97fb8e8fcd4',offers:'bbd8be85-46bd-484d-9b02-08c4af112906',
  form:'9f933c0a-c3ef-4faa-9459-883c59686ea8',success:'7b32fbd7-b2a8-436e-895e-7e0e03d85cea',
  limit:'55cae152-446e-4d7b-a10a-753d84fab63d',history:'fd173e9a-b71a-4769-becc-334d7871338c',
  notices:'9c004721-943c-4bf4-8d12-716a38aa14fb',cancelled:'5535c245-3d2f-4569-96a5-d0b429020e61'};
const fixtures=attachmentRoot?Object.fromEntries(Object.entries(fixtureIds).map(([k,id])=>[k,fs.readFileSync(path.join(attachmentRoot,id,'Вставленный текст.txt'),'utf8')])):require('./fixtures/release-ui.cjs').trade;
fs.mkdirSync(path.join(__dirname,'..','tmp'),{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const context=await browser.newContext();let network=0;
  await context.route('**/*',route=>{network++;return route.fulfill({status:200,body:'<!doctype html><html><head></head><body></body></html>',contentType:'text/html'});});
  const page=await context.newPage();await page.goto('https://animesss.tv/cards/users/?id=101813');
  const dom=await page.evaluate(({source,fixtures})=>{
   window.module={exports:{}};(0,eval)(source);window.Core=module.exports;delete window.module;
   const C=window.Core,parsed={};for(const [k,html]of Object.entries(fixtures)){const t=document.createElement('template');t.innerHTML=html;parsed[k]=t.content;}
   const f=C.offerPage(parsed.form),s=C.offerPage(parsed.success),l=C.offerPage(parsed.limit);
   const o=C.parseOffers(parsed.offers,'https://animesss.tv/trades/offers/');
   const h=C.parseHistory(parsed.history,'https://animesss.tv/trades/history/?name=BETEP_B_TYMAHE&trader=Upuk3412','Upuk3412','BETEP_B_TYMAHE');
   const n=C.parseNotices(parsed.notices);
   const cancelled=C.parseHistory(parsed.cancelled,'https://animesss.tv/trades/history/?name=BETEP_B_TYMAHE&trader=detaua&kind=calsel_sender','detaua','BETEP_B_TYMAHE','calsel_sender');
   let rejectIncoming=false;try{C.parseHistory(parsed.cancelled,'https://animesss.tv/trades/history/?kind=calsel_reciever&name=BETEP_B_TYMAHE&trader=detaua','detaua','BETEP_B_TYMAHE','calsel_reciever');}catch{rejectIncoming=true;}
   const owners=[...parsed.owners.querySelectorAll('.card-show__owner')].map(a=>C.ownerName(a.getAttribute('href')));
   let wrongKind=false;try{C.parseHistory(parsed.history,'https://animesss.tv/trades/history/?kind=calsel_sender&trader=Upuk3412','Upuk3412','BETEP_B_TYMAHE');}catch{wrongKind=true;}
   return {f,s,l,o,h,n,cancelled,rejectIncoming,owners,wrongKind,own:C.account(parsed.owners)};
  },{source,fixtures});
  eq(dom.own,'BETEP_B_TYMAHE','account only from own profile panel');
  eq(dom.f.name,'DoMack','form recipient');eq(dom.f.cardId,'64120','form card ID');ok(dom.f.ready&&!dom.f.success,'form not success');
  eq(dom.s.name,'Sonechkka','success retains recipient');ok(dom.s.success&&!dom.s.ready,'explicit send success');
  ok(dom.l.limit&&!dom.l.ready,'explicit limit');
  eq(dom.o.rows.length,5,'five offers');eq(dom.o.total,5,'total validates full offers list');eq(dom.o.next,null,'no pagination fixture');
  eq(dom.o.rows[0].name,'.executeme','punctuation nickname preserved');
  eq(dom.h.rows.length,5,'five history rows');eq(dom.h.rows[0].gained,['23378'],'correct received card');eq(dom.h.rows[0].lost,['9441'],'lost side distinct');
  eq(C.day(dom.h.rows[3].sentAt),'2026-10-16','history reaches yesterday');
  ok(dom.h.next.includes('/page/2/')&&dom.h.next.includes('trader=Upuk3412'),'next-page link preserves account and trader');
  ok(dom.wrongKind,'cancelled history cannot confirm acceptance');
  ok(dom.rejectIncoming,'incoming cancellations cannot close outgoing offers');
  eq(dom.cancelled.rows[0].gained,['14404'],'real detaua cancellation card');
  eq(dom.cancelled.rows[0].sentAt,C.msk('18.10.2026 06:59:27'),'real cancellation send time');
  ok(dom.cancelled.next.includes('/page/2/')&&dom.cancelled.next.includes('kind=calsel_sender'),'cancellation pagination preserves kind');
  if(!withoutExports){
  const recent=JSON.parse(fs.readFileSync('C:/Users/BETEP_B_TYMAHE/Downloads/animesss-trade-limits-2026-10-18 (1).json','utf8'));
  C.reconcileCancelled(recent.state.people.detaua,dom.cancelled.rows.filter(r=>C.day(r.sentAt)===recent.state.day),true);
  eq(C.summary(recent.state.people.detaua).pending,0,'real fresh diagnostic detaua pending resolved');
  eq(C.summary(recent.state.people.detaua).free,3,'real detaua has three free outgoing slots');
  }else console.log('SKIP: historical Downloads detaua export checks (--without-exports)');
  eq(dom.n.length,1,'nontrade notification ignored');eq(dom.n[0].kind,'rejected','exact refusal recognized');eq(dom.n[0].name,'Predator','refusal nickname');
  ok(dom.owners.includes('Graff 007'),'owner name spaces');ok(dom.owners.filter(x=>x==='Lily').length===2,'duplicated owner tiles');
  // Runtime: mock GM storage and all HTTP. Import sanitized owners only, never the full supplied page.
  const mockStore=new Map();
  await context.exposeBinding('mockGet',(_s,k,f)=>mockStore.has(k)?mockStore.get(k):f);
  // Tampermonkey synchronous API mock is mirrored between browser tabs through binding writes.
  await page.evaluate(({source,html,now})=>{
   const originalNow=Date.now;Date.now=()=>now;window.realNow=originalNow;
   const t=document.createElement('template');t.innerHTML=html;const list=t.content.querySelector('.card-show__owner-wrapper');
   for(const e of list.querySelectorAll('*'))for(const a of [...e.attributes])if(/^on/i.test(a.name)||['src','srcset','style'].includes(a.name))e.removeAttribute(a.name);
   document.body.innerHTML='<div class="ap-profile-actions"><a class="ap-profile-action" href="/user/BETEP_B_TYMAHE/">Мой профиль</a></div>';
   document.body.append(list);
   const style=document.createElement('style');style.textContent='body{margin:16px;background:#111;color:white;font:14px Arial}.card-show__owner-wrapper{display:flex;flex-wrap:wrap;gap:14px}.card-show__owner{display:flex;position:relative;flex-direction:column;align-items:center;width:108px;border:1px solid #38a975;border-radius:14px;padding:10px 5px;background:#1b1b1b;color:white;text-decoration:none}.card-show__owner-image{height:40px;width:40px;background:#434955;border-radius:9px}.card-show__owner-name{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card-show__owner-icon{position:absolute;right:-4px;top:-4px;background:#b72a40;border-radius:50%;width:18px;height:18px}.card-show__time-icon{position:absolute;top:5px;left:5px;font-size:9px;background:#444}';document.head.append(style);
   const values={},listeners=[];window.testValues=values;
   window.GM_getValue=(k,f)=>k in values?structuredClone(values[k]):structuredClone(f);
   window.GM_setValue=(k,v)=>{const old=values[k];values[k]=structuredClone(v);for(const l of listeners)if(l.k===k)l.cb(k,old,structuredClone(v),false);};
   window.GM_deleteValue=k=>delete values[k];window.GM_listValues=()=>Object.keys(values);
   window.GM_addValueChangeListener=(k,cb)=>listeners.push({k,cb});window.GM_registerMenuCommand=(_n,cb)=>window.openLimits=cb;
   const state=Core.fresh('BETEP_B_TYMAHE',now);
   for(const [name,count,pending]of [['Lily',1,1],['AriyaRoses',3,0],['EliasDorner',1,2]]){
    const p=Core.person(state,name);for(let i=0;i<count+pending;i++)p.trades[String(i)]={...{name,tradeId:String(i),cardId:'1',sentAt:now},status:i<count?'accepted':'pending'};
   }
   values['as_trade_limits_debug_v1:state:betep_b_tymahe']=state;
   window.fetch=async()=>{throw Error('Unexpected network');};
   (0,eval)(source);
  },{source,html:fixtures.owners,now});
  await page.waitForTimeout(350);
  eq(await page.locator('.astl-mark').count(),dom.owners.length-1,'one mark per owner except self');
  eq(await page.locator('a[href*="name=Lily"] .astl-dot.red').count(),2,'duplicate tiles share accepted count');
  eq(await page.locator('a[href*="name=Lily"] .astl-dot.yellow').count(),2,'duplicate tiles share pending count');
  eq(await page.locator('.astl-red').count(),1,'full accepted red');
  eq(await page.locator('.astl-yellow').count(),1,'full reserved yellow');
  eq(await page.locator('.astl-unknown,.astl-dot.unknown').count(),0,'no grey indicators');
  eq(await page.locator('a[href*="name=Graff"] .astl-dot.green').count(),3,'untracked user has three green dots');
  ok(await page.locator('a[href*="name=Graff"]').evaluate(e=>e.classList.contains('astl-green')),'untracked user has green background');
  ok(await page.locator('.suite-owner-restriction-icons').count()>0,'existing restriction badges preserved');
  const onlineStyles=await page.locator('a[href*="name=Graff"]').evaluate(el=>{
   const previous=el.className;
   el.classList.remove('card-show__owner--online');
   const before=el.getBoundingClientRect(),offline=getComputedStyle(el).boxShadow;
   el.classList.add('card-show__owner--online');
   const states=['green','yellow','red'].map(color=>{
    el.classList.remove('astl-green','astl-yellow','astl-red');el.classList.add('astl-'+color);
    const s=getComputedStyle(el);return {border:s.borderColor,shadow:s.boxShadow};
   });
   el.classList.add('astl-checking');const checking=getComputedStyle(el).boxShadow;
   const after=el.getBoundingClientRect();el.className=previous;
   return {offline,states,checking,sizeStable:before.width===after.width&&before.height===after.height};
  });
  eq(onlineStyles.offline,'none','offline tiles do not get online glow');
  for(const s of onlineStyles.states){eq(s.border,'rgb(136, 255, 189)','online border visible on each limit background');ok(s.shadow.includes('inset'),'online outline has inner contrast line');}
  eq(onlineStyles.checking,onlineStyles.states[0].shadow,'checking animation preserves online outline');
  ok(onlineStyles.sizeStable,'online styling does not change tile dimensions');
  await page.getByRole('button',{name:'Настройки / журнал'}).click();
  ok(await page.locator('#astl-panel').isVisible(),'debug modal');
  await page.locator('#astl-panel select').selectOption('numbers');
  eq(await page.locator('a[href*="name=Lily"] .astl-mark').first().textContent(),'1/3','numbers mean available slots');
  eq(await page.locator('a[href*="name=Graff"] .astl-mark').textContent(),'3/3','untracked user has 3/3 in number mode');
  for(const width of [1280,390,320]){
   await page.setViewportSize({width,height:900});
   ok(await page.evaluate(()=>document.querySelector('#astl-panel').getBoundingClientRect().width<=innerWidth),'modal fits '+width);
  }
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.screenshot({path:path.join(__dirname,'..','tmp','trade-limits-mobile.png'),fullPage:true});
  // Owner lists only: medal podiums remain untouched, no queueing of visible users.
  const variantHtml=attachmentRoot?{
   stars:fs.readFileSync(path.join(attachmentRoot,'705961c7-865d-40ad-9756-543f6a35d8b7','pasted-text.txt'),'utf8'),
   awakened:fs.readFileSync(path.join(attachmentRoot,'37df5bdd-a032-4507-b7f3-fc2e1b2b9cce','pasted-text.txt'),'utf8')
  }:require('./fixtures/release-ui.cjs').variants;
  const changePage=async(url,html)=>page.evaluate(({url,html})=>{
   history.pushState({},'',url);
   if(html){
    document.querySelectorAll('.card-show__owner-wrapper,.leaderboard-top__list').forEach(e=>e.remove());
    const t=document.createElement('template');t.innerHTML=html;
    for(const block of t.content.querySelectorAll('.card-show__owner-wrapper,.leaderboard-top__list')){
     for(const e of [block,...block.querySelectorAll('*')])for(const a of [...e.attributes])if(/^on/i.test(a.name)||['src','srcset','style'].includes(a.name))e.removeAttribute(a.name);
     block.querySelectorAll('script,iframe,object,embed,link,style').forEach(e=>e.remove());
     // Simulate decorations left by 0.1.6 to verify cleanup as well as exclusion.
     for(const top of block.querySelectorAll('a.leaderboard-top__item[href^="/user/"]')){
      top.classList.add('astl-tile','astl-green');top.dataset.astlSignature='old';
      const mark=document.createElement('span');mark.className='astl-mark';top.append(mark);
     }
     document.body.append(block);
    }
   }
   const key='as_trade_limits_debug_v1:settings';GM_setValue(key,GM_getValue(key,{enabled:true,mode:'numbers'}));
   const selector=Core.ownerTileSelector(location.pathname);
   const eligible=selector?[...document.querySelectorAll(selector)].filter(e=>{const n=Core.ownerName(e.getAttribute('href'));return n&&Core.nick(n)!=='betep_b_tymahe';}):[];
   return {expected:eligible.length,marked:document.querySelectorAll('.astl-mark').length,bar:!!document.querySelector('#astl-bar'),emptyMarked:!!document.querySelector('a[href="#"] .astl-mark'),people:Object.keys(GM_getValue('as_trade_limits_debug_v1:state:betep_b_tymahe',{}).people||{}).length};
  },{url,html});
  let surface=await changePage('/cards/users/trade/?id=101813');
  eq(surface.marked,dom.owners.length-1,'traders display existing limits');ok(!surface.bar,'extra pages have no debug bar');
  for(let stars=1;stars<=5;stars++){
   surface=await changePage('/cards/16518/stars/?stars='+stars,variantHtml.stars);
   ok(surface.expected>0,'stars fixture has users');eq(surface.marked,surface.expected,'all stars owner blocks marked '+stars);
   ok(!surface.emptyMarked,'vacant top slot untouched');ok(!surface.bar,'stars have no extra bar');eq(surface.people,3,'display never adds users to ledger');
   eq(await page.locator('.leaderboard-top__item.astl-tile,.leaderboard-top__item .astl-mark,.leaderboard-top__item[data-astl-signature]').count(),0,'stars podium old decorations removed '+stars);
  }
  surface=await changePage('/cards/66728/awakened/?variant=all',variantHtml.awakened);
  eq(surface.marked,surface.expected,'awakened ordinary owners marked');ok(surface.expected>0,'awakened fixture has users');
  eq(await page.locator('.leaderboard-top__item.astl-tile,.leaderboard-top__item .astl-mark,.leaderboard-top__item[data-astl-signature]').count(),0,'awakened podium old decorations removed');
  eq(surface.people,3,'awakened display does not enqueue unknown people');ok(!surface.emptyMarked,'awakened vacant slots untouched');
  const nativeBackground=await page.evaluate(()=>{
   const el=document.querySelector('a.card-show__owner.astl-tile');
   const previousStyle=el.getAttribute('style');el.style.background='linear-gradient(120deg, rgb(72, 42, 91), rgb(31, 42, 70))';
   const expected=getComputedStyle(el).backgroundImage;
   const stateKey='as_trade_limits_debug_v1:state:betep_b_tymahe',settingsKey='as_trade_limits_debug_v1:settings';
   const original=GM_getValue(stateKey),name=Core.ownerName(el.getAttribute('href')),results=[];
   for(const [accepted,pending,checking]of [[0,0,false],[0,3,false],[3,0,false],[0,1,true]]){
    const next=structuredClone(original),p=Core.person(next,name);p.trades={};p.checking=checking;p.error=checking?'TEST_ERROR':'';
    for(let i=0;i<accepted+pending;i++)p.trades[String(i)]={status:i<accepted?'accepted':'pending'};
    GM_setValue(stateKey,next);GM_setValue(settingsKey,GM_getValue(settingsKey));
    results.push({background:getComputedStyle(el).backgroundImage,paint:el.matches('.astl-green,.astl-red,.astl-yellow,.astl-checking'),mark:!!el.querySelector('.astl-mark')});
   }
   history.pushState({},'','/cards/66728/stars/?stars=5');GM_setValue(settingsKey,GM_getValue(settingsKey));
   const starsPaint=el.classList.contains('astl-checking');
   history.pushState({},'','/cards/66728/awakened/?variant=all');GM_setValue(settingsKey,GM_getValue(settingsKey));
   const returned=getComputedStyle(el).backgroundImage;
   GM_setValue(stateKey,original);GM_setValue(settingsKey,GM_getValue(settingsKey));
   if(previousStyle===null)el.removeAttribute('style');else el.setAttribute('style',previousStyle);
   return {expected,results,starsPaint,returned};
  });
  for(const result of nativeBackground.results){eq(result.background,nativeBackground.expected,'awakened native fill retained for every state');ok(!result.paint,'no limit fill or checking animation on awakened');ok(result.mark,'awakened indicator retained');}
  ok(nativeBackground.starsPaint,'stars still uses limit/checking background');
  eq(nativeBackground.returned,nativeBackground.expected,'navigation restores native awakened fill');
  surface=await changePage('/user/Tester/');eq(surface.marked,0,'navigation away cleans old owner marks');
  surface=await changePage('/cards/66728/awakened/?variant=all');eq(surface.marked,surface.expected,'navigation back restores marks');
  await page.evaluate(()=>window.openLimits());await page.locator('#astl-panel input[type=checkbox]').uncheck();
  eq(await page.locator('.astl-mark').count(),0,'disable removes UI without modifying site cards');
  eq(network,1,'no real site requests or attached assets executed');
  await context.close();
  // Full worker, network queue, notification hooks and active-tab handover, with synthetic server responses.
  const ctx=await browser.newContext();const calls=[];let pending=true, accepted=false, cancelled=false, offersFailures=0, notices=[], delayedHistory=null;
  const clockBase=Date.parse('2026-10-17T12:00:00+03:00');
  const profile='<div class="ap-profile-actions"><a class="ap-profile-action" href="/user/Tester/">Мой профиль</a></div>';
  let sendTime=clockBase;
  const format=t=>new Date(t+10800000).toISOString().replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2}).*/, '$3.$2.$1 $4');
  const offersHtml=()=>profile+'<a class="ncard__tabs-btn" href="/trades/offers/">Отправленные ('+(pending?1:0)+')</a><div class="trade__list">'+(pending?'<a class="trade__list-item" href="/trades/offers/90042/"><div class="trade__list-name">для TestPeer</div><div class="trade__list-date">'+format(sendTime)+'</div></a>':'')+'</div>';
  const historyHtml=()=>profile+'<span class="kind_active"><a href="/trades/history/?name=Tester&trader=TestPeer">завершённые</a></span><div class="history__list">'+(accepted?'<div class="history__item"><div class="history__name"><a href="/user/TestPeer/">TestPeer</a></div><div class="history__date">'+format(sendTime)+'</div><div class="history__body--gained"><a class="history__body-item" href="/cards/users/?id=7">карта</a></div><div class="history__body--lost"><a class="history__body-item" href="/cards/users/?id=8">карта</a></div></div>':'')+'</div>';
  await ctx.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(req.resourceType()==='document')return route.fulfill({body:'<!doctype html><html><head></head><body>'+profile+'</body></html>',contentType:'text/html'});
   calls.push({path:u.pathname,kind:u.searchParams.get('kind')||'',method:req.method(),at:Date.now()});
   if(u.pathname==='/trades/offers/')return offersFailures-->0?route.fulfill({status:503,body:'temporary'}):route.fulfill({body:offersHtml(),contentType:'text/html'});
   if(u.pathname==='/trades/history/'){
    if(delayedHistory)await delayedHistory;
    let body=historyHtml();
    if(u.searchParams.get('kind')==='calsel_sender') {
      const previous=accepted;accepted=cancelled;body=historyHtml().replace('name=Tester&trader=TestPeer','name=Tester&trader=TestPeer&kind=calsel_sender');accepted=previous;
    }
    return route.fulfill({body,contentType:'text/html'});
   }
   if(u.pathname==='/ajax/notifications/')return route.fulfill({body:JSON.stringify({notice_list:notices.join(''),notice_count:String(notices.length),status:'readed'}),contentType:'application/json'});
   return route.fulfill({status:500,body:'Unexpected mocked route'});
  });
  await ctx.addInitScript(({clockBase})=>{
   const real=Date.now,baseline=real();Date.now=()=>clockBase+real()-baseline+Number(localStorage.getItem('testOffset')||0);
   Object.defineProperty(document,'visibilityState',{get:()=>localStorage.getItem('testActive')===window.tabName?'visible':'hidden'});
   document.hasFocus=()=>localStorage.getItem('testActive')===window.tabName;
   window.GM_getValue=(k,f)=>localStorage.getItem(k)===null?f:JSON.parse(localStorage.getItem(k));
   window.GM_setValue=(k,v)=>localStorage.setItem(k,JSON.stringify(v));window.GM_deleteValue=k=>localStorage.removeItem(k);
   window.GM_listValues=()=>Object.keys(localStorage).filter(k=>k.startsWith('as_trade_limits_debug_v1:'));
   window.GM_addValueChangeListener=(k,cb)=>window.addEventListener('storage',e=>{if(e.key===k)cb(k,e.oldValue?JSON.parse(e.oldValue):null,e.newValue?JSON.parse(e.newValue):null,true);});
   window.GM_registerMenuCommand=(_n,cb)=>window.openLimits=cb;
  },{clockBase});
  const a=await ctx.newPage(),b=await ctx.newPage();
  await a.goto('https://animesss.tv/cards/42/trade/');await b.goto('https://animesss.tv/');
  await a.evaluate(({source,clockBase})=>{
   window.tabName='a';localStorage.setItem('testActive','a');
   GM_setValue('as_trade_limits_debug_v1:state:tester',{version:'0.1.0',account:'tester',day:'2026-10-17',people:{legacy:{name:'Legacy',trades:{'123':{name:'Legacy',tradeId:'123',cardId:'77',sentAt:clockBase-60000,startedAt:clockBase-61000,exact:true,status:'accepted',historyKey:'preserved'}},signals:[],confirmedLimit:false,lastFinished:clockBase-50000,next:0,revision:1,checking:false,error:'',failures:0}},notices:{},seen:{},log:[],notificationDue:0,listAt:0,badge:null});
   document.body.insertAdjacentHTML('beforeend','<div id="tradeOffer" data-receiver="TestPeer" data-trade-id="42" data-original-id="7"><div class="to-art-stage"><a class="noffer__img" href="/cards/users/?id=7"></a></div><button class="trade__send-trade-btn">Отправить</button></div>');(0,eval)(source);
  },{source,clockBase});
  await b.evaluate(source=>{window.tabName='b';(0,eval)(source);},source);
  await a.waitForTimeout(250);
  eq(calls.length,0,'no requests for users without sends');
  sendTime=await a.evaluate(()=>{document.querySelector('.trade__send-trade-btn').click();return Date.now();});sendTime=Math.floor(sendTime/1000)*1000;
  await a.waitForTimeout(150);
  eq(await a.evaluate(()=>GM_listValues().filter(k=>k.includes(':event:')).length),0,'click alone not persisted as send');
  await a.evaluate(()=>{document.querySelector('#tradeOffer').innerHTML='<div class="message-info__content">Обмен отправлен, дождитесь его рассмотрения получателем</div>';});
  const saved=()=>a.evaluate(()=>GM_getValue('as_trade_limits_debug_v1:state:tester',null));
  await a.waitForFunction(()=>GM_getValue('as_trade_limits_debug_v1:state:tester',null)?.people?.testpeer?.lastFinished>0,null,{timeout:12000});
  eq(Object.values((await saved()).people.testpeer.trades)[0].status,'pending','successful send recorded and checked');
  eq(Object.keys((await saved()).people.testpeer.trades).length,1,'runtime distinct IDs do not duplicate');
  eq(Object.values((await saved()).people.testpeer.trades)[0].offerId,'90042','runtime linked real proposal ID');
  eq(Object.values((await saved()).people.testpeer.trades)[0].ownerCardId,'42','runtime retained card instance ID');
  const backup=await a.evaluate(()=>GM_getValue('as_trade_limits_debug_v1:backup:0.1.0:tester:2026-10-17',null));
  eq(backup.version,'0.1.0','automatic backup saved before migration');
  eq(backup.people.legacy.trades['123'].historyKey,'preserved','backup preserves original IDs and accepted history');
  eq((await saved()).schema,2,'runtime migration schema');
  const timingBackup=await a.evaluate(()=>GM_getValue('as_trade_limits_debug_v1:backup:timing-0.1.9:tester:2026-10-17',null));
  ok(timingBackup && timingBackup.timingRepair!==1,'runtime timing backup exists before repair marker');
  eq(Object.values(timingBackup.people.legacy.trades)[0].historyKey,'preserved','timing backup retains confirmed history');
  eq((await saved()).timingRepair,1,'runtime timing repair marked complete');
  eq(Object.values((await saved()).people.legacy.trades)[0].status,'accepted','runtime migration retains confirmed status');
  eq(calls.filter(c=>c.path==='/trades/offers/').length,1,'only one active worker reads offers');
  eq(calls.filter(c=>c.path==='/trades/history/').length,0,'still-pending trade needs no history');
  await a.evaluate(()=>localStorage.setItem('testActive','none'));
  const before=calls.length;await a.evaluate(()=>localStorage.setItem('testOffset','65000'));await a.waitForTimeout(2200);
  eq(calls.length,before,'no checks with all tabs inactive');
  await b.evaluate(()=>localStorage.setItem('testActive','b'));
  await b.waitForFunction(()=>GM_getValue('as_trade_limits_debug_v1:state:tester',null)?.log.filter(l=>l.code==='CHECK_DONE').length>=2,null,{timeout:10000});
  eq(calls.filter(c=>c.path==='/trades/offers/').length,2,'queue moves to active tab on another site page');
  pending=false;accepted=true;
  const notice='<div class="dropdown-item" id="delete-100"><div class="small text-gray-500">17.10.2026 12:01:10</div><span class="font-weight-bold"><a href="/user/TestPeer/">TestPeer</a> согласился с вашим предложением на обмен</span></div>';
  notices=[notice];
  await b.evaluate(async()=>{await fetch('/ajax/notifications/?action=list');});
  await b.waitForTimeout(1400);const offerCount=calls.filter(c=>c.path==='/trades/offers/').length;
  await b.evaluate(()=>localStorage.setItem('testOffset','130000'));
  await b.waitForFunction(()=>Object.values(GM_getValue('as_trade_limits_debug_v1:state:tester',null)?.people.testpeer.trades||{}).some(t=>t.status==='accepted'),null,{timeout:12000});
  eq(calls.filter(c=>c.path==='/trades/offers/').length,offerCount,'acceptance notification goes straight to history');
  eq((await saved()).people.testpeer.next,0,'confirmed one trade no longer polled');
  const historyCount=calls.filter(c=>c.path==='/trades/history/').length;
  await b.evaluate(async()=>{await fetch('/ajax/notifications/?action=list');localStorage.setItem('testOffset','200000');});
  await b.waitForTimeout(2400);
  eq(calls.filter(c=>c.path==='/trades/history/').length,historyCount,'repeated notification cannot retrigger confirmed send');
  ok(calls.every(c=>c.method==='GET'),'all scripted checks read-only GET');
  await b.evaluate(()=>localStorage.setItem('testOffset',String(13*3600000)));
  await b.waitForFunction(()=>GM_getValue('as_trade_limits_debug_v1:state:tester',null)?.day==='2026-10-18',null,{timeout:5000});
  eq(Object.keys((await saved()).people).length,0,'midnight clears daily ledger');
  // Notification fallback: delay, reuse of site responses, then one read-only list request.
  await b.evaluate(()=>{window.dle_login_hash='test-only';document.body.insertAdjacentHTML('beforeend','<span id="MainBadgeCounter" data-count="1">1</span>');});
  await b.waitForFunction(()=>GM_getValue('as_trade_limits_debug_v1:state:tester',null)?.notificationDue>0,null,{timeout:5000});
  const noticeCount=calls.filter(c=>c.path==='/ajax/notifications/').length;
  await b.waitForTimeout(600);eq(calls.filter(c=>c.path==='/ajax/notifications/').length,noticeCount,'notification fallback waits instead of immediately requesting');
  await b.evaluate(async()=>{await fetch('/ajax/notifications/?action=list');});await b.waitForTimeout(1800);
  eq((await saved()).notificationDue,0,'site response cancels delayed fallback');
  await b.evaluate(()=>{document.querySelector('#MainBadgeCounter').dataset.count='0';});await b.waitForTimeout(1300);
  await b.evaluate(()=>{localStorage.setItem('testOffset',String(13*3600000+25000));document.querySelector('#MainBadgeCounter').dataset.count='1';});
  await b.waitForFunction(()=>GM_getValue('as_trade_limits_debug_v1:state:tester',null)?.notificationDue>0,null,{timeout:5000});
  await b.evaluate(()=>localStorage.setItem('testOffset',String(13*3600000+50000)));
  await b.waitForFunction(()=>GM_getValue('as_trade_limits_debug_v1:state:tester',null)?.log.some(l=>l.code==='NOTICES_FALLBACK'),null,{timeout:5000});
  eq(calls.filter(c=>c.path==='/ajax/notifications/').length,noticeCount+2,'one own fallback after deadline');
  ok(!JSON.stringify(await saved()).includes('test-only'),'session hash absent from persisted diagnostics');
  // Reopening the same counter must reuse the persisted baseline across pages.
  await b.waitForTimeout(1300);
  const afterFallback=calls.filter(c=>c.path==='/ajax/notifications/').length;
  await b.evaluate(()=>localStorage.setItem('testOffset',String(13*3600000+80000)));
  await b.reload();
  await b.evaluate(source=>{window.tabName='b';window.dle_login_hash='test-only';document.body.insertAdjacentHTML('beforeend','<span id="MainBadgeCounter" data-count="1">1</span>');(0,eval)(source);},source);
  await b.waitForTimeout(2400);
  eq((await saved()).notificationDue,0,'reload with unchanged unread count does not schedule fallback');
  await b.evaluate(()=>localStorage.setItem('testOffset',String(13*3600000+110000)));
  await b.waitForTimeout(2400);
  eq(calls.filter(c=>c.path==='/ajax/notifications/').length,afterFallback,'reload does not duplicate list GET after twenty seconds');
  eq((await saved()).version,'0.1.9','existing schema records running version without resetting storage');
  // Delayed response from the old Moscow day cannot re-create yesterday's trades.
  let release;delayedHistory=new Promise(r=>release=r);pending=false;accepted=true;
  await b.evaluate(()=>document.body.insertAdjacentHTML('beforeend','<div id="tradeOffer" data-receiver="TestPeer" data-trade-id="43" data-original-id="7"><button class="trade__send-trade-btn">Отправить</button></div>'));
  await b.waitForTimeout(200);
  sendTime=await b.evaluate(()=>{document.querySelector('.trade__send-trade-btn').click();return Date.now();});sendTime=Math.floor(sendTime/1000)*1000;
  await b.evaluate(()=>document.querySelector('#tradeOffer').innerHTML='<div class="message-info__content">Обмен отправлен, дождитесь его рассмотрения получателем</div>');
  const priorHistory=calls.filter(c=>c.path==='/trades/history/').length;
  for(let i=0;i<30&&calls.filter(c=>c.path==='/trades/history/').length===priorHistory;i++)await b.waitForTimeout(200);
  ok(calls.filter(c=>c.path==='/trades/history/').length>priorHistory,'history request in flight');
  await b.evaluate(()=>localStorage.setItem('testOffset',String(37*3600000)));release();delayedHistory=null;
  await b.waitForFunction(()=>GM_getValue('as_trade_limits_debug_v1:state:tester',null)?.day==='2026-10-19',null,{timeout:6000});
  eq(Object.keys((await saved()).people).length,0,'old in-flight history discarded after midnight');
  // Ordinary missing offer resolves against affirmative outgoing cancellation history.
  accepted=false;cancelled=true;
  await b.evaluate(()=>{document.querySelector('#tradeOffer').remove();document.body.insertAdjacentHTML('beforeend','<div id="tradeOffer" data-receiver="TestPeer" data-trade-id="44" data-original-id="7"><button class="trade__send-trade-btn">Отправить</button></div>');});
  await b.waitForTimeout(200);
  sendTime=await b.evaluate(()=>{document.querySelector('.trade__send-trade-btn').click();return Date.now();});sendTime=Math.floor(sendTime/1000)*1000;
  await b.evaluate(()=>document.querySelector('#tradeOffer').innerHTML='<div class="message-info__content">Обмен отправлен, дождитесь его рассмотрения получателем</div>');
  await b.waitForFunction(()=>Object.values(GM_getValue('as_trade_limits_debug_v1:state:tester',null)?.people.testpeer?.trades||{}).some(t=>t.status==='rejected'),null,{timeout:12000});
  eq((await saved()).people.testpeer.next,0,'confirmed cancellation stops polling');
  ok(calls.some(c=>c.kind==='calsel_sender'),'missing offer queries outgoing cancellation history');
  // Limit-only tasks survive a failed request even without any recorded sends.
  offersFailures=1;
  await b.evaluate(()=>{document.querySelector('#tradeOffer').remove();document.body.insertAdjacentHTML('beforeend','<div id="tradeOffer" data-receiver="LimitPeer" data-trade-id="45" data-original-id="7"><div class="message-info__title">Достигнут лимит предложений</div></div>');});
  await b.waitForFunction(()=>GM_getValue('as_trade_limits_debug_v1:state:tester',null)?.people.limitpeer?.error==='HTTP_503',null,{timeout:12000});
  ok((await saved()).people.limitpeer.next>0,'limit-only failure retains scheduled retry');
  ok((await saved()).people.limitpeer.limitObservedAt>0,'limit evidence survives temporary failure');
  await ctx.close();
  // Passive capture only: synthetic POSTs test actual fetch/XHR hooks without any live server.
  const wire=await browser.newContext();
  let wireDate=new Date(now).toUTCString(),wireSuccess=true;
  await wire.route('**/*',async route=>{
    if(route.request().resourceType()==='document')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body>'+profile+'</body></html>'});
    await new Promise(resolve=>setTimeout(resolve,150));
    return route.fulfill({contentType:'application/json',headers:{Date:wireDate},body:JSON.stringify(wireSuccess?{html:'<div class="message-info__content">Обмен отправлен, дождитесь его рассмотрения получателем</div>'}:{error:'denied'})});
  });
  const w=await wire.newPage();await w.goto('https://animesss.tv/cards/70/trade/');
  await w.evaluate(({source,now})=>{
    Date.now=()=>now+4000;
    Object.defineProperty(document,'visibilityState',{get:()=> 'hidden'});document.hasFocus=()=>false;
    const values={};window.wireValues=values;
    window.GM_getValue=(k,f)=>structuredClone(k in values?values[k]:f);window.GM_setValue=(k,v)=>values[k]=structuredClone(v);
    window.GM_deleteValue=k=>delete values[k];window.GM_listValues=()=>Object.keys(values);window.GM_addValueChangeListener=()=>{};window.GM_registerMenuCommand=()=>{};
    document.body.insertAdjacentHTML('beforeend','<div id="tradeOffer" data-receiver="Peer" data-trade-id="70" data-original-id="7"><button class="trade__send-trade-btn">Send</button></div>');
    (0,eval)(source);
  },{source,now});
  const wireSend=async(transport,owner)=>w.evaluate(async({transport,owner})=>{
    const root=document.querySelector('#tradeOffer');root.dataset.tradeId=String(owner);root.innerHTML='<button class="trade__send-trade-btn">Send</button>';root.querySelector('button').click();
    const body='action=trade_card&trade_id='+owner+'&original_card=7&user_hash=never-export-this';
    if(transport==='xhr')await new Promise(resolve=>{const x=new XMLHttpRequest();x.open('POST','/index.php?controller=ajax&mod=trade_ajax');x.addEventListener('loadend',resolve);x.send(body);});
    else {const r=await fetch('/index.php?controller=ajax&mod=trade_ajax',{method:'POST',body});await r.json();}
  },{transport,owner});
  await wireSend('xhr',70);await w.waitForTimeout(200);
  let captured=await w.evaluate(()=>Object.values(wireValues).filter(e=>e?.kind==='send'));
  eq(captured.length,1,'XHR success captured once');eq(captured[0].data.sentAt,now,'XHR reads server Date instead of local time');
  eq(captured[0].data.exact,true,'server-date matching exact');eq(captured[0].data.transport,'xhr','XHR transport in diagnostics');
  ok(captured[0].data.requestDurationMs>=100 && captured[0].data.requestDurationMs<10000,'XHR monotonic elapsed request captured despite frozen Date.now');
  eq(captured[0].data.durationSource,'request','XHR timing provenance');
  await wireSend('fetch',71);await w.waitForTimeout(200);
  captured=await w.evaluate(()=>Object.values(wireValues).filter(e=>e?.kind==='send'));
  eq(captured.length,2,'fetch success captured once');eq(captured[1].data.sentAt,now,'fetch reads server Date');
  ok(captured[1].data.requestDurationMs>=100 && captured[1].data.requestDurationMs<10000,'fetch request elapsed captured');
  wireDate='invalid';await wireSend('xhr',72);await w.waitForTimeout(200);
  captured=await w.evaluate(()=>Object.values(wireValues).filter(e=>e?.kind==='send'));
  eq(captured[2].data.timeSource,'local-fallback','invalid Date uses explicit fallback');eq(captured[2].data.exact,false,'fallback not marked exact');
  wireSuccess=false;await wireSend('fetch',73);await w.waitForTimeout(200);
  eq(await w.evaluate(()=>Object.values(wireValues).filter(e=>e?.kind==='send').length),3,'failed send does not create a trade');
  ok(!(await w.evaluate(()=>JSON.stringify(wireValues))).includes('never-export-this'),'request secret never stored');
  await wire.close();
  console.log('TRADE_LIMITS_OK '+checks+' checks');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
