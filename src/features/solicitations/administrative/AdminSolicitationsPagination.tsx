'use client'

import { Paginator } from 'primereact/paginator'

type Props = {
  loading: boolean
  total: number
  currentPage: number
  pageSize: number
  pageSizeOptions: number[]
  onPageChange: (page: number, pageSize: number) => void
}

export function AdminSolicitationsPagination({
  loading,
  total,
  currentPage,
  pageSize,
  pageSizeOptions,
  onPageChange,
}: Props) {
  if (loading || total <= 0) return null

  const hasMultiplePages = total > pageSize
  const hasPageSizeChoice = pageSizeOptions.length > 1
  const template = [
    ...(hasMultiplePages ? ['FirstPageLink', 'PrevPageLink', 'PageLinks', 'NextPageLink', 'LastPageLink'] : []),
    'CurrentPageReport',
    ...(hasPageSizeChoice ? ['RowsPerPageDropdown'] : []),
  ].join(' ')

  return (
    <Paginator
      first={(currentPage - 1) * pageSize}
      rows={pageSize}
      totalRecords={total}
      rowsPerPageOptions={pageSizeOptions}
      onPageChange={(event) => onPageChange(event.page + 1, event.rows)}
      pageLinkSize={5}
      template={template}
      currentPageReportTemplate="Mostrando {first}–{last} de {totalRecords}"
      className="nx-prime-paginator"
    />
  )
}
