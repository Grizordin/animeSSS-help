// Offline Chromium tests; AJAX is an in-memory event bus, no cards are spent.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright');
const src=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(src);
function extract(name,scope=src){
  const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(scope);
  if(!m)throw Error(name);
  const lines=scope.slice(m.index).split(/\r?\n/);
  for(let n=1;n<=lines.length;n++){
    if(n>1&&lines[n-1]!==m[1]+'}')continue;
    const code=lines.slice(0,n).join('\n');
    try{new vm.Script('('+code+')');return code;}catch{}
  }throw Error(name);
}
const common=['suiteReadInventoryCount','suiteInventoryStats','suiteCardActionButtonReady','suiteConfirmCardAction'].map(n=>extract(n)).join('\n');
const setup=String.raw`
let passed=0;const check=(x,msg)=>{if(!x)throw Error(msg);passed++;};
const realTimeout=window.setTimeout.bind(window);
window.setTimeout=(fn,ms,...args)=>realTimeout(fn,ms>=35000?60:Math.min(ms,20),...args);
const handlers=new Map();
const eventTarget={on(name,fn){handlers.set(name,fn);return this;},off(ns){for(const name of handlers.keys())if(name.endsWith(ns))handlers.delete(name);return this;}};
window.jQuery=()=>eventTarget;
const emit=(name,...args)=>{for(const [key,fn] of [...handlers])if(key.startsWith(name+'.'))fn({},...args);};
const notices=[],issues=[];
const suiteSelfDiagnosticIssue=(...args)=>issues.push(args);
const suiteTelemetryLog=()=>{};
function cardHtml(kind,id='1'){
  return '<div class="'+kind+'__inventory-item" data-id="'+id+'" data-rank="e" data-energy="1"><img><div class="card-stats">'+
    [['Владельцев',1362,'1,4к'],['Хотят получить',4,'4'],['Готовы обменять',200,'200'],['Дубли на руках',2,'2']]
      .map(([label,n,text])=>'<span title="'+label+': '+n+'" data-'+(kind==='stone'?'cg':'rf')+'-count="'+n+'"><b>'+text+'</b></span>').join('')+'</div></div>';
}
let reply={new_energy:101}, outcome='success', clicks=0,replyStatus=200;
function attachExchange(button,action,ids,update){
  button.onclick=()=>{
    clicks++;
    const xhr={status:replyStatus,responseJSON:reply};
    const data=new URLSearchParams({action});
    for(const id of ids)data.append(action==='create_energy'?'cards_ids[]':'card_ids[]',id);
    if(outcome==='unobserved')return;
    emit('ajaxSend',xhr,{url:location.origin+'/index.php?controller=ajax&mod=cards_ajax',data:data.toString()});
    if(outcome==='timeout')return;
    realTimeout(()=>{if(outcome==='success')update();else if(outcome==='late-ui')realTimeout(update,70);emit('ajaxComplete',xhr);},15);
  };
}
`;
const receiptTests=String.raw`
const c=document.createElement('div');c.innerHTML=cardHtml('stone');
check(suiteInventoryStats(c).owners===1362,'exact cg counter');
c.innerHTML=cardHtml('remelt');check(suiteInventoryStats(c).owners===1362,'exact rf counter');
const span=document.createElement('span');span.textContent='1,4к';
check(suiteReadInventoryCount(span)===null,'abbreviation alone is unknown');
span.title='Владельцев: 1 362';check(suiteReadInventoryCount(span)===1362,'exact title fallback');
span.setAttribute('aria-label','Владельцев: 2\u00a0500');check(suiteReadInventoryCount(span)===2500,'accessible count fallback');
span.setAttribute('data-cg-count','0');check(suiteReadInventoryCount(span)===0,'zero is not missing');
span.removeAttribute('data-cg-count');span.removeAttribute('aria-label');span.title='Владельцев';span.textContent='1 362';
check(suiteReadInventoryCount(span)===1362,'legacy full count');
document.body.innerHTML='<button id="send">Send</button>';const button=document.getElementById('send');
for(const action of ['create_energy','remelt_card']){
  reply=action==='create_energy'?{new_energy:101}:{card:{image:'/test.webp',name:'Test'}};
  outcome='success';attachExchange(button,action,['1','2'],()=>{});
  const promise=suiteConfirmCardAction({button,action,ids:['2','1']});
  check(handlers.size===2,'only temporary listeners installed');
  const result=await promise;check(result.ok,'matching response confirmed '+action);
  check(handlers.size===0,'listeners removed on success');
}
for(const [response,expected] of [[{error:'Rejected'},'server_rejected'],[{},'invalid_response'],[{new_energy:'bad'},'invalid_response']]){
  reply=response;outcome='failure';attachExchange(button,'create_energy',['1'],()=>{});
  const result=await suiteConfirmCardAction({button,action:'create_energy',ids:['1']});
  check(!result.ok&&result.reason===expected,'failure not success: '+expected);
  check(handlers.size===0,'failure listener cleanup');
}
outcome='timeout';attachExchange(button,'create_energy',['1'],()=>{});
let result=await suiteConfirmCardAction({button,action:'create_energy',ids:['1'],timeoutMs:25});
check(!result.ok&&result.uncertain,'timeout is uncertain');check(handlers.size===0,'timeout listener cleanup');
replyStatus=502;outcome='failure';reply={new_energy:101};attachExchange(button,'create_energy',['1'],()=>{});
result=await suiteConfirmCardAction({button,action:'create_energy',ids:['1']});
check(!result.ok&&result.reason==='http_error','HTTP error cannot be success');replyStatus=200;
outcome='success';reply={new_energy:101};attachExchange(button,'create_energy',['9'],()=>{});
result=await suiteConfirmCardAction({button,action:'create_energy',ids:['1'],timeoutMs:25});
check(!result.ok,'other card IDs do not confirm');
button.disabled=true;const before=clicks;
result=await suiteConfirmCardAction({button,action:'create_energy',ids:['1']});
check(!result.ok&&clicks===before,'disabled button never clicked');button.disabled=false;
button.style.display='none';result=await suiteConfirmCardAction({button,action:'create_energy',ids:['1']});
check(!result.ok&&clicks===before,'hidden button never clicked');button.style.display='';
outcome='timeout';attachExchange(button,'create_energy',['1'],()=>{});
const abort=new AbortController(),pending=suiteConfirmCardAction({button,action:'create_energy',ids:['1'],signal:abort.signal});
abort.abort();check((await pending).reason==='cancelled','module cleanup cancels wait');check(handlers.size===0,'abort listener cleanup');
`;
const brickScope=src.slice(src.indexOf('  function initBrickFill'));
const brickFns=['getBasket','getUsedSlots','getFutureEnergy','getPageSelect','getCurrentPage','getLastPage','getFreeSlots','getActiveRank','parseCardStats','getCardImage','getCardRank','getCardEnergy','isCardAvailable','filterBrickCards','clickBrickTrade','waitAfterBrickTrade','fillBrickOnce','clickMatchingBrickCards'].map(n=>extract(n,brickScope)).join('\n');
const brickTests=String.raw`
const brickAbort=new AbortController();const BRICK_SLOT_LIMIT=70,BRICK_ENERGY={e:1,d:1,c:1,b:2,a:6};
let brickBusy=false,brickReadyToTrade=false,brickTradePending=false,brickTradeUncertain=false;
const brickNotify=text=>notices.push(text),updateBrickButton=()=>{},setBrickReady=v=>{brickReadyToTrade=v;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const warnCardStatsDemandRequired=()=>false,suiteGetCurrentUserName=()=>'',getLockedImages=async()=>new Set();
const defaultRankCfg=()=>({wantEnabled:true,wantLimit:50,ownersEnabled:true,ownersLimit:500});
const loadBrickSettings=()=>({'':defaultRankCfg(),excludeWishlist:false,targetEnergy:1});
const goToPage=()=>false,waitForInventoryUpdate=async()=>false;
function resetBrick(){
  brickTradeUncertain=false;notices.length=0;
  document.body.innerHTML='<div id="celestialForge" data-filter-busy="false"><span id="now_energy">100</span><span id="future-energy">0</span><div class="stone__main-items" data-type="creator"></div><button class="stone__send-trade-btn">Send</button>'+cardHtml('stone')+'</div>';
  document.querySelector('.stone__inventory-item').onclick=function(){
    getBasket().innerHTML='<button class="stone__main-item" data-id="1"></button>';this.hidden=true;document.getElementById('future-energy').textContent='1';
  };
  attachExchange(document.querySelector('.stone__send-trade-btn'),'create_energy',['1'],()=>{
    getBasket().replaceChildren();document.getElementById('now_energy').textContent='101';document.getElementById('future-energy').textContent='0';
  });
}
resetBrick();check(filterBrickCards(defaultRankCfg(),'',new Set(),new Map()).length===1,'brick exact owners filter');
reply={new_energy:101};outcome='success';await clickMatchingBrickCards();
check(notices.some(x=>x.includes('Цель выполнена: 1/1')),'brick goal after receipt and UI');
check(getUsedSlots()===0,'successful basket empty');
resetBrick();reply={new_energy:101};outcome='late-ui';const delayed=clickMatchingBrickCards();
await new Promise(r=>realTimeout(r,40));
check(!notices.some(x=>x.includes('Цель выполнена')),'brick waits for UI after response');
await delayed;check(notices.some(x=>x.includes('Цель выполнена')),'brick delayed UI confirms');
resetBrick();reply={error:'No'};outcome='failure';await clickMatchingBrickCards();
check(!notices.some(x=>x.includes('Цель выполнена')),'server rejection never counts brick goal');
resetBrick();reply={new_energy:101};outcome='timeout';const startClicks=clicks;await clickMatchingBrickCards();
check(brickTradeUncertain&&!notices.some(x=>x.includes('Цель выполнена')),'uncertain brick stops');
await clickMatchingBrickCards();check(clicks===startClicks+1,'no blind repeat after timeout');
`;
const remeltScope=src.slice(src.indexOf('  function initRemelt'));
const remeltFns=['getRemeltPageSelect','getRemeltCurrentPage','isRemeltPageReady','getRemeltFilterContext','restoreRemeltPage','getRemeltActiveRank','getRemeltNeedCount','parseRemeltCardStats','getRemeltCardImage','isRemeltCardAvailable','getRemeltCards','filterRemeltCards','getRemeltStartBtn','isRemeltVisible','getRemeltActiveWrapper','getRemeltFilledSlotCount','waitForRemeltSlotsFilled','waitForRemeltStartBtn','waitAfterRemelt','runRemelt'].map(n=>extract(n,remeltScope)).join('\n');
const remeltTests=String.raw`
const remeltAbort=new AbortController();let remeltBusy=false,remeltUncertain=false,remeltHadSuccessfulRun=false,remeltUserNavigation=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),remeltNotify=t=>notices.push(t),updateRemeltButton=()=>{};
const warnCardStatsDemandRequired=()=>false,suiteGetCurrentUserName=()=>'',getRemeltLockedImages=async()=>new Set();
const defaultRankCfg=()=>({wantEnabled:true,wantLimit:50,ownersEnabled:true,ownersLimit:500});
const loadRemeltSettings=()=>({targetCount:1,excludeWishlist:false,e:defaultRankCfg(),b:defaultRankCfg()});
const remeltGoToLastPage=async()=>false,remeltGoToPage=()=>false,waitForRemeltInventoryUpdate=async()=>{};
function resetRemelt(rank='e'){
  remeltUncertain=false;notices.length=0;
  const count=rank==='b'?6:3;
  document.body.innerHTML='<button class="remelt__rank-item--active" data-rank="'+rank+'">Rank</button><input type="checkbox" id="autoRemeltToggle"><div class="remelt__wrapper '+(rank==='b'?'remelt6':'')+'">'+Array.from({length:count},()=>'<div class="remelt__item remelt6__slot" style="width:40px;height:40px"></div>').join('')+'</div><button class="remelt__start-btn" style="display:none">Start</button><div class="remelt__inventory-list">'+Array.from({length:count},(_,i)=>cardHtml('remelt',String(i+1)).replace('data-rank="e"','data-rank="'+rank+'"')).join('')+'</div>';
  for(const card of getRemeltCards())card.onclick=function(){
    const slot=[...document.querySelectorAll('.remelt__item')].find(x=>!x.querySelector('img'));
    if(slot)slot.innerHTML='<img data-id="'+this.dataset.id+'">';this.style.display='none';
    if(getRemeltFilledSlotCount()===count)getRemeltStartBtn().style.display='';
  };
  attachExchange(getRemeltStartBtn(),'remelt_card',Array.from({length:count},(_,i)=>String(i+1)),()=>{
    document.querySelectorAll('.remelt__wrapper img').forEach(x=>x.remove());getRemeltCards().forEach(x=>x.remove());getRemeltStartBtn().style.display='none';
  });
}
for(const rank of ['e','b']){resetRemelt(rank);reply={card:{image:'/test.webp',name:'Test'}};outcome='success';await runRemelt();check(notices.some(x=>x.includes('Готово: 1/1')),'confirmed remelt '+rank);}
resetRemelt();reply={card:{image:'/test.webp',name:'Test'}};outcome='late-ui';await runRemelt();
check(notices.some(x=>x.includes('Готово: 1/1')),'remelt waits for delayed UI');
resetRemelt();reply={error:'No'};outcome='failure';await runRemelt();
check(!notices.some(x=>x.includes('Переплавка 1/')||x.includes('Готово:')),'rejected remelt not counted');
resetRemelt();outcome='timeout';const startClicks=clicks;await runRemelt();
check(remeltUncertain,'uncertain remelt blocked');await runRemelt();check(clicks===startClicks+1,'no repeated destructive request');
resetRemelt();document.getElementById('autoRemeltToggle').checked=true;const old=clicks;await runRemelt();check(clicks===old,'site auto mode excluded');
document.getElementById('autoRemeltToggle').checked=false;getRemeltStartBtn().disabled=true;
check(await waitForRemeltStartBtn(15)===null,'timeout cannot return disabled start');
`;
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
  for(const [name,functions,tests] of [['receipt','',receiptTests],['brick',brickFns,brickTests],['remelt',remeltFns,remeltTests]]){
    const page=await browser.newPage();await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));await page.goto('https://test.invalid/');
    const result=await page.evaluate(code=>eval(code),'(async()=>{'+setup+common+functions+tests+';return {passed};})()');
    console.log(name+': '+JSON.stringify(result));await page.close();
  }
  for(const [index,file] of process.argv.slice(2).entries()){
    const page=await browser.newPage();await page.route('**/*',r=>r.abort());await page.setContent('<html><body></body></html>');
    const result=await page.evaluate(({code,html,index})=>{
      const doc=new DOMParser().parseFromString(html,'text/html');
      const parse=eval('(()=>{'+code+';return suiteInventoryStats;})()');
      const prefix=index===0?'cg':'rf';const cards=[...doc.querySelectorAll(index===0?'.stone__inventory-item':'.remelt__inventory-item')];
      if(!cards.length)throw Error('Empty fixture');
      let checked=0;
      for(const card of cards){
        const actual=parse(card),spans=card.querySelectorAll('.card-stats > span');
        for(const [key,pos] of [['owners',0],['want',1],['dups',3]]){
          if(actual[key]!==Number(spans[pos].getAttribute('data-'+prefix+'-count')))throw Error('Fixture count mismatch '+key);
          checked++;
        }
      }return {cards:cards.length,checked};
    },{code:common,html:fs.readFileSync(file,'utf8'),index});
    console.log('fixture '+index+': '+JSON.stringify(result));await page.close();
  }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
