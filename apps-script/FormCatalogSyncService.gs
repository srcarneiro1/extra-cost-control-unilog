const FormCatalogSyncService = (() => {
  const PROPERTY_FORM_ID = 'FORM_ID';
  const PROPERTY_SPREADSHEET_ID = 'SPREADSHEET_ID';

  const SHEETS = Object.freeze({
    operacoes: 'CAD_OPERACOES',
    supervisores: 'CAD_SUPERVISORES',
    fornecedores: 'CAD_FORNECEDORES',
    atividades: 'CAD_ATIVIDADES',
    funcoes: 'CAD_FUNCOES',
    produtos: 'CAD_PRODUTOS',
    precosProdutos: 'PRECOS_PRODUTOS',
  });

  const QUESTIONS = Object.freeze({
    supervisor: 'Supervisor responsável',
    operacao: 'Operação',
    atividade: 'Atividade',
    funcao: 'Função',
    turno: 'Turno',
    alimentacao: 'Alimentação',
    bebida: 'Bebida',
  });

  const LEGACY_SHIFT_QUESTIONS = Object.freeze([
    'Turno — Auxiliar Operacional',
    'Turno — Operador de Empilhadeira',
  ]);

  const SHIFT_VALUES = Object.freeze(['DIURNO', 'NOTURNO']);

  const CATEGORIES = Object.freeze({
    FOOD: 'ALIMENTACAO',
    DRINK: 'BEBIDA',
  });

  const ACTIVITY_OTHER = 'OUTRO';
  const EDIT_TRIGGER_HANDLER = 'onCatalogEdit';
  const CLOCK_TRIGGER_HANDLER = 'scheduledFormCatalogSync';

  const RELEVANT_EDIT_SHEETS = Object.freeze({
    CAD_OPERACOES: true,
    CAD_SUPERVISORES: true,
    CAD_FORNECEDORES: true,
    CAD_ATIVIDADES: true,
    CAD_FUNCOES: true,
    CAD_PRODUTOS: true,
    PRECOS_PRODUTOS: true,
  });

  function sync() {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) {
      return {
        sincronizado: false,
        motivo: 'Sincronização já em execução.',
      };
    }

    try {
      const form = openForm_();
      const effectiveDate = DateService.parseDateOnly(new Date());

      const supervisors = activeNames_(SHEETS.supervisores, 'SUPERVISOR');
      const operations = activeNames_(SHEETS.operacoes, 'OPERACAO');
      const functions = activeNames_(SHEETS.funcoes, 'FUNCAO');
      const activities = activeNames_(SHEETS.atividades, 'ATIVIDADE')
        .filter(function (name) {
          return ValidationService.normalizeUpper(name) !== ACTIVITY_OTHER;
        });
      const eligibleProducts = eligibleProducts_(effectiveDate);

      validateChoices_(QUESTIONS.supervisor, supervisors);
      validateChoices_(QUESTIONS.operacao, operations);
      validateChoices_(QUESTIONS.funcao, functions);
      validateChoices_(QUESTIONS.atividade, activities);
      validateChoices_(QUESTIONS.alimentacao, eligibleProducts.food);
      validateChoices_(QUESTIONS.bebida, eligibleProducts.drink);

      setListChoices_(form, QUESTIONS.supervisor, supervisors);
      setListChoices_(form, QUESTIONS.operacao, operations);
      setChoiceQuestionValues_(form, QUESTIONS.funcao, functions, true);
      const shiftStructure = ensureGenericShiftQuestion_(form);
      setActivityChoices_(form, activities);
      setListChoices_(form, QUESTIONS.alimentacao, eligibleProducts.food);
      setListChoices_(form, QUESTIONS.bebida, eligibleProducts.drink);

      return {
        sincronizado: true,
        dataReferencia: DateService.toIsoDate(effectiveDate),
        estruturaTurno: shiftStructure,
        quantidades: {
          supervisores: supervisors.length,
          operacoes: operations.length,
          funcoes: functions.length,
          turnos: SHIFT_VALUES.length,
          atividades: activities.length,
          alimentacao: eligibleProducts.food.length,
          bebidas: eligibleProducts.drink.length,
        },
      };
    } finally {
      lock.releaseLock();
    }
  }

  function handleEdit(event) {
    if (!event || !event.range) {
      return null;
    }

    const sheetName = event.range.getSheet().getName();
    if (!RELEVANT_EDIT_SHEETS[sheetName]) {
      return null;
    }

    return sync();
  }

  function installTriggers() {
    const spreadsheet = openSpreadsheet_();

    ScriptApp.getProjectTriggers().forEach(function (trigger) {
      const handler = trigger.getHandlerFunction();
      if (handler === EDIT_TRIGGER_HANDLER || handler === CLOCK_TRIGGER_HANDLER) {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    ScriptApp
      .newTrigger(EDIT_TRIGGER_HANDLER)
      .forSpreadsheet(spreadsheet)
      .onEdit()
      .create();

    ScriptApp
      .newTrigger(CLOCK_TRIGGER_HANDLER)
      .timeBased()
      .everyHours(1)
      .create();

    return {
      instalado: true,
      gatilhos: [EDIT_TRIGGER_HANDLER, CLOCK_TRIGGER_HANDLER],
    };
  }

  function activeNames_(sheetName, fieldName) {
    const names = SheetRepository
      .readObjects(sheetName)
      .filter(function (row) {
        return ValidationService.isTruthy(row.ATIVO);
      })
      .map(function (row) {
        return ValidationService.normalizeText(row[fieldName]);
      })
      .filter(Boolean);

    return uniqueInOrder_(names);
  }

  function eligibleProducts_(effectiveDate) {
    const activeFoodProviders = {};

    SheetRepository
      .readObjects(SHEETS.fornecedores)
      .filter(function (row) {
        return ValidationService.isTruthy(row.ATIVO) &&
          ValidationService.isTruthy(row.ALIMENTACAO);
      })
      .forEach(function (row) {
        const provider = ValidationService.normalizeUpper(row.FORNECEDOR);
        if (provider) {
          activeFoodProviders[provider] = true;
        }
      });

    const activeProductRows = SheetRepository
      .readObjects(SHEETS.produtos)
      .filter(function (row) {
        return ValidationService.isTruthy(row.ATIVO);
      })
      .map(function (row) {
        return {
          nome: ValidationService.normalizeText(row.PRODUTO),
          categoria: ValidationService.normalizeUpper(row.CATEGORIA),
        };
      })
      .filter(function (item) {
        return Boolean(item.nome) &&
          (item.categoria === CATEGORIES.FOOD || item.categoria === CATEGORIES.DRINK);
      });

    const activeProducts = {};
    activeProductRows.forEach(function (item) {
      activeProducts[ValidationService.normalizeUpper(item.nome)] = item;
    });

    const eligibleNames = {};

    SheetRepository
      .readObjects(SHEETS.precosProdutos)
      .filter(function (row) {
        if (!ValidationService.isTruthy(row.ATIVO)) return false;

        const provider = ValidationService.normalizeUpper(row.FORNECEDOR);
        const product = ValidationService.normalizeUpper(row.PRODUTO);

        return Boolean(activeFoodProviders[provider]) &&
          Boolean(activeProducts[product]) &&
          isWithinValidity_(effectiveDate, row.VIGENCIA_INICIO, row.VIGENCIA_FIM);
      })
      .forEach(function (row) {
        const product = ValidationService.normalizeUpper(row.PRODUTO);
        eligibleNames[product] = true;
      });

    const food = [];
    const drink = [];

    activeProductRows.forEach(function (item) {
      const normalizedName = ValidationService.normalizeUpper(item.nome);
      if (!eligibleNames[normalizedName]) return;

      if (item.categoria === CATEGORIES.FOOD) {
        food.push(item.nome);
      } else if (item.categoria === CATEGORIES.DRINK) {
        drink.push(item.nome);
      }
    });

    return {
      food: uniqueInOrder_(food),
      drink: uniqueInOrder_(drink),
    };
  }

  function isWithinValidity_(date, startValue, endValue) {
    if (!startValue) return false;

    const start = DateService.parseDateOnly(startValue);
    if (date.getTime() < start.getTime()) return false;

    if (!endValue) return true;

    const end = DateService.parseDateOnly(endValue);
    return date.getTime() <= end.getTime();
  }

  function setListChoices_(form, title, values) {
    const item = findSingleItem_(form, title, FormApp.ItemType.LIST);
    item.asListItem().setChoiceValues(values);
  }

  function setActivityChoices_(form, values) {
    const item = findSingleItem_(form, QUESTIONS.atividade, FormApp.ItemType.MULTIPLE_CHOICE);
    item
      .asMultipleChoiceItem()
      .setChoiceValues(values)
      .showOtherOption(true);
  }

  function setChoiceQuestionValues_(form, title, values, required) {
    const item = findSingleChoiceItem_(form, title);
    setChoiceValuesOnItem_(item, values, required);
    return item;
  }

  function setChoiceValuesOnItem_(item, values, required) {
    if (item.getType() === FormApp.ItemType.LIST) {
      item.asListItem().setChoiceValues(values).setRequired(required !== false);
      return;
    }

    if (item.getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
      item.asMultipleChoiceItem().setChoiceValues(values).setRequired(required !== false);
      return;
    }

    throw new Error(
      'A pergunta "' + item.getTitle() + '" precisa ser lista ou múltipla escolha para sincronização.'
    );
  }

  function ensureGenericShiftQuestion_(form) {
    const genericMatches = findItemsByTitle_(form, QUESTIONS.turno);
    if (genericMatches.length > 1) {
      throw new Error(
        'Esperada no máximo 1 pergunta com o título "' + QUESTIONS.turno + '", mas foram encontradas ' + genericMatches.length + '.'
      );
    }

    let shiftItem = genericMatches.length === 1 ? genericMatches[0] : null;
    let migrated = false;

    if (!shiftItem) {
      const legacyItems = [];
      LEGACY_SHIFT_QUESTIONS.forEach(function (title) {
        findItemsByTitle_(form, title).forEach(function (item) {
          legacyItems.push(item);
        });
      });

      if (legacyItems.length) {
        shiftItem = legacyItems[0];
        if (
          shiftItem.getType() !== FormApp.ItemType.LIST &&
          shiftItem.getType() !== FormApp.ItemType.MULTIPLE_CHOICE
        ) {
          throw new Error('O campo de turno legado está com tipo incompatível para migração automática.');
        }
        shiftItem.setTitle(QUESTIONS.turno);
        migrated = true;
      } else {
        shiftItem = form
          .addListItem()
          .setTitle(QUESTIONS.turno)
          .setRequired(true)
          .setChoiceValues(SHIFT_VALUES.slice());
        migrated = true;
      }
    }

    setChoiceValuesOnItem_(shiftItem, SHIFT_VALUES.slice(), true);

    const roleItem = findSingleChoiceItem_(form, QUESTIONS.funcao);
    moveItemImmediatelyAfter_(form, shiftItem, roleItem);

    const removedLegacy = removeLegacyShiftQuestions_(form);
    const removedEmptySections = removeEmptyPageBreaks_(form);

    return {
      pergunta: QUESTIONS.turno,
      opcoes: SHIFT_VALUES.slice(),
      migrada: migrated,
      perguntasLegadasRemovidas: removedLegacy,
      secoesVaziasRemovidas: removedEmptySections,
    };
  }

  function moveItemImmediatelyAfter_(form, item, referenceItem) {
    const itemIndex = item.getIndex();
    const referenceIndex = referenceItem.getIndex();
    let targetIndex = referenceIndex + 1;

    if (itemIndex === targetIndex) return;
    if (itemIndex < referenceIndex) targetIndex = referenceIndex;

    form.moveItem(itemIndex, targetIndex);
  }

  function removeLegacyShiftQuestions_(form) {
    let removed = 0;

    LEGACY_SHIFT_QUESTIONS.forEach(function (title) {
      const items = findItemsByTitle_(form, title);
      items.slice().reverse().forEach(function (item) {
        form.deleteItem(item);
        removed += 1;
      });
    });

    return removed;
  }

  function removeEmptyPageBreaks_(form) {
    let removed = 0;
    let changed = true;

    while (changed) {
      changed = false;
      const items = form.getItems();

      for (let index = items.length - 1; index >= 0; index -= 1) {
        if (items[index].getType() !== FormApp.ItemType.PAGE_BREAK) continue;

        const nextItem = items[index + 1];
        if (!nextItem || nextItem.getType() === FormApp.ItemType.PAGE_BREAK) {
          form.deleteItem(items[index]);
          removed += 1;
          changed = true;
          break;
        }
      }
    }

    return removed;
  }

  function findSingleChoiceItem_(form, title) {
    const matches = findItemsByTitle_(form, title);

    if (matches.length !== 1) {
      throw new Error(
        'Esperada exatamente 1 pergunta com o título "' + title + '", mas foram encontradas ' + matches.length + '.'
      );
    }

    const type = matches[0].getType();
    if (type !== FormApp.ItemType.LIST && type !== FormApp.ItemType.MULTIPLE_CHOICE) {
      throw new Error(
        'A pergunta "' + title + '" precisa ser lista ou múltipla escolha para sincronização.'
      );
    }

    return matches[0];
  }

  function findItemsByTitle_(form, title) {
    const targetTitle = normalizeTitle_(title);
    return form.getItems().filter(function (item) {
      return normalizeTitle_(item.getTitle()) === targetTitle;
    });
  }

  function findSingleItem_(form, title, expectedType) {
    const matches = findItemsByTitle_(form, title);

    if (matches.length !== 1) {
      throw new Error(
        'Esperada exatamente 1 pergunta com o título "' + title + '", mas foram encontradas ' + matches.length + '.'
      );
    }

    if (matches[0].getType() !== expectedType) {
      throw new Error(
        'A pergunta "' + title + '" está com tipo incompatível para sincronização.'
      );
    }

    return matches[0];
  }

  function validateChoices_(title, values) {
    if (!Array.isArray(values) || !values.length) {
      throw new Error(
        'Nenhuma opção elegível encontrada para "' + title + '". O formulário não foi alterado.'
      );
    }
  }

  function uniqueInOrder_(values) {
    const seen = {};

    return values.filter(function (value) {
      const normalized = ValidationService.normalizeUpper(value);
      if (!normalized || seen[normalized]) return false;
      seen[normalized] = true;
      return true;
    });
  }

  function normalizeTitle_(value) {
    return ValidationService.normalizeText(value);
  }

  function openForm_() {
    const formId = PropertiesService
      .getScriptProperties()
      .getProperty(PROPERTY_FORM_ID);

    if (!formId) {
      throw new Error(
        'Propriedade FORM_ID não configurada. Use o ID da URL de edição do Google Forms (/forms/d/<ID>/edit), não o identificador do link público /d/e/... .'
      );
    }

    return FormApp.openById(formId);
  }

  function openSpreadsheet_() {
    const spreadsheetId = PropertiesService
      .getScriptProperties()
      .getProperty(PROPERTY_SPREADSHEET_ID);

    if (!spreadsheetId) {
      throw new Error('Propriedade SPREADSHEET_ID não configurada no Apps Script.');
    }

    return SpreadsheetApp.openById(spreadsheetId);
  }

  return {
    sync,
    handleEdit,
    installTriggers,
  };
})();

function syncFormCatalogs() {
  return FormCatalogSyncService.sync();
}

function onCatalogEdit(event) {
  return FormCatalogSyncService.handleEdit(event);
}

function scheduledFormCatalogSync() {
  return FormCatalogSyncService.sync();
}

function installFormCatalogSyncTriggers() {
  return FormCatalogSyncService.installTriggers();
}
