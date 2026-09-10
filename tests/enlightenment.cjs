// Offline: node tests/enlightenment.cjs [clubs HTML]
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
function extract(name){
 const m=new RegExp('^([ \\t]*)function '+name+'\\(','m').exec(source),lines=source.slice(m.index).split(/\r?\n/);
 for(let n=2;n<=lines.length;n++)if(lines[n-1]===m[1]+'}'){
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }
 throw Error(name);
}
const html=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):'<section class="cg-daily"><div class="club-top-list__count"><div>Просветление 318 (+ 60 + 14)</div><div>Вкладов 2400</div><div>Время 21:03:29(470ms)</div></div></section>';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();await page.route('**/*',r=>r.abort());
  await page.evaluate(html=>{
   const doc=new DOMParser().parseFromString(html,'text/html');
   doc.querySelectorAll('script,iframe,link').forEach(e=>e.remove());
   doc.querySelectorAll('*').forEach(e=>[...e.attributes].filter(a=>/^on|^(src|srcset|style)$/i.test(a.name)).forEach(a=>e.removeAttribute(a.name)));
   document.body.append(...doc.body.childNodes);
  },html);
  const result=await page.evaluate(`(()=>{
   const cfg={modEnlightenment:true};
   ${['getEnlightenmentTotal','applyEnlightenment','cleanupEnlightenment'].map(extract).join('\n')}
   let passed=0;const check=(v,m)=>{if(!v)throw Error(m);passed++;};
   const nodes=[...document.querySelectorAll('.club-top-list__count > div')],original=nodes.map(n=>n.textContent);
   const expected=original.map(t=>t.startsWith('Просветление ')?'Просветление '+t.match(/\\d+/g).map(Number).reduce((a,b)=>a+b,0):t);
   cfg.modEnlightenment=false;applyEnlightenment();check(nodes.every((n,i)=>n.textContent===original[i]),'disabled does nothing');cfg.modEnlightenment=true;
   applyEnlightenment();nodes.forEach((n,i)=>check(n.textContent===expected[i],'fixture counter '+i));
   check(nodes[0].textContent==='Просветление 392','reported example fixed');
   check(nodes.filter(n=>n.dataset.enlightenmentOriginalText).length===original.filter(t=>t.startsWith('Просветление ')).length,'only enlightenment nodes marked');
   const observer=new MutationObserver(()=>{});observer.observe(document.body,{subtree:true,attributes:true,childList:true});
   applyEnlightenment();applyEnlightenment();check(observer.takeRecords().length===0,'repeat scan makes no changes');observer.disconnect();
   cleanupEnlightenment();check(nodes.every((n,i)=>n.textContent===original[i]),'all originals restored');
   check(!document.querySelector('[data-enlightenment-original-text],[data-enlightenment-rendered-text]'),'cleanup removes markers');
   const cases=[['Просветление 140 (+ 47)',187],['Просветление 0 (+ 0 + 0)',0],['Просветление 1 200 (+ 1 000 + 14)',2214],['Просветление 1\u00a0200 (+ 60 + 14)',1274],['Просветление 318',null],['Вкладов 2400',null],['Время 21:03:29(470ms)',null],['Просветление 318 (- 60)',null],['Просветление 318 (+ 60%)',null],['Просветление 318 (+ 60.5)',null],['Просветление 318 (+ 60) неизвестно',null],['Просветление 9007199254740991 (+ 1)',null]];
   cases.forEach(([t,n])=>check(getEnlightenmentTotal(t)===n,'parser '+t));
   applyEnlightenment();nodes[0].textContent='Просветление 400 (+ 60 + 20)';applyEnlightenment();check(nodes[0].textContent==='Просветление 480','live node update resummed');
   cleanupEnlightenment();check(nodes[0].textContent==='Просветление 400 (+ 60 + 20)','cleanup uses latest original');
   applyEnlightenment();nodes[0].textContent='Просветление 500';cleanupEnlightenment();check(nodes[0].textContent==='Просветление 500','cleanup never overwrites fresh site value');
   const extra=document.createElement('section');extra.className='nclub__top-carou nclub__sect';extra.innerHTML='<div class="club-top-list__count"><div>Просветление 100 (+ 2 + 3)</div></div>';document.body.append(extra);
   applyEnlightenment();check(extra.textContent==='Просветление 105','legacy container still supported alongside new');
   const fresh=document.createElement('div');fresh.className='club-top-list__count';fresh.innerHTML='<div>Просветление 35 (+ 31 + 1)</div>';document.querySelector('.cg-daily').append(fresh);
   applyEnlightenment();check(fresh.textContent==='Просветление 67','new carousel items processed');
   const malformed=document.createElement('div');malformed.innerHTML='<span>Просветление 1 (+ ?)</span>';fresh.append(malformed);applyEnlightenment();check(!!malformed.querySelector('span')&&!malformed.dataset.enlightenmentOriginalText,'unknown markup left intact');
   return {passed,cards:original.filter(t=>t.startsWith('Просветление ')).length};
  })()`);
  console.log(JSON.stringify({result:'ENLIGHTENMENT_OK',...result}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
