// Offline UI and lifecycle tests. Optional argument: captured packs HTML.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
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
const functions=['createAutoOpenPanel','injectAutoEmbeddedStyle','updateAutoOpenPanel','setAutoStatus','updateAutoCount','saveAutoOpenedCount','resetAutoOpenedCount','pauseAutoOpenAfterReload','stopAutoOpen','startAutoOpen','pauseAutoOpen','handleAutoManualPick','autoBeginChoice','clearAutoChoiceWatch','watchAutoChoice','autoCheckChoice','autoClickBestCard','autoBuyPack','autoPackReady'].map(extract).join('\n');
const css=source.match(/globalStyle\.textContent = `([\s\S]*?)`;/)[1];
const html=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):'<div class="packs-page"><div class="lootbox"><div class="packs-shop-heading"><h2>Выберите набор паков</h2></div><div class="lootbox__middle">20 паков · 1600 камней</div><div class="packs-stage" data-pack-state="ready"></div></div></div>';
const setup=String.raw`
${extract('autoDiagnosticVisibleElapsed')}
let suiteHealthVisibleSince=0;
let passed=0;const check=(v,m)=>{if(!v)throw Error(m);passed++;};
let autoPanel=null,autoRunInput=null,autoTargetInput=null,autoStatusEl=null,autoCountEl=null;
let autoPendingChoice=null,autoChoiceObserver=null,autoChoiceTimer=null,autoRunGeneration=0;
const autoCountedPackIds=new Set();
let autoOpenedCount=7,autoPausedAfterReload=false,autoBusy=false,autoWaitingManual=false,autoOpenSuppressGuard=false;
let autoLastChosenPackId='',autoManualPackId='',autoLoopTimer=null,autoPackRetry=null;
let rare=false,clicked=0,bought=0,saved=0,scheduled=0,dragged=0,clamped=0;
const cfg={modAutoOpen:true,autoOpenEnabled:false,autoOpenTarget:20,autoOpenedCount:7,autoPanelLeft:123,autoPanelTop:234};
const AUTO_DIAGNOSTIC_STALL_MS=10000,AUTO_DELAY_AFTER_PICK=650,AUTO_DELAY_WAIT_CLOSE=350,AUTO_DELAY_START=300,AUTO_DELAY_RARE_VIEW=3000,AUTO_DELAY_BEFORE_BUY=400,AUTO_DELAY_AFTER_BUY=1000;
const saveCfg=()=>saved++,hasActivePremium=()=>false,savePremiumDesiredSettings=()=>{},isAutoOpenAvailable=()=>true;
const isPremiumLockedSetting=()=>false,warnCardStatsDemandRequired=()=>false,warnPremiumRequired=()=>{};
const ensureAutoDiagnosticTimer=()=>{},autoResolveExpectation=()=>{},autoStartExpectation=()=>{},autoDiagnosticRecord=()=>{},autoReportDiagnosticStall=()=>{};
const scheduleAutoLoop=()=>scheduled++,getAutoCardIdentity=c=>c.dataset.id,needsAutoRareViewDelay=()=>rare;
const getActiveRow=()=>document.querySelector('.lootbox__row[data-pack-id]');
const getCurrentStoneBalance=()=>100000,autoHandlePackRetry=()=>false,getAutoPackRetryButton=()=>null;
const selectPack20=()=>{},isPack20Active=()=>true,clickBuyButton=()=>bought++,hasOpenCardsReady=()=>!!getActiveRow();
const makeDraggable=()=>dragged++,suiteClampToViewport=()=>clamped++;
const nativeSetTimeout=window.setTimeout.bind(window),nativeClearTimeout=window.clearTimeout.bind(window);
let held=new Map(),timerId=-1;
window.setTimeout=(fn,ms,...args)=>{if([10000,3000,400].includes(ms)){const id=timerId--;held.set(id,()=>fn(...args));return id;}return nativeSetTimeout(fn,ms,...args);};
window.clearTimeout=id=>{held.delete(id);nativeClearTimeout(id);};
const flush=()=>new Promise(r=>nativeSetTimeout(r,0));
function card(packId){
 const stage=document.querySelector('.packs-stage');stage.dataset.packState='ready';
 stage.innerHTML='<div class="lootbox__row" data-pack-id="'+packId+'"><div class="lootbox__list"><button class="lootbox__card" data-id="1">Card</button></div></div>';
 const c=stage.querySelector('.lootbox__card');c.addEventListener('click',()=>clicked++);return c;
}
`;
const tests=String.raw`
createAutoOpenPanel();createAutoOpenPanel();
check(document.querySelectorAll('#cv-auto-open-panel').length===1,'single panel');
check(!autoPanel.querySelector('.cv-auto-header button'),'embedded block has no close button');
check(document.querySelector('.packs-shop-heading').nextElementSibling===autoPanel,'directly below heading');
check(autoPanel.nextElementSibling.classList.contains('lootbox__middle'),'native pack selector preserved');
check(dragged===0&&clamped===0,'embedded panel is never dragged or clamped');
check(autoCountEl.textContent==='7/20','saved count shown');
autoTargetInput.value='30';autoTargetInput.dispatchEvent(new Event('change'));
check(autoOpenedCount===7&&cfg.autoOpenTarget===30,'target change preserves count');

startAutoOpen();let c=card('one');autoClickBestCard(c);
check(clicked===1&&!!autoPendingChoice,'choice dispatched but not yet counted');
stopAutoOpen();check(!!autoPendingChoice&&!!autoChoiceObserver,'stop retains confirmation watcher');
c.closest('.lootbox__row').remove();await flush();
check(autoOpenedCount===8&&cfg.autoOpenedCount===8&&!cfg.autoOpenEnabled,'late confirmation counted while stopped');
check(!autoPendingChoice&&!autoChoiceObserver&&autoChoiceTimer===null,'confirmed choice clears bounded watcher');
autoCheckChoice();check(autoOpenedCount===8,'loop cannot count confirmation twice');

c=card('two');startAutoOpen();autoClickBestCard(c);stopAutoOpen();startAutoOpen();
check(autoPendingChoice.packId==='two','restart preserves pending identity');
const before=clicked;autoClickBestCard(c);check(clicked===before,'no duplicate click during pending confirmation');
c.closest('.lootbox__row').removeAttribute('data-pack-id');autoCheckChoice();await flush();
check(autoOpenedCount===9,'restart choice counted once with observer and loop');
c=card('two');autoBeginChoice(c);c.closest('.lootbox__row').remove();await flush();
check(autoOpenedCount===9,'duplicate pack id not counted again');

c=card('manual');pauseAutoOpen('Выбери карту','manual');handleAutoManualPick(c);
check(!!autoPendingChoice&&!autoWaitingManual,'manual choice tracked during automatic pause');
c.closest('.lootbox__row').remove();await flush();check(autoOpenedCount===10,'manual choice confirmation counts');

c=card('error');autoBeginChoice(c);document.querySelector('.packs-stage').dataset.packState='error';await flush();
check(autoOpenedCount===10&&!!autoPendingChoice,'site error does not count');
autoCheckChoice();check(!cfg.autoOpenEnabled&&!!autoPendingChoice,'error stops without losing pending choice');
resetAutoOpenedCount();check(autoOpenedCount===10&&autoStatusEl.textContent.includes('подтверждения'),'reset refuses unresolved choice');
const expire=held.get(autoChoiceTimer);expire();
check(!autoChoiceObserver&&autoChoiceTimer===null&&!!autoPendingChoice,'timeout disconnects observer and preserves unresolved choice');
document.querySelector('.packs-stage').dataset.packState='ready';startAutoOpen();
check(!!autoChoiceObserver,'restart reattaches bounded confirmation watcher');
getActiveRow().remove();await flush();check(autoOpenedCount===11,'reconciled late choice counts');
resetAutoOpenedCount();check(autoOpenedCount===0&&cfg.autoOpenedCount===0&&!cfg.autoOpenEnabled,'explicit reset persists zero and stops');

c=card('rare');startAutoOpen();rare=true;autoClickBestCard(c);
const staleRare=[...held.values()][0];check(held.size===1,'only rare delay remains');
stopAutoOpen();startAutoOpen();autoBusy=true;staleRare();
check(clicked===before&&autoBusy&&!autoPendingChoice,'old rare callback cannot click or alter restarted run');
held.clear();rare=false;autoBusy=false;
getActiveRow().remove();document.querySelector('.packs-stage').dataset.packState='idle';autoBuyPack();
const staleBuy=[...held.values()][0];stopAutoOpen();startAutoOpen();autoBusy=true;staleBuy();
check(bought===0&&autoBusy,'old purchase callback cannot buy or alter restarted run');held.clear();autoBusy=false;

autoOpenedCount=30;cfg.autoOpenTarget=30;cfg.autoOpenEnabled=true;autoPausedAfterReload=false;
pauseAutoOpenAfterReload();check(autoOpenedCount===30&&!cfg.autoOpenEnabled,'reload pause preserves completed count');
startAutoOpen();autoTargetInput.value='25';autoTargetInput.dispatchEvent(new Event('change'));
check(!cfg.autoOpenEnabled&&autoOpenedCount===30,'lowered target stops without resetting');
cfg.autoOpenTarget=31;startAutoOpen();c=card('limit');autoClickBestCard(c);getActiveRow().remove();await flush();
check(autoOpenedCount===31&&!cfg.autoOpenEnabled,'confirmation stops exactly at target');
check(saved>0,'changes persisted');
autoTargetInput.value=cfg.autoOpenTarget;
window.packAutoTest={passed};
`;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL||'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({body:'<!doctype html><html><head></head><body></body></html>',contentType:'text/html'}):r.abort());
  await page.goto('https://offline.test/cards/pack/');
  await page.evaluate(({html,css})=>{
   const doc=new DOMParser().parseFromString(html,'text/html');
   const root=doc.querySelector('.packs-page');if(!root)throw Error('Missing packs-page');
   const styles=[...doc.querySelectorAll('style')].filter(s=>s.textContent.includes('.packs-page {'));
   root.querySelectorAll('script,iframe,link,object,embed,style,#cv-auto-open-panel').forEach(e=>e.remove());
   root.querySelectorAll('*').forEach(e=>[...e.attributes].forEach(a=>{if(/^on|^(src|srcset|href|action)$/i.test(a.name))e.removeAttribute(a.name);}));
   styles.forEach(s=>document.head.append(s.cloneNode(true)));
   const base=document.createElement('style');base.textContent='*{box-sizing:border-box}body{margin:16px;background:#111;color:#ddd;font-family:Arial;--bg:#111;--bg-2:#191919;--bdc:#303030;--tt:#eee;--tt-2:#aaa;--accent:#9e294f}.packs-page{max-width:1320px;margin:auto}.lootbox{display:flex;flex-direction:column;gap:22px}'+css;document.head.append(base);
   document.body.append(root);
  },{html,css});
  await page.evaluate(code=>new (Object.getPrototypeOf(async function(){}).constructor)(code)(),setup+'\n'+functions+'\n'+tests);
  const result=await page.evaluate(()=>window.packAutoTest);
  const toggleMatches=await page.evaluate(()=>{
   const ref=document.createElement('label');ref.className='suite-toggle';ref.innerHTML='<input type="checkbox"><span class="suite-slider"></span>';document.body.append(ref);
   const actual=document.querySelector('#cv-auto-open-panel .suite-toggle');
   const input=actual.querySelector('input'),original=input.checked;
   const snapshot=el=>['','::before','::after'].map(p=>{const s=getComputedStyle(el.querySelector('.suite-slider'),p||null);return [s.width,s.height,s.backgroundImage,s.boxShadow,s.transform,s.display,s.alignItems,s.alignSelf,s.top,s.left,s.padding,s.borderWidth].join('|');}).join(';');
   const matched=[false,true].every(checked=>{input.checked=checked;ref.querySelector('input').checked=checked;return snapshot(actual)===snapshot(ref);});
   input.checked=original;ref.remove();return matched;
  });
  if(!toggleMatches)throw Error('Embedded toggle differs from original menu toggle');result.passed++;
  const cdp=await page.context().newCDPSession(page);
  const {root}=await cdp.send('DOM.getDocument',{depth:-1,pierce:true});
  const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#cv-auto-open-panel .suite-slider'});
  const {node}=await cdp.send('DOM.describeNode',{nodeId});
  const knobNode=node.pseudoElements.find(p=>p.pseudoType==='before');
  if(!knobNode)throw Error('Missing knob pseudo-element');
  for(const width of [1360,1200,1024,1000,700,390,320]){
   await page.setViewportSize({width,height:1000});
   for(const checked of [false,true]){
    await page.locator('.cv-auto-run input').evaluate((input,checked)=>{input.checked=checked;},checked);
    await page.waitForTimeout(300); // Measure the settled endpoint, not an animation frame.
    const track=await page.locator('.cv-auto-run .suite-slider').evaluate(el=>{
     const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();
     return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,center:(r.left+r.right)/2,labelCenter:(p.left+p.right)/2};
    });
    const b=(await cdp.send('DOM.getBoxModel',{nodeId:knobNode.nodeId})).model.border;
    const left=b[0]-track.left,right=track.right-b[2],top=b[1]-track.top,bottom=track.bottom-b[5];
    if(Math.abs(track.width-50)>.1||Math.abs(track.center-track.labelCenter)>.1||Math.abs((checked?right:left)-3)>.1||Math.abs(top-3)>.1||Math.abs(bottom-3)>.1||left<0||right<0)
     throw Error('Knob endpoint misaligned '+JSON.stringify({width,checked,track,left,right,top,bottom}));
    result.passed++;
   }
   await page.locator('.cv-auto-run input').evaluate(input=>{input.checked=false;});
   await page.waitForTimeout(300);
   const layout=await page.locator('#cv-auto-open-panel').evaluate(el=>{
    const r=el.getBoundingClientRect();return {position:getComputedStyle(el).position,overflow:el.scrollWidth>el.clientWidth+1,inside:[...el.querySelectorAll('button,input,.cv-auto-status')].every(c=>{const b=c.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right;}),left:r.left,right:r.right};
   });
   if(layout.position!=='static'||layout.overflow||!layout.inside||layout.left<0||layout.right>width)throw Error('Panel overflow '+width+' '+JSON.stringify(layout));
   result.passed++;
   const centered=await page.locator('.cv-auto-run').evaluate(el=>{
    const center=e=>{const r=e.getBoundingClientRect();return (r.top+r.bottom)/2;};
    const slider=el.querySelector('.suite-slider'),knob=getComputedStyle(slider,'::before');
    return Math.abs(center(slider)-center(el))<.6&&Math.abs(center(el.querySelector('span'))-center(slider))<.6&&getComputedStyle(slider).alignItems==='center'&&knob.alignSelf==='center'&&parseFloat(knob.top)===0;
   });
   if(!centered)throw Error('Toggle is not vertically centered at '+width);result.passed++;
   if(width>1000){
    const compact=await page.locator('#cv-auto-open-panel').evaluate(el=>{
     const parts=['.cv-auto-header','.cv-auto-run','.cv-auto-target','.cv-auto-progress','.cv-auto-status'].map(s=>el.querySelector(s).getBoundingClientRect());
     return el.getBoundingClientRect().height<115&&parts.every((r,i)=>!i||(r.left>=parts[i-1].right&&Math.abs((r.top+r.bottom)/2-(parts[0].top+parts[0].bottom)/2)<2));
    });
    if(!compact)throw Error('Controls must share a compact horizontal row at '+width);result.passed++;
   }
   if([1200,390].includes(width)){
    const dir=path.join(__dirname,'..','output','pack-auto-embedded');fs.mkdirSync(dir,{recursive:true});
    await page.locator('#cv-auto-open-panel').screenshot({path:path.join(dir,width+'.png')});
   }
  }
  const toggleInput=page.locator('.cv-auto-run input');
  await toggleInput.evaluate(input=>{input.dataset.testChanges='0';input.addEventListener('change',()=>{input.dataset.testChanges=String(Number(input.dataset.testChanges)+1);});});
  await page.locator('.cv-auto-run .suite-toggle').click();
  if(!await toggleInput.isChecked())throw Error('Label click no longer toggles checkbox');result.passed++;
  await toggleInput.focus();await page.keyboard.press('Space');
  if(await toggleInput.isChecked()||await toggleInput.getAttribute('data-test-changes')!=='2')throw Error('Keyboard toggle must dispatch one change');result.passed++;
  if(errors.length)throw Error(errors.join('\n'));
  console.log(JSON.stringify({result:'PACK_AUTO_EMBEDDED_OK',...result}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
