# MEMÓRIA TÉCNICA — EXTRA COST CONTROL UNILOG

**Projeto:** Extra Cost Control — UNILOG  
**Repositório oficial:** `srcarneiro1/Extra-Cost-Control-Unilog`  
**Status:** MVP 1  
**Última consolidação:** 01/09/2026

---

# 1. INSTRUÇÃO OBRIGATÓRIA PARA RETOMADA

Antes de propor, implementar ou alterar qualquer parte deste projeto, leia integralmente este arquivo.

Considere como decisões vigentes:

1. **Não usar Supabase neste MVP.**
2. Usar **Google Planilhas como persistência operacional**.
3. Usar **Google Apps Script como API e camada de regras de negócio**.
4. Usar **Cloudflare Pages** para o frontend React e, quando necessário, **Cloudflare Pages Functions/Worker** como camada intermediária segura.
5. Usar **GitHub privado** como fonte oficial do código, com branches, commits, Pull Requests e merges.
6. Não armazenar planilhas operacionais, dados pessoais, tokens, chaves ou segredos no GitHub.
7. Preservar integralmente as bases legadas e migrá-las apenas de forma controlada.
8. Mão de obra e alimentação/bebidas compartilham o processo de Custos Extras, mas **não compartilham a mesma lógica financeira**.
9. Competência financeira obrigatória: **dia 21 até dia 20 do mês seguinte**.
10. Priorizar um MVP simples, incremental e verificável. Não reabrir arquitetura maior sem necessidade concreta.

---

# 2. OBJETIVO DO MVP 1

Criar uma aplicação web para controlar Custos Extras da UNILOG, evoluindo o processo atual de Google Forms + Google Sheets sem transformar o MVP em um ERP.

Escopo inicial:

- mão de obra terceirizada;
- alimentação e bebidas;
- operação/depositante;
- supervisor;
- fornecedor;
- responsabilidade financeira CLIENTE ou UNILOG;
- centro de custo quando aplicável;
- quantidade solicitada;
- quantidade realizada/comparecida para mão de obra;
- preço vigente por data;
- snapshot imutável do preço aplicado;
- custo previsto;
- custo realizado;
- rastreabilidade básica;
- preparação para incorporação do legado.

Objetivos de processo:

```text
entrada padronizada
→ cadastros controlados
→ preço histórico confiável
→ solicitado x realizado separados
→ API desacoplada da planilha
→ histórico preservado
```

---

# 3. ARQUITETURA DO MVP

```text
USUÁRIO
   ↓
CLOUDFLARE PAGES
React + TypeScript + Vite
   ↓
CLOUDFLARE FUNCTION / WORKER
quando houver segredo ou operação protegida
   ↓
GOOGLE APPS SCRIPT WEB APP
API + regras de negócio
   ↓
GOOGLE PLANILHAS
persistência operacional
```

Regra de desacoplamento:

```text
Frontend → API → Planilha
```

Nunca:

```text
Frontend → coluna/célula específica da planilha
```

O frontend deve consumir contratos de API. Isso permite substituir a persistência futuramente sem reescrever toda a aplicação.

---

# 4. SEGURANÇA

Segredos devem existir apenas em:

- Cloudflare Secrets / Environment Variables;
- Apps Script `PropertiesService`.

Nunca em:

- código React entregue ao navegador;
- GitHub;
- `.env` commitado;
- células de planilha utilizadas como segredo.

Quando necessário:

```text
Browser
  ↓
Cloudflare Function
  ↓ segredo protegido
Apps Script
```

O repositório deve permanecer privado.

---

# 5. GOOGLE PLANILHA CENTRAL

Planilha oficial:

`Controle de Custos Extras - UNILOG`

ID atual:

`18dpLKAFHQI3rHRgn1XzP0cAtzYzZsrU-r6FulFkHXvo`

Estado atual organizado:

```text
RESPOSTAS_FORM
SOLICITACOES
CAD_OPERACOES
CAD_SUPERVISORES
CAD_FORNECEDORES
CAD_ATIVIDADES
CAD_FUNCOES
CAD_PRODUTOS
```

`RESPOSTAS_FORM` deve ser preservada como entrada bruta/contingência do Google Forms.

`SOLICITACOES` ainda deve ter seu dicionário definitivo fechado antes de receber cabeçalhos de produção.

`CAD_OPERACOES` e `CAD_SUPERVISORES` foram estruturadas, porém devem receber apenas dados ativos confirmados; não preencher por suposição.

---

# 6. CADASTROS DO MVP

## 6.1 Operações

```text
CAD_OPERACOES
OPERACAO | ATIVO
```

Usar nomes padronizados daqui para frente. Variações históricas serão tratadas em mapa de equivalência na migração.

## 6.2 Supervisores

```text
CAD_SUPERVISORES
SUPERVISOR | ATIVO
```

Usar nome padronizado.

## 6.3 Fornecedores

```text
CAD_FORNECEDORES
FORNECEDOR | MAO_DE_OBRA | ALIMENTACAO | ATIVO
```

Cadastro inicial já estruturado:

- MULT;
- AGUIA;
- ALMIRANTE;
- W-SLOW.

## 6.4 Atividades

Atividade representa o **trabalho executado**.

Cadastro inicial:

- SEPARACAO;
- EMBALAGEM;
- CARGA E DESCARGA;
- EXPEDICAO;
- ETIQUETAGEM;
- RESSUPRIMENTO;
- MOVIMENTACAO;
- PREPARACAO DE SAMPLING;
- OUTRO.

## 6.5 Funções / recursos

```text
CAD_FUNCOES
FUNCAO | ATIVO
```

Inicialmente:

- AUXILIAR OPERACIONAL;
- OPERADOR DE EMPILHADEIRA.

Regra fundamental:

> OPERADOR DE EMPILHADEIRA é função/recurso, não atividade.

## 6.6 Produtos

```text
CAD_PRODUTOS
PRODUTO | CATEGORIA | ATIVO
```

Categorias:

- ALIMENTACAO;
- BEBIDA.

Cadastro inicial inclui:

- X-TUDO;
- X-FRANGO;
- PODRAO;
- GOURMET;
- COCA-COLA 2L;
- COCA-COLA 600ML;
- COCA-COLA LATA;
- GUARANA 2L.

O catálogo deve ser validado contra o histórico antes de ser tratado como definitivo.

---

# 7. SOLICITAÇÃO DE MÃO DE OBRA

Campos funcionais previstos:

- Supervisor;
- Operação / Depositante;
- Data de execução;
- Atividade;
- Função / Recurso;
- Turno;
- Fornecedor;
- Quantidade solicitada;
- Volume de referência opcional;
- Unidade do volume opcional;
- Justificativa / detalhamento;
- Responsável pelo custo;
- Centro de custo quando UNILOG.

Turno é manual:

- DIURNO;
- NOTURNO.

Não inferir turno por horário no MVP.

Quantidade comparecida é informação administrativa posterior à execução.

Pode ser zero e pode excepcionalmente ser maior que a quantidade solicitada; o sistema deve registrar a realidade e evidenciar a divergência, não bloquear o fato operacional.

Cálculos:

```text
VALOR_PREVISTO = QTD_SOLICITADA × PRECO_UNITARIO_APLICADO
VALOR_REAL = QTD_COMPARECIDA × PRECO_UNITARIO_APLICADO
```

---

# 8. SOLICITAÇÃO DE ALIMENTAÇÃO / BEBIDAS

Campos funcionais previstos:

- Supervisor;
- Operação / Depositante;
- Data de atendimento;
- Fornecedor;
- Alimentação;
- Quantidade alimentação;
- Bebida;
- Quantidade bebida;
- Justificativa;
- Responsável pelo custo;
- Centro de custo quando UNILOG.

Pelo menos alimentação ou bebida deve existir.

Não existe `quantidade comparecida` para produtos.

Cálculo financeiro deriva da quantidade solicitada e do preço congelado.

---

# 9. RESPONSABILIDADE FINANCEIRA

Campo obrigatório:

```text
CLIENTE
UNILOG
```

Regra CLIENTE:

```text
cliente responsável deriva da própria operação/depositante
centro de custo não é solicitado
```

Regra UNILOG:

```text
centro de custo obrigatório
somente dígitos
armazenar como texto para preservar zeros à esquerda
```

---

# 10. PREÇOS VERSIONADOS

Objetivo: nunca recalcular o passado com o preço atual.

## Mão de obra

```text
PRECOS_MO
FORNECEDOR
FUNCAO
TURNO
VIGENCIA_INICIO
VIGENCIA_FIM
PRECO_UNITARIO
ATIVO
```

## Produtos

```text
PRECOS_PRODUTOS
FORNECEDOR
PRODUTO
VIGENCIA_INICIO
VIGENCIA_FIM
PRECO_UNITARIO
ATIVO
```

Ao aplicar preço, a API grava um snapshot:

```text
PRECO_UNITARIO_APLICADO
```

Esse valor histórico não deve depender de fórmula dinâmica apontando para uma tabela atual.

Antes de cadastrar as regras definitivas de preço, validar vigências e regras atuais. Não codificar novas regras apenas por inferência do legado.

---

# 11. COMPETÊNCIA

Regra obrigatória:

```text
21 de um mês → 20 do mês seguinte
```

A competência deve ser derivada da data operacional da solicitação/item, nunca digitada livremente.

---

# 12. PROTOCOLO E API

Cada solicitação terá identificador próprio gerado pela API. Não usar número da linha da planilha como identificador permanente.

Formato conceitual possível:

```text
CE-2026-000001
```

Contrato mínimo esperado da API:

```text
GET  /health
GET  /cadastros
GET  /solicitacoes
GET  /solicitacoes/:id
POST /solicitacoes
POST /solicitacoes/:id/comparecimento
```

Apps Script usará `doGet(e)` / `doPost(e)` e roteamento interno.

Não fechar o contrato completo antes de concluir o dicionário da aba `SOLICITACOES`.

---

# 13. LEGADO

Fontes existentes:

- `Solicitação de mão de obra terceirizada (respostas)`;
- `Solicitação de Lanches`.

Problemas conhecidos do legado de MO:

- atividade e função misturadas;
- operador de empilhadeira registrado como atividade;
- campo de volume com texto heterogêneo;
- nomes não padronizados;
- linhas vazias com fórmulas;
- preço histórico sujeito a fórmula atual;
- solicitado x realizado divergentes.

Problemas conhecidos do legado de alimentação:

- preços históricos vinculados à tabela atual;
- fornecedores/produtos com variações;
- necessidade de padronização.

Migração futura:

```text
legado
→ staging
→ normalização
→ equivalências
→ validação
→ importação
```

Preservar `ORIGEM`, linha/id original e lote de importação quando aplicável.

Não alterar as bases originais para fazê-las caber no novo modelo.

---

# 14. GOOGLE FORMS

O Google Form pode continuar como:

- contingência;
- fallback;
- transição enquanto o frontend não estiver pronto.

A arquitetura principal do produto será:

```text
Frontend Cloudflare
→ Apps Script API
→ Google Sheets
```

---

# 15. GITHUB / CLOUDFARE / DESENVOLVIMENTO

Repositório oficial:

`srcarneiro1/Extra-Cost-Control-Unilog`

Fluxo preferencial:

```text
feature/* ou fix/*
↓
Pull Request
↓
revisão
↓
merge em main
↓
deploy Cloudflare
```

Evitar mudanças de produção sem commit correspondente.

Estrutura recomendada:

```text
src/
  components/
  pages/
  services/
  types/
  utils/
  styles/
functions/
  api/
apps-script/
  Code.gs
  Api.gs
  SheetRepository.gs
  PricingService.gs
  ValidationService.gs
docs/
public/
MEMORIA_PROJETO.md
README.md
.env.example
.gitignore
package.json
wrangler.jsonc
```

Frontend:

- React;
- TypeScript;
- Vite;
- Cloudflare Pages.

Apps Script também deve ficar versionado no GitHub.

---

# 16. IDENTIDADE VISUAL OBRIGATÓRIA DO PRODUTO

A aplicação deve parecer um produto administrativo/operacional moderno da UNILOG, com alta legibilidade, baixa carga cognitiva, consistência e foco na tomada de decisão.

A identidade visual abaixo é a fonte de verdade do novo projeto.

## 16.1 Princípios

- confiança;
- clareza operacional;
- leitura rápida;
- controle;
- consistência entre telas;
- informação acima de decoração;
- padrões reaproveitáveis em vez de estilos exclusivos por página.

Regra de ouro:

> O usuário aprende um padrão uma vez e deve reconhecê-lo em todas as telas.

## 16.2 Marca e paleta

```css
--brand-primary: #db0812;
--brand-primary-hover: #b8070f;
--brand-primary-soft: #fdecee;

--brand-gray: #494a56;
--brand-gray-dark: #3a3b45;

--status-success: #3f7c59;
--status-success-soft: #edf6f0;
--status-warning: #a87900;
--status-warning-soft: #fff6d8;
--status-danger: #c91a23;
--status-danger-soft: #fff0f1;
--status-neutral: #6f747d;
--status-neutral-soft: #f1f2f4;

--surface-canvas: #f5f6f8;
--surface-primary: #ffffff;
--surface-secondary: #f8f9fa;
--surface-tertiary: #f2f3f5;

--text-primary: #2f3136;
--text-secondary: #5f636b;
--text-muted: #858a93;

--border-default: #e2e4e8;
--border-strong: #cdd0d5;
```

O vermelho da marca é **acento**, CTA e foco. Não deve significar automaticamente erro ou criticidade. Estados usam cores semânticas próprias.

## 16.3 Tipografia

Fonte preferencial digital:

```text
Roboto
```

Hierarquia:

- títulos: Bold/Black;
- corpo: Regular;
- labels: pequenos e semipesados;
- eyebrow: pequeno, tracking alto, caixa alta;
- evitar caixa alta em textos longos.

Base de corpo aproximada: 13px / line-height 1.45 no desktop.

## 16.4 Espaçamento, radius e sombra

Escala de espaçamento:

```text
4 / 8 / 12 / 16 / 24 / 32 / 40 / 48 px
```

Radius:

```text
controle: 8px
card/painel: 11px
pill/badge: 999px
```

Sombras discretas. Priorizar borda + contraste de superfície antes de elevar componentes.

```css
--shadow-card: 0 1px 3px rgba(29,31,35,.035);
--shadow-raised: 0 12px 32px rgba(29,31,35,.10);
```

## 16.5 Shell da aplicação

Desktop:

```text
sidebar escura 236px
→ colapsável para ~68px
workspace claro
```

Sidebar:

- fundo `#494a56`;
- logo UNILOG branco;
- navegação em texto claro;
- item ativo com fundo discreto e rail vertical vermelho;
- usuário no rodapé;
- navegação sem excesso de divisores.

Mobile/tablet:

- sidebar vira drawer lateral;
- backdrop escuro;
- botão de menu com alvo de toque adequado;
- não comprimir a sidebar desktop.

Topbar:

- superfície branca;
- ~56–58px;
- borda inferior discreta;
- título/contexto conciso;
- ações e perfil sem excesso visual.

Conteúdo principal:

```text
max-width aproximado: 1600px
padding desktop: ~30–34px
padding mobile: ~12–18px
```

## 16.6 Anatomia de página

```text
SHELL
↓
PAGE HEADER
↓
MÉTRICAS DE RESUMO quando aplicável
↓
TOOLBAR / FILTROS LOCAIS
↓
CONTEÚDO PRINCIPAL
↓
TABELAS / DETALHES / AÇÕES
```

Page Header:

- eyebrow;
- título principal;
- descrição curta;
- ações à direita no desktop;
- ações abaixo/no fluxo no mobile.

Não criar um cabeçalho diferente para cada página.

## 16.7 Painéis e cards

Painel padrão:

- fundo branco;
- borda `--border-default`;
- radius 11px;
- sombra muito discreta;
- header interno com título + descrição + ações opcionais.

Cards devem ter função clara: KPI, resumo/status, entidade, ação ou informação.

Evitar:

- card dentro de card sem necessidade;
- borda colorida + badge + texto colorido repetindo a mesma severidade;
- muitos KPIs com peso visual idêntico.

## 16.8 Badges e chips

Badge comunica estado.

Chip comunica contexto, categoria ou contagem.

Estados:

```text
SUCESSO → verde
ATENÇÃO → amarelo
ERRO/CRÍTICO → vermelho semântico
NEUTRO/SEM DADOS → cinza
```

Nunca depender somente da cor: usar label, ícone ou texto.

## 16.9 Formulários

Este projeto é centrado em formulários; portanto devem parecer **fluxo de trabalho**, não pilha de inputs.

Estrutura recomendada:

```text
PAGE HEADER
↓
ORIENTAÇÃO / STEPPER se útil
↓
SEÇÃO 1 — contexto
↓
SEÇÃO 2 — necessidade
↓
SEÇÃO 3 — responsabilidade financeira
↓
AÇÕES DO FORM
```

Cada seção:

- card branco;
- borda discreta;
- radius 11px;
- título claro;
- texto auxiliar curto;
- grid de campos.

Desktop:

- usar 2–3 colunas conforme conteúdo;
- campos relacionados ficam próximos.

Tablet:

- reduzir para 2 colunas.

Mobile:

- uma coluna real;
- nada de formulário desktop espremido;
- botões principais em largura total quando necessário.

Inputs/selects:

```text
altura mínima desktop: 40px
altura mínima mobile: 44px
radius: 8px
borda neutra
label visível
foco explícito
```

Textarea mínimo aproximado: 88px.

No iOS/mobile, campos textuais devem usar tamanho que evite zoom automático do navegador.

## 16.10 Stepper

Stepper é orientação, não navegação horizontal obrigatória.

Desktop: grid horizontal compacto.

Mobile:

- continuar integralmente visível quando couber;
- reduzir conteúdo secundário;
- em telas muito estreitas, virar lista vertical;
- nunca exigir swipe horizontal para compreender o fluxo.

## 16.11 Tabelas

Desktop:

- header discreto e compacto;
- primeira coluna concentra identidade principal;
- números alinhados consistentemente;
- hover leve;
- ações explícitas;
- badges para status.

Mobile:

> Tabela não é comprimida. Ela vira lista de record cards.

Padrão:

```text
IDENTIDADE PRINCIPAL + STATUS
metadados
campos-chave em grid
rodapé/ações
```

Não exigir scroll horizontal para informação essencial.

## 16.12 Toolbars e busca

Toolbar local:

- superfície branca;
- borda discreta;
- busca com área flexível;
- filtros previsíveis;
- ação principal clara.

Mobile:

- empilhar filtros;
- sem carrossel obrigatório;
- botões e selects com 44px quando possível.

## 16.13 Loading, vazio, erro e sucesso

Toda superfície assíncrona deve prever:

- loading/skeleton;
- empty state;
- error state;
- success quando aplicável.

Empty state deve explicar:

1. o que não existe;
2. por que pode não existir;
3. o que o usuário pode fazer.

## 16.14 Acessibilidade e interação

Foco visível obrigatório.

Padrão visual do foco:

```css
outline: 2px solid rgba(219,8,18,.62);
outline-offset: 2px;
```

Alvos interativos recorrentes:

```text
desktop: mínimo prático ~40px
mobile: mínimo prático ~44px
```

Hover só deve governar dispositivos que realmente possuem hover.

Estados `disabled` devem reduzir contraste e impedir affordance de clique.

Suportar `prefers-reduced-motion`.

Não usar movimento como requisito para compreender estado.

## 16.15 Responsividade obrigatória

Toda feature deve ser validada em:

```text
Desktop
Tablet
Mobile
Mobile estreito
```

Critérios mínimos:

- nenhum card essencial cortado;
- nenhum stepper requer swipe;
- nenhum resumo requer swipe lateral;
- tabelas viram cards;
- nomes longos quebram corretamente;
- CTAs principais permanecem visíveis;
- forms viram uma coluna real;
- sem overflow horizontal obrigatório;
- touch targets adequados.

## 16.16 Componentização visual

Criar primitives compartilhados desde o início, por exemplo:

```text
AppShell
PageHeader
Panel
SectionHeader
Button
Badge
Chip
SearchField
Toolbar
EmptyState
Skeleton
ResponsiveTable
FormSection
FormStepper
ContextNotice
```

Não duplicar anatomia visual em cada página.

Antes de criar novo CSS, verificar se o comportamento já pertence a um primitive existente.

---

# 17. AUDITORIA MÍNIMA

Planejar aba `AUDITORIA` ou `LOG` com:

```text
TIMESTAMP
USUARIO
ACAO
ENTIDADE
ID_ENTIDADE
VALOR_ANTERIOR
VALOR_NOVO
MOTIVO
```

Alterações administrativas relevantes não devem sobrescrever histórico silenciosamente.

---

# 18. ESCOPO FORA DO MVP 1

Não implementar agora, salvo nova decisão explícita:

- Supabase;
- PostgreSQL dedicado;
- reorganização de outros sistemas;
- arquitetura multiaplicação corporativa;
- dashboard BI sofisticado;
- WhatsApp automático;
- sistema fiscal completo;
- dezenas de status;
- workflow burocrático;
- split complexo de item entre várias NFs.

---

# 19. PRINCÍPIO DE MELHORIA DE PROCESSO

Sempre perguntar:

- esse campo precisa realmente ser digitado?
- podemos derivá-lo?
- existe cadastro controlado?
- estamos preservando o histórico?
- solicitado, realizado e faturado estão separados?
- a regra pertence ao frontend ou à API?
- o fluxo ficou mais simples que o atual?

Digitalizar um processo ruim não é objetivo do projeto.

---

# 20. PRÓXIMAS AÇÕES

Ordem vigente:

1. validar os cadastros ativos de operações e supervisores;
2. fechar o dicionário definitivo da aba `SOLICITACOES`;
3. criar `PRECOS_MO` e `PRECOS_PRODUTOS` somente após validação das regras;
4. definir contrato mínimo da API;
5. implementar Apps Script `health` + leitura de cadastros;
6. implementar criação de solicitação;
7. testar API diretamente;
8. estruturar React/Vite no GitHub;
9. implementar design system e shell conforme seção visual desta memória;
10. conectar Cloudflare ao GitHub;
11. integrar frontend com API;
12. criar fluxo administrativo de quantidade real de MO;
13. somente depois iniciar migração do legado.

Não iniciar pelo dashboard.

---

# 21. COMANDO CURTO DE RETOMADA

Em um novo chat, usar:

```text
Retome o projeto Extra Cost Control UNILOG.

Repositório oficial:
https://github.com/srcarneiro1/Extra-Cost-Control-Unilog

Antes de fazer qualquer alteração, leia integralmente o arquivo MEMORIA_PROJETO.md do repositório e trate-o como fonte de verdade funcional, arquitetural e visual.

Arquitetura vigente: React + TypeScript + Vite no Cloudflare Pages; GitHub para versionamento/PR/merge; Google Apps Script como API; Google Planilhas como persistência. Não usar Supabase.

Planilha oficial: Controle de Custos Extras - UNILOG.

Preserve as bases legadas e não altere outros projetos ou repositórios como parte deste trabalho.

Continue exatamente pela seção “Próximas ações” da memória. Diferencie decisão confirmada de proposta, não invente campos/regras e avance em mudanças pequenas e verificáveis.
```

---

## RESUMO EXECUTIVO

```text
SEM SUPABASE

React + TypeScript + Vite
        ↓
Cloudflare Pages
        ↓
Cloudflare Function quando necessário
        ↓
Apps Script API
        ↓
Google Planilhas

GitHub privado
srcarneiro1/Extra-Cost-Control-Unilog

MVP
├── Mão de obra terceirizada
└── Alimentação / Bebidas

Prioridades
cadastros
→ SOLICITACOES
→ API
→ frontend
→ realizado
→ preços congelados
→ legado
```
