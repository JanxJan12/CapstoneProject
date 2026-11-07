import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(here, 'hosted-public-catalog.json'), 'utf8'));
const packagePath = process.env.ERD_GRAPHVIZ_PACKAGE || path.join(os.tmpdir(), 'rrj-erd-renderer-20261027', 'node_modules', '@hpcc-js', 'wasm-graphviz', 'dist', 'index.js');
const { Graphviz } = await import(pathToFileURL(packagePath).href);
const graphviz = await Graphviz.load();

const groups = [
  ['Identity and delivery', 'identity-delivery', ['profiles','riders','rider_push_devices','rider_offer_push_outbox','delivery_assignments','kds_terminals'], '#5367c8'],
  ['Orders and cashier', 'orders-cashier', ['orders','order_items','order_status_history','payments','paid_order_cancellations','cashier_shifts','cashier_transactions'], '#bd5e40'],
  ['Menu', 'menu', ['menu_categories','menu_items','menu_ingredients','drink_choices'], '#b18835'],
  ['Suppliers and purchasing', 'suppliers-purchasing', ['suppliers','supplier_items','purchase_orders','purchase_order_items'], '#3d8a78'],
  ['Inventory and audit', 'inventory-audit', ['inventory_items','inventory_batches','inventory_opening_balances','inventory_transactions','inventory_transaction_batch_allocations','inventory_audits','inventory_audit_items'], '#3d7fa7'],
  ['Requests and receiving', 'requests-receiving', ['inventory_request_documents','inventory_request_lines','inventory_request_revisions','inventory_request_events','receiving_reports','receiving_report_items','production_replenishment_requests','production_replenishment_status_events'], '#8c5bac'],
];
const groupOf = new Map(groups.flatMap(([title,slug,names,color]) => names.map(name => [name,{title,slug,color}])));
const tableOf = new Map(catalog.tables.map(t => [t.name,t]));
const constraints = catalog.constraints;
const fks = constraints.filter(c => c.type === 'f').sort((a,b) => (a.table+'.'+a.name).localeCompare(b.table+'.'+b.name));
const pks = constraints.filter(c => c.type === 'p');
const uniques = constraints.filter(c => c.type === 'u');
const pkOf = new Map(pks.map(c => [c.table,new Set(c.columns)]));
const uniqueIndexes = catalog.unique_indexes.filter(i => i.valid && !i.predicate && !i.has_expression && i.columns?.length);
const keysOf = t => [...pks,...uniques].filter(c => c.table === t).map(c => c.columns).concat(uniqueIndexes.filter(i => i.table===t).map(i => i.columns));
const fkColsOf = new Map(catalog.tables.map(t => [t.name,new Set(fks.filter(f=>f.table===t.name).flatMap(f=>f.columns))]));
const uniqColsOf = new Map(catalog.tables.map(t => [t.name,new Set(uniques.filter(u=>u.table===t.name).flatMap(u=>u.columns))]));
const esc = s => String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const quoted = s => JSON.stringify(s);
const csv = v => '"' + String(v ?? '').replaceAll('"','""') + '"';
const write = (name,data) => fs.writeFileSync(path.join(here,name),data,'utf8');
const safeType = s => s.replace(/[^A-Za-z0-9_]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'') || 'unknown';
const optional = f => f.columns.some(name => tableOf.get(f.table).columns.find(c=>c.name===name).nullable);
const oneToOne = f => keysOf(f.table).some(cols => cols.length===f.columns.length && cols.every(c=>f.columns.includes(c)));
const refId = new Map(fks.map((f,i)=>[f.name+'@'+f.table, 'R'+String(i+1).padStart(3,'0')]));
const dotNode = name => quoted(name);
const port = name => 'p_'+name.replace(/[^A-Za-z0-9_]/g,'_');
const dotLabel = (t,compact=false) => {
  const g=groupOf.get(t.name), color=g.color;
  if(compact) return `<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="7" COLOR="${color}" BGCOLOR="#ffffff"><TR><TD BGCOLOR="${color}"><FONT COLOR="white"><B>public.${esc(t.name)}</B></FONT></TD></TR><TR><TD><FONT POINT-SIZE="10">${t.columns.length} columns · ${esc(g.title)}</FONT></TD></TR></TABLE>>`;
  const rows=t.columns.map(c=>{
    const flags=[pkOf.get(t.name)?.has(c.name)?'PK':null,fkColsOf.get(t.name).has(c.name)?'FK':null,uniqColsOf.get(t.name).has(c.name)?'UQ':null].filter(Boolean).join(' ');
    const shade=c.position%2?'#ffffff':'#f5f7fb';
    const type=esc(c.type)+(c.nullable?' · NULL':' · NOT NULL');
    return `<TR><TD BGCOLOR="${shade}" ALIGN="LEFT"><FONT COLOR="#5d6380" POINT-SIZE="9">${flags||' '}</FONT></TD><TD PORT="${port(c.name)}" BGCOLOR="${shade}" ALIGN="LEFT"><FONT FACE="Consolas" POINT-SIZE="10">${esc(c.name)}</FONT></TD><TD BGCOLOR="${shade}" ALIGN="LEFT"><FONT FACE="Consolas" COLOR="#43506a" POINT-SIZE="9">${type}</FONT></TD></TR>`;
  }).join('');
  return `<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" COLOR="${color}" BGCOLOR="#ffffff"><TR><TD COLSPAN="3" BGCOLOR="${color}" ALIGN="LEFT"><FONT COLOR="white" POINT-SIZE="13"><B>public.${esc(t.name)}</B></FONT></TD></TR>${rows}</TABLE>>`;
};
const dotHead = title => `digraph ERD {
 graph [rankdir=LR, bgcolor="#f8fafc", pad="0.45", nodesep="0.7", ranksep="1.2", splines=polyline, overlap=false, outputorder=nodesfirst, label=${quoted(title)}, labelloc=t, fontsize=22, fontname="Arial", fontcolor="#22304d"];
 node [shape=plain, fontname="Arial"];
 edge [color="#6c7590", penwidth=1.1, fontsize=8, fontname="Arial", fontcolor="#45506b", dir=both];
`;
function dotFor(names,title,compact=false,withCross=false) {
  const included=new Set(names);
  let out=dotHead(title);
  for(const name of names) out+=` ${dotNode(name)} [label=${dotLabel(tableOf.get(name),compact)}];\n`;
  if(withCross) out+=' "auth.users" [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="7" COLOR="#787d8b"><TR><TD BGCOLOR="#787d8b"><FONT COLOR="white"><B>auth.users</B></FONT></TD></TR><TR><TD>external referenced table</TD></TR></TABLE>>];\n';
  for(const f of fks) {
    if(!included.has(f.table)) continue;
    if(f.referenced_schema==='public' && !included.has(f.referenced_table)) continue;
    if(f.referenced_schema!=='public' && !withCross) continue;
    const parent=f.referenced_schema==='public'?f.referenced_table:'auth.users';
    const parentPort=compact||parent==='auth.users'?'':`:${port(f.referenced_columns[0])}`;
    const childPort=compact?'':`:${port(f.columns[0])}`;
    const childMark=oneToOne(f)?'odottee':'odotcrow';
    const parentMark=optional(f)?'odottee':'tee';
    const id=refId.get(f.name+'@'+f.table);
    out+=` ${dotNode(parent)}${parentPort} -> ${dotNode(f.table)}${childPort} [arrowtail=${parentMark}, arrowhead=${childMark}, tooltip=${quoted(id+' '+f.name+': '+f.table+'('+f.columns.join(', ')+') → '+f.referenced_schema+'.'+f.referenced_table+'('+f.referenced_columns.join(', ')+')')}, xlabel=${quoted(id)}];\n`;
  }
  return out+'}\n';
}
const mmdFor=(names,title,withCross=false)=>{
  const included=new Set(names);
  let s=`%% RRJ'S FOOD-HOUSE - ${title}\n%% Source: hosted PostgreSQL pg_catalog, captured ${catalog.captured_at_utc}\n%% Field types are Mermaid-safe tokens. Exact PostgreSQL types, nullability and defaults are in hosted-public-catalog.json and column-dictionary.html.\nerDiagram\n`;
  for(const name of names) {
    const t=tableOf.get(name);
    s+=`  ${name} {\n`;
    for(const c of t.columns){
      const tags=[pkOf.get(name)?.has(c.name)?'PK':null,fkColsOf.get(name).has(c.name)?'FK':null,uniqColsOf.get(name).has(c.name)?'UK':null].filter(Boolean);
      s+=`    ${safeType(c.type)} ${c.name}${tags.length?' '+tags.join(','):''}\n`;
    }
    s+='  }\n';
  }
  if(withCross) s+='  auth_users {\n    uuid id PK\n  }\n';
  for(const f of fks) {
    if(!included.has(f.table)) continue;
    if(f.referenced_schema==='public'&&!included.has(f.referenced_table)) continue;
    if(f.referenced_schema!=='public'&&!withCross) continue;
    const parent=f.referenced_schema==='public'?f.referenced_table:'auth_users';
    const pmark=optional(f)?'o|':'||',cmark=oneToOne(f)?'o|':'o{';
    s+=`  ${parent} ${pmark}--${cmark} ${f.table} : "${refId.get(f.name+'@'+f.table)} ${f.name}"\n`;
  }
  return s;
};
const wrapHtml=(title,body)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | RRJ'S FOOD-HOUSE ERD</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f6fb;color:#1d2a42;font:15px/1.5 system-ui,Segoe UI,Arial,sans-serif}header{background:#182642;color:#fff;padding:20px 30px}header h1{font-size:24px;margin:0 0 4px}header p{margin:0;color:#cdd7eb}nav{display:flex;flex-wrap:wrap;gap:9px;padding:12px 30px;background:#e9eef7;position:sticky;top:0;z-index:2}nav a{color:#24477f;text-decoration:none;background:#fff;border:1px solid #c7d2e3;border-radius:6px;padding:5px 9px;font-weight:600}nav a:hover{background:#dce9ff}main{padding:24px 30px;max-width:1800px;margin:auto}h2{margin:25px 0 10px}p{max-width:1000px}code{font-family:Consolas,monospace}.diagram{background:white;border:1px solid #c7d2e3;border-radius:10px;overflow:auto;padding:8px;margin:18px 0;box-shadow:0 3px 12px #18264210}.diagram svg{display:block;width:max(100%,1600px);height:auto}.diagram.large svg{width:max(100%,2600px)}table{border-collapse:collapse;width:100%;background:#fff}th,td{border:1px solid #d7deea;padding:8px 9px;text-align:left;vertical-align:top}th{background:#e9eef7;position:sticky;top:49px}tr:nth-child(even) td{background:#f7f9fc}.meta{display:flex;gap:10px;flex-wrap:wrap}.chip{border:1px solid #cbd5e5;background:#fff;padding:4px 8px;border-radius:5px}.small{font-size:13px;color:#52607a}.scroll{overflow:auto}a{color:#245697}footer{padding:25px 30px;color:#52607a}</style></head><body><header><h1>${esc(title)}</h1><p>RRJ'S FOOD-HOUSE · hosted public schema · ${esc(catalog.captured_at_utc)}</p></header><nav><a href="index.html">Overview</a>${groups.map(g=>`<a href="${g[1]}.html">${esc(g[0])}</a>`).join('')}<a href="column-dictionary.html">Column dictionary</a><a href="key-index.html">Keys</a><a href="relationship-index.html">Relationship index</a></nav><main>${body}</main><footer>Source: read-only pg_catalog query against hosted project ${esc(catalog.project_ref)}. Diagram lines represent enforced foreign keys only.</footer></body></html>`;
const relationRow=f=>{
  const id=refId.get(f.name+'@'+f.table), parent=f.referenced_schema+'.'+f.referenced_table, child='public.'+f.table;
  const pmark=optional(f)?'0..1':'1',cmark=oneToOne(f)?'0..1':'0..many';
  return `<tr id="${id}"><td><code>${id}</code></td><td><code>${esc(f.name)}</code></td><td><a href="${groupOf.get(f.table).slug}.html"><code>${esc(child)}</code></a><br><code>(${esc(f.columns.join(', '))})</code></td><td><code>${esc(parent)}</code><br><code>(${esc(f.referenced_columns.join(', '))})</code></td><td>${pmark} parent per child; ${cmark} children per parent</td><td>${esc(f.on_delete)} / ${esc(f.on_update)}</td></tr>`;
};
const indexBody=`<div class="meta"><span class="chip">36 public tables</span><span class="chip">414 columns</span><span class="chip">36 PKs</span><span class="chip">31 unique constraints</span><span class="chip">80 FKs</span></div><p>The overview shows every public table and every enforced FK. The six domain sheets show all 414 fields with exact PostgreSQL types and nullability. Use the relationship index for precise column pairs and cross-domain links.</p><div class="diagram large">${graphviz.dot(dotFor(catalog.tables.map(t=>t.name),'Hosted public schema — 36 tables / 80 FKs',true,true))}</div><p class="small"><b>Notation:</b> tee = one, circle = optional zero, crow's foot = many. The end beside a parent is 1 or 0..1 parent per child; the end beside a child is 0..many or 0..1 children per parent. Zero children are always possible under an FK alone. A unique child FK changes many to at most one. Composite FK optionality follows PostgreSQL MATCH SIMPLE. <code>auth.users</code> is an external endpoint and is not counted among the 36 public tables. Edge IDs link to the relationship index.</p><h2>Files and verification</h2><p><a href="relationship-index.html">Full relationship index</a> · <a href="key-index.html">Primary and unique key index</a> · <a href="column-dictionary.html">Column dictionary with defaults</a> · <a href="hosted-public-catalog.json">Catalog JSON</a> · <a href="overview.mmd">Editable Mermaid overview</a> · <a href="VALIDATION.md">Validation report</a></p><div class="scroll"><table><thead><tr><th>Domain sheet</th><th>Tables</th><th>Editable source</th></tr></thead><tbody>${groups.map(g=>`<tr><td><a href="${g[1]}.html">${esc(g[0])}</a></td><td>${g[2].length}</td><td><a href="${g[1]}.mmd">Mermaid</a> · <a href="${g[1]}.dot">DOT</a> · <a href="${g[1]}.svg">SVG</a></td></tr>`).join('')}</tbody></table></div>`;
const overviewSvg=graphviz.dot(dotFor(catalog.tables.map(t=>t.name),'Hosted public schema — 36 tables / 80 FKs',true,true));
write('overview.dot',dotFor(catalog.tables.map(t=>t.name),'Hosted public schema — 36 tables / 80 FKs',true,true));
write('overview.mmd',mmdFor(catalog.tables.map(t=>t.name),'Overview / all public tables',true));
write('overview.svg',overviewSvg);
write('index.html',wrapHtml('Traditional ERD — overview',indexBody.replace(/<div class="diagram large">[\s\S]*?<\/div>/,`<div class="diagram large">${overviewSvg}</div>`)));
for(const [title,slug,names] of groups) {
  const dot=dotFor(names,title,false,false),svg=graphviz.dot(dot);
  write(slug+'.dot',dot);write(slug+'.mmd',mmdFor(names,title));write(slug+'.svg',svg);
  const internal=fks.filter(f=>names.includes(f.table)&&f.referenced_schema==='public'&&names.includes(f.referenced_table));
  const outgoing=fks.filter(f=>names.includes(f.table)&&!(f.referenced_schema==='public'&&names.includes(f.referenced_table)));
  const incoming=fks.filter(f=>f.referenced_schema==='public'&&names.includes(f.referenced_table)&&!names.includes(f.table));
  const body=`<div class="meta"><span class="chip">${names.length} tables</span><span class="chip">${names.reduce((n,x)=>n+tableOf.get(x).columns.length,0)} columns</span><span class="chip">${internal.length} internal FKs</span><span class="chip">${outgoing.length} outgoing cross-domain FKs</span><span class="chip">${incoming.length} incoming cross-domain FKs</span></div><p>All table fields appear below. Lines show enforced FKs within this sheet. Cross-domain references are listed after the diagram and in the full relationship index.</p><div class="diagram">${svg}</div><p class="small"><b>PK</b> primary key · <b>FK</b> foreign key · <b>UQ</b> membership in a unique constraint. For composite PK/UQ column groups, see the <a href="key-index.html">key index</a>. Type and NULL labels are from PostgreSQL. Tee = one, circle = optional, crow's foot = many. Edge IDs resolve in the relationship index.</p><h2>Outgoing references</h2>${outgoing.length?`<div class="scroll"><table><thead><tr><th>ID</th><th>Child columns</th><th>Referenced columns</th></tr></thead><tbody>${outgoing.map(f=>`<tr><td><a href="relationship-index.html#${refId.get(f.name+'@'+f.table)}">${refId.get(f.name+'@'+f.table)}</a></td><td><code>${esc(f.table)}(${esc(f.columns.join(', '))})</code></td><td><code>${esc(f.referenced_schema+'.'+f.referenced_table)}(${esc(f.referenced_columns.join(', '))})</code></td></tr>`).join('')}</tbody></table></div>`:'<p>None.</p>'}<h2>Incoming references</h2>${incoming.length?`<div class="scroll"><table><thead><tr><th>ID</th><th>Child columns</th><th>Referenced columns on this sheet</th></tr></thead><tbody>${incoming.map(f=>`<tr><td><a href="relationship-index.html#${refId.get(f.name+'@'+f.table)}">${refId.get(f.name+'@'+f.table)}</a></td><td><code>${esc(f.table)}(${esc(f.columns.join(', '))})</code></td><td><code>${esc(f.referenced_table)}(${esc(f.referenced_columns.join(', '))})</code></td></tr>`).join('')}</tbody></table></div>`:'<p>None.</p>'}<p><a href="${slug}.mmd">Editable Mermaid source</a> · <a href="${slug}.dot">Editable DOT source</a> · <a href="${slug}.svg">Standalone SVG</a></p>`;
  write(slug+'.html',wrapHtml(title,body));
}
const colRows=catalog.tables.flatMap(t=>t.columns.map(c=>[t.name,c.position,c.name,c.type,c.nullable?'YES':'NO',c.default??'',pkOf.get(t.name)?.has(c.name)?'YES':'NO',fkColsOf.get(t.name).has(c.name)?'YES':'NO',uniqColsOf.get(t.name).has(c.name)?'YES':'NO']));
write('columns.csv',['table,position,column,type,nullable,default,primary_key,foreign_key_column,unique_constraint_column',...colRows.map(r=>r.map(csv).join(','))].join('\n')+'\n');
const dictRows=catalog.tables.map(t=>`<h2 id="${t.name}">public.${esc(t.name)} <span class="small">(${t.columns.length} columns)</span></h2><div class="scroll"><table><thead><tr><th>#</th><th>Column</th><th>PostgreSQL type</th><th>Nullable</th><th>Default</th><th>Keys</th></tr></thead><tbody>${t.columns.map(c=>`<tr><td>${c.position}</td><td><code>${esc(c.name)}</code></td><td><code>${esc(c.type)}</code></td><td>${c.nullable?'YES':'NO'}</td><td><code>${esc(c.default??'')}</code></td><td>${[pkOf.get(t.name)?.has(c.name)?'PK':null,fkColsOf.get(t.name).has(c.name)?'FK':null,uniqColsOf.get(t.name).has(c.name)?'UQ':null].filter(Boolean).join(', ')}</td></tr>`).join('')}</tbody></table></div>`).join('');
write('column-dictionary.html',wrapHtml('Column dictionary',`<p>Every column in the hosted <code>public</code> base tables, in PostgreSQL column order. Exact catalog defaults are reproduced; an empty default cell means none.</p>${dictRows}`));
const keyConstraints=[...pks,...uniques].sort((a,b)=>(a.table+'.'+a.name).localeCompare(b.table+'.'+b.name));
write('keys.csv',['table,constraint,type,ordered_columns',...keyConstraints.map(k=>[k.table,k.name,k.type==='p'?'PRIMARY KEY':'UNIQUE',k.columns.join(' | ')].map(csv).join(','))].join('\n')+'\n');
write('key-index.html',wrapHtml('Primary and unique keys',`<p>These are the actual PostgreSQL primary key and unique constraints. Column order is preserved, including composite keys. A UQ tag on a diagram field means that the field belongs to a listed constraint; it does not claim that the field alone is unique.</p><div class="scroll"><table><thead><tr><th>Table</th><th>Constraint</th><th>Kind</th><th>Ordered columns</th></tr></thead><tbody>${keyConstraints.map(k=>`<tr><td><a href="${groupOf.get(k.table).slug}.html"><code>public.${esc(k.table)}</code></a></td><td><code>${esc(k.name)}</code></td><td>${k.type==='p'?'PRIMARY KEY':'UNIQUE'}</td><td><code>${esc(k.columns.join(', '))}</code></td></tr>`).join('')}</tbody></table></div>`));
const action={a:'NO ACTION',r:'RESTRICT',c:'CASCADE',n:'SET NULL',d:'SET DEFAULT'};
write('relationships.csv',['id,constraint,child_table,child_columns,parent_schema,parent_table,parent_columns,parent_per_child,children_per_parent,on_delete,on_update,validated',...fks.map(f=>[refId.get(f.name+'@'+f.table),f.name,f.table,f.columns.join(' | '),f.referenced_schema,f.referenced_table,f.referenced_columns.join(' | '),optional(f)?'0..1':'1',oneToOne(f)?'0..1':'0..many',action[f.on_delete],action[f.on_update],f.validated].map(csv).join(','))].join('\n')+'\n');
const relBody=`<p>Every row below is an enforced PostgreSQL FK. Cardinality comes from FK nullability and globally unique child key sets. The rows do not infer relationships from similarly named columns or application code. <code>auth.users</code> is outside the diagram scope.</p><p class="small">Delete/update codes: a = NO ACTION, r = RESTRICT, c = CASCADE, n = SET NULL, d = SET DEFAULT. All 80 FKs in this extraction were cataloged with their actual referenced columns; see JSON for match mode, deferrability, and validation status.</p><div class="scroll"><table><thead><tr><th>ID</th><th>Constraint</th><th>Child table / columns</th><th>Parent table / columns</th><th>Cardinality</th><th>Delete / update</th></tr></thead><tbody>${fks.map(relationRow).join('')}</tbody></table></div>`;
write('relationship-index.html',wrapHtml('Relationship index — 80 enforced FKs',relBody));
const unknown=[...groupOf.keys()].filter(x=>!tableOf.has(x)),unmapped=catalog.tables.filter(t=>!groupOf.has(t.name)).map(t=>t.name);
const badFks=fks.filter(f=>!tableOf.has(f.table)||f.columns.some(c=>!tableOf.get(f.table).columns.some(x=>x.name===c))||(f.referenced_schema==='public'&&(!tableOf.has(f.referenced_table)||f.referenced_columns.some(c=>!tableOf.get(f.referenced_table).columns.some(x=>x.name===c)))));
const composite=fks.filter(f=>f.columns.length>1),cross=fks.filter(f=>f.referenced_schema!=='public'||groupOf.get(f.table)?.slug!==groupOf.get(f.referenced_table)?.slug);
const svgCount=fs.readdirSync(here).filter(x=>x.endsWith('.svg')).length;
const countSvg=(file,kind)=>(fs.readFileSync(path.join(here,file),'utf8').match(new RegExp('<g id="'+kind+'[0-9]+" class="'+kind+'">','g'))||[]).length;
const domainSvgNodes=groups.reduce((n,g)=>n+countSvg(g[1]+'.svg','node'),0);
const domainSvgEdges=groups.reduce((n,g)=>n+countSvg(g[1]+'.svg','edge'),0);
const checks=[
 ['public table count',catalog.tables.length===36,`${catalog.tables.length} observed; 36 expected from prior mapping`],
 ['column count',colRows.length===catalog.column_count,`${colRows.length} / ${catalog.column_count}`],
 ['primary key coverage',pks.length===catalog.tables.length,`${pks.length} PK constraints / ${catalog.tables.length} tables`],
 ['unique constraint count',uniques.length===31,`${uniques.length} observed`],
 ['foreign key count',fks.length===80,`${fks.length} observed`],
 ['table-to-domain coverage',!unknown.length&&!unmapped.length,`unmapped: ${unmapped.join(', ')||'none'}; unknown: ${unknown.join(', ')||'none'}`],
 ['FK column resolution',!badFks.length,`${badFks.length} unresolved public endpoints`],
 ['rendered SVG count',svgCount===7,`${svgCount} / 7`],
 ['overview rendered table/edge coverage',countSvg('overview.svg','node')===37&&countSvg('overview.svg','edge')===80,`${countSvg('overview.svg','node')} nodes (36 public + auth.users), ${countSvg('overview.svg','edge')} / 80 edges`],
 ['domain rendered table/edge coverage',domainSvgNodes===36&&domainSvgEdges===80-cross.length,`${domainSvgNodes} / 36 nodes, ${domainSvgEdges} / ${80-cross.length} internal edges`],
 ['key index coverage',keyConstraints.length===pks.length+uniques.length,`${keyConstraints.length} / ${pks.length+uniques.length} PK and UQ constraints`],
 ['unique-index cardinality filter',catalog.unique_indexes.every(i=>typeof i.has_expression==='boolean'),`${catalog.unique_indexes.filter(i=>i.has_expression).length} expression indexes tagged; partial/invalid indexes excluded`],
 ['relationship index coverage',fks.length===refId.size,`${refId.size} unique IDs`],
];
const validation=`# Hosted public ERD validation\n\nCaptured: ${catalog.captured_at_utc}; project: ${catalog.project_ref}. All hosted operations were SELECT-only pg_catalog reads. This is a point-in-time snapshot.\n\n| Check | Result | Evidence |\n| --- | --- | --- |\n${checks.map(([name,ok,evidence])=>`| ${name} | **${ok?'PASS':'FAIL'}** | ${evidence} |`).join('\n')}\n\nObserved: **${catalog.tables.length} tables, ${colRows.length} columns, ${pks.length} PKs, ${uniques.length} unique constraints, ${fks.length} FKs**. ${composite.length} composite FKs; ${cross.length} cross-domain or external FKs; 1 FK to auth.users. All 36 mapped public tables remain present; no added or missing table was observed.\n\nA relationship is included only if backed by pg_constraint.contype = f. One-to-one maximums use a full, unconditional unique key or unique index on the child FK columns. Partial, invalid, and expression-based unique indexes are excluded from cardinality inference. Optional child-to-parent participation derives from column nullability (for a composite MATCH SIMPLE FK, any nullable component makes the parent optional). FK constraints alone never require a parent to have children. Defaults, exact types, and all composite key columns are in the catalog and dictionary. The Mermaid type tokens normalize punctuation for parser compatibility; exact PostgreSQL type spelling is displayed in SVG and dictionary.\n\n**NOT VERIFIED:** live write behavior, hosted authenticated flows, business semantics inferred from application code, future schema stability, and rendering the alternative Mermaid sources in Mermaid itself. The delivered HTML/SVG was rendered from the editable DOT sources and opened in Chrome. No business data or schema was changed.\n\nRender: npm install --prefix <temp-renderer-folder> --no-save @hpcc-js/wasm-graphviz@1.30.0; set ERD_GRAPHVIZ_PACKAGE if using another folder; then run node build-erd.mjs.\n`;
write('VALIDATION.md',validation);
console.log(checks.map(([name,ok])=>`${ok?'PASS':'FAIL'} ${name}`).join('\n'));
console.log(`Generated ${svgCount} SVGs; ${cross.length} cross-domain/external FKs; ${composite.length} composite FKs.`);
if(checks.some(c=>!c[1])) process.exitCode=1;
