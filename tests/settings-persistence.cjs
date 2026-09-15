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
function tab(){
 const context=vm.createContext({window:{member_active_premium:1},
  GM_getValue:(k,d)=>data.has(k)?data.get(k):d,
  GM_setValue:(k,v)=>{if(fail)throw Error('write failed');writes++;data.set(k,v);},GM_deleteValue:k=>data.delete(k),
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
data.set(key,{modOwnerRestrictions:true,modStats:true});
check(tab().run('cfg.modOwnerRestrictions && cfg.modStats')===true,'native stored objects retain preferences');
console.log(JSON.stringify({result:'SETTINGS_PERSISTENCE_OK',passed}));
