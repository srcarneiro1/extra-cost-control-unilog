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


## Filtro de período da aba Solicitações pela data operacional — 09/10/2026

Pedido: o filtro Ano/Mês/Data da aba Solicitações deve usar a **data operacional**, não a data de registro.

- `AdministrativeSolicitationQueryService.gs`: `PERIOD_FIELD = 'DATA_OPERACIONAL'` na lista de datas (metadados), na filtragem por ano/mês/data e na leitura do mês. Os parâmetros mantêm o nome "registro" (`anoRegistro`, `mesRegistro`, `dataRegistro`, `datasRegistro`) para não mudar gateway nem serviços do frontend. A ordenação da lista continua pela data de registro (mais recentes primeiro).
- `SheetRepository.gs`: nova `readObjectsForMonthFromEndBy(aba, campoFiltro, campoOrdem, ano, mês, margem)`. A leitura antiga (`readObjectsForMonthFromEnd`) para ao achar um mês anterior e só funciona com campo que cresce com as linhas (data de registro). A data operacional não segue a ordem das linhas (há registros antecipados e atrasados): só trocar o campo fazia o filtro de outubro devolver **0 de 4** solicitações no teste. A nova leitura filtra pela data operacional e para pela data de criação, com margem de 12 meses.
- Tela (`AdminSolicitationsPageCurrentPeriod.tsx`): rótulos "Ano operacional" e "Data operacional".
- Testes no simulador do Apps Script (planilha com solicitações fora de ordem): 9 cenários, resultado idêntico à checagem linha a linha (registrada 4 meses antes, registrada no mês anterior, atrasadas, dia específico, ano, datas do filtro).
- **Ordem do menu (09/10/2026):** Solicitações passou a ser o primeiro item, antes de Visão geral (`src/features/shell/shellNavigation.ts`, array `NAV_ITEMS`). A tela inicial e a memória da tela foram tratadas em 21/10/2026 (abaixo).
- **Tela inicial e recarregamento (21/10/2026):** antes a tela inicial era fixa em Visão geral (`useState('dashboard')`) e, ao recarregar, o usuário sempre voltava para ela. Agora (`FunctionalShell.tsx`): abre em **Solicitações**; a tela atual fica no endereço (`#solicitacoes`, `#dashboard`, `#fechamentos`…) e no navegador (`localStorage` `extra-cost:secao`), então F5 mantém a tela; endereço inválido ou tela sem permissão para o perfil cai na última tela válida, depois em Solicitações. Testado: primeiro acesso, F5 em Visão geral e em Solicitações, endereço sem # e com # inválido, perfil Operacional com tela sem permissão guardada.

## Gráfico de gasto com terceiros — últimos 6 meses (21/10/2026)

Visão Executiva ganhou o cartão **"Gasto com mão de obra terceirizada"** (logo após o comparativo com a competência anterior).

- Barras do **valor realizado de mão de obra** (`VALOR_REAL`, mesma regra do card "Realizado mão de obra") por competência 21–20: a selecionada e as 5 anteriores.
- Respeita os filtros da tela (operação, supervisor, fornecedor, responsável, atividade); o filtro **tipo** é ignorado, pois o gráfico é sempre de terceiros.
- Competência em andamento: barra mais clara, rótulo com `*` e nota; a **média mensal** considera só competências encerradas; **total no período** soma as 6.
- Tooltip: realizado, previsto e quantidade de solicitações.
- Backend (`DashboardService.gs`): `historicoTerceiros` na resposta; `readDashboardRows_` passou a receber a lista de competências (6 em vez de 2). Cache do dashboard: prefixo `dashboard_response_v2_` para não reaproveitar respostas antigas sem o campo.
- Frontend: `executive/ThirdPartyHistory.tsx` (Chart do PrimeReact, paleta da marca), tipo `DashboardThirdPartyMonth` em `types/dashboard.ts`, estilos em `prime-design-system.css`.
- Testes no simulador do Apps Script (7 competências, mão de obra + lanches, 2 operações): 9 cenários — soma exata por mês sem lanches, 6 competências em ordem, outubro igual ao card do realizado, filtro de operação, filtro tipo ignorado, outra competência selecionada, competência em andamento marcada como parcial, comparativo intacto. Gráfico conferido no navegador (computador e celular) com a resposta real do backend.
- **Diagnóstico do gráfico vazio (21/10/2026):** com o Apps Script na versão anterior, a resposta não traz `historicoTerceiros` e o cartão mostrava "Sem gasto com terceiros", o que parecia ausência de gasto. Agora mostra "Histórico indisponível no servidor" nesse caso. O health do Apps Script (`doGet`) passou a informar `version: '2026.10.21.1'` e `recursos` (antes era fixo em `mvp1`), para conferir rapidamente qual código está publicado.
- **Ajustes visuais (21/10/2026):** nota do gráfico de terceiros com margem alinhada ao título do cartão (antes a 1 px da borda), linha divisória e ícone de informação. Campo de busca (`SearchField` em `components/ui/Primitives.tsx`, usado em Solicitações, Cadastros e Usuários): o "x" nativo do `type="search"` (azul no Chrome, cinza no Safari) foi escondido e substituído por botão próprio (26 px, 32 px no celular, cinza `#858a93`, hover `#eef0f3`), que aparece só com texto, limpa ao clicar e também com Esc. Estilos em `prime-design-system.css`.

## Desempenho da aba Fechamentos — 22/10/2026 (API 2026.10.22.1)

Diagnóstico (por que era mais lenta que as outras abas):
1. **Duas chamadas em fila:** a tela buscava as competências e só depois o fechamento (duas viagens ao Apps Script em sequência).
2. **Leituras completas de abas que crescem:** o fechamento de uma competência lê inteiras as abas de fechamentos, notas, itens (1 linha por solicitação fechada) e destinos (2×), mais uma busca por solicitação reclassificada. **Não otimizado ainda** (item 3 do plano; mexe no cálculo, fazer com testes no simulador após medir).
3. **Sem cache no Apps Script** (Solicitações e Visão geral tinham).

Implementado:
- **Tela** (`FinancialCloseoutPage.tsx`): competência inicial calculada no navegador (regra 21–20) para buscar o fechamento **em paralelo** com as competências; se divergir da competência do servidor (virada do dia 20/21, fuso), vale a do servidor. Medido com servidor de teste de 1,5 s por chamada: **3,5 s → 2,0 s** para o fechamento aparecer.
- **Cache no Apps Script** (`FinancialCloseoutCacheService.gs`, novo): fechamento 30 s e competências 5 min, chave versionada. Antes só `FECHAR` invalidava; agora **todas** as gravações da rota (fechar, salvar NF, conciliar, encerrar) passam por `writeAndInvalidate_`, que também limpa este cache — assim como qualquer gravação de outras rotas (solicitações, triagem, exceções), pois o fechamento depende das solicitações.
- **Atualizar:** o gateway (`functions/api/fechamentos.ts`) repassa `fresh=1` ao Apps Script, que ignora o cache.
- **Versão única de cache:** a invalidação usava `Date.now()` como versão; duas gravações no mesmo milissegundo não invalidavam. Corrigido (horário + sufixo aleatório) nos três caches: fechamentos, solicitações e dashboard.
- Health do Apps Script: `2026.10.22.1` com recurso `cacheFechamentos`.
- Testes: 10 cenários com o `Api.gs` real (cache por competência, cache de competências, invalidação por cada gravação, Atualizar, invalidação por outras rotas) e medição de tempo no navegador.

## Jornada paga de 8 h — 22/10/2026 (API 2026.10.22.2)

Validação contra a fatura do fornecedor: cobrança por colaborador e por dia = horas × valor da hora, com dia completo de **8 h** (ex.: 8 × R$ 22,50 = R$ 180,00; motorista 8 × R$ 37,50 = R$ 300,00). O Extra cobra diária (`PRECOS_MO` por fornecedor, função, turno, tipo de dia e vigência) — dia completo bate se a diária cadastrada = 8 × valor da hora.

Divergência corrigida: na saída antecipada o Extra calculava **diária ÷ 9 h** × horas (hora 11% abaixo da fatura; ex.: 4 h de R$ 180 = R$ 80 contra R$ 90 cobrados). Agora `PartialShiftService.FULL_SHIFT_HOURS = 8`:
- exceção aceita só com menos de 8 h (8 h ou mais é dia completo);
- exceções antigas com 8 h a 9 h passam a valer como dia completo no cálculo (antes travariam);
- tela: padrão 8 h (`SolicitationDetailModal.tsx`, `solicitationService.ts`).

Correção dos lançamentos antigos: `apps-script/ManutencaoJornadaParcial.gs` — `simularRecalculoJornadaParcial8h()` (não altera nada, lista o que mudaria) e `aplicarRecalculoJornadaParcial8h()` (recalcula `VALOR_REGISTRADO` das exceções ativas e `VALOR_REAL` das solicitações com comparecimento; **não altera** solicitações já em `FECHAMENTO_SOLICITACOES`, que são listadas para análise; auditoria `RECALCULO_JORNADA_PARCIAL_8H` em `AUDITORIA_SOLICITACOES`; idempotente; com bloqueio; limpa caches). Testado em simulador: 11 cenários.

Pendente: **hora extra** (a fatura tem colunas HE e valor HE; o Extra não registra) — aguardando a regra do fornecedor.

## Pareto "Custo por depositante" em lista horizontal — 22/10/2026

O cartão ocupa 1/3 da linha na aba Analytics. Com barras verticais: nomes cortados e inclinados (dois "CAFFEINE B…" indistinguíveis), valores só no tooltip, linha acumulada sem o primeiro ponto e área de gráfico 50 px mais alta que os vizinhos.
Agora (`analytics/AnalyticsCharts.tsx` → `ParetoChart`, estilos `.analytics-pareto-card` em `prime-analytics.css`):
- lista do **Top 5** (mesmo recorte do selo "Top 5"), cada linha com posição, nome completo (até 2 linhas), valor, barra proporcional, participação e acumulado; tooltip com previsto e quantidade de solicitações;
- destaque (grafite) dos depositantes que somam **80%** do custo, marcação tracejada "80% do custo" e subtítulo "N depositantes concentram 80% do custo realizado"; os demais em cinza;
- linha "Demais N depositantes" com valor e participação do restante;
- altura: a do Pareto varia com a quantidade de depositantes (ficava acima ou abaixo dos vizinhos). A linha "Dia da semana · Pareto · Supervisão" passou a ter cartões **sempre da mesma altura** (`prime-analytics.css`, seletor `.advanced-analytics-grid .analytics-three-columns`, sobrepondo só ali a regra global de `prime-polish.css` que impede cartões de esticar): gráficos ocupam o espaço que sobra (mínimo 300 px) e, no Pareto, "Demais" fica no rodapé. Testado com 1, 4 e 11 depositantes em 1920, 1600, 1366, 900 e 390 px.

## Ordem da lista de Solicitações pela data operacional — 23/10/2026 (API 2026.10.23.1)

A lista passou a ser ordenada pela **data operacional, da mais recente para a mais antiga** (antes: data de registro). No mesmo dia, a registrada por último vem primeiro; sem data operacional vai para o fim.
- Com filtro (mês, status, busca…): `compareByOperationalDate_` em `AdministrativeSolicitationQueryService.gs`.
- Sem filtro: a leitura rápida antiga (`readObjectsWindowFromEnd`) pegava as últimas linhas da aba, que estão em ordem de registro — não serve para ordem operacional. Agora lê só a coluna `DATA_OPERACIONAL`, ordena e busca apenas as linhas da página com a nova `SheetRepository.readObjectsByRowNumbers` (linhas próximas lidas num único bloco).
- Testes no simulador (60 solicitações com datas operacionais embaralhadas, empates e uma sem data): as 6 páginas juntas iguais à ordenação feita à mão; filtro de mês e busca na mesma ordem; página sem filtro com 2 leituras da planilha.

## Acordos comerciais de mão de obra — 05/11/2026 (API 2026.11.05.1)

Preço negociado com fornecedor para operação (+ função, turno, tipo de dia e supervisores, opcionais) numa vigência; **prioridade sobre `PRECOS_MO`**, que não é alterada. Caso real: GoBeauty, MULT, Dimas Castelo e Mateus Marchesi, 06–09/11/2026, R$ 225,00 por pessoa/dia em qualquer tipo de dia.

- **Cadastro:** Cadastros → **Acordos comerciais** (`AgreementsPanel.tsx`), perfis OWNER/ADMINISTRATIVO (mesma rota protegida `/api/cadastros`, ações `LISTAR_ACORDOS_MO`, `SALVAR_ACORDO_MO`, `INATIVAR_ACORDO_MO`). O autor vem da sessão autenticada no gateway (`usuarioAdministrativo`), nunca do corpo enviado pela tela.
- **Aba `ACORDOS_MO`:** colunas garantidas por `AgreementService` (ID_ACORDO, STATUS, FORNECEDOR, OPERACAO, FUNCAO|TODAS, TURNO|TODOS, TIPO_DIA|TODOS, SUPERVISORES (lista com `;` ou TODOS), VIGENCIA_INICIO/FIM, PRECO_UNITARIO, QTD_REFERENCIA_DIA (informativa), JUSTIFICATIVA, RESPONSAVEL_NEGOCIACAO, REFERENCIA_DOCUMENTO, CRIADO_/ATUALIZADO_ EM/POR, MOTIVO_INATIVACAO, VERSAO). Linhas sem ID_ACORDO ou sem STATUS ATIVO **nunca são aplicadas** (registros preliminares aparecem como "pendente de revisão").
- **Regras:** fornecedor, operação, função e supervisores precisam existir nos cadastros (nomes oficiais); vigência com início e fim; **sobreposição bloqueada no cadastro** (mesmo fornecedor e operação, vigências que se cruzam e condições com interseção) → no máximo um acordo por solicitação; se mesmo assim houver dois, o cálculo falha em vez de escolher. **Acordo não é editado**: para mudar, inativa-se (com motivo e controle de versão) e cria-se outro. Inativar não recalcula solicitações já precificadas.
- **Preço:** `PricingService.resolveLaborPrice` consulta o acordo antes da tabela (recebe também operação e supervisor) e devolve `origem` (ACORDO/TABELA) e `idAcordo`. Chamadas atualizadas: criação (`SolicitationService`), triagem (`TriageService`) e correção (`SolicitationCorrectionService`). Comparecimento, jornada parcial, dashboard, fechamento e exportações seguem usando o preço gravado.
- **Rastreabilidade:** colunas `ORIGEM_PRECO` e `ID_ACORDO_APLICADO` em `SOLICITACOES` (criadas sem apagar nada; vazio = tabela). O detalhe da solicitação mostra "Origem do preço: Acordo comercial AC-…" ou "Tabela de preços". Na correção de registro antigo que continua na tabela, a origem fica vazia (evita alteração falsa na auditoria).
- **Solicitações já existentes:** `ManutencaoAcordos.gs` — `simularAplicacaoAcordos()` (não altera dados) e `aplicarAcordosSolicitacoesExistentes()` (só mão de obra triada, ativa, fora de fechamento; previsto = solicitada × preço; real recalculado com a jornada parcial se houver comparecimento; auditoria `ACORDO_COMERCIAL AC-…`; idempotente; com bloqueio; limpa caches).
- **Testes:** 31 no simulador do Apps Script (sexta/sábado/domingo/segunda a R$ 225 com tabela de R$ 180/270/360, supervisor e operação fora, fornecedor diferente, fora da vigência, conflitos bloqueados e não-conflitos permitidos, validações, simulação sem alterar dados, aplicação, fechamento intacto, auditoria, idempotência, inativação sem recálculo, versão) e 12 na interface (aba, pendentes, validação, envio, conflito do servidor no formulário, inativação, celular).

## Incidente do formulário — 05/11/2026 (API 2026.11.05.2)

**Causa raiz confirmada** (execução de `onOperationalFormSubmit` às 18:25:07, falha após 12,9 s): "Não foi possível obter bloqueio para normalizar a resposta do Forms". O gatilho esperava só 10 s pelo `LockService`, ocupado por outra gravação; a resposta do Allan (ADM, ALLAN OLIVEIRA, 3 GOURMET + 1 COCA-COLA 2L, UNILOG 2309) ficou em `RESPOSTAS_FORM` sem virar solicitação e **sem nenhum registro da falha nem forma de reprocessar**. Agravante: dentro do bloqueio a checagem de duplicidade lia a aba `SOLICITACOES` inteira (execuções de 7 a 13 s). Observação: o gatilho de formulário roda o código **salvo no editor** (coluna "Teste"), não a versão publicada — arquivo colado pela metade afeta o formulário na hora.

Correção (`FormResponseNormalizerService.gs`):
- validação/montagem (`buildRecord_`) separada da gravação (`persist_`); espera do bloqueio 10 → **30 s**; duplicidade checada **dentro do bloqueio** lendo só as colunas ORIGEM/ID_ORIGEM/ID_SOLICITACAO (`originIndex`);
- toda tentativa registrada em **`LOG_INTEGRACAO_FORMS`** (DATA_HORA, EXECUCAO, ID_RESPOSTA, DATA_RESPOSTA, RESULTADO = CRIADA | DUPLICADA | ERRO_BLOQUEIO | ERRO_VALIDACAO | ERRO_INESPERADO, ID_SOLICITACAO, MENSAGEM, DURACAO_MS), aba criada se não existir, `appendRow` atômico, sem dados pessoais; log estruturado `extra_forms` com ID mascarado; o gatilho continua relançando o erro (aparece como "Falha" e o Google avisa por e-mail).

Recuperação (`FormReconciliationService.gs`, executar no editor):
- `diagnosticarIntegracaoFormulario` (só leitura): FORM_ID, formulário aceitando respostas, destino = planilha do Extra, gatilhos do handler (alerta se mais de um ou origem ≠ FORM_ID), respostas dos últimos 60 dias sem solicitação;
- `simularConciliacaoFormulario` (só leitura): valida cada pendente e mostra o que seria criado;
- `conciliarRespostasFormulario`: cria as pendentes válidas (máx. 50 por execução), com o horário original do envio como DATA_CRIACAO, protocolo novo e sem duplicar;
- opcional: `instalarConciliacaoAutomaticaFormulario` (gatilho de tempo a cada 15 min, `conciliarRespostasFormularioAutomatico`, não relança erros e não repete respostas já registradas como inválidas) / `removerConciliacaoAutomaticaFormulario`.

Testes no simulador: 24 cenários (incidente reproduzido, espera de 30 s, falha registrada, diagnóstico sem expor IDs completos, simulação sem alterar dados, recuperação do Allan com dados e horário corretos, lançamento anterior intacto, idempotência da conciliação e do gatilho repetido/edição de resposta, validação registrada e listada, protocolos sequenciais, falha temporária recuperada pela conciliação automática, gatilho de tempo único, automática sem repetir inválidas).

## Tela aberta de solicitação + cadastros de custo — 05–06/11/2026 (API 2026.11.06.1)

Objetivo: substituir o Google Forms por uma tela do próprio app, aberta (sem login), mantendo a gestão restrita.

**Tela `/solicitar`** (`src/app/solicitar/page.tsx`, `features/public-request/*`, estilos `public-request.css`):
- sem login; botão "Acesso à gestão" leva ao login ("/"); o login ganhou o link "Só quer fazer uma solicitação?";
- opções lidas na hora dos cadastros (supervisores, operações, atividades, funções, produtos elegíveis — mesma regra do formulário —, responsáveis e centros de custo); cadastrou no app, aparece na tela;
- **mão de obra e alimentação/bebidas no mesmo envio** → uma solicitação por tipo, cada uma com seu protocolo; o servidor valida as duas antes e grava as duas sob um único bloqueio (tudo ou nada);
- validação na própria tela (bebida/alimentação escolhida exige quantidade; quantidades só números; centro de custo só quando o responsável exige, com os centros do supervisor primeiro e sugestão automática quando ele tem um só; sem centros cadastrados vira campo numérico);
- idempotência: `idEnvio` gerado na abertura; nova tentativa após falha usa o mesmo id (não duplica); "Fazer outra solicitação" gera outro;
- origem `FORMULARIO_WEB`, status ENVIADA, sem fornecedor (definido na triagem, onde os acordos comerciais se aplicam).

**Servidor:** `PublicSolicitationService.gs` (ações OPCOES/ENVIAR, rota `solicitacao_publica`, só com o token do gateway) reaproveita a validação do formulário: `FormResponseNormalizerService.buildFromAnswers` (respostas no formato das perguntas) e `persistMany` (vários registros sob um bloqueio, duplicidade por ORIGEM + ID_ORIGEM). `FormCatalogSyncService.eligibleProducts` exportado.

**Gateway público** `functions/api/publico/solicitacao.ts`: GET opções (cache 60 s), POST envio; campos em lista fechada com tamanho máximo; anti-robô invisível (campo-isca `site` + mínimo de 3 s entre abrir e enviar); limite de 10 envios a cada 10 min por IP (cache do Cloudflare); só cria e lê opções — nenhum dado lançado sai por essa rota.

**Cadastros de custo** (`CostCenterService.gs`; Cadastros → "Centros de custo", `CostCentersPanel.tsx`):
- `CAD_RESPONSAVEIS_CUSTO` (RESPONSAVEL, EXIGE_CENTRO_CUSTO, ATIVO): substitui o CLIENTE/UNILOG fixo no código. Sem cadastro valem CLIENTE (sem centro), UNILOG, DIRETORIA e PROJETOS (com centro) — corrige as respostas do Google Forms com DIRETORIA/PROJETOS, antes recusadas;
- `CAD_CENTROS_CUSTO` (CENTRO_CUSTO, DESCRICAO, ATIVO) e `CAD_SUPERVISOR_CENTROS` (vínculo). Sem centros cadastrados, qualquer código numérico é aceito (comportamento anterior);
- validação única `CostCenterService.validate` usada no formulário, na tela aberta, na criação pelo app e na correção (na correção, valores inalterados de registros antigos continuam aceitos); correção de solicitação oferece os responsáveis do cadastro;
- `configurarCadastrosDeCusto()` (opcional, uma vez): cria as abas, os 4 responsáveis e os 10 centros do formulário atual.

Testes: 24 no simulador (opções, envio de lanche, reenvio idempotente, mão de obra + lanche juntos, DIRETORIA, tudo ou nada, bebida sem quantidade, quantidade inválida, CLIENTE sem centro, UNILOG sem centro, configuração, centro inexistente, vínculos, novo responsável, inativação, correção de registro antigo, bloqueio ocupado e nova tentativa), os 24 do Google Forms repetidos sobre a versão nova, 19 na tela aberta e 5 no painel de centros de custo.

## Identidade Unilog (Manual 2026, Revisão 2) no login e na tela de solicitação — 06/11/2026

- **Fonte Roboto oficial hospedada no app** (`public/fonts/roboto-{300,400,700,900}.woff2`, ~21 KB cada, subconjunto latino; `src/app/brand-fonts.css`, importado primeiro no layout). Antes o app declarava Roboto mas não carregava a fonte: Windows/Mac exibiam Arial. Isso afeta o app inteiro (para melhor: passa a usar a fonte da marca).
- **Tokens da marca** em `brand-fonts.css` (`--unilog-cinza #494a56`, `--unilog-vermelho #db0812`, hover `#b00610`, tons de cinza e vermelho 10).
- **Logo oficial vetorial** (`public/brand/unilog_express_logo_branco.svg` com ® no login, 150 px; `_sem_registro` na barra lateral e no topo da tela de solicitação, abaixo de 120 px). O arquivo antigo `unilog-logo-white-transparent.svg` era um traçado de imagem, não o vetor oficial (mantido no repositório, sem uso).
- **Fundo animado** (`components/brand/BrandBackdrop.tsx`): ícones de logística em contorno fino, brancos a 9%, flutuando devagar sobre o Cinza UNILOG liso (sem degradê, conforme o manual); `prefers-reduced-motion` desliga a animação. Inspirado no login do allPick, adaptado à paleta Unilog.
- **Login** (`login-brand.css`, classe `nx-login-brand-v2`): fundo cinza com ícones, logo com ®, selo "GESTÃO", linha vermelha antes dos títulos ("EXTRA COST CONTROL", "ACESSO"), título com destaque sublinhado em vermelho (texto vermelho sobre cinza não é permitido), cartão branco raio 8, campos e botão raio 6, rodapé "© ano Unilog Express. Todos os direitos reservados.". Lógica de login inalterada.
- **Tela de solicitação**: topo cinza com fundo animado, logo oficial e título; formulário em cartões brancos sobre cinza 10; vermelho #db0812; textos em Cinza UNILOG; alerta com barra lateral vermelha; sucesso em cinza (sem verde fora da paleta); campos alinhados pelo topo; rodapé cinza com filete vermelho.
- Pendente (fora deste escopo): demais telas internas ainda usam `#d60016`/`#242a36` em alguns pontos; ícones PrimeIcons em vez de Material Symbols.

## Endereços: a raiz abre a tela de solicitação — 06/11/2026

- `/` → **tela de solicitação** (pública). `/gestao/` → **gestão** (login + aplicativo). `/solicitar/` continua como atalho.
- Favoritos antigos da gestão com `#` (`/#solicitacoes`, `/#cadastros`…) são redirecionados para `/gestao/#…`, inclusive se o `#` mudar na mesma aba (`src/app/page.tsx`).
- Na tela de solicitação, o botão do topo vira "Ir para a gestão" quando há sessão ativa (`/api/auth/me`); no login, "Só quer fazer uma solicitação?" leva à raiz.
- Testes: 9 no navegador (raiz, botão sem e com sessão, login, atalho /solicitar, favorito antigo, troca de # na mesma aba, /gestao com sessão).
- Rodapé da tela de solicitação fixo no fim da tela quando há pouco conteúdo (ex.: erro ao carregar as opções): `.pr-page` em coluna flexível (`public-request.css`).

## Diagnóstico de erros na tela de solicitação — 06/11/2026

- Toda falha da rota pública volta com **código** (em que ponto falhou) e **referência** (8 caracteres), também no cabeçalho `x-request-id`, e é registrada no log do Cloudflare (`evento: publico_solicitacao`, com referência, etapa OPCOES/ENVIO, resultado, status HTTP, detalhe técnico e duração). Sucessos também são registrados (OK). Nada de token, URL do Apps Script ou dados do formulário no log.
- Códigos: `CONFIGURACAO_AUSENTE` (variável do Cloudflare), `REDE_APPS_SCRIPT` (falha de rede até o Google), `SEM_RESPOSTA`, `RESPOSTA_INVALIDA` (Google devolveu HTML — login/permissão da implantação — ou não JSON), `APPS_SCRIPT_TOKEN` (token recusado), `APPS_SCRIPT_VERSAO` (rota inexistente: Apps Script desatualizado), `VALIDACAO` (dado do pedido), `APPS_SCRIPT_ERRO`, `ANTI_ROBO`, `LIMITE_ENVIOS`, `ENVIO_GRANDE`, `ENVIO_INVALIDO`; no navegador, `SEM_INTERNET` (aparelho sem conexão) e `HTTP_nnn`.
- Tela: abaixo da mensagem, "Código · Ref. · data/hora" com botão **Copiar** (na falha ao carregar e na falha ao enviar).
- Carga das opções: uma nova tentativa automática após 1,5 s (leitura; a 1ª chamada após um tempo parado costuma falhar enquanto o Apps Script "acorda"). O envio nunca é repetido automaticamente.
- Onde achar no log: Cloudflare → Workers & Pages → projeto do Extra → Functions/Logs (tempo real) → buscar a referência.
- Testes: 10 no gateway (isolado) e 6 na tela.

## Formulário: regra por "Categorias solicitadas" — 07/11/2026 (API 2026.11.07.1)

Causa das 2 respostas recusadas (02/11 Doriedson/MEGALABS e 03/11 Alex Guidini/CELLERA): categoria marcada só "Alimentação", mas a lista "Bebida" ficou com COCA-COLA 2L escolhida e a quantidade de bebida vazia; o processador ignorava as categorias e exigia a quantidade.
Regra nova em `FormResponseNormalizerService.applyFood_` (alimentação e bebida, separadamente):
- categoria marcada → produto e quantidade obrigatórios;
- categoria não marcada + produto escolhido + quantidade vazia → **resíduo ignorado**, anotado na MENSAGEM do `LOG_INTEGRACAO_FORMS` (resultado CRIADA) e na simulação ("OBS.");
- categoria não marcada + quantidade preenchida → **inconsistência**: recusa, sem presumir;
- sem a pergunta de categorias (tela de solicitação do app) → regra anterior.
Testes: 9 cenários novos (incluindo os dois casos reais), 24 do formulário e 24 da tela de solicitação repetidos sem falhas.
Pendente operacional: confirmar com os solicitantes que os dois pedidos eram só alimentação antes da conciliação; CE-2026-002130 é duplicado do CE-2026-002080 (já atendido) — cancelar pelo fluxo do app.

## Acordo comercial indicado pelo solicitante — 07/11/2026 (API 2026.11.07.2)

Problema: na mesma operação/fornecedor/período convivem pedidos normais (tabela) e pedidos do acordo; aplicar o acordo automaticamente cobraria errado os normais. Decisão: **o solicitante indica e o Administrativo confirma**.
- Acordo ganhou `FORMA_APLICACAO` (AUTOMATICA | INDICADA) e `NOME_PUBLICO` (nome mostrado ao solicitante, sem preço). Registros antigos sem o campo = AUTOMATICA (sem mudança). Novos acordos vêm com INDICADA por padrão na tela.
- `AgreementService.findApplicable`: acordo INDICADA só entra com `confirmedId` igual ao seu ID. `indicatedOptions()` (sem preço) para a tela de solicitação; `validateIndication()` (operação, vigência, supervisor); `summary()` para a triagem. Sobreposição continua bloqueada (inclusive entre automático e indicado).
- `PricingService.resolveLaborPrice`: `confirmedAgreementId`; se confirmado e não se encaixar (ex.: outro fornecedor), recusa com mensagem; na correção (`confirmedOptional`) mantém o acordo se ainda se encaixar, senão segue a tabela.
- Solicitação: coluna `ID_ACORDO_INDICADO` (criada sem apagar nada). Tela aberta: pergunta "Faz parte de algum acordo comercial?" só quando há acordo indicado vigente para operação/data/supervisor; enviado em `maoDeObra.idAcordoIndicado` (gateway público aceita o campo).
- Triagem (`TriageService`): `confirmarAcordo: true` aplica o acordo indicado; sem confirmação, tabela. Tela de detalhe: caixa "O solicitante indicou um acordo comercial" (nome, código, preço, fornecedor), confirmação desmarcada por padrão, pré-seleciona o fornecedor do acordo ao confirmar, aviso se o fornecedor escolhido for outro; campo "Acordo indicado" no detalhe.
- Rotina `aplicarAcordosSolicitacoesExistentes` só aplica acordos AUTOMATICA.
- Testes: 14 novos no servidor + 31 de acordos (regressão), 27 da tela de solicitação no servidor, 5 na tela de solicitação, 5 na triagem e 4 no cadastro.
- **Várias operações por acordo (07/11/2026):** campo OPERACAO aceita uma, várias ("OP1; OP2") ou TODAS; tela com "Abrangência de operações" (selecionadas/todas) e seleção múltipla, como supervisores. Acordos antigos com uma operação seguem válidos. Conflito: mesmo fornecedor + operações em comum (ou "todas") + vigências e condições que se cruzam. Tela de solicitação filtra por `operacoes` (lista vazia = todas). Testes: 10 novos + 31 de acordos + 14 do acordo indicado + 27 da tela no servidor; telas: 5 no cadastro e 6 na solicitação.
