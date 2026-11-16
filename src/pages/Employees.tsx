import type * as React from 'react'
import {useEffect, useMemo, useState} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {InputText} from 'primereact/inputtext'
import {DataTable} from 'primereact/datatable'
import {Column} from 'primereact/column'
import {Tag} from 'primereact/tag'
import {Button} from 'primereact/button'
import {Panel, Title, statusSeverity} from '../ui/common'
import {searchEmployees} from '../lib/metrics'
import {exportarRelatorioMichiel} from '../lib/relatorio'
import type {Employee, Filters} from '../types'

const countFmt = new Intl.NumberFormat('pt-BR')

/** Recorte local vindo de outra tela (clique numa alocação da Visão geral ou "Ver colaboradores" da Supervisão). */
type Recorte = {campo: 'client' | 'supervisor'; valor: string}
const rotuloRecorte: Record<Recorte['campo'], string> = {client: 'Alocação', supervisor: 'Supervisor'}

/**
 * Busca e recorte são LOCAIS desta tela: não alteram os filtros globais e somem ao sair dela. Antes, a busca entrava
 * nos filtros globais e continuava filtrando a Visão geral sem aparecer em lugar nenhum.
 */
export function Employees({rows}: {rows: Employee[]; filters?: Filters; setFilters?: React.Dispatch<React.SetStateAction<Filters>>}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [recorte, setRecorte] = useState<Recorte | null>(null)

  // Recebe o recorte da navegação e limpa o estado do histórico (voltar/atualizar não reaplica sozinho).
  useEffect(() => {
    const vindo = (location.state as {recorte?: Recorte} | null)?.recorte
    if (vindo?.valor) {
      setRecorte(vindo)
      navigate(location.pathname, {replace: true, state: null})
    }
  }, [location.state, location.pathname, navigate])

  const visiveis = useMemo(() => {
    const base = recorte ? rows.filter(r => r[recorte.campo] === recorte.valor) : rows
    return searchEmployees(base, query)
  }, [rows, recorte, query])

  return <>
    <Title title="Colaboradores" subtitle="Consulta de quadro, cargo, liderança, centro de custo e situação funcional."
      action={<Button icon="pi pi-download" label="Relatório Michiel" outlined severity="secondary" disabled={!visiveis.length}
        onClick={() => exportarRelatorioMichiel(visiveis)} tooltip="Nome, Cadastro, Cargo, C.C, superior, encarregado e alocação dos colaboradores listados" tooltipOptions={{position: 'bottom'}}/>}/>
    <Panel title="Relação do efetivo" kicker="CONSULTA">
      <div className="table-toolbar">
        <span className="search-wrap"><i className="pi pi-search"/><InputText value={query} placeholder="Buscar nome, matrícula ou cargo" onChange={e => setQuery(e.target.value)}/></span>
        {recorte && <button type="button" className="recorte-chip" onClick={() => setRecorte(null)} aria-label={`Remover recorte ${rotuloRecorte[recorte.campo]}: ${recorte.valor}`}>
          {rotuloRecorte[recorte.campo]}: <strong>{recorte.valor}</strong> <i className="pi pi-times"/>
        </button>}
        <Tag value={`${countFmt.format(visiveis.length)} registro(s)`} severity="secondary"/>
      </div>
      <DataTable className="employee-table" value={visiveis} paginator rows={15} rowsPerPageOptions={[15, 30, 50]} sortField="name" sortOrder={1}
        emptyMessage="Nenhum colaborador encontrado." stripedRows showGridlines={false} size="small" scrollable
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown">
        <Column field="id" header="Matrícula" sortable/>
        <Column field="name" header="Colaborador" sortable style={{minWidth: 210}}/>
        <Column field="role" header="Cargo" sortable style={{minWidth: 180}}/>
        <Column field="client" header="Cliente / alocação" sortable/>
        <Column field="supervisor" header="Supervisor" sortable/>
        <Column field="costCenter" header="C.C" sortable/>
        <Column field="module" header="Módulo" sortable/>
        <Column field="status" header="Situação" body={(r: Employee) => <Tag value={r.status || 'NÃO INFORMADO'} severity={statusSeverity(r.status)}/>} sortable/>
      </DataTable>
      <div className="mobile-records">
        {visiveis.slice(0, 80).map(r => <article className="person-card" key={r.id}>
          <div><strong>{r.name}</strong><Tag value={r.status || 'NÃO INFORMADO'} severity={statusSeverity(r.status)}/></div>
          <small>Matrícula {r.id} · {r.role}</small>
          <dl>
            <div><dt>Alocação</dt><dd>{r.client || '—'}</dd></div>
            <div><dt>Supervisor</dt><dd>{r.supervisor || '—'}</dd></div>
            <div><dt>Módulo / C.C</dt><dd>{r.module || '—'} / {r.costCenter || '—'}</dd></div>
          </dl>
        </article>)}
        {visiveis.length > 80 && <p className="hint">Exibindo 80 de {visiveis.length} registros. Refine a busca ou os filtros para localizar outros colaboradores.</p>}
      </div>
    </Panel>
  </>
}
