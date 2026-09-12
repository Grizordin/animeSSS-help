// Offline native-layout and page-reset regression tests. All exchanges are mocked.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright');
const src=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');new vm.Script(src);
function extract(name){
 const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(src),lines=src.slice(m.index).split(/\r?\n/);
 for(let n=1;n<=lines.length;n++){if(n>1&&lines[n-1]!==m[1]+'}')continue;const s=lines.slice(0,n).join('\n');try{new vm.Script('('+s+')');return s;}catch{}}throw Error(name);
}
const html=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):`<section class="rf-inventory-panel"><div class="rf-filters"><div class="rf-filter-row"><div class="remelt__rank-list"><button type="button" class="remelt__rank-item remelt__rank-item--active" data-rank="e">E</button><button type="button" class="remelt__rank-item" data-rank="b">B</button></div><div class="rf-sort"><select><option value="date">Date</option></select></div></div><div class="card-filter-form__controls"><input id="remelt_search"><button class="remelt__search-btn">Найти</button></div></div><div class="remelt__inventory"><div class="remelt__inventory-list"></div></div><div id="info_filter_page"><span>3 / 3</span></div><select id="choose_filter_page"><option>1</option><option>2</option><option selected>3</option></select></section>`;
const css=process.argv[3]?[...fs.readFileSync(process.argv[3],'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).filter(s=>s.includes('#remeltForge')).join('\n'):'';
let passed=0;const check=(v,m)=>{if(!v)throw Error(m);passed++;};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  async function setup(mode='ui'){
   const page=await browser.newPage({viewport:{width:1200,height:900}});
   page.on('pageerror',e=>console.error('Browser error:',e.message));
   await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));await page.goto('https://fixture.invalid/cards_remelt/');
   await page.evaluate(({html,css,mode})=>{
    const doc=new DOMParser().parseFromString(html,'text/html');doc.querySelectorAll('script,iframe,link,img').forEach(n=>n.remove());
    doc.querySelectorAll('*').forEach(n=>[...n.attributes].filter(a=>/^on/i.test(a.name)).forEach(a=>n.removeAttribute(a.name)));
    document.body.innerHTML='<main id="remeltForge"></main>';document.body.className='dt-is-active';document.getElementById('remeltForge').append(...doc.body.childNodes);
    if(mode==='legacy')document.querySelector('.rf-filter-row').className='old-filter';
    const style=document.createElement('style');style.textContent='*{box-sizing:border-box}body{margin:0;padding:20px;background:#171412;color:#eee5dd;font:14px Arial}#remeltForge{--rf-surface:#24201d;--rf-soft:#2b2622;--rf-line:#443c36;--rf-muted:#b5a596;--rf-text:#eee5dd;--rf-action:#dfbfa6;--rf-rank-ui:#86583d;--rf-accent:#dba777}'+css;document.head.append(style);
    window.nativeNodes=[...document.querySelector('.rf-filters').children].map(n=>[n,n.outerHTML]);window.originalCards=document.querySelector('.remelt__inventory').innerHTML;
    const limits={wantEnabled:true,wantLimit:50,ownersEnabled:false,ownersLimit:1000,dupEnabled:false,dupLimit:4};
    window.store={suite_remelt_settings_v1:{e:{...limits},b:{...limits,wantLimit:6},targetCount:2,excludeWishlist:mode==='ui'},suite_remelt_panel_pos_v1:{left:99999,top:99999}};
    window.cfg={modRemelt:mode!=='off'};window.isPremiumLockedSetting=()=>false;window.appendCrown=()=>{};window.dragCalls=0;window.makeDraggable=()=>dragCalls++;
    window.gmStoreGet=(k,d)=>structuredClone(store[k]??d);window.gmStoreSet=(k,v)=>store[k]=structuredClone(v);window.gmStoreDelete=k=>delete store[k];
    window.suiteApplyCollapsibleState=(_p,_c,fn)=>fn();window.suiteGetCurrentUserName=()=> 'Test';window.notices=[];window.showToast=t=>notices.push(t);
    window.issues=[];window.events=[];window.suiteSelfDiagnosticIssue=(...args)=>issues.push(args);window.suiteTelemetryLog=(...args)=>events.push(args);window.warnCardStatsDemandRequired=()=>false;
    window.network=0;window.fetch=()=>{network++;throw Error('Unexpected fetch');};
    const realTimeout=window.setTimeout.bind(window);window.realTimeout=realTimeout;
    window.setTimeout=(fn,ms,...args)=>realTimeout(fn,ms>=8000?650:ms===500?20:ms,...args);
    const bus=new Map();window.jQuery=()=>({on(name,fn){bus.set(name,fn);return this;},off(ns){for(const n of bus.keys())if(n.endsWith(ns))bus.delete(n);return this;}});
    window.emit=(name,...args)=>{for(const [n,fn] of [...bus])if(n.startsWith(name+'.'))fn({},...args);};
    window.navigations=[];window.exchanges=0;window.picks=[];window.mode=mode;window.last=3;window.selected=[];window.spent=new Set();
    window.cardHtml=(id,rank='e')=>'<div class="remelt__inventory-item" data-id="'+id+'" data-rank="'+rank+'" data-image="'+id+'.webp" style="display:block;width:50px;height:45px"><div class="card-stats"><span title="Владельцев" data-rf-count="2000"></span><span title="Хотят получить" data-rf-count="1"></span><span title="Дубли на руках" data-rf-count="8"></span></div></div>';
    window.renderPage=(p,{same=false}={})=>{
     document.querySelector('#info_filter_page').innerHTML='<span>'+p+' / '+last+'</span>';
     const select=document.getElementById('choose_filter_page');select.innerHTML=Array.from({length:last},(_,i)=>'<option value="'+(i+1)+'"'+(i+1===p?' selected':'')+'>'+(i+1)+'</option>').join('');
     const list=document.querySelector('.remelt__inventory-list');
     if(!same)list.innerHTML=Array.from({length:6},(_,i)=>String(p*10+i+1)).filter(id=>!spent.has(id)).map(id=>cardHtml(id)).join('');
     list.querySelectorAll('.remelt__inventory-item').forEach(c=>c.onclick=()=>{
      if(selected.includes(c.dataset.id))return;picks.push({page:Number(document.querySelector('#info_filter_page span').textContent.split('/')[0]),id:c.dataset.id});selected.push(c.dataset.id);c.style.display='none';
      const slot=[...document.querySelectorAll('.remelt__wrapper .remelt__item')].find(s=>!s.querySelector('img'));if(slot)slot.innerHTML='<img data-id="'+c.dataset.id+'">';
      if(selected.length===3)document.querySelector('.remelt__start-btn').style.display='block';
      if(mode==='mid-jump'&&picks.length===1)renderPage(1);
     });
    };
    if(!['ui','legacy','off'].includes(mode)){
     document.getElementById('remeltForge').insertAdjacentHTML('afterbegin','<input id="autoRemeltToggle" type="checkbox"><div class="remelt__wrapper">'+Array.from({length:3},()=>'<div class="remelt__item" style="width:50px;height:45px"></div>').join('')+'</div><button class="remelt__start-btn" style="display:none">Перековка</button>');
     renderPage(3);
     document.getElementById('choose_filter_page').addEventListener('change',()=>{
      const requested=Number(document.getElementById('choose_filter_page').value);navigations.push(requested);
      if(mode==='restore-fails')return;
      if(mode==='fake-page'){renderPage(requested,{same:true});return;}
      if(mode==='sync'){renderPage(requested);return;}
      realTimeout(()=>renderPage(mode==='wrong-page'?1:requested),30);
     });
     document.querySelector('.remelt__start-btn').onclick=()=>{
      exchanges++;const ids=[...selected],button=document.querySelector('.remelt__start-btn');button.disabled=true;
      const data=new URLSearchParams({action:'remelt_card'});ids.forEach(id=>data.append('card_ids[]',id));const xhr={status:200,responseJSON:{card:{image:'/mock.webp',name:'Mock'}}};
      emit('ajaxSend',xhr,{url:location.origin+'/index.php?controller=ajax&mod=cards_ajax',data:data.toString()});
      realTimeout(()=>{
       ids.forEach(id=>spent.add(id));selected=[];document.querySelectorAll('.remelt__wrapper img').forEach(n=>n.remove());button.disabled=false;button.style.display='none';
       const previous=Number(document.querySelector('#info_filter_page span').textContent.split('/')[0]);
       if(mode==='shrink')last=2;
       if(mode==='one-page')last=1;
       renderPage(exchanges===1&&mode!=='normal'?1:previous);
       if(mode==='manual-filter')document.getElementById('remelt_search').value='Changed';
       if(mode==='manual-page'){const select=document.getElementById('choose_filter_page');select.value='2';select.dispatchEvent(new Event('change',{bubbles:true}));}
       emit('ajaxComplete',xhr);
      },35);
     };
    }
   },{html,css,mode});
   await page.evaluate('(()=>{'+['suiteReadInventoryCount','suiteInventoryStats','suiteCardActionButtonReady','suiteConfirmCardAction','initRemelt'].map(extract).join('\n')+'\nwindow.initRemelt=initRemelt;initRemelt();})()');return page;
  }
  const ui=await setup();
  check(await ui.evaluate(()=>document.getElementById('remelt-panel').getBoundingClientRect().top-document.querySelector('.rf-filter-row').getBoundingClientRect().bottom>=11),'visible gap below rank row');
  check(await ui.locator('#remelt-panel-body > .suite-remelt-rank-notice').textContent()==='ВНИМАНИЕ: настройки для каждого ранга свои.','rank warning at bottom');
  check(await ui.evaluate(()=>{const s=getComputedStyle(document.getElementById('remelt-panel'));return s.borderLeftWidth==='3px'&&s.backgroundImage.includes('linear-gradient');}),'subtle accent matches auto pack style');
  check(await ui.locator('.rf-filter-row + #remelt-panel + .card-filter-form__controls').count()===1,'panel below ranks, above search');
  check(await ui.evaluate(()=>nativeNodes.every(([n,html])=>n.outerHTML===html)),'native filters preserved');check(await ui.evaluate(()=>document.querySelector('.remelt__inventory').innerHTML===originalCards),'native cards preserved');
  check(await ui.evaluate(()=>dragCalls)===0,'no dragging');check(await ui.evaluate(()=>getComputedStyle(document.getElementById('remelt-panel')).position)==='static','not floating');
  const labels=await ui.locator('.suite-remelt-criteria label').allTextContents();check(labels.length===3&&labels[0].includes('Хотят')&&labels[1].includes('Владеют')&&labels[2].includes('Дубли'),'criterion row order');
  check(await ui.locator('.suite-remelt-options > *').count()===3,'wishlist, target, start on second row');
  await ui.getByRole('checkbox',{name:'Владеют'}).check();await ui.getByRole('spinbutton',{name:'Владеют — порог'}).fill('1700');await ui.getByRole('spinbutton',{name:'Владеют — порог'}).press('Tab');check(await ui.evaluate(()=>store.suite_remelt_settings_v1.e.ownersLimit)===1700,'rank setting persists');
  await ui.getByRole('spinbutton',{name:'Количество переплавок',exact:true}).fill('9');await ui.getByRole('spinbutton',{name:'Количество переплавок',exact:true}).press('Tab');check(await ui.evaluate(()=>store.suite_remelt_settings_v1.targetCount)===9,'target persists');
  await ui.getByRole('checkbox',{name:'Исключать желаемое'}).uncheck();check(await ui.evaluate(()=>store.suite_remelt_settings_v1.excludeWishlist)===false,'wishlist persists');
  await ui.evaluate(()=>document.querySelector('[data-rank="b"]').addEventListener('click',e=>{document.querySelector('.remelt__rank-item--active').classList.remove('remelt__rank-item--active');e.currentTarget.classList.add('remelt__rank-item--active');document.querySelector('.remelt__inventory-list').innerHTML='<div>Updated B inventory</div>';}));
  await ui.locator('.remelt__rank-item[data-rank=b]').click();await ui.waitForFunction(()=>document.getElementById('suite-remelt-rank').textContent.includes('B'),undefined,{timeout:4000}).catch(async e=>{console.error(await ui.evaluate(()=>({rank:document.querySelector('.remelt__rank-item--active')?.outerHTML,caption:document.getElementById('suite-remelt-rank').textContent,notices})));throw e;});
  check(await ui.getByRole('spinbutton',{name:'Хотят получить — порог'}).inputValue()==='6','rank-specific value loads');check((await ui.locator('#suite-remelt-rank').textContent()).includes('переплавку: 6'),'B needs six cards');
  await ui.getByRole('button',{name:'Свернуть настройки переплавки',exact:true}).click();check(!await ui.locator('#remelt-panel-body').isVisible(),'collapse');await ui.getByRole('button',{name:'Развернуть настройки переплавки',exact:true}).click();check(await ui.locator('#remelt-panel-body').isVisible(),'expand');
  for(const width of [1200,800,390,320]){
   await ui.setViewportSize({width,height:1000});const g=await ui.evaluate(()=>{const p=document.getElementById('remelt-panel'),r=p.getBoundingClientRect();return {fit:p.scrollWidth<=p.clientWidth+1,controls:[...p.querySelectorAll('input,button')].every(n=>n.getBoundingClientRect().right<=r.right+1&&n.getBoundingClientRect().x>=r.x-1)};});check(g.fit&&g.controls,'responsive '+width);
  }
  if(css)for(const theme of ['','dt-is-active']){await ui.evaluate(t=>document.body.className=t,theme);check(await ui.evaluate(()=>getComputedStyle(document.querySelector('.suite-remelt-criterion')).backgroundColor===getComputedStyle(document.getElementById('remelt_search')).backgroundColor),'native theme '+theme);}
  check(await ui.evaluate(()=>network)===0,'UI sends no requests');await ui.evaluate(()=>initRemelt());check(await ui.locator('#remelt-panel').count()===1,'idempotent init');
  if(process.env.REMELT_SCREENSHOTS){fs.mkdirSync(path.join(__dirname,'..','output','remelt-embedded'),{recursive:true});for(const width of [1200,390]){await ui.setViewportSize({width,height:1000});await ui.locator('.rf-inventory-panel').screenshot({path:path.join(__dirname,'..','output','remelt-embedded',width+'.png')});}}
  await ui.evaluate(()=>window.__suiteRemeltCleanup());check(await ui.locator('#remelt-panel,#suite-remelt-embedded-style').count()===0,'cleanup');check(await ui.locator('.rf-filter-row').count()===1,'native filters stay after cleanup');await ui.close();
  for(const mode of ['reset','shrink','normal','sync','one-page','restore-fails','wrong-page','fake-page','mid-jump','manual-filter','manual-page']){
   const p=await setup(mode);await p.locator('#remelt-main-btn').click();await p.waitForFunction(()=>document.getElementById('remelt-main-btn').disabled===false,undefined,{timeout:20000});
   const r=await p.evaluate(()=>({exchanges,picks,navigations,notices,events,issues,network,page:document.querySelector('#info_filter_page').textContent}));
   if(['reset','shrink','normal','sync','one-page'].includes(mode)){
    check(r.exchanges===2,mode+' completes both exchanges');check(mode==='one-page'?r.picks.slice(3).every(x=>x.page===1):!r.picks.some(x=>x.page===1),mode+' never selects wrong page');
    check(r.navigations.length===(['normal','one-page'].includes(mode)?0:1),mode+' no repeated navigation');
    if(!['normal','one-page'].includes(mode))check(r.navigations[0]===(mode==='shrink'?2:3),mode+' returns to correct/clamped page');
    check(r.notices.some(n=>n.includes('Готово: 2/2')),mode+' completed total');
   }else{
    check(r.exchanges===(mode==='mid-jump'?0:1),mode+' stops before further exchange');check(!r.picks.some(x=>x.page===1),mode+' does not use first-page cards');
    check(r.navigations.length<=1,mode+' retry bounded');
    if(['restore-fails','wrong-page','fake-page'].includes(mode))check(r.issues.some(x=>x[1]==='remelt_page_restore_failed'),mode+' diagnostic recorded');
   }
   check(r.network===0,mode+' no real network');await p.close();
  }
  for(const mode of ['legacy','off']){const p=await setup(mode);check(mode==='off'?await p.locator('#remelt-panel').count()===0:await p.evaluate(()=>dragCalls)===1,mode+' preserved');await p.close();}
  console.log(JSON.stringify({result:'REMELT_EMBEDDED_OK',passed,nativeCSS:!!css}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
