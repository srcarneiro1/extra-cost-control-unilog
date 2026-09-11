const AccessScopeService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';

  function assertSolicitation(payload) {
    const input = payload || {};
    const operationScope = ValidationService.normalizeUpper(input.operacaoEscopo || '');
    if (!operationScope) return input;

    const solicitationId = ValidationService.requiredText(
      input.idSolicitacao,
      'ID da solicitação'
    );
    const found = SheetRepository.findRowByField(
      SHEET_SOLICITACOES,
      'ID_SOLICITACAO',
      solicitationId
    );

    if (
      !found ||
      ValidationService.normalizeUpper(found.record.OPERACAO) !== operationScope
    ) {
      ValidationService.fail('Solicitação não encontrada: ' + solicitationId + '.');
    }

    const sanitized = Object.assign({}, input);
    delete sanitized.operacaoEscopo;
    return sanitized;
  }

  return {
    assertSolicitation,
  };
})();
