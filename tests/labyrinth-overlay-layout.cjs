// Supplied markup is sanitized and rendered locally; every network request is blocked.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');new vm.Script(source);
function extract(name){
 const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(source);if(!m)throw Error(name);
 const lines=source.slice(m.index).split(/\r?\n/);
 for(let n=2;n<=lines.length;n++)if(lines[n-1]===m[1]+'}'){
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }throw Error(name);
}
const css=source.slice(source.indexOf('    #suite-emission-timer {'),source.indexOf('    #suite-lab-fatigue-modal {'))+
 '#suite-lab-fatigue-counter{max-width:calc(100% - 24px)}@media(max-width:760px){#suite-lab-fatigue-counter{width:min(180px,calc(100% - 24px));min-width:0}}';
const fixture=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):require('./fixtures/release-ui.cjs').labyrinth;
fs.mkdirSync(path.join(__dirname,'..','tmp'),{recursive:true});
const functions=['suiteLabyrinthFatigueLimit','suiteAttachLabyrinthOverlay','suitePositionLabyrinthFatigueCounter','attachBox','renderBox','initLabyrinthEmission','cleanupLabyrinthEmission'].map(extract).join('\n');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();await page.route('**/*',r=>r.abort());
  await page.goto('about:blank');
  await page.evaluate(({fixture,css,functions})=>{
   const t=document.createElement('template');t.innerHTML=fixture;
   for(const el of t.content.querySelectorAll('*'))for(const a of [...el.attributes])if(/^on/i.test(a.name)||['src','srcset','style'].includes(a.name))el.removeAttribute(a.name);
   t.content.querySelectorAll('script,iframe,link,style,object,embed,#suite-emission-timer,#suite-lab-fatigue-counter').forEach(el=>el.remove());document.body.append(t.content);
   const style=document.createElement('style');style.textContent=`body{margin:12px;background:#171925;color:#e2e8f0;font:14px Arial}.labyrinth__arena{position:relative;max-width:1000px;border:1px solid #394152;border-radius:16px;overflow:hidden;margin:auto}#lm-arena-bar{height:40px;display:flex;justify-content:space-between;background:#182131}.lm-ab-right{display:flex;gap:10px}.v2-mapbar{height:74px;display:flex;align-items:center;justify-content:space-between;background:#10182c;padding:0 12px;box-sizing:border-box}.v2-mapbar small{display:block}.labyrinth-map-viewport{position:relative;height:500px;overflow:hidden;background:linear-gradient(#402637,#162635)}.labyrinth-map{position:absolute;top:260px;left:50%;display:flex;transform:translate(-50%,-50%);gap:6px}.labyrinth-cell{display:none}.labyrinth-cell:nth-child(-n+5){display:block;width:38px;height:38px;border:1px solid #c9b273;border-radius:8px;background:#695c36}.labyrinth-emission__banner{position:absolute;top:18px;left:18px;padding:12px;background:#51120c;border:1px solid #b94c25;border-radius:12px;width:180px;box-sizing:border-box}.labyrinth-emission__label{color:#ff7f52;font-weight:bold;margin-bottom:8px}.labyrinth-emission:not(.is-active){display:none}.lr-map-key{position:absolute;bottom:12px;left:12px}.lr-map-key span{margin-right:12px}.lr-map-compass,.labyrinth-emission__cloud-image,.labyrinth-emission__lightning{display:none}`+css;document.head.append(style);
   window.cfg={modLabyrinthEmission:true};window.runtime={box:null,state:{value:3},cacheExact:true};window.ROOT_ID='suite-lab-fatigue-counter';
   window.modalOpened=0;window.showModal=()=>modalOpened++;
   window.suiteLabyrinthFatigueNumber=v=>Number(v);window.unsafeWindow=window;
   window.labyrinthData={emission:{active:true,active_until:Math.floor(Date.now()/1000)+180}};
   // The production emission initializer is route-guarded; only that guard is adapted for about:blank.
   (0,eval)(functions.replace("if(!/\\/labyrinth\\//.test(location.pathname)){","if(false){"));
   initLabyrinthEmission();attachBox();renderBox();
  },{fixture,css,functions});
  await page.waitForTimeout(800);
  const idleMutations=await page.evaluate(()=>{
   const observer=new MutationObserver(()=>{});
   observer.observe(document.querySelector('.labyrinth__arena'),{subtree:true,childList:true,attributes:true,characterData:true});
   for(let i=0;i<100;i++){attachBox();renderBox();suitePositionLabyrinthFatigueCounter();}
   const count=observer.takeRecords().length;observer.disconnect();return count;
  });
  ok(idleMutations===0,'unchanged fatigue/overlay causes zero DOM mutations, got '+idleMutations);
  for(const width of [1280,800,600,390,320]){
   await page.setViewportSize({width,height:900});
   const result=await page.evaluate(()=>{
    suitePositionLabyrinthFatigueCounter();
    const f=document.getElementById(ROOT_ID),e=document.getElementById('suite-emission-timer'),v=document.getElementById('labyrinthMapViewport');
    const r=x=>{const b=x.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};};
    const a=r(f),b=r(e),c=r(v),bar=r(document.querySelector('.v2-mapbar')),banner=r(document.querySelector('.labyrinth-emission__banner'));
    const overlap=(x,y)=>x.left<y.right&&x.right>y.left&&x.top<y.bottom&&x.bottom>y.top;
    const layer=document.getElementById('suite-labyrinth-overlays');
    return {mounted:f.parentElement===layer&&e.parentElement===layer&&layer.parentElement===v.parentElement,below:a.top>=bar.bottom+11&&b.top>=bar.bottom+11,inside:[a,b].every(x=>x.left>=c.left&&x.right<=c.right),panels:!overlap(a,b),banner:!overlap(a,banner)&&!overlap(b,banner),value:f.querySelector('[data-lab-fatigue="percent"]').textContent,timer:e.querySelector('.suite-emission-value').textContent};
   });
   for(const field of ['mounted','below','inside','panels','banner'])ok(result[field],field+' at '+width);
   ok(result.value==='30%','fatigue value unchanged '+width);ok(/^\d{2}:\d{2}$/.test(result.timer),'timer ticks '+width);
  }
  const stable=await page.evaluate(()=>{
   const f=document.getElementById(ROOT_ID),v=document.getElementById('labyrinthMapViewport');let bubbled=0;
   v.addEventListener('pointerdown',()=>bubbled++);
   f.querySelector('button').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));f.querySelector('button').click();
   const before=f.getBoundingClientRect().top;document.getElementById('labyrinthMap').style.transform='translate(80px,40px) scale(2)';
   return {bubbled,opened:modalOpened,stable:before===f.getBoundingClientRect().top};
  });
  ok(stable.bubbled===0,'details button does not initiate map panning');ok(stable.opened===1,'details button still works');ok(stable.stable,'map zoom does not move panels');
  await page.setViewportSize({width:1280,height:900});
  const regression=await page.evaluate(()=>{
   const arena=document.querySelector('.labyrinth__arena'),viewport=document.getElementById('labyrinthMapViewport'),bar=document.querySelector('.v2-mapbar');
   document.querySelector('.labyrinth-emission').classList.remove('is-active');
   const f=document.getElementById(ROOT_ID),e=document.getElementById('suite-emission-timer');
   const anchored=()=>{
    suitePositionLabyrinthFatigueCounter();
    const a=arena.getBoundingClientRect(),b=bar.getBoundingClientRect(),r=e.getBoundingClientRect(),s=f.getBoundingClientRect();
    return Math.abs(r.top-b.bottom-12)<1&&Math.abs(a.right-arena.clientLeft-r.right-12)<1&&Math.abs(s.top-r.top)<1&&s.right+11<=r.left;
   };
   const base=anchored();
   // Model map-centering CSS and pan/zoom applied to the viewport, not just its map child.
   const conflicting=document.createElement('style');conflicting.textContent='.labyrinth-map-viewport > div{left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important}';document.head.append(conflicting);
   viewport.style.transform='translate(85px,70px) scale(.7)';
   const transformed=anchored();
   // Repair positional styles retained from a previous parent or another script.
   for(const box of [f,e]){box.style.left='50%';box.style.transform='translate(-50%,-50%)';}
   const stale=anchored();
   conflicting.remove();viewport.style.transform='';bar.style.height='120px';const resized=anchored();bar.style.height='';
   bar.style.display='none';suitePositionLabyrinthFatigueCounter();
   const folded=Math.abs(e.getBoundingClientRect().top-document.getElementById('lm-arena-bar').getBoundingClientRect().bottom-12)<1;
   bar.style.display='';const unfolded=anchored();
   const background=document.elementFromPoint(arena.getBoundingClientRect().left+30,bar.getBoundingClientRect().bottom+150);
   return {base,transformed,stale,resized,folded,unfolded,clickThrough:background?.id!=='suite-labyrinth-overlays'};
  });
  for(const [name,value] of Object.entries(regression))ok(value,'header anchored: '+name);
  const toggles=await page.evaluate(()=>{
   cfg.modLabyrinthEmission=false;cleanupLabyrinthEmission();suitePositionLabyrinthFatigueCounter();
   const solo=runtime.box.style.right==='12px'&&!document.getElementById('suite-emission-timer');
   cfg.modLabyrinthEmission=true;initLabyrinthEmission();runtime.box.remove();runtime.box=null;
   return solo;
  });ok(toggles,'emission can be disabled independently');await page.waitForTimeout(800);
  ok(await page.locator('#suite-labyrinth-overlays > #suite-emission-timer').count()===1,'emission works alone');
  await page.evaluate(()=>{attachBox();renderBox();document.querySelector('.labyrinth-emission').classList.remove('is-active');suitePositionLabyrinthFatigueCounter();});
  ok(await page.locator('#suite-emission-timer').evaluate(e=>e.style.top==='12px'),'banner clearance removed when native emission ends');
  await page.evaluate(()=>{
   const old=document.getElementById('labyrinthMapViewport'),replacement=old.cloneNode(true);
   replacement.querySelectorAll('#suite-emission-timer,#suite-lab-fatigue-counter').forEach(el=>el.remove());old.replaceWith(replacement);attachBox();renderBox();
  });await page.waitForTimeout(600);
  ok(await page.locator('#suite-labyrinth-overlays > #suite-emission-timer').count()===1,'emission survives viewport replacement');
  ok(await page.locator('#suite-labyrinth-overlays > #suite-lab-fatigue-counter').count()===1,'fatigue survives viewport replacement without duplicates');
  await page.evaluate(()=>{
   const arena=document.querySelector('.labyrinth__arena'),replacement=arena.cloneNode(true);
   replacement.querySelector('#suite-labyrinth-overlays')?.remove();arena.replaceWith(replacement);attachBox();renderBox();
  });await page.waitForTimeout(600);
  ok(await page.locator('.labyrinth__arena > #suite-labyrinth-overlays > #suite-emission-timer').count()===1,'emission reattaches after entire arena replacement');
  ok(await page.locator('.labyrinth__arena > #suite-labyrinth-overlays > #suite-lab-fatigue-counter').count()===1,'fatigue reattaches after entire arena replacement');
  await page.setViewportSize({width:390,height:900});await page.evaluate(()=>suitePositionLabyrinthFatigueCounter());
  await page.screenshot({path:path.join(__dirname,'..','tmp','labyrinth-overlays-mobile.png')});
  await page.setViewportSize({width:1280,height:800});await page.evaluate(()=>suitePositionLabyrinthFatigueCounter());
  await page.screenshot({path:path.join(__dirname,'..','tmp','labyrinth-overlays-desktop.png')});
  await page.evaluate(()=>{document.getElementById('labyrinthMapViewport').remove();attachBox();});await page.waitForTimeout(600);
  ok(await page.locator('.labyrinth__arena > #suite-labyrinth-overlays > #suite-emission-timer').count()===1,'legacy arena fallback for emission');
  ok(await page.locator('.labyrinth__arena > #suite-labyrinth-overlays > #suite-lab-fatigue-counter').count()===1,'legacy arena fallback for fatigue');
  await page.evaluate(()=>{runtime.box.remove();cfg.modLabyrinthEmission=false;cleanupLabyrinthEmission();});
  ok(await page.locator('#suite-labyrinth-overlays').count()===0,'empty layer removed after both modules stop');
  const emissionIdle=await page.evaluate(()=>{
   const interval=window.setInterval,timeout=window.setTimeout,now=Date.now;
   const timers=[];window.setInterval=(fn,ms)=>(timers.push({fn,ms}),0);window.setTimeout=()=>0;
   Date.now=()=>1800000000000;cfg.modLabyrinthEmission=true;
   labyrinthData.emission={active:true,active_until:1800000180};
   initLabyrinthEmission();const tick=timers[0].fn;tick();
   const observer=new MutationObserver(()=>{});
   observer.observe(document.querySelector('.labyrinth__arena'),{subtree:true,childList:true,attributes:true});
   for(let i=0;i<100;i++)tick();const writes=observer.takeRecords().length;
   Object.defineProperty(document,'hidden',{configurable:true,value:true});
   Date.now=()=>1800000010000;tick();const hiddenWrites=observer.takeRecords().length;
   Object.defineProperty(document,'hidden',{configurable:true,value:false});tick();
   const resumed=document.querySelector('.suite-emission-value').textContent==='02:50';
   observer.disconnect();cleanupLabyrinthEmission();
   window.setInterval=interval;window.setTimeout=timeout;Date.now=now;
   return {oneTimer:timers.length===1&&timers[0].ms===1000,idle:writes===0,hidden:hiddenWrites===0,resumed};
  });
  for(const [name,value] of Object.entries(emissionIdle))ok(value,'emission scheduling: '+name);
  console.log('LABYRINTH_OVERLAY_LAYOUT_OK '+checks+' checks');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
