'use client'

// Cadastros → Centros de custo (05/11/2026): responsáveis pelo custo (com "exige centro de custo")
// e centros de custo com vínculo aos supervisores. Lidos na hora pela tela aberta de solicitação.
import { useEffect, useState, type ReactNode } from 'react'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { Message } from 'primereact/message'
import { MultiSelect } from 'primereact/multiselect'
import { Modal } from '@/components/ui/Modal'
import { Badge, EmptyState, Panel, PanelHeader, Skeleton } from '@/components/ui/Primitives'
import { CatalogAction } from '@/features/catalogs/administrative/CatalogAdminPrimitives'
import { fetchCustosAdmin, saveCentroCustoAdmin, saveResponsavelCustoAdmin } from '@/features/catalogs/services/catalogService'
import type { CatalogoAdminNomeDto, CentroCustoDto, ResponsavelCustoDto } from '@/types/catalog'

const YES_NO = [{ label: 'Sim', value: true }, { label: 'Não', value: false }]
const ACTIVE = [{ label: 'Ativo', value: true }, { label: 'Inativo', value: false }]

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="nx-catalog-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

type CenterDraft = { codigo: string; descricao: string; ativo: boolean; supervisores: string[]; novo: boolean }
type ResponsibleDraft = { nome: string; exigeCentroCusto: boolean; ativo: boolean; novo: boolean }

export function CostCentersPanel({ supervisors }: { supervisors: CatalogoAdminNomeDto[] }) {
  const [data, setData] = useState<{ responsaveis: ResponsavelCustoDto[]; responsaveisPadrao: boolean; centros: CentroCustoDto[] } | null>(null)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [center, setCenter] = useState<CenterDraft | null>(null)
  const [responsible, setResponsible] = useState<ResponsibleDraft | null>(null)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoadError('')
    try {
      setData(await fetchCustosAdmin())
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar os centros de custo.')
    }
  }

  useEffect(() => { void load() }, [])

  const supervisorOptions = supervisors.filter((s) => s.ativo !== false).map((s) => ({ label: s.nome, value: s.nome.toUpperCase() }))

  async function saveCenter() {
    if (!center) return
    setFormError('')
    if (!/^\d{1,8}$/.test(center.codigo)) return setFormError('Informe o código do centro de custo (somente números).')
    setSaving(true)
    try {
      await saveCentroCustoAdmin({ codigo: center.codigo, descricao: center.descricao.trim(), ativo: center.ativo, supervisores: center.supervisores })
      setNotice(`Centro de custo ${center.codigo} salvo.`)
      setCenter(null)
      await load()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function saveResponsible() {
    if (!responsible) return
    setFormError('')
    if (!responsible.nome.trim()) return setFormError('Informe o nome do responsável pelo custo.')
    setSaving(true)
    try {
      await saveResponsavelCustoAdmin({ nome: responsible.nome.trim(), exigeCentroCusto: responsible.exigeCentroCusto, ativo: responsible.ativo })
      setNotice(`Responsável ${responsible.nome.trim().toUpperCase()} salvo.`)
      setResponsible(null)
      await load()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="nx-costs-stack">
      {notice && <Message severity="success" text={notice} className="nx-catalog-message" />}
      {loadError && <Message severity="error" text={loadError} className="nx-catalog-message" />}

      <Panel className="nx-catalog-panel">
        <PanelHeader
          eyebrow="SOLICITAÇÕES"
          title="Responsáveis pelo custo"
          description="Opções de “quem assume o custo” na solicitação. Os que exigem centro de custo pedem o centro ao solicitante."
          trailing={<Button label="Novo responsável" icon="pi pi-plus" className="nx-primary-button" onClick={() => { setFormError(''); setResponsible({ nome: '', exigeCentroCusto: true, ativo: true, novo: true }) }} />}
        />
        {data?.responsaveisPadrao && <Message severity="info" text="Valendo os responsáveis padrão. Ao salvar o primeiro ajuste, eles são gravados no cadastro." className="nx-catalog-message" />}
        {!data ? <Skeleton lines={4} /> : (
          <DataTable value={data.responsaveis} dataKey="nome" className="nx-prime-table nx-catalog-table" rowHover stripedRows>
            <Column header="Responsável" body={(r: ResponsavelCustoDto) => <strong>{r.nome}</strong>} />
            <Column header="Exige centro de custo" body={(r: ResponsavelCustoDto) => (r.exigeCentroCusto ? 'Sim' : 'Não')} />
            <Column header="Situação" body={(r: ResponsavelCustoDto) => <Badge tone={r.ativo ? 'success' : 'neutral'}>{r.ativo ? 'Ativo' : 'Inativo'}</Badge>} />
            <Column header="Ação" body={(r: ResponsavelCustoDto) => <CatalogAction label="Editar" icon="pi pi-pencil" onClick={() => { setFormError(''); setResponsible({ ...r, novo: false }) }} />} />
          </DataTable>
        )}
      </Panel>

      <Panel className="nx-catalog-panel">
        <PanelHeader
          eyebrow="SOLICITAÇÕES"
          title="Centros de custo"
          description="Centros oferecidos na solicitação. Os vinculados a um supervisor aparecem primeiro quando ele é escolhido."
          trailing={<Button label="Novo centro de custo" icon="pi pi-plus" className="nx-primary-button" onClick={() => { setFormError(''); setCenter({ codigo: '', descricao: '', ativo: true, supervisores: [], novo: true }) }} />}
        />
        {!data ? <Skeleton lines={5} /> : data.centros.length ? (
          <DataTable value={data.centros} dataKey="codigo" className="nx-prime-table nx-catalog-table" rowHover stripedRows>
            <Column header="Código" body={(c: CentroCustoDto) => <strong>{c.codigo}</strong>} />
            <Column header="Descrição" body={(c: CentroCustoDto) => c.descricao || '—'} />
            <Column header="Supervisores vinculados" body={(c: CentroCustoDto) => (c.supervisores.length ? c.supervisores.join(', ') : '—')} />
            <Column header="Situação" body={(c: CentroCustoDto) => <Badge tone={c.ativo ? 'success' : 'neutral'}>{c.ativo ? 'Ativo' : 'Inativo'}</Badge>} />
            <Column header="Ação" body={(c: CentroCustoDto) => <CatalogAction label="Editar" icon="pi pi-pencil" onClick={() => { setFormError(''); setCenter({ ...c, novo: false }) }} />} />
          </DataTable>
        ) : <EmptyState title="Nenhum centro de custo cadastrado" description="Enquanto não houver cadastro, a solicitação aceita qualquer código numérico." />}
      </Panel>

      <Modal
        open={Boolean(center)}
        titleId="cost-center-title"
        eyebrow="CENTRO DE CUSTO"
        title={center?.novo ? 'Novo centro de custo' : `Editar centro ${center?.codigo}`}
        onClose={() => setCenter(null)}
        busy={saving}
        width="medium"
        footer={<>
          <Button label="Cancelar" text disabled={saving} onClick={() => setCenter(null)} />
          <Button label="Salvar" icon="pi pi-check" loading={saving} onClick={() => void saveCenter()} className="nx-primary-button" />
        </>}
      >
        {center && (
          <div className="nx-catalog-form-stack">
            <div className="nx-catalog-form-grid">
              <Field label="Código *"><InputText value={center.codigo} onChange={(e) => setCenter({ ...center, codigo: e.target.value.replace(/\D/g, '').slice(0, 8) })} inputMode="numeric" disabled={!center.novo} /></Field>
              <Field label="Situação"><Dropdown value={center.ativo} options={ACTIVE} onChange={(e) => setCenter({ ...center, ativo: Boolean(e.value) })} /></Field>
            </div>
            <Field label="Descrição"><InputText value={center.descricao} onChange={(e) => setCenter({ ...center, descricao: e.target.value })} placeholder="Ex.: TI, Operação Serra…" /></Field>
            <Field label="Supervisores vinculados" hint="Opcional. Ao escolher um desses supervisores na solicitação, este centro aparece primeiro.">
              <MultiSelect value={center.supervisores} options={supervisorOptions} onChange={(e) => setCenter({ ...center, supervisores: e.value || [] })} filter display="chip" placeholder="Nenhum" />
            </Field>
            {formError && <Message severity="error" text={formError} className="nx-catalog-message" />}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(responsible)}
        titleId="cost-responsible-title"
        eyebrow="RESPONSÁVEL PELO CUSTO"
        title={responsible?.novo ? 'Novo responsável' : `Editar ${responsible?.nome}`}
        onClose={() => setResponsible(null)}
        busy={saving}
        width="medium"
        footer={<>
          <Button label="Cancelar" text disabled={saving} onClick={() => setResponsible(null)} />
          <Button label="Salvar" icon="pi pi-check" loading={saving} onClick={() => void saveResponsible()} className="nx-primary-button" />
        </>}
      >
        {responsible && (
          <div className="nx-catalog-form-stack">
            <Field label="Nome *"><InputText value={responsible.nome} onChange={(e) => setResponsible({ ...responsible, nome: e.target.value.toUpperCase() })} disabled={!responsible.novo} /></Field>
            <div className="nx-catalog-form-grid">
              <Field label="Exige centro de custo"><Dropdown value={responsible.exigeCentroCusto} options={YES_NO} onChange={(e) => setResponsible({ ...responsible, exigeCentroCusto: Boolean(e.value) })} /></Field>
              <Field label="Situação"><Dropdown value={responsible.ativo} options={ACTIVE} onChange={(e) => setResponsible({ ...responsible, ativo: Boolean(e.value) })} /></Field>
            </div>
            {formError && <Message severity="error" text={formError} className="nx-catalog-message" />}
          </div>
        )}
      </Modal>
    </div>
  )
}
