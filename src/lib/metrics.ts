import type {Employee,Filters,HubPayload} from '../types'
import {filterKeys} from '../types'
export function normalized(value:unknown):string {return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim()}
/** Filtros globais: em cada campo, lista vazia = todos; com valores, o registro precisa estar entre eles. */
export function filterEmployees(rows:Employee[],filters:Filters):Employee[]{
  const ativos=filterKeys.filter(k=>filters[k].length)
  return rows.filter(e=>ativos.every(k=>filters[k].includes(e[k])))
}
/** Busca por texto da tela de Colaboradores (local): nome, matrícula, cargo, liderança e alocação, sem acentos. */
export function searchEmployees(rows:Employee[],query:string):Employee[]{
  const q=normalized(query)
  if(!q)return rows
  return rows.filter(e=>[e.name,e.id,e.role,e.supervisor,e.lead,e.client].some(v=>normalized(v).includes(q)))
}
export function distribution(rows:Employee[],key:keyof Employee):{name:string;value:number}[]{
 const counts=new Map<string,number>();for(const row of rows){const k=row[key]?.trim()||'NÃO INFORMADO';counts.set(k,(counts.get(k)??0)+1)}
 return [...counts].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,'pt-BR'))
}
export function uniqueValues(rows:Employee[],key:keyof Employee):string[]{return [...new Set(rows.map(row=>String(row[key]??'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'))}
export function parseBRDate(s:string):Date|null{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());if(!m)return null;const d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));return d.getFullYear()===Number(m[3])&&d.getMonth()===Number(m[2])-1&&d.getDate()===Number(m[1])?d:null}
export function stats(rows:Employee[],now=new Date()){
 const working=rows.filter(e=>normalized(e.status)==='TRABALHANDO').length
 const admissions=rows.filter(e=>{const d=parseBRDate(e.admission);return d&&d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()}).length
 return {total:rows.length,working,other:rows.length-working,admissions,unassigned:rows.filter(e=>!e.client||normalized(e.client)==='NAO INFORMADO').length,supervisors:new Set(rows.map(e=>e.supervisorId||e.supervisor).filter(Boolean)).size}
}
export function qualityLabel(hub:HubPayload){return hub.quality.duplicateIds+hub.quality.invalidRows}
export function supervisors(rows:Employee[]){
 const m=new Map<string,{name:string;id:string;total:number;working:number;clients:Set<string>;modules:Set<string>;costCenters:Set<string>;leads:Set<string>}>()
 for(const row of rows){const id=row.supervisorId||row.supervisor||'SEM SUPERVISÃO';if(!m.has(id))m.set(id,{name:row.supervisor||'SEM SUPERVISÃO',id,total:0,working:0,clients:new Set(),modules:new Set(),costCenters:new Set(),leads:new Set()});const s=m.get(id)!;s.total++;if(normalized(row.status)==='TRABALHANDO')s.working++;if(row.client)s.clients.add(row.client);if(row.module)s.modules.add(row.module);if(row.costCenter)s.costCenters.add(row.costCenter);if(row.lead)s.leads.add(row.lead)}
 return [...m.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'pt-BR'))
}
export function tenureDistribution(rows:Employee[],now=new Date()){
 const cats=[{name:'< 3 meses',value:0},{name:'3–12 meses',value:0},{name:'1–3 anos',value:0},{name:'3–5 anos',value:0},{name:'5+ anos',value:0},{name:'Não informado',value:0}]
 for(const e of rows){const d=parseBRDate(e.admission);if(!d||d>now){cats[5].value++;continue}const months=(now.getFullYear()-d.getFullYear())*12+now.getMonth()-d.getMonth()-(now.getDate()<d.getDate()?1:0);cats[months<3?0:months<12?1:months<36?2:months<60?3:4].value++}
 return cats
}
