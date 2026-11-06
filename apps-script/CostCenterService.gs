/**
 * Responsáveis pelo custo e centros de custo (05/11/2026).
 *
 * Antes: "Responsável pelo custo" era fixo no código (CLIENTE/UNILOG). O formulário oferecia também
 * DIRETORIA e PROJETOS, que eram recusados. Agora vem de cadastro, com a marcação "exige centro de custo".
 *
 * Abas (criadas sem apagar nada):
 *   CAD_RESPONSAVEIS_CUSTO   RESPONSAVEL | EXIGE_CENTRO_CUSTO (SIM/NAO) | ATIVO
 *   CAD_CENTROS_CUSTO        CENTRO_CUSTO | DESCRICAO | ATIVO
 *   CAD_SUPERVISOR_CENTROS   SUPERVISOR | CENTRO_CUSTO | ATIVO   (vínculo: sugere centros ao escolher o supervisor)
 *
 * Compatibilidade no dia da publicação:
 *   - sem responsáveis cadastrados, valem os padrões CLIENTE (sem centro), UNILOG, DIRETORIA e PROJETOS (com centro);
 *   - sem centros cadastrados, qualquer código numérico é aceito (comportamento anterior).
 */
const CostCenterService = (() => {
  const SHEETS = Object.freeze({
    RESPONSIBLES: 'CAD_RESPONSAVEIS_CUSTO',
    CENTERS: 'CAD_CENTROS_CUSTO',
    LINKS: 'CAD_SUPERVISOR_CENTROS',
  });
  const HEADERS = Object.freeze({
    RESPONSIBLES: ['RESPONSAVEL', 'EXIGE_CENTRO_CUSTO', 'ATIVO'],
    CENTERS: ['CENTRO_CUSTO', 'DESCRICAO', 'ATIVO'],
    LINKS: ['SUPERVISOR', 'CENTRO_CUSTO', 'ATIVO'],
  });
  const DEFAULT_RESPONSIBLES = Object.freeze([
    { nome: 'CLIENTE', exigeCentroCusto: false },
    { nome: 'UNILOG', exigeCentroCusto: true },
    { nome: 'DIRETORIA', exigeCentroCusto: true },
    { nome: 'PROJETOS', exigeCentroCusto: true },
  ]);
  const ACTIONS = Object.freeze({
    LIST: 'LISTAR_CUSTOS',
    SAVE_CENTER: 'SALVAR_CENTRO_CUSTO',
    SAVE_RESPONSIBLE: 'SALVAR_RESPONSAVEL_CUSTO',
  });

  const text_ = (v) => String(v == null ? '' : v).trim();
  const upper_ = (v) => ValidationService.normalizeUpper(v);
  const truthy_ = (v) => ValidationService.isTruthy(v);

  function rows_(sheet) {
    const spreadsheet = SheetRepository.getSpreadsheet();
    if (!spreadsheet.getSheetByName(sheet)) return [];
    return SheetRepository.readObjectsWithRowNumbers(sheet);
  }

  function ensureSheet_(sheet, headers) {
    const spreadsheet = SheetRepository.getSpreadsheet();
    if (!spreadsheet.getSheetByName(sheet)) {
      const created = spreadsheet.insertSheet(sheet);
      created.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      SheetRepository.ensureColumns(sheet, headers);
    }
  }

  // ---------- leitura ----------
  function responsibles(includeInactive) {
    const stored = rows_(SHEETS.RESPONSIBLES).map((x) => ({
      nome: upper_(x.record.RESPONSAVEL),
      exigeCentroCusto: truthy_(x.record.EXIGE_CENTRO_CUSTO),
      ativo: truthy_(x.record.ATIVO),
    })).filter((r) => r.nome);
    if (!stored.length) return DEFAULT_RESPONSIBLES.map((r) => Object.assign({ ativo: true }, r));
    return includeInactive ? stored : stored.filter((r) => r.ativo);
  }

  function centers(includeInactive) {
    const list = rows_(SHEETS.CENTERS).map((x) => ({
      codigo: ValidationService.normalizeText(x.record.CENTRO_CUSTO).replace(/\D/g, ''),
      descricao: text_(x.record.DESCRICAO),
      ativo: truthy_(x.record.ATIVO),
    })).filter((c) => c.codigo);
    return includeInactive ? list : list.filter((c) => c.ativo);
  }

  // { SUPERVISOR: ['2309', '409'] } — só vínculos ativos.
  function links() {
    const map = {};
    rows_(SHEETS.LINKS).forEach((x) => {
      if (!truthy_(x.record.ATIVO)) return;
      const supervisor = upper_(x.record.SUPERVISOR);
      const code = text_(x.record.CENTRO_CUSTO).replace(/\D/g, '');
      if (!supervisor || !code) return;
      (map[supervisor] = map[supervisor] || []).push(code);
    });
    return map;
  }

  // ---------- validação (usada por formulário, tela aberta, criação e correção) ----------
  // options.keep = { responsavel, centroCusto } da solicitação existente (correção): valores que não
  // mudaram continuam aceitos mesmo que hoje estejam inativos ou fora do cadastro (registros antigos).
  function validate(responsibleValue, costCenterValue, options) {
    const keep = (options && options.keep) || {};
    const responsible = upper_(ValidationService.requiredText(responsibleValue, 'Responsável pelo custo'));
    let hit = responsibles(false).find((r) => r.nome === responsible);
    if (!hit && responsible === upper_(keep.responsavel)) {
      hit = responsibles(true).find((r) => r.nome === responsible) || { nome: responsible, exigeCentroCusto: Boolean(text_(keep.centroCusto)) };
    }
    if (!hit) ValidationService.fail('Responsável pelo custo inválido ou inativo: ' + responsible + '.');
    if (!hit.exigeCentroCusto) return { responsavel: hit.nome, centroCusto: '' };

    const code = ValidationService.digitsOnly(ValidationService.requiredText(costCenterValue, 'Centro de custo'), 'Centro de custo');
    const registered = centers(true);
    const unchanged = code === text_(keep.centroCusto).replace(/\D/g, '');
    if (registered.length && !unchanged) {
      const center = registered.find((c) => c.codigo === code);
      if (!center || !center.ativo) ValidationService.fail('Centro de custo não cadastrado ou inativo: ' + code + '.');
    }
    return { responsavel: hit.nome, centroCusto: code };
  }

  // ---------- administração (Cadastros) ----------
  function execute(payload) {
    const input = payload || {};
    const action = upper_(input.acao);
    if (action === ACTIONS.LIST) return listAdmin_();
    if (action === ACTIONS.SAVE_CENTER) return withLock_(() => saveCenter_(input));
    if (action === ACTIONS.SAVE_RESPONSIBLE) return withLock_(() => saveResponsible_(input));
    ValidationService.fail('Ação de centro de custo inválida.');
  }

  function listAdmin_() {
    const linkRows = rows_(SHEETS.LINKS).filter((x) => truthy_(x.record.ATIVO));
    return {
      responsaveis: responsibles(true),
      responsaveisPadrao: !rows_(SHEETS.RESPONSIBLES).length,
      centros: centers(true).map((c) => Object.assign({}, c, {
        supervisores: linkRows
          .filter((x) => text_(x.record.CENTRO_CUSTO).replace(/\D/g, '') === c.codigo)
          .map((x) => upper_(x.record.SUPERVISOR)),
      })),
    };
  }

  function saveCenter_(input) {
    const code = ValidationService.digitsOnly(ValidationService.requiredText(input.codigo, 'Código do centro de custo'), 'Código do centro de custo');
    const description = text_(input.descricao);
    const active = input.ativo !== false;
    const supervisors = Array.isArray(input.supervisores) ? input.supervisores : [];
    const canonicalSupervisors = supervisors.map((s) => text_(ValidationService.findActive(
      SheetRepository.readObjects('CAD_SUPERVISORES'), 'SUPERVISOR', s, 'Supervisor').SUPERVISOR));

    ensureSheet_(SHEETS.CENTERS, HEADERS.CENTERS);
    const existing = rows_(SHEETS.CENTERS).find((x) => text_(x.record.CENTRO_CUSTO).replace(/\D/g, '') === code);
    const values = { CENTRO_CUSTO: code, DESCRICAO: description, ATIVO: active ? 'SIM' : 'NAO' };
    if (existing) SheetRepository.updateFields(SHEETS.CENTERS, existing.rowNumber, values, { textFields: ['CENTRO_CUSTO'] });
    else SheetRepository.appendObject(SHEETS.CENTERS, values, { textFields: ['CENTRO_CUSTO'] });

    // Vínculos: deixa ativos exatamente os supervisores informados para este centro.
    ensureSheet_(SHEETS.LINKS, HEADERS.LINKS);
    const wanted = {};
    canonicalSupervisors.forEach((s) => { wanted[upper_(s)] = s; });
    rows_(SHEETS.LINKS).forEach((x) => {
      if (text_(x.record.CENTRO_CUSTO).replace(/\D/g, '') !== code) return;
      const key = upper_(x.record.SUPERVISOR);
      const shouldBeActive = Boolean(wanted[key]);
      if (truthy_(x.record.ATIVO) !== shouldBeActive) {
        SheetRepository.updateFields(SHEETS.LINKS, x.rowNumber, { ATIVO: shouldBeActive ? 'SIM' : 'NAO' });
      }
      delete wanted[key];
    });
    Object.keys(wanted).forEach((key) => {
      SheetRepository.appendObject(SHEETS.LINKS, { SUPERVISOR: wanted[key], CENTRO_CUSTO: code, ATIVO: 'SIM' }, { textFields: ['CENTRO_CUSTO'] });
    });
    return { centro: { codigo: code, descricao: description, ativo: active, supervisores: canonicalSupervisors.map(upper_) } };
  }

  function saveResponsible_(input) {
    const name = upper_(ValidationService.requiredText(input.nome, 'Responsável pelo custo'));
    const requires = input.exigeCentroCusto === true;
    const active = input.ativo !== false;
    ensureSheet_(SHEETS.RESPONSIBLES, HEADERS.RESPONSIBLES);
    // Primeira gravação: materializa os padrões para não "sumirem" ao cadastrar o primeiro responsável.
    if (!rows_(SHEETS.RESPONSIBLES).length) {
      DEFAULT_RESPONSIBLES.forEach((r) => SheetRepository.appendObject(SHEETS.RESPONSIBLES, {
        RESPONSAVEL: r.nome, EXIGE_CENTRO_CUSTO: r.exigeCentroCusto ? 'SIM' : 'NAO', ATIVO: 'SIM',
      }));
    }
    const existing = rows_(SHEETS.RESPONSIBLES).find((x) => upper_(x.record.RESPONSAVEL) === name);
    const values = { RESPONSAVEL: name, EXIGE_CENTRO_CUSTO: requires ? 'SIM' : 'NAO', ATIVO: active ? 'SIM' : 'NAO' };
    if (existing) SheetRepository.updateFields(SHEETS.RESPONSIBLES, existing.rowNumber, values);
    else SheetRepository.appendObject(SHEETS.RESPONSIBLES, values);
    if (!responsibles(false).length) ValidationService.fail('Mantenha ao menos um responsável pelo custo ativo.');
    return { responsavel: { nome: name, exigeCentroCusto: requires, ativo: active } };
  }

  function withLock_(fn) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) ValidationService.fail('Sistema ocupado. Tente novamente em alguns instantes.');
    try { return fn(); } finally { lock.releaseLock(); }
  }

  // Configuração inicial (opcional): cria as abas e cadastra os padrões e os centros do formulário atual.
  function setup(initialCenters) {
    return withLock_(() => {
      ensureSheet_(SHEETS.RESPONSIBLES, HEADERS.RESPONSIBLES);
      ensureSheet_(SHEETS.CENTERS, HEADERS.CENTERS);
      ensureSheet_(SHEETS.LINKS, HEADERS.LINKS);
      let responsiblesCreated = 0;
      let centersCreated = 0;
      if (!rows_(SHEETS.RESPONSIBLES).length) {
        DEFAULT_RESPONSIBLES.forEach((r) => {
          SheetRepository.appendObject(SHEETS.RESPONSIBLES, { RESPONSAVEL: r.nome, EXIGE_CENTRO_CUSTO: r.exigeCentroCusto ? 'SIM' : 'NAO', ATIVO: 'SIM' });
          responsiblesCreated += 1;
        });
      }
      const existing = {};
      centers(true).forEach((c) => { existing[c.codigo] = true; });
      (initialCenters || []).forEach((code) => {
        const clean = String(code).replace(/\D/g, '');
        if (!clean || existing[clean]) return;
        SheetRepository.appendObject(SHEETS.CENTERS, { CENTRO_CUSTO: clean, DESCRICAO: '', ATIVO: 'SIM' }, { textFields: ['CENTRO_CUSTO'] });
        existing[clean] = true;
        centersCreated += 1;
      });
      return { responsaveisCriados: responsiblesCreated, centrosCriados: centersCreated };
    });
  }

  return { ACTIONS, execute, validate, responsibles, centers, links, setup };
})();

// Executar uma vez no editor (opcional): cria as abas, os 4 responsáveis padrão e os centros do formulário atual.
function configurarCadastrosDeCusto() {
  const result = CostCenterService.setup(['409', '609', '209', '1009', '2309', '309', '709', '909', '200', '1309']);
  Logger.log(JSON.stringify(result));
  return result;
}
