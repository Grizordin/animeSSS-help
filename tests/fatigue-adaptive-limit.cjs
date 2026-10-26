// Offline integration of the real state/step/render functions. No live site actions.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');new vm.Script(source);
function extract(name){
 const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(source),lines=source.slice(m.index).split(/\r?\n/);
 for(let n=2;n<=lines.length;n++)if(lines[n-1]===m[1]+'}'){
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }throw Error(name);
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({body:'<!doctype html><html><body><div class="labyrinth__arena"><div id="labyrinthMapViewport"></div></div></body></html>',contentType:'text/html'}));
  await page.goto('https://fixture.invalid/labyrinth/');
  await page.evaluate(()=>{
   window.cfg={modLabyrinthFatigue:true};window.store={};window.logs=[];window.tick=null;window.listener=null;
   window.gmGet=(k,d)=>structuredClone(store[k]??d);window.gmSet=(k,v)=>store[k]=structuredClone(v);
   window.GM_addValueChangeListener=(_k,fn)=>(listener=fn,1);window.GM_removeValueChangeListener=()=>{};
   window.suiteGetCurrentUserName=()=> 'Test';window.getPageWindow=()=>window;
   window.suiteTelemetryLog=(...args)=>logs.push(args);window.installLabyrinthFatigueStepHook=()=>{};
   window.suitePositionLabyrinthFatigueCounter=()=>{};
   window.setInterval=fn=>(tick=fn,1);
   window.requests=0;window.fetch=()=>{requests++;throw Error('No request expected');};
   window.stepData=(value,total,extra={})=>({step:total,total_steps:total,today_steps:total,mapData:{current:{x:total,y:0}},fatigue_counter:{value,skipped:false},...extra});
   window.labyrinthData=stepData(3,100);
  });
  await page.evaluate(code=>(0,eval)(code),['suiteLabyrinthFatigueNumber','suiteLabyrinthFatigueLimit','suiteLabyrinthFatigueResponseSummary','suiteLabyrinthFatigueCaptureState','suiteLabyrinthFatigueRecordDuplicate','suiteAttachLabyrinthOverlay','cleanupLabyrinthFatigue','initLabyrinthFatigue'].map(extract).join('\n')+'\ninitLabyrinthFatigue();tick();');
  const passed=await page.evaluate(()=>{
   let passed=0;const check=(v,s)=>{if(!v)throw Error(s);passed++;};
   const state=()=>__suiteLabyrinthFatigueState.state;
   const box=()=>document.getElementById('suite-lab-fatigue-counter');
   const percent=()=>box().querySelector('[data-lab-fatigue="percent"]').textContent;
   const percentOnly=()=>!box().querySelector('[data-lab-fatigue="approx"]')&&!box().textContent.includes('≈')&&!/Порог усталости|Счётчик:|уточняется/.test(box().title)&&!box().classList.contains('is-approximate');
   const send=(value,total,extra={})=>{labyrinthData=stepData(value,total,extra);__suiteLabyrinthFatigueStepHandler({status:200,transport:'test',response:suiteLabyrinthFatigueResponseSummary(labyrinthData)});};
   check(state().limit===10&&!state().limitConfirmed&&percent()==='30%'&&percentOnly(),'initial threshold stays internal, UI shows only percent');
   const observer=new MutationObserver(()=>{});
   observer.observe(box(),{subtree:true,attributes:true,childList:true,characterData:true});
   for(let i=0;i<100;i++)tick();
   check(observer.takeRecords().length===0,'100 unchanged fatigue ticks produce zero DOM writes');
   Object.defineProperty(document,'hidden',{configurable:true,value:true});
   labyrinthData=stepData(4,100);
   tick();check(percent()==='30%'&&observer.takeRecords().length===0,'hidden tick leaves UI untouched');
   // A real captured response still preserves progress while the UI is hidden.
   send(4,101);check(state().value===4&&percent()==='30%','hidden response records counter without rendering');
   Object.defineProperty(document,'hidden',{configurable:true,value:false});
   tick();check(percent()==='40%','visible tick renders preserved hidden response');
   observer.disconnect();
   cleanupLabyrinthFatigue();delete store['suite_labyrinth_fatigue_v2:Test'];
   labyrinthData=stepData(3,100);initLabyrinthFatigue();tick();
   send(10,101);check(state().value===10&&!box().classList.contains('is-ready'),'unconfirmed limit does not promise next-step fatigue');
   send(0,102,{fatigue:{active:true}});check(state().limit===10&&state().limitConfirmed,'consecutive actual fatigue confirms 10');
   send(5,103);check(percent()==='50%'&&percentOnly(),'confirmed percentage without calibration badge');
   send(0,104,{fatigue:{active:true}});check(state().limit===5&&state().limitSource==='observed','decrease to 5 learned from actual reset');
   send(2,105);check(percent()==='40%','percentage adapts to decreased limit');
   send(6,106);check(state().value===6&&state().limit===6&&!state().limitConfirmed&&percentOnly(),'higher counter recalibrates silently without clipping');
   send(12,107);check(state().value===12&&state().limit===12,'values above 10 retained');
   send(0,108,{fatigue:{active:true}});check(state().limit===12&&state().limitConfirmed,'increase confirmed by fatigue');
   send(4,109);check(percent()==='33.3%','fractional percentage rounded');
   send(0,110,{event:'trap_back',fatigue:{active:true}});check(state().limit===12,'trap reset cannot redefine threshold');
   send(5,111);send(0,112,{event:'mimic_chest_back',fatigue:{active:true}});check(state().limit===12,'mimic reset cannot redefine threshold');
   send(6,113);send(0,114,{text:'Щит сработал',fatigue:{active:true}});check(state().limit===12,'shield reset cannot redefine threshold');
   send(7,115);send(0,116,{fatigue_counter:{value:0,skipped:true},fatigue:{active:true}});
   check(state().value===7&&state().limit===12,'skipped zero preserves counter and threshold');
   check(state().counterTotalSteps===null,'untrusted skipped zero breaks calibration chain');
   send(8,117);send(0,120,{fatigue:{active:true}});check(state().limit===12,'missing steps cannot calibrate decrease');
   send(4,121);send(null,122,{fatigue_counter:null});send(0,123,{fatigue:{active:true}});check(state().limit===12,'missing counter breaks observation chain');
   const before=state().movesSincePrevious;send(0,123,{fatigue:{active:true}});
   check(state().movesSincePrevious===before&&state().limit===12,'duplicate response changes neither moves nor threshold');
   send(3,124,{fatigue_counter:{value:3,max:20}});check(state().limit===20&&state().limitSource==='server'&&percent()==='15%','explicit server max supported');
   labyrinthData.fatigue_counter.max=6;tick();check(state().limit===6&&percent()==='50%','page-only explicit change without new step');
   const moves=state().movesSincePrevious;
   send(3,124,{fatigue_counter:{value:3,limit:15}});check(state().limit===15&&percent()==='20%'&&state().movesSincePrevious===moves,'same-step explicit update does not count move');
   for(const bad of [0,-1,'bad',true,{},1.5,Infinity]){
    check(suiteLabyrinthFatigueResponseSummary(stepData(3,125,{fatigue_counter:{value:3,max:bad}})).fatigue_counter.limit===null,'invalid limit ignored '+String(bad));
   }
   // Reload: saved adaptive threshold survives and no historical events are removed.
   const events=state().events.length;cleanupLabyrinthFatigue();initLabyrinthFatigue();tick();
   check(state().limit===15&&state().limitConfirmed&&state().events.length===events,'reload keeps learned limit and events');
   const remote=structuredClone(state());remote.limit=30;remote.limitSource='server';remote.limitConfirmed=true;remote.updatedAt=Date.now()+100;
   listener('',null,remote,true);check(state().limit===30&&percent()==='10%','cross-tab state updates display');
   check(logs.some(l=>l[1]==='limit_updated'&&l[2].limit===5),'limit change logged');
   check(requests===0,'adaptive tracking adds no requests');
   cleanupLabyrinthFatigue();delete labyrinthData;
   store['suite_labyrinth_fatigue_v2:Test']={version:2,value:14,coord:null,events:[{key:'old',at:1}],updatedAt:1};
   initLabyrinthFatigue();tick();check(state().value===14&&state().limit===14&&!state().limitConfirmed&&state().events.length===1,'legacy state is not clipped or discarded');
   cleanupLabyrinthFatigue();return passed;
  });
  console.log(JSON.stringify({result:'FATIGUE_ADAPTIVE_LIMIT_OK',passed}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
