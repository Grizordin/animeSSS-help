// Offline browser checks of the real module; no account or site requests.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
function extract(name){
 const m=new RegExp('^([ \\t]*)function '+name+'\\(','m').exec(source),lines=source.slice(m.index).split(/\r?\n/);
 for(let n=2;n<=lines.length;n++)if(lines[n-1]===m[1]+'}'){
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }
 throw Error(name);
}
const native=`<section class="ps-wallet" aria-label="Ваш баланс"><div class="ps-wallet-main"><span class="ps-wallet-icon"><i class="fal fa-gem" aria-hidden="true"></i></span><div><div class="ps-label">Ваши камни духа</div><div class="ncard-shop__text-caption"><span data-ps-balance="">167002</span><i class="diamond" aria-hidden="true"></i></div></div></div><div class="ps-wallet-actions"><a class="ps-button ps-button--primary ncard-shop__btn-donate" href="/donate/">Пополнить</a><a class="ps-button" href="/transactions/">История операций</a></div></section><div id="collection">Ваша коллекция</div>`;
const legacy='<div class="ncard-shop__text lootbox__descr d-flex fd-column r-gap-20"><div class="ncard-shop__text-main lootbox__descr-section ta-center"><span>167002</span><i class="diamond"></i></div><a href="/donate/">Пополнить</a></div>';
const baseCSS='*{box-sizing:border-box}body{margin:0;padding:24px;background:#111;color:#e5eeee;font:14px Arial}.ps-wallet{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:26px;background:#1b2325;border:1px solid #344647;border-radius:18px}.ps-wallet-main,.ps-wallet-actions{display:flex;align-items:center;gap:12px}.ps-wallet-icon{background:#253f39;width:54px;height:54px;border-radius:14px}.ps-label{color:#a6b9bc;font-size:13px;margin-bottom:8px}.ncard-shop__text-caption{font-size:32px;font-weight:bold}.ps-button{padding:14px;border:1px solid #344647;border-radius:10px;color:inherit;text-decoration:none}.ps-button--primary{background:#2d7564}.diamond{display:inline-block;width:16px;height:16px;background:#65b9a1;clip-path:polygon(25% 0,75% 0,100% 35%,50% 100%,0 35%)}@media(max-width:600px){body{padding:12px}.ps-wallet{flex-direction:column;align-items:flex-start;padding:18px}.ps-wallet-actions{flex-wrap:wrap}}';
const cache=[{amount:1000000,date:Date.now()-10000,description:'Reward'},{amount:-83000,date:Date.now()-20000,description:'Packs'}];
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
     return {ok:true,text:async()=>window.mode==='empty'?'<form>Login</form>':'<div class="table-responsive ncard-transactions__table"><table><tbody><tr class="new-tr-item"><td class="new-tr-amount"><span>+1000</span></td><td class="new-tr-date">11.09.2026 10:00:00</td><td>Reward</td></tr><tr class="new-tr-item"><td class="new-tr-amount"><span>-200</span></td><td class="new-tr-date">11.09.2026 09:00:00</td><td>Packs</td></tr></tbody></table></div>'};
    };
   },{cache,mode});
   await page.evaluate('(()=>{'+extract('initStones')+'\n'+extract('cleanupStonesUi')+'\nwindow.initStones=initStones;window.cleanupStonesUi=cleanupStonesUi;initStones();})()');
   return page;
  }
  const page=await setup();
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
  check(result.cards===3,'three cards');check(result.earned==='+1000000','cached earned');check(result.spent==='−83000','cached spent');check(result.extra==='12500','manual total preserved');
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
  await page.locator('.cv-stones-input').fill('250');await page.getByRole('button',{name:'Добавить расходы не на паки'}).click();
  await page.waitForFunction(()=>store.nonPackSpentStones==='12750');check(true,'manual add stored');
  await page.locator('.cv-stones-input').fill('10');await page.locator('.cv-stones-input').press('Enter');await page.waitForFunction(()=>store.nonPackSpentStones==='12760');check(true,'Enter adds');
  for(const invalid of ['1.5','-999999','9007199254740992']){
   await page.locator('.cv-stones-input').fill(invalid);await page.getByRole('button',{name:'Добавить расходы не на паки'}).click();
   check(await page.evaluate(()=>store.nonPackSpentStones)==='12760','invalid adjustment rejected '+invalid);
  }
  await page.evaluate(()=>{document.querySelector('.cv-stones-input').value='1';const b=document.querySelector('.cv-stones-input').nextElementSibling;b.click();b.click();});
  await page.waitForFunction(()=>store.nonPackSpentStones==='12761');check(true,'double click counted once');
  await page.getByRole('button',{name:'Обнулить расходы не на паки'}).click();await page.waitForFunction(()=>store.nonPackSpentStones==='0');
  check(await page.evaluate(()=>store.animestars_transactions_cache)===JSON.stringify(cache),'manual reset leaves transaction cache');
  await page.evaluate(()=>{window.mode='ok';document.querySelector('.cv-stones-wallet__refresh').click();});
  await page.waitForFunction(()=>document.querySelector('.cv-stones-wallet__refresh').disabled===false);
  check(await page.evaluate(()=>JSON.parse(store.animestars_transactions_cache).length)===2,'recount replaces history without duplicates');
  check(await page.locator('.earned-diamonds>span').textContent()==='+1\u00a0000','recount final total');
  check(await page.evaluate(()=>requests.length)===3,'one pagination and one history request in recount');
  for(const mode of ['fail','empty','partial','partial-empty']){
   const before=await page.evaluate(()=>JSON.stringify(store));await page.evaluate(mode=>{window.mode=mode;document.querySelector('.cv-stones-wallet__refresh').click();},mode);
   await page.waitForFunction(()=>document.querySelector('.cv-stones-wallet__refresh').disabled===false,{},{timeout:20000});
   check(await page.evaluate(()=>JSON.stringify(store))===before,'failed/unknown recount preserves cache and timestamps '+mode);
   check(await page.locator('.earned-diamonds>span').textContent()==='+1\u00a0000','error restores saved totals '+mode);
  }
  await page.evaluate(()=>cleanupStonesUi());
  check(await page.locator('.cv-stones-wallet,.cv-stones-panel,.cv-stones-progress,#cv-stones-style').count()===0,'cleanup removes all module UI');
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
  check(await old.locator('.cv-stones-panel__value').textContent()==='12\u00a0500','legacy extra retained');
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
