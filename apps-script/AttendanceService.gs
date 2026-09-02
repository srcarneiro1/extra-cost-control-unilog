const AttendanceService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';

  function register(payload) {
    const input = payload || {};
    const solicitationId = ValidationService.requiredText(
      input.idSolicitacao,
      'ID da solicitação'
    );
    const attendedQuantity = ValidationService.nonNegativeInteger(
      input.qtdComparecida,
      'Quantidade comparecida'
    );

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error('Não foi possível obter bloqueio para registrar o comparecimento.');
    }

    try {
      const found = SheetRepository.findRowByField(
        SHEET_SOLICITACOES,
        'ID_SOLICITACAO',
        solicitationId
      );

      if (!found) {
        ValidationService.fail('Solicitação não encontrada: ' + solicitationId + '.');
      }

      const record = found.record;
      if (ValidationService.normalizeUpper(record.TIPO_SOLICITACAO) !== 'MAO_DE_OBRA') {
        ValidationService.fail('Quantidade comparecida só pode ser registrada para solicitação de mão de obra.');
      }

      const unitPrice = toMoneyNumber_(record.PRECO_UNITARIO_APLICADO);
      if (unitPrice == null) {
        ValidationService.fail('A solicitação ainda não possui preço unitário aplicado. Faça a triagem administrativa antes de registrar o comparecimento.');
      }

      const realValue = roundMoney_(attendedQuantity * unitPrice);

      SheetRepository.updateFields(
        SHEET_SOLICITACOES,
        found.rowNumber,
        {
          QTD_COMPARECIDA: attendedQuantity,
          VALOR_REAL: realValue,
        }
      );

      return {
        idSolicitacao: solicitationId,
        qtdSolicitada: Number(record.QTD_SOLICITADA),
        qtdComparecida: attendedQuantity,
        precoUnitarioAplicado: unitPrice,
        valorReal: realValue,
        divergencia: Number(record.QTD_SOLICITADA) !== attendedQuantity,
      };
    } finally {
      lock.releaseLock();
    }
  }

  function toMoneyNumber_(value) {
    if (value === '' || value == null) return null;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const normalized = String(value)
      .trim()
      .replace(/\./g, '')
      .replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function roundMoney_(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  return {
    register,
  };
})();
