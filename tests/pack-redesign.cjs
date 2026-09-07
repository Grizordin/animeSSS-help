// Usage: node tests/pack-redesign.cjs [path-to-unscripted-HTML]
// Offline Chromium tests: scripts from HTML are never executed, network is blocked.
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
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
const css=source.match(/globalStyle\.textContent = `([\s\S]*?)`;/)[1];
const constants=source.slice(source.indexOf('  const rankMap ='),source.indexOf('  const todayKey ='));
const functions=['parseStat','getRareFactor','stretchToOne','calcCardValue','calcTradeSValue','calcBadCardValue','getCardRank','isGoldSCard','getCardId','computeCardValue','getActiveRow','addCardValue','highlightBestCard','syncBestCardHighlights','addNeonToCard','clearNeonFromCard','getNeonCardType','applyNeonToCard','getPackTools','insertStatsButton','placePackStatsButton','cleanupStatsUi','insertGuaranteeInfo','autoPackReady','autoBeginChoice','autoCheckChoice','autoClickBestCard','handleAutoManualPick','suiteTelemetryFlush'].map(extract).join('\n');
const fallback=`<style>.lootbox__card{position:relative;min-width:0}.lootbox__card>img{width:100%;height:auto;aspect-ratio:288/432}.card-stats{display:grid;position:absolute;left:0;right:0;bottom:0}.card-stats>span{display:flex;justify-content:center}</style><div class="packs-page"><div class="packs-guarantees"><span class="lootbox__counter__s">1620</span></div><span class="lootbox__balance">239082</span><div class="packs-stage" data-pack-state="ready"><div class="lootbox__row" data-pack-id="107214619"><div class="lootbox__list">${[[1046,5,181,1],[3276,19,385,0],[2488,15,260,1]].map((nums,i)=>`<div class="lootbox__card ${i!==1?'anime-cards__owned-by-user':''}" data-rank="${['e','d','c'][i]}" data-id="${i}"><img alt="Card"><div class="card-stats">${nums.map(n=>`<span><b class="pack-stat-full">${n}</b><b class="pack-stat-short">${n}</b><b class="pack-stat-tiny">${n}</b></span>`).join('')}</div></div>`).join('')}</div></div></div></div>`;
const html=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):fallback;
const setup=String.raw`
const cfg={modStats:true,modGuarantee:true,modCardValue:true,modBestCard:true,modNeon:true,autoOpenEnabled:true,autoOpenTarget:0};
let passed=0;function check(v,msg){if(!v)throw Error(msg);passed++;}
const neonStateMap=new WeakMap();
const tryRecordAllCards=()=>{};
const createStatsPanel=()=>{if(document.getElementById('cv-stats-panel'))return;const p=document.createElement('div');p.id='cv-stats-panel';p.style.display='none';document.body.append(p);};
const renderStatsTab=()=>{}; const suiteClampToViewport=()=>{};let statsPanel=null;
const PACK20_COUNT=20,PACK20_STONES=1600,GUARANTEE_STONES=144000;
let autoPendingChoice=null,autoLastChosenPackId='',autoManualPackId='',autoWaitingManual=false,autoBusy=false,autoOpenSuppressGuard=false;
let autoOpenedCount=0,autoExpectation=null,status='',stopped=false,reported=0,scheduled=0;
const AUTO_DIAGNOSTIC_STALL_MS=10000,AUTO_DELAY_WAIT_CLOSE=350,AUTO_DELAY_RARE_VIEW=3000,AUTO_DELAY_AFTER_PICK=650;
const autoStartExpectation=(kind,d)=>{autoExpectation={kind,...d};};
const autoResolveExpectation=()=>{autoExpectation=null;};
const getAutoCardIdentity=c=>c.dataset.id;
const autoReportDiagnosticStall=()=>{reported++;};
const stopAutoOpen=s=>{status=s;stopped=true;autoPendingChoice=null;};
const setAutoStatus=s=>{status=s;}; const scheduleAutoLoop=()=>{scheduled++;};
const saveAutoOpenedCount=()=>{};const updateAutoCount=()=>{};const autoDiagnosticRecord=()=>{};
let rareDelayRequested=false;
const needsAutoRareViewDelay=()=>rareDelayRequested;const isAutoOpenAvailable=()=>true;
let suiteTelemetryFlushPromise=null,queue=[],sent=[],acceptBatch=true;
const suiteTelemetrySessionId='test';
const suiteTelemetryInstallId='test';
const suiteTelemetryPersistPending=async()=>{};
const suiteTelemetryWithQueueLock=async(fn)=>fn();
const suiteTelemetryReadQueue=()=>queue;
const suiteTelemetryTakeBatch=(items,module)=>items.filter(e=>e.module===module);
const suiteTelemetryWriteQueue=items=>{queue=items;};
const suiteReportEvent=async(type,payload)=>{sent.push(payload);return acceptBatch;};
`;
const tests=String.raw`
const cards=[...document.querySelectorAll('.lootbox__card')];
check(cards.length===3,'three fixture cards');
const expected=[[1046,5,181,1],[3276,19,385,0],[2488,15,260,1]];
cards.forEach((c,i)=>{const r=computeCardValue(c);check(JSON.stringify([r.total,r.want,r.trade,r.dup])===JSON.stringify(expected[i]),'exact full counters '+i);});
const legacy=document.createElement('span');legacy.innerHTML='<i></i> 1 234';
check(parseStat(legacy)===1234,'legacy counters');
legacy.title='Дубли на руках';check(parseStat(legacy)===1234,'legacy textual tooltip');
legacy.setAttribute('aria-label','Владельцев: 12 345');check(parseStat(legacy)===12345,'full accessible counter');
addCardValue();addCardValue();
check(document.querySelectorAll('.card-value').length===3,'no duplicate stars');
check(new Set(cards.map(c=>computeCardValue(c).value)).size>1,'values no longer collapse to one');
check(document.querySelectorAll('.cv-best-card').length===1,'one best card');
check(cards[1].classList.contains('cv-best-card'),'zero-duplicate low card wins existing policy');
check(document.querySelectorAll('.cv-pack-neon-ring').length===2,'separate neon ring');
const observer=new MutationObserver(()=>{});observer.observe(document.querySelector('.lootbox__list'),{childList:true,attributes:true,subtree:true});
addCardValue();check(observer.takeRecords().length===0,'stable redraw does not mutate cards');observer.disconnect();
const before=getComputedStyle(cards[0],'::before');
if(before.content!=='none')check(before.content.includes('Есть')&&before.maskImage==='none','ownership text has no neon mask');
insertStatsButton();insertGuaranteeInfo();insertStatsButton();insertGuaranteeInfo();
check(document.querySelector('.packs-guarantees').nextElementSibling.id==='cv-pack-tools','tools placed after guarantees');
check(document.querySelectorAll('#cv-pack-tools #cv-stats-btn').length===1,'single statistics button');
check(document.querySelectorAll('#cv-pack-tools #cv-guarantee-block').length===1,'single guarantee block');
check(document.querySelector('#cv-guarantee-block .cv-pack-tool-value').textContent==='1','guarantee amount');
check(document.querySelector('#cv-guarantee-block .cv-pack-stones-value').textContent.replace(/\D/g,'')==='34518','remaining stones');
document.getElementById('cv-pack-stats-card').click();
check(document.getElementById('cv-stats-panel').style.display==='none','statistics card itself is not a button');
check(document.querySelectorAll('#cv-pack-stats-card #cv-stats-btn').length===1,'button nested in statistics card');
const statsObserver=new MutationObserver(()=>{});statsObserver.observe(document.getElementById('cv-pack-stats-card'),{childList:true,subtree:true,attributes:true});
insertStatsButton();check(statsObserver.takeRecords().length===0,'stable statistics card update');statsObserver.disconnect();
document.getElementById('cv-stats-btn').click();
check(document.getElementById('cv-stats-panel').style.display==='block','statistics opens');
cfg.modStats=false;cleanupStatsUi();check(!document.getElementById('cv-pack-stats-card')&&!document.getElementById('cv-stats-btn')&&!!document.getElementById('cv-guarantee-block'),'stats off preserves guarantee and removes card');
cfg.modGuarantee=false;insertGuaranteeInfo();check(!document.getElementById('cv-guarantee-block'),'guarantee off cleans block');
cfg.modStats=true;cfg.modGuarantee=true;insertStatsButton();insertGuaranteeInfo();
cfg.modNeon=false;addCardValue();check(!document.querySelector('.cv-pack-neon-ring'),'neon off removes ring');
cfg.modCardValue=false;addCardValue();check(!document.querySelector('.cv-pack-valued,.card-value'),'value off restores layout');
cfg.modCardValue=true;cfg.modNeon=true;addCardValue();
const stage=document.querySelector('.packs-stage'),row=getActiveRow(),list=row.querySelector('.lootbox__list');
check(autoPackReady(),'ready cards selectable');
list.classList.add('step1');check(!autoPackReady(),'animation blocks choice');list.classList.remove('step1');
list.classList.add('packs-slot-reveal');check(!autoPackReady(),'shuffle blocks choice');list.classList.remove('packs-slot-reveal');
stage.dataset.packState='loading';check(!autoPackReady(),'loading blocks choice');stage.dataset.packState='ready';
let clicked=0;cards[1].addEventListener('click',()=>clicked++);
list.classList.add('step1');autoClickBestCard(cards[1]);
check(clicked===0&&!autoPendingChoice,'animation still blocks immediate selection');list.classList.remove('step1');
const nativeSetTimeout=window.setTimeout;let pickTimer=null;
window.setTimeout=(fn,delay)=>{pickTimer={fn,delay};return 1;};
rareDelayRequested=true;autoClickBestCard(cards[1]);
check(clicked===0&&pickTimer?.delay===3000,'intentional rare-card viewing delay preserved');
cfg.autoOpenEnabled=false;pickTimer.fn();check(clicked===0,'disabling auto open cancels delayed rare choice');
cfg.autoOpenEnabled=true;rareDelayRequested=false;pickTimer=null;
autoClickBestCard(cards[1]);
check(clicked===1&&pickTimer===null,'ready ordinary card selected synchronously without extra timer');
window.setTimeout=nativeSetTimeout;
check(clicked===1&&autoOpenedCount===0,'click alone not counted');
check(autoCheckChoice()&&autoOpenedCount===0,'same pack keeps waiting');
row.removeAttribute('data-pack-id');stage.dataset.packState='loading';
check(!autoCheckChoice()&&autoOpenedCount===1,'site removal confirms choice');
autoCheckChoice();check(autoOpenedCount===1,'confirmation counted once');
row.dataset.packId='new';stage.dataset.packState='ready';autoBeginChoice(cards[1]);
autoPendingChoice.startedAt=Date.now()-10001;autoCheckChoice();
check(stopped&&reported===1&&autoOpenedCount===1,'unconfirmed timeout stops and diagnoses without count');
stopped=false;autoWaitingManual=true;autoManualPackId='new';handleAutoManualPick(cards[1]);
check(!!autoPendingChoice&&autoOpenedCount===1,'manual pick also waits for confirmation');
row.dataset.packId='next';autoCheckChoice();check(autoOpenedCount===2,'manual confirmation counted');
autoBeginChoice(cards[1]);stage.dataset.packState='error';autoCheckChoice();
check(stopped&&autoOpenedCount===2,'site error never counts as success');
stage.dataset.packState='ready';
queue=[{id:'a',module:'auto_open',time:'test'},{id:'b',module:'gacha',time:'test'},{id:'c',module:'card_value',time:'test'}];
await suiteTelemetryFlush();
check(queue.length===0&&sent.map(b=>b.module).join(',')==='suite,gacha,suite','unsupported diagnostic components drained through suite');
check(sent[0].events[0].module==='auto_open','original diagnostic component preserved');
queue=[{id:'failed',module:'auto_open',time:'test'}];acceptBatch=false;await suiteTelemetryFlush();
check(queue.length===1,'failed delivery preserves queued incident');
acceptBatch=true;await suiteTelemetryFlush();check(queue.length===0,'later successful delivery drains queue');
window.packTest={passed,values:cards.map(c=>computeCardValue(c).value)};
`;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL||'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1360,height:1000}});
  await page.route('**/*',route=>route.abort());
  await page.setContent('<html><head></head><body></body></html>');
  await page.evaluate(({html,css})=>{
   const doc=new DOMParser().parseFromString(html,'text/html');
   const root=doc.querySelector('.packs-page');if(!root)throw Error('Missing packs-page');
   root.querySelectorAll('script,iframe,link,object,embed').forEach(e=>e.remove());
   root.querySelectorAll('*').forEach(e=>[...e.attributes].forEach(a=>{if(/^on|^(src|srcset|href|action)$/i.test(a.name))e.removeAttribute(a.name);}));
   // Fundamental grid rules from the site's external cards.css (not in outerHTML).
   const base=document.createElement('style');base.textContent='*{box-sizing:border-box}body{margin:16px;background:#111;color:#ddd;font-family:Arial;--bg:#111;--bg-2:#191919;--bdc:#292929;--tt:#ddd;--tt-2:#999}.packs-page{max-width:1320px;margin:auto}.lootbox__list{display:grid;position:relative;--gap:24px;gap:var(--gap);grid-template-columns:repeat(3,minmax(0,1fr))}.lootbox__card>img{display:block;background:linear-gradient(135deg,#302c39,#141b22)}';document.head.append(base);
   root.querySelectorAll('.lootbox__card>img').forEach(img=>img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="288" height="432"><rect width="288" height="432" fill="#242630"/></svg>'));
   doc.querySelectorAll('style').forEach(s=>document.head.append(s.cloneNode(true)));
   const style=document.createElement('style');style.textContent=css;document.head.append(style);
   document.body.append(root);
  },{html,css});
  await page.evaluate(code=>new (Object.getPrototypeOf(async function(){}).constructor)(code)(),constants+'\n'+setup+'\n'+functions+'\n'+tests);
  const result=await page.evaluate(()=>window.packTest);
  for(const width of [1360,390]){
   await page.setViewportSize({width,height:1000});
   const layout=await page.evaluate(()=>[...document.querySelectorAll('.card-value')].map(v=>{const a=v.getBoundingClientRect(),b=v.parentElement.getBoundingClientRect();return a.bottom<=b.bottom+1&&a.top>=b.top-1&&a.right<=b.right+1;}));
   if(layout.some(v=>!v))throw Error('Star overflow at '+width);
   result.passed++;
   if(process.argv[2]){
    fs.mkdirSync(path.join(__dirname,'..','output','pack-redesign'),{recursive:true});
    await page.locator('#cv-pack-tools').screenshot({path:path.join(__dirname,'..','output','pack-redesign','tools-'+width+'.png')});
    await page.locator('.packs-stage').screenshot({path:path.join(__dirname,'..','output','pack-redesign','cards-'+width+'.png')});
   }
  }
  console.log(JSON.stringify({result:'PACK_REDESIGN_OK',...result}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
