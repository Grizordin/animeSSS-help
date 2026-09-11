// Offline UI integration of the real brick module and captured site styles/markup.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright');
const src=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(src);
function extract(name){
 const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(src),lines=src.slice(m.index).split(/\r?\n/);
 for(let n=1;n<=lines.length;n++){
  if(n>1&&lines[n-1]!==m[1]+'}')continue;
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }throw Error(name);
}
const fixture=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):`<div class="remelt cg-workbench"><section class="stone__inner"><div class="cg-filters"><div class="cg-filter-row"><div class="stone__rank-list"><button class="stone__rank-item stone__rank-item--active" data-rank="">Все</button><button class="stone__rank-item" data-rank="a">A</button></div></div><form class="cg-search"><input id="stone_search"><button>Найти</button></form></div><div class="stone__inventory"><div class="stone__inventory-list"></div></div></section></div>`;
const css=process.argv[3]?[...fs.readFileSync(process.argv[3],'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).filter(t=>t.includes('#celestialForge')).join('\n'):'';
let passed=0;const check=(v,m)=>{if(!v)throw Error(m);passed++;};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  async function setup(legacy=false,disabled=false){
   const page=await browser.newPage({viewport:{width:1440,height:1000}});
   await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body></body></html>'}));
   await page.goto('https://fixture.invalid/celestial_stone/');
   await page.evaluate(({fixture,css,legacy,disabled})=>{
    const doc=new DOMParser().parseFromString(fixture,'text/html');
    doc.querySelectorAll('script,style,link,iframe,img').forEach(n=>n.remove());
    doc.querySelectorAll('*').forEach(n=>[...n.attributes].filter(a=>/^on/i.test(a.name)).forEach(a=>n.removeAttribute(a.name)));
    document.body.innerHTML='<main id="celestialForge"></main>';
    document.body.className='dt-is-active';
    document.getElementById('celestialForge').append(...doc.body.childNodes);
    if(legacy)document.querySelector('.cg-filter-row').className='legacy-ranks';
    const style=document.createElement('style');style.textContent='*{box-sizing:border-box}body{margin:0;padding:20px;background:#111;color:#dbe5e3;font:14px Arial}button,input{font:inherit}#celestialForge{--cg-surface:#1d2224;--cg-soft:#242b2d;--cg-line:#343c3e;--cg-text:#dbe5e3;--cg-muted:#9eaeac;--cg-accent:#91c6ac;--cg-action:#dbe5e3;--cg-on-action:#25312e}'+css;document.head.append(style);
    window.originalNative=[...document.querySelector('.cg-filters').children].map(n=>({node:n,html:n.outerHTML}));
    window.originalCards=document.querySelector('.stone__inventory').innerHTML;
    const rankCfg={wantEnabled:true,wantLimit:45,ownersEnabled:false,ownersLimit:1500,dupEnabled:true,dupLimit:4};
    window.store={stone_brick_settings_v3:{'':rankCfg,a:{...rankCfg,wantLimit:7,dupLimit:8},excludeWishlist:true,targetEnergy:240},stone_brick_panel_pos:{left:99999,top:99999}};
    window.cfg={modBrickFill:!disabled};window.isPremiumLockedSetting=()=>false;
    window.gmStoreGet=(k,d)=>structuredClone(store[k]??d);window.gmStoreSet=(k,v)=>store[k]=structuredClone(v);window.gmStoreDelete=k=>delete store[k];
    window.suiteGetCurrentUserName=()=> 'Тестовый пользователь';window.appendCrown=()=>{};
    window.makeDraggable=()=>window.dragCalls++;window.dragCalls=0;
    window.suiteApplyCollapsibleState=(_p,_c,fn)=>fn();
    window.requests=0;window.fetch=()=>{requests++;throw Error('Unexpected network');};
    window.suiteTelemetryLog=()=>{};window.showToast=()=>{};
    window.warnCardStatsDemandRequired=()=>true;
   },{fixture,css,legacy,disabled});
   await page.evaluate('(()=>{'+extract('initBrickFill')+'\nwindow.initBrickFill=initBrickFill;initBrickFill();})()');
   return page;
  }
  const page=await setup();
  check(await page.locator('.cg-filter-row + #stone-brick-panel + .cg-search').count()===1,'under ranks before native search');
  check(await page.locator('.suite-brick-criteria > .suite-brick-criterion').count()===3,'first row has three criteria');
  const labels=await page.locator('.suite-brick-criteria label').allTextContents();check(labels[0].includes('Хотят')&&labels[1].includes('Владеют')&&labels[2].includes('Дубли'),'requested criterion order');
  check(await page.locator('.suite-brick-options > *').count()===3,'second row wishlist, target and actions');
  check(await page.evaluate(()=>originalNative.every(({node,html})=>node.outerHTML===html)),'native controls untouched');
  check(await page.evaluate(()=>document.querySelector('.stone__inventory').innerHTML===originalCards),'cards and counters untouched');
  check(await page.evaluate(()=>getComputedStyle(document.querySelector('#stone-brick-panel')).position)==='static','embedded not floating');
  check(await page.evaluate(()=>dragCalls)===0,'no dragging or saved coordinates applied');
  check(await page.getByRole('spinbutton',{name:'Хотят получить — порог'}).inputValue()==='45','saved wants');
  check(await page.getByRole('spinbutton',{name:'Владеют — порог'}).inputValue()==='1500','saved owners');
  check(await page.getByRole('spinbutton',{name:'Дубли на руках — порог'}).inputValue()==='4','saved duplicates');
  check(await page.getByRole('spinbutton',{name:'Цель энергии',exact:true}).inputValue()==='240','saved energy');
  await page.getByRole('checkbox',{name:'Владеют'}).check();check(await page.getByRole('spinbutton',{name:'Владеют — порог'}).isEnabled(),'criterion toggle enables numeric field');
  await page.getByRole('spinbutton',{name:'Владеют — порог'}).fill('1600');await page.getByRole('spinbutton',{name:'Владеют — порог'}).press('Tab');
  check(await page.evaluate(()=>store.stone_brick_settings_v3[''].ownersLimit)===1600,'owners change saved');
  await page.getByRole('spinbutton',{name:'Цель энергии',exact:true}).fill('360');await page.getByRole('spinbutton',{name:'Цель энергии',exact:true}).press('Tab');
  check(await page.evaluate(()=>store.stone_brick_settings_v3.targetEnergy)===360,'energy change saved');
  await page.getByRole('checkbox',{name:'Исключать желаемое'}).uncheck();check(await page.evaluate(()=>store.stone_brick_settings_v3.excludeWishlist)===false,'wishlist toggle saved');
  // Simulate the site's rank activation handler, then let the real module process its click.
  await page.evaluate(()=>document.querySelector('[data-rank="a"]').addEventListener('click',e=>{document.querySelector('.stone__rank-item--active').classList.remove('stone__rank-item--active');e.currentTarget.classList.add('stone__rank-item--active');}));
  await page.locator('.stone__rank-item[data-rank=a]').click();await page.waitForFunction(()=>document.getElementById('suite-brick-rank').textContent==='Ранг: A');
  check(await page.getByRole('spinbutton',{name:'Хотят получить — порог'}).inputValue()==='7','switch rank loads its own settings');
  check(await page.getByRole('spinbutton',{name:'Дубли на руках — порог'}).inputValue()==='8','rank duplicate settings');
  check(await page.evaluate(()=>store.stone_brick_settings_v3[''].ownersLimit)===1600,'other rank settings preserved');
  await page.getByRole('button',{name:'Свернуть настройки наполнения кирпича',exact:true}).click();check(await page.locator('#stone-brick-body').isVisible()===false,'collapse');
  await page.getByRole('button',{name:'Развернуть настройки наполнения кирпича',exact:true}).click();check(await page.locator('#stone-brick-body').isVisible(),'expand');
  await page.evaluate(()=>initBrickFill());check(await page.locator('#stone-brick-panel').count()===1,'idempotent init');
  for(const width of [1440,1100,900,710,390,320]){
   await page.setViewportSize({width,height:1100});
   const g=await page.evaluate(()=>{
    const p=document.getElementById('stone-brick-panel'),b=p.getBoundingClientRect();
    return {fit:p.scrollWidth<=p.clientWidth+1,controls:[...p.querySelectorAll('input,button')].every(n=>{const r=n.getBoundingClientRect();return r.x>=b.x-1&&r.right<=b.right+1;}),
     columns:getComputedStyle(p.querySelector('.suite-brick-criteria')).gridTemplateColumns.split(' ').length};
   });
   check(g.fit,'panel no overflow '+width);check(g.controls,'controls stay inside '+width);check(g.columns===(width>700?3:1),'responsive row '+width);
  }
  check(await page.evaluate(()=>requests)===0,'UI never requests or exchanges cards');
  await page.evaluate(()=>window.originalInput=document.querySelector('.suite-brick-criteria input[type=number]'));
  await page.getByRole('spinbutton',{name:'Хотят получить — порог'}).fill('19');
  await page.waitForTimeout(1100);check(await page.evaluate(()=>document.querySelector('.suite-brick-criteria input[type=number]')===originalInput),'timer never rebuilds input');
  check(await page.getByRole('spinbutton',{name:'Хотят получить — порог'}).inputValue()==='19','timer preserves unsaved input');
  if(css)for(const theme of ['','dt-is-active']){
   await page.evaluate(theme=>document.body.className=theme,theme);
   check(await page.evaluate(()=>getComputedStyle(document.querySelector('.suite-brick-criterion')).backgroundColor===getComputedStyle(document.getElementById('stone_search')).backgroundColor),'follows native theme '+(theme||'light'));
  }
  if(process.env.BRICK_SCREENSHOTS){
   fs.mkdirSync(path.join(__dirname,'..','output','brick-embedded'),{recursive:true});
   await page.evaluate(()=>document.querySelectorAll('.cg-filters button').forEach(b=>b.disabled=false));
   for(const width of [1440,390]){await page.setViewportSize({width,height:1100});await page.locator('.stone__inner').screenshot({path:path.join(__dirname,'..','output','brick-embedded',width+'.png')});}
  }
  await page.evaluate(()=>window.__suiteBrickFillCleanup());check(await page.locator('#stone-brick-panel,#suite-brick-embedded-style').count()===0,'cleanup removes only helper UI/styles');
  check(await page.locator('.cg-search').count()===1&&await page.locator('.stone__inventory').count()===1,'native search and inventory survive cleanup');
  await page.evaluate(()=>initBrickFill());check(await page.locator('.suite-brick-embedded').count()===1,'enable again');await page.close();
  const old=await setup(true);check(await old.evaluate(()=>getComputedStyle(document.getElementById('stone-brick-panel')).position)==='fixed','legacy fallback retained');check(await old.evaluate(()=>dragCalls)===1,'legacy draggable');await old.close();
  const off=await setup(false,true);check(await off.locator('#stone-brick-panel').count()===0,'disabled module not mounted');await off.close();
  console.log(JSON.stringify({result:'BRICK_EMBEDDED_OK',passed,nativeCSS:!!css}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
