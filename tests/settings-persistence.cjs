// Exercise real settings load/save and menu handlers with shared storage across tabs.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
const start=source.indexOf('  function gmGet(');
const end=source.indexOf('  enforcePremiumSettings();')+'  enforcePremiumSettings();'.length;
const toggle=source.slice(source.indexOf('  function makeToggle('),source.indexOf('  function applyPremiumLockToToggle('));
const key='suite_settings_v1',data=new Map();let writes=0,fail=false,passed=0;
function check(value,message){assert.ok(value,message);passed++;}
class Element {
 constructor(){this.style={};this.children=[];this.events={};}
 append(...nodes){this.children.push(...nodes);}
 addEventListener(name,handler){this.events[name]=handler;}
}
function tab(cached=false,premium=true){
 const cache=cached?new Map(data):data;
 const context=vm.createContext({window:{member_active_premium:premium?1:0},
  GM_getValue:(k,d)=>cache.has(k)?cache.get(k):d,
  GM_setValue:(k,v)=>{if(fail)throw Error('write failed');writes++;data.set(k,v);cache.set(k,v);},GM_deleteValue:k=>{data.delete(k);cache.delete(k);},
  document:{createElement:()=>new Element(),dispatchEvent:()=>{}},CustomEvent:function(){},
  fillMenuLabel:()=>{},bindSuiteMenuTooltip:()=>{},applyPremiumLockToToggle:()=>{},SUITE_MENU_TOOLTIPS:{}});
 vm.runInContext(source.slice(start,end)+toggle,context);
 return {run:code=>vm.runInContext(code,context),switch:(k,value)=>{
  context.testKey=k;context.testValue=value;
  vm.runInContext('constRow=makeToggle(testKey,testKey); constInput=constRow.children[1].children[0]; constInput.checked=testValue; constInput.events.change();',context);
 }};
}
const a=tab(),b=tab();
check(writes===0,'fresh page load never writes defaults');
a.switch('modOwnerRestrictions',true);
check(tab().run('cfg.modOwnerRestrictions')===true,'enabled switch survives ordinary reload');
b.run('cfg.autoOpenedCount=4;saveCfg();');
check(tab().run('cfg.modOwnerRestrictions')===true,'stale tab counter save must not disable restrictions');
b.run('cfg.settingsPanelLeft=80;saveCfg();');
check(tab().run('cfg.modOwnerRestrictions')===true,'stale panel positioning must not disable restrictions');
a.switch('modNeon',true);
check(tab().run('cfg.autoOpenedCount')===4,'menu save preserves a different tab counter');
b.switch('modOwnerRestrictions',false);
check(tab().run('cfg.modOwnerRestrictions')===false,'explicit off works even if stale local default was already off');
a.run('cfg.settingsPanelTop=20;saveCfg();');
check(tab().run('cfg.modOwnerRestrictions')===false,'old enabled tab cannot resurrect disabled function');
a.switch('modOwnerRestrictions',true);
check(tab().run('cfg.modOwnerRestrictions')===true,'explicit on works even when local value was already on');
const before=writes;b.run('saveCfg();');
check(writes===before,'no-op save does not overwrite shared settings');
const c=tab();a.switch('modStats',true);
c.run('cfg.bestCardSettings={custom:true};saveCfg(["bestCardSettings"],true);');
check(tab().run('cfg.modStats')===true,'best-card save preserves toggles changed in other tab');
fail=true;c.run('cfg.modQuickCardOwners=true;saveCfg();');fail=false;c.run('saveCfg();');
check(tab().run('cfg.modQuickCardOwners')===true,'failed write can be retried without losing change');
fail=true;check(c.run('cfg.bestCardSettings={custom:false};try{saveCfg(["bestCardSettings"],true);false}catch(e){true}')===true,'dialog can report write error');fail=false;
// Native object values may coexist with legacy JSON strings in GM storage.
data.clear();
data.set(key,{modOwnerRestrictions:true,modStats:true});
check(tab().run('cfg.modOwnerRestrictions && cfg.modStats')===true,'native stored objects retain preferences');

// Old code keeps writing its entire snapshot; a new read/merge in one tab cannot fix it.
data.clear();
const legacy={modStats:true,autoOpenedCount:759,autoOpenEnabled:true};
data.set(key,JSON.stringify(legacy));
const menu=tab();menu.switch('modOwnerRestrictions',true);
for(let count=760;count<=766;count++)data.set(key,JSON.stringify({...legacy,autoOpenedCount:count}));
check(tab().run('cfg.modOwnerRestrictions')===true,'legacy auto-opening writer cannot erase a new toggle');
check(tab().run('cfg.autoOpenedCount')===766,'legacy live counter still loads');

const toggleKeys=[...new Set([...source.matchAll(/makeToggle\('([^']+)'/g)].map(m=>m[1]))];
for(const toggleKey of toggleKeys){
 data.clear();data.set(key,JSON.stringify({[toggleKey]:false}));
 const writer=tab(true),oldCache=tab(true);
 writer.switch(toggleKey,true);
 oldCache.run('cfg.autoOpenedCount=808;saveCfg();');
 data.set(key,JSON.stringify({[toggleKey]:false,autoOpenedCount:809}));
 check(tab().run('cfg['+JSON.stringify(toggleKey)+']')===true,toggleKey+' enabled survives stale cache and legacy writer');
 writer.switch(toggleKey,false);
 data.set(key,JSON.stringify({[toggleKey]:true,autoOpenedCount:810}));
 check(tab().run('cfg['+JSON.stringify(toggleKey)+']')===false,toggleKey+' disabled survives stale cache and legacy writer');
}
data.clear();
const left=tab(true),right=tab(true);
left.switch('modOwnerRestrictions',true);right.switch('modStats',true);
check(tab().run('cfg.modOwnerRestrictions && cfg.modStats')===true,'different preferences from isolated caches both survive');
left.run('cfg.settingsPanelLeft=123;saveCfg();');right.run('cfg.menuBgDim=.23;saveCfg();');
data.set(key,'{}');
check(tab().run('cfg.settingsPanelLeft===123 && cfg.menuBgDim===.23')===true,'positions and sliders survive legacy replacement too');

// All remaining persistent defaults: hotkeys, limits, appearance and nested form values.
const defaultFields=JSON.parse(tab().run('JSON.stringify(DEFAULT_SETTINGS)'));
for(const [field,value] of Object.entries(defaultFields)){
 if(toggleKeys.includes(field)||['autoOpenedCount','autoOpenEnabled'].includes(field))continue;
 data.clear();const writer=tab(true),other=tab(true);
 const next=value===null?123:typeof value==='boolean'?!value:typeof value==='number'?value+1:typeof value==='string'?'KeyZ':{...value,testPreference:true};
 writer.run('cfg['+JSON.stringify(field)+']='+JSON.stringify(next)+';saveCfg();');
 other.run('cfg.autoOpenedCount=811;saveCfg();');data.set(key,'{}');
 check(tab().run('JSON.stringify(cfg['+JSON.stringify(field)+'])')===JSON.stringify(next),field+' survives cached writer and old full save');
}

data.clear();
const premiumTab=tab();premiumTab.switch('modBestCard',true);
check(tab(false,false).run('cfg.modBestCard')===false,'premium feature remains locked without access');
check(tab().run('cfg.modBestCard')===true,'premium access returns without losing saved preference');
premiumTab.switch('modBestCard',false);
data.set('suite_premium_desired_settings_v1',JSON.stringify({modBestCard:true}));
check(tab().run('cfg.modBestCard')===false,'old premium desired snapshot cannot override explicit off');
data.set('suite_setting_value_v2:modBestCard','broken JSON');
check(tab().run('cfg.modBestCard')===true,'invalid field record falls back to existing premium settings');
console.log(JSON.stringify({result:'SETTINGS_PERSISTENCE_OK',passed}));
