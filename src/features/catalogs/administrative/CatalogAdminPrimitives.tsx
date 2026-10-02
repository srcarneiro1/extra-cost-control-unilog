'use client'

import { Button } from 'primereact/button'
import { Paginator } from 'primereact/paginator'
import { Badge, SearchField } from '@/components/ui/Primitives'
import type { CatalogAdminPaginationDto } from '@/types/catalog'

export function StatusBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Ativo' : 'Inativo'}</Badge>
}

export function CatalogAction({
  label,
  icon = 'pi pi-pencil',
  onClick,
}: {
  label: string
  icon?: string
  onClick: () => void
}) {
  return <Button label={label} icon={icon} size="small" outlined onClick={onClick} className="nx-catalog-action" />
}

export function CatalogSearch({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
}) {
  return <div className="nx-catalog-toolbar"><SearchField value={value} onChange={onChange} placeholder={placeholder} ariaLabel={label} /></div>
}

export function PricePagination({
  pagination,
  onPage,
}: {
  pagination: CatalogAdminPaginationDto | null
  onPage: (page: number) => void
}) {
  if (!pagination?.paginado) return null

  return (
    <Paginator
      first={(pagination.pagina - 1) * pagination.tamanhoPagina}
      rows={pagination.tamanhoPagina}
      totalRecords={pagination.total}
      onPageChange={(event) => onPage(event.page + 1)}
      pageLinkSize={5}
      template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport"
      currentPageReportTemplate="Mostrando {first}–{last} de {totalRecords}"
      className="nx-catalog-paginator"
    />
  )
}
