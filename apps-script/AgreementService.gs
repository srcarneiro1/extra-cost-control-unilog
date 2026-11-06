/**
 * Acordos comerciais de mão de obra (05/11/2026).
 *
 * Preço negociado com um fornecedor para uma operação (e, opcionalmente, função, turno, tipo de dia
 * e supervisores específicos) durante uma vigência. Tem prioridade sobre a tabela PRECOS_MO, que
 * NÃO é alterada. Regras:
 *  - no máximo UM acordo se aplica a cada solicitação: o cadastro recusa acordos ativos que se
 *    sobreponham (mesmo fornecedor e operação, vigências que se cruzam e função/turno/tipo de dia/
 *    supervisores com interseção) — a escolha nunca depende da ordem das linhas;
 *  - acordo não é editado: para mudar preço ou condições, inativa-se e cria-se outro. O preço já
 *    gravado nas solicitações nunca é recalculado silenciosamente;
 *  - linhas da aba sem ID_ACORDO ou com STATUS diferente de ATIVO nunca são aplicadas
 *    (ex.: registros preliminares digitados à mão — aparecem como "pendente de revisão").
 */
const AgreementService = (() => {
  const SHEET = 'ACORDOS_MO';
  const HEADERS = [
    'ID_ACORDO', 'STATUS', 'FORNECEDOR', 'OPERACAO', 'FUNCAO', 'TURNO', 'TIPO_DIA', 'SUPERVISORES',
    'VIGENCIA_INICIO', 'VIGENCIA_FIM', 'PRECO_UNITARIO', 'QTD_REFERENCIA_DIA',
    'JUSTIFICATIVA', 'RESPONSAVEL_NEGOCIACAO', 'REFERENCIA_DOCUMENTO', 'FORMA_APLICACAO', 'NOME_PUBLICO',
    'CRIADO_EM', 'CRIADO_POR', 'ATUALIZADO_EM', 'ATUALIZADO_POR', 'MOTIVO_INATIVACAO', 'VERSAO',
  ];
  const ALL = 'TODOS';
  const ALL_ROLES = 'TODAS';
  const DAY_TYPES = ['UTIL', 'SABADO', 'DOMINGO_FERIADO'];
  // Forma de aplicação (07/11/2026): AUTOMATICA (vale para toda solicitação que se encaixe) ou
  // INDICADA (o solicitante indica e o Administrativo confirma na triagem; sem confirmação, vale a tabela).
  // Registros sem o campo são AUTOMATICA (comportamento anterior).
  const APPLY = Object.freeze({ AUTO: 'AUTOMATICA', INDICATED: 'INDICADA' });
  const ACTIONS = Object.freeze({ LIST: 'LISTAR_ACORDOS_MO', SAVE: 'SALVAR_ACORDO_MO', INACTIVATE: 'INATIVAR_ACORDO_MO' });

  let memo_ = null;

  function execute(payload) {
    const input = payload || {};
    const action = ValidationService.normalizeUpper(input.acao);
    if (action === ACTIONS.LIST) return list_();
    if (action === ACTIONS.SAVE) return withLock_(function () { return create_(input); });
    if (action === ACTIONS.INACTIVATE) return withLock_(function () { return inactivate_(input); });
    ValidationService.fail('Ação de acordo comercial inválida.');
  }

  // ---------- leitura ----------
  function rows_() {
    if (memo_) return memo_;
    SheetRepository.ensureColumns(SHEET, HEADERS);
    memo_ = SheetRepository.readObjectsWithRowNumbers(SHEET);
    return memo_;
  }

  function reset_() { memo_ = null; }

  function text_(v) { return String(v == null ? '' : v).trim(); }
  function upper_(v) { return ValidationService.normalizeUpper(v); }

  // Operações do acordo (07/11/2026): uma, várias ("OP1; OP2") ou TODAS. Registros antigos com uma
  // operação continuam válidos. Lista vazia = todas as operações.
  const ALL_OPERATIONS = 'TODAS';
  function operationsOf_(value) {
    const raw = text_(value);
    if (!raw || upper_(raw) === ALL_OPERATIONS) return [];
    return raw.split(/[;\n]+/).map(upper_).filter(Boolean);
  }

  function coversOperation_(r, operation) {
    const list = operationsOf_(r.OPERACAO);
    return !list.length || list.indexOf(upper_(operation)) >= 0;
  }

  function operationsLabel_(r) {
    const list = operationsOf_(r.OPERACAO);
    return list.length ? list.join(', ') : 'Todas as operações';
  }

  function supervisorsOf_(value) {
    const raw = text_(value);
    if (!raw || upper_(raw) === ALL) return [];
    return raw.split(/[;,\n]+/).map(upper_).filter(Boolean);
  }

  function iso_(value) {
    if (value === '' || value == null) return '';
    return DateService.toIsoDate(DateService.parseDateOnly(value));
  }

  function isValid_(r) {
    return Boolean(text_(r.ID_ACORDO)) && upper_(r.STATUS) === 'ATIVO' &&
      text_(r.FORNECEDOR) && text_(r.OPERACAO) && iso_(r.VIGENCIA_INICIO) && iso_(r.VIGENCIA_FIM) &&
      Number(r.PRECO_UNITARIO) > 0;
  }

  function map_(r) {
    const supervisors = supervisorsOf_(r.SUPERVISORES);
    const start = safeIso_(r.VIGENCIA_INICIO);
    const end = safeIso_(r.VIGENCIA_FIM);
    const today = DateService.toIsoDate(new Date());
    const status = upper_(r.STATUS);
    let situacao = 'PENDENTE';
    if (text_(r.ID_ACORDO) && status === 'INATIVO') situacao = 'INATIVO';
    else if (isValid_(r)) situacao = today < start ? 'FUTURO' : today > end ? 'ENCERRADO' : 'VIGENTE';
    return {
      id: text_(r.ID_ACORDO),
      status: status,
      situacao: situacao,
      fornecedor: text_(r.FORNECEDOR),
      operacao: text_(r.OPERACAO) ? operationsLabel_(r) : '',
      operacoes: operationsOf_(r.OPERACAO),
      todasOperacoes: Boolean(text_(r.OPERACAO)) && operationsOf_(r.OPERACAO).length === 0,
      funcao: text_(r.FUNCAO) || ALL_ROLES,
      turno: text_(r.TURNO) || ALL,
      tipoDia: text_(r.TIPO_DIA) || ALL,
      supervisores: supervisors,
      todosSupervisores: supervisors.length === 0,
      vigenciaInicio: start,
      vigenciaFim: end,
      precoUnitario: Number(r.PRECO_UNITARIO || 0),
      qtdReferenciaDia: r.QTD_REFERENCIA_DIA === '' || r.QTD_REFERENCIA_DIA == null ? null : Number(r.QTD_REFERENCIA_DIA),
      justificativa: text_(r.JUSTIFICATIVA),
      responsavelNegociacao: text_(r.RESPONSAVEL_NEGOCIACAO),
      referenciaDocumento: text_(r.REFERENCIA_DOCUMENTO),
      formaAplicacao: applyMode_(r),
      nomePublico: text_(r.NOME_PUBLICO),
      criadoEm: text_(r.CRIADO_EM),
      criadoPor: text_(r.CRIADO_POR),
      atualizadoEm: text_(r.ATUALIZADO_EM),
      atualizadoPor: text_(r.ATUALIZADO_POR),
      motivoInativacao: text_(r.MOTIVO_INATIVACAO),
      versao: Number(r.VERSAO || 0),
    };
  }

  function safeIso_(v) {
    try { return iso_(v); } catch (e) { return text_(v); }
  }

  function list_() {
    return { acordos: rows_().map(function (x) { return map_(x.record); }) };
  }

  function applyMode_(r) {
    return upper_(r.FORMA_APLICACAO) === APPLY.INDICATED ? APPLY.INDICATED : APPLY.AUTO;
  }

  // ---------- aplicação no preço (chamado pelo PricingService) ----------
  // ctx: { provider, operation, supervisor, role, shift, dayType, date, confirmedId }
  // Acordos INDICADA só entram quando confirmados (confirmedId = ID do acordo).
  function findApplicable(ctx) {
    const date = DateService.toIsoDate(DateService.parseDateOnly(ctx.date));
    const confirmedId = text_(ctx.confirmedId);
    const matches = rows_().map(function (x) { return x.record; }).filter(function (r) {
      if (!isValid_(r)) return false;
      if (applyMode_(r) === APPLY.INDICATED && text_(r.ID_ACORDO) !== confirmedId) return false;
      if (upper_(r.FORNECEDOR) !== upper_(ctx.provider)) return false;
      if (!coversOperation_(r, ctx.operation)) return false;
      const role = upper_(r.FUNCAO);
      if (role && role !== ALL_ROLES && role !== upper_(ctx.role)) return false;
      const shift = upper_(r.TURNO);
      if (shift && shift !== ALL && shift !== upper_(ctx.shift)) return false;
      const day = upper_(r.TIPO_DIA);
      if (day && day !== ALL && day !== upper_(ctx.dayType)) return false;
      const supervisors = supervisorsOf_(r.SUPERVISORES);
      if (supervisors.length && supervisors.indexOf(upper_(ctx.supervisor)) < 0) return false;
      return iso_(r.VIGENCIA_INICIO) <= date && date <= iso_(r.VIGENCIA_FIM);
    });
    if (matches.length > 1) {
      // Não deveria acontecer (o cadastro bloqueia sobreposição); nunca escolher arbitrariamente.
      ValidationService.fail('Mais de um acordo comercial se aplica a esta solicitação (' +
        matches.map(function (r) { return text_(r.ID_ACORDO); }).join(', ') + '). Inative o acordo duplicado em Cadastros.');
    }
    return matches.length ? { id: text_(matches[0].ID_ACORDO), price: Number(matches[0].PRECO_UNITARIO) } : null;
  }

  // Acordos INDICADA ativos (sem preço) para a tela de solicitação filtrar por operação, data e supervisor.
  function indicatedOptions() {
    return rows_().map(function (x) { return x.record; })
      .filter(function (r) { return isValid_(r) && applyMode_(r) === APPLY.INDICATED; })
      .map(function (r) {
        return {
          id: text_(r.ID_ACORDO),
          nome: text_(r.NOME_PUBLICO) || text_(r.ID_ACORDO),
          operacoes: operationsOf_(r.OPERACAO),
          vigenciaInicio: iso_(r.VIGENCIA_INICIO),
          vigenciaFim: iso_(r.VIGENCIA_FIM),
          supervisores: supervisorsOf_(r.SUPERVISORES),
        };
      });
  }

  // Valida a indicação feita na solicitação (acordo INDICADA, ativo, mesma operação, data na vigência
  // e supervisor coberto). Fornecedor, função e turno são conferidos na triagem.
  function validateIndication(id, operation, date, supervisor) {
    const wanted = text_(id);
    if (!wanted) return '';
    const iso = DateService.toIsoDate(DateService.parseDateOnly(date));
    const hit = indicatedOptions().find(function (a) { return a.id === wanted; });
    if (!hit || (hit.operacoes.length && hit.operacoes.indexOf(upper_(operation)) < 0) || iso < hit.vigenciaInicio || iso > hit.vigenciaFim ||
        (hit.supervisores.length && hit.supervisores.indexOf(upper_(supervisor)) < 0)) {
      ValidationService.fail('O acordo indicado não vale para esta operação, data ou supervisor.');
    }
    return hit.id;
  }

  // Resumo de um acordo (para a triagem mostrar o indicado).
  function summary(id) {
    const wanted = text_(id);
    if (!wanted) return null;
    const hit = rows_().find(function (x) { return text_(x.record.ID_ACORDO) === wanted; });
    if (!hit) return null;
    const r = hit.record;
    return { id: wanted, nome: text_(r.NOME_PUBLICO) || wanted, fornecedor: text_(r.FORNECEDOR), precoUnitario: Number(r.PRECO_UNITARIO || 0),
      vigenciaInicio: safeIso_(r.VIGENCIA_INICIO), vigenciaFim: safeIso_(r.VIGENCIA_FIM), ativo: upper_(r.STATUS) === 'ATIVO' };
  }

  // ---------- cadastro ----------
  function create_(input) {
    reset_();
    const author = requiredAuthor_(input);
    const provider = canonical_('CAD_FORNECEDORES', 'FORNECEDOR', input.fornecedor, 'Fornecedor');
    // Operações: selecionadas (uma ou várias) ou todas. Compatível com o campo antigo "operacao".
    const operationList = Array.isArray(input.operacoes) ? input.operacoes : (input.operacao ? [input.operacao] : []);
    const allOperations = input.todasOperacoes === true;
    const canonicalOperations = allOperations ? [] : unique_(operationList.map(function (o) { return canonical_('CAD_OPERACOES', 'OPERACAO', o, 'Operação'); }));
    if (!allOperations && !canonicalOperations.length) ValidationService.fail('Selecione ao menos uma operação ou marque "todas as operações".');
    const operation = allOperations ? ALL_OPERATIONS : canonicalOperations.join('; ');
    const roleInput = upper_(input.funcao || ALL_ROLES);
    const role = roleInput === ALL_ROLES ? ALL_ROLES : canonical_('CAD_FUNCOES', 'FUNCAO', input.funcao, 'Função');
    const shift = ValidationService.enumValue(input.turno || ALL, 'Turno', [ALL, 'DIURNO', 'NOTURNO']);
    const dayType = ValidationService.enumValue(input.tipoDia || ALL, 'Tipo de dia', [ALL].concat(DAY_TYPES));
    const supervisors = Array.isArray(input.supervisores) ? input.supervisores : [];
    const canonicalSupervisors = input.todosSupervisores === true || !supervisors.length
      ? []
      : unique_(supervisors.map(function (s) { return canonical_('CAD_SUPERVISORES', 'SUPERVISOR', s, 'Supervisor'); }));
    if (input.todosSupervisores !== true && !canonicalSupervisors.length) {
      ValidationService.fail('Selecione ao menos um supervisor ou marque "todos os supervisores".');
    }
    const start = iso_(ValidationService.requiredText(input.vigenciaInicio, 'Vigência inicial'));
    const end = iso_(ValidationService.requiredText(input.vigenciaFim, 'Vigência final'));
    if (end < start) ValidationService.fail('A vigência final não pode ser anterior à inicial.');
    const price = Number(input.precoUnitario);
    if (!Number.isFinite(price) || price <= 0) ValidationService.fail('Informe o preço unitário negociado (maior que zero).');
    const qtyRef = input.qtdReferenciaDia === '' || input.qtdReferenciaDia == null ? '' : ValidationService.positiveInteger(input.qtdReferenciaDia, 'Quantidade de referência por dia');
    const justification = ValidationService.requiredText(input.justificativa, 'Justificativa');
    const negotiator = ValidationService.requiredText(input.responsavelNegociacao, 'Responsável pela negociação');
    const document = text_(input.referenciaDocumento);
    const applyMode = ValidationService.enumValue(input.formaAplicacao || APPLY.AUTO, 'Forma de aplicação', [APPLY.AUTO, APPLY.INDICATED]);
    const publicName = text_(input.nomePublico).slice(0, 80);
    if (applyMode === APPLY.INDICATED && !publicName) ValidationService.fail('Informe o nome do acordo para o solicitante (ex.: "Fim de semana GoBeauty").');

    const candidate = {
      FORNECEDOR: provider, OPERACAO: operation, FUNCAO: role, TURNO: shift, TIPO_DIA: dayType,
      SUPERVISORES: canonicalSupervisors.length ? canonicalSupervisors.join('; ') : ALL,
      VIGENCIA_INICIO: start, VIGENCIA_FIM: end,
    };
    const conflicts = rows_().map(function (x) { return x.record; })
      .filter(function (r) { return isValid_(r) && overlaps_(r, candidate); })
      .map(function (r) { return text_(r.ID_ACORDO); });
    if (conflicts.length) {
      ValidationService.fail('Conflito com acordo ativo ' + conflicts.join(', ') +
        ': mesmo fornecedor e operação, vigências que se cruzam e condições sobrepostas. Inative o acordo existente ou ajuste as condições.');
    }

    const id = nextId_(start);
    const now = new Date();
    const record = Object.assign({}, candidate, {
      ID_ACORDO: id,
      STATUS: 'ATIVO',
      PRECO_UNITARIO: Math.round(price * 10000) / 10000,
      QTD_REFERENCIA_DIA: qtyRef,
      JUSTIFICATIVA: justification,
      RESPONSAVEL_NEGOCIACAO: negotiator,
      REFERENCIA_DOCUMENTO: document,
      FORMA_APLICACAO: applyMode,
      NOME_PUBLICO: publicName,
      CRIADO_EM: now,
      CRIADO_POR: author,
      ATUALIZADO_EM: now,
      ATUALIZADO_POR: author,
      MOTIVO_INATIVACAO: '',
      VERSAO: 1,
    });
    SheetRepository.appendObject(SHEET, record, { textFields: ['ID_ACORDO', 'VIGENCIA_INICIO', 'VIGENCIA_FIM'] });
    reset_();
    return { acordo: map_(record) };
  }

  function inactivate_(input) {
    reset_();
    const author = requiredAuthor_(input);
    const id = ValidationService.requiredText(input.id, 'Acordo');
    const reason = ValidationService.requiredText(input.motivo, 'Motivo da inativação');
    const hit = rows_().find(function (x) { return text_(x.record.ID_ACORDO) === id; });
    if (!hit) ValidationService.fail('Acordo não encontrado.');
    if (Number(hit.record.VERSAO || 0) !== Number(input.versao || 0)) {
      ValidationService.fail('O acordo foi alterado por outro usuário. Atualize a lista e tente novamente.');
    }
    if (upper_(hit.record.STATUS) === 'INATIVO') ValidationService.fail('Este acordo já está inativo.');
    const updates = {
      STATUS: 'INATIVO',
      MOTIVO_INATIVACAO: reason,
      ATUALIZADO_EM: new Date(),
      ATUALIZADO_POR: author,
      VERSAO: Number(hit.record.VERSAO || 0) + 1,
    };
    SheetRepository.updateFields(SHEET, hit.rowNumber, updates);
    reset_();
    return { acordo: map_(Object.assign({}, hit.record, updates)) };
  }

  // Duas condições se cruzam se forem iguais ou se uma delas for "todas".
  function intersects_(a, b, all) {
    const x = upper_(a) || all;
    const y = upper_(b) || all;
    return x === all || y === all || x === y;
  }

  function overlaps_(r, c) {
    if (upper_(r.FORNECEDOR) !== upper_(c.FORNECEDOR)) return false;
    // Operações se cruzam se uma das listas for "todas" ou se tiverem alguma em comum.
    const opsA = operationsOf_(r.OPERACAO);
    const opsB = operationsOf_(c.OPERACAO);
    if (opsA.length && opsB.length && !opsA.some(function (o) { return opsB.indexOf(o) >= 0; })) return false;
    if (!(iso_(r.VIGENCIA_INICIO) <= c.VIGENCIA_FIM && c.VIGENCIA_INICIO <= iso_(r.VIGENCIA_FIM))) return false;
    if (!intersects_(r.FUNCAO, c.FUNCAO, ALL_ROLES)) return false;
    if (!intersects_(r.TURNO, c.TURNO, ALL)) return false;
    if (!intersects_(r.TIPO_DIA, c.TIPO_DIA, ALL)) return false;
    const a = supervisorsOf_(r.SUPERVISORES);
    const b = supervisorsOf_(c.SUPERVISORES);
    if (!a.length || !b.length) return true;
    return a.some(function (s) { return b.indexOf(s) >= 0; });
  }

  function canonical_(sheet, field, value, label) {
    const row = ValidationService.findActive(SheetRepository.readObjects(sheet), field, ValidationService.requiredText(value, label), label);
    return text_(row[field]);
  }

  function unique_(list) {
    const seen = {};
    return list.filter(function (x) { const k = upper_(x); if (seen[k]) return false; seen[k] = true; return true; });
  }

  function nextId_(start) {
    const year = String(start).slice(0, 4);
    const prefix = 'AC-' + year + '-';
    const max = rows_().reduce(function (m, x) {
      const id = text_(x.record.ID_ACORDO);
      if (id.indexOf(prefix) !== 0) return m;
      const n = Number(id.slice(prefix.length));
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return prefix + String(max + 1).padStart(4, '0');
  }

  function requiredAuthor_(input) {
    const author = text_(input.usuarioAdministrativo);
    if (!author) ValidationService.fail('Usuário administrativo não identificado.');
    return author;
  }

  function withLock_(fn) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) ValidationService.fail('Sistema ocupado. Tente novamente em alguns instantes.');
    try { return fn(); } finally { lock.releaseLock(); }
  }

  return { ACTIONS, APPLY, execute, findApplicable, indicatedOptions, validateIndication, summary, reset: reset_ };
})();
