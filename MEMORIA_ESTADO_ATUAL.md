# ESTADO ATUAL — EXTRA COST CONTROL UNILOG

Atualizado em 13/09/2026.

Leia este arquivo junto com `MEMORIA_PROJETO.md` e `MEMORIA_QA.md` antes de alterar o projeto.

## Estado consolidado

- PR #63 mergeado: edge cache + sessão própria.
- PR #64 mergeado: ações sem releitura bloqueante, retry de login, chunk mensal 1000 e tabela sem layout shift.
- PR #65 mergeado: Fase 2A financeira até `AGUARDANDO_NF`.
- Merge commit do PR #65: `115221b91028d491b6513aa3bf9743d605c0447f`.
- Apps Script já publicado com `SolicitationStatusService.gs` financeiro e `SheetRepository.gs` com `chunkSize = 1000`.
- Migração de status já concluída. Nunca executar novamente `migrateSolicitationStatuses()`.

## Workflow

Operacional:
`RASCUNHO → ENVIADA → EM_TRIAGEM → AGUARDANDO_AJUSTE opcional → EM_TRIAGEM → ENVIADA_AO_FORNECEDOR → EM_ATENDIMENTO opcional → ATENDIDA`.

Financeiro planejado:
`ATENDIDA → AGUARDANDO_NF → CONFERIDA → ENCERRADA`.

Implementado e homologado:
- `ATENDIDA → AGUARDANDO_NF` ativo;
- exige `VALOR_REAL`;
- `CONFERIDA` e `ENCERRADA` reconhecidos, mas sem transição liberada;
- filtros `Aguardando NF`, `Conferida` e `Encerrada`;
- bloco `Fechamento financeiro` no detalhe de solicitação `ATENDIDA`;
- botão `Enviar para aguardando NF` no detalhe;
- ação rápida `Enviar para aguardando NF` também na coluna `Ações` para linhas `ATENDIDA`;
- ação rápida reutiliza o slot visual 6 já usado por `Marcar atendida`, evitando layout shift.

Homologação concluída:
- botão do detalhe testado pelo usuário;
- transição real `ATENDIDA → AGUARDANDO_NF` executada com sucesso;
- ação rápida da coluna `Ações` testada e funcionando;
- layout da linha/colunas permaneceu estável;
- head final homologado do PR #65: `67f0d5fc4f071cf4ee93328335a194cd3a144eb4`;
- GitHub Actions run #125: SUCCESS;
- Cloudflare Preview: SUCCESS;
- PR #65 mergeado com autorização explícita do usuário.

## Regra financeira confirmada para NF — 13/09/2026

A NF do fornecedor é emitida pela competência e deve ser consolidada por fornecedor.

Chave de faturamento/NF:

`COMPETENCIA + FORNECEDOR`

Regras confirmadas:
- para cada competência, cada fornecedor emite uma única NF consolidada;
- todas as solicitações elegíveis daquele fornecedor e daquela competência compõem a mesma NF;
- `RESPONSAVEL_CUSTO` (`CLIENTE` ou `UNILOG`) NÃO separa NF;
- a Unilog paga o fornecedor e o eventual repasse ao cliente é tratado internamente depois;
- portanto, `RESPONSAVEL_CUSTO` continua sendo dimensão analítica/rateio, mas não integra a chave de faturamento;
- não criar uma NF por solicitação;
- não permitir que uma solicitação individual seja a unidade conceitual de fechamento da NF.

Implicação arquitetural:
- a Fase 2B deve revisitar a semântica de `AGUARDANDO_NF` criada na Fase 2A;
- `ATENDIDA` continua individual por solicitação;
- o avanço financeiro deve ocorrer por fechamento da competência/fornecedor, não por clique isolado em uma solicitação;
- os botões individuais `Enviar para aguardando NF` da Fase 2A devem ser revistos/removidos na Fase 2B quando a fila consolidada por competência estiver implementada.

## Próximo passo — Fase 2B

Construir a entidade real de NF e revisar o fechamento financeiro com base na competência.

Escopo a definir/implementar:
1. criar visão de fechamento por competência;
2. agrupar por `COMPETENCIA + FORNECEDOR`;
3. consolidar todas as solicitações elegíveis do grupo;
4. criar entidade de faturamento/NF para o grupo, com uma única NF por fornecedor em cada competência;
5. manter vínculo explícito entre NF e solicitações incluídas;
6. revisar/remover a transição individual para `AGUARDANDO_NF` quando o fechamento consolidado estiver ativo;
7. liberar `AGUARDANDO_NF → CONFERIDA` somente com NF registrada/validada;
8. depois liberar `CONFERIDA → ENCERRADA` conforme regra final;
9. definir antes do código como tratar solicitação tardia de uma competência cuja NF já foi emitida, pois não deve surgir silenciosamente uma segunda NF para o mesmo fornecedor/competência.

## Regras de continuidade

- GitHub e Apps Script manual devem permanecer sincronizados.
- Não fazer retry cego em mutações.
- Preservar edge cache, sessão própria, ações não bloqueantes e tabela sem layout shift.
- Antes de qualquer merge, validar o mesmo head no GitHub Actions e Cloudflare.
- Nunca executar `migrateSolicitationStatuses()` novamente.

## Próxima fase posterior

Fase 3: hardening, permissões finais, regressões, documentação e consolidação da V1.

## Comando de retomada

`Retome o projeto Extra Cost Control UNILOG. Leia MEMORIA_ESTADO_ATUAL.md, MEMORIA_PROJETO.md e MEMORIA_QA.md antes de alterar qualquer coisa. PRs #63, #64 e #65 já estão mergeados. Nunca execute migrateSolicitationStatuses() novamente. A NF é emitida por competência e consolidada por fornecedor: a chave de faturamento é COMPETENCIA + FORNECEDOR, sem separar CLIENTE/UNILOG. O próximo passo é revisitar AGUARDANDO_NF e implementar a Fase 2B com fechamento consolidado por competência/fornecedor. Nunca faça merge sem minha autorização explícita.`