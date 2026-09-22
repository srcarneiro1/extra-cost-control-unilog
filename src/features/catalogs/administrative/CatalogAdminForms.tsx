'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Checkbox } from 'primereact/checkbox'
import { Dropdown } from 'primereact/dropdown'
import { InputSwitch } from 'primereact/inputswitch'
import { InputText } from 'primereact/inputtext'
import {
  CATEGORY_OPTIONS,
  DAY_TYPE_OPTIONS,
  TURN_OPTIONS,
  WHATSAPP_OPTIONS,
  type GoalDraft,
  type HolidayDraft,
  type LaborPriceDraft,
  type NamedDraft,
  type ProductDraft,
  type ProductPriceDraft,
  type ProviderDraft,
} from '@/features/catalogs/administrative/catalogAdminModel'
import { categoryLabel, namedOptions } from '@/features/catalogs/administrative/catalogAdminPresentation'
import type { CatalogoAdminNomeDto, FornecedorAdminDto, TipoDia, WhatsappDestino } from '@/types/catalog'

function CatalogField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="nx-catalog-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

function ActiveField({ active, onChange }: { active: boolean; onChange: (active: boolean) => void }) {
  return (
    <label className="nx-catalog-field nx-catalog-switch-field">
      <span>Status</span>
      <div className="nx-catalog-switch-row">
        <InputSwitch checked={active} onChange={(event) => onChange(Boolean(event.value))} />
        <strong>{active ? 'Ativo' : 'Inativo'}</strong>
      </div>
    </label>
  )
}

export function NamedForm({ label, draft, setDraft, editingExisting }: { label: string; draft: NamedDraft; setDraft: Dispatch<SetStateAction<NamedDraft>>; editingExisting: boolean }) {
  return (
    <div className="nx-catalog-form-grid">
      <CatalogField label={label}>
        <InputText value={draft.nome} disabled={editingExisting} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))} />
      </CatalogField>
      <ActiveField active={draft.ativo} onChange={(ativo) => setDraft((current) => ({ ...current, ativo }))} />
    </div>
  )
}

export function HolidayForm({ draft, setDraft, editingExisting }: { draft: HolidayDraft; setDraft: Dispatch<SetStateAction<HolidayDraft>>; editingExisting: boolean }) {
  return (
    <div className="nx-catalog-form-stack">
      <div className="nx-catalog-form-grid">
        <CatalogField label="Data"><InputText type="date" value={draft.data} disabled={editingExisting} onChange={(event) => setDraft((current) => ({ ...current, data: event.target.value }))} /></CatalogField>
        <ActiveField active={draft.ativo} onChange={(ativo) => setDraft((current) => ({ ...current, ativo }))} />
      </div>
      <CatalogField label="Denominação"><InputText value={draft.denominacao} onChange={(event) => setDraft((current) => ({ ...current, denominacao: event.target.value }))} placeholder="Ex.: Independência do Brasil" /></CatalogField>
      <div className="nx-catalog-form-grid">
        <CatalogField label="Município"><InputText value={draft.municipio} onChange={(event) => setDraft((current) => ({ ...current, municipio: event.target.value }))} /></CatalogField>
        <CatalogField label="UF"><InputText value={draft.uf} maxLength={2} onChange={(event) => setDraft((current) => ({ ...current, uf: event.target.value.toUpperCase() }))} /></CatalogField>
      </div>
      <CatalogField label="Fonte"><InputText value={draft.fonte} onChange={(event) => setDraft((current) => ({ ...current, fonte: event.target.value }))} placeholder="Decreto, lei ou fonte oficial" /></CatalogField>
    </div>
  )
}

export function GoalForm({ draft, setDraft, editingExisting }: { draft: GoalDraft; setDraft: Dispatch<SetStateAction<GoalDraft>>; editingExisting: boolean }) {
  return (
    <div className="nx-catalog-form-grid">
      <CatalogField label="Competência"><InputText type="month" value={draft.competencia} disabled={editingExisting} onChange={(event) => setDraft((current) => ({ ...current, competencia: event.target.value }))} /></CatalogField>
      <CatalogField label="Meta de mão de obra"><InputText type="number" min="0.01" step="0.01" inputMode="decimal" value={draft.valor} onChange={(event) => setDraft((current) => ({ ...current, valor: event.target.value }))} placeholder="0,00" /></CatalogField>
    </div>
  )
}

export function ProviderForm({ draft, setDraft, editingExisting }: { draft: ProviderDraft; setDraft: Dispatch<SetStateAction<ProviderDraft>>; editingExisting: boolean }) {
  return (
    <div className="nx-catalog-form-stack">
      <div className="nx-catalog-form-grid">
        <CatalogField label="Fornecedor"><InputText value={draft.nome} disabled={editingExisting} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))} /></CatalogField>
        <ActiveField active={draft.ativo} onChange={(ativo) => setDraft((current) => ({ ...current, ativo }))} />
      </div>
      <div className="nx-catalog-checkbox-grid">
        <label className="nx-catalog-check">
          <Checkbox inputId="provider-labor" checked={draft.maoDeObra} onChange={(event) => setDraft((current) => ({ ...current, maoDeObra: Boolean(event.checked) }))} />
          <span>Atende mão de obra</span>
        </label>
        <label className="nx-catalog-check">
          <Checkbox inputId="provider-food" checked={draft.alimentacao} onChange={(event) => setDraft((current) => ({ ...current, alimentacao: Boolean(event.checked) }))} />
          <span>Atende alimentação</span>
        </label>
      </div>
      <div className="nx-catalog-form-grid">
        <CatalogField label="Destino WhatsApp">
          <Dropdown value={draft.whatsappDestino} options={WHATSAPP_OPTIONS} onChange={(event) => setDraft((current) => ({ ...current, whatsappDestino: event.value as WhatsappDestino }))} />
        </CatalogField>
        {draft.whatsappDestino === 'NUMERO' && <CatalogField label="Número"><InputText value={draft.whatsappNumero} onChange={(event) => setDraft((current) => ({ ...current, whatsappNumero: event.target.value }))} placeholder="5527999999999" /></CatalogField>}
        {draft.whatsappDestino === 'GRUPO' && <CatalogField label="Link do grupo"><InputText value={draft.whatsappGrupoLink} onChange={(event) => setDraft((current) => ({ ...current, whatsappGrupoLink: event.target.value }))} placeholder="https://chat.whatsapp.com/..." /></CatalogField>}
      </div>
    </div>
  )
}

export function ProductForm({ draft, setDraft, editingExisting }: { draft: ProductDraft; setDraft: Dispatch<SetStateAction<ProductDraft>>; editingExisting: boolean }) {
  return (
    <div className="nx-catalog-form-grid">
      <CatalogField label="Produto"><InputText value={draft.nome} disabled={editingExisting} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))} /></CatalogField>
      <CatalogField label="Categoria"><Dropdown value={draft.categoria} options={CATEGORY_OPTIONS} onChange={(event) => setDraft((current) => ({ ...current, categoria: event.value }))} /></CatalogField>
      <ActiveField active={draft.ativo} onChange={(ativo) => setDraft((current) => ({ ...current, ativo }))} />
    </div>
  )
}

export function LaborPriceForm({ draft, setDraft, functions, providers }: { draft: LaborPriceDraft; setDraft: Dispatch<SetStateAction<LaborPriceDraft>>; functions: CatalogoAdminNomeDto[]; providers: FornecedorAdminDto[] }) {
  return (
    <div className="nx-catalog-form-stack">
      <div className="nx-catalog-form-grid">
        <CatalogField label="Fornecedor"><Dropdown value={draft.fornecedor} options={namedOptions(providers)} onChange={(event) => setDraft((current) => ({ ...current, fornecedor: event.value || '' }))} filter /></CatalogField>
        <CatalogField label="Função"><Dropdown value={draft.funcao} options={namedOptions(functions)} onChange={(event) => setDraft((current) => ({ ...current, funcao: event.value || '' }))} filter /></CatalogField>
      </div>
      <div className="nx-catalog-form-grid">
        <CatalogField label="Turno"><Dropdown value={draft.turno} options={TURN_OPTIONS} onChange={(event) => setDraft((current) => ({ ...current, turno: event.value as 'DIURNO' | 'NOTURNO' }))} /></CatalogField>
        <CatalogField label="Tipo de dia"><Dropdown value={draft.tipoDia} options={DAY_TYPE_OPTIONS} onChange={(event) => setDraft((current) => ({ ...current, tipoDia: event.value as TipoDia }))} /></CatalogField>
      </div>
      <div className="nx-catalog-form-grid">
        <CatalogField label="Início da vigência"><InputText type="date" value={draft.vigenciaInicio} onChange={(event) => setDraft((current) => ({ ...current, vigenciaInicio: event.target.value }))} /></CatalogField>
        <CatalogField label="Preço unitário"><InputText type="number" min="0.01" step="0.01" inputMode="decimal" value={draft.precoUnitario} onChange={(event) => setDraft((current) => ({ ...current, precoUnitario: event.target.value }))} placeholder="0,00" /></CatalogField>
      </div>
    </div>
  )
}

export function ProductPriceForm({ draft, setDraft, products, providers }: { draft: ProductPriceDraft; setDraft: Dispatch<SetStateAction<ProductPriceDraft>>; products: { nome: string; categoria: 'ALIMENTACAO' | 'BEBIDA'; ativo: boolean }[]; providers: FornecedorAdminDto[] }) {
  const productOptions = [{ label: 'Selecione', value: '' }, ...products.filter((item) => item.ativo).map((item) => ({ label: `${item.nome} · ${categoryLabel(item.categoria)}`, value: item.nome }))]

  return (
    <div className="nx-catalog-form-stack">
      <div className="nx-catalog-form-grid">
        <CatalogField label="Fornecedor"><Dropdown value={draft.fornecedor} options={namedOptions(providers)} onChange={(event) => setDraft((current) => ({ ...current, fornecedor: event.value || '' }))} filter /></CatalogField>
        <CatalogField label="Produto"><Dropdown value={draft.produto} options={productOptions} onChange={(event) => setDraft((current) => ({ ...current, produto: event.value || '' }))} filter /></CatalogField>
      </div>
      <div className="nx-catalog-form-grid">
        <CatalogField label="Início da vigência"><InputText type="date" value={draft.vigenciaInicio} onChange={(event) => setDraft((current) => ({ ...current, vigenciaInicio: event.target.value }))} /></CatalogField>
        <CatalogField label="Preço unitário"><InputText type="number" min="0.01" step="0.01" inputMode="decimal" value={draft.precoUnitario} onChange={(event) => setDraft((current) => ({ ...current, precoUnitario: event.target.value }))} placeholder="0,00" /></CatalogField>
      </div>
    </div>
  )
}
