// Offline browser checks of the real module; no account or site requests.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
function extract(name){
 const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(source),lines=source.slice(m.index).split(/\r?\n/);
 for(let n=2;n<=lines.length;n++)if(lines[n-1]===m[1]+'}'){
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }
 throw Error(name);
}
const native=`<section class="ps-wallet" aria-label="Ваш баланс"><div class="ps-wallet-main"><span class="ps-wallet-icon"><i class="fal fa-gem" aria-hidden="true"></i></span><div><div class="ps-label">Ваши камни духа</div><div class="ncard-shop__text-caption"><span data-ps-balance="">167002</span><i class="diamond" aria-hidden="true"></i></div></div></div><div class="ps-wallet-actions"><a class="ps-button ps-button--primary ncard-shop__btn-donate" href="/donate/">Пополнить</a><a class="ps-button" href="/transactions/">История операций</a></div></section><div id="collection">Ваша коллекция</div>`;
const legacy='<div class="ncard-shop__text lootbox__descr d-flex fd-column r-gap-20"><div class="ncard-shop__text-main lootbox__descr-section ta-center"><span>167002</span><i class="diamond"></i></div><a href="/donate/">Пополнить</a></div>';
const baseCSS='*{box-sizing:border-box}body{margin:0;padding:24px;background:#111;color:#e5eeee;font:14px Arial}.ps-wallet{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:26px;background:#1b2325;border:1px solid #344647;border-radius:18px}.ps-wallet-main,.ps-wallet-actions{display:flex;align-items:center;gap:12px}.ps-wallet-icon{background:#253f39;width:54px;height:54px;border-radius:14px}.ps-label{color:#a6b9bc;font-size:13px;margin-bottom:8px}.ncard-shop__text-caption{font-size:32px;font-weight:bold}.ps-button{padding:14px;border:1px solid #344647;border-radius:10px;color:inherit;text-decoration:none}.ps-button--primary{background:#2d7564}.diamond{display:inline-block;width:16px;height:16px;background:#65b9a1;clip-path:polygon(25% 0,75% 0,100% 35%,50% 100%,0 35%)}@media(max-width:600px){body{padding:12px}.ps-wallet{flex-direction:column;align-items:flex-start;padding:18px}.ps-wallet-actions{flex-wrap:wrap}}';
const cache=[{amount:1000000,date:Date.now()-10000,description:'Reward'},{amount:-80000,date:Date.now()-20000,description:'Открытие паков карточек'},{amount:-3000,date:Date.now()-30000,description:'Подношение'}];
const historyHTML=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):'<div class="ps-table-wrap ncard-transactions__table"><table class="ps-history-table"><tbody>'+Array.from({length:20},(_,i)=>'<tr class="new-tr-item" data-ps-flow="expense"><td class="new-tr-amount"><span>- 1600</span></td><td class="new-tr-date" data-ps-label="Баланс">86282</td><td class="new-tr-date" data-ps-label="Дата">11.09.2026 19:20:'+String(54-i).padStart(2,'0')+'</td><td data-ps-label="Описание">Открытие паков карточек</td></tr>').join('')+'</tbody></table></div>';
let passed=0;const check=(value,message)=>{if(!value)throw Error(message);passed++;};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  async function setup(html=native,mode='cached'){
   const page=await browser.newPage({viewport:{width:1366,height:900}});
   await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body></body></html>'}));
   await page.goto('https://fixture.invalid/shop/');
   await page.setContent('<style>'+baseCSS+'</style>'+html);
   await page.evaluate(({cache,mode})=>{
    window.store={animestars_transactions_cache:JSON.stringify(cache),animestars_transactions_lastDate:String(cache[0].date),animestars_transactions_lastUpdate:String(Date.now()),nonPackSpentStones:'12500',suite_stones_extra_panel_pos_v1:{left:9999,top:9999}};
    window.GM={getValue:async(k,d)=>Object.hasOwn(store,k)?store[k]:d,setValue:async(k,v)=>{await new Promise(r=>setTimeout(r,2));store[k]=v;}};
    window.cfg={modStones:mode!=='disabled'};window.gmStoreGet=(k,d)=>store[k]??d;window.gmStoreSet=(k,v)=>store[k]=v;
    window.suiteKeepInViewport=()=>{};window.makeDraggable=()=>{};
    window.requests=[];window.mode=mode;
    window.fetch=async url=>{
     requests.push(url);
     if(window.mode==='fail') return {ok:false,status:403};
     if(window.mode==='partial'&&url==='/transactions/page/2/') return {ok:false,status:403};
     if(window.mode==='partial-empty'&&url==='/transactions/page/2/') return {ok:true,text:async()=>'<form>Login</form>'};
     if(window.mode==='hold') return new Promise(resolve=>window.release=()=>resolve({ok:true,text:async()=>'<div id="pagination"></div>'}));
     if(url==='/transactions/') return {ok:true,text:async()=>'<div id="pagination">'+(window.mode.startsWith('partial')?'<a href="/transactions/page/2/">2</a>':'')+'</div>'};
     if(window.mode==='fixture') return {ok:true,text:async()=>window.historyFixture};
     return {ok:true,text:async()=>window.mode==='empty'?'<form>Login</form>':'<div class="table-responsive ncard-transactions__table"><table><tbody><tr class="new-tr-item"><td class="new-tr-amount"><span>+1000</span></td><td class="new-tr-date">11.09.2026 10:00:00</td><td>Reward</td></tr><tr class="new-tr-item"><td class="new-tr-amount"><span>-200</span></td><td class="new-tr-date">11.09.2026 09:00:00</td><td>Packs</td></tr></tbody></table></div>'};
    };
   },{cache,mode});
   await page.evaluate('(()=>{'+extract('initStones')+'\n'+extract('cleanupStonesUi')+'\nwindow.initStones=initStones;window.cleanupStonesUi=cleanupStonesUi;initStones();})()');
   return page;
  }
  const page=await setup();
  const parserResults=await page.evaluate('(()=>{'+['parseDateSafe','parseTransactions','isNonPackExpense','calculateTotals'].map(extract).join('\n')+`
   let passed=0;const check=(v,m)=>{if(!v)throw Error(m);passed++;};
   const html=${JSON.stringify(historyHTML)},rows=parseTransactions(html);
   check(rows.length===20,'all 20 redesigned operations recognized');
   rows.forEach((r,i)=>{check(r.amount===-1600,'expense sign '+i);check(r.date>0&&r.description==='Открытие паков карточек','date and description '+i);});
   check(calculateTotals(rows).spent===32000&&calculateTotals(rows).earned===0&&calculateTotals(rows).nonPackSpent===0,'pack expenses only in overall total');
   const mixed=calculateTotals([{amount:-1600,description:'Открытие паков карточек'},
    {amount:-200,description:'Подношение'},{amount:-50,description:'Другое событие'},
    {amount:500,description:'Награда'},{amount:100,description:'Открытие паков карточек'},
    {amount:0,description:'Другое событие'},{amount:-10,description:''},
    {amount:-20},{amount:-100,description:'  Открытие   паков карточек  '}]);
   check(mixed.earned===600&&mixed.spent===1980&&mixed.nonPackSpent===280,'all other negative descriptions counted without double counting or income');
   check(calculateTotals([]).nonPackSpent===0,'empty history starts at zero');
   const running=calculateTotals([{amount:-100,description:'Подношение'}]);
   calculateTotals([{amount:-1600,description:'Открытие паков карточек'},{amount:-50,description:'Комиссия'}],running);
   check(running.spent===1750&&running.nonPackSpent===150,'incremental accumulation shares classification');
   check(rows[0].date===new Date(2026,8,11,19,20,54).getTime(),'date parsed instead of balance');
   const doc=new DOMParser().parseFromString(html,'text/html'),row=doc.querySelector('tr.new-tr-item');
   row.prepend(row.querySelector('[data-ps-label="Дата"]'));
   check(parseTransactions(doc.documentElement.outerHTML)[0].date===rows[0].date,'labeled date works after column reordering');
   row.querySelector('.new-tr-amount span').textContent='+ 1\\u00a0200';
   check(parseTransactions(doc.documentElement.outerHTML)[0].amount===1200,'income and grouped amount');
   doc.querySelector('.ncard-transactions__table').className='ps-table-wrap';
   check(parseTransactions(doc.documentElement.outerHTML).length===20,'new table class fallback');
   doc.querySelectorAll('tr.new-tr-item').forEach(r=>r.hidden=true);
   check(parseTransactions(doc.documentElement.outerHTML).length===20,'visual income/expense filter does not remove operations');
   const legacy='<div class="table-responsive ncard-transactions__table"><table><tbody><tr class="new-tr-item"><td class="new-tr-amount"><span>+200</span></td><td class="new-tr-date">86282</td><td class="new-tr-date">11.09.2026 19:20:54</td><td>Reward</td></tr></tbody></table></div>';
   check(parseTransactions(legacy)[0].date===rows[0].date&&parseTransactions(legacy)[0].amount===200,'legacy table still parsed');
   let rejected=false;try{parseTransactions('<form>Login</form>');}catch{rejected=true;}check(rejected,'login markup still rejected');
   return passed;
  })()`);
  passed+=parserResults;
  passed+=await page.evaluate('(async()=>{'+['isNonPackExpense','calculateTotals','updateCacheIncremental'].map(extract).join('\n')+`
   let passed=0;const check=(v,m)=>{if(!v)throw Error(m);passed++;};
   const CACHE_KEY='cache',DATE_KEY='date',LAST_UPDATE_KEY='updated',DAY_MS=86400000;
   const old=[{amount:-100,date:100,description:'Подношение'},{amount:-1600,date:90,description:'Открытие паков карточек'}];
   const newer=[{amount:-200,date:400,description:'Покупка ключа'},{amount:-1600,date:300,description:'Открытие паков карточек'},{amount:50,date:200,description:'Возврат'}];
   const saved={cache:old,date:'100',updated:'0'},progress=[];let requests=0;
   async function load(k,d){return saved[k]??d;}
   async function loadJSON(k,d){return structuredClone(saved[k]??d);}
   async function save(k,v){saved[k]=v;}
   async function saveJSON(k,v){saved[k]=structuredClone(v);}
   async function sleep(){}
   async function fetchPage(){requests++;return [...newer,...old];}
   let rows=await updateCacheIncremental({maxPages:1,onTotals:t=>progress.push(t)});
   check(rows.length===5&&requests===1,'incremental scan merges new rows once');
   check(calculateTotals(rows).spent===3500&&calculateTotals(rows).nonPackSpent===300,'incremental scan retains old subtotal and adds new non-packs');
   check(progress[0].nonPackSpent===300&&progress[0].spent===3500,'progress includes automatic subtotal');
   rows=await updateCacheIncremental({maxPages:1,onTotals:t=>progress.push(t)});
   check(requests===1&&progress.at(-1).nonPackSpent===300,'fresh cache gives same subtotal without another scan');
   rows=await updateCacheIncremental({forceFull:true,maxPages:1,onTotals:t=>progress.push(t)});
   check(rows.length===5&&calculateTotals(rows).nonPackSpent===300,'full recount replaces rather than adds subtotal');
   check(progress.at(-1).spent===3500&&progress.at(-1).nonPackSpent===300,'full scan progress includes subtotal');
   return passed;
  })()`);
  await page.waitForFunction(()=>document.querySelector('.cv-stones-wallet__refresh')?.disabled===false && document.querySelector('.earned-diamonds')?.textContent.includes('1'));
  let result=await page.evaluate(()=>({
   wallet:document.querySelector('.ps-wallet').outerHTML,
   after:document.querySelector('.ps-wallet').nextElementSibling.className,
   next:document.querySelector('.cv-stones-wallet').nextElementSibling.id,
   cards:document.querySelector('.cv-stones-wallet__grid').children.length,
   earned:document.querySelector('.earned-diamonds>span').textContent.replace(/\s/g,''),spent:document.querySelector('.spent-diamonds>span').textContent.replace(/\s/g,''),
   extra:document.querySelector('.cv-stones-panel__value').textContent.replace(/\s/g,''),
   floats:document.querySelectorAll('.cv-stones-floating-btn').length,
   panelPosition:getComputedStyle(document.querySelector('.cv-stones-panel')).position,requests:requests.length,
   cache:store.animestars_transactions_cache
  }));
  check(result.wallet===native.slice(0,native.indexOf('<div id="collection">')),'native balance, links and attributes untouched');
  check(result.after==='cv-stones-wallet'&&result.next==='collection','inserted after balance, before collection');
  check(result.cards===3,'three cards');check(result.earned==='+1000000','cached earned');check(result.spent==='−83000','cached spent');check(result.extra==='3000','automatic subtotal derived from saved descriptions, ignores manual value');
  check(result.cache===JSON.stringify(cache),'no cache migration');check(result.requests===1,'fresh cache does not scan history pages');
  check(result.floats===0&&result.panelPosition==='static','no floating controls or stale position');
  await page.evaluate(()=>{initStones();initStones();});
  check(await page.locator('.cv-stones-wallet').count()===1,'repeat init does not duplicate');
  for(const width of [1366,768,390,320]){
   await page.setViewportSize({width,height:1100});
   const geometry=await page.evaluate(()=>{
    const root=document.querySelector('.cv-stones-wallet'),r=root.getBoundingClientRect();
    return {fits:document.documentElement.scrollWidth<=innerWidth && root.scrollWidth<=root.clientWidth,
     all:[...root.querySelectorAll('button,input,.cv-stones-wallet__card,.cv-stones-panel')].every(n=>{const b=n.getBoundingClientRect();return b.x>=r.x&&b.right<=r.right+1;}),
     cols:getComputedStyle(root.querySelector('.cv-stones-wallet__grid')).gridTemplateColumns.split(' ').length};
   });
   check(geometry.fits,'no horizontal overflow '+width);check(geometry.all,'controls stay in card '+width);check(geometry.cols===(width>850?3:width>520?2:1),'responsive columns '+width);
  }
  check(await page.locator('.cv-stones-panel input,.cv-stones-panel button:not(.cv-stones-history-btn),.cv-stones-wallet__controls').count()===0,'manual input, add and reset removed');
  const beforeHistory=await page.evaluate(()=>({requests:requests.length,store:JSON.stringify(store)}));
  await page.click('.cv-stones-history-btn');
  await page.waitForSelector('.cv-stones-history__row');
  check(await page.locator('.cv-stones-history__row').count()===1,'history includes only non-pack expenses');
  check(await page.locator('.cv-stones-history__amount').textContent()==='−3\u00a0000','history amount');
  check(await page.locator('.cv-stones-history__description').textContent()==='Подношение','history description');
  check(await page.locator('.cv-stones-history').evaluate(d=>d.open&&d.matches(':modal')),'accessible native modal');
  check(await page.locator('.cv-stones-history button').count()===1,'only close button, no pagination');
  await page.keyboard.press('Escape');
  check(await page.locator('.cv-stones-history').count()===0,'Escape closes history');
  check(await page.evaluate(()=>JSON.stringify(store))===beforeHistory.store,'opening history leaves storage unchanged');
  check(await page.evaluate(()=>requests.length)===beforeHistory.requests,'opening history makes no requests');
  // A large saved ledger: scrolling appends rows without paging or fetching.
  await page.evaluate(()=>{
   const date=new Date(2026,9,23,7,31,42).getTime();
   store.animestars_transactions_cache=JSON.stringify([
    {amount:-1600,date:date+2000,description:'  Открытие   паков карточек  '},
    {amount:900,date:date+1000,description:'Награда'},
    ...Array.from({length:121},(_,i)=>({amount:-i-1,date:date-i*1000,description:i===0?'<img src=x onerror="window.injected=true">':i===120?'':('Трата '+i+' '+ 'длинноеописание'.repeat(8))}))
   ].reverse());
  });
  await page.click('.cv-stones-history-btn');
  await page.waitForSelector('.cv-stones-history__row');
  check(await page.locator('.cv-stones-history__row').count()===50,'long ledger initially renders only 50 rows');
  check(await page.locator('.cv-stones-history__date').first().textContent()==='23.10.2026 07:31:42','site wall-clock timestamp preserved with seconds and descending order');
  check(await page.locator('.cv-stones-history img').count()===0,'description rendered as text, not executable HTML');
  check((await page.locator('.cv-stones-history__summary').textContent()).includes('121 записей'),'summary counts all expenses, excludes packs and income');
  for(const count of [100,121]){
   await page.locator('.cv-stones-history__list').evaluate(el=>el.scrollTop=el.scrollHeight);
   await page.waitForFunction(n=>document.querySelectorAll('.cv-stones-history__row').length===n,count);
   check(true,'scroll appended rows up to '+count);
  }
  check(await page.locator('.cv-stones-history__description').last().textContent()==='Без описания','missing description fallback');
  await page.addStyleTag({content:await page.evaluate('(()=>{'+extract('suiteBuildLightThemeCss')+';return suiteBuildLightThemeCss();})()')});
  for(const dark of [false,true])for(const width of [1366,390,320]){
   await page.setViewportSize({width,height:800});
   await page.evaluate(dark=>document.body.classList.toggle('dt-is-active',dark),dark);
   const g=await page.locator('.cv-stones-history').evaluate(d=>{
    const r=d.getBoundingClientRect(),list=d.querySelector('.cv-stones-history__list');
    return {fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&list.scrollWidth<=list.clientWidth,bg:getComputedStyle(d).backgroundColor};
   });
   check(g.fits,'history fits '+width+' dark='+dark);
   check(g.bg===(dark?'rgb(27, 35, 37)':'rgb(255, 255, 255)'),'history theme '+width+' dark='+dark);
  }
  if(process.env.STONES_SCREENSHOTS){
   fs.mkdirSync(path.join(__dirname,'..','output','stones-wallet'),{recursive:true});
   await page.locator('.cv-stones-history__list').evaluate(el=>el.scrollTop=0);
   await page.screenshot({path:path.join(__dirname,'..','output','stones-wallet','history-mobile.png')});
   await page.setViewportSize({width:1366,height:900});
   await page.evaluate(()=>document.body.classList.remove('dt-is-active'));
   await page.screenshot({path:path.join(__dirname,'..','output','stones-wallet','history-light.png')});
  }
  await page.click('[data-history="close"]');
  check(await page.locator('.cv-stones-history').count()===0,'close button removes history');
  check(await page.evaluate(()=>requests.length)===beforeHistory.requests,'scroll and theme changes make no requests');
  await page.evaluate(saved=>Object.assign(store,JSON.parse(saved)),beforeHistory.store);
  check(await page.evaluate(()=>store.nonPackSpentStones)==='12500','old manual value preserved but unused');
  await page.evaluate(()=>{window.mode='ok';document.querySelector('.cv-stones-wallet__refresh').click();});
  await page.waitForFunction(()=>document.querySelector('.cv-stones-wallet__refresh').disabled===false);
  check(await page.evaluate(()=>JSON.parse(store.animestars_transactions_cache).length)===2,'recount replaces history without duplicates');
  check(await page.locator('.earned-diamonds>span').textContent()==='+1\u00a0000','recount final total');
  check(await page.locator('.cv-stones-panel__value').textContent()==='200','non-pack recount result shown');
  check(await page.locator('.spent-diamonds>span').textContent()==='−200','non-pack expense remains in total exactly once');
  check(await page.evaluate(()=>requests.length)===3,'one pagination and one history request in recount');
  for(const mode of ['fail','empty','partial','partial-empty']){
   const before=await page.evaluate(()=>JSON.stringify(store));await page.evaluate(mode=>{window.mode=mode;document.querySelector('.cv-stones-wallet__refresh').click();},mode);
   await page.waitForFunction(()=>document.querySelector('.cv-stones-wallet__refresh').disabled===false,{},{timeout:20000});
   check(await page.evaluate(()=>JSON.stringify(store))===before,'failed/unknown recount preserves cache and timestamps '+mode);
   check(await page.locator('.earned-diamonds>span').textContent()==='+1\u00a0000','error restores saved totals '+mode);
   check(await page.locator('.cv-stones-panel__value').textContent()==='200','error restores saved non-pack subtotal '+mode);
  }
  await page.evaluate(html=>{window.historyFixture=html;window.mode='fixture';document.querySelector('.cv-stones-wallet__refresh').click();},historyHTML);
  await page.waitForFunction(()=>document.querySelector('.cv-stones-wallet__refresh').disabled===false);
  check(await page.evaluate(()=>JSON.parse(store.animestars_transactions_cache).length)===20,'new history passes complete recount and persists');
  check((await page.locator('.spent-diamonds>span').textContent()).replace(/\s/g,'')==='−32000','new history updates displayed spent total');
  check(await page.locator('.cv-stones-panel__value').textContent()==='0','pack-only history resets automatic subtotal');
  await page.click('.cv-stones-history-btn');
  await page.waitForFunction(()=>document.querySelector('.cv-stones-history__list')?.textContent.includes('нет трат'));
  check(await page.locator('.cv-stones-history__row').count()===0,'pack-only history shows empty state');
  check(await page.evaluate(()=>store.nonPackSpentStones)==='12500','recount does not overwrite old manual value');
  await page.evaluate(()=>cleanupStonesUi());
  check(await page.locator('.cv-stones-wallet,.cv-stones-panel,.cv-stones-progress,.cv-stones-history,#cv-stones-style').count()===0,'cleanup removes all module UI including open modal');
  check(await page.locator('.ps-wallet').evaluate(e=>e.outerHTML)===result.wallet,'native wallet intact after cleanup');
  await page.evaluate(()=>{window.mode='cached';initStones();});await page.waitForFunction(()=>document.querySelector('.cv-stones-wallet__refresh')?.disabled===false);
  check(await page.locator('.cv-stones-wallet').count()===1,'re-enable works');
  if(process.env.STONES_SCREENSHOTS){
   await page.waitForFunction(()=>document.querySelector('.cv-stones-progress').style.display==='none');
   fs.mkdirSync(path.join(__dirname,'..','output','stones-wallet'),{recursive:true});
   for(const width of [1366,390]){await page.setViewportSize({width,height:1100});await page.screenshot({path:path.join(__dirname,'..','output','stones-wallet',width+'.png'),fullPage:true});}
  }
  await page.close();
  const old=await setup(legacy);await old.waitForFunction(()=>document.querySelector('.cv-stones-floating-btn')?.disabled===false);
  check(await old.locator('.cv-stones-summary-row .ncard-shop__text-main').count()===1,'legacy layout still mounts');
  check(await old.locator('.cv-stones-floating-btn').count()===1,'legacy refresh retained');
  check(await old.locator('.cv-stones-panel__value').textContent()==='3\u00a0000','legacy automatic subtotal');
  check(await old.locator('.cv-stones-panel input,.cv-stones-panel button:not(.cv-stones-history-btn)').count()===0,'legacy manual controls also removed');
  // Legacy fixture deliberately stores 9999px coordinates and stubs dragging.
  // Place it on screen before exercising the new button with a real click.
  await old.locator('.cv-stones-panel').evaluate(el=>Object.assign(el.style,{left:'20px',top:'20px'}));
  await old.click('.cv-stones-history-btn');await old.waitForSelector('.cv-stones-history__row');
  check(await old.locator('.cv-stones-history__description').textContent()==='Подношение','history works in legacy layout too');
  await old.evaluate(()=>cleanupStonesUi());check(await old.locator('.ncard-shop__text > .ncard-shop__text-main').count()===1,'legacy caption restored');await old.close();
  const held=await setup(native,'hold');await held.waitForFunction(()=>!!window.release);
  check(await held.locator('.cv-stones-wallet__refresh').isDisabled(),'initial scan shares refresh lock');
  await held.evaluate(()=>{cleanupStonesUi();release();});await held.waitForTimeout(30);
  check(await held.locator('.cv-stones-wallet,.cv-stones-panel,.cv-stones-progress').count()===0,'cleanup during fetch does not resurrect UI');await held.close();
  const absent=await setup('<div>No shop wallet</div>');check(await absent.locator('.cv-stones-wallet,.cv-stones-panel').count()===0,'unrecognized page left intact');await absent.close();
  const disabled=await setup(native,'disabled');check(await disabled.locator('.cv-stones-wallet,#cv-stones-style').count()===0,'disabled module has no UI');check(await disabled.evaluate(()=>requests.length)===0,'disabled module does not fetch');await disabled.close();
  console.log(JSON.stringify({result:'STONES_WALLET_OK',passed}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
