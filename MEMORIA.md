# Retrabalho Controle — Memória do Projeto

> Sistema Unilog para registro, precificação, auditoria e acompanhamento de retrabalhos por cliente/filial.  
> Esta memória é a fonte de verdade funcional, técnica e visual do projeto e deve ser atualizada sempre que uma decisão aprovada alterar o baseline.

**Atualizado em:** 05/10/2026 (revisão 2)  
**Produção:** Cloudflare Pages, branch `main`  
**Referência visual:** Extra Cost Control Unilog + BI Logístico V2

### Ajustes e melhorias

O projeto está em evolução contínua. O estado atual é:

- [x] Autenticação por matrícula e senha
- [x] Primeiro acesso com troca obrigatória de senha e renovação transparente da sessão
- [x] Perfis OPERACIONAL, SUPERVISOR, ADMIN e CLIENTE
- [x] Cadastro e vínculo de clientes/filiais por CNPJ
- [x] Relação N:N entre usuários e filiais
- [x] Lançamento e edição de retrabalhos com auditoria
- [x] Precificação histórica por vigência
- [x] Tarifas com 4 casas decimais
- [x] Etiqueta de Validade e Validade inserida descontinuadas (histórico preservado)
- [x] RFID renomeado para RFID/ADIPAC, independente da Nacionalização
- [x] Controle de Mão de Obra diário (casa × terceiros) por filial
- [x] Cancelamento financeiro auditável por SUPERVISOR/ADMIN
- [x] Dashboard CLIENTE por competência
- [x] Filtro CLIENTE por filial/CNPJ e busca local
- [x] Preload do workspace antes de liberar a interface
- [x] Navegação entre abas sem nova leitura desnecessária
- [x] Sidebar expansível/recolhível e drawer mobile
- [x] Favicon e identidade de navegador validados no CI
- [x] Baseline visual PrimeReact alinhado à identidade Unilog
- [ ] Validar visualmente MultiSelect, Calendar e Dialog após o último deploy
- [ ] Refinar o dashboard CLIENTE sem alterar o baseline aprovado

## 💻 Pré-requisitos

Antes de alterar ou publicar o projeto, confirme:

- Node.js 20
- npm
- acesso ao repositório `srcarneiro1/retrabalho-controle-unilog`
- projeto Cloudflare Pages vinculado à branch `main`
- Apps Script vinculado à planilha de produção
- acesso à planilha `Retrabalho Controle - Unilog`
- leitura deste arquivo antes de qualquer alteração estrutural ou visual

Dependências principais:

- Next.js 15.5.25
- React 19.2.8
- PrimeReact 10.9.9
- PrimeIcons
- Google Apps Script
- Google Sheets
- Cloudflare Pages + Pages Functions

## 🚀 Instalando e executando

Instalação local:

```bash
npm install
```

Build de produção:

```bash
npm run build
```

O build executa:

```text
next build
node scripts/copy-next-export.mjs
```

Saída esperada:

```text
dist/
```

O GitHub Actions valida o build antes de considerar a versão segura para deploy.

## ☕ Usando o sistema

### Perfis

**OPERACIONAL**
- cria retrabalhos;
- visualiza apenas filiais vinculadas;
- não edita registros;
- não acessa administração.

**SUPERVISOR**
- cria e edita retrabalhos;
- acessa auditoria e preços;
- pode cancelar cobrança;
- respeita o escopo de filiais vinculadas.

**ADMIN**
- possui todas as permissões do SUPERVISOR;
- administra usuários;
- cria novas vigências de preços;
- sem vínculo explícito de filial, acessa todas as filiais ativas;
- pode ser restringido por vínculos explícitos.

**CLIENTE**
- somente leitura;
- consulta obrigatoriamente por competência `AAAA-MM`;
- pode possuir vários CNPJs do mesmo cliente;
- enxerga apenas CNPJs vinculados;
- usa dashboard mensal com filtro por filial/CNPJ e busca;
- acessa auditoria do período e exportação;
- **não** acessa a tabela de preços (oculta na interface e bloqueada no gateway e no Apps Script).

### Primeiro acesso

A senha inicial é temporária.

Quando `TROCA_SENHA_OBRIGATORIA=SIM`:

1. o usuário autentica;
2. permanece na experiência de primeiro acesso;
3. define a nova senha;
4. o backend atualiza a senha;
5. o gateway renova a sessão;
6. o usuário segue autenticado sem logout visual ou novo login manual.

## 🧱 Arquitetura

Fluxo principal:

```text
Browser
  ↓
Cloudflare Pages
  ↓
Pages Functions
  ↓
Google Apps Script
  ↓
Google Sheets
```

Responsabilidades:

- **Next.js/React:** interface e experiência do usuário;
- **Pages Functions:** autenticação, autorização e gateway;
- **Apps Script:** regras de negócio e persistência;
- **Google Sheets:** base operacional e histórica.

### Cloudflare

Configuração:

- build: `npm run build`
- output: `dist`
- produção: branch `main`

Variáveis/segredos:

- `APPS_SCRIPT_URL`
- `APPS_SCRIPT_GATEWAY_TOKEN`
- `APP_SESSION_SECRET`

### Apps Script

Script Properties:

- `SPREADSHEET_ID`
- `GATEWAY_TOKEN`
- `AUTH_PASSWORD_PEPPER`

API health atual:

```text
API_VERSION = 2026.10.01.4
```

A raiz `/exec` e `/exec?route=health` retornam health JSON.

Alterações em `apps-script/*.gs` no GitHub **não atualizam automaticamente** a implantação. Sempre copiar os arquivos alterados para o editor do Apps Script e publicar **nova versão da implantação existente**.

## 🗃️ Base de dados

**Spreadsheet ID**

```text
1Bshvpsh-_gaUx5DX4-PXSLZ3HGXIHluNVKhU8FXFj04
```

Abas:

- `RETRABALHOS`
- `USUARIOS` — oculta
- `AUDITORIA` — oculta
- `CONFIG` — oculta
- `TABELA_PRECOS` — oculta
- `CLIENTES_FILIAIS` — visível
- `USUARIO_FILIAIS` — oculta
- `MAO_DE_OBRA` — criada automaticamente pelo Apps Script no primeiro uso

### Clientes e filiais

`CLIENTES_FILIAIS` contém:

- CNPJ
- NOME_CLIENTE
- FILIAL
- ATIVO

Regras:

- CNPJ é chave única;
- deve resultar em 14 dígitos após normalização;
- Nome do Cliente e Filial são obrigatórios;
- não apagar filial com histórico;
- para encerrar uso, definir `ATIVO=NAO`;
- filial inativa não recebe novos lançamentos, mas permanece no histórico.

`USUARIO_FILIAIS` implementa a relação N:N matrícula ↔ CNPJ.

`RETRABALHOS` mantém snapshot de:

- `CNPJ_CLIENTE`
- `NOME_CLIENTE`
- `FILIAL`

Renomear um cadastro não altera o histórico já gravado.

## 💰 Preços e cobrança

Regra vigente desde 01/10/2026 (revisada em 05/10/2026):

- Nacionalização = **R$ 0,4100**
- RFID/ADIPAC = **R$ 0,1900** por unidade (RFID, ADIPAC ou os dois = mesma tarifa, cobrada uma vez)
- Nacionalização + RFID/ADIPAC = **R$ 0,6000**
- Etiqueta de Validade: **descontinuada** em 05/10/2026

Regras:

- tarifas unitárias são persistidas e exibidas com 4 casas decimais;
- Nacionalização e RFID/ADIPAC são opcionais e independentes; o lançamento exige ao menos uma etiqueta;
- a regra antiga "RFID não pode superar Nacionalização" foi removida;
- novos lançamentos gravam `ETIQUETAS_VALIDADE = 0` e `DATA_VALIDADE_INSERIDA` vazia;
- edição de registro histórico preserva a quantidade de Etiqueta de Validade já gravada (não altera cobrança antiga);
- as colunas `ETIQUETAS_RFID`, `PRECO_RFID_ADICIONAL_UNIT`, `VALOR_RFID_ADICIONAL` (retrabalho e tabela de preços) mantêm o nome técnico e passam a representar RFID/ADIPAC;
- preços são controlados por vigência em `TABELA_PRECOS`;
- nova vigência deve ser posterior à última;
- histórico de preços nunca é sobrescrito;
- cada retrabalho grava snapshot dos preços utilizados.

Campos financeiros relevantes do retrabalho incluem:

- `ID_PRECO`
- `PRECO_NACIONALIZACAO_UNIT`
- `PRECO_RFID_ADICIONAL_UNIT`
- `PRECO_VALIDADE_UNIT`
- `VALOR_NACIONALIZACAO`
- `VALOR_RFID_ADICIONAL`
- `VALOR_VALIDADE`
- `VALOR_TOTAL_COBRANCA`

### Cancelamento de cobrança

Somente SUPERVISOR e ADMIN.

Regras:

- motivo obrigatório;
- retrabalho não é excluído;
- valor original permanece gravado;
- `valorCobrancaEfetiva = 0` quando cancelado;
- KPIs e exportação usam valor efetivo;
- grava data, matrícula e motivo;
- gera evento `CANCELAR_COBRANCA` em `AUDITORIA`;
- registro cancelado não pode ser editado posteriormente.

## 👷 Controle de Mão de Obra

Aba `MAO_DE_OBRA` (criada automaticamente pelo `LaborService.gs`).

Campos: `ID_MAO_OBRA`, `DATA`, `CNPJ_CLIENTE`, `NOME_CLIENTE`, `FILIAL`, `QTD_CASA`, `QTD_TERCEIROS`, `QTD_TOTAL`, `OBSERVACAO`, autor/data de criação e atualização, `VERSAO`, `ATIVO`, `REQUEST_ID`.

Regras:

- um registro por dia e por filial;
- exige ao menos uma pessoa (casa ou terceiros);
- OPERACIONAL, SUPERVISOR e ADMIN lançam; somente SUPERVISOR e ADMIN editam;
- CLIENTE não acessa (bloqueado no gateway e no Apps Script);
- SUPERVISOR e ADMIN podem **inativar** um lançamento (motivo obrigatório): `ATIVO=NAO` + `INATIVADO_EM`, `INATIVADO_POR`, `MOTIVO_INATIVACAO`; sai da lista e dos totais, libera a data/filial para novo lançamento e gera evento `INATIVAR` na auditoria; nada é apagado da planilha;
- gateway: `PATCH /api/mao-de-obra` → ação `INATIVAR`;
- respeita o escopo de filiais do usuário;
- criação usa `REQUEST_ID`, edição usa `VERSAO`, auditoria com entidade `MAO_DE_OBRA`;
- gateway: `GET/POST/PUT /api/mao-de-obra` → rota Apps Script `maodeobra`;
- bootstrap retorna `labor` para perfis internos.

## 🔐 Segurança e consistência

- JWT HttpOnly, Secure e SameSite=Lax;
- sessão de 8 horas;
- senha nunca é persistida em texto puro;
- hash iterativo SHA-256 + salt individual + pepper;
- segredos permanecem apenas em Cloudflare/Apps Script;
- `APP_SESSION_SECRET` somente no Cloudflare;
- `AUTH_PASSWORD_PEPPER` somente no Apps Script;
- `APPS_SCRIPT_GATEWAY_TOKEN` deve corresponder ao `GATEWAY_TOKEN`;
- alterações de perfil/status são exclusivas de ADMIN;
- CSV aplica mitigação de Formula Injection.

Consistência:

- edição usa controle otimista por `VERSAO`;
- criação de retrabalho usa `REQUEST_ID`;
- criação de preço usa `REQUEST_ID`;
- histórico usa snapshots antes/depois em `AUDITORIA`;
- nunca executar retry automático de mutação;
- resposta ambígua de mutação deve ser reconciliada por leitura;
- redirect final do ContentService é lido por GET;
- nunca repetir POST no host de conteúdo.

## 🎨 Identidade visual

Fontes de verdade:

- Extra Cost Control: `docs/PRIMEREACT_DESIGN_SYSTEM.md`
- BI Logístico V2: `MEMORIA_IDENTIDADE_VISUAL.md`
- este arquivo para decisões específicas do Retrabalho

Regras canônicas:

- vermelho Unilog: `#db0812`
- hover vermelho: `#b8070f`
- sidebar: gradiente `#171b24 → #202632`
- item ativo: `#303642` + faixa vermelha
- canvas: `#f5f6f8`
- superfície: branco
- borda: `#e2e5e9`
- logo oficial: `/brand/unilog-logo-white-transparent.svg`
- favicon: `/brand/unilog-favicon-red.svg`
- título: `Retrabalho | Unilog Express`
- não permitir azul/índigo visível do tema Lara
- Roboto é carregada explicitamente via Google Fonts, com pesos 300/400/500/600/700
- controles nativos e PrimeReact herdam a mesma Roboto; não confiar apenas em fallback local do sistema

Geometria aprovada:

- sidebar desktop expandida: 244 px
- sidebar recolhida: 72 px
- drawer mobile: breakpoint 1100 px
- cards: raio 14 px
- dialogs/popups: raio 14 px
- ações de tabela: compactas e geometricamente iguais
- edição: neutra
- cancelamento: vermelho
- inputs desktop: compactos
- inputs textuais mobile: 16 px para evitar zoom automático do iOS
- overlays PrimeReact: densidade compacta Unilog, sem tipografia ampliada do Lara

### Carregamento do workspace

Após login:

1. carregar módulos permitidos ao perfil;
2. exibir `Preparando seu ambiente`;
3. não mostrar KPIs zerados ou mensagens falsas durante o carregamento;
4. liberar o workspace somente após o bootstrap.

Após o bootstrap:

- trocar entre Lançamentos, Auditoria, Preços e Usuários não dispara nova leitura;
- nova consulta ocorre somente em refresh explícito, mutação ou mudança de competência do CLIENTE.

## 📫 Contribuindo e mantendo o projeto

Antes de alterar:

1. ler esta memória;
2. identificar quais regras/baselines podem ser afetados;
3. comparar com o estado atual da `main`;
4. evitar substituir uma solução aprovada por implementação genérica anterior.

Durante a alteração:

1. fazer mudanças específicas e incrementais;
2. preservar regras de negócio já aprovadas;
3. preservar acessibilidade mobile;
4. preservar identidade visual;
5. não adicionar retry em mutações.

Depois da alteração:

1. executar/validar build;
2. conferir GitHub Actions;
3. confirmar ausência de regressão;
4. atualizar esta memória;
5. registrar a próxima etapa.

## 🛡️ Baseline de não-regressão

Os itens abaixo são sucessos consolidados e não devem retroceder:

- shell/sidebar canônicos;
- topbar full-width e workspace centralizado;
- favicon e título validados pelo CI;
- preload inicial do workspace;
- navegação entre abas sem fetch desnecessário;
- dashboard CLIENTE mensal;
- competência CLIENTE exibida como `Mês AAAA` (ex.: `Outubro 2026`);
- filtro CLIENTE por filial/CNPJ somente quando houver mais de uma filial vinculada;
- CLIENTE com uma única filial assume automaticamente seu CNPJ e não vê a opção `Todas as filiais`;
- exportação CLIENTE usa ação `Baixar CSV` e respeita os filtros locais;
- ações de tabela compactas;
- cancelamento vermelho e auditável;
- precificação de 4 casas decimais;
- relação usuário ↔ filiais;
- mobile sem zoom automático em inputs;
- overlays PrimeReact compactos;
- dialogs com raio e clipping consistentes;
- layout desktop responsivo pela largura útil, sem depender de métricas específicas de Chrome/Edge/Opera;
- primeiro acesso sem novo login manual.

Uma alteração que viole qualquer item acima deve ser considerada regressão até revisão explícita.

## 🗺️ Próxima etapa

- [ ] Validar visualmente o deploy dos overlays `MultiSelect`, `Calendar` e `Dialog` em desktop
- [ ] Validar os mesmos overlays em mobile
- [ ] Confirmar `Criar usuário` compacto no desktop e full-width somente no mobile
- [ ] Validar shell, formulários e tabelas em Chrome, Edge, Opera e Safari
- [ ] Validar visualmente competência, exportação e filtro condicional de filial no dashboard CLIENTE
- [ ] Refinar o dashboard CLIENTE mantendo todas as regras acima

## 📝 Registro de decisões

As decisões deste arquivo têm precedência sobre implementações antigas do projeto quando houver conflito.

Ao aprovar uma nova regra:

1. registrar a decisão;
2. atualizar o checklist;
3. atualizar o baseline se ela se tornar um sucesso consolidado;
4. substituir a seção `Próxima etapa` pela nova sequência pendente.

Este arquivo deve permanecer curto o suficiente para leitura operacional, mas completo o suficiente para reconstruir o estado atual do projeto sem depender do histórico do chat.


## ⚡ Paridade com BI Logístico — diagnóstico 02/10/2026

Diferenças confirmadas e corrigidas:
- Retrabalho utilizava controles de 42 px; BI usa 40 px.
- Retrabalho utilizava topbar de 62/64 px; BI usa 60 px.
- Retrabalho não mostrava status explícito de conexão; agora usa `Base conectada` após bootstrap bem-sucedido.
- Retrabalho fazia múltiplas chamadas iniciais ao Apps Script; agora usa uma rota única de bootstrap.
- `Repository.gs` passou a cachear headers e leituras de abas dentro da mesma execução do Apps Script para evitar leituras repetidas da planilha.
- favicon possuía múltiplas fontes concorrentes; o baseline passa a exigir uma única referência versionada ao SVG oficial em `/brand/unilog-favicon-red.svg`.

Bootstrap:
- Cloudflare: `GET /api/bootstrap`.
- Apps Script: rota `bootstrap`, ação `CARREGAR`.
- CLIENTE troca competência por `GET /api/bootstrap?period=1&mes=AAAA-MM`.
- bootstrap retorna preços, filiais, lançamentos, auditoria e, para ADMIN, usuários + catálogo completo de filiais em uma única travessia Cloudflare → Apps Script.

Versão esperada do Apps Script:
`2026.10.05.7` (processos + lançamento em lote, filtro de status da mão de obra, inativação de mão de obra, SKU/descrição obrigatórios também na edição, lock de gravação, `LaborService.gs`, bloqueio de preços para CLIENTE).

Arquivos Apps Script que precisam estar publicados:
- `Api.gs`
- `BootstrapService.gs`
- `Repository.gs`

### Baseline de paridade com BI
- controle desktop: 40 px;
- botão padrão: 38 px;
- topbar: 60 px;
- sidebar: 244/72 px;
- tipografia da sidebar: Roboto carregada 12 px / peso 650, ícones 15 px, itens 44 px;
- label administrativo: 8 px / peso 800 / tracking 0,09em;
- rodapé da sidebar: nome 11 px, metadado 9 px e ações 40 px;
- status de conexão: ponto verde + `Base conectada`;
- favicon: uma única referência ao SVG oficial;
- bootstrap inicial: uma única chamada da aplicação ao backend;
- mobile mantém 44 px para toque e oculta o status de conexão para preservar espaço.

### Próxima etapa técnica
- [ ] Publicar `Api.gs`, `BootstrapService.gs` e `Repository.gs` no Apps Script.
- [ ] Criar nova versão da implantação existente e confirmar health `2026.10.02.1`.
- [ ] Validar tempo de bootstrap após publicação.
- [ ] Confirmar no HTML exportado que existe exatamente uma referência de favicon.
- [ ] Comparar lado a lado BI Logístico × Retrabalho em 1440 px e 1920 px antes de novos ajustes visuais.


### Diagnóstico de tipografia da sidebar — 02/10/2026

Diferença de tipografia detectada entre BI Logístico e Retrabalho:
- BI Logístico carrega Roboto explicitamente pelo Google Fonts.
- Retrabalho declarava `Roboto`, mas não carregava o arquivo da fonte.
- em ambientes sem Roboto instalada localmente, especialmente macOS, o Retrabalho podia cair em Arial/Helvetica e parecer menor/mais estreito mesmo usando os mesmos `12px`.
- correção: carregar a mesma família/pesos do BI e aplicar `font-synthesis:none`, `text-rendering:optimizeLegibility` e herança tipográfica em controles/PrimeReact.

Regra de não-regressão:
- não aumentar `font-size` da sidebar para compensar visualmente fallback de fonte;
- primeiro garantir que a Roboto canônica foi carregada;
- sidebar continua 244 px expandida, 72 px recolhida, itens 44 px, texto 12 px/650 e ícones 15 px.

Próxima validação:
- [ ] comparar novamente BI Logístico × Retrabalho após deploy com Roboto carregada;
- [ ] conferir zoom do navegador em 100% nos dois domínios antes de alterar dimensões estruturais.


## 🩺 Diagnóstico full stack — 05/10/2026 (revisão 2)

### Favicon
- causa: `unilog-favicon-red.svg` era o logo inteiro em vermelho (viewBox 1200×647, retangular); a aba do navegador é quadrada e o ícone era achatado/cortado;
- causa: não existia `/favicon.ico` (fallback automático de navegadores e Safari anterior ao suporte a SVG) nem `apple-touch-icon`;
- correção: SVG com canvas quadrado `0 -276.5 1200 1200` (arte oficial intacta), `public/favicon.ico` (16/32/48) e `public/apple-touch-icon.png` (180, fundo branco);
- baseline mantido: exatamente uma tag `rel="icon"`; versão `?v=20261005-1`;
- se a Unilog tiver um símbolo quadrado oficial, substituí-lo melhora a leitura em 16 px.

### Cores roxas/indigo
- causa: o tema Lara Light Indigo usa ~320 cores indigo fixas (hex), não apenas variáveis CSS; overrides pontuais deixavam escapar hover, foco, selecionado, calendário, paginação e checkbox;
- correção: `scripts/build-unilog-theme.mjs` gera `src/app/generated/primereact-unilog-theme.css` a cada build, trocando a escala indigo pela escala vermelho Unilog e removendo a Inter embutida (Roboto é canônica);
- o build falha se sobrar indigo no tema gerado; o CI falha se houver indigo no CSS final;
- `src/app/generated/` é artefato de build (gitignored).

### Sidebar
- causa: em desktop, `height:100dvh` + `overflow:hidden` sem rolagem no menu cortava itens e o rodapé em telas baixas/zoom;
- causa: o estado recolhido só era lido no carregamento; redimensionar a janela não ajustava a sidebar nem fechava o drawer;
- causa: regras legadas de `styles.css` (≤ 900 px) escondiam nome, "Alterar senha" e "Sair" no drawer;
- correção: `responsive-shell.css` (carregado por último) e `matchMedia` em `page.tsx`:
  - ≤ 1100 px: drawer (ESC fecha, fundo não rola);
  - 1101–1279 px: recolhida automaticamente (expansão temporária não altera a preferência);
  - ≥ 1280 px: preferência do usuário salva.

### Sidebar sticky (revisão 3)
- causa: `html,body{overflow-x:hidden}` em `mobile-polish.css` transforma o body em container de rolagem e quebra `position:sticky`; a sidebar rolava junto com a página;
- correção: `overflow-x:clip` em `responsive-shell.css` e sticky reafirmado acima de 1100 px.

### Filtro mensal para perfis internos (revisão 3)
- Histórico de retrabalho e Mão de obra abrem no mês mais recente com dados (sem dados: mês corrente);
- opção `Todos os meses` disponível;
- KPIs e exportação CSV respeitam o mês selecionado;
- após salvar um lançamento, o filtro acompanha o mês do registro salvo;
- filtro é local (os dados já vêm no bootstrap); CLIENTE mantém a competência no topo, carregada pelo backend;
- próxima evolução sugerida: quando o volume crescer, carregar perfis internos por mês no backend, como já é feito para CLIENTE.

## ✅ Revisão de fechamento — 05/10/2026

- **Concorrência:** `doPost` usa `LockService` em toda ação que grava. Sem lock, duas gravações simultâneas podiam calcular a mesma linha (`getLastRow()+1`) e uma sobrescrevia a outra; também furavam `REQUEST_ID` e "um registro por dia/filial". Leituras não disputam o lock. Ocupado por mais de 20 s → mensagem amigável, sem retry automático.
- **Gateway:** a ação (`acao`) é sempre definida pelo endpoint e aplicada depois do corpo da requisição; o corpo não consegue trocar a ação.
- **Bootstrap resiliente:** falha ao carregar mão de obra não bloqueia o restante do sistema.
- **Auditoria:** SUPERVISOR e ADMIN veem eventos `MAO_DE_OBRA` das filiais do seu escopo.
- **Pendência de governança:** o repositório está público e a documentação contém o ID da planilha de produção; recomenda-se torná-lo privado.

- **SKU e descrição:** obrigatórios na criação e na edição (antes a edição aceitava vazio); validados também na interface.
- **Filtro de status da cobrança (Histórico/Acompanhamento):** `Ativos` (padrão), `Cancelados` e `Todos os status`. A tabela e o CSV seguem o filtro; os cards também, exceto em `Todos os status`, onde cancelados aparecem na tabela mas não somam nos cards. Antes, registros/unidades/etiquetas somavam cancelados enquanto o valor os excluía. Em `Cancelados` o card de valor vira `Valor cancelado` (soma do valor original).
- **Filtro de status da Mão de obra:** `Ativos` (padrão), `Inativados` e `Todos os status`. O Apps Script passa a devolver ativos e inativados com `ativo`, `inativadoEm`, `inativadoPor` e `motivoInativacao`; a interface filtra. Inativados aparecem com tag `INATIVO` e motivo, sem ações de edição/inativação, e não podem ser editados no backend. Em `Todos os status`, inativados aparecem na tabela mas não somam nos cards. CSV inclui status e dados da inativação.

## 📦 Processos e lançamento em lote — 05/10/2026 (API 2026.10.05.7)

### Processos (planilha do cliente)
- tela **Processos** (perfis internos): número do processo + filial + planilha (.xlsx, .xls ou .csv, até 10 MB);
- o arquivo original é salvo na pasta do Google Drive definida em `PROCESS_FOLDER_ID` (Script Property);
- colunas lidas (sem diferenciar acento/maiúscula/pontuação, cabeçalho em qualquer uma das 30 primeiras linhas): `CÓD DE BARRAS` → SKU e `DESCRICAO ANVISA` → descrição;
- Excel é convertido temporariamente em Planilha Google para leitura (serviço avançado **Drive API v3**) e a cópia temporária vai para a lixeira;
- linhas sem código, sem descrição ou com código repetido são ignoradas e contadas;
- número do processo é único entre processos ativos;
- abas criadas automaticamente: `PROCESSOS` e `PROCESSO_SKUS`;
- auditoria: entidade `PROCESSO`, ação `CRIAR`.

### Lançamento em lote
- "Novo lançamento" exige selecionar o **processo** e de **1 a 100 SKUs** do processo;
- cada SKU vira um registro em `RETRABALHOS` (edição, cancelamento e auditoria continuam por registro), com `NUMERO_PROCESSO`, `ID_PROCESSO` e `ID_LOTE`;
- a descrição sempre vem do processo (o navegador não consegue alterá-la);
- data é comum ao lote; filial é a do processo;
- idempotência: linhas gravadas com `REQUEST_ID` `<lote>:<n>`; gravação e auditoria em uma única escrita (`appendMany`/`logMany`).

### Serviços por SKU
- **Quantidade retrabalhada**: obrigatória (≥ 1);
- **Etiquetas nacionalização**, **RFID/ADIPAC** e **Transformação em tester**: não podem passar da quantidade retrabalhada;
- **Etiquetas confeccionadas**: independentes da quantidade;
- ao menos um serviço por SKU;
- `TOTAL_ETIQUETAS` = nacionalização + RFID/ADIPAC + confeccionadas (tester não é etiqueta).

### Preços
- `TABELA_PRECOS` ganha `VALOR_TESTER` e `VALOR_CONFECCAO` (colunas criadas automaticamente);
- Etiqueta confeccionada = **R$ 0,1500**; Transformação em tester = **a definir** (0 até nova vigência);
- vigências anteriores não têm essas tarifas (valem 0): criar nova vigência para começar a cobrar.

### Configuração única no Apps Script
1. Script Property `PROCESS_FOLDER_ID` = ID da pasta do Drive;
2. habilitar o serviço avançado **Drive API** (v3) — já declarado em `appsscript.json`;
3. executar `autorizarPastaProcessos()` uma vez no editor e aceitar as permissões do Drive;
4. publicar nova versão da implantação.

### Testes
- backend validado em planilha simulada (25 cenários): upload CSV, colunas ausentes, duplicidade de processo, lote, cálculo, idempotência, regras de quantidade, SKU fora do processo/repetido, limite de 100, edição e bloqueio do CLIENTE;
- conversão de Excel depende do Drive real: validar com a primeira planilha do cliente.

## 📱 Registros no celular — padrão Extra Cost Control (05/10/2026)

- `src/app/mobile-records.css` (carregado por último) replica o padrão do projeto Extra Cost Control: até **820 px** cada linha das tabelas vira um **cartão**; desktop continua tabela;
- **rótulos vêm da coluna** via `data-label` (helper `cell(label, role)` em `page.tsx`, usando `pt.bodyCell` do PrimeReact 10.9). Antes eram fixados por posição (`nth-child`) em `mobile-polish.css` e estavam desalinhados após a inclusão de Processo/Tester/Confecc. e remoção de Validade — **não voltar a usar nth-child para rótulos**;
- papéis: `title` (topo do cartão, largura total, negrito), `wide` (linha inteira), `actions` (rodapé, botões de 44 px; oculto se vazio);
- títulos por tabela: Retrabalho = Descrição; Processos = Processo; Mão de obra = Data; Auditoria = Data/hora; Preços = Início; Usuários = Nome;
- 2 colunas por cartão até 361 px; 1 coluna em telas ≤ 360 px;
- lançamento em lote: até 760 px cada SKU vira cartão com os 5 campos (inputs de 16 px para evitar zoom do iOS), remover no canto, linha com erro destacada;
- especificidade reforçada (`.p-datatable.mobile-record-table`) para vencer `component-geometry.css` independentemente da ordem do bundle;
- validado em Chromium headless: 1280 px (tabela), 820/390 px (cartões em 2 colunas), 360 px (1 coluna), sem rolagem horizontal.
