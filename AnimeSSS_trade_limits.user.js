// ==UserScript==
// @name         AnimeSSS — лимиты трейдов (отладка)
// @namespace    animesss.trade-limits.standalone
// @version      0.1.9
// @description  Отдельный индикатор исходящих лимитов: подтверждение отправок, история, уведомления. Не отправляет и не принимает обмены.
// @match        https://animesss.tv/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @run-at       document-start
// @noframes
// ==/UserScript==

(function (host) {
  'use strict';
  const VERSION = '0.1.9', SCHEMA = 2, PREFIX = host?.prefix || 'as_trade_limits_debug_v1:', MINUTE = 60000;
  const clean = x => String(x || '').replace(/\s+/g, ' ').trim();
  const nick = x => String(x || '').trim().toLowerCase();
  const lookup = (object,key) => object && Object.hasOwn(object,key) ? object[key] : undefined;
  const id = x => /^\d+$/.test(String(x || '')) ? String(x) : '';
  const day = (time = Date.now()) => new Date(time + 10800000).toISOString().slice(0, 10);
  function msk(text) {
    const m = clean(text).match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return NaN;
    const iso = `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`;
    const time = Date.parse(iso + '+03:00');
    return Number.isFinite(time) && new Date(time + 10800000).toISOString().slice(0, 19) === iso ? time : NaN;
  }
  function responseDate(value) {
    if(!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(String(value||'')))return null;
    const at=Date.parse(value);return Number.isFinite(at) && new Date(at).toUTCString()===value?at:null;
  }
  function sendRequestIds(address,method,body) {
    const u=url(address);
    if(!u || u.pathname!=='/index.php' || u.searchParams.get('controller')!=='ajax' || u.searchParams.get('mod')!=='trade_ajax' || String(method).toUpperCase()!=='POST')return null;
    try {
      const params=typeof body==='string'?new URLSearchParams(body):body;
      if(typeof params?.get!=='function' || params.get('action')!=='trade_card')return null;
      const ownerCardId=id(params.get('trade_id')),cardId=id(params.get('original_card'));
      return ownerCardId&&cardId?{ownerCardId,cardId}:null;
    }catch{return null;}
  }
  function url(value, base = host?.origin || 'https://animesss.tv/') {
    try { const u = new URL(value, base); return u.origin === new URL(host?.origin || 'https://animesss.tv/').origin ? u : null; } catch { return null; }
  }
  function ownerName(href) {
    const u = url(href);
    if (!u) return '';
    if (u.pathname === '/user/cards/') return String(u.searchParams.get('name') || '').trim();
    const m = u.pathname.match(/^\/user\/([^/]+)\/$/);
    try { return m ? decodeURIComponent(m[1]).trim() : ''; } catch { return ''; }
  }
  function account(doc) {
    const names = [...doc.querySelectorAll('.ap-profile-actions .ap-profile-action[href]')]
      .map(a => ownerName(a.getAttribute('href'))).filter(Boolean);
    return names.length && new Set(names.map(nick)).size === 1 ? names[0] : '';
  }
  function ownerTileSelector(pathname) {
    if(/^\/cards\/users\/(?:trade\/)?$/.test(pathname))return 'a.card-show__owner';
    if(/^\/cards\/[1-9]\d*\/(?:stars|awakened)\/?$/.test(pathname))return 'a.card-show__owner';
    return '';
  }
  function inert(html) {
    const t = document.createElement('template'); t.innerHTML = html; return t.content;
  }
  const cardIds = (root, selector) => [...root.querySelectorAll(selector)].map(a => {
    const u = url(a.getAttribute('href')); return u?.pathname === '/cards/users/' ? id(u.searchParams.get('id')) : '';
  }).filter(Boolean);
  function offerPage(doc) {
    const root = doc.querySelector('#tradeOffer');
    if (!root) return null;
    const name = String(root.dataset.receiver || '').trim(), ownerCardId = id(root.dataset.tradeId);
    const cardId = id(root.dataset.originalId), linkId = cardIds(root, '.to-art-stage .noffer__img')[0];
    if (!name || !ownerCardId || !cardId || (linkId && linkId !== cardId)) return null;
    const titles = [...root.querySelectorAll('.message-info__title')].map(e => clean(e.textContent));
    const messages = [...root.querySelectorAll('.message-info__content')].map(e => clean(e.textContent));
    return {name, ownerCardId, cardId,
      success: messages.includes('Обмен отправлен, дождитесь его рассмотрения получателем'),
      limit: titles.includes('Достигнут лимит предложений'),
      ready: !!root.querySelector('.trade__send-trade-btn')};
  }
  function nextPage(doc, current, kind) {
    const u = url(current), here = Number(u?.pathname.match(/\/page\/(\d+)\//)?.[1] || 1);
    if (!u) return null;
    const root = kind === 'offers' ? '/trades/offers/' : '/trades/history/';
    const candidates = [...doc.querySelectorAll('#pagination a[href], .pagination a[href]')].map(a => url(a.getAttribute('href'))).filter(Boolean);
    return candidates.find(v => v.pathname === `${root}page/${here + 1}/` &&
      (kind !== 'history' || (nick(v.searchParams.get('trader')) === nick(u.searchParams.get('trader')) &&
       nick(v.searchParams.get('name')) === nick(u.searchParams.get('name')) && (v.searchParams.get('kind')||'') === (u.searchParams.get('kind')||''))))?.href || null;
  }
  function parseOffers(doc, current) {
    const tab = [...doc.querySelectorAll('a.ncard__tabs-btn[href]')].find(a => url(a.getAttribute('href'))?.pathname === '/trades/offers/');
    const count = clean(tab?.textContent).match(/^Отправленные\s*\((\d+)\)$/);
    if (!count || !doc.querySelector('.trade__list')) throw Error('OFFERS_MARKUP');
    const rows = [...doc.querySelectorAll('.trade__list .trade__list-item')].map(a => {
      const u = url(a.getAttribute('href')), offerId = id(u?.pathname.match(/^\/trades\/offers\/(\d+)\/$/)?.[1]);
      const label = String(a.querySelector('.trade__list-name')?.textContent||'').trim();
      const name = label.startsWith('для ') ? label.slice(4).trim() : '';
      const sentAt = msk(a.querySelector('.trade__list-date')?.textContent);
      if (!name || !offerId || !Number.isFinite(sentAt)) throw Error('OFFERS_ROW');
      return {name, offerId, sentAt, exact: true};
    });
    return {rows, total: Number(count[1]), next: nextPage(doc, current, 'offers')};
  }
  function parseHistory(doc, current, name, own, kind='') {
    const u = url(current), active = doc.querySelector('.kind_active a[href]');
    const activeUrl = url(active?.getAttribute('href'));
    if (!['','calsel_sender'].includes(kind) || !u || (u.searchParams.get('kind')||'')!==kind || !activeUrl || (activeUrl.searchParams.get('kind')||'')!==kind ||
        nick(activeUrl.searchParams.get('name')) !== nick(own) || nick(activeUrl.searchParams.get('trader')) !== nick(name) ||
        !doc.querySelector('.history__list')) throw Error('HISTORY_MARKUP');
    const rows = [...doc.querySelectorAll('.history__list .history__item')].map(el => {
      const other = ownerName(el.querySelector('.history__name a')?.getAttribute('href'));
      const sentAt = msk(el.querySelector('.history__date')?.textContent);
      const gained = cardIds(el, '.history__body--gained .history__body-item');
      const lost = cardIds(el, '.history__body--lost .history__body-item');
      if (nick(other) !== nick(name) || !Number.isFinite(sentAt) || !gained.length || !lost.length) throw Error('HISTORY_ROW');
      return {sentAt, gained, lost, outcome:kind?'rejected':'accepted', key: (kind?kind+':':'')+JSON.stringify([nick(other), sentAt, [...gained].sort(), [...lost].sort()])};
    });
    if (rows.some((r, i) => i && r.sentAt > rows[i - 1].sentAt)) throw Error('HISTORY_ORDER');
    return {rows, next: nextPage(doc, current, 'history')};
  }
  function parseNotices(doc) {
    const found = new Map();
    for (const el of doc.querySelectorAll('.dropdown-item[id^="delete-"]')) {
      const noticeId = id(el.id.slice(7)), text = clean(el.querySelector('.font-weight-bold')?.textContent);
      const name = ownerName(el.querySelector('.font-weight-bold a[href^="/user/"]')?.getAttribute('href'));
      const kind = text.includes('согласился с вашим предложением на обмен') ? 'accepted' :
        text.includes('отказался от вашего предложения на обмен') ? 'rejected' : '';
      const at = msk(el.querySelector('.small.text-gray-500')?.textContent);
      if (noticeId && name && kind && Number.isFinite(at)) found.set(noticeId, {noticeId, name, kind, at});
    }
    return [...found.values()];
  }
  function fresh(own, now = Date.now()) {
    return {version: VERSION, schema: SCHEMA, account: nick(own), day: day(now), people: {}, notices: {}, seen: {}, log: [], notificationDue: 0, listAt: 0, badge: null};
  }
  function person(state, name) {
    const key = nick(name);
    if (!Object.hasOwn(state.people, key)) Object.defineProperty(state.people, key, {enumerable:true, writable:true, configurable:true,
      value:{name, trades:{}, signals:[], confirmedLimit:false, lastFinished:0, next:0, revision:0, checking:false, error:'', failures:0}});
    return state.people[key];
  }
  function summary(p) {
    if (!p) return {known:false, accepted:0, pending:0, free:3, color:'green'};
    const rows = Object.values(p.trades), accepted = rows.filter(r => r.status === 'accepted').length;
    const pending = rows.filter(r => r.status === 'pending').length;
    const a = p.confirmedLimit ? 3 : Math.min(3, accepted), free = Math.max(0, 3 - a - pending);
    return {known:rows.length > 0 || p.confirmedLimit, accepted:a, pending:Math.min(3-a,pending), free,
      color:a === 3 ? 'red' : free === 0 ? 'yellow' : 'green'};
  }
  function normalizeTrade(row) {
    const t={...row};
    // Old v0.1.0 events and records used one ambiguous field. Only the source-specific data decides its meaning.
    if(t.tradeId && !t.ownerCardId && !t.offerId) {
      if(t.cardId)t.ownerCardId=id(t.tradeId);else t.offerId=id(t.tradeId);
    }
    delete t.tradeId;
    t.recordId=t.ownerCardId?'send:'+t.ownerCardId+':'+(t.startedAt||t.sentAt):'offer:'+t.offerId;
    return t;
  }
  function timingWindow(t) {
    if(!Number.isFinite(t.serverDateAt))return null;
    let duration=t.requestDurationMs,source=t.durationSource||'request';
    if(!Number.isFinite(duration) && Number.isFinite(t.startedAt) && Number.isFinite(t.observedAt)){
      duration=t.observedAt-t.startedAt;source='legacy-click-span';
    }
    if(!Number.isFinite(duration) || duration<0 || duration>120000)return null;
    return {durationMs:duration,source,estimatedAt:t.serverDateAt-duration,from:t.serverDateAt-duration-1000,to:t.serverDateAt+1000,paddingMs:1000};
  }
  function timeMatch(t,at) {
    if(!Number.isFinite(at) || day(at)!==day(t.sentAt))return '';
    if(t.exact && at===t.sentAt)return 'exact';
    // Once the site's offer/history timestamp is known it must not drift again.
    if(t.offerId || t.historyKey)return '';
    if(Number.isFinite(t.serverDateAt)){
      const w=timingWindow(t);
      return w && at>=w.from && at<=w.to ? (w.source==='legacy-click-span'?'legacy-window':'request-window') : '';
    }
    return !t.exact && at>=(t.startedAt||t.sentAt)-5000 && at<=t.sentAt+5000?'local-window':'';
  }
  function uniqueTimePairs(locals,remotes,compatible,allowFallback=true) {
    const found=[],takenLocal=new Set(),takenRemote=new Set();
    // Reserve mutually unique exact matches before considering request intervals.
    for(const exact of [true,false]){
      if(!exact && !allowFallback)break;
      const pairs=locals.filter(t=>!takenLocal.has(t)).map(local=>({local,candidates:remotes.filter(remote=>{
        const method=timeMatch(local,remote.sentAt);
        return !takenRemote.has(remote) && compatible(local,remote) && method && (exact?method==='exact':method!=='exact');
      })}));
      for(const {local,candidates}of pairs){
        if(candidates.length!==1 || pairs.filter(p=>p.candidates.includes(candidates[0])).length!==1)continue;
        const remote=candidates[0];found.push({local,remote,method:timeMatch(local,remote.sentAt)});
        takenLocal.add(local);takenRemote.add(remote);
      }
      // An ambiguous exact group cannot be reassigned to a weaker interval match.
      if(exact)for(const p of pairs)if(p.candidates.length){takenLocal.add(p.local);for(const r of p.candidates)takenRemote.add(r);}
    }
    return found;
  }
  function linkable(local,remote) {
    if(nick(local.name)!==nick(remote.name) || (local.cardId && remote.cardId && local.cardId!==remote.cardId))return false;
    if(local.status==='rejected' && remote.status==='accepted' || local.status==='accepted' && remote.status==='rejected')return false;
    return !!timeMatch(local,remote.sentAt);
  }
  function linkTrades(p) {
    const rows=Object.values(p.trades),locals=rows.filter(t=>t.ownerCardId && !t.offerId),remotes=rows.filter(t=>t.offerId && !t.ownerCardId);
    let merged=0;
    for(const {local,remote,method}of uniqueTimePairs(locals,remotes,linkable)) {
      local.timeMatch={source:'offers',method,siteSentAt:remote.sentAt,deltaSeconds:Number.isFinite(local.serverDateAt)?(remote.sentAt-local.serverDateAt)/1000:null};
      local.offerId=remote.offerId;local.sentAt=remote.sentAt;local.exact=true;
      if(!local.cardId && remote.cardId)local.cardId=remote.cardId;
      if(remote.status==='accepted' || remote.status==='rejected') {
        local.status=remote.status;
        for(const k of ['historyKey','acceptanceNotice','rejectionNotice'])if(remote[k])local[k]=remote[k];
      }
      delete p.trades[remote.recordId];merged++;
    }
    return merged;
  }
  function putTrade(state, row, now = Date.now(), deferLink=false) {
    if (!Number.isFinite(row.sentAt) || day(row.sentAt) !== state.day || (row.sentAt > now + 5000 && row.serverDateAt!==row.sentAt)) return false;
    row=normalizeTrade(row);
    if(!row.offerId && !row.ownerCardId)return false;
    const p = person(state, row.name), old = Object.values(p.trades).find(t=>
      row.offerId && t.offerId===row.offerId || row.ownerCardId && t.recordId===row.recordId);
    if (old) {
      if (old.cardId && row.cardId && old.cardId !== row.cardId) { p.error='ID_CONFLICT'; return false; }
      if (row.exact && (!row.serverDateAt || (!old.offerId && old.status==='pending'))) { old.sentAt=row.sentAt; old.exact=true; }
      if (row.cardId) old.cardId=row.cardId;
      if(Number.isFinite(row.serverDateAt)){old.serverDateAt=row.serverDateAt;old.observedAt=row.observedAt;old.timeSource='response-date';}
      for(const key of ['requestStartedAt','requestDurationMs','durationSource'])if(row[key]!==undefined)old[key]=row[key];
      if(!deferLink)linkTrades(p);
      return false;
    }
    p.trades[row.recordId]={...row, status:'pending'};
    if(!deferLink)linkTrades(p);
    p.revision++; p.next=Math.max(now,p.lastFinished+MINUTE); return true;
  }
  function auditSendTimes(s, now=Date.now()) {
    for(const p of Object.values(s.people))for(const t of Object.values(p.trades)) {
      if(!Number.isFinite(t.serverDateAt))continue;
      let status='waiting',candidates=[];
      if(t.offerId || t.historyKey){status=t.sentAt===t.serverDateAt?'matched':t.timeMatch?'adjusted':'mismatch';candidates=[{offerId:t.offerId||'',sentAt:t.sentAt}];}
      else {
        const remotes=Object.values(p.trades).filter(r=>r.offerId && !r.ownerCardId && Math.abs(r.sentAt-t.serverDateAt)<=MINUTE);
        const exact=remotes.filter(r=>timeMatch(t,r.sentAt));
        if(exact.length){status='ambiguous';candidates=exact;}
        else if(remotes.length){status='mismatch';candidates=remotes;}
      }
      const detail={ownerCardId:t.ownerCardId,serverDateAt:t.serverDateAt,status,window:timingWindow(t),match:t.timeMatch||null,candidates:candidates.map(r=>({offerId:r.offerId,sentAt:r.sentAt,deltaSeconds:(r.sentAt-t.serverDateAt)/1000})).sort((a,b)=>a.offerId.localeCompare(b.offerId))};
      for(const [kind,check]of Object.entries(t.historyTimeChecks||{})){
        const signature=JSON.stringify(check.detail);
        if(check.logged===signature)continue;
        s.log.push({at:now,code:'HISTORY_TIME_CHECK',name:p.name,detail:{ownerCardId:t.ownerCardId,kind,...check.detail}});
        check.logged=signature;
      }
      if(JSON.stringify(t.timeCheck?.detail)===JSON.stringify(detail))continue;
      t.timeCheck={at:now,detail};
      s.log.push({at:now,code:'SEND_TIME_'+status.toUpperCase(),name:p.name,detail});s.log=s.log.slice(-160);
    }
    s.log=s.log.slice(-160);
  }
  function repairPendingTimes(s,now=Date.now()) {
    if(s.timingRepair===1)return {changed:false,merged:0};
    let merged=0,legacy=0;
    for(const p of Object.values(s.people)){
      for(const t of Object.values(p.trades)){
        if(t.status!=='pending' || t.offerId || t.historyKey || Number.isFinite(t.requestDurationMs))continue;
        const w=timingWindow(t);if(!w)continue;
        t.requestDurationMs=w.durationMs;t.durationSource=w.source;legacy++;
      }
      const count=linkTrades(p);merged+=count;
      if(count){p.error='';p.failures=0;p.revision++;p.next=Math.max(now,p.lastFinished+MINUTE);}
    }
    s.timingRepair=1;s.log.push({at:now,code:'TIMING_REPAIR',name:'',detail:{merged,legacy}});
    auditSendTimes(s,now);return {changed:true,merged,legacy};
  }
  function putOffers(state,rows,now=Date.now()) {
    // Link only after the entire snapshot is inserted, not greedily against its first row.
    for(const row of rows)putTrade(state,row,now,true);
    for(const p of Object.values(state.people)) {
      linkTrades(p);
      if(!p.limitObservedAt && !p.signals.length && !Object.values(p.trades).some(t=>t.status==='pending'))p.next=0;
    }
    auditSendTimes(state,now);
  }
  function migrate(state,now=Date.now()) {
    if(state.schema===SCHEMA)return {changed:false,merged:0};
    let merged=0;
    for(const p of Object.values(state.people)) {
      const converted={};
      for(const [key,row] of Object.entries(p.trades)) {
        const t=normalizeTrade(row);if(!t.ownerCardId && !t.offerId)t.recordId='legacy:'+key;
        converted[t.recordId]=t;
      }
      p.trades=converted;merged+=linkTrades(p);
      if(p.error==='CARD_ID_UNAVAILABLE' || p.error==='NETWORK_OR_RESPONSE'){p.error='';p.failures=0;}
      if(!p.confirmedLimit && Object.values(p.trades).some(t=>t.status==='pending'))p.next=Math.max(now,p.lastFinished+MINUTE);
    }
    state.schema=SCHEMA;state.version=VERSION;
    return {changed:true,merged};
  }
  function matches(row, trade) {
    return !!trade.cardId && row.gained.includes(trade.cardId) && !!timeMatch(trade,row.sentAt);
  }
  function historyTimePairs(p,rows,complete,pendingIds,outcome) {
    const used=new Set(Object.values(p.trades).map(t=>t.historyKey).filter(Boolean));
    const pending=Object.values(p.trades).filter(t=>t.status==='pending' && !(t.offerId && pendingIds?.has(t.offerId)));
    const available=rows.filter(r=>!used.has(r.key) && (outcome==='rejected'?r.outcome==='rejected':r.outcome!=='rejected'));
    const pairs=uniqueTimePairs(pending,available,(t,r)=>matches(r,t),complete);
    for(const t of pending){
      const pair=pairs.find(x=>x.local===t),near=available.filter(r=>r.gained.includes(t.cardId)||Math.abs(r.sentAt-t.sentAt)<=MINUTE);
      const detail={cardId:t.cardId||'',serverDateAt:t.serverDateAt??null,window:timingWindow(t),complete,status:pair?'matched':'unresolved',method:pair?.method||null,candidateCount:near.length,candidates:near.slice(0,10).map(r=>({sentAt:r.sentAt,gained:r.gained,cardMatches:r.gained.includes(t.cardId),timeMatch:timeMatch(t,r.sentAt),deltaSeconds:Number.isFinite(t.serverDateAt)?(r.sentAt-t.serverDateAt)/1000:null}))};
      t.historyTimeChecks ||= {};const old=t.historyTimeChecks[outcome];t.historyTimeChecks[outcome]={detail,logged:old?.logged};
    }
    return pairs;
  }
  function reconcile(p, rows, complete, signals = [], pendingIds = null) {
    const newlyAccepted=[];
    for (const {local:t,remote:r,method}of historyTimePairs(p,rows,complete,pendingIds,'accepted')) {
      t.timeMatch={source:'history',method,siteSentAt:r.sentAt,deltaSeconds:Number.isFinite(t.serverDateAt)?(r.sentAt-t.serverDateAt)/1000:null};
      t.status='accepted'; t.historyKey=r.key; t.sentAt=r.sentAt; t.exact=true;newlyAccepted.push(t);
    }
    // Notifications trigger history checks; absence never proves a refusal.
    const resolved = [];
    for(const signal of signals.filter(s=>s.kind==='accepted').sort((a,b)=>a.at-b.at)) {
      const candidate=newlyAccepted.find(t=>t.sentAt<=signal.at+5000 && !t.acceptanceNotice);
      if(candidate){candidate.acceptanceNotice=signal.noticeId;resolved.push(signal.noticeId);}
    }
    if (summary(p).accepted === 3) p.confirmedLimit=true;
    return resolved;
  }
  function reconcileCancelled(p, rows, complete, signals=[], pendingIds=null) {
    if(!complete)return [];
    const resolved=[];
    for(const {local:t,remote:r,method}of historyTimePairs(p,rows,complete,pendingIds,'rejected')) {
      t.timeMatch={source:'cancelled-history',method,siteSentAt:r.sentAt,deltaSeconds:Number.isFinite(t.serverDateAt)?(r.sentAt-t.serverDateAt)/1000:null};
      t.status='rejected';t.historyKey=r.key;t.sentAt=r.sentAt;t.exact=true;
      const signal=signals.find(s=>s.kind==='rejected' && s.at+5000>=t.sentAt && !resolved.includes(s.noticeId));
      if(signal){t.rejectionNotice=signal.noticeId;resolved.push(signal.noticeId);}
    }
    return resolved;
  }
  function nextCheckKey(s, now=Date.now()) {
    const eligible=key=>{const p=lookup(s.people,key);return p && !p.confirmedLimit && p.next>0;};
    s.round=(Array.isArray(s.round)?s.round:[]).filter(eligible);
    if(!s.round.length)s.round=Object.keys(s.people).filter(eligible).sort((a,b)=>s.people[a].next-s.people[b].next);
    const index=s.round.findIndex(key=>s.people[key].next<=now);
    return index<0?null:s.round.splice(index,1)[0];
  }
  function bufferNotices(s, notices) {
    s.unmatchedNotices ||= {};
    for(const n of notices)if(day(n.at)===s.day && !s.notices[n.noticeId])s.unmatchedNotices[n.noticeId]=n;
  }
  function drainNotices(s, now=Date.now()) {
    const attached=[];
    for(const [key,n]of Object.entries(s.unmatchedNotices||{})) {
      if(day(n.at)!==s.day || s.notices[key]){delete s.unmatchedNotices[key];continue;}
      const p=lookup(s.people,nick(n.name));
      if(!p)continue;
      if(p.confirmedLimit){s.notices[key]=n.at;delete s.unmatchedNotices[key];continue;}
      if(!Object.values(p.trades).some(t=>t.status==='pending' && t.sentAt<=n.at+5000))continue;
      s.notices[key]=n.at;delete s.unmatchedNotices[key];
      if(!p.signals.some(x=>x.noticeId===key))p.signals.push(n);
      p.revision++;p.reason='notification';p.next=Math.max(now,p.lastFinished+MINUTE);attached.push(n);
    }
    return attached;
  }
  function rateWait(times, now) {
    const recent=times.filter(t => now-t < MINUTE);
    return Math.max(0, (recent.at(-1) || 0)+700-now, recent.length >= 90 ? recent[recent.length-90]+MINUTE-now : 0);
  }
  function observeBadge(s, count, at) {
    if (!Number.isInteger(count) || count<0 || at<(s.badgeAt||0)) return;
    // The baseline is shared by all pages/tabs. A page load is not a new notification.
    const first=s.badge==null, increased=!first && count>s.badge;
    if (count===0) s.notificationDue=0;
    else if ((increased || (first && at-s.listAt>20000)) && !s.notificationDue) s.notificationDue=at+20000;
    s.badge=count;s.badgeAt=at;
  }
  function observeNoticeBatch(s, data, at) {
    const legacy=Array.isArray(data), notices=legacy?data:data.notices;
    if(!legacy && data.source==='response' && at>=s.listAt) {
      s.listAt=at;s.notificationDue=0;
      if(Number.isInteger(data.count) && data.count>=0 && at>=(s.badgeAt||0)) {s.badge=data.count;s.badgeAt=at;}
    }
    bufferNotices(s,notices||[]);
  }
  function fingerprint(text) {
    // Storage keys must not contain whole lists of offers/HTML.
    let a=2166136261,b=5381;
    for(const c of String(text)){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}
    return (a>>>0).toString(16)+(b>>>0).toString(16);
  }
  const Core={day,msk,nick,ownerName,account,ownerTileSelector,offerPage,parseOffers,parseHistory,parseNotices,fresh,person,putTrade,putOffers,linkTrades,migrate,summary,matches,reconcile,reconcileCancelled,nextCheckKey,bufferNotices,drainNotices,observeNoticeBatch,rateWait,observeBadge,responseDate,sendRequestIds,auditSendTimes,timingWindow,timeMatch,repairPendingTimes};
  if (typeof module !== 'undefined' && module.exports) { module.exports=Core; return; }
  if (typeof document === 'undefined') return;

  const pageWindow = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
  const nativeFetch = window.fetch.bind(window), sleep = ms => new Promise(r => setTimeout(r,ms));
  const tabId=crypto.randomUUID(), eventPrefix=PREFIX+'event:', statePrefix=PREFIX+'state:';
  let own='', state=null, leader=false, halted=false, observerTimer=0, prepared=null, clickedAt=0, lastScan='', dialog=null;
  let storageError='', liveError='', running=true, observedAccount='';
  let settings=host ? host.settings() : GM_getValue(PREFIX+'settings',{enabled:true, mode:'dots'});
  const emitted=new Set(), confirmedHere=new Set();
  const stateKey=()=>statePrefix+encodeURIComponent(nick(own));
  const activeTab=()=>document.visibilityState==='visible' && document.hasFocus();
  function log(code, name='', detail='') {
    if (!state) return;
    if(host){
      state.metrics ||= {checks:0,errors:0,requests:0};
      if(code==='CHECK_START')state.metrics.checks++;
      if(code==='CHECK_ERROR' && !['CONTEXT_CHANGED','TAB_INACTIVE'].includes(detail) || code==='CHECK_DONE' && !['red','green','yellow'].includes(detail) || code==='NOTICES_ERROR')state.metrics.errors++;
    }
    state.log.push({at:Date.now(),code,name,detail}); state.log=state.log.slice(-160);
  }
  function save() {
    if(host && !host.ownsLock()) return false;
    try { state.version=VERSION; GM_setValue(stateKey(), state); if(host)for(const entry of state.log)host.report(entry); return true; } catch { storageError='Не удалось сохранить данные. Проверки остановлены.'; halted=true; host?.report({code:'STORAGE_ERROR'}); return false; }
  }
  function emit(kind, data, signature) {
    const who=account(document);
    const fp=nick(who)+':'+day()+':'+kind+':'+fingerprint(signature);
    if (!who || !settings.enabled || (host && !host.settings().enabled) || emitted.has(fp)) return;
    try {
      const key=eventPrefix+crypto.randomUUID();
      GM_setValue(key,{kind,data,account:nick(who),day:day(),at:Date.now(),fingerprint:fp});
      emitted.add(fp); if (emitted.size>1500) emitted.clear();
    } catch { storageError='Не удалось записать событие. Проверьте хранилище Tampermonkey.'; host?.report({code:'STORAGE_ERROR'}); }
  }
  function requestCheck(p, kind, at=Date.now()) {
    if (p.confirmedLimit) return;
    p.revision++; p.reason=kind; p.next=Math.max(at,p.lastFinished+MINUTE);
  }
  function consume() {
    for (const key of GM_listValues().filter(k=>k.startsWith(eventPrefix))) {
      const e=GM_getValue(key,null);
      if (!e) continue;
      if (e.day!==state.day) { GM_deleteValue(key); continue; }
      if (e.account!==state.account) continue;
      if (state.seen[e.fingerprint]) { GM_deleteValue(key); continue; }
      const d=e.data;
      if (e.kind==='send') {
        if (putTrade(state,d)) { log('SEND_CONFIRMED',d.name,d.ownerCardId||d.tradeId); }
        if(d.timeSource)log(d.serverDateAt!=null?'SEND_SERVER_DATE':'SEND_DATE_UNAVAILABLE',d.name,{ownerCardId:d.ownerCardId,serverDateAt:d.serverDateAt??null,observedAt:d.observedAt,requestStartedAt:d.requestStartedAt,requestDurationMs:d.requestDurationMs,durationSource:d.durationSource,window:timingWindow(d),transport:d.transport});
        auditSendTimes(state);
      } else if (e.kind==='offers') {
        putOffers(state,d.rows);
      } else if (e.kind==='limit') {
        const p=person(state,d.name); p.limitObservedAt=e.at; requestCheck(p,'limit'); log('LIMIT_SEEN',d.name);
      } else if (e.kind==='notices') {
        observeNoticeBatch(state,d,e.at);
      } else if (e.kind==='badge') {
        observeBadge(state,d.count,e.at);
      } else if (e.kind==='check') {
        const p=lookup(state.people,nick(d.name));
        if (p && (p.signals.length || Object.values(p.trades).some(t=>t.status==='pending') || p.limitObservedAt)) requestCheck(p,'manual');
      }
      state.seen[e.fingerprint]=e.at;
      const oldKeys=Object.keys(state.seen);if(oldKeys.length>3000)for(const k of oldKeys.slice(0,oldKeys.length-3000))delete state.seen[k];
      if(!save())return;
      GM_deleteValue(key);
    }
    const attached=drainNotices(state);
    for(const n of attached)log('NOTICE_'+n.kind.toUpperCase(),n.name,n.noticeId);
    if(attached.length)save();
  }
  function ensureContext(token) {
    if (!running || !settings.enabled || (host && (!host.settings().enabled || !host.ownsLock())) || halted || token!==state?.day || token!==day() || nick(account(document))!==state.account) throw Error('CONTEXT_CHANGED');
  }
  async function get(path, token, json=false) {
    const target=url(path);
    if (!target || !(/^\/trades\/(offers|history)\//.test(target.pathname) || target.pathname==='/user/cards/' ||
      /^\/cards\/\d+\/trade\/$/.test(target.pathname) || (target.pathname==='/ajax/notifications/' && target.searchParams.get('action')==='list'))) throw Error('URL_NOT_ALLOWED');
    while (true) {
      ensureContext(token);
      if(!activeTab())throw Error('TAB_INACTIVE');
      const now=Date.now(), times=GM_getValue(PREFIX+'requests',[]).filter(t=>now-t<MINUTE), wait=rateWait(times,now);
      if (wait>0) { await sleep(Math.min(wait,1000)); continue; }
      times.push(now); GM_setValue(PREFIX+'requests',times); break;
    }
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15000);
    if(host){state.metrics ||= {checks:0,errors:0,requests:0};state.metrics.requests++;}
    try {
      const response=await nativeFetch(target.href,{method:'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,redirect:'error'});
      ensureContext(token);
      if (!response.ok) throw Error('HTTP_'+response.status);
      const text=await response.text(); ensureContext(token);
      if (text.length>5000000) throw Error('RESPONSE_TOO_LARGE');
      if (json) return JSON.parse(text);
      const doc=inert(text);
      if (nick(account(doc))!==state.account) throw Error('ACCOUNT_OR_LOGIN');
      return doc;
    } catch (e) {
      const message=/^(HTTP_\d+|CONTEXT_CHANGED|ACCOUNT_OR_LOGIN|RESPONSE_TOO_LARGE)$/.test(e.message) ? e.message : 'NETWORK_OR_RESPONSE';
      if (/^HTTP_(401|403|429)$/.test(message) || message==='ACCOUNT_OR_LOGIN') { state.pauseUntil=Date.now()+300000; }
      throw Error(message);
    } finally { clearTimeout(timer); }
  }
  async function offers(token) {
    let path='/trades/offers/', total=null, rows=[], pages=0;
    const seen=new Set();
    while (path && pages++<30) {
      const part=parseOffers(await get(path,token),path);
      if (total!==null && total!==part.total) throw Error('OFFERS_CHANGED');
      total=part.total;
      for (const row of part.rows) { if (seen.has(row.offerId)) throw Error('OFFERS_CHANGED'); seen.add(row.offerId); rows.push(row); }
      path=part.next;
    }
    if (path || rows.length!==total) throw Error('OFFERS_INCOMPLETE');
    putOffers(state,rows);
    return rows;
  }
  async function history(p,token,kind='') {
    let path='/trades/history/?name='+encodeURIComponent(own)+'&trader='+encodeURIComponent(p.name)+(kind?'&kind='+kind:''), rows=[], pages=0, last=Infinity;
    while (path && pages++<12) {
      const part=parseHistory(await get(path,token),path,p.name,own,kind);
      if (part.rows[0]?.sentAt>last) throw Error('HISTORY_CHANGED');
      const today=part.rows.filter(r=>day(r.sentAt)===token);
      rows.push(...today); last=part.rows.at(-1)?.sentAt ?? last;
      if (part.rows.some(r=>day(r.sentAt)<token) || !part.next) return {rows,complete:true};
      path=part.next;
    }
    throw Error('HISTORY_INCOMPLETE');
  }
  async function probe(p,token) {
    const doc=await get('/user/cards/?name='+encodeURIComponent(p.name)+'&locked=0',token);
    const card=[...doc.querySelectorAll('.anime-cards__item[data-can-trade="1"][data-owner-id]')]
      .find(el=>nick(el.dataset.profile)===nick(p.name) && id(el.dataset.ownerId));
    if (!card) throw Error('NO_PROBE_CARD');
    const page=offerPage(await get('/cards/'+card.dataset.ownerId+'/trade/',token));
    if (!page || nick(page.name)!==nick(p.name)) throw Error('PROBE_MARKUP');
    return page.limit ? 'limit' : page.ready ? 'available' : 'unknown';
  }
  async function verify(p) {
    const token=state.day, revision=p.revision, start=Date.now();
    p.checking=true; p.error=''; save(); log('CHECK_START',p.name,p.reason||'pending');
    try {
      if (p.signals.length) {
        const resolved=[];
        const kinds=p.signals.every(s=>s.kind==='rejected')?['calsel_sender','']:['','calsel_sender'];
        for(const kind of kinds) {
          const result=await history(p,token,kind);
          resolved.push(...(kind?reconcileCancelled:reconcile)(p,result.rows,result.complete,p.signals));
          if(!Object.values(p.trades).some(t=>t.status==='pending'))break;
        }
        p.signals=p.signals.filter(s=>!resolved.includes(s.noticeId));
        if(!Object.values(p.trades).some(t=>t.status==='pending'))p.signals=[];
        if (Object.values(p.trades).some(t=>t.status==='pending')) p.error='HISTORY_UNRESOLVED';
      } else {
        const list=await offers(token), mine=list.filter(t=>nick(t.name)===nick(p.name) && day(t.sentAt)===token);
        const pendingIds=new Set(mine.map(t=>t.offerId));
        if (!mine.length && (summary(p).accepted+summary(p).pending>=3 || p.limitObservedAt)) {
          const result=p.limitObservedAt && start-p.limitObservedAt<20000 ? 'limit' : await probe(p,token);
          if (result==='limit') {
            // A send in another tab after the snapshot invalidates its "no pending" conclusion.
            const newer=GM_listValues().filter(k=>k.startsWith(eventPrefix)).some(k=>{
              const e=GM_getValue(k,null);return e?.account===state.account && e.day===token && e.kind==='send' && nick(e.data.name)===nick(p.name);
            });
            if(newer)throw Error('NEW_SEND_DURING_CHECK');
            p.confirmedLimit=true; log('LIMIT_CONFIRMED',p.name);
          }
          else if (result==='unknown') throw Error('PROBE_UNKNOWN');
        }
        if (!p.confirmedLimit && Object.values(p.trades).some(t=>t.status==='pending' && !pendingIds.has(t.offerId))) {
          const result=await history(p,token); reconcile(p,result.rows,result.complete,[],pendingIds);
          if(Object.values(p.trades).some(t=>t.status==='pending' && !pendingIds.has(t.offerId))) {
            const cancelled=await history(p,token,'calsel_sender');reconcileCancelled(p,cancelled.rows,cancelled.complete,[],pendingIds);
          }
          if (Object.values(p.trades).some(t=>t.status==='pending' && !pendingIds.has(t.offerId))) p.error='MISSING_WITHOUT_REFUSAL';
        }
        p.limitObservedAt=0;
      }
      ensureContext(token); p.failures=p.error?p.failures+1:0; log('CHECK_DONE',p.name,p.error||summary(p).color);
    } catch (e) {
      if(e.message==='TAB_INACTIVE' || (host && e.message==='CONTEXT_CHANGED')){p.error='';log('CHECK_PAUSED',p.name,'Вкладка неактивна или модуль выключен');}
      else {p.failures++; p.error=e.message; log('CHECK_ERROR',p.name,e.message);}
    }
    finally {
      p.checking=false; p.lastFinished=Date.now();
      p.next=p.lastFinished+Math.min(300000,MINUTE*Math.max(1,2**Math.min(p.failures,3)));
      if (p.confirmedLimit || (!p.error && !p.limitObservedAt && !p.signals.length && !Object.values(p.trades).some(t=>t.status==='pending') && p.revision===revision)) p.next=0;
      if (token===day() && nick(account(document))===state.account) {auditSendTimes(state);save();}
    }
  }
  async function notificationFallback(token) {
    state.notificationDue=0;
    const hash=String(pageWindow.dle_login_hash||'');
    if (!hash) { log('NOTICES_NO_SESSION_HASH'); state.notificationDue=Date.now()+60000; save(); return; }
    const params=new URLSearchParams({action:'list',notif_id:'false',delete_kind:'false',delete_sort:'false',user_hash:hash,_:String(Date.now())});
    try { observeResponse(await get('/ajax/notifications/?'+params,token,true)); log('NOTICES_FALLBACK'); }
    catch (e) { log('NOTICES_ERROR','',e.message); state.notificationDue=Date.now()+60000; }
    save();
  }
  async function work() {
    const name=account(document); if (!name || !settings.enabled || halted || !activeTab()) return;
    if (!host && !navigator.locks) { liveError='Нет Web Locks: фоновые проверки отключены во избежание дублей.'; return; }
    const withLock=host ? host.withLock : callback=>navigator.locks.request(PREFIX+'worker',{ifAvailable:true},callback);
    await withLock(async lock=>{
      if (!lock) return;
      leader=true; own=name;
      state=GM_getValue(stateKey(),null);
      if(host && state?.account===nick(own) && state.day<day())host.daily(state);
      if (!state || state.day!==day() || state.account!==nick(own)) state=fresh(own);
      if(state.schema!==SCHEMA) {
        const backup=PREFIX+'backup:0.1.0:'+state.account+':'+state.day;
        try {if(!GM_getValue(backup,null))GM_setValue(backup,state);}catch{storageError='Не удалось сохранить резервную копию. Миграция остановлена.';halted=true;leader=false;return;}
        const result=migrate(state);log('MIGRATED_IDS','',String(result.merged)+' пар объединено');
      }
      if(state.timingRepair!==1){
        const backup=PREFIX+'backup:timing-0.1.9:'+state.account+':'+state.day;
        try{if(Object.keys(state.people).length && !GM_getValue(backup,null))GM_setValue(backup,state);}
        catch{storageError='Не удалось сохранить резервную копию. Исправление времени остановлено.';halted=true;leader=false;return;}
        repairPendingTimes(state);
      }
      for (const p of Object.values(state.people)) { if (p.checking) { p.checking=false; p.next=Math.max(p.next,Date.now()+MINUTE); } }
      save();
      try {
        while (running && settings.enabled && (!host || (host.settings().enabled && host.ownsLock())) && !halted && activeTab() && nick(account(document))===nick(own)) {
          if (state.day!==day()) { if(host)host.daily(state);state=fresh(own); prepared=null; save(); }
          consume();
          if ((state.pauseUntil||0)>Date.now()) { await sleep(1000); continue; }
          if (state.notificationDue && state.notificationDue<=Date.now()) await notificationFallback(state.day);
          else {
            const key=nextCheckKey(state);
            if(key!==null)await verify(state.people[key]);
            else await sleep(1000);
          }
        }
      } finally { leader=false; }
    });
  }
  function observeResponse(data) {
    try {
      if(!settings.enabled || (host && !host.settings().enabled))return;
      if (!data || typeof data!=='object' || (typeof data.notice_list!=='string' && typeof data.notice_list_small!=='string')) return;
      const html=String(data.notice_list||data.notice_list_small||'');
      if (html.length>1000000) return;
      const notices=parseNotices(inert(html));
      const count=/^\d+$/.test(String(data.notice_count))?Number(data.notice_count):null;
      emit('notices',{notices,count,source:'response'},'response:'+Date.now()+':'+tabId);
    } catch { /* Never affect the site's own request. */ }
  }
  function isNotifications(value) { const u=url(value); return u?.pathname==='/ajax/notifications/' && u.searchParams.get('action')==='list'; }
  function sendContext() {
    if(!settings.enabled || (host && !host.settings().enabled))return null;
    return prepared && clickedAt && Date.now()-clickedAt<120000?{...prepared,startedAt:clickedAt,requestDay:day()}:null;
  }
  function requestTiming(ctx) {
    return {requestStartedAt:ctx.requestStartedAt,observedAt:Date.now(),requestDurationMs:Math.max(0,performance.now()-ctx.requestPerfAt),durationSource:'request'};
  }
  function observeSend(ctx, ids, data, dateHeader, status, transport, timing) {
    try {
      if(!ctx || !ids || ids.ownerCardId!==ctx.ownerCardId || ids.cardId!==ctx.cardId || ctx.account!==nick(account(document)) || ctx.requestDay!==day() || status<200 || status>=300)return;
      if(typeof data?.html!=='string' || data.html.length>1000000)return;
      const success=[...inert(data.html).querySelectorAll('.message-info__content')].some(el=>clean(el.textContent)==='Обмен отправлен, дождитесь его рассмотрения получателем');
      if(!success)return;
      const now=Date.now(),serverDateAt=responseDate(dateHeader);
      if(serverDateAt!==null && day(serverDateAt)!==day(now))return;
      emit('send',{name:ctx.name,ownerCardId:ctx.ownerCardId,cardId:ctx.cardId,startedAt:ctx.startedAt,sentAt:serverDateAt??now,exact:serverDateAt!==null,serverDateAt,...timing,timeSource:serverDateAt!==null?'response-date':'local-fallback',transport},'send-time:'+ctx.ownerCardId+':'+ctx.startedAt+':'+transport);
      confirmedHere.add(ctx.ownerCardId);
      if(clickedAt===ctx.startedAt){prepared=null;clickedAt=0;}
    }catch{/* Diagnostics must never interfere with sending. */}
  }
  const xhrRequests=new WeakMap();
  const sendAwaiting=new Map();
  function awaitingSend(ctx,delta) {
    const count=(sendAwaiting.get(ctx.startedAt)||0)+delta;
    if(count>0)sendAwaiting.set(ctx.startedAt,count);else sendAwaiting.delete(ctx.startedAt);
  }
  function hooks() {
    if(!settings.enabled)return;
    try {
      const flag=host?'__suiteTradeLimits':'__asTradeLimits';
      const installed=fn=>host?host.hookInstalled(fn,flag):fn?.[flag];
      const proto=pageWindow.XMLHttpRequest?.prototype;
      if (proto && !installed(proto.open)) {
        const original=proto.open;
        function open(method,address) {
          if(host && !host.settings().enabled)return original.apply(this,arguments);
          xhrRequests.set(this,{method,address});
          const capture=isNotifications(address);
          const who=nick(account(document)), requestDay=day();
          this.addEventListener('load',function () { if (capture && who && who===nick(account(document)) && requestDay===day() && this.status>=200 && this.status<300) {
            try { observeResponse(this.responseType==='json'?this.response:JSON.parse(this.responseText)); } catch { /* non-JSON */ }
          } },{once:true});
          return original.apply(this,arguments);
        }
        open[flag]=true;open.__suiteTradeLimitsOriginal=original; proto.open=open;
      }
      if(proto && !installed(proto.send)) {
        const original=proto.send;
        function send(body) {
          let release=()=>{};
          try {
            const req=xhrRequests.get(this),ctx=sendContext(),ids=req&&sendRequestIds(req.address,req.method,body);
            if(ctx && ids){
              let pending=true,received=null;awaitingSend(ctx,1);
              const onState=()=>{if(this.readyState===4 && !received)received=requestTiming(ctx);};
              release=()=>{if(pending){pending=false;this.removeEventListener('readystatechange',onState);awaitingSend(ctx,-1);}};
              this.addEventListener('readystatechange',onState);
              this.addEventListener('loadend',function(){try{observeSend(ctx,ids,this.responseType==='json'?this.response:JSON.parse(this.responseText),this.getResponseHeader('Date'),this.status,'xhr',received||requestTiming(ctx));}catch{}finally{release();}},{once:true});
              ctx.requestStartedAt=Date.now();ctx.requestPerfAt=performance.now();
            }
          }catch{}
          try{return original.apply(this,arguments);}catch(error){release();throw error;}
        }
        send[flag]=true;send.__suiteTradeLimitsOriginal=original;proto.send=send;
      }
      if (typeof pageWindow.fetch==='function' && !installed(pageWindow.fetch)) {
        const original=pageWindow.fetch;
        function fetch(input,init) {
          if(host && !host.settings().enabled)return original.apply(this,arguments);
          const who=nick(account(document)),requestDay=day();
          const address=typeof input==='string'?input:input?.url,method=init?.method||input?.method||'GET',ctx=sendContext();
          let body=Promise.resolve(init?.body);
          if(ctx && !init?.body && typeof input?.clone==='function'){try{body=input.clone().text();}catch{}}
          const ids=body.then(b=>{const found=sendRequestIds(address,method,b);if(ctx && found)awaitingSend(ctx,1);return found;}).catch(()=>null);
          let result;
          if(ctx){ctx.requestStartedAt=Date.now();ctx.requestPerfAt=performance.now();}
          try{result=original.apply(this,arguments);}catch(error){if(ctx)ids.then(found=>{if(found)awaitingSend(ctx,-1);});throw error;}
          if(ctx)result.then(r=>{const timing=requestTiming(ctx);let copy=null;try{if(r.ok)copy=r.clone();}catch{}return ids.then(async found=>{if(found)try{if(copy)observeSend(ctx,found,await copy.json(),r.headers.get('Date'),r.status,'fetch',timing);}finally{awaitingSend(ctx,-1);}});},()=>ids.then(found=>{if(found)awaitingSend(ctx,-1);})).catch(()=>{});
          if (isNotifications(typeof input==='string'?input:input?.url)) result.then(r=>{
            if (r.ok) r.clone().json().then(data=>{if(who && who===nick(account(document)) && requestDay===day())observeResponse(data);}).catch(()=>{});
          }).catch(()=>{});
          return result;
        }
        fetch[flag]=true;fetch.__suiteTradeLimitsOriginal=original; pageWindow.fetch=fetch;
      }
    } catch { liveError='Не удалось подключить перехват уведомлений; доступно наблюдение DOM.';host?.report({code:'HOOK_INSTALL_FAILED'}); }
  }
  function scan() {
    observerTimer=0;
    if(host)settings=host.settings();
    const name=account(document);
    if (nick(name)!==observedAccount) { observedAccount=nick(name); prepared=null; clickedAt=0; lastScan=''; }
    if (!name) { if(host)render(); return; }
    if (settings.enabled) {
      const p=offerPage(document), now=Date.now();
      if (p?.ready) prepared={...p, account:nick(name)};
      if (p?.success && prepared && prepared.ownerCardId===p.ownerCardId && prepared.account===nick(name) && clickedAt && !sendAwaiting.has(clickedAt) && now-clickedAt<120000 && day(clickedAt)===day(now)) {
        emit('send',{name:p.name,ownerCardId:p.ownerCardId,cardId:p.cardId,sentAt:now,startedAt:clickedAt,exact:false,serverDateAt:null,observedAt:now,timeSource:'local-fallback',transport:'dom'},'send:'+day()+':'+p.ownerCardId+':'+clickedAt);
        confirmedHere.add(p.ownerCardId);liveError='';
        prepared=null; clickedAt=0;
      } else if (p?.success && !prepared && !confirmedHere.has(p.ownerCardId)) liveError='Экран отправленного обмена: дату уточняем при посещении «Отправленные».';
      if (p?.limit) emit('limit',p,'limit:'+day()+':'+nick(p.name)+':'+tabId);
      if (/^\/trades\/offers\/(?:page\/\d+\/)?$/.test(location.pathname)) {
        try { const data=parseOffers(document,location.href); emit('offers',data,'offers:'+JSON.stringify(data.rows)); } catch { /* not loaded */ }
      }
      const notices=parseNotices(document.querySelector('#alertsDropdownList')||document.createDocumentFragment());
      if (notices.length) emit('notices',{notices,source:'dom'},'dom:'+notices.map(n=>n.noticeId).sort().join(','));
      const badge=document.querySelector('#MainBadgeCounter');
      if (badge) {
        const value=Number(badge.dataset.count ?? clean(badge.textContent));
        if (Number.isInteger(value) && value>=0 && String(value)!==lastScan) {
          lastScan=String(value); emit('badge',{count:value},'badge:'+tabId+':'+now+':'+value);
        }
      }
    }
    render();
  }
  document.addEventListener('click',e=>{
    if(!settings.enabled || (host && !host.settings().enabled))return;
    if (e.target instanceof Element && e.target.closest('#tradeOffer .trade__send-trade-btn')) {
      const p=offerPage(document); if (p?.ready) { prepared={...p,account:nick(account(document))}; clickedAt=Date.now(); }
    }
  },true);

  const CSS=`
  .astl-tile.astl-green{background:linear-gradient(135deg,#173a2bc9,#18231f)!important}
  .astl-tile.astl-yellow{background:linear-gradient(135deg,#65501cc9,#29241a)!important}
  .astl-tile.astl-red{background:linear-gradient(135deg,#652c37c9,#2d1a20)!important}
  .astl-tile.astl-checking{background:linear-gradient(110deg,var(--astl-base,#224535),#956125,var(--astl-base,#224535))!important;background-size:220% 100%!important;animation:astl-check 2s ease-in-out infinite}
  .astl-red{--astl-base:#652c37}.astl-yellow{--astl-base:#65501c}
  .card-show__owner.astl-tile{height:auto;min-height:92px;padding-bottom:7px;box-sizing:border-box}
  .card-show__owner.astl-tile.card-show__owner--online{border-color:#88ffbd!important;box-shadow:inset 0 0 0 1px #88ffbd,0 0 0 1px #10251b,0 0 0 2px #63f5a5,0 0 9px #63f5a559!important}
  .astl-mark{display:flex;align-items:center;justify-content:center;gap:5px;min-height:16px;margin:4px 0 0;font:600 11px/16px system-ui;color:#e0e8e4;width:100%}
  .astl-dot{display:block;width:7px;height:7px;border-radius:50%;box-shadow:0 0 0 1px #ffffff26}
  .astl-dot.green{background:#4cdd96}.astl-dot.red{background:#ff6d82}.astl-dot.yellow{background:#ffd35d}
  /* The site removes all three dark-theme markers for its light theme.
     CSS reacts immediately; no observer, polling or requests are needed.
     Scope paint/text to colored tiles: awakened owners retain native fills. */
  body:not(.dt-is-active):not(.dle_theme_dark):not([data-theme="dark"]) .astl-tile.astl-green{background:linear-gradient(135deg,#d7efdf,#edf8f1)!important;--astl-base:#d7efdf}
  body:not(.dt-is-active):not(.dle_theme_dark):not([data-theme="dark"]) .astl-tile.astl-yellow{background:linear-gradient(135deg,#fff0b8,#fff8df)!important;--astl-base:#fff0b8}
  body:not(.dt-is-active):not(.dle_theme_dark):not([data-theme="dark"]) .astl-tile.astl-red{background:linear-gradient(135deg,#f8d9df,#fff0f2)!important;--astl-base:#f8d9df}
  body:not(.dt-is-active):not(.dle_theme_dark):not([data-theme="dark"]) .astl-tile.astl-checking{background:linear-gradient(110deg,var(--astl-base,#d7efdf),#f7c786,var(--astl-base,#d7efdf))!important;background-size:220% 100%!important}
  body:not(.dt-is-active):not(.dle_theme_dark):not([data-theme="dark"]) .astl-tile:is(.astl-green,.astl-yellow,.astl-red,.astl-checking),
  body:not(.dt-is-active):not(.dle_theme_dark):not([data-theme="dark"]) .astl-tile:is(.astl-green,.astl-yellow,.astl-red,.astl-checking) :is(.card-show__owner-name,.astl-mark){color:#202b35!important}
  body:not(.dt-is-active):not(.dle_theme_dark):not([data-theme="dark"]) .astl-tile:is(.astl-green,.astl-yellow,.astl-red,.astl-checking) .astl-dot.green{background:#15824f}
  body:not(.dt-is-active):not(.dle_theme_dark):not([data-theme="dark"]) .astl-tile:is(.astl-green,.astl-yellow,.astl-red,.astl-checking) .astl-dot.yellow{background:#a66a00}
  body:not(.dt-is-active):not(.dle_theme_dark):not([data-theme="dark"]) .astl-tile:is(.astl-green,.astl-yellow,.astl-red,.astl-checking) .astl-dot.red{background:#c53050}
  body:not(.dt-is-active):not(.dle_theme_dark):not([data-theme="dark"]) .astl-tile:is(.astl-green,.astl-yellow,.astl-red,.astl-checking).card-show__owner--online{border-color:#078449!important;box-shadow:inset 0 0 0 1px #078449,0 0 0 1px #fff,0 0 0 2px #16985e,0 0 8px #16985e40!important}
  #astl-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0 18px;padding:10px 12px;border:1px solid #ffffff20;border-radius:12px;background:#1b2025;color:#ced6df;font:12px/1.4 system-ui}
  #astl-bar button,#astl-panel button,#astl-panel select{border:1px solid #ffffff30;border-radius:8px;background:#272c35;color:#eee;padding:7px 10px;font:inherit;cursor:pointer}
  #astl-bar .astl-status{flex:1;min-width:140px}
  #astl-panel{box-sizing:border-box;width:min(720px,calc(100vw - 24px));max-height:85vh;overflow:auto;background:#191d24;color:#e1e6ed;border:1px solid #495365;border-radius:16px;padding:20px;font:14px/1.5 system-ui}
  #astl-panel::backdrop{background:#000a}#astl-panel h2{margin:0 0 12px;font-size:20px}#astl-panel p{margin:10px 0}
  #astl-panel .astl-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}#astl-panel label{display:flex;gap:10px;align-items:center}
  #astl-panel pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;background:#10141b;padding:12px;border-radius:8px;max-height:230px;overflow:auto}
  @keyframes astl-check{50%{background-position:100% 0}}@media(prefers-reduced-motion:reduce){.astl-checking{animation:none!important}}
  `;
  function node(tag,cls,text) { const e=document.createElement(tag); if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e; }
  function loadView() {
    const who=account(document); if (!who) return null;
    const s=GM_getValue(statePrefix+encodeURIComponent(nick(who)),null); return s?.day===day()?s:null;
  }
  function render() {
    if (!document.body) return;
    if (!document.getElementById('astl-style')) { const style=node('style');style.id='astl-style';style.textContent=CSS;document.head.append(style); }
    const view=loadView(), who=nick(account(document));
    const ownerSelector=ownerTileSelector(location.pathname);
    const preserveBackground=/^\/cards\/[1-9]\d*\/awakened\/?$/.test(location.pathname);
    const list=!host && location.pathname==='/cards/users/'?document.querySelector('.card-show__owner-wrapper'):null;
    if(!list)document.getElementById('astl-bar')?.remove();
    if (list && !document.getElementById('astl-bar')) {
      const bar=node('div');bar.id='astl-bar';bar.append(node('strong','','Лимиты трейдов · отладка'),node('span','astl-status'));
      const button=node('button','','Настройки / журнал');button.type='button';button.onclick=openPanel;bar.append(button);list.before(bar);
    }
    const status=document.querySelector('#astl-bar .astl-status');
    const msg=!settings.enabled?'Выключено':storageError||liveError||(!who?'Не определён аккаунт':(!activeTab()?'Пауза: вкладка неактивна':view?.pauseUntil>Date.now()?'Пауза после ошибки сайта':'Исходящие · МСК · свободно / 3'));
    if (status && status.textContent!==msg) status.textContent=msg;
    for (const el of document.querySelectorAll('.astl-tile'+(ownerSelector?','+ownerSelector:''))) {
      const name=ownerName(el.getAttribute('href')), p=lookup(view?.people,nick(name));
      const active=!!ownerSelector && el.matches(ownerSelector) && settings.enabled && !!who && !!name && nick(name)!==who;
      if (!active) { for(const c of [...el.classList])if(c.startsWith('astl-'))el.classList.remove(c);el.querySelector('.astl-mark')?.remove();delete el.dataset.astlSignature;continue; }
      const s=summary(p), signature=JSON.stringify([s,p?.checking,p?.error,settings.mode,preserveBackground]);
      if (el.dataset.astlSignature===signature) continue;
      el.dataset.astlSignature=signature;
      for (const c of [...el.classList]) if(c.startsWith('astl-'))el.classList.remove(c);
      el.classList.add('astl-tile');
      if(!preserveBackground){
        el.classList.add('astl-'+s.color);
        if(p?.checking || p?.error)el.classList.add('astl-checking');
      }
      el.querySelector('.astl-mark')?.remove();
      const mark=node('span','astl-mark');
      const desc=`Вы → ${name}: свободно ${s.free}/3, принято ${s.accepted}, ожидает/уточняется ${s.pending}.`+(s.known?'':' Сегодня нет записанных отправок.');
      mark.title=desc+(p?.error?' Требуется уточнение: '+p.error:'');mark.setAttribute('aria-label',mark.title);
      if(settings.mode==='numbers')mark.textContent=s.free+'/3';
      else for(let i=0;i<3;i++)mark.append(node('i','astl-dot '+(i<s.accepted?'red':i<s.accepted+s.pending?'yellow':'green')));
      el.append(mark);
    }
    if(dialog?.open) {
      const pre=dialog.querySelector('pre'), v=view||fresh(account(document));
      const lines=Object.values(v.people).map(p=>`${p.name}: ${summary(p).free}/3; принято ${summary(p).accepted}; ожидает ${summary(p).pending}${p.error?' · '+p.error:''}`);
      const report=[`Версия ${VERSION} · ${v.day} МСК`,leader?'Эта вкладка обрабатывает очередь':'Очередь работает только в активной вкладке AnimeSSS',msg,...lines,'',...v.log.slice(-25).map(l=>new Date(l.at).toISOString()+` ${l.code} ${l.name} ${typeof l.detail==='object'?JSON.stringify(l.detail):l.detail}`)].join('\n');
      if(pre.textContent!==report)pre.textContent=report;
    }
  }
  function configure(key,value) { if(host)return;settings={...GM_getValue(PREFIX+'settings',settings),[key]:value};GM_setValue(PREFIX+'settings',settings);render(); }
  function openPanel() {
    if(host)return;
    if(!document.body)return;
    if(!dialog) {
      dialog=node('dialog');dialog.id='astl-panel';dialog.append(node('h2','','Лимиты трейдов · отладка'));
      dialog.append(node('p','','Отдельный скрипт. Только чтение: обмены не отправляет, не принимает и не отменяет. Учитываются ваши исходящие предложения. Если за сегодня нет записанных отправок, показаны три свободных места без дополнительных проверок.'));
      const label=node('label','','Наблюдение и фоновые проверки');const toggle=node('input');toggle.type='checkbox';toggle.checked=settings.enabled;toggle.onchange=()=>configure('enabled',toggle.checked);label.prepend(toggle);dialog.append(label);
      const select=node('select');for(const [v,t]of [['dots','Три кружка'],['numbers','Количество свободных: 0–3 / 3']]){const o=node('option','',t);o.value=v;select.append(o);}select.value=settings.mode;select.onchange=()=>configure('mode',select.value);dialog.append(select);
      dialog.append(node('p','','Зелёный — есть место; жёлтый — места заняты, но есть ожидающие; красный — подтверждён полный лимит. Оранжевый перелив — проверка или неопределённость. Очередь работает только в активной вкладке AnimeSSS. В 00:00 МСК история сбрасывается.'));
      const actions=node('div','astl-actions');
      const check=node('button','','Проверить ожидающие');check.onclick=()=>{for(const p of Object.values(loadView()?.people||{}))emit('check',{name:p.name},'manual:'+nick(p.name)+':'+Date.now());};
      const exportBtn=node('button','','Скачать диагностику');exportBtn.onclick=()=>{
        const data={version:VERSION,exportedAt:new Date().toISOString(),state:loadView(),errors:[storageError,liveError].filter(Boolean)};
        const a=node('a'), blob=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=blob;a.download='animesss-trade-limits-'+day()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(blob),2000);
      };
      const close=node('button','','Закрыть');close.onclick=()=>dialog.close();actions.append(check,exportBtn);
      actions.append(close);dialog.append(actions,node('pre'));document.body.append(dialog);
    }
    if(!dialog.open)dialog.showModal();render();
  }
  if(!host){
    GM_registerMenuCommand('Лимиты трейдов — настройки и журнал',openPanel);
    GM_addValueChangeListener(PREFIX+'settings',(_k,_o,v)=>{if(v)settings=v;scan();});
  }
  const observer=new MutationObserver(records=>{
    if(records.every(r=>r.target instanceof Element && (r.target.closest('#astl-bar,#astl-panel,.astl-mark') ||
      (r.type==='childList' && [...r.addedNodes,...r.removedNodes].every(n=>n instanceof Element && n.classList.contains('astl-mark'))))))return;
    if(!observerTimer)observerTimer=setTimeout(scan,100);
  });
  let observing=false;
  function refresh(){
    if(host)settings=host.settings();
    if(settings.enabled && !observing){observer.observe(document,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-count']});observing=true;}
    if(!settings.enabled){observer.disconnect();observing=false;prepared=null;clickedAt=0;}
    if(settings.enabled || !host || dialog?.open || document.querySelector('.astl-tile')){scan();hooks();}
  }
  refresh();
  setInterval(refresh,2000);
  let attempting=false;
  setInterval(()=>{if(!attempting){attempting=true;work().catch(()=>{liveError='Ошибка фоновой очереди. См. диагностику.';host?.report({code:'WORKER_ERROR'});}).finally(()=>attempting=false);}},1500);
  window.addEventListener('pagehide',()=>{running=false;});
  window.addEventListener('pageshow',()=>{running=true;});
  if(host)return {refresh};
})();
