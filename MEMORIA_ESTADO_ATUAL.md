# ESTADO ATUAL — EXTRA COST CONTROL UNILOG

Atualizado em 13/09/2026.

Leia este arquivo junto com `MEMORIA_PROJETO.md`, `MEMORIA_QA.md`, `MEMORIA_FASE2B_HOMOLOGACAO.md` e `MEMORIA_FASE2C_DESENHO.md` antes de alterar o projeto.

## Estado consolidado

- PR #63 mergeado: edge cache + sessão própria.
- PR #64 mergeado: ações sem releitura bloqueante, retry de login, chunk mensal 1000 e tabela sem layout shift.
- PR #65 mergeado: Fase 2A financeira inicial.
- PR #66 mergeado: Fase 2B com fechamento consolidado por competência + fornecedor, NF, conciliação e encerramento.
- Merge commit do PR #66: `ee40c14dd9c8eebf2984801c197a0cfb679754c3`.
- Apps Script publicado e alinhado com o PR #66.
- Migração histórica de status já concluída. Nunca executar novamente `migrateSolicitationStatuses()`.

## Workflow vigente

Operacional por solicitação:

`RASCUNHO → ENVIADA → EM_TRIAGEM → AGUARDANDO_AJUSTE opcional → EM_TRIAGEM → ENVIADA_AO_FORNECEDOR → EM_ATENDIMENTO opcional → ATENDIDA`

A solicitação individual termina operacionalmente em `ATENDIDA`.

Financeiro por fechamento consolidado:

`ATENDIDA → fechamento consolidado → AGUARDANDO_NF → NF registrada → CONFERIDA → ENCERRADA`

`AGUARDANDO_NF`, `CONFERIDA` e `ENCERRADA` pertencem ao fechamento financeiro, não à solicitação individual.

A antiga transição individual `ATENDIDA → AGUARDANDO_NF` foi removida do frontend e do fluxo de transição. Status financeiros antigos continuam reconhecidos somente para leitura/compatibilidade histórica.

## Regra financeira da NF

Chave financeira:

`COMPETENCIA_FATURAMENTO + FORNECEDOR`

Na situação normal, `COMPETENCIA_FATURAMENTO = COMPETENCIA` operacional.

Regras:
- uma única NF por fornecedor em cada competência de faturamento;
- `RESPONSAVEL_CUSTO` não separa NF;
- o fechamento congela o espelho interno usado para conciliar a NF;
- o fechamento não cria custos: consolida registros já realizados;
- resultado de conciliação é separado do status do workflow: `OK | COM_AJUSTE | COM_DIVERGENCIA`;
- `ENCERRADA` significa fim da etapa financeira, sem depender de pagamento, ERP ou repasse ao cliente.

## Homologação da Fase 2B

Fluxo real homologado em 13/09/2026 com MULT / 08/2026:
- fechamento `FEC-202608-32DA046D`;
- 220 solicitações;
- valor congelado R$ 437.670,00;
- NF 88878 por R$ 437.670,00;
- diferença R$ 0,00;
- conciliação `OK` / exibida como Conferida;
- fechamento avançou até `ENCERRADA`;
- NF e resultado permaneceram vinculados.

## Estrutura financeira atual

`FECHAMENTOS`: uma linha por competência de faturamento + fornecedor.

`FECHAMENTO_SOLICITACOES`: vínculos e snapshots das solicitações incluídas no fechamento.

`NOTAS_FISCAIS`: NF, valores, datas, resultado da conciliação e auditoria.

As abas são criadas automaticamente pelo Apps Script quando necessárias.

## Exceção pendente — solicitação tardia

Se surgir uma solicitação depois que o fechamento daquele fornecedor/competência já tiver sido criado, conciliado ou encerrado:
- não reabrir automaticamente o fechamento anterior;
- não criar silenciosamente uma segunda NF da mesma competência/fornecedor;
- não sobrescrever a `COMPETENCIA` operacional original;
- a solicitação precisa receber um destino financeiro explícito.

Destinos confirmados:
1. reclassificar para próxima `COMPETENCIA_FATURAMENTO`;
2. `ABSORVIDA_NAO_FATURADA`, quando o custo deve ser absorvido internamente.

Toda decisão deve registrar motivo, usuário e data.

O backend já detecta esse cenário por meio de `novasAposFechamento`, comparando as solicitações atuais da competência com o snapshot de `FECHAMENTO_SOLICITACOES`.

## Fase atual — PR #67 / Fase 2C

Branch: `feature/financial-exceptions-phase2c`.

Objetivo: transformar a detecção de solicitação tardia em um fluxo administrativo explícito e auditável.

Desenho vigente em `MEMORIA_FASE2C_DESENHO.md`.

Ordem planejada:
1. persistência da decisão financeira tardia;
2. leitura de solicitações tardias sem destino;
3. ações backend de reclassificação e absorção;
4. gateway Cloudflare sem retry de mutação;
5. modal administrativo de exceções;
6. homologação com casos controlados;
7. atualização das memórias e checks finais.

## Regras de continuidade

- GitHub e Apps Script manual devem permanecer sincronizados.
- Não fazer retry automático em mutações.
- Mutações ambíguas devem ser reconciliadas por leitura.
- Preservar edge cache, sessão própria, ações não bloqueantes e tabela sem layout shift.
- Não esconder funcionalidade obsoleta com CSS quando ela puder ser removida com segurança.
- Antes de qualquer merge, validar GitHub Actions e Cloudflare no mesmo head exato.
- Nunca executar `migrateSolicitationStatuses()` novamente.
- Nunca fazer merge sem autorização explícita do usuário.

## Próxima fase posterior

Fase 3: hardening, permissões finais, regressões, documentação e consolidação da V1.

## Comando de retomada

`Retome o projeto Extra Cost Control UNILOG. Leia MEMORIA_ESTADO_ATUAL.md, MEMORIA_PROJETO.md, MEMORIA_QA.md, MEMORIA_FASE2B_HOMOLOGACAO.md e MEMORIA_FASE2C_DESENHO.md antes de alterar qualquer coisa. PR #66 já foi mergeado e a Fase 2B está homologada ponta a ponta. A solicitação individual termina em ATENDIDA; AGUARDANDO_NF, CONFERIDA e ENCERRADA pertencem ao fechamento consolidado. Nunca execute migrateSolicitationStatuses() novamente. O PR #67 trata solicitações tardias pós-fechamento: reclassificar para próxima COMPETENCIA_FATURAMENTO ou ABSORVIDA_NAO_FATURADA, sem sobrescrever a COMPETENCIA original, sem reabrir fechamento automaticamente e sem criar segunda NF silenciosa. Nunca faça merge sem minha autorização explícita.`