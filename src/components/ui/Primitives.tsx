import type { ReactNode } from 'react'

export type SummaryMetricTone='neutral'|'success'|'warning'|'danger'|'info'

export function Panel({children,className=''}:{children:ReactNode;className?:string}){
  return <section className={`ui-panel ${className}`.trim()}>{children}</section>
}

export function PanelHeader({eyebrow,title,description,trailing}:{eyebrow?:string;title:string;description?:string;trailing?:ReactNode}){
  return <header className="ui-panel-header">
    <div className="ui-panel-header-copy">{eyebrow&&<span className="ui-eyebrow">{eyebrow}</span>}<h2>{title}</h2>{description&&<p>{description}</p>}</div>
    {trailing&&<div className="ui-panel-header-trailing">{trailing}</div>}
  </header>
}

export function SearchField({value,onChange,placeholder='Buscar…',ariaLabel}:{value:string;onChange:(value:string)=>void;placeholder?:string;ariaLabel:string}){
  return <label className="ui-search-field"><span className="material-symbols-rounded" aria-hidden="true">search</span><span className="sr-only">{ariaLabel}</span><input type="search" aria-label={ariaLabel} placeholder={placeholder} value={value} onChange={event=>onChange(event.target.value)}/></label>
}

export function PageToolbar({search,filters,actions,ariaLabel='Ferramentas da página',embedded=false}:{search?:ReactNode;filters?:ReactNode;actions?:ReactNode;ariaLabel?:string;embedded?:boolean}){
  return <div className={`ui-page-toolbar ${embedded?'ui-page-toolbar-embedded':''}`.trim()} role="region" aria-label={ariaLabel}><div className="ui-page-toolbar-main">{search&&<div className="ui-page-toolbar-search">{search}</div>}{filters&&<div className="ui-page-toolbar-filters">{filters}</div>}</div>{actions&&<div className="ui-page-toolbar-actions">{actions}</div>}</div>
}

export interface SummaryMetricItem{key:string;label:string;value:ReactNode;detail?:ReactNode;tone?:SummaryMetricTone;icon?:string;active?:boolean;onClick?:()=>void}
export function SummaryMetrics({items,ariaLabel='Resumo da página'}:{items:SummaryMetricItem[];ariaLabel?:string}){
  return <div className="ui-summary-metrics ui-summary-metrics-filters" role="group" aria-label={ariaLabel}>{items.map(item=>{const tone=item.tone??'neutral';const content=<>{item.icon&&<span className="ui-summary-metric-icon material-symbols-rounded" aria-hidden="true">{item.icon}</span>}<div className="ui-summary-metric-copy"><span>{item.label}</span><strong>{item.value}</strong>{item.detail&&<small>{item.detail}</small>}</div></>;return item.onClick?<button key={item.key} type="button" className={`ui-summary-metric ui-summary-metric-${tone} ${item.active?'is-active':''}`.trim()} aria-pressed={item.active} onClick={item.onClick}>{content}</button>:<div key={item.key} className={`ui-summary-metric ui-summary-metric-${tone}`}>{content}</div>})}</div>
}

export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:'neutral'|'success'|'warning'|'danger'}){
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>
}

export function Chip({children}:{children:ReactNode}){return <span className="ui-chip">{children}</span>}

export function EmptyState({title,description,icon='inbox',tone='neutral'}:{title:string;description?:string;icon?:string;tone?:'neutral'|'error'}){
  return <div className={`ui-empty-state ui-empty-state-${tone}`} role={tone==='error'?'alert':undefined}><span className="material-symbols-rounded" aria-hidden="true">{icon}</span><div><strong>{title}</strong>{description&&<p>{description}</p>}</div></div>
}

export function Skeleton({lines=5}:{lines?:number}){return <div className="ui-skeleton" aria-hidden="true">{Array.from({length:lines},(_,index)=><span key={index}/>)}</div>}
