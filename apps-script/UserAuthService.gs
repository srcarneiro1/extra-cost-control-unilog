const UserAuthService = (() => {
  const SHEET = 'CAD_USUARIOS';
  const PEPPER_PROPERTY = 'AUTH_PASSWORD_PEPPER';
  const HASH_ROUNDS = 2048;
  const HEADERS = [
    'EMAIL',
    'NOME',
    'SENHA_TEMPORARIA',
    'SENHA_HASH',
    'SALT',
    'PERFIL',
    'OPERACAO',
    'ATIVO',
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

    if (!storedHash || !storedSalt) {
      authorizationFail_();
    }

    const valid = secureEquals_(storedHash, hashPassword_(password, storedSalt));

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

  function handlePasswordEdit(event) {
    if (!event || !event.range) return;

    const sheet = event.range.getSheet();
    if (!sheet || sheet.getName() !== SHEET) return;
    if (event.range.getRow() <= 1) return;

    ensureSheet_();

    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0]
      .map(function (header) { return String(header || '').trim(); });

    const temporaryPasswordColumn = headers.indexOf('SENHA_TEMPORARIA') + 1;
    const emailColumn = headers.indexOf('EMAIL') + 1;
    const hashColumn = headers.indexOf('SENHA_HASH') + 1;
    const saltColumn = headers.indexOf('SALT') + 1;
    const updatedAtColumn = headers.indexOf('ULTIMA_ALTERACAO') + 1;

    if (
      !temporaryPasswordColumn ||
      !emailColumn ||
      !hashColumn ||
      !saltColumn ||
      event.range.getColumn() !== temporaryPasswordColumn
    ) {
      return;
    }

    const rowNumber = event.range.getRow();
    const email = normalizeEmail_(sheet.getRange(rowNumber, emailColumn).getValue());
    const password = String(event.range.getValue() || '');

    if (!password) return;

    try {
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        throw new Error('Preencha um e-mail válido antes de definir a senha.');
      }

      if (password.length < 8) {
        throw new Error('A senha deve ter pelo menos 8 caracteres.');
      }

      const salt = createSalt_();
      const hash = hashPassword_(password, salt);

      sheet.getRange(rowNumber, hashColumn).setNumberFormat('@').setValue(hash);
      sheet.getRange(rowNumber, saltColumn).setNumberFormat('@').setValue(salt);

      if (updatedAtColumn) {
        sheet.getRange(rowNumber, updatedAtColumn).setValue(new Date());
      }

      event.range.clearContent();
      event.range.clearNote();
      event.range.setNote('Senha processada com segurança. Digite uma nova senha aqui somente para redefinir o acesso.');
    } catch (error) {
      event.range.setNote(error && error.message ? error.message : 'Não foi possível processar a senha.');
      throw error;
    }
  }

  function installEditTrigger() {
    ensureSheet_();

    const spreadsheet = SheetRepository.getSpreadsheet();
    const handler = 'handleUserPasswordEdit';

    ScriptApp.getProjectTriggers().forEach(function (trigger) {
      if (
        trigger.getHandlerFunction() === handler &&
        trigger.getEventType() === ScriptApp.EventType.ON_EDIT
      ) {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    ScriptApp
      .newTrigger(handler)
      .forSpreadsheet(spreadsheet)
      .onEdit()
      .create();

    return {
      ok: true,
      mensagem: 'Gatilho de senha instalado para a aba CAD_USUARIOS.',
    };
  }

  function setPassword(email, password) {
    const normalizedEmail = normalizeEmail_(email);
    const normalizedPassword = String(password || '');

    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      ValidationService.fail('Informe um e-mail válido.');
    }

    if (normalizedPassword.length < 8) {
      ValidationService.fail('A senha deve ter pelo menos 8 caracteres.');
    }

    ensureSheet_();

    const match = SheetRepository
      .readObjectsWithRowNumbers(SHEET)
      .filter(function (item) {
        return normalizeEmail_(item.record.EMAIL) === normalizedEmail;
      })[0];

    if (!match) {
      ValidationService.fail('Usuário não encontrado na aba CAD_USUARIOS.');
    }

    const salt = createSalt_();

    SheetRepository.updateFields(
      SHEET,
      match.rowNumber,
      {
        SENHA_TEMPORARIA: '',
        SENHA_HASH: hashPassword_(normalizedPassword, salt),
        SALT: salt,
        ULTIMA_ALTERACAO: new Date(),
      },
      { textFields: ['SENHA_HASH', 'SALT'] }
    );

    return {
      ok: true,
      email: normalizedEmail,
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
    handlePasswordEdit,
    installEditTrigger,
    setPassword,
  };
})();
