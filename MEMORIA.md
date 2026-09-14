# MEMÓRIA ÚNICA — EXTRA COST CONTROL UNILOG

Atualizado em 14/09/2026.

Este é o único arquivo de memória do projeto. Não criar novos arquivos de memória; novas decisões e diagnósticos devem ser adicionados aqui em seções.

## Arquitetura

Repositório: `srcarneiro1/extra-cost-control-unilog`.

Stack: Next.js + React + PrimeReact no Cloudflare Pages; Pages Functions como gateway; Google Apps Script como API/regras; Google Sheets como persistência. Não usar Supabase.

Regra central: o solicitante informa a necessidade; o Administrativo decide quem atende.

## Workflow operacional

`RASCUNHO → ENVIADA → EM_TRIAGEM → AGUARDANDO_AJUSTE opcional → EM_TRIAGEM → ENVIADA_AO_FORNECEDOR → EM_ATENDIMENTO opcional → ATENDIDA`

A solicitação individual termina em `ATENDIDA`.

`AGUARDANDO_NF`, `CONFERIDA` e `ENCERRADA` pertencem ao fechamento financeiro consolidado.

## Fase 2B

PR #66 mergeado e homologado.

Fluxo financeiro: `ATENDIDA → fechamento consolidado → AGUARDANDO_NF → NF registrada → CONFERIDA → ENCERRADA`.

Chave: `COMPETENCIA_FATURAMENTO + FORNECEDOR`.

Uma única NF por fornecedor/competência de faturamento. `RESPONSAVEL_CUSTO` não separa NF. Fechamento congela o espelho interno. Resultado de conciliação: `OK | COM_AJUSTE | COM_DIVERGENCIA`.

Homologação de referência: MULT 08/2026, fechamento `FEC-202608-32DA046D`, 220 solicitações, R$ 437.670,00, NF 88878, diferença R$ 0,00, conciliação OK e encerramento concluído.

## Fase 2C

PR #67 mergeado em `a1f2fc694aebe80cdc0c71f0b0866dafbdd8d1c1`.

Solicitação tardia nunca reabre automaticamente fechamento, nunca cria segunda NF silenciosa e nunca sobrescreve `COMPETENCIA` operacional.

Destinos: `RECLASSIFICAR_PROXIMA_COMPETENCIA` ou `ABSORVIDA_NAO_FATURADA`, sempre com motivo, usuário e data. Persistência em `DESTINOS_FINANCEIROS_SOLICITACOES`.

## Fase 3 — PR #68

PR #68: `Fase 3: hardening e consolidação final da V1`.
Branch: `feature/v1-hardening-final`.
Estado: Draft.

Hardening já aplicado:
- exclusão bloqueada quando a solicitação já está ligada a fechamento ou destino financeiro;
- `migrateSolicitationStatuses()` removida como função executável;
- `migrateExistingStatuses` removido do export; preview histórico permanece somente leitura;
- matriz OWNER / ADMINISTRATIVO / OPERACIONAL revisada;
- responsividade de Solicitações e Fechamentos revisada;
- hacks antigos de `.p-button-label` e ações obsoletas escondidas por CSS confirmados ausentes;
- `SolicitationDeletionService.gs` e `SolicitationStatusService.gs` já publicados manualmente e alinhados ao GitHub.

O fallback legado de teste permanece no código, mas foi confirmado inativo em produção.

## Login — correção aplicada

O preview apresentou `AUTH_INVALID_RESPONSE` no login.

A correção foi aplicada em `src/services/authService.ts` no commit `a616e558c9f70694f234faf5e54ad7c2cdc324f9`.

Comportamento vigente:
- primeira tentativa normal de login;
- uma única segunda tentativa após 200 ms apenas quando a resposta da autenticação é inválida;
- erros normais de autenticação e rate limit não são repetidos;
- nenhuma mutação operacional ou financeira recebeu retry.

A correção ainda precisa ser homologada no preview depois de GitHub Actions e Cloudflare concluírem no head exato.

## Regras permanentes

- nunca fazer retry automático em mutações;
- mutação ambígua deve ser reconciliada por leitura;
- nunca executar novamente `migrateSolicitationStatuses()`;
- não reabrir fechamento automaticamente;
- não criar segunda NF silenciosa;
- não sobrescrever competência operacional;
- manter GitHub e Apps Script sincronizados;
- validar GitHub Actions + Cloudflare no head exato final;
- nunca fazer merge sem autorização explícita.

## Próximos passos

1. validar GitHub Actions + Cloudflare no head que contém a correção de login;
2. repetir o login no preview;
3. concluir o smoke final;
4. revisar pendências reais;
5. somente então tirar o PR de Draft;
6. pedir autorização antes do merge.

## Retomada

`Leia apenas MEMORIA.md. Não crie memórias separadas; atualize este arquivo. PR #68 está Draft. A correção de login está no commit a616e558c9f70694f234faf5e54ad7c2cdc324f9 e ainda precisa ser homologada no preview. Nunca execute migrateSolicitationStatuses() e nunca faça merge sem autorização explícita.`
