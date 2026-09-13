# ESTADO ATUAL — EXTRA COST CONTROL UNILOG

Atualizado em 13/09/2026.

Leia este arquivo junto com `MEMORIA_PROJETO.md` e `MEMORIA_QA.md` antes de alterar o projeto.

## Estado consolidado

- PR #63 mergeado: edge cache + sessão própria.
- PR #64 mergeado: ações sem releitura bloqueante, retry de login, chunk mensal 1000 e tabela sem layout shift.
- `main` após PR #64: `933bc44de2768ba4fec5446e24a29734c0729cb0`.
- Apps Script já publicado com `SolicitationStatusService.gs` financeiro e `SheetRepository.gs` com `chunkSize = 1000`.
- Migração de status já concluída. Nunca executar novamente `migrateSolicitationStatuses()`.

## Workflow

Operacional:
`RASCUNHO → ENVIADA → EM_TRIAGEM → AGUARDANDO_AJUSTE opcional → EM_TRIAGEM → ENVIADA_AO_FORNECEDOR → EM_ATENDIMENTO opcional → ATENDIDA`.

Financeiro planejado:
`ATENDIDA → AGUARDANDO_NF → CONFERIDA → ENCERRADA`.

Implementado agora:
- `ATENDIDA → AGUARDANDO_NF` ativo;
- exige `VALOR_REAL`;
- `CONFERIDA` e `ENCERRADA` reconhecidos, mas sem transição liberada.

## PR #65 — ponto atual

Título: `Fase 2A: fechamento financeiro até aguardando NF`.

Branch: `feature/financial-closeout-phase2a`.

Status: aberto em Draft, não mergeado.

Escopo:
- tipos financeiros;
- transição até `AGUARDANDO_NF`;
- filtros `Aguardando NF`, `Conferida`, `Encerrada`;
- bloco `Fechamento financeiro` no detalhe de solicitação `ATENDIDA`;
- botão `Enviar para aguardando NF` no detalhe;
- ação rápida `Enviar para aguardando NF` também na coluna `Ações` para linhas `ATENDIDA`;
- a ação rápida reutiliza o slot visual 6 já usado por `Marcar atendida`, porque os dois estados são mutuamente exclusivos;
- ainda sem entidade real de NF;
- sem transições para `CONFERIDA`/`ENCERRADA`.

Homologação já realizada:
- botão do detalhe testado pelo usuário;
- transição real para `AGUARDANDO_NF` executada com sucesso.

Como esta memória altera o head da branch, revalidar checks no novo head antes de mergear.

## Próximo passo

No Preview do PR #65:
1. confirmar que uma linha `ATENDIDA` exibe a ação rápida `Enviar para aguardando NF` na coluna `Ações`;
2. confirmar que os botões vizinhos não mudam de posição;
3. opcionalmente validar a ação rápida em uma solicitação apropriada;
4. validar o filtro `Aguardando NF`;
5. revalidar head exato + GitHub Actions + Cloudflare;
6. merge somente com autorização explícita do usuário.

## Regras de continuidade

- GitHub e Apps Script manual devem permanecer sincronizados.
- Não fazer retry cego em mutações.
- Preservar edge cache, sessão própria, ações não bloqueantes e tabela sem layout shift.
- Antes de qualquer merge, validar o mesmo head no GitHub Actions e Cloudflare.

## Próximas fases

Fase 2B: entidade real de NF, agrupamento por competência/fornecedor, conferência e encerramento.

Fase 3: hardening, permissões finais, regressões, documentação e consolidação da V1.

## Comando de retomada

`Retome o projeto Extra Cost Control UNILOG. Leia MEMORIA_ESTADO_ATUAL.md, MEMORIA_PROJETO.md e MEMORIA_QA.md antes de alterar qualquer coisa. Se o PR #65 ainda estiver aberto, continue pela branch feature/financial-closeout-phase2a. Nunca execute migrateSolicitationStatuses() novamente. O botão para ATENDIDA → AGUARDANDO_NF existe no detalhe e na coluna Ações. Nunca faça merge sem minha autorização explícita.`