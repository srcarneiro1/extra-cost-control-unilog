/**
 * Conciliação entre o Google Forms operacional e a aba SOLICITACOES (05/11/2026).
 *
 * Origem: a resposta do Allan (05/11, 18:25) falhou no gatilho por bloqueio ocupado e se perdeu
 * sem registro. Estas funções encontram e recuperam respostas que não viraram solicitação,
 * SEM reenviar o formulário e SEM duplicar protocolos (o ID da resposta é checado dentro do bloqueio).
 *
 * Executar no editor do Apps Script, nesta ordem:
 *   1. diagnosticarIntegracaoFormulario  — só leitura: formulário, destino, gatilho e pendências.
 *   2. simularConciliacaoFormulario      — só leitura: valida cada pendente e mostra o que seria criado.
 *   3. conciliarRespostasFormulario      — cria as solicitações pendentes válidas (máx. 50 por execução).
 * Opcional (recomendado): instalarConciliacaoAutomaticaFormulario — a cada 15 min recupera sozinho
 * respostas que falharam por motivo temporário. Remove com removerConciliacaoAutomaticaFormulario.
 *
 * Os resultados aparecem no "Registro de execução" e cada tentativa fica em LOG_INTEGRACAO_FORMS.
 */
const FormReconciliationService = (() => {
  const LOOKBACK_DAYS = 60;
  const MAX_PER_RUN = 50;
  const AUTO_HANDLER = 'conciliarRespostasFormularioAutomatico';

  function since_() {
    const date = new Date();
    date.setDate(date.getDate() - LOOKBACK_DAYS);
    return date;
  }

  // Respostas dos últimos 60 dias que ainda não têm solicitação (ordem: mais antiga primeiro).
  function pending_() {
    const form = FormResponseNormalizerService.openForm();
    const responses = form.getResponses(since_());
    const index = FormResponseNormalizerService.originIndex();
    const pending = responses.filter(function (response) { return !index[String(response.getId())]; });
    return { form: form, total: responses.length, pending: pending };
  }

  function stamp_(response) {
    try {
      return Utilities.formatDate(response.getTimestamp(), DateService.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
    } catch (e) {
      return '?';
    }
  }

  function diagnose() {
    const lines = [];
    const props = PropertiesService.getScriptProperties();
    const formId = props.getProperty(FormResponseNormalizerService.PROPERTY_FORM_ID) || '';
    lines.push('FORM_ID configurado: ' + (formId ? 'sim (' + FormResponseNormalizerService.maskId(formId) + ')' : 'NÃO'));

    const form = FormResponseNormalizerService.openForm();
    lines.push('Formulário: "' + form.getTitle() + '" | aceitando respostas: ' + (form.isAcceptingResponses() ? 'sim' : 'NÃO'));
    let destination = '';
    try { destination = form.getDestinationId(); } catch (e) { destination = ''; }
    const spreadsheetId = SheetRepository.getSpreadsheet().getId();
    lines.push('Destino das respostas = planilha do Extra: ' + (destination === spreadsheetId ? 'sim' : 'NÃO (destino ' + FormResponseNormalizerService.maskId(destination) + ')'));

    const triggers = ScriptApp.getProjectTriggers().filter(function (t) {
      return t.getHandlerFunction() === FormResponseNormalizerService.TRIGGER_HANDLER;
    });
    lines.push('Gatilhos "' + FormResponseNormalizerService.TRIGGER_HANDLER + '" deste usuário: ' + triggers.length +
      (triggers.length > 1 ? ' (ATENÇÃO: mais de um — cada envio seria processado em dobro; a duplicidade é barrada, mas remova os extras)' : ''));
    triggers.forEach(function (t) {
      const source = String(t.getTriggerSourceId() || '');
      lines.push('  - evento ' + t.getEventType() + ' | origem ' + FormResponseNormalizerService.maskId(source) + (source === formId ? ' (= FORM_ID)' : ' (DIFERENTE do FORM_ID)'));
    });
    if (!triggers.length) lines.push('  (gatilhos de outros usuários não aparecem aqui; confira em Acionadores no menu lateral)');
    const auto = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === AUTO_HANDLER; }).length;
    lines.push('Conciliação automática instalada: ' + (auto ? 'sim' : 'não'));

    const p = pending_();
    lines.push('Respostas dos últimos ' + LOOKBACK_DAYS + ' dias: ' + p.total + ' | sem solicitação: ' + p.pending.length);
    p.pending.slice(0, 30).forEach(function (r) {
      lines.push('  - ' + stamp_(r) + ' | resposta ' + FormResponseNormalizerService.maskId(r.getId()));
    });
    if (p.pending.length > 30) lines.push('  … e mais ' + (p.pending.length - 30));
    lines.forEach(function (l) { Logger.log(l); });
    return { linhas: lines, pendentes: p.pending.length };
  }

  function simulate() {
    const p = pending_();
    const report = { pendentes: p.pending.length, validas: 0, invalidas: 0, linhas: [] };
    p.pending.forEach(function (response) {
      try {
        const built = FormResponseNormalizerService.buildRecord(response);
        report.validas += 1;
        const r = built.record;
        const detail = r.TIPO_SOLICITACAO === 'MAO_DE_OBRA'
          ? r.FUNCAO + ' × ' + r.QTD_SOLICITADA
          : [r.PRODUTO_ALIMENTACAO && r.QTD_ALIMENTACAO + ' ' + r.PRODUTO_ALIMENTACAO, r.PRODUTO_BEBIDA && r.QTD_BEBIDA + ' ' + r.PRODUTO_BEBIDA].filter(Boolean).join(' + ');
        report.linhas.push('OK      | ' + stamp_(response) + ' | ' + r.TIPO_SOLICITACAO + ' | ' + r.OPERACAO + ' | ' + r.SUPERVISOR + ' | ' + r.DATA_OPERACIONAL + ' | ' + detail +
          (built.notes && built.notes.length ? ' | OBS.: ' + built.notes.join(' ') : ''));
      } catch (error) {
        report.invalidas += 1;
        report.linhas.push('INVÁLIDA | ' + stamp_(response) + ' | ' + error.message);
      }
    });
    Logger.log('SIMULAÇÃO (nada foi alterado) — pendentes: ' + report.pendentes + ' | seriam criadas: ' + report.validas + ' | inválidas: ' + report.invalidas);
    report.linhas.forEach(function (l) { Logger.log('  ' + l); });
    return report;
  }

  // IDs de respostas já registradas como inválidas (dado do formulário ou cadastro). A conciliação
  // automática não insiste nelas a cada 15 min; a manual tenta de novo (ex.: depois de corrigir o cadastro).
  function invalidIds_() {
    const ids = {};
    try {
      const sheet = SheetRepository.getSpreadsheet().getSheetByName('LOG_INTEGRACAO_FORMS');
      if (!sheet || sheet.getLastRow() < 2) return ids;
      const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
      const idCol = values[0].indexOf('ID_RESPOSTA');
      const resultCol = values[0].indexOf('RESULTADO');
      values.slice(1).forEach(function (row) {
        if (row[resultCol] === 'ERRO_VALIDACAO') ids[String(row[idCol])] = true;
      });
    } catch (e) {
      // sem registro: tenta todas
    }
    return ids;
  }

  function reconcile(execution) {
    const p = pending_();
    const skip = execution === 'CONCILIACAO_AUTOMATICA' ? invalidIds_() : {};
    const candidates = p.pending.filter(function (r) { return !skip[String(r.getId())]; });
    const report = { pendentes: p.pending.length, ignoradasInvalidas: p.pending.length - candidates.length, criadas: 0, duplicadas: 0, erros: 0, linhas: [] };
    candidates.slice(0, MAX_PER_RUN).forEach(function (response) {
      try {
        const result = FormResponseNormalizerService.processResponse(response, execution);
        if (result.duplicado) report.duplicadas += 1; else report.criadas += 1;
        report.linhas.push((result.duplicado ? 'JÁ EXISTIA ' : 'CRIADA     ') + result.idSolicitacao + ' | ' + stamp_(response));
      } catch (error) {
        report.erros += 1;
        report.linhas.push('ERRO        | ' + stamp_(response) + ' | ' + error.message);
      }
    });
    if (report.criadas) {
      try { AdministrativeSolicitationCacheService.clear({ metadata: true }); } catch (e) { /* cache é otimização */ }
      try { DashboardCacheService.clear(); } catch (e) { /* idem */ }
    }
    Logger.log('CONCILIAÇÃO — pendentes: ' + report.pendentes + ' | criadas: ' + report.criadas + ' | já existiam: ' + report.duplicadas + ' | erros: ' + report.erros +
      (report.ignoradasInvalidas ? ' | inválidas já registradas (não repetidas): ' + report.ignoradasInvalidas : '') +
      (candidates.length > MAX_PER_RUN ? ' | restam ' + (candidates.length - MAX_PER_RUN) + ' para a próxima execução' : ''));
    report.linhas.forEach(function (l) { Logger.log('  ' + l); });
    return report;
  }

  function installAuto() {
    removeAuto();
    ScriptApp.newTrigger(AUTO_HANDLER).timeBased().everyMinutes(15).create();
    Logger.log('Conciliação automática instalada: a cada 15 minutos.');
    return { instalado: true };
  }

  function removeAuto() {
    let removed = 0;
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === AUTO_HANDLER) { ScriptApp.deleteTrigger(t); removed += 1; }
    });
    return { removidos: removed };
  }

  return { diagnose, simulate, reconcile, installAuto, removeAuto };
})();

function diagnosticarIntegracaoFormulario() {
  return FormReconciliationService.diagnose();
}

function simularConciliacaoFormulario() {
  return FormReconciliationService.simulate();
}

function conciliarRespostasFormulario() {
  return FormReconciliationService.reconcile('CONCILIACAO_MANUAL');
}

// Executado pelo gatilho de tempo (opcional). Não relança erros: cada falha fica em LOG_INTEGRACAO_FORMS.
function conciliarRespostasFormularioAutomatico() {
  try {
    return FormReconciliationService.reconcile('CONCILIACAO_AUTOMATICA');
  } catch (error) {
    console.log(JSON.stringify({ evento: 'extra_forms_conciliacao', erro: String(error && error.message || error) }));
    return null;
  }
}

function instalarConciliacaoAutomaticaFormulario() {
  return FormReconciliationService.installAuto();
}

function removerConciliacaoAutomaticaFormulario() {
  return FormReconciliationService.removeAuto();
}
