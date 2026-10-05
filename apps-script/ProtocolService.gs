const ProtocolService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';
  const ID_FIELD = 'ID_SOLICITACAO';
  const PROPERTY_PREFIX = 'PROTOCOL_SEQ_';
  const MAX_COLLISION_ATTEMPTS = 50;

  /**
   * Gera o próximo protocolo CE-AAAA-NNNNNN.
   *
   * IMPORTANTE: deve ser chamado dentro do LockService.getScriptLock() já obtido
   * pelo chamador (SolicitationService.create e FormResponseNormalizerService),
   * pois o contador é lido e incrementado em ScriptProperties.
   *
   * O contador evita a leitura completa da aba SOLICITACOES a cada criação.
   * Na primeira chamada do ano (ou se a propriedade for apagada) ele é semeado
   * lendo apenas a coluna ID_SOLICITACAO. Antes de devolver, confirma via
   * TextFinder que o ID ainda não existe, cobrindo linhas inseridas manualmente.
   */
  function next(createdAt) {
    const date = createdAt instanceof Date && !Number.isNaN(createdAt.getTime())
      ? createdAt
      : new Date();
    const year = Utilities.formatDate(date, DateService.TIMEZONE, 'yyyy');
    const properties = PropertiesService.getScriptProperties();
    const propertyKey = PROPERTY_PREFIX + year;

    const stored = properties.getProperty(propertyKey);
    // Atenção: Number(null) === 0, por isso a ausência da propriedade é testada antes.
    let sequence = stored == null || String(stored).trim() === '' ? NaN : Number(stored);
    if (!Number.isInteger(sequence) || sequence < 0) {
      sequence = scanMaxSequence_(year);
    }

    let candidate = '';
    for (let attempt = 0; attempt < MAX_COLLISION_ATTEMPTS; attempt += 1) {
      sequence += 1;
      candidate = format_(year, sequence);
      if (!SheetRepository.findRowByField(SHEET_SOLICITACOES, ID_FIELD, candidate)) break;
      candidate = '';
    }

    if (!candidate) {
      // Contador muito defasado (ex.: importação manual em massa): ressemeia pela coluna.
      sequence = scanMaxSequence_(year) + 1;
      candidate = format_(year, sequence);
    }

    properties.setProperty(propertyKey, String(sequence));
    return candidate;
  }

  function scanMaxSequence_(year) {
    const pattern = new RegExp('^CE-' + year + '-(\\d{6})$');
    let maxSequence = 0;
    SheetRepository.readFieldValues(SHEET_SOLICITACOES, ID_FIELD).forEach(function (value) {
      const match = pattern.exec(ValidationService.normalizeText(value));
      if (match) maxSequence = Math.max(maxSequence, Number(match[1]));
    });
    return maxSequence;
  }

  function format_(year, sequence) {
    return 'CE-' + year + '-' + String(sequence).padStart(6, '0');
  }

  return {
    next,
  };
})();
