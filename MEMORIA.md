# MEMÓRIA ÚNICA — EXTRA COST CONTROL UNILOG

Atualizado em 15/09/2026.

Este é o único arquivo de memória do projeto. Não criar novos arquivos `MEMORIA_*.md`; novas decisões e diagnósticos devem ser incorporados aqui em seções.

## Estado geral

Repositório: `srcarneiro1/extra-cost-control-unilog`.

Stack: Next.js 15 + React 19 + PrimeReact/PrimeIcons + Chart.js; Cloudflare Pages; Pages Functions como gateway; Google Apps Script como API/regras; Google Sheets como persistência. Não usar Supabase neste projeto.

Estado funcional: V1 consolidada, hardening principal concluído e projeto considerado encerrado pelo responsável em 15/09/2026. Novas alterações devem ser tratadas como manutenção/correção ou nova fase, sem reabrir escopo antigo por padrão.

Regra central: o solicitante informa a necessidade; o Administrativo decide quem atende.

## Workflow operacional

`RASCUNHO → ENVIADA → EM_TRIAGEM → AGUARDANDO_AJUSTE opcional → EM_TRIAGEM → ENVIADA_AO_FORNECEDOR → EM_ATENDIMENTO opcional → ATENDIDA`

A solicitação individual termina em `ATENDIDA`.

`AGUARDANDO_NF`, `CONFERIDA` e `ENCERRADA` pertencem exclusivamente ao fechamento financeiro consolidado.

Regras permanentes:
- solicitante não define preço final nem valor realizado;
- Administrativo valida fornecedor e preço aplicável;
- Mão de Obra: `VALOR_REAL = QTD_COMPARECIDA × PRECO_UNITARIO_APLICADO`;
- Alimentação/Bebida não usa comparecimento para quantidade;
- alteração futura de preço nunca recalcula histórico;
- `COMPETENCIA` operacional nunca deve ser sobrescrita pelo fechamento financeiro.

## Fase 2B — fechamento financeiro consolidado

PR #66 mergeado e homologado.

Fluxo financeiro: `ATENDIDA → fechamento consolidado → AGUARDANDO_NF → NF registrada → CONFERIDA → ENCERRADA`.

Chave: `COMPETENCIA_FATURAMENTO + FORNECEDOR`.

Uma única NF por fornecedor/competência de faturamento. `RESPONSAVEL_CUSTO` não separa NF. O fechamento congela o espelho interno. Resultado de conciliação: `OK | COM_AJUSTE | COM_DIVERGENCIA`.

Homologação de referência: MULT 08/2026, fechamento `FEC-202608-32DA046D`, 220 solicitações, R$ 437.670,00, NF 88878, diferença R$ 0,00, conciliação OK e encerramento concluído.

## Fase 2C — exceções pós-fechamento

PR #67 mergeado em `a1f2fc694aebe80cdc0c71f0b0866dafbdd8d1c1`.

Solicitação tardia nunca reabre automaticamente fechamento, nunca cria segunda NF silenciosa e nunca sobrescreve `COMPETENCIA` operacional.

Destinos: `RECLASSIFICAR_PROXIMA_COMPETENCIA` ou `ABSORVIDA_NAO_FATURADA`, sempre com motivo, usuário e data. Persistência em `DESTINOS_FINANCEIROS_SOLICITACOES`.

## Fase 3 — hardening final da V1

PR #68 foi mergeado. Merge commit: `4aa65bc89adfde42c583074eaf5b61ec1711316e`.

Consolidações:
- exclusão administrativa bloqueada quando a solicitação já está vinculada a fechamento ou destino financeiro;
- `migrateSolicitationStatuses()` removida como função global executável;
- `migrateExistingStatuses` removido do export; preview histórico permaneceu somente leitura;
- matriz OWNER / ADMINISTRATIVO / OPERACIONAL revisada;
- responsividade de Solicitações e Fechamentos revisada;
- hacks antigos de `.p-button-label` e ações obsoletas escondidas por CSS removidos/confirmados ausentes;
- mutações não possuem retry automático;
- respostas ambíguas de mutações devem ser reconciliadas por leitura/autenticação, nunca por repetir escrita;
- páginas pesadas foram divididas com `next/dynamic`, reduzindo o First Load principal aproximadamente de 279 kB para 151 kB.

O fallback legado `GATEWAY_TEST_TOKEN` continua existente no código de autenticação do gateway, mas foi confirmado sem configuração em produção e portanto inerte. Não afirmar que foi removido.

## Primeiro acesso e usuários

PR #69 implementou primeiro acesso com senha temporária e troca obrigatória. Merge: `1be9b76...`.

Comportamento:
- OWNER define senha temporária;
- login com senha temporária retorna exigência de troca;
- usuário define nova senha de pelo menos 8 caracteres;
- mutação de troca ocorre uma única vez;
- resposta ambígua é reconciliada autenticando com a nova senha, sem repetir a escrita.

Incidente importante já resolvido: uma cópia manual no Apps Script criou uma declaração global duplicada de `SolicitationDeletionService` em arquivo com caractere Unicode invisível no nome. A exclusão do arquivo duplicado restaurou o login. Evitar arquivos globais duplicados no Apps Script.

## Mobile

PR #70 corrigiu ações de Solicitações no mobile. Merge commit: `1f09cffdd409f6e783742273e71cd81eeaed8696`.

No iPhone, as ações ficaram em grid 3×44 px, até 6 ações em duas linhas, sem clipping; desktop preservado.

## Hardening de transporte Cloudflare → Apps Script

### PR #71 — Cadastros, Solicitações e Usuários

Merge commit: `8480291a6bb4e2bdfe5dde7b1d912fb19da64d71`.

Diagnóstico: respostas do Google ContentService passam por redirects. Em rotas protegidas, `redirect: 'follow'` podia permitir downgrade de `POST` para `GET`, fazendo o Apps Script devolver mensagens como “disponível somente pelo gateway protegido” ou resposta inválida, mesmo quando a operação já havia sido persistida.

Correção:
- leituras passam a controlar redirects;
- mutações são executadas uma única vez;
- resultado ambíguo de mutação é reconciliado por leitura/autenticação;
- nunca repetir POST de mutação automaticamente.

Usuários foi homologado no Preview com criação real de usuário.

### PR #72 — Fechamentos

Merge commit: `d0b690ba0437557c69dae398b9c0253976c79ca9`.

Hardening aplicado em `functions/api/fechamentos.ts`:
- leitura com redirect controlado;
- FECHAR, SALVAR_NF, CONCILIAR e ENCERRAR: mutação exatamente uma vez;
- respostas ambíguas reconciliadas por leitura do fechamento;
- `DECIDIR` de exceção financeira permanece conservador: não repete mutação e não presume sucesso sem evidência suficiente.

Homologação:
- Preview carregou Fechamentos normalmente;
- troca de competência com dados carregou normalmente, com alguma latência;
- após merge, o deploy em produção foi confirmado pelo usuário e Fechamentos foi acessado com sucesso.

### PR #73 — Login, Dashboard e Dashboard Export

Título: `Hardening de transporte em Login e Dashboard`.
Branch: `fix/auth-dashboard-transport-hardening`.
Head homologado: `a00bd78f51a6e4420b24696d80e3e971192d899c`.
Merge commit: `0b309fd26360ba2f484133dfe17801e5a750173d`.

Escopo restrito a:
- `functions/api/auth/login.ts`;
- `functions/api/dashboard.ts`;
- `functions/api/dashboard-export.ts`.

Comportamento final:
- Login usa redirect controlado;
- retries permanecem apenas em autenticação/leitura segura;
- primeiro acesso executa a troca de senha uma única vez e reconcilia por autenticação com a nova senha quando necessário;
- Dashboard e Dashboard Export usam redirect controlado;
- nenhuma regra de negócio, Apps Script ou planilha foi alterada.

Gates no head homologado:
- GitHub Actions: success;
- Cloudflare Pages Preview: success.

Homologação funcional do Preview:
- login normal: OK;
- Dashboard: OK;
- exportação do Dashboard: OK.

O merge foi autorizado explicitamente e concluído. O deploy de produção específico do merge commit `0b309fd...` não foi reconsultado no chat antes do encerramento do projeto; não afirmar esse detalhe sem nova verificação caso seja necessário no futuro.

## Migração/limpeza pós-go-live

Planilha oficial: `18dpLKAFHQI3rHRgn1XzP0cAtzYzZsrU-r6FulFkHXvo`.

Foram removidas as solicitações de teste `CE-2026-001859` e `CE-2026-001860`.

Foram migradas 10 linhas legadas de Mão de Obra para `CE-2026-001861` até `CE-2026-001870`, lote `MIGRACAO_LEGADO_POS_GO_LIVE_20260914`. O usuário verificou visualmente o resultado.

Nunca executar novamente `migrateSolicitationStatuses()`.

## Performance — interpretação consolidada

O Extra Cost Control pode parecer mais lento que o BI Logístico V2 em cargas frias, mas isso é coerente com a arquitetura de cada produto.

BI Logístico V2:
- predominantemente leitura/analytics;
- carrega um bootstrap amplo da HUB;
- reutiliza o mesmo objeto em memória entre telas;
- ponte Apps Script usa cache global de 120 s.

Extra Cost Control:
- sistema transacional;
- endpoints separados por domínio (Dashboard, Solicitações, Fechamentos, Cadastros, Usuários);
- segurança e consistência são priorizadas por operação;
- Dashboard calcula KPIs, projeção, comparação, agrupamentos, evolução e analytics a partir das solicitações;
- cache existe no navegador, Cloudflare e Apps Script, mas o cold path é naturalmente mais pesado.

Conclusão: a diferença de velocidade observada não foi tratada como defeito. A arquitetura separada do Extra Cost Control faz sentido para um sistema transacional; não fazer intervenção de performance sem medição objetiva de gargalo.

## Regras permanentes do projeto

- nunca fazer retry automático em mutações;
- mutação ambígua deve ser reconciliada por leitura/autenticação;
- retries automáticos podem existir apenas em leitura/autenticação segura;
- nunca executar novamente `migrateSolicitationStatuses()`;
- não reabrir fechamento automaticamente;
- não criar segunda NF silenciosa;
- não sobrescrever competência operacional;
- manter GitHub e Apps Script sincronizados quando houver alteração `.gs`;
- validar GitHub Actions + Cloudflare no head exato antes de merge relevante;
- nunca fazer merge sem autorização explícita;
- não remover `force`/bypass de cache por intuição: ele é usado deliberadamente em revalidação e pós-mutações; investigar cold path/network quando houver queixa de lentidão;
- manter uma única memória: este arquivo.

## Estado de encerramento

Em 15/09/2026 o responsável considerou o projeto encerrado após a consolidação da V1 e os hardenings de transporte. Não há PR funcional pendente registrado nesta memória.

Se o projeto for retomado, começar por:
1. ler apenas `MEMORIA.md`;
2. verificar o estado atual da `main` e os deployments antes de assumir qualquer condição;
3. tratar novas demandas como manutenção ou nova fase;
4. não reabrir migrações históricas nem regras financeiras consolidadas sem evidência concreta.

## Retomada curta

`Leia somente MEMORIA.md. A V1 do Extra Cost Control foi consolidada e considerada encerrada em 15/09/2026. PRs #66–#73 foram concluídos; o último merge foi o PR #73 em 0b309fd26360ba2f484133dfe17801e5a750173d. Nunca execute migrateSolicitationStatuses(), nunca repita mutações automaticamente e nunca faça merge sem autorização explícita.`
