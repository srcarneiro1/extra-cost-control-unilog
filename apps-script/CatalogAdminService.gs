const CatalogAdminService = (() => {
  const PROVIDER_SHEET = 'CAD_FORNECEDORES';
  const PROVIDER_COLUMNS = [
    'WHATSAPP_DESTINO',
    'WHATSAPP_NUMERO',
    'WHATSAPP_GRUPO_LINK',
  ];
  const DESTINATIONS = ['NENHUM', 'NUMERO', 'GRUPO'];

  function execute(payload) {
    const action = ValidationService.normalizeUpper(payload && payload.acao);

    if (action === 'LISTAR') {
      return getAdministrativeCatalogs();
    }

    if (action === 'SALVAR_FORNECEDOR') {
      return saveProvider_(payload || {});
    }

    ValidationService.fail('Ação administrativa de cadastro inválida.');
  }

  function getAdministrativeCatalogs() {
    ensureProviderSchema_();
    return {
      fornecedores: SheetRepository.readObjects(PROVIDER_SHEET)
        .map(providerAdminDto_)
        .filter(function (item) {
          return Boolean(item.nome);
        })
        .sort(function (a, b) {
          return a.nome.localeCompare(b.nome, 'pt-BR');
        }),
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
      if (!groupLink) {
        ValidationService.fail('Link do grupo é obrigatório quando o destino é GRUPO.');
      }
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

  function ensureProviderSchema_() {
    SheetRepository.ensureColumns(PROVIDER_SHEET, PROVIDER_COLUMNS);
  }

  function findProvider_(provider) {
    const rows = SheetRepository.readObjects(PROVIDER_SHEET);
    const normalized = ValidationService.normalizeUpper(provider);
    const matched = rows.find(function (row) {
      return ValidationService.normalizeUpper(row.FORNECEDOR) === normalized;
    });

    if (!matched) return null;
    return SheetRepository.findRowByField(
      PROVIDER_SHEET,
      'FORNECEDOR',
      matched.FORNECEDOR
    );
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
