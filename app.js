'use strict';

const NAV=["总览","周报","关注标的","新机会","产业链","机器人","系统状态"];
const $=s=>document.querySelector(s);
const esc=v=>String(v??"—").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const fmt=(v,d=2)=>Number.isFinite(Number(v))?Number(v).toFixed(d):"—";
const pct=(v,d=2)=>Number.isFinite(Number(v))?Number(v).toFixed(d)+"%":"—";
const time=s=>{if(!s)return"—";try{return new Date(s).toLocaleString("zh-CN",{hour12:false})}catch{return s}};
let PAYLOAD=null;
let currentNav="总览";

function badge(text,tone="muted"){
  return '<span class="badge '+esc(tone)+'">'+esc(text)+'</span>';
}
function card(title,body,span=12,extra=""){
  return '<section class="card span-'+span+' '+extra+'"><h2>'+esc(title)+'</h2>'+body+'</section>';
}
function kpi(label,value,note=""){
  return '<div class="kpi-block"><div class="kpi">'+esc(value)+'</div><div class="label">'+esc(label)+'</div>'+(note?'<div class="kpi-note">'+esc(note)+'</div>':'')+'</div>';
}
function table(headers,rows){
  if(!rows?.length) return '<div class="empty">暂无数据</div>';
  return '<div class="table-scroll"><table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
    rows.map(r=>'<tr data-search="'+esc(r.search||r.cells.join(" "))+'">'+r.cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+
    '</tbody></table></div>';
}
function statusTone(s){
  return {"正常":"good","清晰":"good","部分覆盖":"warn","待确认":"warn","观察":"info","暂停新增动作":"warn","已持有":"good","未持有":"muted","候补":"info","不变":"muted"}[s]||"muted";
}
function statusBadge(s){return badge(s,statusTone(s))}
function roleBadge(s){
  if(!s)return"—";
  const tone=s.includes("核心")?"strong":s.includes("BASE")||s.includes("Beta")?"info":s.includes("观察")||s.includes("候补")?"muted":"muted";
  return badge(s,tone);
}

function overview(p){
  const o=p.modules.overview;
  const actualRows=(o.actual||[]).map(x=>({
    search:[x.ticker,x.name,x.role].join(" "),
    cells:[
      '<strong>'+esc(x.name)+'</strong><div class="sub">'+esc(x.ticker)+'</div>',
      roleBadge(x.role),
      '<strong>'+pct(x.weight_pct)+'</strong>',
      esc(x.simulation_cost),
      esc(x.last_price)+'<div class="sub">'+esc(x.price_note)+'</div>',
      esc(x.simulation_pnl),
      statusBadge(x.today_action),
      x.target_pct==null?'—':pct(x.target_pct)
    ]
  }));
  const riskRows=(o.risk_family||[]).map(x=>({
    search:x.family,
    cells:[esc(x.label),'<strong>'+pct(x.weight_pct)+'</strong>',esc(x.note||"")]
  }));
  const targetRows=(o.target||[]).map(x=>({
    search:[x.ticker,x.name,x.role].join(" "),
    cells:[
      x.ticker==="RESERVE"?'<strong>'+esc(x.name)+'</strong>':'<strong>'+esc(x.name)+'</strong><div class="sub">'+esc(x.ticker)+'</div>',
      roleBadge(x.role),
      '<strong>'+pct(x.target_pct)+'</strong>',
      x.current_pct==null?'—':pct(x.current_pct),
      statusBadge(x.state),
      esc(x.note||"")
    ]
  }));
  return '<div class="grid">'+
    card("组合概览",
      '<div class="kpi-grid">'+
        kpi("模型净值",fmt(o.metrics.nav_wan,2)+" 万","模拟盘")+
        kpi("现金",fmt(o.metrics.cash_wan,2)+" 万",pct(o.metrics.cash_pct))+
        kpi("已投资",pct(o.metrics.invested_pct),"当前实际暴露")+
        kpi("实际持仓",String(o.metrics.holding_count)+" 个","不含0股Target")+
      '</div><div class="asof">数据时点 '+esc(time(o.metrics.as_of))+'</div>',12)+
    card("今日结论",
      '<div class="decision '+esc(o.decision.tone||"neutral")+'"><div class="decision-title">'+esc(o.decision.title)+'</div><div>'+esc(o.decision.summary)+'</div>'+(o.decision.note?'<div class="decision-note">'+esc(o.decision.note)+'</div>':'')+'</div>',12)+
    card("Actual Model Portfolio · 当前实际模拟持仓",
      table(["标的","角色","当前权重","模拟成本","最近可证价","模拟盈亏","今日动作","目标上限"],actualRows),12)+
    card("Risk Family · 实际暴露",
      table(["风险族","实际权重","说明"],riskRows),5)+
    card("Target Portfolio Book · 目标/上限，不是持仓",
      table(["标的","角色","目标","当前","状态","说明"],targetRows),7)+
    card("你真正需要关注的变化",
      '<ul class="focus-list">'+(o.focus||[]).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>',12)+
  '</div>';
}

function weekly(p){
  const w=p.modules.weekly;
  const metrics=(w.metrics||[]).map(x=>({search:x.label,cells:[esc(x.label),'<strong>'+esc(x.value)+'</strong>',esc(x.note||"")]}));
  return '<div class="grid">'+
    card("上周结论",'<div class="decision '+esc(w.tone||"neutral")+'"><div class="decision-title">'+esc(w.title)+'</div><div>'+esc(w.summary)+'</div></div>',12)+
    card("关键指标",table(["项目","结果","说明"],metrics),12)+
    card("时间口径",'<div class="notice">'+esc(w.note)+'</div>',12)+
  '</div>';
}

function watchlist(p){
  const w=p.modules.watchlist;
  const actual=(w.actual||[]).map(x=>({
    search:[x.ticker,x.name,x.role].join(" "),
    cells:['<strong>'+esc(x.name)+'</strong><div class="sub">'+esc(x.ticker)+'</div>',roleBadge(x.role),pct(x.current_pct),x.target_pct==null?'—':pct(x.target_pct),statusBadge(x.today_action),esc(x.next_trigger||"")]
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
    card("A · Actual 当前持仓",table(["标的","角色","当前权重","目标上限","今日动作","下一关注"],actual),12)+
    card("B · Target 目标组合",'<div class="section-note">目标/上限，不等于已持有。</div>'+table(["标的","角色","目标","当前","状态","说明"],target),12)+
    card("C · Replacement 候补池",'<div class="section-note">候补观察，不等于正式买入建议。</div>'+table(["标的","状态","当前权重","说明"],repl),12)+
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
    search:[x.sector,x.long_term,x.current].join(" "),
    cells:['<strong>'+esc(x.sector)+'</strong>',badge(x.long_term,x.long_term==="核心"?"strong":x.long_term==="积极"?"good":"muted"),badge(x.current,x.current==="进攻"?"good":x.current==="风险"?"warn":"info"),esc(x.reason||"")]
  }));
  return '<div class="grid">'+
    card("产业状态",'<div class="section-note">长期状态回答“值不值得持续研究”，当前状态回答“现在处于什么节奏”。</div>'+table(["产业","长期状态","当前状态","核心原因"],rows),12)+
  '</div>';
}

function robotics(p){
  const r=p.modules.robotics;
  const metrics=(r.metrics||[]).map(x=>({search:x.label,cells:[esc(x.label),'<strong>'+esc(x.value)+'</strong>',esc(x.note||"")]}));
  return '<div class="grid">'+
    card("机器人一句话",'<div class="decision '+esc(r.tone||"neutral")+'"><div class="decision-title">'+esc(r.title)+'</div><div>'+esc(r.summary)+'</div></div>',12)+
    card("当前状态",table(["项目","结果","说明"],metrics),12)+
  '</div>';
}

function systemStatus(p){
  const s=p.modules.status;
  const rows=(s.rows||[]).map(x=>({
    search:[x.item,x.status,x.detail].join(" "),
    cells:['<strong>'+esc(x.item)+'</strong>',statusBadge(x.status),esc(x.detail)]
  }));
  return '<div class="grid">'+
    card("系统状态",'<div class="section-note">这里只保留你需要知道的健康度；内部字段默认收起。</div>'+table(["环节","状态","说明"],rows),12)+
    card("技术详情",'<details class="technical"><summary>展开内部字段 / 回执 / 数据ID</summary><pre>'+esc(JSON.stringify(s.technical||{},null,2))+'</pre></details>',12)+
  '</div>';
}

const renderers={"总览":overview,"周报":weekly,"关注标的":watchlist,"新机会":opportunities,"产业链":industry,"机器人":robotics,"系统状态":systemStatus};

function validate(p){
  const errs=[];
  if(p.schema_version!=="cloud_monitor_dashboard.v1") errs.push("schema_version 不匹配");
  if(p.trade_permission!==false) errs.push("安全边界异常");
  if((p.navigation||[]).map(x=>x.label).join("|")!==NAV.join("|")) errs.push("导航合同不匹配");
  if(!p.modules?.overview?.metrics) errs.push("缺少结构化 overview.metrics");
  return errs;
}
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
  $("#app").innerHTML=renderers[currentNav](PAYLOAD);
  applySearch();
}
function fail(errors){
  $("#app").innerHTML='<section class="fail"><h2>数据暂不可展示</h2><p>当前快照校验没有通过。</p><ul>'+errors.map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul></section>';
}
async function boot(){
  try{
    const res=await fetch("./dashboard/current.json?ts="+Date.now(),{cache:"no-store"});
    if(!res.ok) throw new Error("HTTP "+res.status);
    const p=await res.json();
    const errs=validate(p); if(errs.length){fail(errs);return}
    PAYLOAD=p;
    $("#snapshotMeta").textContent="数据更新 "+time(p.generated_at)+" · "+esc(p.notice||"模拟盘");
    $("#snapshotHash").textContent="快照 "+String(p.snapshot_commit||"").slice(0,10);
    renderNav();renderCurrent();
    $("#tableSearch").addEventListener("input",applySearch);
  }catch(e){fail(["无法读取最新数据："+e.message])}
}
boot();
