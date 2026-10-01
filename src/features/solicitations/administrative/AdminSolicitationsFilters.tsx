'use client'

import { Button } from 'primereact/button'
import { Dropdown } from 'primereact/dropdown'
import { PageToolbar, SearchField } from '@/components/ui/Primitives'

type Option = { label: string; value: string }

type Props = {
  search: string
  registrationYear: string
  registrationMonth: string
  registrationDate: string
  typeFilter: string
  statusFilter: string
  yearOptions: Option[]
  monthOptions: Option[]
  dateOptions: Option[]
  typeOptions: Option[]
  statusOptions: Option[]
  hasActiveFilters: boolean
  onSearchChange: (value: string) => void
  onYearChange: (value: string) => void
  onMonthChange: (value: string) => void
  onDateChange: (value: string) => void
  onTypeChange: (value: string) => void
  onStatusChange: (value: string) => void
  onClear: () => void
}

export function AdminSolicitationsFilters({
  search,
  registrationYear,
  registrationMonth,
  registrationDate,
  typeFilter,
  statusFilter,
  yearOptions,
  monthOptions,
  dateOptions,
  typeOptions,
  statusOptions,
  hasActiveFilters,
  onSearchChange,
  onYearChange,
  onMonthChange,
  onDateChange,
  onTypeChange,
  onStatusChange,
  onClear,
}: Props) {
  return (
    <PageToolbar
      embedded
      ariaLabel="Filtros das solicitações"
      search={<SearchField ariaLabel="Pesquisar solicitações" placeholder="Protocolo, operação, supervisor…" value={search} onChange={onSearchChange} />}
      filters={
        <div className="nx-prime-filter-row">
          <Dropdown value={registrationYear} options={yearOptions} onChange={(event) => onYearChange(event.value)} />
          <Dropdown value={registrationMonth} options={monthOptions} disabled={registrationYear === 'TODOS'} onChange={(event) => onMonthChange(event.value)} />
          <Dropdown value={registrationDate} options={dateOptions} disabled={registrationYear === 'TODOS' || registrationMonth === 'TODOS'} onChange={(event) => onDateChange(event.value)} />
          <Dropdown value={typeFilter} options={typeOptions} onChange={(event) => onTypeChange(event.value)} />
          <Dropdown value={statusFilter} options={statusOptions} onChange={(event) => onStatusChange(event.value)} />
          <Button label="Limpar filtros" icon="pi pi-filter-slash" outlined onClick={onClear} disabled={!hasActiveFilters} />
        </div>
      }
    />
  )
}
