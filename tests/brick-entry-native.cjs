// Run with captured brick page HTML: executes only its named filter functions.
// All AJAX responses are in-memory; no real cards or authenticated network.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright');
if(!process.argv[2])throw Error('Usage: node tests/brick-entry-native.cjs <captured-brick-page.html>');
const helper=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
const site=fs.readFileSync(process.argv[2],'utf8');
function extract(src,name){
 const m=new RegExp('^([ \\t]*)function '+name+'\\(','m').exec(src);
 if(!m)throw Error(name);const lines=src.slice(m.index).split(/\r?\n/);
 for(let n=1;n<=lines.length;n++){
  if(n>1&&lines[n-1]!==m[1]+'}')continue;
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }throw Error(name);
}
const code=['number','integer','invalidateFilter','setPagination','CelestianFilterAjax'].map(n=>extract(site,n)).join('\n')+'\n'+['getPageSelect','getLastPage','getCurrentPage','initBrickEntryPage'].map(n=>extract(helper,n)).join('\n');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});let passed=0;
 try{
  const page=await browser.newPage();await page.route('**/*',r=>r.abort());
  for(const scenario of ['stale','empty','late-init','wrong-page']){
   await page.setContent('<main id="celestialForge" data-initialized="true" data-filter-busy="false"><button class="stone__rank-item--active" data-rank=""></button><button class="stone__lock-item--active" data-locked="0"></button><input id="stone_search" value=""><select id="cg-stone-sort"><option value="date">Date</option></select><div id="cg-inventory"><div class="stone__inventory-list">Initial</div></div><div id="prev_filter_page"><button></button></div><div id="next_filter_page"><button></button></div><div id="info_filter_page"><span>1 / 286</span></div><select id="choose_stone_filter_page"><option value="1">1</option><option value="286">286</option></select></main>');
   const result=await page.evaluate(async({code,scenario})=>{
    const run=new (Object.getPrototypeOf(async function(){}).constructor)('scenario',`
     const root=document.getElementById('celestialForge'),inventory=root.querySelector('.stone__inventory-list');
     const qs=s=>root.querySelector(s),put=(s,v)=>{qs(s).textContent=v;};
     let filtering=false,filterVersion=0,filterRequest=null,currentPage=1;
     const canChange=()=>true,notice=()=>{},prepareInventory=()=>{};
     const refreshControls=()=>{root.dataset.filterBusy=String(filtering);qs('#choose_stone_filter_page').disabled=filtering||!qs('#choose_stone_filter_page').options.length;};
     const calls=[],issues=[],brickCleanup=[],brickAbort=new AbortController();let brickBusy=false,brickTradePending=false;
     const getPageWindow=()=>window,suiteSelfDiagnosticIssue=(module,code,data)=>issues.push([module,code,{...data,error:data.error?.message}]),dle_login_hash='fixture-only';
     const $=el=>({html:v=>{el.innerHTML=v;}});
     $.ajax=opts=>{calls.push({...opts.data});const id=setTimeout(()=>{const target=scenario==='wrong-page'&&opts.data.page>1?1:opts.data.page;opts.success({count_pages:3,this_page:target,prev_page:target>1?target-1:false,next_page:target<3?target+1:false,html:'<div class="stone__inventory-item">Page '+target+'</div>'});opts.complete();},20);return {abort:()=>clearTimeout(id)};};
     ${code}
     window.CelestianFilterAjax=CelestianFilterAjax;
     if(scenario==='empty'){qs('#info_filter_page span').textContent='0 / 0';qs('#choose_stone_filter_page').replaceChildren();qs('#choose_stone_filter_page').disabled=true;}
     if(scenario==='late-init'){root.dataset.initialized='false';setTimeout(()=>root.dataset.initialized='true',500);}
     initBrickEntryPage();await new Promise(r=>setTimeout(r,1200));brickCleanup.forEach(fn=>fn());
     return {calls,issues,counter:qs('#info_filter_page').textContent,html:inventory.textContent};
    `);
    return run(scenario);
   },{code,scenario});
   const check=(v,m)=>{if(!v)throw Error(scenario+': '+m+' '+JSON.stringify(result));passed++;};
   check(result.calls.map(c=>c.page).join()==='1,3','only refresh and actual last page requested');
   check(result.calls.every(c=>c.action==='search_stone'&&c.rank===''&&c.locked==='0'&&c.search===''&&c.sort==='date'),'native filter parameters preserved');
   check(scenario==='wrong-page'?result.issues.length===1:result.issues.length===0,'confirmation diagnostics');
   check(result.counter===(scenario==='wrong-page'?'1 / 3':'3 / 3'),'rendered page verified');
  }
  console.log('BRICK_ENTRY_NATIVE_OK; assertions='+passed);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
