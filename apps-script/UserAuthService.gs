const UserAuthService = (() => {
  const SHEET = 'CAD_USUARIOS';
  const PEPPER_PROPERTY = 'AUTH_PASSWORD_PEPPER';
  const HASH_ROUNDS = 2048;
  const HEADERS = [
    'EMAIL',
    'NOME',
    'SENHA',
    'SENHA_HASH',
    'SALT',
    'PERFIL',
    'OPERACAO',
    'ATIVO',
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

    const match = SheetRepository
      .readObjectsWithRowNumbers(SHEET)
      .filter(function (item) {
        return normalizeEmail_(item.record.EMAIL) === email;
      })[0];

    if (!match || !isActive_(match.record.ATIVO)) {
      authorizationFail_();
    }

    const record = match.record;
    const storedHash = String(record.SENHA_HASH || '').trim();
    const storedSalt = String(record.SALT || '').trim();
    const plaintextPassword = String(record.SENHA || '');

    let valid = false;

    if (storedHash && storedSalt) {
      valid = secureEquals_(storedHash, hashPassword_(password, storedSalt));
    } else if (plaintextPassword) {
      valid = secureEquals_(plaintextPassword, password);

      if (valid) {
        const salt = createSalt_();
        SheetRepository.updateFields(
          SHEET,
          match.rowNumber,
          {
            SENHA: '',
            SENHA_HASH: hashPassword_(password, salt),
            SALT: salt,
          },
          { textFields: ['SENHA_HASH', 'SALT'] }
        );
      }
    }

    if (!valid) {
      authorizationFail_();
    }

    const profile = normalizeProfile_(record.PERFIL);

    return {
      email: email,
      nome: ValidationService.normalizeText(record.NOME) || email.split('@')[0],
      perfil: profile,
      operacao: ValidationService.normalizeUpper(record.OPERACAO || ''),
    };
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
  };
})();
