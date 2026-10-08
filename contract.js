/* Shared, dependency-free contract for raw publication checks and browser reads. */
(function (root) {
  'use strict';
  const NAV = ['总览','周报','关注标的','新机会','算力主线','机器人','系统状态'];
  const SOURCE_IDS = ['actual_model','daily','market','weekly','industry','macro','earnings','robotics'];
  const MODULE_SOURCES = {
    '总览':['actual_model','daily','market','industry','macro','robotics'],
    '周报':['weekly'], '关注标的':['actual_model','daily'],
    '新机会':['daily','industry'], '算力主线':['daily','industry'],
    '机器人':['robotics'], '系统状态':SOURCE_IDS
  };
  const MAX_AGE_MS = 48 * 60 * 60 * 1000;
  const FUTURE_SKEW_MS = 5 * 60 * 1000;
  const EXECUTION_TEXT = /买入|卖出|加仓|减仓|清仓|首仓|首买|建仓|补仓|止损|追高|不追|成交|持仓调整|提高资本占用|下一可执行窗口|退出\/替换|回撤.{0,12}配置|今日资金动作|今日动作|资金来源|执行来源|暂停新增|不新增|新增资本|资本暂缓|扩张持仓|扩大资本占用|只给.{0,12}资本|补满|(?:重回|站稳|止跌|突破|回踩|跌破).{0,24}\d|\d.{0,24}(?:止跌|确认承接|后再评估)|\b(?:BUY|SELL)\b/i;
  const s='string', n='number', b='boolean', nullableString='string?', nullableNumber='number?';
  const noteRows=[{label:s,value:s,note:s}];
  const schema={
    schema_version:s,ui_version:s,trade_permission:b,generated_at:nullableString,
    source_snapshot_generated_at:nullableString,published_at:nullableString,snapshot_commit:nullableString,notice:s,
    source_as_of:Object.fromEntries(SOURCE_IDS.map(id=>[id,{label:s,as_of:nullableString,note:s}])),
    navigation:[{id:s,label:s}],
    modules:{
      overview:{metrics:{nav_wan:n,cash_wan:n,cash_pct:n,invested_pct:n,holding_count:n,core_seat_count:n,max_core_seats:n,as_of:s},
        domain_budget:[{domain:s,label:s,current_pct:nullableNumber,budget_range:s,state:s,note:s}],
        decision:{tone:s,title:s,summary:s,note:s},
        actual:[{ticker:s,name:s,domain:s,domain_label:s,weight_pct:n,role:s,portfolio_state:s,simulation_cost:s,last_price:s,simulation_pnl:s,target_pct:nullableNumber,current_state:s}],
        seats:[{seat:s,label:s,leader:s,challengers:s,state:s,note:s}],
        risk_family:[{family:s,label:s,weight_pct:n,note:s}],focus:[s]},
      weekly:{tone:s,title:s,summary:s,metrics:noteRows,note:s},
      watchlist:{actual:[{ticker:s,name:s,role:s,current_pct:n,target_pct:nullableNumber,research_focus:s,current_state:s}],
        target:[{ticker:s,name:s,role:s,target_pct:n,current_pct:n,state:s,note:s}],
        replacement:[{ticker:s,name:s,state:s,current_pct:n,note:s}]},
      opportunities:{rows:[{ticker:s,name:s,theme:s,state:s,reason:s,next_step:s}]},
      industry:{rows:[{domain:s,sector:s,long_term:s,current:s,reason:s}]},
      robotics:{tone:s,title:s,summary:s,rows:[{tier:s,ticker:s,name:s,direction:s,judgment:s,portfolio_state:s}],metrics:noteRows},
      status:{rows:[{item:s,source:s,status:s,detail:s}]}
    },
    audit:{actual_first:b,actual_tool_count:n,nav_wan:n,cash_wan:n,invested_wan:n,domain_infra_pct:n,domain_application_pct:n,target_actual_separated:b,v3_daily_fields_present:b,portfolio_seats_compat_projection:b,robot_read_only:b,canonical_688097:s,canonical_conflict_count:n,NEW_content:n,public_actual_portfolio_publish:b,sensitive_account_fields_published:b,trade_permission:b,public_projection_allowlist:b,execution_ledger_fields_published:b,public_text_sanitized:b,public_projection_semantics:s,execution_conditions_published:b}
  };
  function timestamp(value) {
    if (typeof value !== 'string') return null;
    const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(value);
    const iso=dateOnly ? value+'T00:00:00+08:00' : value;
    const m=iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/);
    if (!m) return null;
    const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number);
    const maxDay=new Date(Date.UTC(year,month,0)).getUTCDate();
    if (year<2000 || month<1 || month>12 || day<1 || day>maxDay || hour>23 || minute>59 || second>59 || Number(m[8]||0)>14 || Number(m[9]||0)>59 || (Number(m[8])===14 && Number(m[9])!==0)) return null;
    const result=Date.parse(iso);
    return Number.isFinite(result) ? result : null;
  }
  function freshness(asOf, now=Date.now()) {
    const t=timestamp(asOf);
    if (t===null || !Number.isFinite(now)) return {state:'unknown',label:'时点未知',tone:'warn'};
    if (t-now>FUTURE_SKEW_MS) return {state:'unknown',label:'时点异常（未来）',tone:'warn'};
    return now-t>MAX_AGE_MS ? {state:'stale',label:'历史快照 / 已过期',tone:'warn'} : {state:'fresh',label:'48小时内',tone:'info'};
  }
  function sourceStates(p, ids=SOURCE_IDS, now=Date.now()) {
    return ids.map(id=>({...freshness(p.source_as_of?.[id]?.as_of,now),id,...(p.source_as_of?.[id]||{label:id,as_of:null,note:'来源未提供'})}));
  }
  function validate(p) {
    const errors=[];
    function walk(value, rule, path) {
      if (typeof rule==='string') {
        if (value===null && rule.endsWith('?')) return;
        const type=rule.replace('?','');
        if (typeof value!==type || (type==='number' && !Number.isFinite(value))) { errors.push(path+' 类型不符'); return; }
        if (type==='string' && EXECUTION_TEXT.test(value)) errors.push(path+' 包含非公开执行条件/资金动作');
      } else if (Array.isArray(rule)) {
        if (!Array.isArray(value)) { errors.push(path+' 必须为数组'); return; }
        value.forEach((item,i)=>walk(item,rule[0],path+'['+i+']'));
      } else {
        if (!value || typeof value!=='object' || Array.isArray(value)) { errors.push(path+' 必须为对象'); return; }
        Object.keys(value).forEach(key=>{if (!Object.hasOwn(rule,key)) errors.push(path+'.'+key+' 不在公开白名单');});
        Object.keys(rule).forEach(key=>{
          if (!Object.hasOwn(value,key)) { if (!(typeof rule[key]==='string' && rule[key].endsWith('?'))) errors.push(path+'.'+key+' 缺失'); }
          else walk(value[key],rule[key],path+'.'+key);
        });
      }
    }
    walk(p,schema,'snapshot');
    if (errors.length) return errors;
    if (p.schema_version!=='cloud_monitor_dashboard.v1') errors.push('schema_version 不匹配');
    if (p.trade_permission!==false || p.audit.trade_permission!==false) errors.push('研究边界异常');
    if (p.navigation.map(x=>x.label).join('|')!==NAV.join('|') || p.navigation.map(x=>x.id).join('|')!=='overview|weekly|watchlist|opportunities|industry|robotics|status') errors.push('导航合同不匹配');
    if (p.modules.status.rows.some(x=>!SOURCE_IDS.includes(x.source))) errors.push('系统状态来源不匹配');
    if (p.audit.sensitive_account_fields_published!==false || p.audit.execution_conditions_published!==false || p.audit.execution_ledger_fields_published!==false || p.audit.NEW_content!==0) errors.push('公开边界声明异常');
    for (const field of ['generated_at','source_snapshot_generated_at','published_at']) {
      if(p[field]!=null && (!p[field].includes('T') || timestamp(p[field])===null)) errors.push(field+' 必须为含时区时间或 null');
    }
    if(p.snapshot_commit!=null && !/^[a-f0-9]{40}$/.test(p.snapshot_commit)) errors.push('snapshot_commit 格式异常');
    return errors;
  }
  // Browser-only compatibility: never modifies, saves, or republishes its input.
  // The stricter validate() remains the check for raw data BEFORE publication.
  function readSnapshot(raw) {
    if (!raw || raw.schema_version!=='cloud_monitor_dashboard.v1' || raw.trade_permission!==false) return {payload:null,errors:['快照版本或研究边界异常'],warnings:[]};
    const rawErrors=validate(raw);
    function project(value, rule) {
      if(typeof rule==='string') return typeof value==='string' && EXECUTION_TEXT.test(value) ? '旧快照执行内容已隐藏' : value;
      if(Array.isArray(rule)) return Array.isArray(value)?value.map(x=>project(x,rule[0])):value;
      if(!value || typeof value!=='object' || Array.isArray(value))return value;
      return Object.fromEntries(Object.keys(rule).filter(k=>Object.hasOwn(value,k)).map(k=>[k,project(value[k],rule[k])]));
    }
    const p=project(structuredClone(raw),schema);
    const source=raw.source_as_of||{};
    const labels={actual_model:'模拟持仓',daily:'正式日报',market:'已核验行情基线',weekly:'周报',industry:'产业扫描',macro:'宏观 / 政策',earnings:'业绩覆盖',robotics:'机器人日报'};
    const dateFromId=(value,prefix)=>typeof value==='string'&&value.startsWith(prefix+'|')&&/^\d{4}-\d{2}-\d{2}$/.test(value.split('|')[1])?value.split('|')[1]:null;
    const marketDate=typeof source.last_complete_market_snapshot==='string'?source.last_complete_market_snapshot.match(/^(\d{4}-\d{2}-\d{2})\s/):null;
    const oldDates={actual_model:source.actual_model_as_of||null,daily:dateFromId(source.daily,'DAILY'),market:marketDate?marketDate[1]:null,weekly:null,industry:null,macro:source.macro_deep||null,earnings:null,robotics:dateFromId(source.robot_formal_daily,'ROBOT_DAILY')};
    p.source_as_of=Object.fromEntries(SOURCE_IDS.map(id=>{
      const explicit=source[id]&&typeof source[id]==='object'&&!Array.isArray(source[id]);
      const asOf=explicit?source[id].as_of:oldDates[id];
      return [id,{label:labels[id],as_of:typeof asOf==='string'?asOf:null,note:explicit&&typeof source[id].note==='string'?project(source[id].note,'string'):'旧格式仅采用明确的业务来源日期；缺失为未知，technical、JSON生成和发布时间不作新鲜证据。'}];
    }));
    for(const field of ['generated_at','published_at','source_snapshot_generated_at']) if(typeof p[field]!=='string'||!p[field].includes('T')||timestamp(p[field])===null)p[field]=null;
    if(typeof p.snapshot_commit!=='string'||!/^[a-f0-9]{40}$/.test(p.snapshot_commit))p.snapshot_commit=null;
    if(Array.isArray(p.modules?.watchlist?.actual))p.modules.watchlist.actual.forEach((row,i)=>{
      if(row && typeof row==='object' && !Array.isArray(row) && row.research_focus===undefined)row.research_focus=Object.hasOwn(raw.modules.watchlist.actual[i],'next_trigger')?'旧快照执行内容已隐藏':'未提供研究关注';
    });
    const statusSources={'当前组合':'daily','价格 / 市场数据':'market','产业扫描':'industry','宏观 / 政策':'macro','业绩覆盖':'earnings','机器人链':'robotics'};
    if(Array.isArray(p.modules?.status?.rows))p.modules.status.rows=p.modules.status.rows.filter(x=>!x||typeof x!=='object'||Array.isArray(x)||SOURCE_IDS.includes(x.source)||statusSources[x.item]).map(x=>x&&typeof x==='object'&&!Array.isArray(x)?{...x,source:SOURCE_IDS.includes(x.source)?x.source:statusSources[x.item]}:x);
    const errors=validate(p);
    return {payload:errors.length?null:p,errors,warnings:rawErrors.length?['旧格式兼容展示：未公开字段和执行文字已在本页隐藏；不代表原始 JSON 已脱敏，发布端仍需清理。']:[]};
  }
  const api={NAV,SOURCE_IDS,MODULE_SOURCES,MAX_AGE_MS,EXECUTION_TEXT,timestamp,freshness,sourceStates,validate,readSnapshot};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  else root.LightContract=api;
})(typeof globalThis!=='undefined' ? globalThis : this);
