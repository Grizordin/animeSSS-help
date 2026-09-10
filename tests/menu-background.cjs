// node tests/menu-background.cjs [menu HTML] [site CSS]
// Site scripts and network are never executed. Optional files enable real-layout checks.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
function extract(name){
 const m=new RegExp('^([ \\t]*)function '+name+'\\(','m').exec(source),lines=source.slice(m.index).split(/\r?\n/);
 for(let n=2;n<=lines.length;n++)if(lines[n-1]===m[1]+'}'){
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }
 throw Error(name);
}
const helperCSS=source.match(/globalStyle\.textContent = `([\s\S]*?)`;/)[1];
const html=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):`<div class="ap-scroll lgn__inner"><aside class="ap-scene ap-profile-scene"><div class="ap-profile-bg"><video id="profilebg"><source src="/test.webm"></video></div><h2>Nickname</h2><a class="ap-profile-action ap-profile-action--main" href="/cards/">Мои карты</a></aside><section class="ap-panel ap-profile-panel"><header class="ap-heading"><h2>С возвращением</h2></header><a class="ap-menu-link" href="/club/">Мой клуб</a><footer class="ap-panel-footer"><button class="ap-effect-btn">Эффекты включены</button></footer></section></div>`;
const nativeCSS=process.argv[3]?fs.readFileSync(process.argv[3],'utf8'):`.ap-modal{position:relative;width:94vw;max-width:940px;margin:auto;background:#1c1a21;color:#eee}.ap-scroll{display:grid;grid-template-columns:286px 1fr;overflow-y:auto;max-height:80vh}.ap-scene,.ap-panel{position:relative;padding:30px;background:#211621}.ap-panel{background:#1c1a21;min-height:600px}.ap-profile-bg{position:absolute;inset:0;z-index:-1}.ap-profile-bg video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.ap-profile-bg::after{content:'';position:absolute;inset:0;background:#0008}.ap-menu-link{display:block;background:#25222b;border:1px solid #3d3441;border-radius:11px;padding:8px;color:#eee}.ap-profile-action--main{display:block;background:#ead3c3;color:#3e2c38;border:1px solid #ead3c3;border-radius:11px;padding:8px}.ap-effect-btn{background:transparent;color:#bbb;border:0}@media(max-width:700px){.ap-scroll{display:block}}`;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});let total=0;
 try{
  for(const width of [1200,390]){
   const page=await browser.newPage({viewport:{width,height:800}});await page.route('**/*',r=>r.abort());
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.setContent('<style>body{margin:0;background:#111;font-family:Arial}*{box-sizing:border-box}</style><div class="ap-modal lgn is-active" data-theme="dark"><button class="login__close ap-close">×</button></div>');
   await page.addStyleTag({content:nativeCSS});await page.addStyleTag({content:helperCSS});
   if(!process.argv[3])await page.addStyleTag({content:'.ap-close{position:absolute;right:12px;top:12px;z-index:15}'});
   await page.evaluate(({html})=>{
    const doc=new DOMParser().parseFromString(html,'text/html');
    doc.querySelectorAll('script,iframe,link').forEach(e=>e.remove());
    doc.querySelectorAll('*').forEach(e=>[...e.attributes].filter(a=>/^on|^(src|srcset)$/i.test(a.name)).forEach(a=>e.removeAttribute(a.name)));
    document.querySelector('.lgn').append(doc.querySelector('.lgn__inner'));
    const video=document.querySelector('video');
    video.poster='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><defs><linearGradient id="g"><stop stop-color="#84334d"/><stop offset="1" stop-color="#28576c"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><circle cx="750" cy="200" r="280" fill="#b98054" opacity=".5"/></svg>');
   },{html});
   const result=await page.evaluate(`(()=>{
    const cfg={modMenuBg:true,menuBgDim:.42,menuTextClarity:.75},DEFAULT_SETTINGS=cfg,menuBackgroundOrigins=new WeakMap();
    ${['applyMenuBgTuning','applyMenuBackground','cleanupMenuBackground'].map(extract).join('\n')}
    let passed=0;const check=(v,m)=>{if(!v)throw Error(m);passed++;};
    const modal=document.querySelector('.lgn'),wrapper=modal.querySelector('.lgn__inner'),video=modal.querySelector('video'),layer=video.parentElement,parent=layer.parentElement,next=layer.nextSibling;
    let plays=0;video.play=()=>{plays++;return Promise.resolve();};
    const controls=[...modal.querySelectorAll('a,button')];
    const snapshot=()=>controls.map(e=>{const s=getComputedStyle(e);return [e.textContent,e.getAttribute('href'),s.backgroundColor,s.backgroundImage,s.borderColor,s.borderRadius,s.color,s.padding,s.height];});
    const before=snapshot(),columns=getComputedStyle(wrapper).gridTemplateColumns;
    let clicks=0;controls[0].addEventListener('click',()=>clicks++);
    applyMenuBackground();
    check(layer.parentElement===modal&&video.parentElement===layer,'native video holder lifted intact');
    check(modal.querySelectorAll('#profilebg').length===1,'no video cloning');
    check(plays===0&&!video.autoplay,'native media controls not overridden');
    check(modal.querySelectorAll('.ap-profile-bg video').length===1,'site selector still finds video');
    check(JSON.stringify(before)===JSON.stringify(snapshot()),'native control appearance preserved '+JSON.stringify(snapshot().map((v,i)=>JSON.stringify(v)!==JSON.stringify(before[i])?{before:before[i],after:v}:null).filter(Boolean)));
    check(getComputedStyle(wrapper).gridTemplateColumns===columns,'native layout preserved');
    check(getComputedStyle(wrapper).overflowY==='auto','native scrolling preserved');
    check(getComputedStyle(parent).backgroundColor==='rgba(0, 0, 0, 0)'&&getComputedStyle(wrapper.querySelector('.ap-panel')).backgroundColor==='rgba(0, 0, 0, 0)','both panel backgrounds transparent');
    const covers=()=>{const a=video.getBoundingClientRect(),b=wrapper.getBoundingClientRect();return Math.abs(a.left-b.left)<2&&Math.abs(a.top-b.top)<2&&a.width>=b.width-1&&a.height>=b.height-1;};
    check(covers(),'video covers complete menu');
    wrapper.scrollTop=wrapper.scrollHeight;check(covers(),'background remains full at bottom of scroll');
    const closeRect=controls[0].getBoundingClientRect();
    const hit=document.elementFromPoint(closeRect.x+closeRect.width/2,closeRect.y+closeRect.height/2);
    check(hit?.closest('button')===controls[0],'close control remains above media '+JSON.stringify({rect:closeRect,hit:hit?.outerHTML.slice(0,200),visibility:getComputedStyle(modal).visibility,pointer:getComputedStyle(controls[0]).pointerEvents}));
    controls[0].click();check(clicks===1,'existing click handler preserved');
    const observer=new MutationObserver(()=>{});observer.observe(modal,{subtree:true,childList:true,attributes:true});
    applyMenuBackground();applyMenuBackground();check(observer.takeRecords().length===0,'repeated apply causes no DOM churn');observer.disconnect();
    const heading=wrapper.querySelector('.ap-heading h2');cfg.menuTextClarity=0;applyMenuBgTuning(wrapper);const low=getComputedStyle(heading).textShadow;
    cfg.menuTextClarity=1;cfg.menuBgDim=.1;applyMenuBackground();
    check(low!==getComputedStyle(heading).textShadow,'clarity responds to settings');
    check(layer.style.getPropertyValue('--suite-menu-bg-dim')==='0.10','dimming reaches full-menu layer');
    cleanupMenuBackground();
    check(layer.parentElement===parent&&layer.nextSibling===next,'disable restores exact native location');
    check(!modal.classList.contains('tm-fullbg-host')&&!wrapper.classList.contains('tm-fullbg-ready')&&!layer.classList.contains('tm-menu-bg-layer'),'disable cleans classes');
    check(!wrapper.style.getPropertyValue('--suite-menu-text-weight'),'disable cleans tuning');
    check(JSON.stringify(before)===JSON.stringify(snapshot()),'native control appearance restored');
    cfg.modMenuBg=false;applyMenuBackground();check(layer.parentElement===parent,'disabled module does nothing');
    cfg.modMenuBg=true;applyMenuBackground();check(layer.parentElement===modal&&plays===0,'reenable keeps same native video');
    wrapper.scrollTop=0;
    return {passed};
   })()`);
   total+=result.passed;
   if(process.argv[3]){const folder=path.join(root,'output','menu-background');fs.mkdirSync(folder,{recursive:true});await page.locator('.lgn').screenshot({path:path.join(folder,'menu-'+width+'.png')});}
   await page.close();
  }
  const legacy=await browser.newPage();
  total+=await legacy.evaluate(`(()=>{
   const cfg={modMenuBg:true,menuBgDim:.42,menuTextClarity:.75},DEFAULT_SETTINGS=cfg,menuBackgroundOrigins=new WeakMap();
   ${['applyMenuBgTuning','applyMenuBackground','cleanupMenuBackground'].map(extract).join('\n')}
   let passed=0;const check=(v,m)=>{if(!v)throw Error(m);passed++;};
   document.body.innerHTML='<div class="lgn is-active"><div class="lgn__inner" style="color:red"><div class="lgn__ava-holder"><span>Before</span><video id="profilebg"></video><span>After</span></div><div class="lgn__menus">Links</div></div></div>';
   const wrapper=document.querySelector('.lgn__inner'),video=document.querySelector('video'),parent=video.parentNode,next=video.nextSibling;
   applyMenuBackground();check(video.parentNode===wrapper,'legacy video expands');
   cfg.menuBgDim=.2;applyMenuBackground();check(wrapper.style.getPropertyValue('--suite-menu-bg-dim')==='0.20','legacy tuning works after move');
   check(document.querySelectorAll('video').length===1,'legacy no duplicate');
   cleanupMenuBackground();check(video.parentNode===parent&&video.nextSibling===next,'legacy exact placement restored');
   check(wrapper.style.color==='red','unrelated inline styles preserved');
   check(!wrapper.classList.contains('tm-fullbg-ready'),'legacy marker removed');
   check(!video.hasAttribute('style'),'cleanup leaves no empty style attribute');
   cfg.modMenuBg=false;applyMenuBackground();check(video.parentNode===parent,'legacy disabled remains native');
   return passed;
  })()`);
  await legacy.close();
  console.log(JSON.stringify({result:'MENU_BACKGROUND_OK',passed:total,realFixture:!!process.argv[3]}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
