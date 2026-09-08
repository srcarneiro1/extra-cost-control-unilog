const CatalogAdminService = (() => {
  const PROVIDER_SHEET = 'CAD_FORNECEDORES';
  const LABOR_PRICE_SHEET = 'PRECOS_MO';
  const PRODUCT_PRICE_SHEET = 'PRECOS_PRODUTOS';
  const PROVIDER_COLUMNS = [
    'WHATSAPP_DESTINO',
    'WHATSAPP_NUMERO',
    'WHATSAPP_GRUPO_LINK',
  ];
  const LABOR_PRICE_COLUMNS = [
    'FORNECEDOR',
    'FUNCAO',
    'TURNO',
    'TIPO_DIA',
    'VIGENCIA_INICIO',
    'VIGENCIA_FIM',
    'PRECO_UNITARIO',
    'ATIVO',
  ];
  const PRODUCT_PRICE_COLUMNS = [
    'FORNECEDOR',
    'PRODUTO',
    'VIGENCIA_INICIO',
    'VIGENCIA_FIM',
    'CATEGORIA',
    'PRECO_UNITARIO',
    'ATIVO',
  ];
  const DESTINATIONS = ['NENHUM', 'NUMERO', 'GRUPO'];
  const SHIFTS = ['DIURNO', 'NOTURNO'];
  const DAY_TYPES = ['UTIL', 'SABADO', 'DOMINGO_FERIADO'];

  function execute(payload) {
    const action = ValidationService.normalizeUpper(payload && payload.acao);

    if (action === 'LISTAR') return getAdministrativeCatalogs();
    if (action === 'SALVAR_FORNECEDOR') return saveProvider_(payload || {});
    if (action === 'SALVAR_PRECO_MO') return saveLaborPrice_(payload || {});
    if (action === 'SALVAR_PRECO_PRODUTO') return saveProductPrice_(payload || {});

    ValidationService.fail('Ação administrativa de cadastro inválida.');
  }

  function getAdministrativeCatalogs() {
    ensureProviderSchema_();
    ensurePriceSchemas_();

    return {
      fornecedores: SheetRepository.readObjects(PROVIDER_SHEET)
        .map(providerAdminDto_)
        .filter(function (item) { return Boolean(item.nome); })
        .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }),
      precosMaoObra: SheetRepository.readObjects(LABOR_PRICE_SHEET)
        .map(laborPriceAdminDto_)
        .filter(function (item) { return Boolean(item.fornecedor && item.funcao && item.vigenciaInicio); })
        .sort(comparePriceHistory_),
      precosProdutos: SheetRepository.readObjects(PRODUCT_PRICE_SHEET)
        .map(productPriceAdminDto_)
        .filter(function (item) { return Boolean(item.fornecedor && item.produto && item.vigenciaInicio); })
        .sort(comparePriceHistory_),
    };
  }

  function saveProvider_(payload) {
    ensureProviderSchema_();

    const provider = ValidationService.normalizeUpper(
      ValidationService.requiredText(payload.fornecedor, 'Fornecedor')
    );
    const labor = Boolean(payload.maoDeObra);
    const food = Boolean(payload.alimentacao);
    const active = payload.ativo !== false;

    if (!labor && !food) {
      ValidationService.fail('Fornecedor deve atender mão de obra e/ou alimentação.');
    }

    const destination = ValidationService.enumValue(
      payload.whatsappDestino || 'NENHUM',
      'Destino do WhatsApp',
      DESTINATIONS
    );

    const number = normalizePhone_(payload.whatsappNumero);
    const groupLink = ValidationService.normalizeText(payload.whatsappGrupoLink);

    if (destination === 'NUMERO' && !number) {
      ValidationService.fail('Número do WhatsApp é obrigatório quando o destino é NUMERO.');
    }

    if (destination === 'GRUPO') {
      if (!groupLink) ValidationService.fail('Link do grupo é obrigatório quando o destino é GRUPO.');
      if (groupLink.indexOf('https://chat.whatsapp.com/') !== 0) {
        ValidationService.fail('Informe um link oficial de convite do grupo do WhatsApp.');
      }
    }

    const updates = {
      FORNECEDOR: provider,
      MAO_DE_OBRA: labor ? 'SIM' : 'NAO',
      ALIMENTACAO: food ? 'SIM' : 'NAO',
      ATIVO: active ? 'SIM' : 'NAO',
      WHATSAPP_DESTINO: destination,
      WHATSAPP_NUMERO: destination === 'NUMERO' ? number : '',
      WHATSAPP_GRUPO_LINK: destination === 'GRUPO' ? groupLink : '',
    };

    const existing = findProvider_(provider);
    if (existing) {
      SheetRepository.updateFields(
        PROVIDER_SHEET,
        existing.rowNumber,
        updates,
        { textFields: ['FORNECEDOR', 'WHATSAPP_NUMERO', 'WHATSAPP_GRUPO_LINK'] }
      );
    } else {
      SheetRepository.appendObject(
        PROVIDER_SHEET,
        updates,
        { textFields: ['FORNECEDOR', 'WHATSAPP_NUMERO', 'WHATSAPP_GRUPO_LINK'] }
      );
    }

    const saved = findProvider_(provider);
    return saved ? providerAdminDto_(saved.record) : providerAdminDto_(updates);
  }

  function saveLaborPrice_(payload) {
    ensurePriceSchemas_();

    const provider = ValidationService.normalizeUpper(
      ValidationService.requiredText(payload.fornecedor, 'Fornecedor')
    );
    const role = ValidationService.normalizeUpper(
      ValidationService.requiredText(payload.funcao, 'Função')
    );
    const shift = ValidationService.enumValue(payload.turno, 'Turno', SHIFTS);
    const dayType = ValidationService.enumValue(payload.tipoDia, 'Tipo de dia', DAY_TYPES);
    const start = DateService.toIsoDate(payload.vigenciaInicio);
    const price = positiveMoney_(payload.precoUnitario, 'Preço unitário');

    const providerRow = ValidationService.findActive(
      SheetRepository.readObjects(PROVIDER_SHEET),
      'FORNECEDOR',
      provider,
      'Fornecedor'
    );
    if (!ValidationService.isTruthy(providerRow.MAO_DE_OBRA)) {
      ValidationService.fail('Fornecedor não está habilitado para mão de obra.');
    }

    ValidationService.findActive(
      SheetRepository.readObjects('CAD_FUNCOES'),
      'FUNCAO',
      role,
      'Função'
    );

    if (role === 'AUXILIAR OPERACIONAL' && shift !== 'DIURNO') {
      ValidationService.fail('Auxiliar operacional deve utilizar turno DIURNO.');
    }

    closeCurrentVersion_(LABOR_PRICE_SHEET, {
      FORNECEDOR: provider,
      FUNCAO: role,
      TURNO: shift,
      TIPO_DIA: dayType,
    }, start);

    const record = {
      FORNECEDOR: provider,
      FUNCAO: role,
      TURNO: shift,
      TIPO_DIA: dayType,
      VIGENCIA_INICIO: start,
      VIGENCIA_FIM: '',
      PRECO_UNITARIO: price,
      ATIVO: 'SIM',
    };

    SheetRepository.appendObject(LABOR_PRICE_SHEET, record, {
      textFields: ['FORNECEDOR', 'FUNCAO', 'TURNO', 'TIPO_DIA', 'VIGENCIA_INICIO', 'VIGENCIA_FIM'],
    });

    return laborPriceAdminDto_(record);
  }

  function saveProductPrice_(payload) {
    ensurePriceSchemas_();

    const provider = ValidationService.normalizeUpper(
      ValidationService.requiredText(payload.fornecedor, 'Fornecedor')
    );
    const product = ValidationService.normalizeUpper(
      ValidationService.requiredText(payload.produto, 'Produto')
    );
    const start = DateService.toIsoDate(payload.vigenciaInicio);
    const price = positiveMoney_(payload.precoUnitario, 'Preço unitário');

    const providerRow = ValidationService.findActive(
      SheetRepository.readObjects(PROVIDER_SHEET),
      'FORNECEDOR',
      provider,
      'Fornecedor'
    );
    if (!ValidationService.isTruthy(providerRow.ALIMENTACAO)) {
      ValidationService.fail('Fornecedor não está habilitado para alimentação/bebida.');
    }

    const productRow = ValidationService.findActive(
      SheetRepository.readObjects('CAD_PRODUTOS'),
      'PRODUTO',
      product,
      'Produto'
    );
    const category = ValidationService.enumValue(
      productRow.CATEGORIA,
      'Categoria do produto',
      ['ALIMENTACAO', 'BEBIDA']
    );

    closeCurrentVersion_(PRODUCT_PRICE_SHEET, {
      FORNECEDOR: provider,
      PRODUTO: product,
    }, start);

    const record = {
      FORNECEDOR: provider,
      PRODUTO: product,
      VIGENCIA_INICIO: start,
      VIGENCIA_FIM: '',
      CATEGORIA: category,
      PRECO_UNITARIO: price,
      ATIVO: 'SIM',
    };

    SheetRepository.appendObject(PRODUCT_PRICE_SHEET, record, {
      textFields: ['FORNECEDOR', 'PRODUTO', 'VIGENCIA_INICIO', 'VIGENCIA_FIM', 'CATEGORIA'],
    });

    return productPriceAdminDto_(record);
  }

  function closeCurrentVersion_(sheetName, keys, newStart) {
    const rows = SheetRepository.readObjectsWithRowNumbers(sheetName).filter(function (item) {
      const row = item.record;
      return ValidationService.isTruthy(row.ATIVO) && Object.keys(keys).every(function (field) {
        return ValidationService.normalizeUpper(row[field]) === ValidationService.normalizeUpper(keys[field]);
      });
    });

    if (!rows.length) return;

    rows.sort(function (a, b) {
      return DateService.compareDateOnly(b.record.VIGENCIA_INICIO, a.record.VIGENCIA_INICIO);
    });

    const latest = rows[0];
    const latestStart = DateService.toIsoDate(latest.record.VIGENCIA_INICIO);
    if (DateService.compareDateOnly(newStart, latestStart) <= 0) {
      ValidationService.fail(
        'A nova vigência deve começar depois da vigência mais recente (' + latestStart + ').'
      );
    }

    const newStartDate = DateService.parseDateOnly(newStart);
    newStartDate.setDate(newStartDate.getDate() - 1);
    SheetRepository.updateFields(
      sheetName,
      latest.rowNumber,
      { VIGENCIA_FIM: DateService.toIsoDate(newStartDate) },
      { textFields: ['VIGENCIA_FIM'] }
    );
  }

  function ensureProviderSchema_() {
    SheetRepository.ensureColumns(PROVIDER_SHEET, PROVIDER_COLUMNS);
  }

  function ensurePriceSchemas_() {
    SheetRepository.ensureColumns(LABOR_PRICE_SHEET, LABOR_PRICE_COLUMNS);
    SheetRepository.ensureColumns(PRODUCT_PRICE_SHEET, PRODUCT_PRICE_COLUMNS);
  }

  function findProvider_(provider) {
    const rows = SheetRepository.readObjects(PROVIDER_SHEET);
    const normalized = ValidationService.normalizeUpper(provider);
    const matched = rows.find(function (row) {
      return ValidationService.normalizeUpper(row.FORNECEDOR) === normalized;
    });

    if (!matched) return null;
    return SheetRepository.findRowByField(PROVIDER_SHEET, 'FORNECEDOR', matched.FORNECEDOR);
  }

  function providerAdminDto_(row) {
    const number = ValidationService.normalizeText(row.WHATSAPP_NUMERO);
    const groupLink = ValidationService.normalizeText(row.WHATSAPP_GRUPO_LINK);
    let destination = ValidationService.normalizeUpper(row.WHATSAPP_DESTINO || '');

    if (DESTINATIONS.indexOf(destination) === -1) {
      destination = groupLink ? 'GRUPO' : number ? 'NUMERO' : 'NENHUM';
    }

    return {
      nome: ValidationService.normalizeText(row.FORNECEDOR),
      maoDeObra: ValidationService.isTruthy(row.MAO_DE_OBRA),
      alimentacao: ValidationService.isTruthy(row.ALIMENTACAO),
      ativo: ValidationService.isTruthy(row.ATIVO),
      whatsappDestino: destination,
      whatsappNumero: number,
      whatsappGrupoLink: groupLink,
    };
  }

  function laborPriceAdminDto_(row) {
    return {
      fornecedor: ValidationService.normalizeText(row.FORNECEDOR),
      funcao: ValidationService.normalizeText(row.FUNCAO),
      turno: ValidationService.normalizeUpper(row.TURNO),
      tipoDia: ValidationService.normalizeUpper(row.TIPO_DIA),
      vigenciaInicio: safeIsoDate_(row.VIGENCIA_INICIO),
      vigenciaFim: row.VIGENCIA_FIM ? safeIsoDate_(row.VIGENCIA_FIM) : '',
      precoUnitario: moneyNumber_(row.PRECO_UNITARIO),
      ativo: ValidationService.isTruthy(row.ATIVO),
    };
  }

  function productPriceAdminDto_(row) {
    return {
      fornecedor: ValidationService.normalizeText(row.FORNECEDOR),
      produto: ValidationService.normalizeText(row.PRODUTO),
      categoria: ValidationService.normalizeUpper(row.CATEGORIA),
      vigenciaInicio: safeIsoDate_(row.VIGENCIA_INICIO),
      vigenciaFim: row.VIGENCIA_FIM ? safeIsoDate_(row.VIGENCIA_FIM) : '',
      precoUnitario: moneyNumber_(row.PRECO_UNITARIO),
      ativo: ValidationService.isTruthy(row.ATIVO),
    };
  }

  function comparePriceHistory_(a, b) {
    const byStart = String(b.vigenciaInicio || '').localeCompare(String(a.vigenciaInicio || ''));
    if (byStart !== 0) return byStart;
    return String(a.fornecedor || '').localeCompare(String(b.fornecedor || ''), 'pt-BR');
  }

  function safeIsoDate_(value) {
    if (!value) return '';
    return DateService.toIsoDate(value);
  }

  function moneyNumber_(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const text = String(value == null ? '' : value).trim();
    if (!text) return 0;
    let normalized = text;
    if (text.indexOf(',') >= 0 && text.indexOf('.') >= 0) {
      normalized = text.lastIndexOf(',') > text.lastIndexOf('.')
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
    } else if (text.indexOf(',') >= 0) {
      normalized = text.replace(',', '.');
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function positiveMoney_(value, label) {
    const parsed = moneyNumber_(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      ValidationService.fail(label + ' deve ser maior que zero.');
    }
    return Math.round(parsed * 100) / 100;
  }

  function normalizePhone_(value) {
    const normalized = ValidationService.normalizeText(value).replace(/\D/g, '');
    if (!normalized) return '';
    if (normalized.length < 8 || normalized.length > 15) {
      ValidationService.fail('Número do WhatsApp deve conter de 8 a 15 dígitos em formato internacional.');
    }
    return normalized;
  }

  return {
    execute,
    getAdministrativeCatalogs,
  };
})();
