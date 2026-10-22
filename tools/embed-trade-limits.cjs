// Deterministic mechanical embedding: the helper installs as a single userscript.
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const tracker=fs.readFileSync(path.join(root,'AnimeSSS_trade_limits.user.js'),'utf8');
const host=fs.readFileSync(path.join(__dirname,'trade-limits-host.js'),'utf8');
const opening='(function (host) {';
if(!tracker.includes(opening))throw Error('Missing tracker factory');
const body=tracker.slice(tracker.indexOf(opening)+opening.length,tracker.lastIndexOf('})();'));
const start='  // BEGIN EMBEDDED TRADE LIMITS',end='  // END EMBEDDED TRADE LIMITS';
const bundle=start+'\n  function createSuiteTradeLimits(host) {'+body+'  }\n'+host+'\n'+end;
const file=path.join(root,'AnimeSSS_help.user.js'),source=fs.readFileSync(file,'utf8');
const a=source.indexOf(start),b=source.indexOf(end,a);
if(a<0||b<0)throw Error('Missing bundle markers');
const expected=source.slice(0,a)+bundle+source.slice(b+end.length);
if(process.argv.includes('--check')){if(source!==expected)throw Error('Trade limits bundle out of sync');}
else fs.writeFileSync(file,expected);
