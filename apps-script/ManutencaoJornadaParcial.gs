/**
 * Correção dos lançamentos de jornada parcial feitos com a regra antiga de 9 h (22/10/2026).
 *
 * A jornada paga passou a ser de 8 h (valor da hora = diária ÷ 8), igual à fatura do fornecedor.
 * Este arquivo recalcula as solicitações de mão de obra que têm exceção de jornada ativa:
 *   - VALOR_REGISTRADO de cada exceção (aba EXCECOES_JORNADA_MO);
 *   - VALOR_REAL da solicitação, quando o comparecimento já foi registrado.
 *
 * COMO USAR (no editor do Apps Script do Extra, DEPOIS de publicar a versão com a regra de 8 h):
 *   1. Selecione a função simularRecalculoJornadaParcial8h e clique em Executar.
 *      Ela NÃO altera nada: só mostra no "Registro de execução" o que seria corrigido.
 *   2. Confira a lista. Se estiver tudo certo, execute aplicarRecalculoJornadaParcial8h.
 *   3. Rodar de novo é seguro: o que já estiver correto é ignorado.
 *
 * Proteções:
 *   - Solicitações que já estão em um fechamento financeiro NÃO são alteradas (o valor já foi
 *     fechado/faturado); elas aparecem listadas para análise manual.
 *   - Cada solicitação alterada ganha um registro na AUDITORIA_SOLICITACOES (antes e depois).
 *   - Executa com bloqueio, para não concorrer com usos do sistema.
 */
function simularRecalculoJornadaParcial8h() {
  return recalcularJornadaParcial8h_(false);
}

function aplicarRecalculoJornadaParcial8h() {
  return recalcularJornadaParcial8h_(true);
}

function recalcularJornadaParcial8h_(aplicar) {
  const HORAS_PAGAS = PartialShiftService.FULL_SHIFT_HOURS;
  if (HORAS_PAGAS !== 8) {
    throw new Error('Publique primeiro a versão com jornada de 8 h (PartialShiftService.FULL_SHIFT_HOURS = 8).');
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Sistema ocupado. Tente novamente em alguns instantes.');

  try {
    const round2 = function (v) { return Math.round((Number(v) + Number.EPSILON) * 100) / 100; };
    const texto = function (v) { return String(v == null ? '' : v).trim(); };
    const ativo = function (v) { return ['SIM', 'TRUE', '1', 'S'].indexOf(texto(v).toUpperCase()) >= 0; };

    // Exceções ativas agrupadas por solicitação.
    const porSolicitacao = {};
    SheetRepository.readObjectsWithRowNumbers('EXCECOES_JORNADA_MO').forEach(function (item) {
      const r = item.record;
      if (!ativo(r.ATIVO)) return;
      const id = texto(r.ID_SOLICITACAO);
      if (!id) return;
      (porSolicitacao[id] = porSolicitacao[id] || []).push(item);
    });

    // Solicitações já incluídas em fechamento financeiro.
    const emFechamento = {};
    try {
      SheetRepository.readObjects('FECHAMENTO_SOLICITACOES').forEach(function (r) {
        const id = texto(r.ID_SOLICITACAO);
        if (id) emFechamento[id] = true;
      });
    } catch (e) {
      // aba ainda não existe: nenhuma solicitação fechada
    }

    const resumo = { avaliadas: 0, aCorrigir: 0, corrigidas: 0, diferencaTotal: 0, ignoradasEmFechamento: [], semPreco: [], linhas: [] };

    Object.keys(porSolicitacao).sort().forEach(function (id) {
      resumo.avaliadas += 1;
      const achada = SheetRepository.findRowByField('SOLICITACOES', 'ID_SOLICITACAO', id);
      if (!achada) return;
      const sol = achada.record;
      const preco = Number(sol.PRECO_UNITARIO_APLICADO);
      if (!Number.isFinite(preco) || preco <= 0) { resumo.semPreco.push(id); return; }

      const excecoes = porSolicitacao[id];
      const novasExcecoes = excecoes.map(function (item) {
        const horas = Math.min(Number(item.record.HORAS_TRABALHADAS), HORAS_PAGAS);
        return { item: item, antes: round2(item.record.VALOR_REGISTRADO), depois: round2(preco / HORAS_PAGAS * horas) };
      });

      const qtd = sol.QTD_COMPARECIDA === '' || sol.QTD_COMPARECIDA == null ? null : Number(sol.QTD_COMPARECIDA);
      const realAntes = sol.VALOR_REAL === '' || sol.VALOR_REAL == null ? null : round2(sol.VALOR_REAL);
      const realDepois = qtd == null ? null : round2((qtd - excecoes.length) * preco +
        novasExcecoes.reduce(function (t, x) { return t + x.depois; }, 0));

      const mudaExcecao = novasExcecoes.some(function (x) { return x.antes !== x.depois; });
      const mudaReal = realDepois != null && realAntes !== realDepois;
      if (!mudaExcecao && !mudaReal) return;

      if (emFechamento[id]) {
        resumo.ignoradasEmFechamento.push(id + ' (' + (realAntes == null ? '—' : realAntes) + ' → ' + (realDepois == null ? '—' : realDepois) + ')');
        return;
      }

      resumo.aCorrigir += 1;
      const diferenca = mudaReal ? round2(realDepois - (realAntes || 0)) : 0;
      resumo.diferencaTotal = round2(resumo.diferencaTotal + diferenca);
      resumo.linhas.push(id + ' | competência ' + texto(sol.COMPETENCIA) + ' | ' + excecoes.length + ' exceção(ões)' +
        ' | valor real ' + (realAntes == null ? '—' : realAntes) + ' → ' + (realDepois == null ? '(sem comparecimento)' : realDepois) +
        (mudaReal ? ' | diferença ' + diferenca : ''));

      if (!aplicar) return;

      novasExcecoes.forEach(function (x) {
        if (x.antes !== x.depois) SheetRepository.updateFields('EXCECOES_JORNADA_MO', x.item.rowNumber, { VALOR_REGISTRADO: x.depois });
      });
      if (mudaReal) SheetRepository.updateFields('SOLICITACOES', achada.rowNumber, { VALOR_REAL: realDepois });
      PartialShiftService.clearRowsCache(id);

      const agora = new Date();
      SheetRepository.appendObject('AUDITORIA_SOLICITACOES', {
        ID_AUDITORIA: 'JORNADA8H-' + Utilities.formatDate(agora, DateService.TIMEZONE, 'yyyyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
        ID_SOLICITACAO: id,
        DATA_ALTERACAO: agora,
        USUARIO_ADMINISTRATIVO: Session.getActiveUser().getEmail() || 'manutencao',
        MOTIVO_CORRECAO: 'RECALCULO_JORNADA_PARCIAL_8H',
        CAMPOS_ALTERADOS: (mudaReal ? 'VALOR_REAL, ' : '') + 'EXCECOES_JORNADA_MO.VALOR_REGISTRADO',
        ANTES_JSON: JSON.stringify({ VALOR_REAL: realAntes, VALOR_REGISTRADO: novasExcecoes.map(function (x) { return x.antes; }) }),
        DEPOIS_JSON: JSON.stringify({ VALOR_REAL: realDepois, VALOR_REGISTRADO: novasExcecoes.map(function (x) { return x.depois; }) }),
      }, { textFields: ['ID_AUDITORIA', 'ID_SOLICITACAO'] });
      resumo.corrigidas += 1;
    });

    if (aplicar && resumo.corrigidas) {
      try { DashboardCacheService.clear(); } catch (e) { /* cache é otimização */ }
      try { AdministrativeSolicitationCacheService.clear({ metadata: true }); } catch (e) { /* idem */ }
      try { if (typeof FinancialCloseoutCacheService !== 'undefined') FinancialCloseoutCacheService.clear(); } catch (e) { /* idem */ }
    }

    Logger.log((aplicar ? 'APLICADO' : 'SIMULAÇÃO (nada foi alterado)') + ' — jornada paga de ' + HORAS_PAGAS + ' h');
    Logger.log('Solicitações com exceção de jornada avaliadas: ' + resumo.avaliadas);
    Logger.log((aplicar ? 'Corrigidas: ' + resumo.corrigidas : 'A corrigir: ' + resumo.aCorrigir) + ' | diferença total no valor real: R$ ' + resumo.diferencaTotal.toFixed(2));
    resumo.linhas.forEach(function (l) { Logger.log('  ' + l); });
    if (resumo.ignoradasEmFechamento.length) {
      Logger.log('NÃO alteradas por já estarem em fechamento financeiro (analisar manualmente): ' + resumo.ignoradasEmFechamento.length);
      resumo.ignoradasEmFechamento.forEach(function (l) { Logger.log('  ' + l); });
    }
    if (resumo.semPreco.length) Logger.log('Sem preço unitário aplicado (verificar): ' + resumo.semPreco.join(', '));
    return resumo;
  } finally {
    lock.releaseLock();
  }
}
