// Offline rendering of real helper CSS, real stats markup and representative
// module fixtures. No site scripts, account data or external requests.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
function extract(name){
 const m=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(source);assert.ok(m,name);
 const lines=source.slice(m.index).split(/\r?\n/);
 try{new vm.Script('('+lines[0]+')');return lines[0];}catch{}
 for(let n=2;n<=lines.length;n++)if(lines[n-1]===m[1]+'}'){
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }throw Error(name);
}
const ctx={};vm.runInNewContext(extract('suiteBuildLightThemeCss')+';this.css=suiteBuildLightThemeCss();',ctx);
const pushStyleContext={document:{createElement:()=>({}),head:{appendChild:s=>{pushStyleContext.css=s.textContent;}}}};
const cardRankPalette=source.match(/  const CPT_CARD_RANK_PALETTE = \{[\s\S]*?^  \};/m)[0];
vm.runInNewContext('let cptStyleInjected=false;\n'+cardRankPalette+'\n'+extract('cptInjectStyles')+'\ncptInjectStyles();',pushStyleContext);
const globalCSS=source.match(/globalStyle\.textContent = `([\s\S]*?)`;/)[1];
function styleAfter(marker){
 const offset=source.indexOf(marker);assert.ok(offset>=0,marker);
 const m=source.slice(offset).match(/\.textContent\s*=\s*`([\s\S]*?)`;/);assert.ok(m,marker);return m[1];
}
const moduleCSS=[
 styleAfter("style.id = 'suite-suggestion-authors-style'"),
 styleAfter("style.id = 'suite-gacha-autoloot-style'"),
 styleAfter("s.id='cv-stones-style'"),
 styleAfter("style.id='suite-brick-embedded-style'"),
 styleAfter("style.id='suite-remelt-embedded-style'"),
 styleAfter("style.id='cv-auto-embedded-style'"),
 styleAfter("style.id='suite-owner-restrictions-style'"),
 styleAfter("style.id = 'suite-club-war-style'"),
 pushStyleContext.css,
 source.match(/panelStyleElement = GM_addStyle\(`([\s\S]*?)`\);/)[1]
].join('\n');
const bestCSS=extract('openBestCardSettings').match(/<style>([\s\S]*?)<\/style>/)[1];
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
const tile=(title,html)=>`<section class="fixture"><h3>${title}</h3>${html}</section>`;
const markup=[
 tile('Меню',`<div id="suite-settings-panel"><div class="suite-settings-header"><b style="color:#e2e8f0">Помощник</b><span style="background:#111c2f;color:#93c5fd;padding:4px">3.77</span></div><div class="suite-section-nav"><button class="suite-section-tab">Карты</button><button class="suite-section-tab is-active">UI</button></div><div class="suite-section-panel is-active"><p style="color:#cbd5e1">Лимиты обменов</p><label class="suite-toggle"><input type="checkbox" checked><span class="suite-slider"></span></label><p style="color:#94a3b8">Числа вместо точек</p><label class="suite-toggle"><input type="checkbox"><span class="suite-slider"></span></label></div></div>`),
 tile('Автолут',`<div id="aw-active-tab-panel"><div class="aw-title">Автолут <button class="aw-icon-btn">—</button></div><div id="aw-active-tab-toggle" data-active="true" style="background:#14532d">Автолут: ВКЛ</div><p class="aw-line">Сегодня: 25 / 35</p><span class="aw-compact-limit">25/35</span> <span class="aw-compact-time">15с</span><p class="aw-line">Эта вкладка выполняет автолут</p><button class="aw-btn">База аниме</button></div>`),
 tile('База аниме',`<div class="aw-modal-box"><div class="aw-modal-head"><span class="aw-modal-title">База аниме</span><button class="aw-modal-close">×</button></div><div class="aw-modal-body"><div class="aw-item"><div class="aw-item-title">Томо — девушка</div><div class="aw-item-sub">Просмотрено 5 / 12</div><button class="aw-small-btn danger">Удалить</button></div><label class="aw-input-label">Поиск</label><input class="aw-input" placeholder="Название"><p class="aw-error">Пример ошибки</p><button class="aw-action-btn">Добавить аниме</button></div></div>`),
 tile('Гача',`<div class="suite-gacha-dialog"><div class="suite-gacha-dialog__head"><b class="suite-gacha-dialog__title">Полученные награды</b><button class="suite-gacha-close">×</button></div><div class="suite-gacha-history-body"><div class="suite-gacha-history-card"><span class="suite-gacha-history-card__label">Камни духа</span><span class="suite-gacha-history-card__value">160</span></div><div class="suite-gacha-history-day"><span class="suite-gacha-history-day__date">чт, 22.10</span><span class="suite-gacha-history-day__value">90 камней духа<small class="suite-gacha-history-day__note">Бесконечная гача</small></span></div><span class="suite-gacha-history-card__value is-unknown">Нет информации</span></div></div>`),
 tile('Камни духа',`<div class="cv-stones-wallet"><h3 class="cv-stones-wallet__heading">Учёт камней</h3><p class="cv-stones-wallet__hint">Автоматически из истории</p><div class="cv-stones-panel"><div class="cv-stones-panel__header">Траты не на паки</div><span class="cv-stones-panel__value">1 200</span></div><button class="cv-stones-wallet__refresh">Проверить</button></div>`),
 tile('Лабиринт',`<div id="suite-lab-fatigue-counter"><div class="suite-lab-fatigue-head">Усталость</div><span class="suite-lab-fatigue-value">60%</span><button class="suite-lab-fatigue-btn">≡</button><span class="suite-lab-fatigue-progress"><span style="width:60%"></span></span></div><div id="suite-emission-timer" class="is-active"><div class="suite-emission-head">Выброс</div><span class="suite-emission-value">02:09</span><small class="suite-emission-sub">До завершения выброса</small></div>`),
 tile('Кирпич',`<div id="stone-brick-panel" class="suite-brick-embedded"><div class="suite-brick-header"><span>Наполнение кирпича</span></div><div class="suite-brick-criterion">Ранг <input type="number" value="5"></div><button id="stone-brick-main-btn">Наполнить</button></div>`),
 tile('Переплавка',`<div id="remelt-panel" class="suite-remelt-embedded"><div class="suite-remelt-header"><span>Переплавка</span></div><div class="suite-remelt-criterion">Ранг A <input type="number" value="10"></div><button id="remelt-main-btn">Переплавить</button></div>`),
 tile('Предложка',`<div class="suite-suggestion-modal is-open"><div class="suite-suggestion-topbar"><b class="suite-suggestion-title">Авторы предложений</b></div><div class="suite-suggestion-meta">Последняя проверка: сейчас</div><div class="suite-suggestion-tabs"><button class="suite-suggestion-tab is-active">A</button><button class="suite-suggestion-tab">B</button></div><div class="suite-author-badge"><a href="#">Имя автора</a></div><div class="suite-author-badge suite-not-found">Автор не найден</div></div>`),
 tile('Уведомления',`<div id="__cpt-root">${[['emerald','Награда получена'],['rose','Не удалось получить ответ'],['neon-amber','Дневной лимит'],['ocean','Прогресс обновлён'],['indigo','Получена карта S']].map(([c,t])=>`<div class="cpt-toast cpt-${c}"><div class="cpt-head">${t}</div><div class="cpt-sub">Подробности уведомления</div></div>`).join('')}</div>`),
 tile('Автооткрытие',`<div id="cv-auto-open-panel" class="cv-auto-embedded"><div class="cv-auto-header"><div>Автооткрытие</div></div><div class="cv-auto-body"><div class="cv-auto-target">Цель <input type="number" value="100"></div><span class="cv-auto-count">25 / 100</span><button class="cv-auto-reset">Сброс</button><div class="cv-auto-status">Ожидание</div></div></div>`),
 tile('Подсказки',`<div id="suite-menu-tooltip">Описание функции<span class="suite-menu-tooltip-premium">Требуется премиум</span></div>`)
].join('');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:1100}});let requests=0;
  await page.route('**/*',r=>{requests++;return r.abort();});
  await page.setContent(`<style>body{margin:20px;background:#fafbfc;font:14px Arial;color:#233345}.gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.fixture{min-width:0}.fixture>h3{font-size:13px;color:#516477}.fixture button{cursor:pointer}body.dt-is-active,body.dle_theme_dark,body[data-theme=dark]{background:#16191f;color:#ddd}</style><div class="gallery">${markup}</div><div id="native" style="background:#0f172a;color:#e2e8f0">Оформление сайта</div><div id="cv-best-settings-host"></div>`);
  await page.addStyleTag({content:globalCSS});
  await page.addStyleTag({content:ctx.css});
  // Modules are often injected AFTER global styles. The cascade must still work.
  await page.addStyleTag({content:moduleCSS});
  await page.addStyleTag({content:'*,*:before,*:after{transition:none!important;animation:none!important}'});
  await page.addStyleTag({content:`.fixture :is(#suite-settings-panel,#aw-active-tab-panel,.suite-suggestion-modal,#suite-lab-fatigue-counter,#suite-emission-timer,#suite-menu-tooltip){position:relative!important;inset:auto!important;transform:none!important;width:auto!important;min-width:0!important;max-height:none!important;display:block!important;margin:0 0 10px!important;visibility:visible!important;opacity:1!important}.fixture .suite-section-panel{display:block!important}.fixture #__cpt-root{position:static!important}.fixture .cpt-toast{margin-bottom:8px;animation:none!important}.fixture .suite-gacha-dialog{width:auto}.fixture .cv-stones-wallet{margin:0;padding:16px}.fixture #cv-auto-open-panel{display:block}.fixture #cv-auto-open-panel .cv-auto-body{display:block}.fixture #suite-menu-tooltip{max-width:none!important}.fixture .suite-section-nav{display:flex!important}`});
  await page.evaluate(({bestCSS})=>{const host=document.querySelector('#cv-best-settings-host');host.attachShadow({mode:'open'}).innerHTML=`<style>${bestCSS}</style><dialog open><header><h2>Лучшая карта</h2></header><div class="body"><p class="notice"><b>Ваши правила выбора.</b> Настройки</p><p class="mode-text">Режим</p><input type="number" value="40"><div class="rule"><strong>Приоритет карт</strong><p>Описание правила</p></div></div><footer><button class="primary">Сохранить</button><button class="reset">Сброс</button></footer></dialog>`;host.style.display='none';},{bestCSS});
  await page.evaluate(`(()=>{
   ${source.slice(source.indexOf('  const RANK_ORDER  ='),source.indexOf('  const WANT_BONUS='))}
   const todayKey='2026-10-23',stats={allCards:Object.fromEntries(RANK_ORDER.map(r=>[r,{count:2,totalValue:20,byDate:{[todayKey]:1}}])),pickedCards:{}};
   const lastRank={currentS:2,currentPlus:2,currentASS:2,S:2,PLUS:2,ASS:2};
   let statsPanel=null,statsFilter='all',activeTab='all';const makeDraggable=()=>{};
   ${extract('getCountForFilter')}
   ${extract('buildStatsHTML')}
   ${extract('renderStatsTab')}
   ${extract('createStatsPanel')}
   createStatsPanel();
   const wrapper=document.createElement('section');wrapper.className='fixture';wrapper.innerHTML='<h3>Статистика паков</h3>';document.querySelector('.gallery').append(wrapper);
   statsPanel.style.cssText+=';position:static;display:block;width:auto';wrapper.append(statsPanel);
  })()`);
  await page.evaluate(`(()=>{
   let confirmDialog=null,confirmedCard=null,packConfirmDialog=null,packConfirmCallback=null;
   const confirmGuardSelection=()=>{},cancelGuardSelection=()=>{};
   ${extract('createConfirmDialog')}
   ${extract('showConfirmDialog')}
   ${extract('createPackConfirmDialog')}
   ${extract('showPackConfirmDialog')}
   showConfirmDialog(null,2,10);showPackConfirmDialog(100,()=>{});
   for(const overlay of [confirmDialog,packConfirmDialog]){
    const wrapper=document.createElement('section');wrapper.className='fixture';wrapper.innerHTML='<h3>Защитное окно</h3>';document.querySelector('.gallery').append(wrapper);
    overlay.style.cssText='position:static;display:block;background:none';wrapper.append(overlay);
   }
  })()`);
  await page.evaluate(`(()=>{
   const cfg={modHotkeys:true,hkPanelLeft:null,hkPanelTop:null},location={pathname:'/cards/pack/'};
   const saveCfg=()=>{},makeDraggable=()=>{},setHkPanelCollapsed=()=>{},codeToLabel=x=>x||'KeyA';
   let captureState=null,hkPanel,hkExpanded,hkCollapsedBtn,hkSummary;
   ${extract('makeHkField')}
   ${extract('startKeyCapture')}
   ${extract('refreshHkSummary')}
   ${extract('createHotkeyPanel')}
   createHotkeyPanel();
   const wrapper=document.createElement('section');wrapper.className='fixture';wrapper.innerHTML='<h3>Горячие клавиши</h3>';document.querySelector('.gallery').append(wrapper);
   hkPanel.style.cssText='position:static';hkExpanded.style.width='auto';wrapper.append(hkPanel);
  })()`);
  await page.evaluate(`(async()=>{
   const STATS_MODAL_ID='theme-rank-stats',RANK_CONFIG=${source.match(/const RANK_CONFIG = (\[[\s\S]*?\]);/)[1]};
   const buildRankStats=async()=>({allCounts:Object.fromEntries(RANK_CONFIG.map(r=>[r.key,2])),todayCounts:{},totalAll:26,totalToday:0});
   ${extract('createSimpleModal')}
   ${extract('openStatsModal')}
   await openStatsModal();
   const wrapper=document.createElement('section');wrapper.className='fixture';wrapper.innerHTML='<h3>Статистика автолута</h3>';document.querySelector('.gallery').append(wrapper);
   const modal=document.getElementById(STATS_MODAL_ID);modal.style.cssText='position:static;padding:0;background:none;display:block';wrapper.append(modal);
  })()`);
  await page.evaluate(()=>{
   const wrapper=document.createElement('section');wrapper.className='fixture';wrapper.innerHTML='<h3>Легенда ЧС и статусы клуба</h3><span class="suite-owner-restriction-legend-item"><span class="suite-owner-restriction-badge suite-owner-restriction-blocked">×</span>В чёрном списке</span><div class="labyrinth__club-war-club suite-club-war-ally is-active" style="padding:12px;margin:10px">Союзный клуб</div><div class="labyrinth__club-war-club suite-club-war-enemy" style="padding:12px;margin:10px">Враждебный клуб</div><div id="cv-pack-tools"><div id="cv-pack-stats-card"><div class="cv-pack-tool-body"><span class="cv-pack-tool-title">Статистика</span><small class="cv-pack-tool-note">За всё время</small><b class="cv-pack-tool-value">2 253</b><button id="cv-stats-btn">Открыть</button></div></div></div>';
   document.querySelector('.gallery').append(wrapper);
   const protectedControls=document.createElement('div');protectedControls.hidden=true;protectedControls.innerHTML='<button id="suite-settings-btn" style="background:#0a0f1a;color:#e2e8f0">Настройки</button><div id="suite-mobile-helper-layer"><span class="suite-mobile-helper-title">Помощник</span><span class="suite-mobile-helper-version">3.77</span><label class="suite-toggle"><input type="checkbox" checked><span class="suite-slider"></span></label></div>';document.body.append(protectedControls);
  });
  // Unknown inline markup is no longer color-matched; actual controls are tested instead.
  await page.evaluate(()=>{const e=document.createElement('span');e.id='inline-trap';e.style.cssText='background-color:#94a3b8;color:#dc2626';e.textContent='Native';document.body.append(e);});
  const snap=()=>page.evaluate(()=>[...document.querySelectorAll('.gallery *,.gallery,#cv-stats-panel,#cv-stats-panel *,#native')].map(e=>{const s=getComputedStyle(e);return [s.color,s.backgroundColor,s.backgroundImage,s.borderColor,s.boxShadow,s.display,s.width,s.height];}));
  const light=await snap();
  const color=selector=>page.locator(selector).first().evaluate(e=>getComputedStyle(e).color);
  const bg=selector=>page.locator(selector).first().evaluate(e=>getComputedStyle(e).backgroundColor);
  for(const selector of ['#aw-active-tab-panel','.aw-modal-box','.suite-gacha-dialog','.cv-stones-wallet','#suite-lab-fatigue-counter','.suite-suggestion-modal','#cv-auto-open-panel','#cv-stats-panel']){
   ok((await bg(selector)).match(/rgb\((?:2[2-5]\d),/),'light surface '+selector);
  }
  ok(await color('#inline-trap')==='rgb(220, 38, 38)','background-color does not match foreground color');
  ok(await color('#cv-stats-content td:nth-child(2)')==='rgb(35, 51, 69)','actual pack statistic numbers remain readable');
  ok(await bg('.cv-tab-btn[aria-pressed="true"]')==='rgb(224, 241, 249)','selected stats tab has semantic styling');
  await page.locator('.cv-tab-btn[data-tab="picked"]').click();
  ok(await page.locator('.cv-tab-btn[data-tab="picked"]').getAttribute('aria-pressed')==='true','stats state updates on tab change');
  await page.locator('.cv-tab-btn[data-tab="all"]').click();
  ok(await color('#cv-confirm-msg b:first-of-type')==='rgb(156, 37, 64)','worse card stays red');
  ok(await color('#cv-confirm-msg b:nth-of-type(2)')==='rgb(22, 96, 60)','better card stays green');
  ok(await color('#cv-pack-confirm-msg b:first-of-type')==='rgb(128, 80, 0)','expensive pack keeps warning color');
  ok(await color('.suite-hotkeys-summary b')==='rgb(35, 51, 69)','hotkey summary remains readable');
  ok(await bg('#aw-active-tab-toggle')==='rgb(224, 243, 232)','running state stays green');
  await page.locator('#aw-active-tab-toggle').evaluate(e=>{e.style.background='#7f1d1d';e.dataset.active='false';});
  ok(await bg('#aw-active-tab-toggle')==='rgb(255, 229, 233)','stopped state changes to red without a rerender');
  await page.locator('#aw-active-tab-toggle').evaluate(e=>{e.style.background='#14532d';e.dataset.active='true';});
  ok(await color('.suite-suggestion-tab.is-active')==='rgb(255, 255, 255)','active author tab remains distinct');
  ok(await color('.suite-gacha-history-card__value.is-unknown')==='rgb(128, 80, 0)','unknown reward keeps amber warning color');
  const protectedUnchanged=await page.evaluate(css=>{
   const snapshot=()=>[...document.querySelectorAll('#suite-settings-panel,#suite-settings-panel *,#suite-settings-btn,#suite-mobile-helper-layer,#suite-mobile-helper-layer *,#suite-menu-tooltip,#suite-menu-tooltip *,.cpt-toast,.cpt-toast *')].map(e=>[null,'::before','::after'].map(p=>{const s=getComputedStyle(e,p);return [s.color,s.backgroundColor,s.backgroundImage,s.borderColor,s.boxShadow,s.opacity];}));
   const before=snapshot(),sheet=[...document.querySelectorAll('style')].find(s=>s.textContent===css);sheet.disabled=true;const original=snapshot();sheet.disabled=false;return JSON.stringify(before)===JSON.stringify(original);
  },ctx.css);
  ok(protectedUnchanged,'helper menu, its switches/tooltips and notifications retain their original styles');
  ok(await bg('.suite-owner-restriction-blocked')==='rgb(8, 9, 11)'&&await color('.suite-owner-restriction-blocked')==='rgb(255, 255, 255)','blacklist icon retains black fill and white symbol');
  ok(await page.locator('.suite-club-war-ally.is-active').evaluate(e=>getComputedStyle(e).outlineColor)==='rgb(52, 77, 101)','active club outline visible on white');
  // WCAG text contrast against the nearest real rendered surface (alpha composited).
  ok(await page.locator('.aw-rank-label').count()===2,'both rank distribution labels covered');
  ok(await page.locator('.aw-rank-empty').count()===1,'empty distribution label covered');
  ok(await page.locator('.aw-rank-empty').evaluate(e=>e.parentElement.clientHeight>=e.scrollHeight),'empty label is not clipped by rank bar');
  const contrastFailures=await page.evaluate(()=>{
   const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number),lum=c=>c.slice(0,3).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
   const failures=[];
   const selectors=['.aw-line','.aw-title','.aw-item-title','.aw-item-sub','.aw-input','.aw-error','.aw-action-btn','.aw-small-btn.danger','.aw-compact-limit','.aw-compact-time','.suite-gacha-history-card__label','.suite-gacha-history-card__value','.suite-gacha-history-day__note','.suite-gacha-history-day__date','.cv-stones-wallet__hint','.cv-stones-panel__value','.suite-lab-fatigue-value','.suite-emission-sub','.suite-author-badge','.suite-suggestion-meta','.cv-auto-count','.cv-auto-status','.suite-brick-criterion','.suite-remelt-criterion','#stone-brick-main-btn','#remelt-main-btn'];
   selectors.push('.aw-rank-label','.aw-rank-empty','.aw-rank-badge','.aw-stat-num','.aw-stat-pct','#aw-clear-stats-btn','.suite-owner-restriction-legend-item','.labyrinth__club-war-club','.cv-pack-tool-value','.cv-pack-tool-note','#cv-stats-btn','.cv-stats-rank','#cv-stats-content td:nth-child(2)','#cv-stats-reset','.cv-tab-btn','.cv-filter-btn');
   selectors.push('#cv-confirm-msg','#cv-confirm-msg b','#cv-confirm-ok','#cv-confirm-cancel','#cv-pack-confirm-msg','#cv-pack-confirm-msg b','#cv-pack-confirm-title','#cv-pack-confirm-overlay button','#suite-hotkeys-panel input','#suite-hotkeys-panel label','.suite-hotkeys-help','.suite-hotkeys-summary','.suite-hotkeys-summary b');
   for(const e of document.querySelectorAll(selectors.join(','))){
    let chain=[],p=e;while(p){chain.unshift(p);p=p.parentElement;}let background=[255,255,255];
    for(const parent of chain){const c=rgb(getComputedStyle(parent).backgroundColor),a=c.length===4?c[3]:1;if(c.length>=3)background=background.map((v,i)=>v*(1-a)+c[i]*a);}
    const style=getComputedStyle(e),fg=rgb(style.color).slice(0,3).map((v,i)=>v*Number(style.opacity)+background[i]*(1-Number(style.opacity))),a=lum(fg),b=lum(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    if(ratio<4.5)failures.push({element:e.className||e.id,text:e.textContent.slice(0,45),ratio,foreground:style.color,background});
   }return failures;
  });
  ok(contrastFailures.length===0,'readable light text: '+JSON.stringify(contrastFailures));
  ok(await bg('#native')==='rgb(15, 23, 42)'&&await color('#native')==='rgb(226, 232, 240)','native elements untouched');
  for(const marker of ['dt-is-active','dle_theme_dark','data-theme']){
   await page.evaluate(marker=>{document.body.className='';document.body.removeAttribute('data-theme');if(marker==='data-theme')document.body.dataset.theme='dark';else document.body.classList.add(marker);},marker);
   const withRules=await snap();
   const baseline=await page.evaluate(css=>{const sheet=[...document.querySelectorAll('style')].find(s=>s.textContent===css);sheet.disabled=true;const result=[...document.querySelectorAll('.gallery *,.gallery,#cv-stats-panel,#cv-stats-panel *,#native')].map(e=>{const s=getComputedStyle(e);return [s.color,s.backgroundColor,s.backgroundImage,s.borderColor,s.boxShadow,s.display,s.width,s.height];});sheet.disabled=false;return result;},ctx.css);
   ok(JSON.stringify(withRules)===JSON.stringify(baseline),'dark styles unchanged via '+marker);
   const shadow=await page.locator('#cv-best-settings-host dialog').evaluate(e=>getComputedStyle(e).backgroundColor);
   ok(shadow==='rgb(27, 25, 28)','shadow dark theme via '+marker);
  }
  await page.evaluate(()=>{document.body.className='';document.body.removeAttribute('data-theme');});
  ok(JSON.stringify(await snap())===JSON.stringify(light),'light restored without recreating controls');
  ok(await bg('#cv-best-settings-host dialog')==='rgb(27, 25, 28)','best-card settings retain their original style');
  fs.mkdirSync(path.join(root,'tmp'),{recursive:true});
  await page.screenshot({path:path.join(root,'tmp','helper-light-theme.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.addStyleTag({content:'.gallery{grid-template-columns:minmax(0,1fr)}'});
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile module fixtures fit width');
  await page.screenshot({path:path.join(root,'tmp','helper-light-theme-mobile.png'),fullPage:true});
  await page.evaluate(()=>{document.querySelector('#cv-best-settings-host').style.display='block';});
  await page.screenshot({path:path.join(root,'tmp','best-settings-preserved-theme.png')});
  ok(requests===0,'no network for theme switching');
  const fallback=await browser.newPage();await fallback.route('**/*',r=>r.abort());
  await fallback.setContent('<body style="background:white">'+['stone-brick-panel','remelt-panel'].map(id=>`<div id="${id}" style="background:#111;color:white"><div><button style="background:transparent;color:#fff">−</button></div><input type="number" value="10" style="background:rgba(0,0,0,.35);color:white"></div>`).join(''));
  await fallback.addStyleTag({content:ctx.css});
  for(const id of ['stone-brick-panel','remelt-panel']){
   ok(await fallback.locator('#'+id+' button').evaluate(e=>getComputedStyle(e).color)==='rgb(35, 51, 69)','fallback collapse contrast: '+id);
   ok(await fallback.locator('#'+id+' input').evaluate(e=>getComputedStyle(e).color==='rgb(35, 51, 69)'&&getComputedStyle(e).backgroundColor==='rgb(240, 245, 248)'),'fallback input contrast: '+id);
  }
  await fallback.evaluate(()=>document.body.classList.add('dt-is-active'));
  ok(await fallback.locator('#stone-brick-panel input').evaluate(e=>getComputedStyle(e).color)==='rgb(255, 255, 255)','fallback dark appearance preserved');
  await fallback.close();
  console.log(`HELPER_LIGHT_THEME_OK ${checks} checks; stylesheet ${ctx.css.length} bytes`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
