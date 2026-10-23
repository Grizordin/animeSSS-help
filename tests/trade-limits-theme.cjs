// Offline CSS regression: real tracker styles, synthetic owner markup, no site requests.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'AnimeSSS_trade_limits.user.js'),'utf8');
const start=source.indexOf('  const CSS=`'),end=source.indexOf('  function node(',start);
assert.ok(start>=0&&end>start);
const ctx={};vm.runInNewContext(source.slice(start,end)+';this.styles=CSS;',ctx);
let checks=0;const ok=(value,label)=>{assert.ok(value,label);checks++;};
const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);
const luminance=c=>c.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:720}});let requests=0;
  await page.route('**/*',r=>{requests++;return r.abort();});await page.goto('about:blank');
  const tile=(color,checking=false,numbers=false)=>`<a href="#" class="card-show__owner astl-tile astl-${color}${checking?' astl-checking':''} card-show__owner--online"><span class="avatar">${color[0].toUpperCase()}</span><span class="card-show__owner-name">${checking?'Уточняется':{green:'Свободно',yellow:'Ожидает',red:'Лимит'}[color]}</span><span class="astl-mark">${numbers?(color==='green'?'1/3':'0/3'):'<i class="astl-dot red"></i><i class="astl-dot yellow"></i><i class="astl-dot green"></i>'}</span><span class="native-badge">♟</span></a>`;
  await page.setContent(`<style>body{margin:24px;background:white;color:#111;font:14px Arial}body.dle_theme_dark,body.dt-is-active,body[data-theme=dark]{background:#151515;color:#ddd}.grid{display:grid;grid-template-columns:repeat(3,140px);gap:18px}.card-show__owner{position:relative;display:flex;flex-direction:column;align-items:center;width:140px;padding:10px;border:1px solid #777;border-radius:14px;background:#eee;text-decoration:none;color:inherit}.card-show__owner-name{color:inherit}.avatar{display:grid;place-items:center;width:44px;height:44px;border-radius:9px;background:linear-gradient(135deg,#556ab0,#ac6290);color:white;font-size:24px;margin-bottom:8px}.native-badge{position:absolute;right:-5px;top:-5px;background:#c12d3a;color:white;border-radius:50%;padding:3px}.native{background:linear-gradient(120deg,#604372,#243046);color:#fff}</style><h2>Лимиты обменов</h2><div class="grid">${['green','yellow','red'].map(c=>tile(c)).join('')}${['green','yellow','red'].map(c=>tile(c,true,true)).join('')}</div><div style="margin-top:24px" class="grid"><a class="card-show__owner astl-tile native" id="awakened"><span class="card-show__owner-name">Пробуждение</span><span class="astl-mark">2/3</span></a><a class="card-show__owner" id="plain"><span class="card-show__owner-name">Без модуля</span></a><a class="leaderboard-top__item" id="podium">Пьедестал</a></div>`);
  const snapshot=selector=>page.locator(selector).evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundImage,color:s.color,border:s.borderColor,shadow:s.boxShadow};});
  const nativeBefore=await snapshot('#awakened'),plainBefore=await snapshot('#plain'),podiumBefore=await snapshot('#podium');
  await page.addStyleTag({content:ctx.styles});
  const inspect=()=>page.locator('.astl-green,.astl-yellow,.astl-red').evaluateAll(els=>els.map(el=>{
   const s=getComputedStyle(el),name=getComputedStyle(el.querySelector('.card-show__owner-name')),mark=getComputedStyle(el.querySelector('.astl-mark'));
   return {background:s.backgroundImage,color:name.color,numbers:mark.color,dots:[...el.querySelectorAll('.astl-dot')].map(d=>getComputedStyle(d).backgroundColor),border:s.borderColor,shadow:s.boxShadow,animation:s.animationName,badge:getComputedStyle(el.querySelector('.native-badge')).color};
  }));
  const light=await inspect();
  for(const [i,t] of light.entries()){
   const stops=[...t.background.matchAll(/rgb\([^)]+\)/g)].map(m=>rgb(m[0]));
   ok(stops.length>=2,'gradient present '+i);
   ok(stops.every(c=>luminance(c)>.55),'light background '+i);
   ok(stops.every(c=>contrast(rgb(t.color),c)>=4.5),'nickname contrast '+i);
   ok(stops.every(c=>contrast(rgb(t.numbers),c)>=4.5),'number contrast '+i);
   for(const dot of t.dots)ok(stops.every(c=>contrast(rgb(dot),c)>=3),'dot contrast '+i+' '+dot);
   ok(t.border==='rgb(7, 132, 73)'&&t.shadow.includes('inset'),'light online border '+i);
   ok(t.badge==='rgb(255, 255, 255)','native badge untouched '+i);
   if(i>=3)ok(t.animation==='astl-check'&&t.background.includes('247, 199, 134'),'light orange shimmer '+i);
  }
  for(const marker of ['data-theme','dle_theme_dark','dt-is-active']){
   await page.evaluate(marker=>{document.body.className='';document.body.removeAttribute('data-theme');if(marker==='data-theme')document.body.dataset.theme='dark';else document.body.classList.add(marker);},marker);
   const dark=await inspect();
   ok(dark[0].background.includes('24, 35, 31'),'dark background via '+marker);
   ok(dark[0].dots[2]==='rgb(76, 221, 150)','dark dots unchanged via '+marker);
   ok(dark[0].border==='rgb(136, 255, 189)','dark online border unchanged via '+marker);
  }
  fs.mkdirSync(path.join(root,'tmp'),{recursive:true});
  await page.screenshot({path:path.join(root,'tmp','trade-limits-dark-theme.png')});
  await page.evaluate(()=>{document.body.className='';document.body.removeAttribute('data-theme');});
  ok(JSON.stringify(await inspect())===JSON.stringify(light),'switch back to light without rerender or reload');
  for(const [selector,before] of [['#awakened',nativeBefore],['#plain',plainBefore],['#podium',podiumBefore]])ok(JSON.stringify(await snapshot(selector))===JSON.stringify(before),'native surface unchanged '+selector);
  await page.screenshot({path:path.join(root,'tmp','trade-limits-light-theme.png')});
  await page.setViewportSize({width:390,height:760});
  await page.addStyleTag({content:'.grid{grid-template-columns:repeat(2,140px)}'});
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile width unchanged');
  ok(requests===0,'theme changes need no requests');
  console.log('TRADE_LIMITS_THEME_OK '+checks+' checks');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
