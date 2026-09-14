const UserAdminService = (() => {
  const SHEET = 'CAD_USUARIOS';
  const ALLOWED_PROFILES = ['OWNER', 'ADMINISTRATIVO', 'OPERACIONAL'];

  function list() {
    UserAuthService.ensureSheet();
    return SheetRepository.readObjects(SHEET)
      .map(toSafeUser_)
      .sort(function (left, right) {
        return left.nome.localeCompare(right.nome, 'pt-BR');
      });
  }

  function save(payload) {
    const input = payload || {};
    const email = normalizeEmail_(input.email);
    const nome = ValidationService.requiredText(input.nome, 'Nome');
    const perfil = ValidationService.enumValue(
      input.perfil,
      'Perfil',
      ALLOWED_PROFILES
    );
    const ativo = normalizeBoolean_(input.ativo);
    const operacao = normalizeOperation_(perfil, input.operacao);
    const password = String(input.password || '');

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      ValidationService.fail('Informe um e-mail válido.');
    }

    UserAuthService.ensureSheet();
    const existing = findUser_(email);
    const values = {
      EMAIL: email,
      NOME: nome,
      PERFIL: perfil,
      OPERACAO: operacao,
      ATIVO: ativo ? 'SIM' : 'NAO',
      ULTIMA_ALTERACAO: new Date(),
    };

    if (existing) {
      validateOwnerPreservation_(existing.record, perfil, ativo);
      SheetRepository.updateFields(
        SHEET,
        existing.rowNumber,
        values,
        { textFields: ['EMAIL', 'OPERACAO'] }
      );
    } else {
      if (!password || password.length < 8) {
        ValidationService.fail('Informe uma senha inicial de pelo menos 8 caracteres para o novo usuário.');
      }

      SheetRepository.appendObject(
        SHEET,
        Object.assign({}, values, {
          SENHA_HASH: '',
          SALT: '',
          EXIGE_TROCA_SENHA: 'SIM',
        }),
        { textFields: ['EMAIL', 'SENHA_HASH', 'SALT', 'OPERACAO', 'EXIGE_TROCA_SENHA'] }
      );
    }

    if (password) {
      UserAuthService.setPassword(email, password);
    }

    return toSafeUser_(findUser_(email).record);
  }

  function resetPassword(payload) {
    const email = normalizeEmail_(payload && payload.email);
    const password = String(payload && payload.password ? payload.password : '');

    if (!email || !findUser_(email)) {
      ValidationService.fail('Usuário não encontrado.');
    }

    UserAuthService.setPassword(email, password);
    return toSafeUser_(findUser_(email).record);
  }

  function normalizeOperation_(profile, value) {
    const operation = ValidationService.normalizeUpper(value || '');

    if (profile === 'OWNER') return 'TODOS';
    if (profile === 'OPERACIONAL') {
      if (!operation || operation === 'TODOS') {
        ValidationService.fail('Usuário operacional deve estar vinculado a uma operação específica.');
      }
      validateOperation_(operation);
      return operation;
    }

    if (!operation || operation === 'TODOS') return 'TODOS';
    validateOperation_(operation);
    return operation;
  }

  function validateOperation_(operation) {
    ValidationService.findActive(
      SheetRepository.readObjects('CAD_OPERACOES'),
      'OPERACAO',
      operation,
      'Operação'
    );
  }

  function normalizeBoolean_(value) {
    if (typeof value === 'boolean') return value;
    return ['SIM', 'TRUE', '1', 'ATIVO', 'YES'].indexOf(ValidationService.normalizeUpper(value)) >= 0;
  }

  function validateOwnerPreservation_(currentRecord, nextProfile, nextActive) {
    const currentProfile = ValidationService.normalizeUpper(currentRecord.PERFIL);
    const currentActive = normalizeBoolean_(currentRecord.ATIVO);

    if (currentProfile !== 'OWNER' || !currentActive) return;
    if (nextProfile === 'OWNER' && nextActive) return;

    const remainingOwners = SheetRepository.readObjects(SHEET).filter(function (record) {
      return normalizeEmail_(record.EMAIL) !== normalizeEmail_(currentRecord.EMAIL) &&
        ValidationService.normalizeUpper(record.PERFIL) === 'OWNER' &&
        normalizeBoolean_(record.ATIVO);
    });

    if (!remainingOwners.length) {
      ValidationService.fail('Não é permitido remover ou inativar o último OWNER ativo.');
    }
  }

  function findUser_(email) {
    return SheetRepository.readObjectsWithRowNumbers(SHEET).filter(function (item) {
      return normalizeEmail_(item.record.EMAIL) === email;
    })[0] || null;
  }

  function normalizeEmail_(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toSafeUser_(record) {
    return {
      email: normalizeEmail_(record.EMAIL),
      nome: ValidationService.normalizeText(record.NOME),
      perfil: ValidationService.normalizeUpper(record.PERFIL || 'OPERACIONAL'),
      operacao: ValidationService.normalizeUpper(record.OPERACAO || ''),
      ativo: normalizeBoolean_(record.ATIVO),
      senhaConfigurada: Boolean(String(record.SENHA_HASH || '').trim() && String(record.SALT || '').trim()),
      exigeTrocaSenha: normalizeBoolean_(record.EXIGE_TROCA_SENHA),
      ultimaAlteracao: dateTime_(record.ULTIMA_ALTERACAO),
    };
  }

  function dateTime_(value) {
    if (!value) return '';
    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
      return Utilities.formatDate(value, DateService.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
    }
    return ValidationService.normalizeText(value);
  }

  return {
    list,
    save,
    resetPassword,
  };
})();
