# MEMÓRIA ÚNICA — EXTRA COST CONTROL UNILOG

Atualizado em 15/09/2026.

Este é o único arquivo de memória do projeto. Não criar novos arquivos `MEMORIA_*.md`; novas decisões e diagnósticos devem ser incorporados aqui em seções.

## Estado geral

Repositório: `srcarneiro1/extra-cost-control-unilog`.

Stack: Next.js 15 + React 19 + PrimeReact/PrimeIcons + Chart.js; Cloudflare Pages; Pages Functions como gateway; Google Apps Script como API/regras; Google Sheets como persistência. Não usar Supabase neste projeto.

Estado funcional: V1 consolidada, hardening principal concluído e projeto considerado encerrado pelo responsável em 15/09/2026. Novas alterações funcionais devem ser tratadas como manutenção/correção ou nova fase, sem reabrir escopo antigo por padrão. Há uma pendência técnica opcional registrada para modularização integral do frontend.

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

## Próxima pendência técnica — modularização integral do frontend

Pendência registrada em 15/09/2026. Não é correção funcional nem urgência de produção; é uma evolução arquitetural para reduzir componentes grandes, separar responsabilidades e facilitar manutenção futura sem trocar Next.js, React ou PrimeReact.

Execução adotada: **um único Draft PR (#74) com 7 macro-etapas por domínio**, usando commits/blocos internos revisáveis. A estratégia substitui a estimativa inicial de 7 PRs separados sem alterar os guardrails de homologação e merge.

Plano em execução no Draft PR #74:
1. **Etapa 1 — Shell, autenticação e estrutura compartilhada:** separar responsabilidades hoje concentradas em `src/app/page.tsx`, mantendo comportamento, sessão e primeiro acesso intactos.
2. **Etapa 2 — Dashboard e Analytics:** decompor `DashboardPage`, `AdvancedAnalytics`, exportação, filtros, cards e gráficos em módulos/colegiados menores.
3. **Etapa 3 — Solicitações:** decompor `AdminSolicitationsPageCurrentPeriod`, detalhes, correção e ações operacionais em submódulos, hooks e componentes específicos.
4. **Etapa 4 — Cadastros:** decompor `CadastrosPagePaginated` por domínio/aba (operações, supervisores, funções, atividades, fornecedores, produtos, preços, feriados e metas), preservando paginação e regras atuais.
5. **Etapa 5 — Fechamentos:** organizar `FinancialCloseoutPage`, ações financeiras, exceções e componentes de conciliação por responsabilidade, sem alterar regras financeiras.
6. **Etapa 6 — Usuários e administração:** modularizar `UsersPage`, primeiro acesso, formulários e componentes administrativos compartilhados.
7. **Etapa 7 — Consolidação final do frontend:** revisar componentes compartilhados, hooks, services, types, CSS, imports e code splitting; eliminar duplicações comprovadas; medir bundle/First Load e executar smoke completo.

Critérios permanentes para essa futura modularização:
- refatoração estrutural somente; não alterar regra de negócio junto com modularização;
- um domínio por PR sempre que possível;
- preservar APIs e contratos existentes;
- não tocar Apps Script ou planilha se não houver necessidade técnica concreta;
- não introduzir retry em mutações;
- validar GitHub Actions + Cloudflare Preview no head exato de cada PR;
- homologar o domínio afetado antes de merge;
- merge somente com autorização explícita.

Estado do Draft PR #74: Etapas 1 e 2 concluídas e homologadas; Etapa 3 (Solicitações) iniciada. O PR permanece Draft e o merge continua condicionado à autorização explícita.

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

Em 15/09/2026 o responsável considerou a V1 funcionalmente encerrada após a consolidação e os hardenings de transporte. Não há PR funcional pendente registrado nesta memória.

A modularização integral do frontend foi iniciada no Draft PR #74, organizada em 7 macro-etapas. Etapas 1 e 2 já foram concluídas e homologadas; Etapa 3 está em andamento. Não tratar essa refatoração como incidente de produção.

Se o projeto for retomado, começar por:
1. ler apenas `MEMORIA.md`;
2. verificar o estado atual da `main` e os deployments antes de assumir qualquer condição;
3. tratar novas demandas funcionais como manutenção ou nova fase;
4. se a retomada for para modularização, continuar o Draft PR #74 pelas 7 macro-etapas e preservar integralmente as regras existentes;
5. não reabrir migrações históricas nem regras financeiras consolidadas sem evidência concreta.

## Retomada curta

`Leia somente MEMORIA.md. A V1 funcional do Extra Cost Control foi consolidada e considerada encerrada em 15/09/2026. PRs #66–#73 foram concluídos; o último merge funcional foi o PR #73 em 0b309fd26360ba2f484133dfe17801e5a750173d. Modularização integral do frontend em andamento no Draft PR #74, com 7 macro-etapas; Etapas 1 e 2 concluídas/homologadas e Etapa 3 iniciada. Nunca execute migrateSolicitationStatuses(), nunca repita mutações automaticamente e nunca faça merge sem autorização explícita.`


## Ajustes de segurança, tema e build — 05/10/2026

- **Cabeçalhos de segurança** (`public/_headers`): `X-Frame-Options: DENY` (impede embutir o site em outra página), `X-Content-Type-Options: nosniff`, `Referrer-Policy` e `Permissions-Policy`.
- **Tema sem roxo:** `scripts/build-unilog-theme.mjs` gera `src/app/generated/primereact-unilog-theme.css` a cada build a partir do Lara Light Indigo, trocando toda a escala indigo/primary e o anel de foco pela escala vermelha Unilog. Executado com `--keep-fonts` para preservar a fonte Inter usada pelo projeto. Antes: 276 ocorrências de roxo no CSS final; depois: 0. Login comparado pixel a pixel no desktop: idêntico.
- **iOS:** campos do login com 16 px no celular (`src/app/ios-input-zoom.css`), evitando zoom automático ao tocar.
- **Build reproduzível:** Next.js 15.5.27, `package-lock.json` versionado e CI com `npm ci`.
- **CI:** o workflow passa a rodar também em `push` na `main` (antes só em pull request — uploads diretos não eram validados) e bloqueia tons roxos no CSS final.


## Fluxo de status simplificado — 06/10/2026

Pedido da operação: remover "Enviada ao fornecedor" e "Em atendimento" das ações; da triagem só "Aguardando ajuste" e concluir.

- novo fluxo: `Rascunho → Enviada → Em triagem → (Aguardando ajuste ↺) → Atendida`;
- **alimentação/bebida:** botão "Marcar atendida" direto na triagem (exige triagem concluída: fornecedor + preço; valor real = valor previsto);
- **mão de obra:** o registro de comparecimento passa a ser feito direto na triagem (exige triagem concluída) e conclui a solicitação, como antes;
- `TRANSITIONS`: `EM_TRIAGEM → [AGUARDANDO_AJUSTE, ATENDIDA]`; `ENVIADA_AO_FORNECEDOR` e `EM_ATENDIMENTO` só aceitam `ATENDIDA` (registros antigos nesses status continuam podendo ser concluídos; nenhum fica travado);
- "Contato com fornecedor" (copiar resumo/WhatsApp) continua disponível na triagem concluída;
- indicadores: "Aguardando triagem" = Enviada, Aguardando ajuste ou Em triagem **sem** triagem concluída; "Aguardando realizado" (mão de obra) = Em triagem **com** triagem concluída, ou status antigos de fornecedor/atendimento;
- status antigos continuam com rótulo e filtro para o histórico;
- testado com o Apps Script real em simulador: 12 cenários (novos caminhos, bloqueios e registros antigos);
- arquivos: `SolicitationStatusService.gs`, `AttendanceService.gs`, `AdministrativeSolicitationQueryService.gs`, `AdminSolicitationsTable.tsx`, `SolicitationDetailModal.tsx`;
- **atenção ao Draft PR #74 (Etapa 3 — Solicitações):** ele reorganiza esses mesmos componentes; ao retomá-lo, incorporar este fluxo.

## Diagnóstico de desempenho — 06/10/2026

Revisão do caminho completo (frontend → Cloudflare → Apps Script → planilha):
- camada de dados já otimizada: leitura por colunas, janelas do fim da aba, filtro por mês, memo por execução e caches (navegador, Cloudflare, Apps Script);
- protocolo usa contador em Script Properties (sem varrer a aba);
- frontend aplica patch otimista e agrupa recargas em segundo plano;
- conclusão: **não há gargalo evidente no código**; otimizar sem medição contraria a regra do projeto.

Medição adicionada: `functions/api/_middleware.ts` (somente rotas `/api`):
- cabeçalho `Server-Timing` em cada resposta (DevTools → Network → Timing);
- log `api-timing` com rota, ação, método, status e ms nos Real-time logs do Cloudflare (sem dados pessoais);
- validado com Wrangler local: resposta original preservada, páginas estáticas não afetadas.

Próximo passo: coletar 1–2 dias de logs no uso real e atacar a rota mais lenta com base nos números (hipóteses a confirmar: inicialização a frio do Apps Script após inatividade; espera por `LockService` em gravações simultâneas; leituras completas de catálogos na criação).
- **Coluna de ações (desktop):** a grade de posições fixas tinha 9 vagas, incluindo as de "Confirmar envio ao fornecedor" (2) e "Marcar em atendimento" (5), que ficaram vazias em todas as linhas. Agora são 7 vagas (`prime-solicitations.css`): 1 ajuste/retomar triagem, 2 copiar resumo, 3 fornecedor, 4 marcar atendida, 5 detalhes, 6 editar, 7 excluir; largura da coluna definida na seção abaixo. Cada ação continua sempre na mesma coluna (alinhamento entre linhas); vagas vazias só onde a ação não se aplica ao status. No celular a grade já era automática (sem vagas fixas). Validado em navegador com 7 status diferentes.
- **Tabela de Solicitações ajustável (`prime-solicitations.css`):** antes a tabela tinha largura cravada em 115rem (1840 px) e as 11 colunas larguras fixas com `!important` (inclusive Ações em 24rem, o que anulava o `style` da coluna no TSX). Resultado: não crescia em telas grandes nem encolhia nas menores, e a coluna Ações ficava fora da área visível até em monitores de 1920 px. Agora (acima de 820 px): `width:100%`, `table-layout:auto`, largura mínima 92rem (largura natural do conteúdo ≈ 90rem + folga), colunas ajustadas ao conteúdo, número da solicitação e status com largura mínima protegida, e coluna Ações fixa à direita (`position:sticky`, 18,5rem) durante a rolagem lateral. Validado em 10 larguras (2560 a 821 px): sem rolagem a partir de ~1600 px úteis, Ações sempre visíveis e nenhum texto cortado; modo cartão do celular inalterado.
- **Rolagem lateral (06/10/2026, a partir de vídeo no Safari):** o "passa um pouco" era o quique elástico do trackpad no Safari — `overscroll-behavior-inline: contain` não desliga o quique, então a tabela era empurrada além do início/fim levando as colunas fixas. Agora `overscroll-behavior-x/inline: none` no wrapper da tabela. Coluna Ações fixa à direita **sem sombra** (linha fina `#edf0f2`, igual às bordas); coluna Solicitação fixa à esquerda (já `frozen` no TSX) com a mesma linha fina, para o conteúdo não parecer passar por baixo. Validado no Chromium (Solicitação em 0 px e Ações no limite direito em todas as posições de rolagem); o motor do Safari não pôde ser instalado no ambiente de teste — confirmar no Safari real.
- **Ações no celular (`mobile-solicitation-actions.css`):** grade de 3 → 4 colunas de 44 px. Com 7 botões ficava 3 + 3 + 1 (lixeira sozinha na última linha, comportamento anterior a 06/10); agora 4 + 3 (6 botões = 4 + 2). Validado em 390, 430 e 768 px: cartões sem rolagem lateral, colunas fixas desativadas no modo cartão, botões de 44 px com espaçamento uniforme.
