// Offline integration: real helper policy, formulas, modal, page buttons and final auto-click check.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');new vm.Script(source);
function extract(name){
 const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(source);if(!m)throw Error(name);
 const lines=source.slice(m.index).split(/\r?\n/);
 for(let n=1;n<=lines.length;n++)if(n===1 || lines[n-1]===m[1]+'}'){
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }throw Error('Cannot extract '+name);
}
const names=['getBestCardDefaults','getBestCardSettingGroups','normalizeBestCardSettings','getBestCardPolicy','isBestCardRare','getBestCardPriorityValue','selectBestCardEntries','highlightBestCard','syncBestCardHighlights','syncBestCardReasons','parseStat','getRareFactor','stretchToOne','calcCardValue','calcBadCardValue','calcTradeSValue','getCardRank','isGoldSCard','computeCardValue','getActiveRow','getPackTools','insertStatsButton','placePackStatsButton','cleanupStatsUi','cleanupBestCardSettingsUi','openBestCardSettings','autoClickBestCard'];
const constants=source.slice(source.indexOf('  const rankMap ='),source.indexOf('  const todayKey ='));
const css=source.match(/globalStyle\.textContent = `([\s\S]*?)`;/)[1];
const setup=`
const cfg={modStats:true,modBestCard:true,modCardValue:true,autoOpenEnabled:false,bestCardSettings:{}};
let bestCardPackState=null,bestCardSettingsDialogOpen=null,statsPanel=null,saves=0,clicks=0,scheduled=0;
const SETTINGS_KEY='suite_settings_v1';let stored=null,failStorage=false;
const GM_setValue=(key,value)=>{if(failStorage)throw Error('No storage');if(key!==SETTINGS_KEY)throw Error('Wrong key');stored=JSON.parse(value);saves++;};
let autoBusy=false,autoRunGeneration=0,autoOpenSuppressGuard=false,autoLastChosenPackId='',rareDelay=false;
const delayed=[];const nativeTimeout=window.setTimeout.bind(window);
const setTimeout=(fn,delay)=>delay===3000?(delayed.push(fn),0):nativeTimeout(fn,delay);
const AUTO_DELAY_RARE_VIEW=3000,AUTO_DELAY_WAIT_CLOSE=350,AUTO_DELAY_AFTER_PICK=650;
const autoPackReady=()=>true,needsAutoRareViewDelay=()=>rareDelay,setAutoStatus=()=>{},autoBeginChoice=()=>true,autoDiagnosticRecord=()=>{};
const getAutoCardIdentity=c=>c.dataset.id,scheduleAutoLoop=()=>scheduled++;
const saveCfg=()=>saves++,debouncedAddCardValue=()=>highlightBestCard(),renderStatsTab=()=>{},suiteClampToViewport=()=>{};
const createStatsPanel=()=>{if(document.getElementById('cv-stats-panel'))throw Error('Duplicate stats creation');const p=document.createElement('div');p.id='cv-stats-panel';p.style.display='none';document.body.append(p);};
${constants}
${names.map(extract).join('\n')}
window.api={cfg,defaults:getBestCardDefaults,select:selectBestCardEntries,normalize:normalizeBestCardSettings,score:getBestCardPriorityValue,
compute:computeCardValue,policy:getBestCardPolicy,highlight:highlightBestCard,insert:insertStatsButton,pick:autoClickBestCard,
resetState:()=>bestCardPackState=null,setRare:v=>rareDelay=v,flush:()=>delayed.splice(0).forEach(fn=>fn()),
snapshot:()=>({saves,clicks,scheduled,stored}),clicked:()=>clicks++,failStorage:v=>failStorage=v};
insertStatsButton();
`;
let passed=0;const check=(v,message)=>{assert.ok(v,message);passed++;};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
  await page.setContent('<style>body{background:#111;color:#ddd;font:14px Segoe UI;margin:24px}.packs-guarantees{padding:24px;border:1px solid #333;border-radius:12px}.lootbox__card{display:inline-block;margin:12px;padding:24px;background:#222}.card-stats{display:flex;gap:8px}</style><div class="packs-page"><div class="packs-guarantees">Бонусная A на выбор · Гарантированная S</div><div class="lootbox__row" data-pack-id="first"></div></div>');
  await page.addStyleTag({content:css});await page.evaluate(setup);
  const logic=await page.evaluate(()=>{
   let checks=0;const ck=(v,m)=>{if(!v)throw Error(m);checks++;};const a=api;
   const entry=(id,rank,value,extra={})=>({identity:id,rank,value,dup:1,total:100,want:10,owned:true,wanted:false,isGold:false,...extra});
   const choose=(items,settings={},state={})=>a.select(items,{...a.defaults(),custom:true,...settings},state).entries.map(e=>e.identity).join(',');
   const bc=[entry('B','B',35),entry('C','C',50)];
   ck(choose(bc,{rank:'a'})==='C','A mode compares value without A');
   ck(choose(bc,{rank:'ab'})==='B','AB mode falls back to B');
   const ec=[entry('E','E',25),entry('C','C',20)];
   ck(choose(ec,{rank:'highest'})==='C','highest C20 beats E25');
   ck(choose(ec,{rank:'ab'})==='E','AB without A or B compares value');
   ck(choose([entry('A','A',1),entry('B','B',90)],{rank:'a'})==='A','A priority');
   // All rare classes override ordinary 1000-point cards in every mode, even with collection preference.
   for(const custom of [false,true])for(const rank of ['a','ab','highest'])for(const rare of ['S','ASS','S_PLUS','A_PLUS','B_PLUS','C_PLUS','D_PLUS','E_PLUS']){
    ck(choose([entry('normal','A',1000,{owned:false,wanted:true,dup:0}),entry('rare',rare,1)],{custom,rank,unowned:'always',tie:'random'})==='rare','protected '+rare+' '+rank+' '+custom);
   }
   for(const rank of ['a','ab','highest'])ck(choose([entry('ASS','ASS',1000),entry('gold','S',1,{isGold:true})],{rank})==='gold','gold priority '+rank);
   ck(choose([entry('A','A',50,{want:100}),entry('B','A',45,{want:140})])==='B','A demand rule');
   ck(choose([entry('A','A',50,{want:100}),entry('B','A',45,{want:139})])==='A','A demand boundary');
   ck(choose([entry('A','A',50,{want:100}),entry('B','A',45,{want:140})],{demandA:false})==='A','demand disabled');
   const weak=[entry('own','C',9),entry('new','D',8,{owned:false})];
   ck(choose(weak,{weak:false})==='new','low availability preference');
   ck(choose(weak,{unowned:'never',weak:false})==='own','availability never');
   ck(choose([entry('own','C',10),entry('new','D',8,{owned:false})],{weak:false})==='own','threshold strictly below');
   ck(choose([entry('own','C',50),entry('new','D',8,{owned:false})],{unowned:'always',weak:false})==='new','availability always');
   ck(choose([entry('own','C',9),entry('zero','D',5,{dup:0})],{unowned:'never'})==='zero','weak no duplicates');
   const ties=[entry('first','C',20),entry('second','C',20,{dup:0,total:50,want:20})];
   for(const tie of ['dups','want','owners'])ck(choose(ties,{tie})==='second','tie '+tie);
   ck(choose(ties)==='first,second','manual retains ties');
   const original=Math.random;let rolls=0;Math.random=()=>{rolls++;return .8;};
   try{const state={};for(let i=0;i<30;i++)ck(choose(ties,{tie:'random'},state)==='second','stable random '+i);ck(rolls===1,'random drawn once');}finally{Math.random=original;}
   const r={value:25,total:1000,want:0,trade:0,dup:0,rank:'C',isGold:false};
   ck(a.score(r,true,{...a.defaults(),custom:true,wanted:'normal'})===25,'normal desired +15');
   ck(a.score(r,true,{...a.defaults(),custom:true,wanted:'strong'})===40,'strong desired +30 total');
   ck(a.score(r,true,{...a.defaults(),custom:true,wanted:'off'})===6.52,'off desired +0 uses existing low-value formula');
   ck(a.score({...r,value:47.5,rank:'A',dup:4},false,{...a.defaults(),custom:true,duplicates:'off'})===55,'no duplicate penalty');
   ck(a.normalize({custom:true,protectRare:false,rank:'invalid'}).protectRare===true,'cannot disable rare priority');
   ck(a.normalize({weakThreshold:10000}).weakThreshold===100,'number bounds');
   return checks;
  });passed+=logic;
  const q=s=>page.locator('#cv-best-settings-host').locator(s);
  const out=path.join(__dirname,'..','output','best-card-integrated');fs.mkdirSync(out,{recursive:true});
  await page.locator('#cv-stats-btn').click();await page.locator('#cv-stats-btn').click();
  check(await page.locator('#cv-stats-panel').count()===1,'one statistics modal');
  await page.locator('#cv-best-settings-btn').click();
  check(await q('dialog').isVisible(),'independent best-card dialog');
  check(await q('.notice').innerText().then(s=>!s.includes('превью')),'live explanation');
  await q('.toggle').click();await q('#field-rank').selectOption('ab');await q('#field-wanted').selectOption('off');await q('#field-tie').selectOption('random');await q('.primary').click();
  check(await page.evaluate(()=>api.cfg.bestCardSettings.rank==='ab'&&api.cfg.bestCardSettings.wanted==='off'&&api.snapshot().saves===1),'UI saves real helper config');
  await q('#field-rank').selectOption('highest');await q('.cancel').click();await page.locator('#cv-best-settings-btn').click();
  check(await q('#field-rank').inputValue()==='ab','cancel preserves saved policy');
  await page.evaluate(()=>api.failStorage(true));await q('#field-rank').selectOption('highest');await q('.primary').click();
  check(await q('.feedback').innerText().then(t=>t.includes('Не удалось сохранить')),'real storage failure reported');
  check(await page.evaluate(()=>api.cfg.bestCardSettings.rank==='ab'),'failed write does not change active config');
  await page.evaluate(()=>api.failStorage(false));await q('#field-rank').selectOption('ab');
  await q('#field-rank').locator('..').locator('.help').hover();
  check(await q('#tooltip').innerText().then(t=>t.includes('S, ASS')&&t.includes('Gold')),'rare priority tooltip');
  await page.mouse.move(1,1);await q('.body').evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:path.join(out,'desktop.png')});await q('.close').click();
  const dom=await page.evaluate(()=>{
   const a=api;let checks=0;const ck=(v,m)=>{if(!v)throw Error(m);checks++;};
   const row=document.querySelector('.lootbox__row');
   function cards(ranks=['C','D']){
    row.innerHTML=ranks.map((rank,i)=>'<button class="lootbox__card anime-cards__owned-by-user" data-rank="'+rank+'" data-id="'+i+'"><div class="card-stats"><span>1000</span><span>0</span><span>0</span><span>0</span><span class="card-value">★ ORIGINAL</span></div></button>').join('');
    row.querySelectorAll('button').forEach(c=>c.addEventListener('click',a.clicked));return [...row.querySelectorAll('button')];
   }
   a.cfg.bestCardSettings={custom:true,rank:'highest',tie:'random',unowned:'never',weak:false};a.resetState();
   let list=cards();a.highlight();ck(list[0].classList.contains('cv-best-card'),'DOM selects C over D');
   const base=list.map(a.compute).map(x=>x.value);
   a.cfg.bestCardSettings.wanted='strong';a.highlight();
   ck(JSON.stringify(list.map(a.compute).map(x=>x.value))===JSON.stringify(base),'statistics value unchanged');
   ck(list.every(c=>c.querySelector('.card-value').textContent==='★ ORIGINAL'),'star text unchanged');
   const mo=new MutationObserver(()=>{});mo.observe(row,{subtree:true,attributes:true,childList:true});a.highlight();
   ck(mo.takeRecords().length===0,'stable highlights and explanation do not mutate DOM');mo.disconnect();
   a.cfg.autoOpenEnabled=true;a.cfg.bestCardSettings={custom:true,rank:'a'};a.resetState();
   ck(a.policy(row).settings.rank==='a','capture auto policy');a.cfg.bestCardSettings={custom:true,rank:'highest'};
   ck(a.policy(row).settings.rank==='a','running pack settings frozen');
   const clone=row.cloneNode(true);ck(a.policy(clone).settings.rank==='a','same pack DOM replacement frozen');
   row.dataset.packId='second';ck(a.policy(row).settings.rank==='highest','next pack gets new policy');
   a.setRare(true);list=cards(['S','S']);a.highlight();a.pick(list.find(c=>c.classList.contains('cv-best-card')));
   // Gold appears during the rare-view delay: the stale ordinary-S click must not proceed.
   list[1].dataset.gold='1';a.flush();
   ck(a.snapshot().clicks===0,'delayed stale recommendation not clicked');
   a.setRare(false);a.highlight();a.pick(list[1]);ck(a.snapshot().clicks===1,'current gold choice reaches auto click');
   list[1].querySelector('.card-stats').remove();a.highlight();ck(!row.querySelector('.cv-best-card'),'partial stats clear all recommendations');
   a.cfg.autoOpenEnabled=false;return checks;
  });passed+=dom;
  // Every combination of module switches, no duplicate controls and stable refresh.
  for(const [stats,best,title] of [[false,true,'Лучшая карта'],[true,false,'Статистика паков'],[true,true,'Статистика и лучшая карта'],[false,false,null]]){
   await page.evaluate(({stats,best})=>{api.cfg.modStats=stats;api.cfg.modBestCard=best;api.insert();},{stats,best});
   check(await page.locator('#cv-stats-btn').count()===Number(stats)&&await page.locator('#cv-best-settings-btn').count()===Number(best),'module buttons '+stats+best);
   check(title?await page.locator('.cv-pack-tool-title').innerText()===title:await page.locator('#cv-pack-stats-card').count()===0,'dynamic title '+title);
  }
  await page.evaluate(()=>{api.cfg.modStats=true;api.cfg.modBestCard=true;api.insert();});
  check(await page.evaluate(()=>{const el=document.querySelector('#cv-pack-stats-card'),mo=new MutationObserver(()=>{});mo.observe(el,{subtree:true,childList:true,attributes:true});api.insert();const n=mo.takeRecords().length;mo.disconnect();return n===0;}),'stable page card');
  await page.locator('#cv-best-settings-btn').click();await page.setViewportSize({width:390,height:844});
  check(await q('dialog').evaluate(el=>el.scrollWidth===el.clientWidth),'mobile modal no overflow');
  await page.screenshot({path:path.join(out,'mobile.png')});
  await page.evaluate(()=>{api.cfg.modCardValue=false;api.insert();});
  check(!await q('dialog').isVisible()&&await page.locator('#cv-best-settings-btn').count()===0,'prerequisite disabled closes settings');
  check(errors.length===0,'no browser errors: '+errors.join('; '));console.log('BEST_CARD_SETTINGS_OK '+passed);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
