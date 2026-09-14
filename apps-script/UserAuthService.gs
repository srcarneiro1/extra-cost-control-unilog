const UserAuthService = (() => {
  const SHEET = 'CAD_USUARIOS';
  const PEPPER_PROPERTY = 'AUTH_PASSWORD_PEPPER';
  const PENDING_EMAIL_PROPERTY = 'AUTH_PENDING_EMAIL';
  const PENDING_PASSWORD_PROPERTY = 'AUTH_PENDING_PASSWORD';
  const HASH_ROUNDS = 2048;
  const HEADERS = [
    'EMAIL',
    'NOME',
    'SENHA_HASH',
    'SALT',
    'PERFIL',
    'OPERACAO',
    'ATIVO',
    'EXIGE_TROCA_SENHA',
    'ULTIMA_ALTERACAO',
  ];
  const ALLOWED_PROFILES = ['OWNER', 'ADMINISTRATIVO', 'OPERACIONAL'];

  function authenticate(payload) {
    const email = normalizeEmail_(payload && payload.email);
    const password = String(payload && payload.password ? payload.password : '');

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      ValidationService.fail('Informe um e-mail válido.');
    }

    if (!password) {
      ValidationService.fail('Informe a senha.');
    }

    ensureSheet_();

    const match = findUser_(email);

    if (!match || !isActive_(match.record.ATIVO)) {
      authorizationFail_();
    }

    const storedHash = String(match.record.SENHA_HASH || '').trim();
    const storedSalt = String(match.record.SALT || '').trim();

    if (!storedHash || !storedSalt) {
      authorizationFail_();
    }

    const valid = secureEquals_(storedHash, hashPassword_(password, storedSalt));

    if (!valid) {
      authorizationFail_();
    }

    const profile = normalizeProfile_(match.record.PERFIL);

    return {
      email: email,
      nome: ValidationService.normalizeText(match.record.NOME) || email.split('@')[0],
      perfil: profile,
      operacao: ValidationService.normalizeUpper(match.record.OPERACAO || ''),
      exigeTrocaSenha: requiresPasswordChange_(match.record.EXIGE_TROCA_SENHA),
    };
  }

  function applyPendingPassword() {
    const properties = PropertiesService.getScriptProperties();
    const email = normalizeEmail_(properties.getProperty(PENDING_EMAIL_PROPERTY));
    const password = String(properties.getProperty(PENDING_PASSWORD_PROPERTY) || '');

    try {
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        ValidationService.fail('Defina AUTH_PENDING_EMAIL com um e-mail válido nas propriedades do script.');
      }

      if (password.length < 8) {
        ValidationService.fail('Defina AUTH_PENDING_PASSWORD com uma senha de pelo menos 8 caracteres.');
      }

      setPassword_(email, password, true);

      return {
        ok: true,
        email: email,
        mensagem: 'Senha protegida gravada com sucesso. As propriedades temporárias foram removidas.',
      };
    } finally {
      properties.deleteProperty(PENDING_EMAIL_PROPERTY);
      properties.deleteProperty(PENDING_PASSWORD_PROPERTY);
    }
  }

  function setPassword(email, password) {
    const normalizedEmail = normalizeEmail_(email);
    const normalizedPassword = String(password || '');

    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      ValidationService.fail('Informe um e-mail válido para definir a senha.');
    }

    if (normalizedPassword.length < 8) {
      ValidationService.fail('A senha deve possuir pelo menos 8 caracteres.');
    }

    setPassword_(normalizedEmail, normalizedPassword, true);
  }

  function completePasswordChange(email, password) {
    const normalizedEmail = normalizeEmail_(email);
    const normalizedPassword = String(password || '');

    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      ValidationService.fail('Informe um e-mail válido para definir a senha.');
    }

    if (normalizedPassword.length < 8) {
      ValidationService.fail('A nova senha deve possuir pelo menos 8 caracteres.');
    }

    setPassword_(normalizedEmail, normalizedPassword, false);
    return authenticate({ email: normalizedEmail, password: normalizedPassword });
  }

  function setPassword_(email, password, requireChange) {
    ensureSheet_();

    const match = findUser_(email);

    if (!match) {
      ValidationService.fail('Usuário não encontrado na aba CAD_USUARIOS.');
    }

    const salt = createSalt_();

    SheetRepository.updateFields(
      SHEET,
      match.rowNumber,
      {
        SENHA_HASH: hashPassword_(password, salt),
        SALT: salt,
        EXIGE_TROCA_SENHA: requireChange ? 'SIM' : 'NAO',
        ULTIMA_ALTERACAO: new Date(),
      },
      { textFields: ['SENHA_HASH', 'SALT', 'EXIGE_TROCA_SENHA'] }
    );
  }

  function findUser_(email) {
    return SheetRepository
      .readObjectsWithRowNumbers(SHEET)
      .filter(function (item) {
        return normalizeEmail_(item.record.EMAIL) === email;
      })[0] || null;
  }

  function ensureSheet_() {
    const spreadsheet = SheetRepository.getSpreadsheet();
    let sheet = spreadsheet.getSheetByName(SHEET);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
      return sheet;
    }

    SheetRepository.ensureColumns(SHEET, HEADERS);
    return sheet;
  }

  function normalizeEmail_(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeProfile_(value) {
    const profile = ValidationService.normalizeUpper(value || 'OPERACIONAL');
    return ALLOWED_PROFILES.indexOf(profile) >= 0 ? profile : 'OPERACIONAL';
  }

  function isActive_(value) {
    const normalized = ValidationService.normalizeUpper(value);
    return ['SIM', 'TRUE', '1', 'ATIVO', 'YES'].indexOf(normalized) >= 0;
  }

  function requiresPasswordChange_(value) {
    const normalized = ValidationService.normalizeUpper(value);
    return ['SIM', 'TRUE', '1', 'YES'].indexOf(normalized) >= 0;
  }

  function authorizationFail_() {
    const error = new Error('E-mail ou senha inválidos, ou usuário inativo.');
    error.name = 'AuthorizationError';
    throw error;
  }

  function ensurePepper_() {
    const properties = PropertiesService.getScriptProperties();
    let pepper = String(properties.getProperty(PEPPER_PROPERTY) || '').trim();

    if (!pepper) {
      pepper = Utilities.getUuid() + Utilities.getUuid();
      properties.setProperty(PEPPER_PROPERTY, pepper);
    }

    return pepper;
  }

  function createSalt_() {
    return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  }

  function hashPassword_(password, salt) {
    const pepper = ensurePepper_();
    let value = salt + '|' + password + '|' + pepper;

    for (let index = 0; index < HASH_ROUNDS; index += 1) {
      const digest = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        value,
        Utilities.Charset.UTF_8
      );
      value = bytesToHex_(digest) + '|' + pepper;
    }

    return value.split('|')[0];
  }

  function bytesToHex_(bytes) {
    return (bytes || []).map(function (byte) {
      const normalized = byte < 0 ? byte + 256 : byte;
      return ('0' + normalized.toString(16)).slice(-2);
    }).join('');
  }

  function secureEquals_(left, right) {
    const a = String(left || '');
    const b = String(right || '');
    const length = Math.max(a.length, b.length);
    let difference = a.length ^ b.length;

    for (let index = 0; index < length; index += 1) {
      difference |= (a.charCodeAt(index % Math.max(a.length, 1)) || 0) ^
        (b.charCodeAt(index % Math.max(b.length, 1)) || 0);
    }

    return difference === 0;
  }

  return {
    authenticate,
    ensureSheet: ensureSheet_,
    applyPendingPassword,
    setPassword,
    completePasswordChange,
  };
})();
