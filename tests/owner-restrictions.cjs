// Offline browser tests. Optional args: trade blacklist, blocked friends, owners, traders HTML.
// Attached scripts never execute; all HTTP is mocked/blocked.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
function extract(name){
 const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(source);if(!m)throw Error(name);
 const lines=source.slice(m.index).split(/\r?\n/);
 for(let n=1;n<=lines.length;n++){
  if(n>1&&lines[n-1]!==m[1]+'}')continue;
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }throw Error('extract '+name);
}
const names=['normalizeOwnerNickname','ownerNicknameFromHref','ownerRestrictionPageUrl','parseOwnerRestrictionPage','ownerRestrictionsAccount','ownerRestrictionsActive','readOwnerRestrictionsCache','crawlOwnerRestrictionList','refreshOwnerRestrictions','createOwnerRestrictionBadge','positionOwnerRestrictionBadges','renderOwnerRestrictions','injectOwnerRestrictionsStyle','cleanupOwnerRestrictions','initOwnerRestrictions','suiteDocumentIsGuest'];
const setup=String.raw`
let passed=0;const check=(v,m)=>{if(!v)throw Error(m);passed++;};
const cfg={modOwnerRestrictions:true};let nickname='Tester';
const suiteGetCurrentUserName=()=>nickname,store=new Map();
const gmGet=(key,fallback)=>store.has(key)?structuredClone(store.get(key)):fallback;
const gmSet=(key,value)=>store.set(key,structuredClone(value)),gmDelete=key=>store.delete(key);
const OWNER_RESTRICTIONS_DAY=86400000,OWNER_RESTRICTIONS_RETRY=1800000;
const flush=()=>new Promise(r=>setTimeout(r,170));
function parsed(html){return new DOMParser().parseFromString(html,'text/html');}
function list(root,names,next=[],total=names.length){
 return '<a class="ncard__tabs-btn" href="'+root+'"><span>'+total+'</span></a><div class="usn-fr-list">'+names.map(n=>'<div class="card-inline"><div class="card-inline__name"><a href="/user/'+encodeURIComponent(n)+'/">'+n+'</a></div></div>').join('')+'</div><div class="pagination">'+next.map(url=>'<a href="'+url+'">далее</a>').join('')+'</div>';
}
const root=location.origin+'/user/Tester/friends/blocked/',trade=location.origin+'/trades/blacklist/';
let routes=new Map(),requests=[],failure='',waitResponse=null;
window.fetch=async(url,options)=>{
 check(options.credentials==='same-origin'&&(!options.method||options.method==='GET'),'passive authenticated GET only');
 requests.push(url);
 if(waitResponse)await waitResponse;
 if(failure==='network')throw Error('network');
 const body=failure==='guest'?'<form><input name="login_password"></form>':routes.get(url);
 if(body===undefined)throw Error('unexpected URL '+url);
 return {ok:true,url,text:async()=>body};
};
function owners(){
 document.body.innerHTML='<div class="card-show__owner-wrapper">'+['Alice','ALICE','Bob','Both','Safe'].map(n=>'<a class="card-show__owner card-show__owner--online" href="/user/cards/?name='+n+'&card_id=3591"><div class="card-show__owner-image"><div class="card-show__time-icon"><span>8.9 м.</span></div><span class="test-avatar">'+n[0]+'</span>'+(n==='Both'?'<div class="card-show__owner-icon"><i class="fal fa-lock"></i></div>':'')+'</div><span class="card-show__owner-name">'+n+'</span></a>').join('')+'</div><div class="ncard__about"><p>У пользователя может быть несколько карточек</p><div class="ncard__about-legend"><div>в обмене</div><div>заблокирована</div><div>зафиксирована</div><div>обмен с друзьями</div><div>звезданутые</div></div></div>';
}
const testStyle=document.createElement('style');testStyle.textContent='body{margin:28px 18px;background:#111;color:#ccc;font:14px Arial}.card-show__owner-wrapper{display:flex;flex-wrap:wrap;gap:26px 14px;padding-top:15px}.card-show__owner{display:flex;flex-direction:column;align-items:center;position:relative;box-sizing:border-box;width:108px;height:92px;border:1px solid #239966;border-radius:14px;background:#1b1b1b;color:#ccc;text-decoration:none;padding:12px 6px 8px}.test-avatar{display:grid;place-items:center;width:40px;height:40px;border-radius:9px;background:#424457;color:white}.card-show__owner-name{margin-top:5px}.card-show__time-icon{position:absolute;left:7px;top:9px;font-size:10px;background:#444;border-radius:6px;padding:2px}.card-show__owner-icon{position:absolute;right:-6px;top:-8px;width:24px;height:24px;border-radius:50%;background:#cd2839;display:grid;place-items:center}.ncard__about{margin-top:28px;padding:18px 8px;background:#1c1c1c;border-top:2px solid #a42456;text-align:center;border-radius:12px}.ncard__about-legend{display:flex;justify-content:center;gap:9px;flex-wrap:wrap}.ncard__about-legend>div{background:#111;padding:5px;border-radius:5px}';document.head.append(testStyle);
`;
const tests=String.raw`
check(ownerNicknameFromHref('/user/cards/?name=ALICE&card_id=1')==='alice','full nickname from owner URL');
check(ownerNicknameFromHref('/user/Bezlikiy%201/')==='bezlikiy 1','spaces and encoded nickname');
check(ownerNicknameFromHref('/user/A%2BB/')==='a+b','literal plus is not space');
check(ownerNicknameFromHref('/user/cards/?name=A%2BB')==='a+b','plus in query preserved');
check(ownerNicknameFromHref('https://evil.test/user/Alice/')==='','foreign user links ignored');
check(ownerRestrictionPageUrl('page/2/',root)===root+'page/2/','relative blocked pagination');
check(ownerRestrictionPageUrl('?page=2',root)===root+'?page=2','query pagination');
check(ownerRestrictionPageUrl('?cstart=2',root)===root+'?cstart=2','cstart pagination');
check(ownerRestrictionPageUrl('/trades/blacklist/page/2/',root)===null,'unrelated list ignored');
check(ownerRestrictionPageUrl('https://evil.test/trades/blacklist/',trade)===null,'foreign pagination ignored');
check(ownerRestrictionPageUrl('?action=delete',trade)===null,'mutation links ignored');
check(ownerRestrictionPageUrl('javascript:alert(1)',trade)===null,'script links ignored');
const demo=list(root,['Alice'],[root+'page/2/',root+'page/2/'],2)+'<a href="/user/Unrelated/">sidebar</a>';
const info=parseOwnerRestrictionPage(parsed(demo),root);
check(info.names.join()==='alice'&&info.total===2,'only actual list entries parsed');
check(parseOwnerRestrictionPage(parsed(list(root,[],[],0)),root).names.length===0,'explicit empty list allowed');
for(const bad of ['<div>Error</div>','<div class="usn-fr-list"></div>','<div class="usn-fr-list"><div class="card-inline"></div></div>']){
 let rejected=false;try{parseOwnerRestrictionPage(parsed(bad),root);}catch{rejected=true;}check(rejected,'malformed page rejected');
}

owners();routes=new Map([[root,list(root,['Alice'],[root+'page/2/',root+'page/2/'],2)],
 [root+'page/2/',list(root,['Both'],[root],2)],
 [trade,list(trade,['Bob'],[trade+'page/2/'],2)],
 [trade+'page/2/',list(trade,['Both'],[trade],2)]]);
initOwnerRestrictions();const state=window.__suiteOwnerRestrictionsState;
while(state.running)await flush();
check(requests.length===4,'all pages collected once, cycles and duplicates ignored');
check(state.cache.blocked.join()==='alice,both'&&state.cache.trade.join()==='bob,both','both complete lists persisted');
check(document.querySelectorAll('.suite-owner-restriction-icons').length===4,'all copies marked, safe user untouched');
check(document.querySelectorAll('.suite-owner-restriction-icons .suite-owner-restriction-badge').length===5,'both statuses kept');
check(document.querySelector('.card-show__owner-icon .fa-lock')!==null,'native lock preserved');
check(document.querySelectorAll('.ncard__about-legend>div').length===5,'all native legend entries preserved');
check(document.querySelectorAll('.suite-owner-restriction-legend-item').length===2,'two additional explanations');
const before=document.querySelector('.suite-owner-restriction-icons');renderOwnerRestrictions(state);
check(before===document.querySelector('.suite-owner-restriction-icons'),'idempotent decoration');
await refreshOwnerRestrictions(state);state.tick();await flush();check(requests.length===4,'no same-day recrawl');
initOwnerRestrictions();check(window.__suiteOwnerRestrictionsState===state,'single module instance');

const target=document.querySelector('.card-show__owner');target.href='/user/cards/?name=Safe&card_id=3591';await flush();
check(!target.querySelector('.suite-owner-restriction-icons'),'reused owner tile cleaned on nickname change');
const duplicate=target.cloneNode(true);duplicate.href='/user/cards/?name=Both';target.parentElement.append(duplicate);await flush();
check(duplicate.querySelectorAll('.suite-owner-restriction-badge').length===2,'late owner tiles annotated');
const native=document.querySelector('.ncard__about-legend');native.remove();document.querySelector('.suite-owner-restriction-legend').remove();
history.pushState({},'', '/cards/users/trade/?id=3591');state.tick();
check(!!document.querySelector('.ncard__about>.suite-owner-restriction-legend'),'trade page without native legend supported');
history.pushState({},'', '/other/');state.tick();check(!document.querySelector('.suite-owner-restriction-icons'),'route exit cleans marks');
history.pushState({},'', '/cards/users/?id=3591');state.tick();

let saved=gmGet(state.key);saved.updatedAt=Date.now()-OWNER_RESTRICTIONS_DAY-1;gmSet(state.key,saved);gmDelete(state.key+':attempt');
const old=JSON.stringify(saved);failure='network';await refreshOwnerRestrictions(state);
check(JSON.stringify(gmGet(state.key))===old,'network failure preserves last complete cache');
check(!!state.error&&document.querySelector('.suite-owner-restriction-legend').title.includes('сохранённые'),'cached-data warning exposed');
const failures=requests.length;await refreshOwnerRestrictions(state);check(requests.length===failures,'failure backoff avoids request storm');
failure='guest';gmDelete(state.key+':attempt');await refreshOwnerRestrictions(state);check(JSON.stringify(gmGet(state.key))===old,'guest response never erases cache');
failure='';gmDelete(state.key+':attempt');routes.set(trade+'page/2/','<div>server error</div>');await refreshOwnerRestrictions(state);
check(JSON.stringify(gmGet(state.key))===old,'second-list failure never saves partial first list');
routes.set(root,'<div class="header__group-menu"><a href="/user/Another/">Another</a></div>'+list(root,['Alice'],[],1));
gmDelete(state.key+':attempt');await refreshOwnerRestrictions(state);
check(JSON.stringify(gmGet(state.key))===old,'response from another account rejected');
routes.set(root,list(root,['Alice'],[root+'page/2/'],2));
routes.set(trade+'page/2/',list(trade,[],[],2));gmDelete(state.key+':attempt');await refreshOwnerRestrictions(state);
check(JSON.stringify(gmGet(state.key))===old,'incomplete pagination rejected');
routes.set(root,list(root,[],[],0));routes.set(trade,list(trade,[],[],0));gmDelete(state.key+':attempt');await refreshOwnerRestrictions(state);
check(state.cache.blocked.length===0&&state.cache.trade.length===0&&!document.querySelector('.suite-owner-restriction-icons'),'complete empty lists remove obsolete marks');

saved=gmGet(state.key);saved.updatedAt=0;gmSet(state.key,saved);gmDelete(state.key+':attempt');
const hiddenCount=requests.length;Object.defineProperty(document,'hidden',{configurable:true,value:true});
await refreshOwnerRestrictions(state);check(requests.length===hiddenCount,'hidden tab does not refresh');delete document.hidden;
gmSet(state.key+':lock',{owner:'another-tab',until:Date.now()+60000});const count=requests.length;
await refreshOwnerRestrictions(state);check(requests.length===count,'other-tab lock prevents duplicate scan');
check(gmGet(state.key+':lock').owner==='another-tab','foreign lock never released');gmDelete(state.key+':lock');
let release;waitResponse=new Promise(resolve=>release=resolve);const work=refreshOwnerRestrictions(state);await flush();
cfg.modOwnerRestrictions=false;cleanupOwnerRestrictions();release();waitResponse=null;await work;
check(!window.__suiteOwnerRestrictionsInstalled&&!document.querySelector('.suite-owner-restriction-badge'),'disable aborts and cleans UI');
check(gmGet(state.key).updatedAt===0,'cancelled request cannot commit');
check(!document.getElementById('suite-owner-restrictions-style'),'owned stylesheet removed');

cfg.modOwnerRestrictions=true;nickname='Another';const otherKey='suite_owner_restrictions_v1:'+location.hostname+':another';
gmSet(otherKey,{account:'another',updatedAt:Date.now(),blocked:['Safe'],trade:[]});initOwnerRestrictions();
check(window.__suiteOwnerRestrictionsState.key!==state.key,'per-account cache isolation');
check(!window.__suiteOwnerRestrictionsState.blocked.has('alice'),'previous account not leaked');
cleanupOwnerRestrictions();nickname='Tester';
gmSet(state.key,{account:'tester',updatedAt:Date.now(),blocked:['Alice','Both'],trade:['Bob','Both']});owners();initOwnerRestrictions();
window.ownerTests={passed};
`;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL||'msedge'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({body:'<!doctype html><body></body>',contentType:'text/html'}):r.abort());
  await page.goto('https://animesss.tv/cards/users/?id=3591');
  await page.evaluate('(async()=>{'+setup+names.map(extract).join('\n')+tests+'})()');
  const result=await page.evaluate(()=>window.ownerTests);
  for(const width of [1200,390,320]){
   await page.setViewportSize({width,height:700});await page.waitForTimeout(250);
   const layout=await page.evaluate(()=>{
    const r=el=>el.getBoundingClientRect(),overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    for(const card of document.querySelectorAll('.card-show__owner')){
     const badges=[...card.querySelectorAll('.suite-owner-restriction-icons>span,.card-show__owner-icon')].map(r);
     for(let i=0;i<badges.length;i++){
      if(badges.some((b,j)=>j!==i&&overlap(badges[i],b)))return 'overlapping badges';
      if(overlap(badges[i],r(card.querySelector('.card-show__time-icon'))))return 'badge covers timestamp';
     }
    }
    return document.documentElement.scrollWidth>innerWidth?'horizontal overflow':'OK';
   });
   if(layout!=='OK')throw Error(width+': '+layout);result.passed++;
   const dir=path.join(__dirname,'..','output','owner-restrictions');fs.mkdirSync(dir,{recursive:true});
   await page.screenshot({path:path.join(dir,width+'.png'),fullPage:true});
  }
  if(process.argv.length>=6){
   const html=process.argv.slice(2,6).map(file=>fs.readFileSync(file,'utf8'));
   const actual=await page.evaluate(({html,code})=>{
    return eval('(()=>{'+code+';const docs=html.map(x=>new DOMParser().parseFromString(x,"text/html"));return {trade:parseOwnerRestrictionPage(docs[0],"https://animesss.tv/trades/blacklist/"),blocked:parseOwnerRestrictionPage(docs[1],"https://animesss.tv/user/BETEP_B_TYMAHE/friends/blocked/"),owners:docs.slice(2).map(d=>({tiles:d.querySelectorAll("a.card-show__owner").length,valid:[...d.querySelectorAll("a.card-show__owner")].filter(a=>ownerNicknameFromHref(a.getAttribute("href"))).length,about:!![...d.querySelectorAll(".ncard__about")].find(e=>!e.closest(".not-found")&&/пользовател/i.test(e.textContent))}))};})()');
   },{html,code:['normalizeOwnerNickname','ownerNicknameFromHref','ownerRestrictionPageUrl','parseOwnerRestrictionPage','suiteDocumentIsGuest'].map(extract).join('\n')});
   if(actual.trade.names.length!==24||actual.trade.total!==109||actual.blocked.names.length!==20||actual.blocked.total!==20||actual.owners.some(x=>!x.tiles||x.tiles!==x.valid||!x.about))throw Error(JSON.stringify(actual));
   result.passed+=6;result.fixtures={tradeEntries:actual.trade.names.length,tradePages:[...new Set(actual.trade.pages)].length,blockedEntries:actual.blocked.names.length,owners:actual.owners};
  }
  if(errors.length)throw Error(errors.join('\n'));
  console.log(JSON.stringify({result:'OWNER_RESTRICTIONS_OK',...result}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
