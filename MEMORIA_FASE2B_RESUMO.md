# Fase 2B — regras confirmadas

Atualizado em 13/09/2026.

- O acompanhamento dos registros é diário.
- O fechamento não cria custos: consolida o que já foi lançado e realizado durante a competência.
- O fechamento é por `COMPETENCIA + FORNECEDOR`.
- Existe uma única NF por fornecedor em cada competência.
- `RESPONSAVEL_CUSTO` não separa NF.
- O fechamento gera/congela o espelho interno que deve ser conciliado com a NF do fornecedor.
- `AGUARDANDO_NF` deve ser consequência do fechamento consolidado, não de uma ação isolada por solicitação.
- Resultado da conciliação:
  - `CONFERIDA`: bateu sem ajuste.
  - `CONFERIDA_COM_AJUSTE`: houve diferença e ela foi ajustada/documentada.
  - `CONFERIDA_COM_DIVERGENCIA`: a conferência foi concluída, mas permaneceu divergência registrada.
- Preferência de modelagem: workflow permanece `CONFERIDA`; usar campo separado `RESULTADO_CONCILIACAO = OK | COM_AJUSTE | COM_DIVERGENCIA`.
- Para ajuste/divergência, registrar motivo, usuário e data/hora. Para ajuste, registrar também valor do fechamento, valor da NF e efeito do ajuste.
- Solicitação tardia após NF emitida não reabre automaticamente o fechamento: pode ir para próxima `COMPETENCIA_FATURAMENTO` ou ser absorvida/não faturada.
- Nunca sobrescrever a `COMPETENCIA` operacional original.
- Nunca executar `migrateSolicitationStatuses()` novamente.
- Nunca fazer merge sem autorização explícita do usuário.