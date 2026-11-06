'use client'

// Cadastros → Acordos comerciais (05/11/2026).
// Preço negociado com fornecedor para operação/supervisores/período, com prioridade sobre a tabela
// PRECOS_MO (que não é alterada). O backend valida tudo, bloqueia sobreposição e é a autoridade
// sobre o preço aplicado; esta tela só cadastra, lista e inativa.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Dropdown } from 'primereact/dropdown'
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { MultiSelect } from 'primereact/multiselect'
import { Message } from 'primereact/message'
import { Modal } from '@/components/ui/Modal'
import { Badge, EmptyState, Panel, PanelHeader, Skeleton } from '@/components/ui/Primitives'
import { CatalogAction, CatalogSearch } from '@/features/catalogs/administrative/CatalogAdminPrimitives'
import { dateLabel, money } from '@/features/catalogs/administrative/catalogAdminPresentation'
import { fetchAcordosAdmin, inactivateAcordoAdmin, saveAcordoAdmin } from '@/features/catalogs/services/catalogService'
import type { AcordoComercialDto, AcordoSituacao, CatalogoAdminNomeDto, FornecedorAdminDto } from '@/types/catalog'

type Draft = {
  fornecedor: string
  operacoes: string[]
  todasOperacoes: boolean
  funcao: string
  turno: string
  tipoDia: string
  todosSupervisores: boolean
  supervisores: string[]
  vigenciaInicio: string
  vigenciaFim: string
  precoUnitario: number | null
  qtdReferenciaDia: number | null
  justificativa: string
  responsavelNegociacao: string
  referenciaDocumento: string
  formaAplicacao: 'AUTOMATICA' | 'INDICADA'
  nomePublico: string
}

const APPLY_OPTIONS = [
  { label: 'Automática — vale para toda solicitação que se encaixe', value: 'AUTOMATICA' },
  { label: 'Indicada — o solicitante indica e o Administrativo confirma', value: 'INDICADA' },
]

const emptyDraft = (): Draft => ({
  fornecedor: '', operacoes: [], todasOperacoes: false, funcao: 'TODAS', turno: 'TODOS', tipoDia: 'TODOS',
  todosSupervisores: false, supervisores: [], vigenciaInicio: '', vigenciaFim: '',
  precoUnitario: null, qtdReferenciaDia: null, justificativa: '', responsavelNegociacao: '', referenciaDocumento: '',
  formaAplicacao: 'INDICADA', nomePublico: '',
})

const SITUACAO: Record<AcordoSituacao, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }> = {
  VIGENTE: { label: 'Vigente', tone: 'success' },
  FUTURO: { label: 'Futuro', tone: 'warning' },
  ENCERRADO: { label: 'Encerrado', tone: 'neutral' },
  INATIVO: { label: 'Inativo', tone: 'danger' },
  PENDENTE: { label: 'Pendente de revisão', tone: 'warning' },
}

const SITUACAO_FILTER = [
  { label: 'Todas as situações', value: 'TODAS' },
  { label: 'Vigentes', value: 'VIGENTE' },
  { label: 'Futuros', value: 'FUTURO' },
  { label: 'Encerrados', value: 'ENCERRADO' },
  { label: 'Inativos', value: 'INATIVO' },
  { label: 'Pendentes de revisão', value: 'PENDENTE' },
]
const TURNO_OPTIONS = [{ label: 'Todos os turnos', value: 'TODOS' }, { label: 'Diurno', value: 'DIURNO' }, { label: 'Noturno', value: 'NOTURNO' }]
const TIPO_DIA_OPTIONS = [
  { label: 'Todos os dias', value: 'TODOS' },
  { label: 'Dia útil', value: 'UTIL' },
  { label: 'Sábado', value: 'SABADO' },
  { label: 'Domingo / feriado', value: 'DOMINGO_FERIADO' },
]
const ABRANGENCIA_OPTIONS = [{ label: 'Supervisores selecionados', value: false }, { label: 'Todos os supervisores', value: true }]

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="nx-catalog-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

const options = (items: Array<{ nome: string; ativo?: boolean }>, placeholder: string) => [
  { label: placeholder, value: '' },
  ...items.filter((item) => item.ativo !== false).map((item) => ({ label: item.nome, value: item.nome })),
]

function conditionLabel(item: AcordoComercialDto) {
  const parts = [item.funcao === 'TODAS' ? 'Todas as funções' : item.funcao]
  parts.push(item.turno === 'TODOS' ? 'todos os turnos' : item.turno.toLowerCase())
  parts.push(TIPO_DIA_OPTIONS.find((o) => o.value === item.tipoDia)?.label.toLowerCase() || item.tipoDia)
  return parts.join(' · ')
}

export function AgreementsPanel({
  providers,
  operations,
  supervisors,
  functions,
}: {
  providers: FornecedorAdminDto[]
  operations: CatalogoAdminNomeDto[]
  supervisors: CatalogoAdminNomeDto[]
  functions: CatalogoAdminNomeDto[]
}) {
  const [items, setItems] = useState<AcordoComercialDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [situacao, setSituacao] = useState('TODAS')
  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [inactivateTarget, setInactivateTarget] = useState<AcordoComercialDto | null>(null)
  const [inactivateReason, setInactivateReason] = useState('')
  const [details, setDetails] = useState<AcordoComercialDto | null>(null)

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      setItems(await fetchAcordosAdmin())
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar os acordos comerciais.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const visible = useMemo(() => {
    const query = search.trim().toUpperCase()
    return items
      .filter((item) => situacao === 'TODAS' || item.situacao === situacao)
      .filter((item) => !query || `${item.id} ${item.fornecedor} ${item.operacao} ${(item.operacoes || []).join(' ')} ${item.supervisores.join(' ')} ${item.funcao}`.toUpperCase().includes(query))
      .sort((a, b) => (b.vigenciaInicio || '').localeCompare(a.vigenciaInicio || ''))
  }, [items, search, situacao])

  const counts = useMemo(() => {
    const by = (s: AcordoSituacao) => items.filter((item) => item.situacao === s).length
    return { vigentes: by('VIGENTE'), futuros: by('FUTURO'), pendentes: by('PENDENTE') }
  }, [items])

  const laborProviders = providers.filter((item) => item.ativo && item.maoDeObra)

  function openNew() {
    setDraft(emptyDraft())
    setFormError('')
    setNotice('')
    setEditorOpen(true)
  }

  async function save() {
    setFormError('')
    if (!draft.fornecedor) return setFormError('Informe o fornecedor.')
    if (!draft.todasOperacoes && !draft.operacoes.length) return setFormError('Selecione ao menos uma operação ou escolha "Todas as operações".')
    if (!draft.todosSupervisores && !draft.supervisores.length) return setFormError('Selecione ao menos um supervisor ou escolha "Todos os supervisores".')
    if (!draft.vigenciaInicio || !draft.vigenciaFim) return setFormError('Informe a vigência inicial e final.')
    if (draft.vigenciaFim < draft.vigenciaInicio) return setFormError('A vigência final não pode ser anterior à inicial.')
    if (!draft.precoUnitario || draft.precoUnitario <= 0) return setFormError('Informe o preço unitário negociado.')
    if (!draft.justificativa.trim() || !draft.responsavelNegociacao.trim()) return setFormError('Informe a justificativa e o responsável pela negociação.')
    if (draft.formaAplicacao === 'INDICADA' && !draft.nomePublico.trim()) return setFormError('Informe o nome do acordo para o solicitante.')
    setSaving(true)
    try {
      const saved = await saveAcordoAdmin({
        ...draft,
        precoUnitario: Number(draft.precoUnitario),
        supervisores: draft.todosSupervisores ? [] : draft.supervisores,
        operacoes: draft.todasOperacoes ? [] : draft.operacoes,
        justificativa: draft.justificativa.trim(),
        responsavelNegociacao: draft.responsavelNegociacao.trim(),
        referenciaDocumento: draft.referenciaDocumento.trim(),
        nomePublico: draft.nomePublico.trim(),
      })
      setEditorOpen(false)
      setNotice(`Acordo ${saved.id} cadastrado: ${money(saved.precoUnitario)} por pessoa/dia de ${dateLabel(saved.vigenciaInicio)} a ${dateLabel(saved.vigenciaFim)}.`)
      await load()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível cadastrar o acordo.')
    } finally {
      setSaving(false)
    }
  }

  async function inactivate() {
    if (!inactivateTarget) return
    if (!inactivateReason.trim()) return setFormError('Informe o motivo da inativação.')
    setSaving(true)
    setFormError('')
    try {
      await inactivateAcordoAdmin(inactivateTarget.id, inactivateTarget.versao, inactivateReason.trim())
      setNotice(`Acordo ${inactivateTarget.id} inativado. Solicitações já precificadas não são alteradas.`)
      setInactivateTarget(null)
      await load()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível inativar o acordo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel className="catalog-provider-list nx-catalog-panel nx-agreements-panel">
      <PanelHeader
        eyebrow="PREÇOS NEGOCIADOS"
        title="Acordos comerciais"
        description="Preço negociado com o fornecedor para uma operação, supervisores e período. Tem prioridade sobre a tabela de preços, que não é alterada."
        trailing={<Button label="Novo acordo" icon="pi pi-plus" onClick={openNew} className="nx-primary-button" />}
      />
      {notice && <Message severity="success" text={notice} className="nx-catalog-message" />}
      {loadError && <Message severity="error" text={loadError} className="nx-catalog-message" />}

      <div className="nx-agreements-indicators">
        <span><strong>{counts.vigentes}</strong> vigente(s)</span>
        <span><strong>{counts.futuros}</strong> futuro(s)</span>
        {counts.pendentes > 0 && <span className="is-warning"><strong>{counts.pendentes}</strong> pendente(s) de revisão</span>}
      </div>

      <div className="nx-agreements-filters">
        <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar código, fornecedor, operação, supervisor…" label="Buscar acordos" />
        <Dropdown value={situacao} options={SITUACAO_FILTER} onChange={(event) => setSituacao(event.value || 'TODAS')} aria-label="Situação" />
      </div>

      {loading ? <Skeleton lines={6} /> : visible.length ? (
        <DataTable value={visible} responsiveLayout="scroll" rowHover stripedRows dataKey="id" className="nx-prime-table nx-catalog-table">
          <Column header="Código" body={(item: AcordoComercialDto) => <strong className="nx-nowrap">{item.id || '—'}</strong>} />
          <Column header="Fornecedor / operação" body={(item: AcordoComercialDto) => <span className="nx-agreement-main"><strong>{item.fornecedor || '—'}</strong><small>{item.operacao || '—'}</small></span>} />
          <Column header="Supervisores" body={(item: AcordoComercialDto) => item.situacao === 'PENDENTE' ? '—' : item.todosSupervisores ? 'Todos' : item.supervisores.join(', ')} />
          <Column header="Condições" body={(item: AcordoComercialDto) => <small>{item.situacao === 'PENDENTE' ? 'Registro incompleto da planilha: não é aplicado' : conditionLabel(item)}</small>} />
          <Column header="Vigência" body={(item: AcordoComercialDto) => item.vigenciaInicio ? `${dateLabel(item.vigenciaInicio)} → ${dateLabel(item.vigenciaFim)}` : '—'} />
          <Column header="Aplicação" body={(item: AcordoComercialDto) => item.situacao === 'PENDENTE' ? '—' : item.formaAplicacao === 'INDICADA' ? <span title={item.nomePublico}>Indicada<small className="nx-agreement-public-name">{item.nomePublico}</small></span> : 'Automática'} />
          <Column header="Preço" body={(item: AcordoComercialDto) => <strong className="nx-nowrap">{item.precoUnitario ? money(item.precoUnitario) : '—'}</strong>} />
          <Column header="Situação" body={(item: AcordoComercialDto) => <Badge tone={SITUACAO[item.situacao].tone}>{SITUACAO[item.situacao].label}</Badge>} />
          <Column header="Ação" body={(item: AcordoComercialDto) => (
            <span className="nx-agreement-actions">
              <CatalogAction label="Detalhes" icon="pi pi-eye" onClick={() => setDetails(item)} />
              {item.status === 'ATIVO' && item.situacao !== 'PENDENTE' && (
                <CatalogAction label="Inativar" icon="pi pi-ban" onClick={() => { setFormError(''); setInactivateReason(''); setInactivateTarget(item) }} />
              )}
            </span>
          )} />
        </DataTable>
      ) : <EmptyState title="Nenhum acordo encontrado" description="Cadastre um acordo para aplicar um preço negociado a uma operação e período." />}

      <Modal
        open={editorOpen}
        titleId="agreement-editor-title"
        eyebrow="NOVO ACORDO COMERCIAL"
        title="Cadastrar acordo"
        description="O preço vale para solicitações de mão de obra que atendam a todas as condições, na vigência informada. Acordos que se sobreponham são bloqueados."
        onClose={() => setEditorOpen(false)}
        busy={saving}
        width="medium"
        footer={<>
          <Button label="Cancelar" text disabled={saving} onClick={() => setEditorOpen(false)} />
          <Button label="Cadastrar acordo" icon="pi pi-check" loading={saving} onClick={() => void save()} className="nx-primary-button" />
        </>}
      >
        <div className="nx-catalog-form-stack">
          <div className="nx-catalog-form-grid">
            <Field label="Fornecedor *"><Dropdown value={draft.fornecedor} options={options(laborProviders, 'Selecione')} onChange={(e) => setDraft((d) => ({ ...d, fornecedor: e.value || '' }))} filter /></Field>
            <Field label="Abrangência de operações"><Dropdown value={draft.todasOperacoes} options={[{ label: 'Operações selecionadas', value: false }, { label: 'Todas as operações', value: true }]} onChange={(e) => setDraft((d) => ({ ...d, todasOperacoes: Boolean(e.value) }))} /></Field>
          </div>
          {!draft.todasOperacoes && (
            <Field label="Operações *">
              <MultiSelect value={draft.operacoes} options={options(operations, '').slice(1)} onChange={(e) => setDraft((d) => ({ ...d, operacoes: e.value || [] }))} filter display="chip" placeholder="Selecione as operações" />
            </Field>
          )}
          <div className="nx-catalog-form-grid">
            <Field label="Função"><Dropdown value={draft.funcao} options={[{ label: 'Todas as funções', value: 'TODAS' }, ...options(functions, '').slice(1)]} onChange={(e) => setDraft((d) => ({ ...d, funcao: e.value || 'TODAS' }))} filter /></Field>
            <Field label="Turno"><Dropdown value={draft.turno} options={TURNO_OPTIONS} onChange={(e) => setDraft((d) => ({ ...d, turno: e.value }))} /></Field>
          </div>
          <div className="nx-catalog-form-grid">
            <Field label="Tipo de dia" hint="Use “Todos os dias” para valor fixo em dia útil, sábado, domingo e feriado."><Dropdown value={draft.tipoDia} options={TIPO_DIA_OPTIONS} onChange={(e) => setDraft((d) => ({ ...d, tipoDia: e.value }))} /></Field>
            <Field label="Abrangência"><Dropdown value={draft.todosSupervisores} options={ABRANGENCIA_OPTIONS} onChange={(e) => setDraft((d) => ({ ...d, todosSupervisores: Boolean(e.value) }))} /></Field>
          </div>
          {!draft.todosSupervisores && (
            <Field label="Supervisores *">
              <MultiSelect value={draft.supervisores} options={options(supervisors, '').slice(1)} onChange={(e) => setDraft((d) => ({ ...d, supervisores: e.value || [] }))} filter display="chip" placeholder="Selecione os supervisores" />
            </Field>
          )}
          <Field label="Forma de aplicação *" hint={draft.formaAplicacao === 'INDICADA' ? 'Use quando, nas mesmas condições, há pedidos normais (tabela) e pedidos do acordo.' : 'Toda solicitação que se encaixar recebe o preço do acordo.'}>
            <Dropdown value={draft.formaAplicacao} options={APPLY_OPTIONS} onChange={(e) => setDraft((d) => ({ ...d, formaAplicacao: e.value }))} />
          </Field>
          {draft.formaAplicacao === 'INDICADA' && (
            <Field label="Nome para o solicitante *" hint="Aparece na tela de solicitação, sem o preço. Ex.: Fim de semana GoBeauty.">
              <InputText value={draft.nomePublico} onChange={(e) => setDraft((d) => ({ ...d, nomePublico: e.target.value.slice(0, 80) }))} />
            </Field>
          )}
          <div className="nx-catalog-form-grid">
            <Field label="Vigência inicial *"><InputText type="date" value={draft.vigenciaInicio} onChange={(e) => setDraft((d) => ({ ...d, vigenciaInicio: e.target.value }))} /></Field>
            <Field label="Vigência final *"><InputText type="date" value={draft.vigenciaFim} onChange={(e) => setDraft((d) => ({ ...d, vigenciaFim: e.target.value }))} /></Field>
          </div>
          <div className="nx-catalog-form-grid">
            <Field label="Preço por pessoa/dia *"><InputNumber value={draft.precoUnitario} onValueChange={(e) => setDraft((d) => ({ ...d, precoUnitario: e.value ?? null }))} mode="currency" currency="BRL" locale="pt-BR" minFractionDigits={2} maxFractionDigits={4} min={0} /></Field>
            <Field label="Pessoas por dia (referência)" hint="Informativo; não bloqueia lançamentos."><InputNumber value={draft.qtdReferenciaDia} onValueChange={(e) => setDraft((d) => ({ ...d, qtdReferenciaDia: e.value ?? null }))} min={0} useGrouping={false} /></Field>
          </div>
          <Field label="Justificativa *"><InputTextarea value={draft.justificativa} onChange={(e) => setDraft((d) => ({ ...d, justificativa: e.target.value }))} rows={2} autoResize /></Field>
          <div className="nx-catalog-form-grid">
            <Field label="Responsável pela negociação *"><InputText value={draft.responsavelNegociacao} onChange={(e) => setDraft((d) => ({ ...d, responsavelNegociacao: e.target.value }))} /></Field>
            <Field label="Referência documental"><InputText value={draft.referenciaDocumento} onChange={(e) => setDraft((d) => ({ ...d, referenciaDocumento: e.target.value }))} placeholder="Ex.: e-mail de 04/11, proposta nº…" /></Field>
          </div>
          {formError && <Message severity="error" text={formError} className="nx-catalog-message" />}
        </div>
      </Modal>

      <Modal
        open={Boolean(inactivateTarget)}
        titleId="agreement-inactivate-title"
        eyebrow="INATIVAR ACORDO"
        title={inactivateTarget ? `Inativar ${inactivateTarget.id}` : ''}
        description="Novas solicitações deixam de usar este preço. Solicitações já precificadas não são alteradas."
        onClose={() => setInactivateTarget(null)}
        busy={saving}
        width="medium"
        footer={<>
          <Button label="Voltar" text disabled={saving} onClick={() => setInactivateTarget(null)} />
          <Button label="Inativar acordo" icon="pi pi-ban" severity="danger" loading={saving} onClick={() => void inactivate()} />
        </>}
      >
        <div className="nx-catalog-form-stack">
          <Field label="Motivo da inativação *"><InputTextarea value={inactivateReason} onChange={(e) => setInactivateReason(e.target.value)} rows={3} autoResize /></Field>
          {formError && <Message severity="error" text={formError} className="nx-catalog-message" />}
        </div>
      </Modal>

      <Modal
        open={Boolean(details)}
        titleId="agreement-details-title"
        eyebrow="ACORDO COMERCIAL"
        title={details?.id || 'Acordo pendente de revisão'}
        description={details?.situacao === 'PENDENTE' ? 'Registro da planilha sem código ou incompleto: não é aplicado. Cadastre-o pelo botão “Novo acordo”.' : undefined}
        onClose={() => setDetails(null)}
        width="medium"
        footer={<Button label="Fechar" text onClick={() => setDetails(null)} />}
      >
        {details && (
          <dl className="nx-agreement-details">
            <dt>Fornecedor / operação</dt><dd>{details.fornecedor || '—'} · {details.operacao || '—'}</dd>
            <dt>Supervisores</dt><dd>{details.todosSupervisores ? 'Todos' : details.supervisores.join(', ') || '—'}</dd>
            <dt>Condições</dt><dd>{conditionLabel(details)}</dd>
            <dt>Vigência</dt><dd>{details.vigenciaInicio ? `${dateLabel(details.vigenciaInicio)} a ${dateLabel(details.vigenciaFim)}` : '—'}</dd>
            <dt>Aplicação</dt><dd>{details.formaAplicacao === 'INDICADA' ? `Indicada pelo solicitante — "${details.nomePublico}"` : 'Automática'}</dd>
            <dt>Preço por pessoa/dia</dt><dd>{details.precoUnitario ? money(details.precoUnitario) : '—'}{details.qtdReferenciaDia ? ` · referência ${details.qtdReferenciaDia} pessoa(s)/dia` : ''}</dd>
            <dt>Justificativa</dt><dd>{details.justificativa || '—'}</dd>
            <dt>Negociação</dt><dd>{details.responsavelNegociacao || '—'}{details.referenciaDocumento ? ` · ${details.referenciaDocumento}` : ''}</dd>
            <dt>Cadastro</dt><dd>{details.criadoPor || '—'}{details.atualizadoPor && details.atualizadoPor !== details.criadoPor ? ` · última alteração: ${details.atualizadoPor}` : ''}</dd>
            {details.motivoInativacao && <><dt>Motivo da inativação</dt><dd>{details.motivoInativacao}</dd></>}
          </dl>
        )}
      </Modal>
    </Panel>
  )
}
