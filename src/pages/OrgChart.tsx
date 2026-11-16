import {useState} from 'react'
import {supervisors,distribution,normalized} from '../lib/metrics'
import {Title,Panel,Empty} from '../ui/common'
import type {Employee} from '../types'
/**
 * Equipe de um supervisor SEM o próprio supervisor: o registro dele (mesma matrícula ou mesmo nome) não entra na
 * contagem nem aparece como linha dentro dele mesmo.
 */
export function equipe(rows:Employee[],s:{id:string;name:string}):Employee[]{
  const nome=normalized(s.name)
  return rows.filter(x=>(x.supervisorId||x.supervisor||'SEM SUPERVISÃO')===s.id&&x.id!==s.id&&normalized(x.name)!==nome)
}
/**
 * Encarregados da equipe. Quem tem o próprio supervisor (ou nada) no campo encarregado responde direto a ele:
 * vira a linha "Equipe direta (sem encarregado)", em vez de repetir o supervisor dentro dele mesmo.
 */
export function encarregados(people:Employee[],supervisor:string):{name:string;value:number}[]{
  const sup=normalized(supervisor)
  const linhas=distribution(people.map(p=>({...p,lead:!p.lead||normalized(p.lead)===sup?DIRETA:p.lead})),'lead')
  return [...linhas.filter(l=>l.name!==DIRETA),...linhas.filter(l=>l.name===DIRETA)]
}
const DIRETA='Equipe direta (sem encarregado)'
export function OrgChart({rows}:{rows:Employee[]}){const groups=supervisors(rows);const [expanded,setExpanded]=useState<string[]>([]);return <><Title title="Organograma" subtitle="Estrutura de liderança derivada dos vínculos registrados na aba Cadastros."/><Panel title="Hierarquia funcional" kicker="SUPERVISOR → ENCARREGADO → EQUIPE"><div className="org-list">{groups.map(s=>{const open=expanded.includes(s.id);const people=equipe(rows,s);const leads=encarregados(people,s.name);return <article className="org-group" key={s.id}><button className="org-primary" type="button" aria-expanded={open} onClick={()=>setExpanded(v=>open?v.filter(x=>x!==s.id):[...v,s.id])}><i className={`pi ${open?'pi-chevron-down':'pi-chevron-right'}`}/><span className="avatar"><i className="pi pi-sitemap"/></span><strong>{s.name}</strong><span className="org-count">{people.length} pessoas</span></button>{open&&<div className="org-children">{leads.map(l=><div className="org-child" key={l.name}><i className="pi pi-users"/><span>{l.name}</span><strong>{l.value}</strong></div>)}</div>}</article>})}{!groups.length&&<Empty/>}</div><p className="hint">O organograma é baseado nos IDs e nomes de superior e encarregado cadastrados; não representa necessariamente a estrutura formal de RH.</p></Panel></>}
