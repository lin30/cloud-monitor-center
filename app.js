'use strict';

const Contract=LightContract;
const NAV=Contract.NAV;
const $=s=>document.querySelector(s);
const esc=v=>String(v??"—").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const fmt=(v,d=2)=>v!==null&&v!==""&&Number.isFinite(Number(v))?Number(v).toFixed(d):"—";
const pct=(v,d=2)=>v!==null&&v!==""&&Number.isFinite(Number(v))?Number(v).toFixed(d)+"%":"—";
const time=s=>{
  if(!s)return "未知";
  if(Contract.timestamp(s)===null)return "未知（无效时间）";
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s+"（仅日精度，北京时间）";
  return new Date(s).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:false})+" 北京时间";
};
let activeFresh=false;
let PAYLOAD=null;
let READ_WARNING="";
let currentNav="总览";

function badge(text,tone="muted"){
  if(tone==="good"&&!activeFresh)tone="muted";
  return '<span class="badge '+esc(tone)+'">'+esc(text)+'</span>';
}
function card(title,body,span=12,extra=""){
  return '<section class="card span-'+span+' '+extra+'"><h2>'+esc(title)+'</h2>'+body+'</section>';
}
function kpi(label,value,note=""){
  return '<div class="kpi-block"><div class="kpi">'+esc(value)+'</div><div class="label">'+esc(label)+'</div>'+(note?'<div class="kpi-note">'+esc(note)+'</div>':'')+'</div>';
}
function table(headers,rows,searchable=true){
  if(!rows?.length) return '<div class="empty">暂无数据</div>';
  return '<div class="table-scroll"><table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
    rows.map(r=>'<tr'+(searchable?' data-search="'+esc(r.search||r.cells.join(" "))+'"':'')+'>'+r.cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+
    '</tbody></table></div>';
}
function statusTone(s){
  return {"正常":"good","清晰":"good","部分覆盖":"warn","待确认":"warn","观察":"info","暂停新增动作":"warn","已持有":"good","未持有":"muted","候补":"info","不变":"muted"}[s]||"muted";
}
function statusBadge(s){return badge(s,statusTone(s))}
function currentStateBadge(s){
  return statusBadge(["持有","已持有","未持有","观察","待确认","不变"].includes(s)?s:"待确认");
}
function roleBadge(s){
  if(!s)return"—";
  const tone=s.includes("核心")?"strong":s.includes("BASE")||s.includes("Beta")?"info":s.includes("观察")||s.includes("候补")?"muted":"muted";
  return badge(s,tone);
}

function overview(p){
  const o=p.modules.overview;
  const budgetRows=(o.domain_budget||[]).map(x=>({
    search:[x.domain,x.label,x.state].join(" "),
    cells:[`<strong>${esc(x.label)}</strong>`,x.current_pct==null?"—":`<strong>${pct(x.current_pct)}</strong>`,esc(x.budget_range||"—"),statusBadge(x.state),esc(x.note||"")]
  }));
  const actualRows=(o.actual||[]).map(x=>({
    search:[x.ticker,x.name,x.role,x.domain].join(" "),
    cells:[
      '<strong>'+esc(x.name)+'</strong><div class="sub">'+esc(x.ticker)+'</div>',
      esc(x.domain_label||x.domain||"—"),
      '<strong>'+pct(x.weight_pct)+'</strong>',
      roleBadge(x.role),
      currentStateBadge(x.current_state),
      esc(x.portfolio_state||"—")
    ]
  }));
  const seatRows=(o.seats||[]).map(x=>({
    search:[x.seat,x.leader,x.challengers,x.state].join(" "),
    cells:[`<strong>${esc(x.label||x.seat)}</strong>`,esc(x.leader||"空缺"),esc(x.challengers||"—"),statusBadge(x.state||"观察"),esc(x.note||"")]
  }));
  const riskRows=(o.risk_family||[]).map(x=>({
    search:x.family,
    cells:[esc(x.label),'<strong>'+pct(x.weight_pct)+'</strong>',esc(x.note||"")]
  }));
  return '<div class="grid">'+
    card("组合概览",
      '<div class="kpi-grid">'+
        kpi("模型净值",fmt(o.metrics.nav_wan,2)+" 万","模拟盘")+
        kpi("现金",fmt(o.metrics.cash_wan,2)+" 万",pct(o.metrics.cash_pct))+
        kpi("已投资",pct(o.metrics.invested_pct),"快照模拟暴露")+
        kpi("核心席位",String(o.metrics.core_seat_count??o.metrics.holding_count??"—")+"/"+String(o.metrics.max_core_seats??7),"实际持仓 "+String(o.metrics.holding_count??"—")+" 个")+
      '</div><div class="asof">数据时点 '+esc(time(o.metrics.as_of))+'</div>',12)+
    card("快照研究预算",'<div class="section-note">历史研究预算，仅作框架参考；以各来源截至时点为准。</div>'+table(["方向","当前暴露","预算区间","状态","说明"],budgetRows),12)+
    card("快照结论（历史）",
      '<div class="decision '+esc(activeFresh?o.decision.tone||"neutral":"neutral")+'"><div class="decision-title">'+esc(o.decision.title)+'</div><div>'+esc(o.decision.summary)+'</div>'+(o.decision.note?'<div class="decision-note">'+esc(o.decision.note)+'</div>':'')+'</div>',12)+
    card("Actual Model Portfolio · 快照模拟持仓",
      table(["标的","领域","快照权重","角色","快照状态","去留/竞争状态"],actualRows),12)+
    card("Portfolio 席位 · 新机会先竞争旧席位",
      table(["席位","快照第一/占有者","竞争者","状态","说明"],seatRows),12)+
    card("Risk Family · 实际暴露",
      table(["风险族","实际权重","说明"],riskRows),12)+
    card("快照研究记录",
      '<ul class="focus-list">'+(o.focus||[]).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>',12)+
  '</div>';
}

function weekly(p){
  const w=p.modules.weekly;
  const metrics=(w.metrics||[]).map(x=>({search:x.label,cells:[esc(x.label),'<strong>'+esc(x.value)+'</strong>',esc(x.note||"")]}));
  return '<div class="grid">'+
    card("周报结论（原截止日）",'<div class="decision '+esc(activeFresh?w.tone||"neutral":"neutral")+'"><div class="decision-title">'+esc(w.title)+'</div><div>'+esc(w.summary)+'</div></div>',12)+
    card("关键指标",table(["项目","结果","说明"],metrics),12)+
    card("时间口径",'<div class="notice">'+esc(w.note)+'</div>',12)+
  '</div>';
}

function watchlist(p){
  const w=p.modules.watchlist;
  const actual=(w.actual||[]).map(x=>({
    search:[x.ticker,x.name,x.role].join(" "),
    cells:['<strong>'+esc(x.name)+'</strong><div class="sub">'+esc(x.ticker)+'</div>',roleBadge(x.role),pct(x.current_pct),x.target_pct==null?'—':pct(x.target_pct),currentStateBadge(x.current_state),esc(x.research_focus||"")]
  }));
  const target=(w.target||[]).map(x=>({
    search:[x.ticker,x.name,x.role].join(" "),
    cells:['<strong>'+esc(x.name)+'</strong><div class="sub">'+esc(x.ticker)+'</div>',roleBadge(x.role),pct(x.target_pct),x.current_pct?pct(x.current_pct):"0.00%",statusBadge(x.state),esc(x.note||"")]
  }));
  const repl=(w.replacement||[]).map(x=>({
    search:[x.ticker,x.name].join(" "),
    cells:['<strong>'+esc(x.name)+'</strong><div class="sub">'+esc(x.ticker)+'</div>',statusBadge(x.state),x.current_pct?pct(x.current_pct):"—",esc(x.note||"")]
  }));
  return '<div class="grid">'+
    card("A · Actual 快照模拟持仓",table(["标的","角色","快照权重","目标上限","快照状态","研究关注"],actual),12)+
    card("B · Target 目标组合",'<div class="section-note">历史研究目标/上限，不等于已持有；不据此生成资金动作。</div>'+table(["标的","角色","目标","当前","状态","说明"],target),12)+
    card("C · Replacement 候补池",'<div class="section-note">候补观察，不等于正式买入建议。</div>'+table(["标的","状态","快照权重","说明"],repl),12)+
  '</div>';
}

function opportunities(p){
  const rows=(p.modules.opportunities.rows||[]).map(x=>({
    search:[x.ticker,x.name,x.theme].join(" "),
    cells:['<strong>'+esc(x.name)+'</strong><div class="sub">'+esc(x.ticker)+'</div>',esc(x.theme||"—"),statusBadge(x.state),esc(x.reason||""),esc(x.next_step||"")]
  }));
  return '<div class="grid">'+card("新机会 / 候补研究",table(["标的","方向","当前阶段","为什么看","下一验证"],rows),12)+'</div>';
}

function industry(p){
  const rows=(p.modules.industry.rows||[]).map(x=>({
    search:[x.domain,x.sector,x.long_term,x.current].join(" "),
    cells:[esc(x.domain||"—"),'<strong>'+esc(x.sector)+'</strong>',badge(x.long_term,x.long_term==="核心"?"strong":x.long_term==="积极"?"good":"muted"),badge(x.current,x.current==="进攻"?"good":x.current==="风险"?"warn":"info"),esc(x.reason||"")]
  }));
  return '<div class="grid">'+
    card("算力主线",'<div class="section-note">基础设施与算力应用统一进入100万科技组合；研究可以开放，Portfolio席位保持有限。</div>'+table(["领域","主线","长期状态","快照状态","核心原因"],rows),12)+
  '</div>';
}

function robotics(p){
  const r=p.modules.robotics;
  const rows=(r.rows||[]).map(x=>({
    search:[x.name,x.ticker,x.tier,x.direction,x.portfolio_state].join(" "),
    cells:[badge(x.tier||"观察",x.tier==="核心"?"strong":x.tier==="重点"?"good":"info"),`<strong>${esc(x.name)}</strong>${x.ticker?`<div class="sub">${esc(x.ticker)}</div>`:""}`,esc(x.direction||"—"),esc(x.judgment||"—"),statusBadge(x.portfolio_state||"观察")]
  }));
  const metrics=(r.metrics||[]).map(x=>({search:x.label,cells:[esc(x.label),'<strong>'+esc(x.value)+'</strong>',esc(x.note||"")]}));
  return '<div class="grid">'+
    card("机器人一句话",'<div class="decision '+esc(activeFresh?r.tone||"neutral":"neutral")+'"><div class="decision-title">'+esc(r.title)+'</div><div>'+esc(r.summary)+'</div></div>',12)+
    card("重点梯队",'<div class="section-note">股票名称优先展示；重点梯队用于研究和Portfolio竞争，不等于全部都要买。</div>'+table(["梯队","股票","方向","当前判断","Portfolio状态"],rows),12)+
    card("产业与链路状态",table(["项目","结果","说明"],metrics),12)+
  '</div>';
}

function sourceTable(p,ids){
  return table(["来源","业务数据截至","时效状态","口径"],Contract.sourceStates(p,ids).map(x=>({
    search:[x.label,x.as_of,x.label].join(" "),
    cells:[esc(x.label),esc(time(x.as_of)),badge(x.state==="fresh"?"48小时内":x.state==="stale"?"历史快照 / 已过期":x.as_of?"时点异常":"时点未知",x.tone),esc(x.note)]
  })),false);
}
function snapshotNotice(p){
  const ids=Contract.MODULE_SOURCES[currentNav];
  const sources=Contract.sourceStates(p,ids);
  const stale=sources.some(x=>x.state==="stale"), unknown=sources.some(x=>x.state==="unknown");
  const title=stale?"历史快照 / 已过期":unknown?"来源时点待确认":"来源在48小时内";
  return '<section class="card snapshot-notice" role="status"><h2>'+esc(title)+'</h2><p>各来源独立核验；公开 JSON 的整理或网页发布不会刷新业务数据时点。页面可读不代表持续生产已恢复。</p>'+
    (READ_WARNING?'<p class="compat-warning">'+esc(READ_WARNING)+'</p>':'')+sourceTable(p,ids)+'<div class="asof">固定48小时保守展示阈值；日期值按北京时间当天零时计算，不推测节假日续期。缺失、无效或未来时点不判正常。</div></section>';
}
function systemStatus(p){
  const rows=(p.modules.status.rows||[]).map(x=>{
    const f=Contract.freshness(p.source_as_of[x.source]?.as_of);
    return {search:[x.item,x.status,x.detail].join(" "),cells:[esc(x.item),badge(f.label,f.tone),esc("快照记录："+x.status),esc(x.detail)]};
  });
  return '<div class="grid">'+
    card("来源状态",'<div class="section-note">下列业务状态来自历史记录；时效状态独立计算，不能据旧记录认定当前生产正常。</div>'+table(["环节","当前时效","历史状态","历史说明"],rows),12)+
    card("页面读取校验",'<div class="notice">本次页面显示内容通过读取校验；不代表原始公开 JSON 已通过发布审查，也没有据此核验生产任务或部署回执。</div>',12)+
    card("快照与发布口径",table(["字段","值"],[
      {cells:["原快照整理时间",esc(time(p.source_snapshot_generated_at))]},
      {cells:["本次公开 JSON 整理时间",esc(time(p.generated_at))]},
      {cells:["发布完成时间",esc(p.published_at?time(p.published_at):"未知；以独立部署回执为准")]},
      {cells:["快照 commit",esc(p.snapshot_commit||"未写入；不推测当前部署 SHA")]}
    ]),12)+
  '</div>';
}

const renderers={"总览":overview,"周报":weekly,"关注标的":watchlist,"新机会":opportunities,"算力主线":industry,"机器人":robotics,"系统状态":systemStatus};

function validate(p){return Contract.validate(p);}
function renderNav(){
  const nav=$("#nav"); nav.innerHTML="";
  NAV.forEach(name=>{
    const b=document.createElement("button");b.textContent=name;b.classList.toggle("active",name===currentNav);
    b.onclick=()=>{currentNav=name;renderNav();renderCurrent();};
    nav.appendChild(b);
  });
}
function applySearch(){
  const q=$("#tableSearch")?.value.trim().toLowerCase()||"";
  document.querySelectorAll("tr[data-search]").forEach(tr=>{
    tr.hidden=!!q&&!tr.dataset.search.toLowerCase().includes(q);
  });
}
function renderCurrent(){
  activeFresh=Contract.sourceStates(PAYLOAD,Contract.MODULE_SOURCES[currentNav]).every(x=>x.state==="fresh");
  $("#app").innerHTML=snapshotNotice(PAYLOAD)+renderers[currentNav](PAYLOAD);
  applySearch();
}
function fail(errors){
  $("#snapshotMeta").textContent="快照不可用；未确认数据或生产状态";
  $("#snapshotHash").textContent="";
  $("#nav").innerHTML="";
  $("#app").innerHTML='<section class="fail"><h2>数据暂不可展示</h2><p>当前快照校验没有通过。</p><ul>'+errors.map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul></section>';
}
async function boot(){
  try{
    const res=await fetch("./dashboard/current.json?ts="+Date.now(),{cache:"no-store"});
    if(!res.ok) throw new Error("HTTP "+res.status);
    const reading=Contract.readSnapshot(await res.json());
    if(reading.errors.length){fail(reading.errors);return}
    const p=reading.payload;
    PAYLOAD=p;READ_WARNING=reading.warnings.join(" ");
    $("#snapshotMeta").textContent="公开 JSON 整理："+time(p.generated_at)+" · "+(p.notice||"模拟盘")+"；业务时点见各来源";
    $("#snapshotHash").textContent=p.snapshot_commit?"快照 "+p.snapshot_commit.slice(0,10):"发布时点 / commit 未写入；以部署回执为准";
    renderNav();renderCurrent();
    $("#tableSearch").addEventListener("input",applySearch);
    setInterval(renderCurrent,60000);
  }catch(e){fail(["无法读取最新数据："+e.message])}
}
boot();


