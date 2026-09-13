const FinancialExceptionPhase2CService = (() => {
  function execute(payload) {
    const input = payload || {};
    const action = ValidationService.normalizeUpper(input.acao || FinancialExceptionService.ACTIONS.LIST);

    if (action !== FinancialExceptionService.ACTIONS.DECIDE) {
      return FinancialExceptionService.execute(input);
    }

    const destination = ValidationService.normalizeUpper(input.destinoFinanceiro);
    if (destination === FinancialExceptionService.DESTINATIONS.NEXT_COMPETENCE) {
      const solicitationId = ValidationService.requiredText(input.idSolicitacao, 'Solicitação');
      const targetCompetence = String(input.competenciaFaturamento || '').trim();
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetCompetence)) {
        ValidationService.fail('Competência de faturamento inválida. Use YYYY-MM.');
      }

      const solicitation = SheetRepository.findRowByField('SOLICITACOES', 'ID_SOLICITACAO', solicitationId);
      if (!solicitation) ValidationService.fail('Solicitação não encontrada.');
      const provider = String(solicitation.record.FORNECEDOR || '').trim();
      if (!provider) ValidationService.fail('Solicitação sem fornecedor válido.');

      const spreadsheet = SheetRepository.getSpreadsheet();
      const sheet = spreadsheet.getSheetByName('FECHAMENTOS');
      if (sheet) {
        const exists = SheetRepository.readObjects('FECHAMENTOS').some(function (record) {
          return String(record.COMPETENCIA_FATURAMENTO || '').trim() === targetCompetence &&
            ValidationService.normalizeUpper(record.FORNECEDOR) === ValidationService.normalizeUpper(provider);
        });
        if (exists) {
          ValidationService.fail(
            'A competência de faturamento escolhida já possui fechamento para este fornecedor. Escolha uma competência futura ainda aberta.'
          );
        }
      }
    }

    return FinancialExceptionService.execute(input);
  }

  return { execute };
})();
