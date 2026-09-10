import { useState } from 'react'
import { fetchDashboardExport, type DashboardExportType } from '../services/dashboardService'
import type { DashboardQuery } from '../types/dashboard'

function csvCell(value: string | number) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCsv(fileName: string, columns: string[], rows: Array<Array<string | number>>) {
  const content = [columns, ...rows]
    .map((row) => row.map(csvCell).join(';'))
    .join('\r\n')
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
    <div
      className="dashboard-export-actions"
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}
    >
      <button type="button" className="button" disabled={Boolean(exporting)} onClick={() => handleExport('MAO_DE_OBRA')}>
        {exporting === 'MAO_DE_OBRA' ? 'Gerando MO…' : 'Exportar Mão de Obra'}
      </button>
      <button type="button" className="button" disabled={Boolean(exporting)} onClick={() => handleExport('ALIMENTACAO_BEBIDA')}>
        {exporting === 'ALIMENTACAO_BEBIDA' ? 'Gerando Lanches…' : 'Exportar Lanches'}
      </button>
      {error && <span className="dashboard-export-error" role="alert">{error}</span>}
    </div>
  )
}
