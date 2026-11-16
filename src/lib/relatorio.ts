import type {Employee} from '../types'

/** Colunas do relatório enviado ao Michiel, na ordem pedida. */
export const COLUNAS_MICHIEL = ['Nome', 'Cadastro', 'Cargo', 'C.C', 'ID Superior', 'Nome Superior', 'ID Encarregado', 'Nome Encarregado', 'Alocação'] as const

/** Linhas do relatório (cabeçalho + uma por colaborador), em ordem alfabética de nome. */
export function linhasRelatorioMichiel(rows: Employee[]): string[][] {
  const ordenados = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  return [[...COLUNAS_MICHIEL], ...ordenados.map(e => [e.name, e.id, e.role, e.costCenter, e.supervisorId, e.supervisor, e.leadId ?? '', e.lead, e.client])]
}

/** CSV no padrão do Extra: BOM (acentos no Excel), separador ";", quebra CRLF e aspas só quando necessário. */
export function csvRelatorioMichiel(rows: Employee[]): string {
  const cel = (v: string) => (/[;"\r\n]/.test(v ?? '') ? `"${(v ?? '').replace(/"/g, '""')}"` : (v ?? ''))
  return '\uFEFF' + linhasRelatorioMichiel(rows).map(l => l.map(cel).join(';')).join('\r\n')
}

export function exportarRelatorioMichiel(rows: Employee[], hoje = new Date()) {
  const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  const blob = new Blob([csvRelatorioMichiel(rows)], {type: 'text/csv;charset=utf-8;'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `relatorio-headcount-g5-${data}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
