// Offline profile controls: mobile/zoomed viewport, desktop preservation and cleanup.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
const css=source.match(/globalStyle\.textContent = `([\s\S]*?)`;/)[1];
const start=source.indexOf('  function addProfileButtons(){');
const functions=source.slice(start,source.indexOf('  // ============================================================',start));
new vm.Script(functions);
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});let passed=0;
 try{
  for(const [name,width,mobile] of [['desktop',1200,false],['desktop-narrow',390,false],['phone',390,true],['phone-zoomed-out',980,true],['phone-landscape',844,true]]){
   const page=await browser.newPage({viewport:{width,height:800},isMobile:mobile,hasTouch:mobile});
   await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width, initial-scale=1">'}):r.abort());
   await page.goto('https://offline.test/user/Test/');
   await page.addStyleTag({content:'*{box-sizing:border-box}body{margin:16px;background:#111;color:#ddd;font-family:Arial}.profile{padding:20px;border:1px solid #303030;border-radius:18px;background:#1b1b1b}.usn-sect__header{display:flex;align-items:center;flex-wrap:wrap;gap:10px}.usn-sect__title{color:inherit;text-decoration:none;font-size:18px;display:inline-flex;align-items:center;gap:8px}.fal{width:26px;height:30px;border-radius:8px;background:#301821;flex-shrink:0}.cards{margin-top:20px;height:160px;background:#242126;border-radius:12px}'});
   await page.addStyleTag({content:css});
   await page.evaluate(()=>{
    document.body.innerHTML='<section class="profile"><header class="usn-sect__header d-flex ai-center c-gap-10 r-gap-10"><a class="usn-sect__title" href="/user/cards/?name=Test%20%26%20User"><span class="fal fa-yin-yang"></span>Коллекция карт</a></header><div class="cards">Карты</div></section><div id="unrelated" class="usn-sect__header d-flex ai-center c-gap-10 r-gap-10"><a class="usn-sect__title">Другой блок</a></div>';
   });
   const result=await page.evaluate(({functions,mobile})=>new Function('mobile',`
    const cfg={modProfileBtns:true};${functions}
    let passed=0;const check=(v,m)=>{if(!v)throw Error(m);passed++;};
    const header=document.querySelector('.profile header'),native=header.firstElementChild,other=document.querySelector('#unrelated');
    const paint=e=>{const s=getComputedStyle(e);return [s.flexDirection,s.alignItems,s.marginLeft,s.width].join('|');};
    const before=paint(header),nativeBefore=native.outerHTML,otherBefore=paint(other);
    addProfileButtons();addProfileButtons();
    const links=[...header.querySelectorAll('a')],rects=links.map(e=>e.getBoundingClientRect());
    check(links.length===5,'no duplicates');check(native.outerHTML===nativeBefore,'native link intact');
    check(paint(other)===otherBefore&&!other.classList.contains('suite-profile-buttons'),'unrelated blocks untouched');
    check(window.matchMedia('(hover:none) and (pointer:coarse)').matches===mobile,'expected pointer mode');
    check(links.map(e=>e.textContent.trim()).join('|')==='Коллекция карт|Открытые S|Желаемое|На модерации|Замены','link order');
    check(new URL(links[1].href).searchParams.get('name')==='Test & User','encoded username preserved');
    check(new URL(links[1].href).searchParams.get('rank')==='s'&&new URL(links[2].href).searchParams.get('in_list')==='1','filter URLs preserved');
    check(links[3].pathname.includes('/Test%20%26%20User/cards_created/')&&links[4].pathname.includes('/Test%20%26%20User/cards_replacements/'),'moderation and replacement URLs preserved');
    if(mobile){
     check(getComputedStyle(header).flexDirection==='column','mobile column');
     check(rects.every(r=>Math.abs(r.left-rects[0].left)<.1),'all links share the same left edge');
     check(rects.every((r,i)=>!i||r.top>=rects[i-1].bottom),'one link per row');
     check(links.every(e=>getComputedStyle(e).marginLeft==='0px'&&getComputedStyle(e).marginRight==='0px'),'no mobile horizontal margins');
     check(rects.every(r=>r.right<=header.getBoundingClientRect().right+.1),'no overflow');
    }else{
     check(paint(header)===before,'desktop header unchanged');
     check(links.slice(1).map(e=>getComputedStyle(e).marginLeft).join(',')==='40px,55px,55px,55px','desktop margins unchanged');
    }
    cleanupProfileButtons();
    check(header.children.length===1&&!header.classList.contains('suite-profile-buttons'),'cleanup removes links and marker');
    check(paint(header)===before&&native.outerHTML===nativeBefore,'native layout restored');
    cfg.modProfileBtns=false;addProfileButtons();check(header.children.length===1&&!header.classList.contains('suite-profile-buttons'),'disabled module leaves native layout');
    cfg.modProfileBtns=true;addProfileButtons();check(header.children.length===5,'reenable restores exactly four links');
    return passed;
   `)(mobile),{functions,mobile});
   passed+=result;
   if(name==='phone'||name==='desktop'){
    const dir=path.join(__dirname,'..','output','profile-buttons');fs.mkdirSync(dir,{recursive:true});
    await page.locator('.profile').screenshot({path:path.join(dir,name+'.png')});
   }
   await page.close();
  }
  console.log(JSON.stringify({result:'PROFILE_BUTTONS_OK',passed}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
