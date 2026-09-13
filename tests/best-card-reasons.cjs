// Optional argument: captured lootbox__row outerHTML. Never runs captured scripts or loads site images.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');new vm.Script(source);
function extract(name){
 const m=new RegExp('^([ \\t]*)function '+name+'\\(','m').exec(source);if(!m)throw Error(name);
 const lines=source.slice(m.index).split(/\r?\n/);
 for(let n=1;n<=lines.length;n++)if(n===1||lines[n-1]===m[1]+'}'){
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }throw Error(name);
}
const names=['getBestCardDefaults','getBestCardSettingGroups','normalizeBestCardSettings','getBestCardPolicy','getBestCardPriorityValue','isBestCardRare','selectBestCardEntries','getActiveRow','highlightBestCard','syncBestCardHighlights','syncBestCardReasons','computeCardValue','getCardRank','isGoldSCard','parseStat','calcCardValue','calcBadCardValue','calcTradeSValue','getRareFactor','stretchToOne'];
const constants=source.slice(source.indexOf('  const rankMap ='),source.indexOf('  const todayKey ='));
const fallback='<div class="lootbox__row" data-pack-id="109030055"><div class="lootbox__title">Выберите одну карту из трёх</div><div class="lootbox__list">'+[[1696,7,220,1],[2720,75,462,0],[1110,5,168,1]].map((n,i)=>'<div class="lootbox__card cv-pack-valued" data-rank="'+['B','D','B'][i]+'" data-id="'+i+'"><img alt="Карта"><div class="card-stats">'+n.map(v=>'<span>'+v+'</span>').join('')+'<span class="card-value">★</span></div></div>').join('')+'</div></div>';
const html=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):fallback;
let passed=0;const check=(v,m)=>{assert.ok(v,m);passed++;};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:800},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.abort());
  await page.setContent('<style>body{background:#111;color:#ddd;font:14px Segoe UI;margin:24px}.packs-page{max-width:900px;margin:auto}.lootbox__title{text-align:center;font-size:20px;margin:35px 0 18px}.lootbox__list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.lootbox__card{position:relative;min-width:0;overflow:hidden;border-radius:12px}.lootbox__card>img{display:block;width:100%;aspect-ratio:288/432}.card-stats{position:absolute;left:0;right:0;bottom:0;display:grid;background:#202020}.pack-stat-short,.pack-stat-tiny{display:none}.card-stats span{text-align:center;font-size:11px}</style><div class="packs-page"></div>');
  await page.addStyleTag({content:source.match(/globalStyle\.textContent = `([\s\S]*?)`;/)[1]});
  await page.evaluate(html=>{
   const doc=new DOMParser().parseFromString(html,'text/html'),row=doc.querySelector('.lootbox__row');
   row.querySelectorAll('script,style,link,iframe,object,embed').forEach(el=>el.remove());
   row.querySelectorAll('*').forEach(el=>[...el.attributes].forEach(a=>{if(/^on|^(src|srcset|href|action)$/i.test(a.name))el.removeAttribute(a.name);}));
   row.querySelectorAll('img').forEach((img,i)=>img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="288" height="432"><rect width="288" height="432" fill="'+['#243955','#413238','#244347'][i]+'"/><text x="30" y="65" fill="#ddd" font-size="45">'+['B','D','B'][i]+'</text></svg>'));
   const stage=document.createElement('section');stage.className='packs-stage';stage.dataset.packState='ready';
   stage.append(row);document.querySelector('.packs-page').append(stage);
  },html);
  await page.evaluate(`const cfg={autoOpenEnabled:false,bestCardSettings:{custom:true,explain:true,unowned:'never'}};let bestCardPackState=null;
${constants}\n${names.map(extract).join('\n')}
window.api={cfg,highlight:highlightBestCard,sync:syncBestCardHighlights,compute:computeCardValue};highlightBestCard();`);
  check(await page.locator('.cv-best-reason').count()===1,'one visible reason');
  check(await page.locator('.cv-best-reason').innerText()==='Выше ценность','short reason from supplied example');
  check(await page.locator('.lootbox__list > .lootbox__card').count()===3,'no card wrappers or animation index changes');
  check(await page.evaluate(()=>document.querySelector('.lootbox__list').previousElementSibling.classList.contains('cv-best-reasons')),'reason row above cards');
  check(await page.evaluate(()=>{const mo=new MutationObserver(()=>{});mo.observe(document.querySelector('.lootbox__row'),{subtree:true,attributes:true,childList:true});api.highlight();const n=mo.takeRecords().length;mo.disconnect();return n===0;}),'repeated highlight has no DOM mutations');
  const out=path.join(__dirname,'..','output','best-card-reasons');fs.mkdirSync(out,{recursive:true});
  for(const width of [1100,768,430,390,360,320]){
   await page.setViewportSize({width,height:800});
   check(await page.evaluate(()=>{const a=document.querySelector('.cv-best-reason').getBoundingClientRect(),b=document.querySelector('.cv-best-card').getBoundingClientRect();return a.bottom<b.top&&Math.abs((a.left+a.right-b.left-b.right)/2)<1&&a.width<=b.width+1&&a.left>=0&&a.right<=innerWidth;}),'reason aligned outside card at '+width);
   await page.screenshot({path:path.join(out,width+'.png')});
   await page.evaluate(()=>api.sync([document.querySelectorAll('.lootbox__card')[0]],'Нет в наличии · Слабый пак: нет дублей'));
   check(await page.evaluate(()=>{const el=document.querySelector('.cv-best-reason'),a=el.getBoundingClientRect(),b=document.querySelector('.cv-best-card').getBoundingClientRect(),css=getComputedStyle(el);return el.scrollWidth<=el.clientWidth&&a.bottom<b.top&&a.left>=0&&a.right<=innerWidth&&css.backgroundColor!=='rgba(0, 0, 0, 0)'&&css.borderTopStyle==='solid';}),'long reason fits backed label at '+width);
   await page.screenshot({path:path.join(out,width+'-long.png')});
   await page.evaluate(()=>api.highlight());
  }
  const lifecycle=await page.evaluate(()=>{
   let checks=0;const ck=(v,m)=>{if(!v)throw Error(m);checks++;};
   const stage=document.querySelector('.packs-stage'),row=document.querySelector('.lootbox__row'),card=row.querySelector('.cv-best-card');
   const visible=()=>getComputedStyle(row.querySelector('.cv-best-reason')).visibility==='visible';
   const top=card.getBoundingClientRect().top;
   // Site changes stage synchronously in its selection handler. No helper refresh is called here.
   card.addEventListener('click',()=>stage.dataset.packState='choosing',{once:true});card.click();
   ck(!visible(),'manual click hides same frame');ck(card.getBoundingClientRect().top===top,'click does not shift cards');
   api.highlight();ck(!visible(),'redraw does not reveal chosen pack');
   stage.dataset.packState='ready';ck(visible(),'failed/cancelled choice can return to ready');
   for(const state of ['choosing','loading','idle','error']){stage.dataset.packState=state;ck(!visible(),'hide '+state);}
   stage.dataset.packState='ready';row.classList.add('loot-lock');ck(!visible(),'legacy selection lock hides immediately');
   row.classList.remove('loot-lock');ck(visible(),'unlock restores caption');
   const id=row.dataset.packId;row.removeAttribute('data-pack-id');ck(!visible(),'successful pick clears pack id');
   row.dataset.packId='';ck(!visible(),'empty pack id also hides');
   row.dataset.packId=id+'-next';api.highlight();ck(visible(),'next ready pack shows new reason');
   return checks;
  });passed+=lifecycle;
  await page.evaluate(()=>document.querySelector('.cv-best-card').addEventListener('click',()=>document.querySelector('.packs-stage').dataset.packState='choosing',{once:true}));
  await page.locator('.cv-best-card').tap();
  check(!await page.locator('.cv-best-reason').isVisible(),'touch selection hides caption immediately');
  await page.evaluate(()=>document.querySelector('.packs-stage').dataset.packState='ready');
  await page.evaluate(()=>{api.cfg.bestCardSettings.explain=false;api.highlight();});
  check(await page.locator('.cv-best-reasons').count()===0&&await page.locator('.cv-best-card').count()===1,'option off removes caption but keeps highlight');
  await page.evaluate(()=>{api.cfg.bestCardSettings.explain=true;api.highlight();});
  check(await page.locator('.cv-best-reason').count()===1,'option reenabled');
  await page.evaluate(()=>api.sync([document.querySelectorAll('.lootbox__card')[0]],'Приоритет A · Нет в наличии · Больше желающих'));
  check(await page.locator('.cv-best-reason').innerText()==='Приоритет A · Нет в наличии','visible caption limited to two reasons');
  check(await page.locator('.cv-best-reason').getAttribute('title')==='Приоритет A · Нет в наличии · Больше желающих','full reason retained');
  check(await page.locator('.cv-best-reasons > span').nth(0).getAttribute('class')==='cv-best-reason','caption follows new winner');
  await page.evaluate(()=>api.sync([...document.querySelectorAll('.lootbox__card')].slice(0,2),'Равенство: ручной выбор'));
  check(await page.locator('.cv-best-reason').count()===2,'each tied winner has caption');
  await page.evaluate(()=>api.sync([]));check(await page.locator('.cv-best-reasons').count()===0,'clear removes captions');
  await page.evaluate(()=>{api.cfg.bestCardSettings.custom=false;api.highlight();});
  check(await page.locator('.cv-best-reasons').count()===0,'default mode unchanged');
  check(errors.length===0,'no browser errors '+errors.join(';'));console.log('BEST_CARD_REASONS_OK '+passed);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
