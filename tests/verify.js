'use strict';
// One fixed command: node tests/verify.js. Node built-ins only; no packages/CI.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../contract.js');
const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../dashboard/current.json'),'utf8'));
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
function copy(){return structuredClone(raw);}
const now=Date.parse('2026-10-08T12:00:00Z');
test('published raw JSON passes strict allowlist',()=>assert.deepEqual(C.validate(raw),[]));
test('old business dates stay stale despite new generated/published dates',()=>{
  const p=copy();p.generated_at=p.published_at='2026-10-08T12:00:00Z';
  const state=C.sourceStates(p,['daily','actual_model'],now);
  assert.ok(state.every(s=>s.state==='stale'));
  assert.equal(state[0].label,'正式日报');
});
test('fresh timestamp and exact 48-hour boundary',()=>{
  assert.equal(C.freshness('2026-10-08T11:00:00Z',now).state,'fresh');
  assert.equal(C.freshness('2026-10-06T12:00:00Z',now).state,'fresh');
  assert.equal(C.freshness('2026-10-06T11:59:59Z',now).state,'stale');
});
test('missing, empty, invalid and future dates are unknown',()=>{
  for(const x of [null,undefined,'','garbage','2026-02-30','2026-10-08 12:00','2026-10-08T12:00:00','2026-10-08T12:00:00+25:00','2026-10-08T13:00:00Z'])
    assert.equal(C.freshness(x,now).state,'unknown',String(x));
});
test('absent source date stays unknown without hiding remaining sources',()=>{
  const p=copy();delete p.source_as_of.daily.as_of;assert.deepEqual(C.validate(p),[]);assert.equal(C.sourceStates(p,['daily'],now)[0].state,'unknown');
});
test('timezone offsets and day-only Beijing cutoff are deterministic',()=>{
  assert.equal(C.timestamp('2026-10-08T20:00:00+08:00'),C.timestamp('2026-10-08T12:00:00Z'));
  assert.equal(C.timestamp('2026-10-08'),C.timestamp('2026-10-07T16:00:00Z'));
  assert.equal(C.timestamp('2026-02-29'),null);
  assert.notEqual(C.timestamp('2028-02-29'),null);
});
test('different source dates are evaluated independently',()=>{
  const p=copy();p.source_as_of.daily.as_of='2026-10-08T12:00:00Z';p.source_as_of.earnings.as_of=null;
  const states=C.sourceStates(p,['daily','market','earnings'],now);
  assert.deepEqual(states.map(x=>x.state),['fresh','stale','unknown']);
});
test('all unknown dates do not become fresh',()=>{
  const p=copy();for(const x of Object.values(p.source_as_of))x.as_of=null;
  assert.ok(C.sourceStates(p,undefined,now).every(x=>x.state==='unknown'));
});
test('unknown nested fields and sensitive payload keys fail before rendering',()=>{
  for(const field of ['funding_source','execution_plan','account_id','access_token','private_notes','next_trigger']){
    const p=copy();p.modules.watchlist.actual[0][field]='hidden';
    assert.ok(C.validate(p).some(x=>x.includes(field)),field);
  }
  const p=copy();p.extra={secret:'example'};assert.ok(C.validate(p).length);
});
test('specific execution text fails even inside an allowed field',()=>{
  for(const value of ['重回244–250确认承接，或225–232止跌后再评估','重新站稳0.70附近且设备景气继续验证后再评估','今日资金动作：加仓','只给最强席位资本，不机械补满','BUY 100 shares']){
    const p=copy();p.modules.watchlist.actual[0].research_focus=value;
    assert.ok(C.validate(p).some(x=>x.includes('非公开执行')),value);
  }
});
test('missing module, malformed arrays, null metric and trade permission fail',()=>{
  for(const mutate of [p=>delete p.modules.robotics,p=>p.modules.watchlist.actual={},p=>p.modules.overview.metrics.cash_wan=null,p=>p.trade_permission=true,p=>p.snapshot_commit='fake']){
    const p=copy();mutate(p);assert.ok(C.validate(p).length);
  }
});
test('real renderCurrent entry and crossing 48 hours remove green',()=>{
  let clock=now;
  class FixedDate extends Date {static now(){return clock;}}
  const nodes={ '#app':{innerHTML:''}, '#tableSearch':{value:''} };
  const sandbox={console,Date:FixedDate,document:{querySelector(q){return nodes[q]||{};},querySelectorAll(){return [];}},setInterval(){}};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../contract.js'),'utf8'),sandbox);
  const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').replace(/boot\(\);\s*$/,'');
  vm.runInContext(app,sandbox);
  sandbox.payload=raw;
  for(const name of C.NAV){
    sandbox.name=name;
    vm.runInContext('PAYLOAD=payload; currentNav=name; renderCurrent()',sandbox);
    const html=nodes['#app'].innerHTML;
    assert.ok(html.includes('历史快照')||html.includes('时点待确认'));
    assert.ok(!html.includes('badge good'),name);
    assert.ok(!html.includes('decision good'),name);
    assert.ok(!html.includes('244–250'),name);
    assert.equal(vm.runInContext('activeFresh',sandbox),false);
  }
  const fresh=copy();for(const x of Object.values(fresh.source_as_of))x.as_of='2026-10-08T12:00:00Z';
  sandbox.payload=fresh;
  vm.runInContext('PAYLOAD=payload; currentNav="算力主线"; renderCurrent()',sandbox);
  assert.equal(vm.runInContext('activeFresh',sandbox),true);
  assert.ok(nodes['#app'].innerHTML.includes('badge good'));
  clock+=C.MAX_AGE_MS+1;
  vm.runInContext('renderCurrent()',sandbox);
  assert.equal(vm.runInContext('activeFresh',sandbox),false);
  assert.ok(!nodes['#app'].innerHTML.includes('badge good'));
  assert.ok(nodes['#app'].innerHTML.includes('历史快照 / 已过期'));
  assert.equal(vm.runInContext('fmt(null)',sandbox),'—');
});
test('simulation result, Actual/Target separation and research targets remain',()=>{
  assert.equal(raw.modules.overview.actual.length,5);
  assert.equal(raw.modules.overview.metrics.nav_wan,99.9592);
  assert.equal(raw.modules.watchlist.target[0].target_pct,15);
  assert.equal(raw.modules.overview.domain_budget[0].budget_range,'35–45%');
  assert.equal(raw.audit.target_actual_separated,true);
});
console.log(`${count} checks passed; no dependencies, workflow or runner required.`);
