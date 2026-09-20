import type { SolicitationCorrectionFormState } from '@/features/solicitations/administrative/solicitationCorrectionForm'

export function validateSolicitationCorrection(form: SolicitationCorrectionFormState): string {
  if (!form.motivoCorrecao.trim()) {
    return 'Informe o motivo da correção.'
  }

  return ''
}
