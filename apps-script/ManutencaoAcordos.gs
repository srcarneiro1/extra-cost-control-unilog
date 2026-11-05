/**
 * Aplicação de acordos comerciais às solicitações JÁ EXISTENTES (05/11/2026).
 *
 * O preço de acordo vale automaticamente para solicitações criadas, triadas ou corrigidas depois
 * do cadastro do acordo. Esta rotina serve para as que já existiam antes (ex.: GoBeauty 06 a 09/11).
 *
 * COMO USAR (no editor do Apps Script do Extra, depois de publicar a versão com acordos e de
 * cadastrar o acordo em Cadastros → Acordos comerciais):
 *   1. Execute simularAplicacaoAcordos — NÃO altera nada; o "Registro de execução" lista o que mudaria.
 *   2. Confira. Se estiver certo, execute aplicarAcordosSolicitacoesExistentes.
 *   3. Rodar de novo é seguro: o que já estiver com o preço do acordo é ignorado.
 *
 * Proteções:
 *   - só mão de obra com fornecedor e preço já aplicados (triadas);
 *   - NÃO altera solicitações que já estão em fechamento financeiro (listadas para análise);
 *   - NÃO altera solicitações excluídas/inativas;
 *   - VALOR_PREVISTO = quantidade solicitada × preço do acordo; VALOR_REAL recalculado só se o
 *     comparecimento já foi registrado (com a regra de jornada parcial vigente);
 *   - auditoria ACORDO_COMERCIAL em AUDITORIA_SOLICITACOES (antes e depois);
 *   - executa com bloqueio e limpa os caches ao final.
 */
function simularAplicacaoAcordos() {
  return aplicarAcordos_(false);
}

function aplicarAcordosSolicitacoesExistentes() {
  return aplicarAcordos_(true);
}

function aplicarAcordos_(aplicar) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Sistema ocupado. Tente novamente em alguns instantes.');
  try {
    const round2 = function (v) { return Math.round((Number(v) + Number.EPSILON) * 100) / 100; };
    const texto = function (v) { return String(v == null ? '' : v).trim(); };
    const upper = function (v) { return ValidationService.normalizeUpper(v); };

    PricingService.ensureOriginColumns();
    AgreementService.reset();

    const emFechamento = {};
    try {
      SheetRepository.readObjects('FECHAMENTO_SOLICITACOES').forEach(function (r) {
        const id = texto(r.ID_SOLICITACAO);
        if (id) emFechamento[id] = true;
      });
    } catch (e) {
      // aba ainda não existe: nenhuma solicitação fechada
    }

    const resumo = { avaliadas: 0, aAplicar: 0, aplicadas: 0, diferencaPrevisto: 0, diferencaReal: 0, emFechamento: [], linhas: [] };

    SheetRepository.readObjectsWithRowNumbers('SOLICITACOES').forEach(function (item) {
      const r = item.record;
      if (upper(r.TIPO_SOLICITACAO) !== 'MAO_DE_OBRA') return;
      if (['NAO', 'FALSE', '0'].indexOf(upper(r.ATIVO)) >= 0) return;
      if (!texto(r.FORNECEDOR) || r.PRECO_UNITARIO_APLICADO === '' || r.PRECO_UNITARIO_APLICADO == null) return;

      resumo.avaliadas += 1;
      let acordo;
      try {
        const dayType = PricingService.classifyDay(DateService.parseDateOnly(r.DATA_OPERACIONAL));
        acordo = AgreementService.findApplicable({
          provider: r.FORNECEDOR, operation: r.OPERACAO, supervisor: r.SUPERVISOR,
          role: r.FUNCAO, shift: r.TURNO, dayType: dayType, date: r.DATA_OPERACIONAL,
        });
      } catch (e) {
        resumo.linhas.push(texto(r.ID_SOLICITACAO) + ' | ERRO: ' + e.message);
        return;
      }
      if (!acordo) return;

      const precoAtual = Number(r.PRECO_UNITARIO_APLICADO);
      if (upper(r.ORIGEM_PRECO) === 'ACORDO' && texto(r.ID_ACORDO_APLICADO) === acordo.id && precoAtual === acordo.price) return;

      const id = texto(r.ID_SOLICITACAO);
      if (emFechamento[id]) {
        resumo.emFechamento.push(id + ' (preço ' + precoAtual + ' → ' + acordo.price + ')');
        return;
      }

      const qtdSolicitada = Number(r.QTD_SOLICITADA || 0);
      const previstoAntes = round2(r.VALOR_PREVISTO);
      const previstoDepois = round2(qtdSolicitada * acordo.price);
      const temComparecimento = r.QTD_COMPARECIDA !== '' && r.QTD_COMPARECIDA != null;
      const realAntes = temComparecimento ? round2(r.VALOR_REAL) : '';
      const realDepois = temComparecimento ? round2(PartialShiftService.calculateRealValue(id, Number(r.QTD_COMPARECIDA), acordo.price)) : '';

      resumo.aAplicar += 1;
      resumo.diferencaPrevisto = round2(resumo.diferencaPrevisto + previstoDepois - previstoAntes);
      if (temComparecimento) resumo.diferencaReal = round2(resumo.diferencaReal + realDepois - realAntes);
      resumo.linhas.push(id + ' | ' + texto(r.DATA_OPERACIONAL) + ' | ' + texto(r.SUPERVISOR) + ' | preço ' + precoAtual + ' → ' + acordo.price +
        ' (' + acordo.id + ') | previsto ' + previstoAntes + ' → ' + previstoDepois + (temComparecimento ? ' | real ' + realAntes + ' → ' + realDepois : ''));

      if (!aplicar) return;
      const updates = {
        PRECO_UNITARIO_APLICADO: acordo.price,
        VALOR_PREVISTO: previstoDepois,
        ORIGEM_PRECO: 'ACORDO',
        ID_ACORDO_APLICADO: acordo.id,
      };
      if (temComparecimento) updates.VALOR_REAL = realDepois;
      SheetRepository.updateFields('SOLICITACOES', item.rowNumber, updates);

      const agora = new Date();
      SheetRepository.appendObject('AUDITORIA_SOLICITACOES', {
        ID_AUDITORIA: 'ACORDO-' + Utilities.formatDate(agora, DateService.TIMEZONE, 'yyyyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
        ID_SOLICITACAO: id,
        DATA_ALTERACAO: agora,
        USUARIO_ADMINISTRATIVO: Session.getActiveUser().getEmail() || 'manutencao',
        MOTIVO_CORRECAO: 'ACORDO_COMERCIAL ' + acordo.id,
        CAMPOS_ALTERADOS: Object.keys(updates).join(', '),
        ANTES_JSON: JSON.stringify({ PRECO_UNITARIO_APLICADO: precoAtual, VALOR_PREVISTO: previstoAntes, VALOR_REAL: realAntes, ORIGEM_PRECO: texto(r.ORIGEM_PRECO), ID_ACORDO_APLICADO: texto(r.ID_ACORDO_APLICADO) }),
        DEPOIS_JSON: JSON.stringify(updates),
      }, { textFields: ['ID_AUDITORIA', 'ID_SOLICITACAO'] });
      resumo.aplicadas += 1;
    });

    if (aplicar && resumo.aplicadas) {
      try { DashboardCacheService.clear(); } catch (e) { /* cache é otimização */ }
      try { AdministrativeSolicitationCacheService.clear({ metadata: true }); } catch (e) { /* idem */ }
      try { FinancialCloseoutCacheService.clear(); } catch (e) { /* idem */ }
    }

    Logger.log((aplicar ? 'APLICADO' : 'SIMULAÇÃO (nada foi alterado)') + ' — acordos comerciais em solicitações existentes');
    Logger.log('Solicitações de mão de obra triadas avaliadas: ' + resumo.avaliadas);
    Logger.log((aplicar ? 'Aplicadas: ' + resumo.aplicadas : 'A aplicar: ' + resumo.aAplicar) +
      ' | diferença no previsto: R$ ' + resumo.diferencaPrevisto.toFixed(2) + ' | no realizado: R$ ' + resumo.diferencaReal.toFixed(2));
    resumo.linhas.forEach(function (l) { Logger.log('  ' + l); });
    if (resumo.emFechamento.length) {
      Logger.log('NÃO alteradas por já estarem em fechamento financeiro (analisar manualmente): ' + resumo.emFechamento.length);
      resumo.emFechamento.forEach(function (l) { Logger.log('  ' + l); });
    }
    return resumo;
  } finally {
    lock.releaseLock();
  }
}
