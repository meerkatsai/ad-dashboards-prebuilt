/* Prebuilt cockpit demo — renders the card library in the design system.
   Loads cards/<platform>.cards.json + cockpit/pins.default.json; every card
   executes its BAKED query against a seeded demo executor (no LLM anywhere).
   Pin/unpin is the only mutation, persisted in localStorage. Zero build. */
"use strict";

const GRAINS = ["date", "week", "month"];
const NON_ADDITIVE = new Set(["roas","roi","direct_roi","indirect_roi","acos","ctr","cvr","cpc","avg_cpc","cpm","cpi","aov","reach","frequency","conv_rate","cost_per_conv","cost_per_purchase","conv_value_per_cost","mer","spend_share","ntb_share","budget_utilization_pct"]);
const SERIES = ["var(--series-1)","var(--series-2)","var(--series-3)","var(--series-4)","var(--series-5)","var(--series-6)","var(--series-7)","var(--series-8)"];
const HEAT = ["var(--heat-1)","var(--heat-2)","var(--heat-3)","var(--heat-4)","var(--heat-5)"];
const REP = {kpiStrip:"kpi", trendLine:"line", barsHorizontal:"bars_h", barsVertical:"bars_v", dataTable:"table", heatmap:"heatmap"};

/* fact defs come from the CATALOG (canonical keys, native labels) */
let FACTS = {};
const MEMBERS = {
  placement:["Top of Search","Rest of Search","Product Pages"],
  advertised_asin:["AreoVeda Baby Lotion","AreoVeda Stretch Marks Cream","AreoVeda Baby Wash","AreoVeda Massage Oil","AreoVeda Diaper Rash Cream","AreoVeda Bathing Bar","AreoVeda Belly Oil","AreoVeda Nipple Butter","AreoVeda Face Serum","AreoVeda Under Eye Gel"],
  fsn:["Baby Lotion 200ml","Stretch Cream 100g","Baby Wash 250ml","Massage Oil 150ml","Rash Cream 50g","Bathing Bar 75g","Belly Oil 100ml","Nipple Butter 30g"],
  campaign:["Always-On | Exact","Festive Push","NTB Broad","Retarget Cart","Category Defense","Hero SKU Boost","Generic Terms","Competitor Conquest"],
  ad_group:["Diapering","Bath & Body","Mom Care","Gifting"],
  keyword:["baby diaper cream","stretch marks cream","baby wash","natural baby lotion","baby massage oil","diaper rash","baby bathing bar","new mom gift"],
  search_term:["baby rash cream","diaper cream for baby","baby lotion natural","baby oil massage","rash free cream","baby soap","momcare cream","baby wash organic"],
  match_type:["Exact","Phrase","Broad"],
  targeting:["ASIN targeting","Category targeting","Auto close-match","Auto loose-match"],
  ad_set:["Prospecting IN","Retarget 7d","Lookalike 2%","Broad 25-44"],
  creative:["UGC Testimonial","Product Demo","Before/After","Founder Story"],
  age:["18-24","25-34","35-44","45-54"],
  publisher_platform:["Facebook","Instagram","Audience Network"],
  device:["Mobile","Desktop","Tablet"],
  location:["Bengaluru","Mumbai","Delhi NCR","Hyderabad","Chennai","Pune"],
  asset:["Headline A","Headline B","Image 1:1","Video 15s","Sitelink Offers"],
  channel:["Online Store","Instagram Shop","WhatsApp","Marketplace"],
  product:["Baby Lotion","Stretch Cream","Baby Wash","Massage Oil","Rash Cream","Bathing Bar"],
  sku_status:["Live","Blocked","Low stock"],
  os:["Android","iOS"], goal:["Purchase","Lead","Add to cart"]
};

/* ── seeded executor (same behavior as the viewspec demo) ───────────────── */
function hash(str){let h=2166136261;for(const c of String(str)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0)/4294967295;}
function baseVal(metric, member, scale){
  const r=hash(metric+"|"+member); const f=FACTS[metric]||{};
  const bases={spend:9e5,sales:32e5,revenue:28e5,total_sales:42e5,orders:2400,purchases:1900,units:3100,clicks:52000,views:8.6e5,impressions:2.1e6,sessions:96000,atc:9000,checkouts_initiated:4200,adds_to_cart:9000,signups:1400,conversions:2100,all_conversions:2600,conv_value:26e5,reach:7.4e5,ntb_orders:900,ntb_sales:11e5,daily_budget:12e5,remaining_budget:4e5,budget:15e5,wallet_balance:6e5,blocked_funds:80000,expiring_funds:40000,released_funds:120000,redeemed_spend:7e5,direct_revenue:18e5,indirect_revenue:10e5,sales_reversals:90000,ppv:140000};
  if(metric in bases) return bases[metric]*(0.25+r)*scale;
  if(metric==="roas") return 2.2+3.4*r; if(metric==="roi") return 1.8+3.8*r;
  if(metric==="direct_roi") return 1.2+2.4*r; if(metric==="indirect_roi") return .4+1.2*r;
  if(metric==="acos") return 14+26*r; if(metric==="ctr") return .3+.9*r;
  if(metric==="cvr"||metric==="conv_rate") return 4+9*r;
  if(metric==="cpc"||metric==="avg_cpc") return 6+22*r;
  if(metric==="cpm") return 40+180*r; if(metric==="cpi") return 18+60*r;
  if(metric==="cost_per_conv"||metric==="cost_per_purchase") return 120+500*r;
  if(metric==="conv_value_per_cost") return 2+3.5*r;
  if(metric==="aov") return 350+900*r; if(metric==="frequency") return 1.4+2.2*r;
  if(metric==="ntb_share") return 20+45*r; if(metric==="budget_utilization_pct") return 40+58*r;
  if(metric==="spend_share") return 100*r; if(metric==="mer") return 1.5+3*r;
  if(f.unit==="inr") return 5e5*(0.3+r)*scale; if(f.unit==="pct") return 5+40*r;
  if(f.unit==="x") return 1.5+3*r; return 5000*(0.3+r)*scale;
}
function execQuery(query){
  const task=query.task, whereKey=(task.where||[]).map(w=>w.dimension+"="+w.value).join("&");
  const scale=(task.where||[]).length?0.42:1;
  const grain=(task.dimensions||[]).find(d=>GRAINS.includes(d));
  const cats=(task.dimensions||[]).filter(d=>!GRAINS.includes(d));
  const days=task.time_range&&task.time_range.unit==="month"?task.time_range.value*30:(task.time_range&&task.time_range.value)||30;
  const rows=[];
  const catMembers=cats.length?MEMBERS[cats[0]]||["Segment A","Segment B","Segment C","Segment D"]:[null];
  const cat2=cats[1]?MEMBERS[cats[1]]||["X","Y","Z"]:null;
  for(const m of catMembers){
    const seedM=(m||"all")+"|"+whereKey;
    if(cat2&&!grain){ for(const m2 of cat2){ const row={[cats[0]]:m,[cats[1]]:m2};
        for(const k of task.metrics) row[k]=baseVal(k,seedM+"|"+m2,scale);
        rows.push(row);} continue; }
    if(grain){ const n=grain==="date"?Math.min(days,60):grain==="week"?Math.ceil(days/7):Math.ceil(days/30);
      for(let t=0;t<n;t++){ const row={[grain]:label(grain,t,n)}; if(m) row[cats[0]]=m;
        for(const k of task.metrics){ const b=baseVal(k,seedM,scale)/(NON_ADDITIVE.has(k)?1:n);
          const wave=1+0.18*Math.sin((t/(grain==="date"?7:4))*Math.PI*2)+0.25*(hash(seedM+k+t)-0.5)+(0.25*t/n);
          row[k]=b*wave; if(task.comparison) row[k+"__prev"]=b*wave*(0.84+0.1*hash(k+t));}
        rows.push(row);} continue; }
    const row=m?{[cats[0]]:m}:{};
    for(const k of task.metrics){ row[k]=baseVal(k,seedM,scale); if(task.comparison) row[k+"__prev"]=row[k]*(0.85+0.22*hash(k+seedM)); }
    rows.push(row);
  }
  if(task.sort){ const {metric,direction}=task.sort; rows.sort((a,b)=>direction==="asc"?a[metric]-b[metric]:b[metric]-a[metric]); }
  return task.limit?rows.slice(0,task.limit):rows;
}
function label(grain,t,n){ const d=new Date("2026-09-10");
  if(grain==="date"){d.setDate(d.getDate()-(n-1-t));return `${d.getDate()}/${d.getMonth()+1}`;}
  if(grain==="week"){d.setDate(d.getDate()-7*(n-1-t));return `wk ${d.getDate()}/${d.getMonth()+1}`;}
  d.setMonth(d.getMonth()-(n-1-t));return d.toLocaleString("en",{month:"short"});}

/* ── formatting (₹ K/L/Cr, one decimal) ─────────────────────────────────── */
function fmt(v,unit){ if(v==null||isNaN(v))return "—";
  if(unit==="pct")return v.toFixed(1)+"%"; if(unit==="x")return v.toFixed(1)+"×";
  const inr=unit==="inr"; const a=Math.abs(v);
  const s=a>=1e7?(v/1e7).toFixed(1)+" Cr":a>=1e5?(v/1e5).toFixed(1)+" L":a>=1e3?(v/1e3).toFixed(1)+"K":Math.round(v).toLocaleString("en-IN");
  return inr?"₹"+s:s; }
const esc=t=>String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;");
const unitOf=k=>(FACTS[k]||{}).unit||"num";
const labelOf=k=>(FACTS[k]||{}).label||k.replace(/_/g," ");

/* ── renderers (design-system chrome; shared visual language w/ viewspec) ── */
const W=1160;
function renderCard(card, rows){
  const rep=REP[card.representation]||"table";
  const task=card.query.task;
  const cats=(task.dimensions||[]).filter(d=>!GRAINS.includes(d));
  const primary=(card.controls&&card.controls.metricSelector&&card.controls.metricSelector.value)||task.metrics[0];
  if(rep==="kpi"){
    // aggregate the range: sum additive facts, average ratios (grain rows -> one number)
    const agg={}, prevAgg={};
    for(const k of task.metrics){ const vs=rows.map(r=>r[k]).filter(v=>v!=null);
      const ps=rows.map(r=>r[k+"__prev"]).filter(v=>v!=null);
      const red=a=>a.length?(NON_ADDITIVE.has(k)?a.reduce((x,y)=>x+y,0)/a.length:a.reduce((x,y)=>x+y,0)):null;
      agg[k]=red(vs); prevAgg[k]=red(ps); }
    return `<div class="kpis">`+task.metrics.slice(0,6).map(k=>{ const cur=agg[k],prev=prevAgg[k];
      const d=prev?((cur-prev)/prev)*100:null; const inv=(FACTS[k]||{}).invert;
      const good=d!=null&&((d>=0)!==!!inv);
      return `<div class="kpi"><div class="lab">${esc(labelOf(k))}</div><div class="v num">${fmt(cur,unitOf(k))}</div>${d!=null?`<div class="d ${good?"up":"down"}">${d>=0?"+":"−"}${Math.abs(d).toFixed(1)}% vs prev</div>`:""}</div>`;}).join("")+`</div>`;
  }
  if(rep==="line"){
    const H=240,pad=52,k=primary;
    const xs=[...new Set(rows.map(r=>r[task.dimensions.find(d=>GRAINS.includes(d))]))];
    const grain=task.dimensions.find(d=>GRAINS.includes(d));
    const defs=[];
    if(cats.length){ [...new Set(rows.map(r=>r[cats[0]]))].slice(0,5).forEach((m,i)=>defs.push({label:String(m),color:SERIES[i%8],
        data:xs.map(x=>{const r=rows.find(rr=>rr[grain]===x&&rr[cats[0]]===m);return r?r[k]:null;})}));}
    else{ task.metrics.slice(0,2).forEach((mk,i)=>defs.push({label:labelOf(mk),color:SERIES[i%8],unit:unitOf(mk),
        data:xs.map(x=>{const r=rows.find(rr=>rr[grain]===x);return r?r[mk]:null;})}));
      if(rows[0]&&rows[0][k+"__prev"]!=null) defs.push({label:"previous period",color:"var(--series-compare)",dashed:true,
        data:xs.map(x=>{const r=rows.find(rr=>rr[grain]===x);return r?r[k+"__prev"]:null;})});}
    let maxV=0; defs.forEach(s=>s.data.forEach(d=>{if(d!=null)maxV=Math.max(maxV,d);}));
    const px=i=>pad+i*(W-pad-16)/Math.max(xs.length-1,1), py=v=>H-28-(v/maxV)*(H-52);
    let out=`<svg viewBox="0 0 ${W} ${H}" width="100%">`;
    for(let g=0;g<=3;g++){const y=py(maxV*g/3);out+=`<line x1="${pad}" x2="${W-16}" y1="${y}" y2="${y}" stroke="var(--rule-grid)"/><text x="${pad-8}" y="${y+3}" text-anchor="end">${fmt(maxV*g/3,unitOf(k))}</text>`;}
    defs.forEach(s=>{out+=`<path fill="none" stroke="${s.color}" stroke-width="${s.dashed?1.5:2}" ${s.dashed?'stroke-dasharray="4 4"':""} stroke-linejoin="round" d="${s.data.map((d,i)=>d==null?"":(i&&s.data[i-1]!=null?"L":"M")+px(i).toFixed(1)+","+py(d).toFixed(1)).join("")}"/>`;});
    xs.forEach((x,i)=>{const st=Math.ceil(xs.length/10); if(xs.length<=10||i===xs.length-1||i%st===0) out+=`<text x="${px(i)}" y="${H-6}" text-anchor="${i===0?"start":i===xs.length-1?"end":"middle"}">${esc(x)}</text>`;});
    out+="</svg>";
    out+=`<div class="legend">${defs.map(s=>`<span><span style="width:14px;border-top:${s.dashed?"1.5px dashed":"2px solid"} ${s.color};display:inline-block"></span>${esc(s.label)}</span>`).join("")}</div>`;
    return out;
  }
  if(rep==="bars_v"){
    const k=primary,H=240,pad=52; const maxV=Math.max(...rows.map(r=>r[k]||0));
    const bw=Math.min(80,(W-pad-40)/rows.length-20);
    let out=`<svg viewBox="0 0 ${W} ${H}" width="100%">`;
    for(let g=0;g<=3;g++){const y=H-44-(g/3)*(H-84);out+=`<line x1="${pad}" x2="${W-16}" y1="${y}" y2="${y}" stroke="var(--rule-grid)"/><text x="${pad-8}" y="${y+3}" text-anchor="end">${fmt(maxV*g/3,unitOf(k))}</text>`;}
    rows.forEach((r,i)=>{ const x=pad+16+i*((W-pad-30)/rows.length), h=((r[k]||0)/maxV)*(H-84), y=H-44-h;
      out+=`<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="1" fill="var(--series-1)"><title>${esc(r[cats[0]])}: ${fmt(r[k],unitOf(k))}</title></rect>`;
      out+=`<text class="val" x="${x+bw/2}" y="${y-6}" text-anchor="middle">${fmt(r[k],unitOf(k))}</text>`;
      out+=`<text x="${x+bw/2}" y="${H-28}" text-anchor="middle" class="val">${esc(String(r[cats[0]]).slice(0,18))}</text>`;});
    return out+"</svg>";
  }
  if(rep==="bars_h"){
    const k=primary,rh=30,H=rows.length*rh+12,lw=260;
    const maxV=Math.max(...rows.map(r=>r[k]||0));
    let out=`<svg viewBox="0 0 ${W} ${H}" width="100%">`;
    rows.forEach((r,i)=>{ const y=6+i*rh,w=((r[k]||0)/maxV)*(W-lw-140);
      out+=`<text x="${lw-8}" y="${y+13}" text-anchor="end" class="val">${esc(String(r[cats[0]]).slice(0,36))}</text>`;
      out+=`<rect x="${lw}" y="${y}" width="${W-lw-140}" height="${rh-11}" rx="1" fill="var(--bar-track)"/>`;
      out+=`<rect x="${lw}" y="${y}" width="${w}" height="${rh-11}" rx="1" fill="var(--series-1)"/>`;
      out+=`<text x="${lw+(W-lw-140)+8}" y="${y+13}">${fmt(r[k],unitOf(k))}</text>`;});
    return out+`</svg><div class="note">ranked by ${esc(labelOf(k)).toLowerCase()}, top ${rows.length}</div>`;
  }
  if(rep==="heatmap"&&cats.length>=2){
    const k=primary, xs=[...new Set(rows.map(r=>r[cats[0]]))], ys=[...new Set(rows.map(r=>r[cats[1]]))];
    const vals=rows.map(r=>r[k]); const mn=Math.min(...vals),mx=Math.max(...vals);
    const cw=Math.min(150,(W-240)/xs.length), ch=36, H=ys.length*ch+44;
    const inv=(FACTS[k]||{}).invert;
    let out=`<svg viewBox="0 0 ${W} ${H}" width="100%">`;
    xs.forEach((x,i)=>out+=`<text x="${230+i*cw+cw/2}" y="14" text-anchor="middle">${esc(x)}</text>`);
    ys.forEach((yv,j)=>{ out+=`<text x="${222}" y="${26+j*ch+ch/2+4}" text-anchor="end" class="val">${esc(yv)}</text>`;
      xs.forEach((x,i)=>{ const r=rows.find(rr=>rr[cats[0]]===x&&rr[cats[1]]===yv); if(!r)return;
        let t=(r[k]-mn)/((mx-mn)||1); if(inv) t=1-t;
        const step=Math.min(4,Math.floor(t*5));
        out+=`<rect x="${230+i*cw}" y="${26+j*ch}" width="${cw-4}" height="${ch-4}" rx="1" fill="${HEAT[step]}"/><text pointer-events="none" x="${230+i*cw+cw/2-2}" y="${26+j*ch+ch/2+2}" text-anchor="middle" fill="${step>=3?"var(--surface-card)":"var(--ink-900)"}">${fmt(r[k],unitOf(k))}</text>`;});});
    return out+`</svg><div class="note">5-step scale, ${inv?"darker = better (lower)":"darker = higher"}</div>`;
  }
  // table (also the fallback for heatmap cards whose grid axes need entity-level data)
  const dims=cats.length?cats:[];
  const cols=dims.concat(task.metrics);
  let out="<table><tr>"+cols.map(c=>`<th>${esc(labelOf(c))}${card.query.task.sort&&card.query.task.sort.metric===c?` <span style="color:var(--ink-400)">↓</span>`:""}</th>`).join("")+"</tr>";
  rows.slice(0,10).forEach(r=>{ out+=`<tr class="num">`+cols.map(c=>`<td>${typeof r[c]==="number"?fmt(r[c],unitOf(c)):esc(r[c]??"")}</td>`).join("")+"</tr>";});
  return out+`</table><div class="note">exact values, ${Math.min(rows.length,10)} rows</div>`;
}

/* ── cockpit shell ──────────────────────────────────────────────────────── */
const PLATFORMS=["all","amazon","flipkart","google","meta","shopify"];
const NAMES={all:"All platforms",amazon:"Amazon Ads",flipkart:"Flipkart Ads",google:"Google Ads",meta:"Meta Ads",shopify:"Shopify"};
let CARDS={}, PINS={};
const $=s=>document.querySelector(s);
const store={get:(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}},
             set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};

function controlsHtml(card){
  const c=card.controls||{}; const bits=[];
  if(c.metricSelector) bits.push(`<span class="chip">${esc((FACTS[c.metricSelector.value]||{}).label||c.metricSelector.value)} ▾</span>`);
  if(c.period) bits.push(`<span class="chip">${esc(c.period)} / W / M</span>`);
  bits.push(`<span class="chip">${esc((c.dateRange||{}).preset||"30d")}</span>`);
  if(c.compare) bits.push(`<span class="chip">compare on</span>`);
  return bits.join("")+`<span class="mono" style="margin-left:auto">controls live in the app — demo renders defaults</span>`;
}
function cardHtml(card, pinned){
  let rows;
  try{ rows=execQuery(card.query); }catch(e){ rows=[]; }
  return `<div class="card" data-cid="${esc(card.id)}">
    <div class="card-h">
      <div class="tw"><div class="t">${esc(card.title)}</div><div class="q">${esc(card.question||"")}</div></div>
      <span class="meta">synced 2m ago</span>
      <button class="pinbtn ${pinned?"pinned":""}" data-pin="${esc(card.id)}" title="${pinned?"unpin":"pin to cockpit"}">${pinned?"●":"○"}</button>
    </div>
    <div class="controls">${controlsHtml(card)}</div>
    <div class="body">${rows.length?renderCard(card,rows):'<div class="mono">no data</div>'}</div>
    <div class="foot"><span>data as of 2026-09-10 06:30 ist · last 2 days provisional</span><span>${esc(card.representation)} · ${esc((card.query.task.entity||""))} grain</span></div>
  </div>`;
}
function render(){
  const p=store.get("mk-dash-platform","amazon");
  $("#platform").value=p;
  const cards=CARDS[p]||[];
  const pinnedIds=PINS[p]||[];
  const pinned=pinnedIds.map(id=>cards.find(c=>c.id===id)).filter(Boolean);
  const rest=cards.filter(c=>!pinnedIds.includes(c.id));
  $("#stack").innerHTML=pinned.length?pinned.map(c=>cardHtml(c,true)).join(""):'<div class="mono" style="padding:20px 0">nothing pinned — pin reports from the library below</div>';
  $("#libHead").textContent=`reports — ${rest.length} unpinned, pin to add to the cockpit`;
  $("#library").innerHTML=rest.map(c=>`<div class="libitem"><span class="t">${esc(c.title)}</span><span class="rep">${esc(c.representation)}</span><span class="sp"></span><button class="pinbtn" data-pin="${esc(c.id)}" title="pin to cockpit">○</button></div>`).join("");
  document.querySelectorAll("[data-pin]").forEach(b=>b.addEventListener("click",()=>{
    const id=b.dataset.pin; const pins=PINS[p]||[];
    PINS[p]=pins.includes(id)?pins.filter(x=>x!==id):pins.concat([id]);
    store.set("mk-dash-pins",PINS); render(); window.scrollTo({top:0});
  }));
}
async function boot(){
  const sel=$("#platform");
  PLATFORMS.forEach(p=>{const o=document.createElement("option");o.value=p;o.textContent=NAMES[p];sel.appendChild(o);});
  sel.addEventListener("change",()=>{store.set("mk-dash-platform",sel.value);render();});
  const [defs,catalog]=await Promise.all([
    fetch("cockpit/pins.default.json").then(r=>r.json()),
    fetch("catalog/catalog.json").then(r=>r.json())
  ]);
  for(const plat of ["amazon","flipkart","google","meta","shopify"])
    for(const rep of (catalog[plat]||{}).reports||[])
      for(const m of rep.metrics||[]) if(!FACTS[m.key]) FACTS[m.key]={label:m.label,unit:m.unit,invert:m.invert};
  FACTS.mer={label:"MER",unit:"x"}; FACTS.spend_share=FACTS.spend_share||{label:"Spend share",unit:"pct"};
  const loaded=await Promise.all(PLATFORMS.map(p=>fetch(`cards/${p}.cards.json`).then(r=>r.json()).then(cs=>[p,cs])));
  loaded.forEach(([p,cs])=>CARDS[p]=cs);
  PINS=store.get("mk-dash-pins",null)||JSON.parse(JSON.stringify(defs));
  render();
}
boot();
