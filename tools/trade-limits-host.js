// Embedded by embed-trade-limits.cjs. No standalone runtime or external dependency.
function createTradeLimitsHost() {
  const prefix='suite_trade_limits_v1:', tab=crypto.randomUUID();
  const claimPrefix=prefix+'claim:', claimKey=claimPrefix+tab, ttl=15000;
  let held=false, claim=null, conflict=false;
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const visible=()=>document.visibilityState==='visible' && document.hasFocus();
  function readSetting(key){
    const preference=readSettingPreference(key);
    return preference ? preference.value === true : gmGet(SETTINGS_KEY,{})[key] === true;
  }
  function settings(){return {enabled:!conflict && readSetting('modTradeLimits'),mode:readSetting('tradeLimitsNumbers')?'numbers':'dots'};}
  const claims=()=>GM_listValues().filter(k=>k.startsWith(claimPrefix)).map(k=>({key:k,...GM_getValue(k,{})})).filter(c=>c.until>Date.now());
  const earlier=(a,b)=>a.ticket<b.ticket || (a.ticket===b.ticket && a.key<b.key);
  function ownsLock(){
    const value=GM_getValue(claimKey,null);
    return held && !!value && value.token===claim?.token && value.until>Date.now();
  }
  function report(entry){
    try {
      const code=String(entry.code||'');
      if(!['CHECK_ERROR','NOTICES_ERROR','SEND_TIME_ADJUSTED','SEND_TIME_MISMATCH','SEND_TIME_AMBIGUOUS','SEND_DATE_UNAVAILABLE','STORAGE_ERROR','WORKER_ERROR','HOOK_INSTALL_FAILED','STANDALONE_CONFLICT'].includes(code) && !(code==='CHECK_DONE' && !['red','green','yellow'].includes(entry.detail)))return;
      if(['CONTEXT_CHANGED','TAB_INACTIVE'].includes(entry.detail))return;
      const now=Date.now(), account=suiteGetCurrentUserName().trim().toLowerCase();
      // Old entries remain in the local ring buffer; do not resend resolved incidents.
      if(Number.isFinite(entry.at) && now-entry.at>5*60000)return;
      const key=prefix+'reports:'+account;
      const recent=gmGet(key,{}), signature=JSON.stringify([code,entry.name||'',typeof entry.detail==='string'?entry.detail:'']);
      if(recent[signature] && now-recent[signature]<15*60000)return;
      for(const k of Object.keys(recent))if(now-recent[k]>=15*60000)delete recent[k];
      if(Object.keys(recent).length>=80)return;
      recent[signature]=now;gmStoreSet(key,recent);
      suiteTelemetryLog('trade_limits',code.toLowerCase(),{peer:entry.name||'',detail:entry.detail||'',trackerVersion:'0.1.9'},/ERROR|FAILED/.test(code)?'error':'warn');
    }catch{/* Logging must not affect tracking. */}
  }
  async function withLock(callback){
    if(!settings().enabled || !visible())return;
    // GM storage is shared between .tv and .com; Web Locks alone are not.
    // Bakery tickets prevent a newly focused tab from preempting an active writer.
    const token=crypto.randomUUID();
    let heartbeat=0;
    try {
      claim={token,choosing:true,ticket:0,until:Date.now()+ttl};GM_setValue(claimKey,claim);
      const ticket=1+Math.max(0,...claims().filter(c=>c.key!==claimKey).map(c=>Number(c.ticket)||0));
      claim={token,choosing:false,ticket,until:Date.now()+ttl};GM_setValue(claimKey,claim);
      await pause(250);
      if(!settings().enabled || !visible() || claims().some(c=>c.key!==claimKey && (c.choosing || earlier(c,{...claim,key:claimKey}))))return;
      held=true;
      for(const key of GM_listValues().filter(k=>k.startsWith(claimPrefix) && k!==claimKey)){
        if((GM_getValue(key,null)?.until||0)<Date.now()-60000)GM_deleteValue(key);
      }
      heartbeat=setInterval(()=>{
        try {if(ownsLock()){claim.until=Date.now()+ttl;GM_setValue(claimKey,claim);}}
        catch{held=false;report({code:'STORAGE_ERROR'});}
      },2000);
      if(ownsLock())await callback(true);
    } finally {
      held=false;clearInterval(heartbeat);
      if(GM_getValue(claimKey,null)?.token===token)GM_deleteValue(claimKey);
      claim=null;
    }
  }
  function daily(state){
    if(!state || !state.account || !/^\d{4}-\d{2}-\d{2}$/.test(state.day))return;
    const key=prefix+'daily:'+state.account;
    if(GM_getValue(key,'')===state.day)return;
    const totals={day:state.day,users:0,sent:0,accepted:0,rejected:0,pending:0,confirmedLimits:0,checks:state.metrics?.checks||0,errors:state.metrics?.errors||0,requests:state.metrics?.requests||0,timingAdjustments:0};
    for(const p of Object.values(state.people||{})){
      totals.users++;if(p.confirmedLimit)totals.confirmedLimits++;
      for(const t of Object.values(p.trades||{})){
        totals.sent++;if(Object.hasOwn(totals,t.status))totals[t.status]++;
        if(t.timeMatch && t.timeMatch.deltaSeconds)totals.timingAdjustments++;
      }
    }
    // A compact summary, not a list of peers or a dump of their trade history.
    GM_setValue(key,state.day);
    if(totals.sent || totals.checks || totals.errors)suiteTelemetryLog('trade_limits','daily_summary',totals,'info');
  }
  function detectConflict(){
    const page=getPageWindow();
    conflict=suiteFunctionChainHas(page.fetch,'__asTradeLimits') || suiteFunctionChainHas(page.XMLHttpRequest?.prototype.open,'__asTradeLimits');
    if(conflict)report({code:'STANDALONE_CONFLICT',detail:'Выключите отдельный скрипт лимитов обменов и обновите страницу.'});
    return conflict;
  }
  return {prefix,origin:location.origin,settings,withLock,ownsLock,report,daily,detectConflict,hookInstalled:suiteFunctionChainHas};
}

let suiteTradeLimits=null;
function initTradeLimits(){
  if(window.top!==window || !/^https:\/\/animesss\.(tv|com)$/.test(location.origin))return;
  if(!suiteTradeLimits){
    const host=createTradeLimitsHost();
    if(host.detectConflict())return;
    suiteTradeLimits=createSuiteTradeLimits(host);
  }
  suiteTradeLimits?.refresh();
}
function syncTradeLimits(){
  if(cfg.modTradeLimits || suiteTradeLimits)initTradeLimits();
  document.querySelectorAll('[data-suite-trade-limits-numbers]').forEach(row=>{
    const input=row.querySelector('input');input.disabled=!cfg.modTradeLimits;
    row.style.opacity=cfg.modTradeLimits?'1':'0.35';input.checked=!!cfg.tradeLimitsNumbers;
  });
}
function watchTradeLimitsSettings(){
  for(const key of ['modTradeLimits','tradeLimitsNumbers']){
    GM_addValueChangeListener(SETTING_VALUE_PREFIX+key,()=>{
      const preference=readSettingPreference(key);
      if(preference){cfg[key]=preference.value===true;savedCfgSnapshot[key]=cfg[key];}
      document.querySelectorAll(`[data-suite-trade-setting="${key}"] input`).forEach(input=>input.checked=!!cfg[key]);
      syncTradeLimits();
    });
  }
  syncTradeLimits();
}
