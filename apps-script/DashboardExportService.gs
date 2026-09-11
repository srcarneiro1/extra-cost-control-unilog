const DashboardExportService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';
  const TYPE_LABOR = 'MAO_DE_OBRA';
  const TYPE_SNACKS = 'ALIMENTACAO_BEBIDA';

  function getExport(payload) {
    const input = payload || {};
    const type = ValidationService.enumValue(
      input.tipoExportacao,
      'Tipo da exportação',
      [TYPE_LABOR, TYPE_SNACKS]
    );
    const competence = selectedCompetence_(input);
    const filters = normalizeFilters_(input);

    const rows = readCompetenceRows_(competence)
      .filter(function (record) {
        return competenceOf_(record) === competence;
      })
      .filter(function (record) {
        return ValidationService.normalizeUpper(record.TIPO_SOLICITACAO) === type;
      })
      .filter(function (record) {
        return matchesFilters_(record, filters);
      })
      .sort(function (left, right) {
        return sortDate_(left.DATA_OPERACIONAL) - sortDate_(right.DATA_OPERACIONAL);
      })
      .map(function (record) {
        return toExportRow_(record, type);
      });

    return {
      competencia: competence,
      tipoExportacao: type,
      arquivo: (type === TYPE_LABOR ? 'Detalhamento_Mao_de_Obra_' : 'Detalhamento_Lanches_') + competence + '.csv',
      colunas: [
        'Data pedido',
        'Data execução',
        'Depositante',
        'Supervisor',
        'Atividade',
        'Empresa',
        'Solicitado',
        'Realizado',
        'Planejado',
        'Real',
        'Status',
      ],
      linhas: rows,
      total: rows.length,
    };
  }

  function readCompetenceRows_(competence) {
    const storedCompetences = SheetRepository.readFieldValues(SHEET_SOLICITACOES, 'COMPETENCIA');
    const operationalDates = SheetRepository.readFieldValues(SHEET_SOLICITACOES, 'DATA_OPERACIONAL');
    const total = Math.max(storedCompetences.length, operationalDates.length);
    let needsLegacyFallback = false;

    for (let index = 0; index < total; index += 1) {
      const rawStored = storedCompetences[index] == null ? '' : storedCompetences[index];
      const stored = ValidationService.normalizeText(rawStored);

      if (/^\d{4}-\d{2}$/.test(stored)) {
        if (stored === competence && String(rawStored) !== stored) {
          needsLegacyFallback = true;
          break;
        }
        continue;
      }

      const operationalDate = operationalDates[index];
      if (!operationalDate) continue;

      try {
        if (DateService.competence(operationalDate) === competence) {
          needsLegacyFallback = true;
          break;
        }
      } catch (error) {
        // Registro inválido fora da competência consultada não bloqueia a exportação.
      }
    }

    return needsLegacyFallback
      ? SheetRepository.readObjects(SHEET_SOLICITACOES)
      : SheetRepository.readObjectsByFieldValues(
          SHEET_SOLICITACOES,
          'COMPETENCIA',
          [competence]
        );
  }

  function toExportRow_(record, type) {
    const requested = type === TYPE_LABOR
      ? numberOrBlank_(record.QTD_SOLICITADA)
      : number_(record.QTD_ALIMENTACAO) + number_(record.QTD_BEBIDA);
    const realized = type === TYPE_LABOR
      ? numberOrBlank_(record.QTD_COMPARECIDA)
      : requested;

    return [
      dateOnly_(record.DATA_CRIACAO),
      dateOnly_(record.DATA_OPERACIONAL),
      text_(record.OPERACAO),
      text_(record.SUPERVISOR),
      text_(record.ATIVIDADE),
      text_(record.FORNECEDOR),
      requested,
      realized,
      number_(record.VALOR_PREVISTO),
      realizedValue_(record, type),
      statusLabel_(record, type),
    ];
  }

  function statusLabel_(record, type) {
    const triageCompleted = hasValue_(record.FORNECEDOR) && (
      hasValue_(record.PRECO_UNITARIO_APLICADO) ||
      hasValue_(record.PRECO_ALIMENTACAO_APLICADO) ||
      hasValue_(record.PRECO_BEBIDA_APLICADO)
    );

    if (!triageCompleted) return 'Aguardando triagem';
    if (type === TYPE_SNACKS) return 'Triagem concluída';

    const attendanceRegistered = hasValue_(record.QTD_COMPARECIDA);
    if (!attendanceRegistered) return 'Aguardando realizado';

    const requested = Number(record.QTD_SOLICITADA);
    const attended = Number(record.QTD_COMPARECIDA);
    if (Number.isFinite(requested) && Number.isFinite(attended) && requested !== attended) {
      return 'Com divergência';
    }

    return 'Concluído';
  }

  function selectedCompetence_(input) {
    const current = DateService.competence(new Date());
    const parts = current.split('-');
    const year = String(input.ano || parts[0]).trim();
    const month = String(input.mesCompetencia || parts[1]).trim().padStart(2, '0');

    if (!/^\d{4}$/.test(year)) ValidationService.fail('Ano inválido para exportação.');
    if (!/^(0[1-9]|1[0-2])$/.test(month)) ValidationService.fail('Mês de competência inválido para exportação.');
    return year + '-' + month;
  }

  function normalizeFilters_(input) {
    return {
      operacao: normalized_(input.operacao),
      supervisor: normalized_(input.supervisor),
      fornecedor: normalized_(input.fornecedor),
      responsavelCusto: normalized_(input.responsavelCusto),
      atividade: normalized_(input.atividade),
    };
  }

  function normalized_(value) {
    const normalized = ValidationService.normalizeUpper(value || '');
    return normalized === 'TODOS' ? '' : normalized;
  }

  function matchesFilters_(record, filters) {
    if (filters.operacao && ValidationService.normalizeUpper(record.OPERACAO) !== filters.operacao) return false;
    if (filters.supervisor && ValidationService.normalizeUpper(record.SUPERVISOR) !== filters.supervisor) return false;
    if (filters.fornecedor && ValidationService.normalizeUpper(record.FORNECEDOR) !== filters.fornecedor) return false;
    if (filters.responsavelCusto && ValidationService.normalizeUpper(record.RESPONSAVEL_CUSTO) !== filters.responsavelCusto) return false;
    if (filters.atividade && ValidationService.normalizeUpper(record.ATIVIDADE) !== filters.atividade) return false;
    return true;
  }

  function competenceOf_(record) {
    const stored = text_(record.COMPETENCIA);
    if (/^\d{4}-\d{2}$/.test(stored)) return stored;
    if (!record.DATA_OPERACIONAL) return '';
    try {
      return DateService.competence(record.DATA_OPERACIONAL);
    } catch (error) {
      return '';
    }
  }

  function realizedValue_(record, type) {
    if (type === TYPE_SNACKS && !hasValue_(record.VALOR_REAL)) {
      return number_(record.VALOR_PREVISTO);
    }
    return number_(record.VALOR_REAL);
  }

  function dateOnly_(value) {
    if (!hasValue_(value)) return '';
    try {
      return DateService.toIsoDate(value);
    } catch (error) {
      return '';
    }
  }

  function sortDate_(value) {
    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
      return value.getTime();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  function text_(value) {
    return ValidationService.normalizeText(value || '');
  }

  function hasValue_(value) {
    return value !== '' && value !== null && value !== undefined;
  }

  function number_(value) {
    if (!hasValue_(value)) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function numberOrBlank_(value) {
    return hasValue_(value) && Number.isFinite(Number(value)) ? Number(value) : '';
  }

  return {
    getExport,
  };
})();