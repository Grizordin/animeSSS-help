// Real gacha module in an offline browser. All fetches are mocked; no live claims.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
function extract(name){
 const match=new RegExp('^([ \\t]*)(?:async )?function '+name+'\\(','m').exec(source);
 const lines=source.slice(match.index).split(/\r?\n/);
 for(let n=2;n<=lines.length;n++)if(lines[n-1]===match[1]+'}'){
  const code=lines.slice(0,n).join('\n');try{new vm.Script('('+code+')');return code;}catch{}
 }
 throw Error(name);
}
let passed=0;const check=(v,label)=>{if(!v)throw Error(label);passed++;};
const prefix='suite_gacha_autoloot_v1_';
const history=[
 {dateKey:'2026-10-21',status:'looted',rewardType:'Card_d',quantity:4,serverResponse:'Вы получили 4 карты D ранга за бесконечную гачу'},
 {dateKey:'2026-10-20',status:'not_looted',rewardType:'Stars'},
 {dateKey:'2026-10-19',status:'looted',rewardType:'Card_e',quantity:1},
 {dateKey:'2026-10-18',status:'looted',rewardType:'Coins',quantity:null,serverResponse:'Вы получили 90 камней духа за бесконечную гачу'},
 {dateKey:'2026-10-17',status:'looted',rewardType:'Exp',quantity:270},
 {dateKey:'2026-10-16',status:'looted',rewardType:'Coins',quantity:null,serverResponse:'Вы получили 70 камней духа за бесконечную гачу'},
 {dateKey:'2026-10-15',status:'no_information'},
 {dateKey:'2026-10-01',status:'looted',rewardType:'Coins',quantity:null,serverResponse:'Вы получили 30 камней духа за бесконечную гачу'},
 {dateKey:'2026-09-30',status:'looted',rewardType:'Stars',quantity:50},
 {dateKey:'2026-09-09',status:'looted',rewardType:'Stone',quantity:null,serverResponse:'Вы получили 3 энергии небесного кирпича за бесконечную гачу'},
 {dateKey:'2026-09-08',status:'looted',rewardType:'Exp',quantity:90},
 {dateKey:'2026-10-21',status:'looted',rewardType:'Card_d',quantity:4},
 {dateKey:'2026-10-21',status:'no_information'}
];
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:900}});
  await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body></body></html>'}));
  await page.goto('https://fixture.invalid/clubs/2/');
  await page.evaluate(({history,prefix})=>{
   window.RealDate=Date;window.testNow=RealDate.parse('2026-10-22T18:03:00Z');
   window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[testNow]));}static now(){return testNow;}};
   window.setInterval=()=>1;
   window.store={[prefix+'reward_history']:JSON.stringify(history),[prefix+'reward_settings']:JSON.stringify({Stars:false,Stone:true,Coins:true})};
   window.GM_getValue=(k,d)=>store[k]??d;window.GM_setValue=(k,v)=>store[k]=v;
   window.cfg={modGachaAutoloot:true};window.logs=[];window.requests=[];window.notifications=[];
   window.suiteTelemetryLog=(...args)=>logs.push(args);window.suiteGetAuthPause=()=>null;
   window.suiteDocumentIsGuest=()=>false;window.suiteIsAuthenticationError=()=>false;window.suiteIsUserHashError=()=>false;
   window.suiteGetUserHash=()=> 'test-placeholder';window.getPageWindow=()=>window;
   window.DLEPush={success:message=>notifications.push(message)};
   window.fetch=async()=>{throw Error('Unexpected fetch');};
   document.body.innerHTML='<div class="club__block"><div class="club__title">Бесконечная гача наград</div></div>';
  },{history,prefix});
  let init=extract('initGachaAutoloot');
  init=init.slice(0,init.lastIndexOf('}'))+'window.testGacha={REWARDS,getRewardHistory,saveRewardHistoryEntry,resolveReceivedReward,extractRewardQuantity,formatRewardAmount,createRewardHistoryPanel,createRewardPanel,runDailyCheck};\n}';
  await page.evaluate('('+init+')()');
  passed+=await page.evaluate(()=>{
   let passed=0;const check=(v,s)=>{if(!v)throw Error(s);passed++;};const g=testGacha;
   for(const amount of [1,2,90,1000]){
    const word=amount===1?'камень':amount===2?'камня':'камней';
    const text=`Вы получили ${amount.toLocaleString('ru-RU')} ${word} духа за бесконечную гачу`;
    const result=g.resolveReceivedReward({reward_type:'Coins'},'Coins',text);
    check(result.rewardType==='Coins'&&result.quantity===amount,'spirit stones '+amount);
   }
   for(const [type,text,count] of [['Stone','Вы получили 1 кирпич',1],['Stone','Вы получили 3 кирпича',3],['Stone','Вы получили 5 кирпичей',5],['Stars','Вы получили 90 звездного рейтинга за бесконечную гачу',90],['Exp','Вы получили 270 опыта за бесконечную гачу',270],['Card_d','Вы получили 4 карты D ранга за бесконечную гачу',4]]){
    check(g.resolveReceivedReward({reward_type:type},type,text).quantity===count,'parse '+type+' '+count);
   }
   check(g.resolveReceivedReward({},'Stone','Вы получили 70 камней духа').rewardType==='Coins','response wording repairs incorrect stored type');
   for(const amount of [1,40,70,1000,2644]){
    const text=`Вы получили ${amount.toLocaleString('ru-RU')} энергии небесного кирпича за бесконечную гачу`;
    check(g.resolveReceivedReward({},'Stone',text).quantity===amount,'real brick energy wording '+amount);
   }
   check(g.resolveReceivedReward({quantity:'1 000'},'Stone','').quantity===1000,'structured amount fallback');
   check(g.resolveReceivedReward({exp:3490000,step:268},'Exp','ok').quantity===null,'club exp and step are not reward amounts');
   check(g.resolveReceivedReward({},'Card_d','ok').quantity===null,'unknown card count is not invented');
   check(g.resolveReceivedReward({quantity:true},'Coins','ok').quantity===null,'boolean is not an amount');
   const rows=g.getRewardHistory();
   check(rows.length===11,'duplicate dates collapsed');
   check(rows.find(x=>x.dateKey==='2026-10-18').quantity===90,'historical spirit stones repaired');
   check(rows.find(x=>x.dateKey==='2026-10-21').quantity===4,'unknown record cannot replace known receipt');
   check(rows.find(x=>x.rewardType==='Stone').rewardLabel==='Кирпич','brick history label repaired');
   check(JSON.stringify(rows)===JSON.stringify(g.getRewardHistory()),'normalization is repeatable');
   return passed;
  });
  await page.getByRole('button',{name:'Просмотр наград'}).click();
  const totals=await page.locator('.suite-gacha-history-card').evaluateAll(cards=>Object.fromEntries(cards.map(c=>[c.querySelector('.suite-gacha-history-card__label').textContent,c.querySelector('.suite-gacha-history-card__value').textContent])));
  check(totals['Камни духа']==='190 камней духа','all-time stones include older than 7 days');
  check(totals['Кирпич']==='3 кирпича','brick total');check(totals['Опыт']==='360 опыта','all-time exp');
  check(totals['Звёздный рейтинг']==='50 звёздного рейтинга','disabled collection never hides past rewards');
  check(totals['Карта D']==='4 карты D ранга','deduplicated receipt counted once');
  check(totals['Карта A']==='0 карт A ранга','no receipts shown as zero');
  check(await page.locator('.suite-gacha-history-day').count()===7,'exactly 7 recent days');
  check(!(await page.locator('.suite-gacha-history-days').textContent()).includes('Вы получили'),'no repeated server messages under parsed rewards');
  check((await page.locator('.suite-gacha-history-body').textContent()).includes('08.09.2026'),'all-time start date disclosed');
  check((await page.locator('.suite-gacha-history-body').textContent()).includes('Дней без точных данных: 1'),'unknown historical day disclosed');
  for(const width of [1000,390,320]){
   await page.setViewportSize({width,height:900});
   check(await page.locator('.suite-gacha-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth&&e.getBoundingClientRect().right<=innerWidth),'dialog fits '+width);
   if(process.env.GACHA_SCREENSHOTS&&width!==320){fs.mkdirSync(path.join(__dirname,'..','output','gacha-history'),{recursive:true});await page.screenshot({path:path.join(__dirname,'..','output','gacha-history',width+'.png')});}
  }
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.getByRole('button',{name:'Выбор награды',exact:true}).click();
  check((await page.locator('.suite-gacha-reward-list').textContent()).includes('Камни духа'),'selection has correct currency label');
  check((await page.locator('.suite-gacha-reward-list').textContent()).includes('Кирпич'),'selection has brick label');
  check(!await page.locator('[data-reward="Stars"]').isChecked(),'stored disabled choice preserved');
  check(await page.locator('[data-reward="Coins"]').isChecked()&&await page.locator('[data-reward="Stone"]').isChecked(),'site reward IDs and stored choices preserved');
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  passed+=await page.evaluate(prefix=>{
   let passed=0;const check=(v,s)=>{if(!v)throw Error(s);passed++;};const g=testGacha;
   store[prefix+'reward_history']='[]';
   for(let n=0;n<70;n++)g.saveRewardHistoryEntry({dateKey:new RealDate(RealDate.UTC(2026,6,1+n)).toISOString().slice(0,10),status:'looted',rewardType:'Coins',quantity:10});
   check(g.getRewardHistory().length===70,'retains more than old 35-day limit');
   const entry=g.getRewardHistory()[0];g.saveRewardHistoryEntry(entry);g.saveRewardHistoryEntry({...entry,status:'no_information',quantity:null});
   check(g.getRewardHistory().length===70&&g.getRewardHistory().reduce((s,r)=>s+r.quantity,0)===700,'repeat receipts and stale checks cannot double or erase totals');
   check(JSON.parse(store[prefix+'reward_history']).length===70,'all-time records persisted');
   return passed;
  },prefix);
  // Actual claim flow, entirely mocked, verifies persistence and anomaly logging.
  for(const [type,text,quantity] of [['Coins','Вы получили 90 камней духа за бесконечную гачу',90],['Stone','Вы получили 1 кирпич за бесконечную гачу',1],['Stone','Вы получили 40 энергии небесного кирпича за бесконечную гачу',40],['Card_d','ok',null]]){
   const result=await page.evaluate(async({prefix,type,text})=>{
    for(const suffix of ['daily_state','last_check','tab_lock','reward_history'])delete store[prefix+suffix];
    testNow=RealDate.parse('2026-10-22T18:07:00Z');requests=[];logs=[];
    window.fetch=async(url,options)=>{
     requests.push({url,method:options?.method||'GET'});
     return new Response(options?.method==='POST'?JSON.stringify({status:text,reward_type:type,step:269}):`<div class="club__block"><div class="club__title">Бесконечная гача наград</div><div class="club__rewards" data-enlightenment="3496000"><div class="club__rewards-item is-available" data-step="269" data-need="3496000"><div class="club__rewards-item-image--${type}"></div><span id="get-gacha-reward">получить</span></div></div></div>`,{status:200});
    };
    await testGacha.runDailyCheck('test');await testGacha.runDailyCheck('test-repeat');
    return {rows:testGacha.getRewardHistory(),requests,logs};
   },{prefix,type,text});
   check(result.rows.length===1&&result.rows[0].quantity===quantity&&result.rows[0].rewardType===type,'claim stored '+type);
   check(result.requests.length===2&&result.requests.filter(r=>r.method==='POST').length===1,'one snapshot and one claim, no repeat '+type);
   check(result.logs.some(r=>r[1]==='reward_parse_incomplete')===(quantity===null),'only unknown amount warns '+type);
  }
  await page.close();console.log(JSON.stringify({result:'GACHA_HISTORY_OK',passed}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
