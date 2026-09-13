# ESTADO ATUAL — EXTRA COST CONTROL UNILOG

Atualizado em 14/09/2026.

Leia este arquivo junto com `MEMORIA_PROJETO.md`, `MEMORIA_QA.md`, `MEMORIA_FASE2B_HOMOLOGACAO.md`, `MEMORIA_FASE2C_DESENHO.md` e `MEMORIA_FASE3_HARDENING.md` antes de alterar o projeto.

## Estado consolidado

- PR #63 mergeado: edge cache + sessão própria.
- PR #64 mergeado: ações sem releitura bloqueante, retry de login, chunk mensal 1000 e tabela sem layout shift.
- PR #65 mergeado: Fase 2A financeira inicial.
- PR #66 mergeado: Fase 2B com fechamento consolidado por competência + fornecedor, NF, conciliação e encerramento.
- PR #67 mergeado: Fase 2C com exceções financeiras pós-fechamento.
- Merge commit do PR #67: `a1f2fc694aebe80cdc0c71f0b0866dafbdd8d1c1`.
- Fase 2B homologada ponta a ponta.
- Fase 2C concluída e mergeada.
- Migração histórica de status já concluída e, na Fase 3, a função executável de migração foi removida do código da branch de hardening.

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

`DESTINOS_FINANCEIROS_SOLICITACOES`: decisões auditáveis para solicitações tardias.

As abas são criadas automaticamente pelo Apps Script quando necessárias.

## Exceção de solicitação tardia — implementada

Se surgir uma solicitação depois que o fechamento daquele fornecedor/competência já tiver sido criado, conciliado ou encerrado:
- não reabrir automaticamente o fechamento anterior;
- não criar silenciosamente uma segunda NF da mesma competência/fornecedor;
- não sobrescrever a `COMPETENCIA` operacional original;
- a solicitação precisa receber um destino financeiro explícito.

Destinos permitidos:
1. reclassificar para próxima `COMPETENCIA_FATURAMENTO` ainda aberta para o fornecedor;
2. `ABSORVIDA_NAO_FATURADA`.

Toda decisão registra motivo, usuário e data.

Reclassificadas compõem o fechamento futuro; absorvidas ficam fora de NF futura.

## Fase atual — PR #68 / Fase 3

Branch: `feature/v1-hardening-final`.

Objetivo: hardening e consolidação final da V1, sem novos módulos.

Primeiros achados corrigidos na branch:
- exclusão de solicitação agora é bloqueada quando o ID já pertence a `FECHAMENTO_SOLICITACOES`;
- exclusão também é bloqueada quando existe decisão em `DESTINOS_FINANCEIROS_SOLICITACOES`;
- `migrateSolicitationStatuses()` deixou de existir como função global executável;
- `migrateExistingStatuses` deixou de ser exportada; permanece apenas o preview histórico somente leitura.

Essas alterações de Apps Script ainda precisam ser publicadas manualmente antes de a Fase 3 ser considerada alinhada.

## Regras de continuidade

- GitHub e Apps Script manual devem permanecer sincronizados.
- Não fazer retry automático em mutações.
- Mutações ambíguas devem ser reconciliadas por leitura.
- Preservar edge cache, sessão própria, ações não bloqueantes e tabela sem layout shift.
- Não esconder funcionalidade obsoleta com CSS quando ela puder ser removida com segurança.
- Antes de qualquer merge, validar GitHub Actions e Cloudflare no mesmo head exato.
- A migração histórica de status não possui mais função executável e não deve ser reintroduzida.
- Nunca fazer merge sem autorização explícita do usuário.

## Encerramento planejado da V1

1. publicar os arquivos Apps Script alterados da Fase 3;
2. concluir diagnóstico de código morto, responsividade e regressões;
3. executar GitHub Actions + Cloudflare no head final;
4. smoke test final;
5. atualizar memórias finais;
6. merge do PR #68 somente com autorização explícita.

## Comando de retomada

`Retome o projeto Extra Cost Control UNILOG. Leia MEMORIA_ESTADO_ATUAL.md, MEMORIA_PROJETO.md, MEMORIA_QA.md, MEMORIA_FASE2B_HOMOLOGACAO.md, MEMORIA_FASE2C_DESENHO.md e MEMORIA_FASE3_HARDENING.md antes de alterar qualquer coisa. PR #67 já foi mergeado em a1f2fc694aebe80cdc0c71f0b0866dafbdd8d1c1. A solicitação individual termina em ATENDIDA; estados financeiros pertencem ao fechamento consolidado. Exceções tardias são reclassificadas para COMPETENCIA_FATURAMENTO futura ou ABSORVIDA_NAO_FATURADA. A Fase 3 está em hardening final da V1. Não reintroduza migrateSolicitationStatuses(). Nunca faça merge sem minha autorização explícita.`