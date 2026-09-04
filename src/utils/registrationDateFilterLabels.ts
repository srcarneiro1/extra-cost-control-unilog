function syncRegistrationDateFilterLabels() {
  const yearSelect = document.querySelector<HTMLSelectElement>('[aria-label="Ano da data de registro"]')
  const monthSelect = document.querySelector<HTMLSelectElement>('[aria-label="Mês da data de registro"]')
  const daySelect = document.querySelector<HTMLSelectElement>('[aria-label="Dia da data de registro"]')

  if (!yearSelect || !monthSelect || !daySelect) return

  const year = yearSelect.value
  const month = monthSelect.value
  const hasCompletePeriod = year !== 'TODOS' && month !== 'TODOS'

  const allOption = daySelect.querySelector<HTMLOptionElement>('option[value="TODOS"]')
  if (allOption) {
    allOption.textContent = hasCompletePeriod ? 'Data: todas' : 'Data: selecione ano e mês'
  }

  Array.from(daySelect.options).forEach((option) => {
    if (option.value === 'TODOS') return
    option.textContent = hasCompletePeriod
      ? `${option.value.padStart(2, '0')}/${month}/${year}`
      : option.value.padStart(2, '0')
  })

  daySelect.disabled = !hasCompletePeriod
}

export function setupRegistrationDateFilterLabels() {
  const root = document.getElementById('root')
  if (!root) return () => undefined

  let frame = 0
  const scheduleSync = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(syncRegistrationDateFilterLabels)
  }

  const observer = new MutationObserver(scheduleSync)
  observer.observe(root, { childList: true, subtree: true })

  root.addEventListener('change', scheduleSync)
  scheduleSync()

  return () => {
    cancelAnimationFrame(frame)
    observer.disconnect()
    root.removeEventListener('change', scheduleSync)
  }
}
