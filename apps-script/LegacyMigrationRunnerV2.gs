const LegacyMigrationRunnerV2 = (() => {
  const TARGET_ID = '18dpLKAFHQI3rHRgn1XzP0cAtzYzZsrU-r6FulFkHXvo';
  const BACKUP_ID = '1mD8T8CiErcqxs_kyaOeJdZUH1HElGddO9YMRY2ygBz0';
  const SOL_STAGE_ID = '1SKWG7dTm5N_AHcLYSP-Rrz8eJXqVi-wa_imz6DDoeYM';
  const SOL_STAGE_SHEET = 'TMP - MIGRACAO LEGADO SOLICITACOES TEXTO V2 2026-09-09';
  const EXC_STAGE_ID = '1rDoltMuJy3ExPbRzal_p4cmFz6nrJbL6iNGnkqHjwfA';
  const EXC_STAGE_SHEET = 'TMP - MIGRACAO LEGADO EXCECOES TEXTO 2026-09-09';

  const EXPECTED = Object.freeze({
    total: 3802,
    mo: 2446,
    lanches: 1356,
    noturno: 79,
    operador: 206,
    excecoes: 238,
    previsto: 3481374.00,
    real: 3192454.00,
  });

  const SOL_COLS = 36;
  const EXC_COLS = 10;
  const CHUNK = 500;
  const SOL_NUM = Object.freeze({2:1,9:1,18:1,19:1,22:1,24:1,25:1,26:1,28:1,29:1,30:1,31:1,32:1});
  const EXC_NUM = Object.freeze({3:1,6:1,7:1});

  function executar() {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) throw new Error('Migração já está em execução.');
    try {
      const sol = readStage_(SOL_STAGE_ID, SOL_STAGE_SHEET, SOL_COLS, SOL_NUM);
      const exc = readStage_(EXC_STAGE_ID, EXC_STAGE_SHEET, EXC_COLS, EXC_NUM);
      validateRows_(sol, exc);

      const ss = SpreadsheetApp.openById(TARGET_ID);
      const solSheet = requireSheet_(ss, 'SOLICITACOES');
      const excSheet = requireSheet_(ss, 'EXCECOES_JORNADA_MO');

      clearBelowHeader_(solSheet);
      clearBelowHeader_(excSheet);
      ensureRows_(solSheet, sol.length + 1);
      ensureRows_(excSheet, exc.length + 1);
      ensureCols_(solSheet, SOL_COLS);
      ensureCols_(excSheet, EXC_COLS);

      writeChunks_(solSheet, sol);
      writeChunks_(excSheet, exc);
      format_(solSheet, excSheet, sol.length, exc.length);
      SpreadsheetApp.flush();

      const result = validateTarget_(ss);
      Logger.log(JSON.stringify(result, null, 2));
      ss.toast('Migração concluída e validada.', 'Custos Extras', 10);
      return result;
    } finally {
      lock.releaseLock();
    }
  }

  function validar() {
    const result = validateTarget_(SpreadsheetApp.openById(TARGET_ID));
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }

  function readStage_(id, name, cols, numericMap) {
    const sh = SpreadsheetApp.openById(id).getSheetByName(name);
    if (!sh) throw new Error('Staging não encontrado: ' + name);
    const last = sh.getLastRow();
    if (!last) return [];
    return sh.getRange(1, 1, last, cols).getDisplayValues()
      .filter(function(row) { return row.some(function(v) { return String(v || '').trim() !== ''; }); })
      .map(function(row) {
        return row.map(function(v, i) {
          let s = String(v == null ? '' : v);
          if (s.charAt(0) === "'") s = s.slice(1);
          if (!numericMap[i]) return s;
          if (s === '') return '';
          const n = Number(s.replace(',', '.'));
          if (!Number.isFinite(n)) throw new Error('Número inválido em ' + name + ', coluna ' + (i + 1) + ': ' + s);
          return n;
        });
      });
  }

  function validateRows_(sol, exc) {
    if (sol.length !== EXPECTED.total) throw new Error('Total staging divergente: ' + sol.length);
    if (exc.length !== EXPECTED.excecoes) throw new Error('Exceções staging divergentes: ' + exc.length);

    const ids = {};
    const c = {mo:0,lanches:0,noturno:0,operador:0,previsto:0,real:0};
    sol.forEach(function(r) {
      const id = String(r[0] || '').trim();
      if (!id || ids[id]) throw new Error('ID ausente ou duplicado: ' + id);
      ids[id] = true;
      const type = String(r[1] || '').toUpperCase();
      if (type === 'MAO_DE_OBRA') c.mo++;
      if (type === 'ALIMENTACAO_BEBIDA') c.lanches++;
      if (String(r[17] || '').toUpperCase() === 'NOTURNO') c.noturno++;
      if (String(r[16] || '').toUpperCase() === 'OPERADOR DE EMPILHADEIRA') c.operador++;
      c.previsto += Number(r[31] || 0);
      c.real += Number(r[32] || 0);
    });
    exc.forEach(function(r) {
      if (!ids[String(r[1] || '').trim()]) throw new Error('Exceção sem solicitação: ' + r[1]);
    });
    assertCounts_(c);
  }

  function validateTarget_(ss) {
    const solSh = requireSheet_(ss, 'SOLICITACOES');
    const excSh = requireSheet_(ss, 'EXCECOES_JORNADA_MO');
    const total = Math.max(solSh.getLastRow() - 1, 0);
    const excTotal = Math.max(excSh.getLastRow() - 1, 0);
    if (total !== EXPECTED.total) throw new Error('SOLICITACOES esperado ' + EXPECTED.total + ', encontrado ' + total);
    if (excTotal !== EXPECTED.excecoes) throw new Error('EXCECOES esperado ' + EXPECTED.excecoes + ', encontrado ' + excTotal);

    const rows = solSh.getRange(2, 1, total, SOL_COLS).getValues();
    const c = {mo:0,lanches:0,noturno:0,operador:0,previsto:0,real:0};
    rows.forEach(function(r) {
      const type = String(r[1] || '').toUpperCase();
      if (type === 'MAO_DE_OBRA') c.mo++;
      if (type === 'ALIMENTACAO_BEBIDA') c.lanches++;
      if (String(r[17] || '').toUpperCase() === 'NOTURNO') c.noturno++;
      if (String(r[16] || '').toUpperCase() === 'OPERADOR DE EMPILHADEIRA') c.operador++;
      c.previsto += Number(r[31] || 0);
      c.real += Number(r[32] || 0);
    });
    assertCounts_(c);
    return {
      ok: true,
      backupId: BACKUP_ID,
      solicitacoes: total,
      maoDeObra: c.mo,
      lanches: c.lanches,
      noturnos: c.noturno,
      operadoresEmpilhadeira: c.operador,
      excecoesJornada: excTotal,
      valorPrevisto: money_(c.previsto),
      valorReal: money_(c.real),
    };
  }

  function assertCounts_(c) {
    if (c.mo !== EXPECTED.mo) throw new Error('MO divergente: ' + c.mo);
    if (c.lanches !== EXPECTED.lanches) throw new Error('Lanches divergente: ' + c.lanches);
    if (c.noturno !== EXPECTED.noturno) throw new Error('Noturnos divergente: ' + c.noturno);
    if (c.operador !== EXPECTED.operador) throw new Error('Operadores divergente: ' + c.operador);
    if (!eqMoney_(c.previsto, EXPECTED.previsto)) throw new Error('Previsto divergente: ' + money_(c.previsto));
    if (!eqMoney_(c.real, EXPECTED.real)) throw new Error('Real divergente: ' + money_(c.real));
  }

  function clearBelowHeader_(sh) {
    if (sh.getMaxRows() > 1) sh.getRange(2, 1, sh.getMaxRows() - 1, sh.getMaxColumns()).clearContent();
  }
  function ensureRows_(sh, required) {
    if (sh.getMaxRows() < required) sh.insertRowsAfter(sh.getMaxRows(), required - sh.getMaxRows());
  }
  function ensureCols_(sh, required) {
    if (sh.getMaxColumns() < required) sh.insertColumnsAfter(sh.getMaxColumns(), required - sh.getMaxColumns());
  }
  function writeChunks_(sh, rows) {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const part = rows.slice(i, i + CHUNK);
      sh.getRange(2 + i, 1, part.length, part[0].length).setValues(part);
    }
  }
  function format_(sol, exc, solN, excN) {
    sol.getRange(2,1,solN,1).setNumberFormat('@');
    sol.getRange(2,3,solN,1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    sol.getRange(2,6,solN,2).setNumberFormat('@');
    sol.getRange(2,10,solN,1).setNumberFormat('dd/MM/yyyy');
    sol.getRange(2,11,solN,1).setNumberFormat('@');
    sol.getRange(2,15,solN,1).setNumberFormat('@');
    [23,26,27,30,31,32,33].forEach(function(col){ sol.getRange(2,col,solN,1).setNumberFormat('R$ #,##0.00'); });
    exc.getRange(2,1,excN,2).setNumberFormat('@');
    exc.getRange(2,4,excN,1).setNumberFormat('0.00');
    exc.getRange(2,5,excN,1).setNumberFormat('@');
    exc.getRange(2,7,excN,1).setNumberFormat('R$ #,##0.00');
    exc.getRange(2,8,excN,1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }
  function requireSheet_(ss, name) {
    const sh = ss.getSheetByName(name);
    if (!sh) throw new Error('Aba não encontrada: ' + name);
    return sh;
  }
  function money_(v) { return Math.round((Number(v) + Number.EPSILON) * 100) / 100; }
  function eqMoney_(a,b) { return Math.abs(money_(a) - money_(b)) < 0.01; }

  return { executar, validar };
})();

function executarMigracaoLegado_20260909_V2() {
  return LegacyMigrationRunnerV2.executar();
}

function validarMigracaoLegado_20260909_V2() {
  return LegacyMigrationRunnerV2.validar();
}
