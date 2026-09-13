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

## Próximo passo — Fase 2B

Construir a entidade real de NF e o fluxo financeiro restante.

Escopo a definir/implementar:
1. entidade real de NF;
2. agrupamento principal por competência + fornecedor;
3. vínculo de múltiplas solicitações a uma NF;
4. regras/campos da NF a validar antes de implementar;
5. liberar `AGUARDANDO_NF → CONFERIDA` somente com vínculo/validação de NF;
6. depois liberar `CONFERIDA → ENCERRADA` conforme regra final;
7. não implementar split complexo de itens entre múltiplas NFs sem decisão explícita.

## Regras de continuidade

- GitHub e Apps Script manual devem permanecer sincronizados.
- Não fazer retry cego em mutações.
- Preservar edge cache, sessão própria, ações não bloqueantes e tabela sem layout shift.
- Antes de qualquer merge, validar o mesmo head no GitHub Actions e Cloudflare.
- Nunca executar `migrateSolicitationStatuses()` novamente.

## Próxima fase posterior

Fase 3: hardening, permissões finais, regressões, documentação e consolidação da V1.

## Comando de retomada

`Retome o projeto Extra Cost Control UNILOG. Leia MEMORIA_ESTADO_ATUAL.md, MEMORIA_PROJETO.md e MEMORIA_QA.md antes de alterar qualquer coisa. PRs #63, #64 e #65 já estão mergeados. Nunca execute migrateSolicitationStatuses() novamente. O próximo passo é iniciar a Fase 2B: modelar a entidade real de NF e o agrupamento por competência + fornecedor, preservando todas as otimizações e regras já homologadas. Nunca faça merge sem minha autorização explícita.`