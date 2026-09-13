# Fase 2C — Exceções financeiras pós-fechamento

Atualizado em 13/09/2026.

## Estado de partida

- PR #66 mergeado no `main` em `ee40c14dd9c8eebf2984801c197a0cfb679754c3`.
- Fase 2B homologada ponta a ponta.
- Fluxo consolidado vigente: `ATENDIDA -> fechamento consolidado -> AGUARDANDO_NF -> NF registrada -> CONFERIDA -> ENCERRADA`.
- Solicitação individual termina operacionalmente em `ATENDIDA`.
- `AGUARDANDO_NF`, `CONFERIDA` e `ENCERRADA` pertencem ao fechamento financeiro, não à solicitação individual.
- Nunca executar novamente `migrateSolicitationStatuses()`.

## Problema que a Fase 2C resolve

Uma solicitação pode surgir depois que o fechamento daquele `COMPETENCIA + FORNECEDOR` já foi criado, conciliado ou encerrado.

O fechamento anterior não deve ser reaberto automaticamente e não deve surgir uma segunda NF silenciosa para a mesma competência/fornecedor.

A solicitação tardia precisa receber um destino financeiro explícito.

## Detecção já existente

`FinancialCloseoutService.list_()` já compara as solicitações atuais da competência com os IDs congelados em `FECHAMENTO_SOLICITACOES` e expõe `novasAposFechamento`.

A Fase 2C deve reutilizar essa detecção. Não criar uma segunda lógica paralela.

## Destinos permitidos

### 1. RECLASSIFICAR_PROXIMA_COMPETENCIA

- preserva a `COMPETENCIA` operacional original;
- grava separadamente `COMPETENCIA_FATURAMENTO`;
- a solicitação passa a compor o próximo fechamento financeiro elegível do mesmo fornecedor;
- motivo, usuário e data são obrigatórios.

### 2. ABSORVIDA_NAO_FATURADA

- usada quando o custo não deve seguir para NF, por exemplo erro interno da Unilog;
- preserva a solicitação e o valor real para rastreabilidade;
- não inclui a solicitação em NF futura;
- motivo, usuário e data são obrigatórios.

## Modelo proposto

Criar uma entidade própria de decisão financeira tardia, sem alterar silenciosamente `SOLICITACOES` e sem sobrescrever a competência operacional.

Aba sugerida: `DESTINOS_FINANCEIROS_SOLICITACOES`.

Campos mínimos:

- `ID_DESTINO_FINANCEIRO`
- `ID_SOLICITACAO`
- `COMPETENCIA_ORIGINAL`
- `FORNECEDOR`
- `DESTINO_FINANCEIRO`
- `COMPETENCIA_FATURAMENTO`
- `MOTIVO`
- `DATA_DECISAO`
- `USUARIO_DECISAO`
- `DATA_ATUALIZACAO`

Regra de unicidade: uma decisão financeira ativa por `ID_SOLICITACAO`.

## Regras de integridade

- nunca sobrescrever `COMPETENCIA` em `SOLICITACOES`;
- nunca reabrir automaticamente um fechamento existente;
- nunca criar segunda NF da mesma competência/fornecedor como efeito colateral de uma solicitação tardia;
- reclassificação só pode apontar para competência futura em relação à competência original;
- solicitação absorvida não entra em fechamento futuro;
- toda decisão deve ser auditável;
- mutações não podem ter retry automático;
- decisão ambígua após erro de rede deve ser reconciliada por leitura;
- Apps Script e GitHub precisam permanecer sincronizados.

## Comportamento esperado na UI

Quando `novasAposFechamento > 0`, a linha do fornecedor/competência deve exibir uma ação de exceção financeira.

A tela deve listar apenas as solicitações tardias ainda sem destino e permitir, por solicitação:

- reclassificar para próxima competência de faturamento; ou
- absorver/não faturar.

A justificativa deve ser obrigatória em ambos os casos.

Não misturar essa decisão com o modal de NF/conciliação do fechamento já congelado.

## Ordem de implementação

1. criar persistência e leitura da decisão financeira tardia;
2. adaptar a listagem de fechamentos para separar `novasAposFechamento` de `novasSemDestino`;
3. implementar ações backend de reclassificação e absorção;
4. implementar gateway Cloudflare sem retry de mutação;
5. implementar modal administrativo de exceções;
6. homologar primeiro sem alterar fechamento/NF já encerrados;
7. testar reclassificação em competência seguinte;
8. testar absorção;
9. atualizar memórias e rodar GitHub Actions + Cloudflare no mesmo head antes de merge.

## Fora do escopo da Fase 2C

- pagamento do fornecedor;
- ERP;
- repasse ao cliente;
- parcelamento de uma solicitação em múltiplas NFs;
- reabertura automática de fechamento encerrado;
- alteração da competência operacional original.
