const ProtocolService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';

  function next(createdAt) {
    const date = createdAt instanceof Date && !Number.isNaN(createdAt.getTime())
      ? createdAt
      : new Date();
    const year = Utilities.formatDate(date, DateService.TIMEZONE, 'yyyy');
    const pattern = new RegExp('^CE-' + year + '-(\\d{6})$');
    const rows = SheetRepository.readObjects(SHEET_SOLICITACOES);
    let maxSequence = 0;

    rows.forEach(function (row) {
      const match = pattern.exec(ValidationService.normalizeText(row.ID_SOLICITACAO));
      if (match) {
        maxSequence = Math.max(maxSequence, Number(match[1]));
      }
    });

    return 'CE-' + year + '-' + String(maxSequence + 1).padStart(6, '0');
  }

  return {
    next,
  };
})();
