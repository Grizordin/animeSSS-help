// Real suggestion module and browser layout, with offline GM/API fixtures.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
function extract(name){
 const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(source);assert.ok(m,name);
 const lines=source.slice(m.index).split(/\r?\n/);
 for(let n=2;n<=lines.length;n++)if(lines[n-1]===m[1]+'}'){
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }throw Error(name);
}
const palette=source.match(/const RANK_COLORS = (\{[\s\S]*?\});/)[1];
let checks=0;function ok(v,m){assert.ok(v,m);checks++;}
const ctx={};vm.runInNewContext(`const RANK_COLORS=${palette};${extract('suggestionRibbonColors')};this.colors=suggestionRibbonColors;this.palette=RANK_COLORS`,ctx);
function lum(hex){const c=hex.slice(1).match(/../g).map(x=>{const v=parseInt(x,16)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
for(const [rank,bg] of Object.entries(ctx.palette)){
 const color=ctx.colors(rank);ok(color.bg===bg,rank+' palette');
 ok((Math.max(lum(bg),lum(color.fg))+.05)/(Math.min(lum(bg),lum(color.fg))+.05)>=4.5,rank+' contrast');
}
ok(ctx.colors(' a+ ').bg===ctx.palette.A_PLUS,'rank normalization');
ok(ctx.colors('__proto__').bg==='#475569','unknown safe fallback');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1150,height:760}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.fulfill({body:'<!doctype html><html><head></head><body></body></html>',contentType:'text/html'}));
  await page.goto('https://animesss.tv/collections/');
  await page.evaluate(`
   var cfg={modSuggestionAuthors:true},RANK_COLORS=${palette};
   var storage={},writes=[],requests=[],nick='Tester';
   var gmStoreGet=(k,d)=>k in storage?structuredClone(storage[k]):d;
   var gmStoreSet=(k,v)=>{storage[k]=structuredClone(v);writes.push(k);};
   var suiteGetCurrentUserName=()=>nick,suiteKeepInViewport=()=>{};
   var GM_xmlhttpRequest=o=>requests.push(o);
   var image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="220"><rect width="160" height="220" fill="#20334b"/><text x="10" y="25" fill="white">RANK</text></svg>');
   var cards=Array.from({length:40},(_,i)=>({card_id:40-i,rank:['s','a','b','c','d','e'][i%6],image,name:'Карта '+(40-i),author:'Автор'}));
   var cacheKey='suite_suggestion_authors_cache_v1';
   var d=new Date(),hour=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'-'+String(d.getHours()).padStart(2,'0');
   storage[cacheKey]={cards,lastHourKey:hour};
   ${extract('cleanupSuggestionAuthors')}
   ${extract('initSuggestionAuthors')}
   initSuggestionAuthors();
  `);
  const click=selector=>page.evaluate(s=>document.querySelector(s).click(),selector);
  const seen=()=>page.evaluate(()=>Object.keys(storage).filter(k=>k.startsWith('suite_suggestion_seen_v1:')));
  await page.waitForTimeout(120);
  ok((await seen()).length===0,'closed modal does not mark cards');
  ok(await page.evaluate(()=>requests.length===0),'cached initial display has no extra requests');
  await click('#suite-suggestion-authors-button');
  await page.waitForFunction(()=>storage['suite_suggestion_seen_v1:tester:40']===true);
  const initial=await seen();
  ok(initial.length>0&&initial.length<40,'only visible loaded cards seen');
  ok(await page.locator('[data-card-id="40"] .suite-suggestion-new').count()===1,'NEW stays for current viewing');
  ok(!initial.includes('suite_suggestion_seen_v1:tester:1'),'offscreen card not seen');
  ok(await page.evaluate(()=>{
   const tile=document.querySelector('[data-card-id="40"]'),art=tile.querySelector('.suite-suggestion-art'),r=tile.querySelector('.suite-suggestion-new');
   const a=art.getBoundingClientRect(),b=r.getBoundingClientRect(),author=tile.querySelector('.suite-suggestion-author').getBoundingClientRect();
   return getComputedStyle(art).overflow==='hidden'&&getComputedStyle(r).transform!=='none'&&b.left>a.left+80&&b.top<a.top+30&&b.bottom<author.top;
  }),'ribbon clipped top right, away from rank and author');
  await page.addStyleTag({content:await page.evaluate(`(()=>{${extract('suiteBuildLightThemeCss')};return suiteBuildLightThemeCss();})()`)});
  fs.mkdirSync(path.join(root,'tmp'),{recursive:true});
  await page.screenshot({path:path.join(root,'tmp','suggestion-new-light.png')});
  await page.evaluate(()=>document.body.classList.add('dt-is-active'));
  await page.screenshot({path:path.join(root,'tmp','suggestion-new-dark.png')});
  await click('.suite-suggestion-close');await click('#suite-suggestion-authors-button');
  ok(await page.locator('[data-card-id="40"] .suite-suggestion-new').count()===0,'reopen hides seen ribbon');
  ok(await page.locator('[data-card-id="1"] .suite-suggestion-new').count()===1,'reopen retains unseen ribbon');
  await page.evaluate(()=>document.querySelector('.suite-suggestion-grid').scrollTop=100000);
  await page.waitForFunction(()=>storage['suite_suggestion_seen_v1:tester:1']===true);
  ok(true,'scroll marks newly visible cards');
  await click('.suite-suggestion-refresh');await click('.suite-suggestion-refresh');
  ok(await page.evaluate(()=>requests.length===1),'refresh single flight');
  await click('[data-rank="a"]');
  await page.evaluate(()=>requests.shift().onload({status:200,responseText:JSON.stringify({cards:[{cardId:100,rank:'b',image,name:'New',author:'Test'},...cards]})}));
  await page.waitForFunction(()=>storage[cacheKey].cards[0].cardId===100);
  ok(await page.evaluate(()=>storage[cacheKey].rank==='a'),'refresh preserves changed filter');
  ok(!(await seen()).includes('suite_suggestion_seen_v1:tester:100'),'filtered out card not seen');
  await click('[data-rank="b"]');
  await page.waitForFunction(()=>storage['suite_suggestion_seen_v1:tester:100']===true);
  ok(await page.locator('[data-card-id="100"] .suite-suggestion-new').count()===1,'new refresh card gets ribbon, alias ID supported');
  await page.evaluate(()=>{cleanupSuggestionAuthors();initSuggestionAuthors();});
  await click('#suite-suggestion-authors-button');
  ok(await page.locator('[data-card-id="100"] .suite-suggestion-new').count()===0,'history survives module restart');
  await page.evaluate(()=>{cleanupSuggestionAuthors();nick='Other';initSuggestionAuthors();});
  await click('#suite-suggestion-authors-button');
  await page.waitForFunction(()=>storage['suite_suggestion_seen_v1:other:100']===true);
  ok(await page.locator('[data-card-id="100"] .suite-suggestion-new').count()===1,'history isolated by account');
  await page.evaluate(()=>{storage[cacheKey].lastManualRefreshAt=0;});
  await click('.suite-suggestion-refresh');
  await page.evaluate(()=>{cleanupSuggestionAuthors();requests.shift().onload({status:200,responseText:JSON.stringify({cards:[]})});});
  await page.waitForTimeout(50);
  ok(await page.evaluate(()=>storage[cacheKey].cards.length===41),'late response after cleanup cannot overwrite cache');
  ok(errors.length===0,'no browser errors: '+errors.join('; '));
  console.log('SUGGESTION_NEW_OK '+checks+' checks');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
