// Run real configuration loading and premium preservation against isolated in-memory storage.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','AnimeSSS_help.user.js'),'utf8');
new vm.Script(source);
const start=source.indexOf('  function gmGet(');
const end=source.indexOf('  enforcePremiumSettings();')+'  enforcePremiumSettings();'.length;
const code=source.slice(start,end);
let passed=0;
function check(value,message){assert.ok(value,message);passed++;}
function load(saved,premium=true,desired){
 const data=new Map(),writes=[];
 if(saved!==undefined)data.set('suite_settings_v1',JSON.stringify(saved));
 if(desired!==undefined)data.set('suite_premium_desired_settings_v1',JSON.stringify(desired));
 const before=data.get('suite_settings_v1');
 const context=vm.createContext({window:{member_active_premium:premium?1:0},
  GM_getValue:(key,fallback)=>data.has(key)?data.get(key):fallback,
  GM_setValue:(key,value)=>{writes.push(key);data.set(key,value);},GM_deleteValue:key=>data.delete(key)});
 vm.runInContext(code+'\nglobalThis.result={cfg,defaults:DEFAULT_SETTINGS};',context);
 return {...JSON.parse(JSON.stringify(context.result)),writes,data,before};
}
const fresh=load();
const toggles=[...new Set([...source.matchAll(/makeToggle\('([^']+)'/g)].map(m=>m[1]))];
check(toggles.length>25,'all settings-menu function switches discovered');
for(const key of toggles)check(fresh.cfg[key]===false,'fresh install switch off: '+key);
check(fresh.cfg.autoOpenEnabled===false,'automatic opening not running');
check(fresh.writes.length===0,'loading fresh defaults does not overwrite storage');
check(fresh.cfg.mobileFloatingUiHidden===false,'settings entry remains accessible');
check(Object.values(fresh.cfg.settingsSections).every(Boolean),'menu sections remain accessible');

const saved={...Object.fromEntries(toggles.map((key,i)=>[key,i%2===0])),menuBgDim:.31,menuTextClarity:.91,
 autoOpenTarget:1800,autoOpenedCount:40,buyKey:'KeyF',settingsPanelLeft:127,
 bestCardSettings:{custom:true,unowned:'always'},settingsSections:{ui:true,packs:false}};
const existing=load(saved);
for(const [key,value] of Object.entries(saved))check(JSON.stringify(existing.cfg[key])===JSON.stringify(value),'preserved saved value: '+key);
check(existing.data.get('suite_settings_v1')===existing.before&&existing.writes.length===0,'existing settings blob unchanged');

const allOn=Object.fromEntries(toggles.map(key=>[key,true]));
const restored=load(allOn);
check(toggles.every(key=>restored.cfg[key]===true),'all previously enabled functions remain enabled');
const partial=load({modStats:true,modNeon:false});
check(partial.cfg.modStats===true&&partial.cfg.modNeon===false,'both explicit true and false override defaults');
check(partial.cfg.modOwnerRestrictions===false&&partial.cfg.modGachaAutoloot===false,'missing/new settings default off');
const noPremium=load(undefined,false);
check(noPremium.writes.length===0,'fresh non-premium account does not create enabled desired settings');
const desired={modCardValue:true,modBestCard:true,modGuard:false};
const premiumRestored=load({modCardValue:false,modBestCard:false},true,desired);
check(premiumRestored.cfg.modCardValue&&premiumRestored.cfg.modBestCard&&!premiumRestored.cfg.modGuard,'saved premium preferences still restored');
console.log(JSON.stringify({result:'SETTINGS_DEFAULTS_OK',passed,toggles:toggles.length}));
