import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from './PageHeader'
import { SolicitationCorrectionModal } from './SolicitationCorrectionModal'
import {
  Badge,
  Chip,
  EmptyState,
  PageToolbar,
  Panel,
  PanelHeader,
  SearchField,
  Skeleton,
  SummaryMetrics,
  type SummaryMetricItem,
} from './ui/Primitives'
import { fetchCatalogos } from '../services/catalogService'
import {
  applyAdministrativeTriage,
  fetchAdministrativeSolicitationDetail,
  fetchAdministrativeSolicitations,
  registerAdministrativeAttendance,
  registerPartialShifts,
  type PartialShiftEntryInput,
} from '../services/solicitationService'
import type { CatalogosDto } from '../types/catalog'
import type {
  AdministrativeSolicitationDetail,
  AdministrativeSolicitationListItem,
} from '../types/solicitation'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const monthLabels = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

type PartialShiftDraft = {
  nomeColaborador: string
  horasTrabalhadas: string
  horarioSaida: string
  motivo: string
}

const emptyPartialDraft = (): PartialShiftDraft => ({
  nomeColaborador: '',
  horasTrabalhadas: '',
  horarioSaida: '',
  motivo: '',
})

function formatMoney(value: number | null) { return value == null ? '—' : money.format(value) }
function formatDate(value: string) { if (!value) return '—'; const [y,m,d]=value.slice(0,10).split('-'); return y&&m&&d?`${d}/${m}/${y}`:value }
function formatDateShort(value: string) { if (!value) return '—'; const [y,m,d]=value.slice(0,10).split('-'); return y&&m&&d?`${d}/${m}/${y.slice(-2)}`:value }
function formatDateTime(value: string) { if (!value) return '—'; const date=formatDate(value); const time=value.length>=16?value.slice(11,16):''; return time?`${date} ${time}`:date }
function registrationParts(value:string){const date=value.slice(0,10);const[y,m,d]=date.split('-');return{date,year:y||'',month:m||'',day:d||''}}
function typeLabel(value:string){return value==='MAO_DE_OBRA'?'Mão de obra':'Alimentação / Bebida'}
function statusInfo(item:AdministrativeSolicitationListItem){if(!item.triagemConcluida)return{label:'Aguardando triagem',tone:'neutral' as const};if(item.tipoSolicitacao==='ALIMENTACAO_BEBIDA')return{label:'Triagem concluída',tone:'success' as const};if(!item.realizadoRegistrado)return{label:'Aguardando realizado',tone:'warning' as const};if(item.divergencia)return{label:'Com divergência',tone:'danger' as const};return{label:'Concluído',tone:'success' as const}}
function DetailField({label,value}:{label:string;value:string|number|null}){return <div className="admin-detail-field"><span>{label}</span><strong>{value===''||value==null?'—':value}</strong></div>}

function buildWhatsAppMessage(detail:AdministrativeSolicitationDetail){
  const lines:string[]=[]
  lines.push(`Pedido para ${formatDateShort(detail.dataOperacional)}`)
  if(detail.tipoSolicitacao==='ALIMENTACAO_BEBIDA'){
    const products:string[]=[]
    if(detail.produtoAlimentacao&&detail.qtdAlimentacao!=null)products.push(`${detail.qtdAlimentacao} ${detail.produtoAlimentacao}`)
    if(detail.produtoBebida&&detail.qtdBebida!=null)products.push(`${detail.qtdBebida} ${detail.produtoBebida}`)
    if(products.length)lines.push(products.join(' + '))
  }else{
    if(detail.qtdSolicitada!=null&&detail.funcao)lines.push(`${detail.qtdSolicitada} ${detail.funcao}`)
    if(detail.atividade)lines.push(`Atividade: ${detail.atividade}`)
    if(detail.turno)lines.push(`Turno: ${detail.turno}`)
  }
  if(detail.supervisor)lines.push(`Supervisor(a) ${detail.supervisor}`)
  if(detail.justificativa)lines.push(`Observação: ${detail.justificativa}`)
  lines.push(`Protocolo: ${detail.idSolicitacao}`)
  return lines.join('\n')
}

export function AdminSolicitationsPage(){
  const[items,setItems]=useState<AdministrativeSolicitationListItem[]>([])
  const[selectedId,setSelectedId]=useState('')
  const[detail,setDetail]=useState<AdministrativeSolicitationDetail|null>(null)
  const[catalogs,setCatalogs]=useState<CatalogosDto|null>(null)
  const[search,setSearch]=useState('')
  const[typeFilter,setTypeFilter]=useState('TODOS')
  const[statusFilter,setStatusFilter]=useState('TODOS')
  const[registrationYear,setRegistrationYear]=useState('TODOS')
  const[registrationMonth,setRegistrationMonth]=useState('TODOS')
  const[registrationDate,setRegistrationDate]=useState('TODOS')
  const[loading,setLoading]=useState(true)
  const[detailLoading,setDetailLoading]=useState(false)
  const[actionLoading,setActionLoading]=useState(false)
  const[error,setError]=useState('')
  const[success,setSuccess]=useState('')
  const[provider,setProvider]=useState('')
  const[appliedFood,setAppliedFood]=useState('')
  const[appliedDrink,setAppliedDrink]=useState('')
  const[adjustmentReason,setAdjustmentReason]=useState('')
  const[attendance,setAttendance]=useState('')
  const[partialCount,setPartialCount]=useState(0)
  const[partialDrafts,setPartialDrafts]=useState<PartialShiftDraft[]>([])
  const[correctionOpen,setCorrectionOpen]=useState(false)

  async function reload(selected=selectedId){const response=await fetchAdministrativeSolicitations(500);setItems(response.itens);const next=selected||response.itens[0]?.idSolicitacao||'';setSelectedId(next);if(next)setDetail(await fetchAdministrativeSolicitationDetail(next))}

  useEffect(()=>{const controller=new AbortController();Promise.all([fetchAdministrativeSolicitations(500,controller.signal),fetchCatalogos(controller.signal)]).then(([response,loaded])=>{setItems(response.itens);setCatalogs(loaded);setSelectedId(current=>current||response.itens[0]?.idSolicitacao||'');setError('')}).catch(err=>{if(err instanceof DOMException&&err.name==='AbortError')return;setError(err instanceof Error?err.message:'Erro ao carregar painel administrativo.')}).finally(()=>setLoading(false));return()=>controller.abort()},[])

  useEffect(()=>{if(!selectedId){setDetail(null);return}const controller=new AbortController();setDetailLoading(true);setSuccess('');fetchAdministrativeSolicitationDetail(selectedId,controller.signal).then(loaded=>{setDetail(loaded);setProvider(loaded.fornecedor||'');setAppliedFood(loaded.produtoAlimentacaoAplicado||loaded.produtoAlimentacao||'');setAppliedDrink(loaded.produtoBebidaAplicado||loaded.produtoBebida||'');setAdjustmentReason(loaded.motivoAjusteProduto||'');setAttendance(loaded.qtdComparecida==null?'':String(loaded.qtdComparecida));setPartialCount(0);setPartialDrafts([])}).catch(err=>{if(err instanceof DOMException&&err.name==='AbortError')return;setError(err instanceof Error?err.message:'Erro ao carregar detalhe.')}).finally(()=>setDetailLoading(false));return()=>controller.abort()},[selectedId])

  const registrationYears=useMemo(()=>Array.from(new Set(items.map(item=>registrationParts(item.dataCriacao).year).filter(Boolean))).sort((a,b)=>b.localeCompare(a)),[items])
  const registrationMonths=useMemo(()=>registrationYear==='TODOS'?[]:Array.from(new Set(items.filter(item=>registrationParts(item.dataCriacao).year===registrationYear).map(item=>registrationParts(item.dataCriacao).month).filter(Boolean))).sort((a,b)=>Number(a)-Number(b)),[items,registrationYear])
  const registrationDates=useMemo(()=>registrationYear==='TODOS'||registrationMonth==='TODOS'?[]:Array.from(new Set(items.filter(item=>{const p=registrationParts(item.dataCriacao);return p.year===registrationYear&&p.month===registrationMonth}).map(item=>registrationParts(item.dataCriacao).date).filter(Boolean))).sort((a,b)=>b.localeCompare(a)),[items,registrationYear,registrationMonth])
  const periodItems=useMemo(()=>items.filter(item=>{const p=registrationParts(item.dataCriacao);return(registrationYear==='TODOS'||p.year===registrationYear)&&(registrationMonth==='TODOS'||p.month===registrationMonth)&&(registrationDate==='TODOS'||p.date===registrationDate)}),[items,registrationYear,registrationMonth,registrationDate])
  const filteredItems=useMemo(()=>{const q=search.trim().toUpperCase();return periodItems.filter(item=>{const text=!q||[item.idSolicitacao,item.operacao,item.supervisor,item.fornecedor,item.usuarioCriacao].some(v=>v.toUpperCase().includes(q));const type=typeFilter==='TODOS'||item.tipoSolicitacao===typeFilter;const status=statusFilter==='TODOS'||statusInfo(item).label===statusFilter;return text&&type&&status})},[periodItems,search,typeFilter,statusFilter])
  const metrics=useMemo(()=>({total:periodItems.length,pending:periodItems.filter(i=>!i.triagemConcluida).length,awaiting:periodItems.filter(i=>i.tipoSolicitacao==='MAO_DE_OBRA'&&i.triagemConcluida&&!i.realizadoRegistrado).length,divergences:periodItems.filter(i=>i.divergencia).length}),[periodItems])
  const summary:SummaryMetricItem[]=[{key:'all',label:'Total',value:metrics.total,detail:'no período de registro',icon:'dataset',tone:'neutral',active:statusFilter==='TODOS',onClick:()=>setStatusFilter('TODOS')},{key:'triage',label:'Aguardando triagem',value:metrics.pending,detail:'exigem definição administrativa',icon:'pending_actions',tone:'info',active:statusFilter==='Aguardando triagem',onClick:()=>setStatusFilter('Aguardando triagem')},{key:'actual',label:'Aguardando realizado',value:metrics.awaiting,detail:'mão de obra já precificada',icon:'groups',tone:'warning',active:statusFilter==='Aguardando realizado',onClick:()=>setStatusFilter('Aguardando realizado')},{key:'div',label:'Com divergência',value:metrics.divergences,detail:'solicitado x comparecido',icon:'error',tone:'danger',active:statusFilter==='Com divergência',onClick:()=>setStatusFilter('Com divergência')}]
  const eligibleProviders=useMemo(()=>!catalogs||!detail?[]:catalogs.fornecedores.filter(item=>item.tiposSolicitacao.includes(detail.tipoSolicitacao)),[catalogs,detail])
  const foods=catalogs?.produtos.filter(item=>item.categoria==='ALIMENTACAO')||[]
  const drinks=catalogs?.produtos.filter(item=>item.categoria==='BEBIDA')||[]
  const hasActiveFilters=Boolean(search.trim())||typeFilter!=='TODOS'||statusFilter!=='TODOS'||registrationYear!=='TODOS'||registrationMonth!=='TODOS'||registrationDate!=='TODOS'
  const attendedCount=detail?.qtdComparecida??0
  const registeredPartialCount=detail?.excecoesJornada?.length??0
  const availablePartialCount=Math.max(0,attendedCount-registeredPartialCount)
  const canRegisterPartialShift=detail?.tipoSolicitacao==='MAO_DE_OBRA'&&detail.realizadoRegistrado===true&&attendedCount>0&&availablePartialCount>0

  function handleYearChange(value:string){setRegistrationYear(value);setRegistrationMonth('TODOS');setRegistrationDate('TODOS')}
  function handleMonthChange(value:string){setRegistrationMonth(value);setRegistrationDate('TODOS')}
  function clearAllFilters(){setSearch('');setTypeFilter('TODOS');setStatusFilter('TODOS');setRegistrationYear('TODOS');setRegistrationMonth('TODOS');setRegistrationDate('TODOS')}
  function handlePartialCountChange(raw:string){const next=Math.max(0,Math.min(availablePartialCount,Number(raw)||0));setPartialCount(next);setPartialDrafts(current=>Array.from({length:next},(_,index)=>current[index]||emptyPartialDraft()))}
  function updatePartialDraft(index:number,field:keyof PartialShiftDraft,value:string){setPartialDrafts(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,[field]:value}:item))}

  async function handleTriage(){if(!detail||detail.triagemConcluida||!provider)return;setActionLoading(true);setError('');setSuccess('');try{await applyAdministrativeTriage({idSolicitacao:detail.idSolicitacao,fornecedor:provider,...(detail.tipoSolicitacao==='ALIMENTACAO_BEBIDA'?{produtoAlimentacaoAplicado:detail.produtoAlimentacao?appliedFood:undefined,produtoBebidaAplicado:detail.produtoBebida?appliedDrink:undefined,motivoAjusteProduto:adjustmentReason||undefined}:{})});await reload(detail.idSolicitacao);setSuccess('Triagem registrada com sucesso.')}catch(err){setError(err instanceof Error?err.message:'Não foi possível registrar a triagem.')}finally{setActionLoading(false)}}

  async function handleAttendance(){if(!detail||detail.tipoSolicitacao!=='MAO_DE_OBRA'||detail.realizadoRegistrado)return;const quantity=Number(attendance);if(!Number.isInteger(quantity)||quantity<0){setError('Quantidade comparecida deve ser um número inteiro maior ou igual a zero.');return}setActionLoading(true);setError('');setSuccess('');try{await registerAdministrativeAttendance({idSolicitacao:detail.idSolicitacao,qtdComparecida:quantity});await reload(detail.idSolicitacao);setSuccess('Comparecimento registrado com sucesso.')}catch(err){setError(err instanceof Error?err.message:'Não foi possível registrar o comparecimento.')}finally{setActionLoading(false)}}

  async function handlePartialShifts(){
    if(!detail||!canRegisterPartialShift||partialCount<=0)return
    if(partialDrafts.length!==partialCount){setError('Quantidade de jornadas parciais inconsistente. Selecione novamente a quantidade.');return}
    const standard=detail.jornadaPadraoHoras||9
    const seen=new Set<string>()
    const payload:PartialShiftEntryInput[]=[]
    for(let index=0;index<partialDrafts.length;index+=1){
      const item=partialDrafts[index]
      const name=item.nomeColaborador.trim()
      const hours=Number(item.horasTrabalhadas)
      const reason=item.motivo.trim()
      const key=name.toUpperCase()
      if(!name){setError(`Informe o colaborador da jornada parcial #${index+1}.`);return}
      if(seen.has(key)||detail.excecoesJornada.some(existing=>existing.nomeColaborador.trim().toUpperCase()===key)){setError(`O colaborador ${name} está duplicado nas jornadas parciais.`);return}
      if(!Number.isFinite(hours)||hours<=0||hours>=standard){setError(`Horas trabalhadas da jornada parcial #${index+1} deve ser maior que zero e menor que ${standard} horas.`);return}
      if(!reason){setError(`Informe o motivo da jornada parcial #${index+1}.`);return}
      seen.add(key)
      payload.push({nomeColaborador:name,horasTrabalhadas:hours,horarioSaida:item.horarioSaida||undefined,motivo:reason})
    }
    setActionLoading(true);setError('');setSuccess('')
    try{await registerPartialShifts({idSolicitacao:detail.idSolicitacao,excecoes:payload});setPartialCount(0);setPartialDrafts([]);await reload(detail.idSolicitacao);setSuccess(`${payload.length} jornada(s) parcial(is) registrada(s) e valor real recalculado.`)}catch(err){setError(err instanceof Error?err.message:'Não foi possível registrar as jornadas parciais.')}finally{setActionLoading(false)}
  }

  async function handleCopySummary(){if(!detail)return;try{await navigator.clipboard.writeText(buildWhatsAppMessage(detail));setSuccess('Resumo copiado para a área de transferência.');setError('')}catch{setError('Não foi possível copiar o resumo automaticamente.')}}
  function handleOpenWhatsApp(){if(!detail)return;window.open(`https://wa.me/?text=${encodeURIComponent(buildWhatsAppMessage(detail))}`,'_blank','noopener,noreferrer')}
  async function handleCorrectionSaved(idSolicitacao:string){await reload(idSolicitacao);setSuccess('Correção registrada com sucesso e histórico preservado na auditoria.');setError('')}

  return <section className="admin-page">
    <PageHeader eyebrow="CONTROLE DE CUSTOS EXTRAS" title="Solicitações" description="Conferência, triagem, precificação e acompanhamento do realizado em um único workspace administrativo."/>
    {error&&<div className="admin-alert" role="alert"><span className="material-symbols-rounded" aria-hidden="true">error</span><span>{error}</span></div>}
    {success&&<div className="admin-alert admin-alert-success" role="status"><span className="material-symbols-rounded" aria-hidden="true">check_circle</span><span>{success}</span></div>}
    <SummaryMetrics items={summary} ariaLabel="Filtrar solicitações por situação"/>

    <div className="admin-workspace-grid">
      <Panel className="admin-list-workspace">
        <PanelHeader eyebrow="REGISTROS" title="Fila administrativa" description={`${filteredItems.length} registro(s) após filtros · período baseado na data de registro, não na data operacional.`} trailing={<Chip>{periodItems.length} no período</Chip>}/>
        <PageToolbar embedded ariaLabel="Filtros das solicitações" search={<SearchField ariaLabel="Pesquisar solicitações" placeholder="Protocolo, operação, supervisor…" value={search} onChange={setSearch}/>} filters={<>
          <select value={registrationYear} onChange={e=>handleYearChange(e.target.value)} aria-label="Ano da data de registro"><option value="TODOS">Ano: todos</option>{registrationYears.map(year=><option key={year} value={year}>{year}</option>)}</select>
          <select value={registrationMonth} onChange={e=>handleMonthChange(e.target.value)} aria-label="Mês da data de registro" disabled={registrationYear==='TODOS'}><option value="TODOS">{registrationYear==='TODOS'?'Mês: selecione o ano':'Mês: todos'}</option>{registrationMonths.map(month=><option key={month} value={month}>{monthLabels[Number(month)-1]}</option>)}</select>
          <select value={registrationDate} onChange={e=>setRegistrationDate(e.target.value)} aria-label="Data completa do registro" disabled={registrationYear==='TODOS'||registrationMonth==='TODOS'}><option value="TODOS">{registrationMonth==='TODOS'?'Data: selecione o mês':'Data: todas'}</option>{registrationDates.map(date=><option key={date} value={date}>{formatDate(date)}</option>)}</select>
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} aria-label="Tipo da solicitação"><option value="TODOS">Todos os tipos</option><option value="MAO_DE_OBRA">Mão de obra</option><option value="ALIMENTACAO_BEBIDA">Alimentação / Bebida</option></select>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} aria-label="Situação da solicitação"><option value="TODOS">Todas as situações</option><option>Aguardando triagem</option><option>Aguardando realizado</option><option>Triagem concluída</option><option>Com divergência</option><option>Concluído</option></select>
          <button type="button" className="button" onClick={clearAllFilters} disabled={!hasActiveFilters}>Limpar filtros</button>
        </>}/>
        <div className="admin-results">{loading?<Skeleton lines={7}/>:filteredItems.length===0?<EmptyState title="Nenhuma solicitação encontrada" description="Ajuste os filtros ou a busca para consultar outros registros."/>:<div className="table-wrap embedded"><table className="responsive-data-table admin-record-table"><thead><tr><th>Solicitação</th><th>Registro</th><th>Data operacional</th><th>Operação</th><th>Tipo</th><th>Status</th><th>Previsto</th><th><span className="sr-only">Abrir</span></th></tr></thead><tbody>{filteredItems.map(item=>{const status=statusInfo(item);return <tr key={item.idSolicitacao} className={selectedId===item.idSolicitacao?'is-selected':''}><td data-label="Solicitação" data-primary="true"><button type="button" className="table-link table-primary" onClick={()=>setSelectedId(item.idSolicitacao)}><strong>{item.idSolicitacao}</strong><small>{item.supervisor||'Sem supervisor'}</small></button></td><td data-label="Registro"><strong>{formatDateTime(item.dataCriacao)}</strong></td><td data-label="Data operacional"><strong>{formatDate(item.dataOperacional)}</strong></td><td data-label="Operação"><strong>{item.operacao||'—'}</strong></td><td data-label="Tipo"><span className="module-badge">{typeLabel(item.tipoSolicitacao)}</span></td><td data-label="Status"><Badge tone={status.tone}>{status.label}</Badge></td><td data-label="Previsto"><strong>{formatMoney(item.valorPrevisto)}</strong></td><td className="admin-open-cell"><button type="button" className="admin-open-link" onClick={()=>setSelectedId(item.idSolicitacao)}>Abrir<span className="material-symbols-rounded" aria-hidden="true">chevron_right</span></button></td></tr>})}</tbody></table></div>}</div>
      </Panel>

      <aside className="admin-detail-column" aria-label="Detalhe da solicitação">
        {detailLoading?<Panel><Skeleton lines={10}/></Panel>:!detail?<Panel><EmptyState title="Selecione uma solicitação" description="O detalhe e as ações administrativas serão exibidos aqui." icon="touch_app"/></Panel>:<Panel className="admin-detail-card">
          <div className="admin-detail-hero"><div className="admin-detail-hero-copy"><span className="ui-eyebrow">SOLICITAÇÃO</span><div className="admin-detail-title"><h2>{detail.idSolicitacao}</h2><Badge tone={statusInfo(detail as AdministrativeSolicitationListItem).tone}>{statusInfo(detail as AdministrativeSolicitationListItem).label}</Badge><button type="button" className="button" onClick={()=>setCorrectionOpen(true)}><span className="material-symbols-rounded" aria-hidden="true">edit</span>Editar</button></div><p>{detail.operacao||'Operação não informada'} · operacional em {formatDate(detail.dataOperacional)}</p></div></div>
          <div className="admin-detail-grid"><DetailField label="Registrado em" value={formatDateTime(detail.dataCriacao)}/><DetailField label="Data operacional" value={formatDate(detail.dataOperacional)}/><DetailField label="Operação" value={detail.operacao}/><DetailField label="Supervisor" value={detail.supervisor}/><DetailField label="Responsável custo" value={detail.responsavelCusto}/><DetailField label="Fornecedor" value={detail.fornecedor}/><DetailField label="Justificativa" value={detail.justificativa}/><DetailField label="Competência" value={detail.competencia}/></div>

          <div className="admin-action-box"><div className="admin-section-heading"><span className="material-symbols-rounded" aria-hidden="true">share</span><div><strong>Resumo da solicitação</strong><small>Texto padronizado para aviso por WhatsApp</small></div></div><button className="button" type="button" onClick={()=>void handleCopySummary()}>Copiar resumo</button><button className="button button-primary" type="button" onClick={handleOpenWhatsApp}>Abrir WhatsApp</button></div>

          {detail.tipoSolicitacao==='MAO_DE_OBRA'?<div className="admin-detail-section"><div className="admin-section-heading"><span className="material-symbols-rounded" aria-hidden="true">groups</span><div><strong>Mão de obra</strong><small>Solicitado e realizado</small></div></div><div className="admin-detail-grid"><DetailField label="Atividade" value={detail.atividade}/><DetailField label="Função" value={detail.funcao}/><DetailField label="Turno" value={detail.turno}/><DetailField label="Qtd. solicitada" value={detail.qtdSolicitada}/><DetailField label="Qtd. comparecida" value={detail.qtdComparecida}/><DetailField label="Preço unitário" value={formatMoney(detail.precoUnitarioAplicado)}/></div></div>:<div className="admin-detail-section"><div className="admin-section-heading"><span className="material-symbols-rounded" aria-hidden="true">lunch_dining</span><div><strong>Alimentação / Bebida</strong><small>Produto solicitado x aplicado</small></div></div><div className="admin-detail-grid"><DetailField label="Alimentação solicitada" value={detail.produtoAlimentacao}/><DetailField label="Alimentação aplicada" value={detail.produtoAlimentacaoAplicado}/><DetailField label="Qtd. alimentação" value={detail.qtdAlimentacao}/><DetailField label="Bebida solicitada" value={detail.produtoBebida}/><DetailField label="Bebida aplicada" value={detail.produtoBebidaAplicado}/><DetailField label="Qtd. bebida" value={detail.qtdBebida}/></div>{detail.motivoAjusteProduto&&<div className="admin-adjustment-note"><span>Motivo do ajuste</span><strong>{detail.motivoAjusteProduto}</strong></div>}</div>}

          {!detail.triagemConcluida&&<div className="admin-action-box"><div className="admin-section-heading"><span className="material-symbols-rounded" aria-hidden="true">assignment_turned_in</span><div><strong>Triagem administrativa</strong><small>Fornecedor e preço serão congelados no registro</small></div></div><label>Fornecedor<select value={provider} onChange={e=>setProvider(e.target.value)}><option value="">Selecione</option>{eligibleProviders.map(item=><option key={item.nome} value={item.nome}>{item.nome}</option>)}</select></label>{detail.tipoSolicitacao==='ALIMENTACAO_BEBIDA'&&<>{detail.produtoAlimentacao&&<label>Alimentação aplicada<select value={appliedFood} onChange={e=>setAppliedFood(e.target.value)}>{foods.map(item=><option key={item.nome} value={item.nome}>{item.nome}</option>)}</select></label>}{detail.produtoBebida&&<label>Bebida aplicada<select value={appliedDrink} onChange={e=>setAppliedDrink(e.target.value)}>{drinks.map(item=><option key={item.nome} value={item.nome}>{item.nome}</option>)}</select></label>}<label>Motivo do ajuste<textarea value={adjustmentReason} onChange={e=>setAdjustmentReason(e.target.value)} placeholder="Obrigatório somente quando o produto aplicado for diferente."/></label></>}<button className="button button-primary" type="button" onClick={()=>void handleTriage()} disabled={actionLoading||!provider}>{actionLoading?'Salvando…':'Registrar triagem'}</button></div>}

          {detail.tipoSolicitacao==='MAO_DE_OBRA'&&detail.triagemConcluida&&!detail.realizadoRegistrado&&<div className="admin-action-box"><div className="admin-section-heading"><span className="material-symbols-rounded" aria-hidden="true">how_to_reg</span><div><strong>Comparecimento real</strong><small>O primeiro registro fica protegido contra sobrescrita</small></div></div><label>Quantidade comparecida<input type="number" min="0" step="1" value={attendance} onChange={e=>setAttendance(e.target.value)}/></label><button className="button button-primary" type="button" onClick={()=>void handleAttendance()} disabled={actionLoading||attendance==='' }>{actionLoading?'Salvando…':'Registrar comparecimento'}</button></div>}

          {detail.tipoSolicitacao==='MAO_DE_OBRA'&&detail.realizadoRegistrado&&<div className="admin-action-box partial-shift-box">
            <div className="admin-section-heading"><span className="material-symbols-rounded" aria-hidden="true">schedule</span><div><strong>Jornada parcial</strong><small>Diária padrão de {detail.jornadaPadraoHoras||9}h · registre somente quem saiu antes.</small></div></div>
            <div className="partial-shift-capacity"><strong>{attendedCount} compareceram</strong><span>{registeredPartialCount} jornada(s) parcial(is) registrada(s)</span><span>{availablePartialCount} disponível(is) para lançamento</span></div>
            {detail.excecoesJornada.length>0&&<div className="partial-shift-list" aria-label="Jornadas parciais registradas">{detail.excecoesJornada.map(exception=><div className="partial-shift-item" key={exception.idExcecao}><div className="partial-shift-item-main"><strong>{exception.nomeColaborador}</strong><span>{exception.horasTrabalhadas??'—'}h{exception.horarioSaida?` · saída ${exception.horarioSaida}`:''}</span></div><div className="partial-shift-item-value"><strong>{formatMoney(exception.valorProporcional)}</strong><small>{exception.motivo}</small></div></div>)}</div>}
            {canRegisterPartialShift?<>
              <label className="partial-shift-count">Quantas pessoas saíram antes?<select value={String(partialCount)} onChange={e=>handlePartialCountChange(e.target.value)}><option value="0">Selecione</option>{Array.from({length:availablePartialCount},(_,index)=>index+1).map(value=><option key={value} value={value}>{value}</option>)}</select><small>Máximo permitido neste momento: {availablePartialCount}.</small></label>
              {partialDrafts.length>0&&<div className="partial-shift-batch">{partialDrafts.map((entry,index)=><fieldset className="partial-shift-entry" key={index}><legend>Jornada parcial #{index+1}</legend><div className="partial-shift-form-grid"><label>Colaborador<input value={entry.nomeColaborador} onChange={e=>updatePartialDraft(index,'nomeColaborador',e.target.value)} placeholder="Nome de quem saiu antes"/></label><label>Horas trabalhadas<input type="number" min="0.01" max={(detail.jornadaPadraoHoras||9)-0.01} step="0.25" value={entry.horasTrabalhadas} onChange={e=>updatePartialDraft(index,'horasTrabalhadas',e.target.value)} placeholder="Ex.: 5"/></label><label>Horário de saída<input type="time" value={entry.horarioSaida} onChange={e=>updatePartialDraft(index,'horarioSaida',e.target.value)}/></label><label className="partial-shift-reason">Motivo<input value={entry.motivo} onChange={e=>updatePartialDraft(index,'motivo',e.target.value)} placeholder="Ex.: saída antecipada autorizada"/></label></div></fieldset>)}</div>}
              <button className="button button-primary" type="button" onClick={()=>void handlePartialShifts()} disabled={actionLoading||partialCount===0}>{actionLoading?'Salvando…':partialCount>1?`Registrar ${partialCount} jornadas parciais`:'Registrar jornada parcial'}</button>
            </>:attendedCount>0&&<div className="partial-shift-complete">Todas as pessoas comparecidas já estão cobertas pelo limite de jornada parcial.</div>}
          </div>}

          <div className="admin-value-strip"><div><span>Valor previsto</span><strong>{formatMoney(detail.valorPrevisto)}</strong><small>snapshot da triagem</small></div><div><span>Valor real</span><strong>{formatMoney(detail.valorReal)}</strong><small>{detail.tipoSolicitacao==='ALIMENTACAO_BEBIDA'&&detail.valorReal==null?'Ainda não apurado neste fluxo':detail.excecoesJornada.length>0?'recalculado com jornada parcial':'calculado pelo realizado'}</small></div></div>
        </Panel>}
      </aside>
    </div>

    <SolicitationCorrectionModal open={correctionOpen} detail={detail} catalogs={catalogs} onClose={()=>setCorrectionOpen(false)} onSaved={handleCorrectionSaved}/>
  </section>
}
