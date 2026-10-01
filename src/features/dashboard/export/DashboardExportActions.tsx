import { useState } from 'react'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { fetchDashboardExport, type DashboardExportType } from '@/services/dashboardService'
import type { DashboardQuery } from '@/types/dashboard'

function csvCell(value: string | number) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCsv(fileName: string, columns: string[], rows: Array<Array<string | number>>) {
  const content = [columns, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function DashboardExportActions({ query }: { query: DashboardQuery }) {
  const [exporting, setExporting] = useState<DashboardExportType | null>(null)
  const [error, setError] = useState('')

  async function handleExport(type: DashboardExportType) {
    setExporting(type)
    setError('')
    try {
      const result = await fetchDashboardExport(query, type)
      downloadCsv(result.arquivo, result.colunas, result.linhas)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Não foi possível gerar a exportação.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="dashboard-export-actions nx-modern-actions">
      <Button
        type="button"
        label={exporting === 'MAO_DE_OBRA' ? 'Gerando MO…' : 'Exportar Mão de Obra'}
        icon={exporting === 'MAO_DE_OBRA' ? 'pi pi-spin pi-spinner' : 'pi pi-download'}
        outlined
        disabled={Boolean(exporting)}
        onClick={() => void handleExport('MAO_DE_OBRA')}
      />
      <Button
        type="button"
        label={exporting === 'ALIMENTACAO_BEBIDA' ? 'Gerando Lanches…' : 'Exportar Lanches'}
        icon={exporting === 'ALIMENTACAO_BEBIDA' ? 'pi pi-spin pi-spinner' : 'pi pi-download'}
        outlined
        disabled={Boolean(exporting)}
        onClick={() => void handleExport('ALIMENTACAO_BEBIDA')}
      />
      {error && <Message severity="error" text={error} className="dashboard-export-error" />}
    </div>
  )
}
