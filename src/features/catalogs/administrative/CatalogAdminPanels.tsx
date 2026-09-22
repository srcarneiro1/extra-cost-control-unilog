'use client'

import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Badge, EmptyState, Panel, PanelHeader, Skeleton } from '@/components/ui/Primitives'
import { CatalogAction, CatalogSearch, PricePagination, StatusBadge } from '@/features/catalogs/administrative/CatalogAdminPrimitives'
import {
  categoryLabel,
  competenceLabel,
  dateLabel,
  dayTypeLabel,
  destinationLabel,
  money,
  priceStatus,
} from '@/features/catalogs/administrative/catalogAdminPresentation'
import type {
  CatalogAdminPaginationDto,
  CatalogoAdminNomeDto,
  FeriadoAdminDto,
  FornecedorAdminDto,
  MetaMaoObraAdminDto,
  PrecoMaoObraAdminDto,
  PrecoProdutoAdminDto,
  ProdutoAdminDto,
} from '@/types/catalog'

type SharedSearchProps = {
  loading: boolean
  search: string
  setSearch: (value: string) => void
}

export function NamedPanel({
  loading,
  singular,
  plural,
  description,
  items,
  search,
  setSearch,
  onEdit,
}: SharedSearchProps & {
  singular: string
  plural: string
  description: string
  items: CatalogoAdminNomeDto[]
  onEdit: (item: CatalogoAdminNomeDto) => void
}) {
  return (
    <Panel className="catalog-provider-list nx-catalog-panel">
      <PanelHeader eyebrow={plural.toUpperCase()} title={`Cadastro de ${plural.toLowerCase()}`} description={description} />
      <CatalogSearch value={search} onChange={setSearch} placeholder={`Buscar ${plural.toLowerCase()}…`} label={`Buscar ${plural.toLowerCase()}`} />
      {loading ? <Skeleton lines={7} /> : items.length ? (
        <DataTable value={items} dataKey="nome" responsiveLayout="scroll" rowHover stripedRows className="nx-prime-table nx-catalog-table">
          <Column field="nome" header={singular} sortable body={(item: CatalogoAdminNomeDto) => <strong>{item.nome}</strong>} />
          <Column header="Status" body={(item: CatalogoAdminNomeDto) => <StatusBadge active={item.ativo} />} style={{ width: '9rem' }} />
          <Column header="Ação" body={(item: CatalogoAdminNomeDto) => <CatalogAction label={item.ativo ? 'Editar' : 'Reativar'} icon={item.ativo ? 'pi pi-pencil' : 'pi pi-refresh'} onClick={() => onEdit(item)} />} style={{ width: '10rem' }} />
        </DataTable>
      ) : <EmptyState title="Nenhum cadastro encontrado" description="Ajuste a busca ou cadastre um novo item." />}
    </Panel>
  )
}

export function HolidayPanel({
  loading,
  items,
  search,
  setSearch,
  onEdit,
}: SharedSearchProps & { items: FeriadoAdminDto[]; onEdit: (item: FeriadoAdminDto) => void }) {
  return (
    <Panel className="catalog-provider-list nx-catalog-panel">
      <PanelHeader eyebrow="CALENDÁRIO" title="Feriados" description="Calendário usado na classificação de dias para precificação. Registros inativos permanecem preservados." />
      <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar data, feriado ou fonte…" label="Buscar feriados" />
      {loading ? <Skeleton lines={7} /> : items.length ? (
        <DataTable value={items} dataKey="data" responsiveLayout="scroll" rowHover stripedRows className="nx-prime-table nx-catalog-table">
          <Column field="data" header="Data" sortable body={(item: FeriadoAdminDto) => <strong>{dateLabel(item.data)}</strong>} />
          <Column field="denominacao" header="Denominação" sortable />
          <Column header="Município/UF" body={(item: FeriadoAdminDto) => `${item.municipio}/${item.uf}`} />
          <Column field="fonte" header="Fonte" body={(item: FeriadoAdminDto) => item.fonte || '—'} />
          <Column header="Status" body={(item: FeriadoAdminDto) => <StatusBadge active={item.ativo} />} />
          <Column header="Ação" body={(item: FeriadoAdminDto) => <CatalogAction label={item.ativo ? 'Editar' : 'Reativar'} icon={item.ativo ? 'pi pi-pencil' : 'pi pi-refresh'} onClick={() => onEdit(item)} />} />
        </DataTable>
      ) : <EmptyState title="Nenhum feriado cadastrado" description="Cadastre as datas que devem ser tratadas como feriado." />}
    </Panel>
  )
}

export function GoalPanel({
  loading,
  items,
  search,
  setSearch,
  onEdit,
}: SharedSearchProps & { items: MetaMaoObraAdminDto[]; onEdit: (item: MetaMaoObraAdminDto) => void }) {
  return (
    <Panel className="catalog-provider-list nx-catalog-panel">
      <PanelHeader eyebrow="PLANEJAMENTO" title="Metas de mão de obra" description="Meta global por competência usada pela Visão Geral. Editar uma competência atualiza o valor consumido pelo Dashboard." />
      <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar competência ou valor…" label="Buscar metas" />
      {loading ? <Skeleton lines={7} /> : items.length ? (
        <DataTable value={items} dataKey="competencia" responsiveLayout="scroll" rowHover stripedRows className="nx-prime-table nx-catalog-table">
          <Column field="competencia" header="Competência" sortable body={(item: MetaMaoObraAdminDto) => <strong>{competenceLabel(item.competencia)}</strong>} />
          <Column field="valor" header="Meta MO" sortable body={(item: MetaMaoObraAdminDto) => <strong>{money(item.valor)}</strong>} />
          <Column header="Ação" body={(item: MetaMaoObraAdminDto) => <CatalogAction label="Editar" onClick={() => onEdit(item)} />} style={{ width: '10rem' }} />
        </DataTable>
      ) : <EmptyState title="Nenhuma meta cadastrada" description="Cadastre a meta de mão de obra por competência." />}
    </Panel>
  )
}

export function ProviderPanel({
  loading,
  items,
  search,
  setSearch,
  onEdit,
}: SharedSearchProps & { items: FornecedorAdminDto[]; onEdit: (item: FornecedorAdminDto) => void }) {
  return (
    <Panel className="catalog-provider-list nx-catalog-panel">
      <PanelHeader eyebrow="FORNECEDORES" title="Fornecedores e contato" description="Inative registros em vez de excluir. Fornecedores inativos deixam de aparecer também nas tabelas de preço até serem reativados." />
      <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar fornecedor ou destino…" label="Buscar fornecedores" />
      {loading ? <Skeleton lines={7} /> : items.length ? (
        <DataTable value={items} dataKey="nome" responsiveLayout="scroll" rowHover stripedRows className="nx-prime-table nx-catalog-table">
          <Column field="nome" header="Fornecedor" sortable body={(item: FornecedorAdminDto) => <strong>{item.nome}</strong>} />
          <Column header="Atendimento" body={(item: FornecedorAdminDto) => <div className="nx-catalog-badges">{item.maoDeObra && <Badge>Mão de obra</Badge>}{item.alimentacao && <Badge>Alimentação</Badge>}</div>} />
          <Column header="WhatsApp" body={(item: FornecedorAdminDto) => destinationLabel(item)} />
          <Column header="Status" body={(item: FornecedorAdminDto) => <StatusBadge active={item.ativo} />} />
          <Column header="Ação" body={(item: FornecedorAdminDto) => <CatalogAction label={item.ativo ? 'Editar' : 'Reativar'} icon={item.ativo ? 'pi pi-pencil' : 'pi pi-refresh'} onClick={() => onEdit(item)} />} />
        </DataTable>
      ) : <EmptyState title="Nenhum fornecedor encontrado" description="Ajuste a busca ou cadastre um novo fornecedor." />}
    </Panel>
  )
}

export function ProductPanel({
  loading,
  items,
  search,
  setSearch,
  onEdit,
}: SharedSearchProps & { items: ProdutoAdminDto[]; onEdit: (item: ProdutoAdminDto) => void }) {
  return (
    <Panel className="catalog-provider-list nx-catalog-panel">
      <PanelHeader eyebrow="CATÁLOGO" title="Produtos" description="Produtos vinculados a fornecedores de alimentação ativos. Reativar produto não altera histórico de preços." />
      <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar produto ou categoria…" label="Buscar produtos" />
      {loading ? <Skeleton lines={7} /> : items.length ? (
        <DataTable value={items} dataKey="nome" responsiveLayout="scroll" rowHover stripedRows className="nx-prime-table nx-catalog-table">
          <Column field="nome" header="Produto" sortable body={(item: ProdutoAdminDto) => <strong>{item.nome}</strong>} />
          <Column field="categoria" header="Categoria" sortable body={(item: ProdutoAdminDto) => categoryLabel(item.categoria)} />
          <Column header="Status" body={(item: ProdutoAdminDto) => <StatusBadge active={item.ativo} />} />
          <Column header="Ação" body={(item: ProdutoAdminDto) => <CatalogAction label={item.ativo ? 'Editar' : 'Reativar'} icon={item.ativo ? 'pi pi-pencil' : 'pi pi-refresh'} onClick={() => onEdit(item)} />} />
        </DataTable>
      ) : <EmptyState title="Nenhum produto encontrado" description="Ajuste a busca ou cadastre um novo produto." />}
    </Panel>
  )
}

export function LaborPricePanel({
  loading,
  items,
  search,
  setSearch,
  onVersion,
  pagination,
  onPage,
}: SharedSearchProps & {
  items: PrecoMaoObraAdminDto[]
  onVersion: (item: PrecoMaoObraAdminDto, reactivate?: boolean) => void
  pagination: CatalogAdminPaginationDto | null
  onPage: (page: number) => void
}) {
  return (
    <Panel className="catalog-provider-list nx-catalog-panel">
      <PanelHeader eyebrow="TABELA VERSIONADA" title="Preços de mão de obra" description="Somente preços de fornecedores ativos e habilitados para mão de obra são exibidos. O histórico reaparece automaticamente se o fornecedor for reativado." />
      <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar fornecedor, função, turno…" label="Buscar preços de mão de obra" />
      {loading ? <Skeleton lines={7} /> : items.length ? (
        <>
          <DataTable value={items} responsiveLayout="scroll" rowHover stripedRows className="nx-prime-table nx-catalog-table nx-catalog-price-table">
            <Column field="fornecedor" header="Fornecedor" sortable body={(item: PrecoMaoObraAdminDto) => <strong>{item.fornecedor}</strong>} />
            <Column field="funcao" header="Função" sortable />
            <Column field="turno" header="Turno" sortable />
            <Column field="tipoDia" header="Tipo de dia" body={(item: PrecoMaoObraAdminDto) => dayTypeLabel(item.tipoDia)} />
            <Column header="Vigência" body={(item: PrecoMaoObraAdminDto) => `${dateLabel(item.vigenciaInicio)} → ${dateLabel(item.vigenciaFim)}`} />
            <Column field="precoUnitario" header="Preço" sortable body={(item: PrecoMaoObraAdminDto) => <strong>{money(item.precoUnitario)}</strong>} />
            <Column header="Status" body={(item: PrecoMaoObraAdminDto) => { const status = priceStatus(item); return <Badge tone={status.tone}>{status.label}</Badge> }} />
            <Column header="Ação" body={(item: PrecoMaoObraAdminDto) => item.ativo && !item.vigenciaFim ? <CatalogAction label="Nova vigência" icon="pi pi-plus" onClick={() => onVersion(item)} /> : !item.ativo ? <CatalogAction label="Reativar" icon="pi pi-refresh" onClick={() => onVersion(item, true)} /> : null} />
          </DataTable>
          <PricePagination pagination={pagination} onPage={onPage} />
        </>
      ) : <EmptyState title="Nenhum preço de mão de obra encontrado" description="Não há preços visíveis para fornecedores ativos no filtro atual." />}
    </Panel>
  )
}

export function ProductPricePanel({
  loading,
  items,
  search,
  setSearch,
  onVersion,
  pagination,
  onPage,
}: SharedSearchProps & {
  items: PrecoProdutoAdminDto[]
  onVersion: (item: PrecoProdutoAdminDto, reactivate?: boolean) => void
  pagination: CatalogAdminPaginationDto | null
  onPage: (page: number) => void
}) {
  return (
    <Panel className="catalog-provider-list nx-catalog-panel">
      <PanelHeader eyebrow="TABELA VERSIONADA" title="Preços de produtos" description="Somente preços de fornecedores ativos e habilitados para alimentação são exibidos. O histórico reaparece automaticamente se o fornecedor for reativado." />
      <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar fornecedor, produto, categoria…" label="Buscar preços de produtos" />
      {loading ? <Skeleton lines={7} /> : items.length ? (
        <>
          <DataTable value={items} responsiveLayout="scroll" rowHover stripedRows className="nx-prime-table nx-catalog-table nx-catalog-price-table">
            <Column field="fornecedor" header="Fornecedor" sortable body={(item: PrecoProdutoAdminDto) => <strong>{item.fornecedor}</strong>} />
            <Column field="produto" header="Produto" sortable />
            <Column field="categoria" header="Categoria" body={(item: PrecoProdutoAdminDto) => categoryLabel(item.categoria)} />
            <Column header="Vigência" body={(item: PrecoProdutoAdminDto) => `${dateLabel(item.vigenciaInicio)} → ${dateLabel(item.vigenciaFim)}`} />
            <Column field="precoUnitario" header="Preço" sortable body={(item: PrecoProdutoAdminDto) => <strong>{money(item.precoUnitario)}</strong>} />
            <Column header="Status" body={(item: PrecoProdutoAdminDto) => { const status = priceStatus(item); return <Badge tone={status.tone}>{status.label}</Badge> }} />
            <Column header="Ação" body={(item: PrecoProdutoAdminDto) => item.ativo && !item.vigenciaFim ? <CatalogAction label="Nova vigência" icon="pi pi-plus" onClick={() => onVersion(item)} /> : !item.ativo ? <CatalogAction label="Reativar" icon="pi pi-refresh" onClick={() => onVersion(item, true)} /> : null} />
          </DataTable>
          <PricePagination pagination={pagination} onPage={onPage} />
        </>
      ) : <EmptyState title="Nenhum preço de produto encontrado" description="Não há preços visíveis para fornecedores ativos no filtro atual." />}
    </Panel>
  )
}
