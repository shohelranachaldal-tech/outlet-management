/** Shwapno Outlet backend (Google Apps Script). Bound to a Google Sheet. */
const CLIENT_ID = 'PASTE_YOUR_GOOGLE_OAUTH_CLIENT_ID';
const H = {
  emps: ['id','name','des','status','in','out'], pend: ['id','name','des','mail','date'],
  tasks: ['id','emp','time','name','mark','st'], sales: ['d','s','f','b'],
  roster: ['name','shift','time'], target: ['sales','ff','bk']
};
const N = {emps:'Employees',pend:'Registrations',tasks:'Tasks',sales:'Sales_Report',roster:'Roster',target:'Monthly_Target'};
const NUM = ['mark','d','s','f','b','sales','ff','bk'];
const SS = () => SpreadsheetApp.getActiveSpreadsheet();

function setup() { // run once from the editor
  Object.keys(H).forEach(k => sh(N[k], H[k]));
  sh('Users', ['email','role','empId','status']);
  Logger.log('Now add your admin row in Users: email | admin | ADM001 | Active');
}
function sh(n, h) { let s = SS().getSheetByName(n); if (!s) { s = SS().insertSheet(n); s.appendRow(h); } return s; }
function rd(k) {
  const v = sh(N[k], H[k]).getDataRange().getValues(), h = v.shift();
  return v.filter(r => r[0] !== '').map(r => { const o = {}; h.forEach((c,i) => o[c] = NUM.includes(c) ? Number(r[i]) : r[i]); return o; });
}
function wr(k, rows) {
  const s = sh(N[k], H[k]); s.clearContents(); s.appendRow(H[k]);
  if (!rows.length) return;
  const r = s.getRange(2, 1, rows.length, H[k].length);
  r.setNumberFormat('@'); r.setValues(rows.map(o => H[k].map(c => o[c] == null ? '' : o[c])));
}
function who(t) { // verify Google ID token server-side
  if (!t) throw new Error('Not signed in');
  const c = CacheService.getScriptCache(), hit = c.get('t' + t.slice(-40));
  if (hit) return hit;
  const j = JSON.parse(UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(t), {muteHttpExceptions:true}).getContentText());
  if (j.aud !== CLIENT_ID || String(j.email_verified) !== 'true') throw new Error('Invalid token');
  c.put('t' + t.slice(-40), j.email.toLowerCase(), 300);
  return j.email.toLowerCase();
}
function usersSheet() { return sh('Users', ['email','role','empId','status']); }
function user(em) {
  const u = usersSheet().getDataRange().getValues().slice(1).find(r => String(r[0]).toLowerCase() === em);
  return u ? {role: u[1], emp: u[2], status: u[3]} : null;
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return out({ok: 'Shwapno API'}); }

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents), em = who(b.token);
    const L = LockService.getScriptLock(); L.waitLock(20000);
    try { return out(handle(em, b)); } finally { L.releaseLock(); }
  } catch (err) { return out({error: String(err.message || err)}); }
}

function dayReset() { // attendance resets each day
  const p = PropertiesService.getScriptProperties(), d = Utilities.formatDate(new Date(), 'Asia/Dhaka', 'yyyy-MM-dd');
  if (p.getProperty('day') !== d) { wr('emps', rd('emps').map(e => (e.in = '', e.out = '', e))); p.setProperty('day', d); }
}

function handle(em, b) {
  const u = user(em), d = b.data || {};
  if (b.action === 'register') {
    if (u) return {error: 'Already registered'};
    if (!d.id || !d.name) return {error: 'Missing fields'};
    sh(N.pend, H.pend).appendRow([d.id, d.name, d.des || '', em, d.date || '']);
    usersSheet().appendRow([em, 'employee', d.id, 'Pending']);
    return {ok: 1};
  }
  if (!u) return {status: 'unregistered'};
  if (u.status !== 'Active') return {status: u.status};
  const admin = u.role === 'admin';

  if (b.action === 'load') {
    dayReset();
    const tg = rd('target')[0] || {sales: 0, ff: 0, bk: 0};
    if (admin) return {role: 'admin', state: {emps: rd('emps'), pend: rd('pend'), tasks: rd('tasks'), sales: rd('sales'), roster: rd('roster').map(r => [r.name, r.shift, r.time]), target: tg}};
    const me = rd('emps').filter(x => x.id == u.emp);
    return {role: 'employee', state: {emps: me, pend: [], tasks: rd('tasks').filter(t => t.emp == u.emp),
      sales: rd('sales'), roster: rd('roster').filter(r => me[0] && r.name == me[0].name).map(r => [r.name, r.shift, r.time]), target: tg}};
  }
  if (b.action === 'save' && admin) { // full-state write, admin only
    ['emps','pend','tasks','sales'].forEach(k => d[k] && wr(k, d[k]));
    if (d.roster) wr('roster', d.roster.map(r => ({name: r[0], shift: r[1], time: r[2]})));
    if (d.target) wr('target', [d.target]);
    const ids = rd('emps').map(x => x.id), pids = rd('pend').map(x => x.id), us = usersSheet(), v = us.getDataRange().getValues();
    v.forEach((r, i) => { if (i && r[3] === 'Pending') { if (ids.includes(r[2])) us.getRange(i + 1, 4).setValue('Active'); else if (!pids.includes(r[2])) us.getRange(i + 1, 4).setValue('Rejected'); } });
    return {ok: 1};
  }
  if (b.action === 'empSave') { // employees may only change their own data
    if (d.emps && d.emps[0]) { const A = rd('emps'), x = A.find(r => r.id == u.emp); if (x) { x.in = d.emps[0].in || ''; x.out = d.emps[0].out || ''; wr('emps', A); } }
    const T = rd('tasks'); (d.tasks || []).forEach(t => { const x = T.find(r => r.id == t.id && r.emp == u.emp); if (x && ['Pending','In Progress','Done'].includes(t.st)) x.st = t.st; }); wr('tasks', T);
    const s = (d.sales || [])[0], day = Number(Utilities.formatDate(new Date(), 'Asia/Dhaka', 'd'));
    if (s && Number(s.d) === day) { const S = rd('sales').filter(r => r.d !== day); S.push({d: day, s: +s.s, f: +s.f, b: +s.b}); wr('sales', S); }
    return {ok: 1};
  }
  return {error: 'Forbidden'};
}
