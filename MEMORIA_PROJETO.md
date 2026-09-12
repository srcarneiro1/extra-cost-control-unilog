# MEMÓRIA TÉCNICA — EXTRA COST CONTROL UNILOG

**Projeto:** Extra Cost Control — UNILOG  
**Repositório oficial:** `srcarneiro1/extra-cost-control-unilog`  
**Status:** evolução do MVP / modernização visual em homologação  
**Última consolidação:** 12/09/2026 — Next.js + PrimeReact + audit visual completo

---

# 1. REGRA DE RETOMADA

Antes de alterar o projeto, leia este arquivo e trate-o como fonte de verdade funcional, arquitetural e visual.

Decisões vigentes:

1. **Não usar Supabase.**
2. Google Planilhas é a persistência operacional.
3. Google Apps Script é a API e a camada de regras de negócio.
4. Frontend vigente: **Next.js 15 + React 19 + PrimeReact 10 + PrimeIcons**.
5. Gráficos compatíveis devem usar **PrimeReact Chart + Chart.js**.
6. O frontend é exportado estaticamente e publicado no Cloudflare Pages.
7. Cloudflare Pages Functions permanece como gateway protegido para `/api/*` entre frontend e Apps Script.
8. GitHub privado é a fonte oficial de código, branches, PRs e merges.
9. Segredos somente em Cloudflare Environment/Secrets e Apps Script `PropertiesService`.
10. Bases legadas devem permanecer intactas.
11. Competência financeira usa o ciclo dia 21 → dia 20.
12. A entrada operacional existente via Google Forms permanece válida enquanto não houver decisão explícita para substituí-la.
13. A aplicação autenticada possui perfis `OWNER`, `ADMINISTRATIVO` e `OPERACIONAL`.
14. Regra central: **o solicitante informa a necessidade; o Administrativo decide quem atende.**
15. Fornecedor, preço aplicado e realizado não são preenchidos pelo solicitante.
16. Mudanças devem ser incrementais, testáveis e sem regras de negócio inventadas.
17. PR visual não pode alterar cálculo, preço, competência, Apps Script ou regras de autorização.
18. PR só é mergeado após build verde no head exato e homologação explícita do usuário.

Documento visual complementar obrigatório:

`docs/PRIMEREACT_DESIGN_SYSTEM.md`

---

# 2. OBJETIVO DO SISTEMA

Controlar Custos Extras da UNILOG com rastreabilidade, solicitado x realizado, histórico de preços, tratamento administrativo e leitura executiva/analítica.

Escopo funcional principal:

- mão de obra terceirizada;
- alimentação e bebidas;
- supervisor;
- operação/depositante;
- CLIENTE ou UNILOG como responsável pelo custo;
- centro de custo quando UNILOG;
- quantidade solicitada;
- quantidade comparecida para mão de obra;
- fornecedor definido administrativamente;
- preço vigente por data operacional;
- snapshot do preço aplicado;
- valor previsto;
- valor real;
- produto solicitado x produto aplicado;
- rastreabilidade da origem;
- dashboard executivo e analytics;
- cadastros administrativos;
- gestão de usuários.

Fluxo operacional de origem:

```text
necessidade operacional
→ Google Forms
→ RESPOSTAS_FORM
→ normalizador Apps Script
→ SOLICITACOES
→ triagem administrativa
→ fornecedor + preço congelado
→ comparecimento/realizado
→ histórico confiável
```

---

# 3. ARQUITETURA VIGENTE

## 3.1 Entrada operacional

```text
Usuário operacional
→ Google Forms
→ RESPOSTAS_FORM
→ gatilho onFormSubmit
→ FormResponseNormalizerService
→ SOLICITACOES
```

O Forms continua como canal operacional de origem já homologado. Não remover sem decisão explícita.

## 3.2 Aplicação autenticada

```text
Usuário autenticado
→ Cloudflare
→ Next.js / PrimeReact
→ /api/* via Cloudflare Pages Functions
→ Apps Script Web App
→ Google Sheets
```

Frontend ativo no branch de modernização:

```text
Next.js 15 App Router
React 19
PrimeReact 10.9.x
PrimeIcons
Chart.js via PrimeReact Chart
TypeScript
Cloudflare Pages static export
```

Regra de desacoplamento:

```text
Frontend → API → Apps Script → Planilha
```

Nunca criar dependência do frontend com posição física de coluna/célula.

## 3.3 Compatibilidade de deploy

O projeto usa `next build` com `output: 'export'`.

Após a exportação:

```text
out/ → dist/
```

para preservar a configuração existente do Cloudflare Pages.

A migração visual não deve mover o backend para Next Route Handlers nem alterar contratos `/api/*` neste momento.

---

# 4. AUTENTICAÇÃO E AUTORIZAÇÃO

A aplicação possui sessão própria, além da camada de segurança externa do Cloudflare.

Perfis:

```text
OWNER
ADMINISTRATIVO
OPERACIONAL
```

Matriz vigente:

| Perfil | Dashboard | Solicitações | Cadastros | Usuários | Escopo |
| --- | --- | --- | --- | --- | --- |
| OWNER | tudo | tudo | tudo | sim | TODOS |
| ADMINISTRATIVO | permitido | permitido | permitido | não | TODOS ou operação definida |
| OPERACIONAL | própria operação | própria operação | não | não | operação específica |

Regras importantes:

- autorização é validada também no backend;
- OPERACIONAL não pode usar escopo `TODOS`;
- OWNER + `TODOS` possui visão completa;
- perfil e operação ficam no bloco do usuário junto ao logout;
- topbar não deve repetir `Owner`, escopo técnico ou frases como `Executivo · Custos extras`;
- topbar pode exibir apenas conectividade (`Base conectada`) quando houver espaço;
- em mobile a conectividade pode ser omitida para preservar o título da página.

`CAD_USUARIOS`:

```text
EMAIL
NOME
SENHA_HASH
SALT
PERFIL
OPERACAO
ATIVO
ULTIMA_ALTERACAO
```

Nunca expor hash, salt, pepper ou senha no browser.

---

# 5. SEGURANÇA

Permitido:

- Cloudflare Secrets / Environment Variables;
- Apps Script `PropertiesService`.

Proibido:

- segredos no React/Next client;
- segredos no GitHub;
- segredos em células;
- `.env` sensível commitado;
- senha em texto puro.

Variáveis relevantes incluem:

```text
APPS_SCRIPT_URL
APPS_SCRIPT_GATEWAY_TOKEN
APP_SESSION_SECRET
```

`AUTH_PASSWORD_PEPPER` pertence ao Apps Script Properties e não deve ser perdido ou alterado sem migração planejada.

Sessões atuais possuem duração limitada e mudanças de perfil/senha podem exigir novo login para refletir imediatamente no navegador.

---

# 6. PLANILHA CENTRAL

Planilha oficial:

`Controle de Custos Extras - UNILOG`

ID:

`18dpLKAFHQI3rHRgn1XzP0cAtzYzZsrU-r6FulFkHXvo`

Locale: `pt_BR`  
Timezone: `America/Sao_Paulo`

Abas principais:

```text
RESPOSTAS_FORM
SOLICITACOES
CAD_OPERACOES
CAD_SUPERVISORES
CAD_FORNECEDORES
CAD_ATIVIDADES
CAD_FUNCOES
CAD_PRODUTOS
PRECOS_MO
PRECOS_PRODUTOS
CAD_USUARIOS
```

`RESPOSTAS_FORM` é origem bruta e não deve ser corrigida para caber no modelo final.

## 6.1 SOLICITACOES

Campos centrais incluem:

```text
ID_SOLICITACAO
TIPO_SOLICITACAO
DATA_CRIACAO
USUARIO_CRIACAO
ORIGEM
ID_ORIGEM
LOTE_IMPORTACAO
SUPERVISOR
OPERACAO
DATA_OPERACIONAL
COMPETENCIA
FORNECEDOR
JUSTIFICATIVA
RESPONSAVEL_CUSTO
CENTRO_CUSTO
ATIVIDADE
FUNCAO
TURNO
QTD_SOLICITADA
QTD_COMPARECIDA
VOLUME_REFERENCIA
UNIDADE_VOLUME
PRECO_UNITARIO_APLICADO
PRODUTO_ALIMENTACAO
QTD_ALIMENTACAO
PRECO_ALIMENTACAO_APLICADO
VALOR_ALIMENTACAO
PRODUTO_BEBIDA
QTD_BEBIDA
PRECO_BEBIDA_APLICADO
VALOR_BEBIDA
VALOR_PREVISTO
VALOR_REAL
PRODUTO_ALIMENTACAO_APLICADO
PRODUTO_BEBIDA_APLICADO
MOTIVO_AJUSTE_PRODUTO
```

Regras:

- campos originais de produto preservam o pedido;
- campos `*_APLICADO` armazenam o item efetivamente atendido;
- aplicado ≠ solicitado exige motivo;
- centro de custo deve preservar zeros à esquerda;
- `QTD_COMPARECIDA` é administrativo;
- `VALOR_REAL` é calculado, nunca digitado manualmente.

---

# 7. CADASTROS E PREÇOS

Cadastros principais:

```text
CAD_OPERACOES
CAD_SUPERVISORES
CAD_FORNECEDORES
CAD_ATIVIDADES
CAD_FUNCOES
CAD_PRODUTOS
```

Regras relevantes:

- `OPERADOR DE EMPILHADEIRA` é função, não atividade;
- AUXILIAR OPERACIONAL → DIURNO;
- OPERADOR DE EMPILHADEIRA → DIURNO ou NOTURNO;
- turno é manual;
- produtos possuem categoria ALIMENTACAO ou BEBIDA;
- elegibilidade sempre vem do cadastro atual.

## 7.1 Preços versionados

`PRECOS_MO`:

```text
FORNECEDOR
FUNCAO
TURNO
TIPO_DIA
VIGENCIA_INICIO
VIGENCIA_FIM
PRECO_UNITARIO
ATIVO
```

`PRECOS_PRODUTOS`:

```text
FORNECEDOR
PRODUTO
VIGENCIA_INICIO
VIGENCIA_FIM
CATEGORIA
PRECO_UNITARIO
ATIVO
```

Preço é resolvido pela `DATA_OPERACIONAL` e congelado na solicitação.

Snapshots históricos nunca devem ser recalculados quando uma tabela de preço futura mudar.

---

# 8. PROTOCOLO E COMPETÊNCIA

Protocolo:

```text
CE-YYYY-######
```

Nunca usar número de linha como ID.

Competência:

```text
dia 21 de um mês → dia 20 do mês seguinte
```

Representação:

```text
YYYY-MM
```

---

# 9. TRIAGEM / REALIZADO

Triagem administrativa:

1. localiza por `ID_SOLICITACAO`;
2. exige fornecedor ativo;
3. valida compatibilidade com o tipo;
4. resolve preço pela data operacional;
5. congela fornecedor/preço;
6. calcula valor previsto;
7. preserva produto original;
8. grava produto aplicado separadamente;
9. exige motivo quando houver substituição;
10. bloqueia retriagem silenciosa já precificada.

Mão de obra:

```text
VALOR_REAL = QTD_COMPARECIDA × PRECO_UNITARIO_APLICADO
```

`QTD_COMPARECIDA` pode ser 0, menor, igual ou maior que solicitado. Divergência não bloqueia registro.

Alimentação/Bebidas:

```text
VALOR_ALIMENTACAO = QTD_ALIMENTACAO × PRECO_ALIMENTACAO_APLICADO
VALOR_BEBIDA = QTD_BEBIDA × PRECO_BEBIDA_APLICADO
VALOR_PREVISTO = VALOR_ALIMENTACAO + VALOR_BEBIDA
```

Não existe quantidade comparecida para alimentação/bebidas.

---

# 10. FRONTEND ATIVO — ESTADO EM 12/09/2026

Telas montadas pelo App Router atual:

```text
Login
Shell / navegação
Dashboard — Visão Executiva
Dashboard — Analytics
Solicitações
Cadastros
Usuários
Dialogs de detalhe/triagem/comparecimento/correção
```

Arquivos históricos de React/Vite podem continuar no repositório durante a migração, mas não devem ser tratados como telas ativas sem confirmar import/mount no App Router.

## 10.1 Login

- identidade visual de referência aprovada;
- PrimeReact InputText, Password e Button;
- painel grafite baseado em `#171b24 → #353d4e`;
- vermelho Unilog apenas como CTA/foco.

## 10.2 Shell

- sidebar grafite;
- item ativo = grafite elevado + faixa vermelha;
- usuário/perfil/operação/logout no rodapé;
- topbar mostra somente página e conectividade quando útil;
- mobile usa drawer compacto, `100dvh` e safe area.

## 10.3 Solicitações

Estrutura migrada para PrimeReact:

- DataTable;
- Dropdown;
- Paginator;
- Tag;
- Button;
- Dialog;
- InputText / InputTextarea nos workflows.

Mobile:

- tabela vira record cards verticais;
- ações ficam no fim do card;
- não usar scroll horizontal como solução principal para registros.

## 10.4 Cadastros

Estrutura migrada para PrimeReact:

- TabMenu/Dropdown;
- DataTable;
- Paginator;
- InputText;
- InputSwitch;
- Checkbox;
- Dialog.

Preços e histórico mantêm as mesmas regras de backend.

## 10.5 Usuários

Estrutura migrada para PrimeReact:

- DataTable;
- Dropdown;
- Password;
- InputSwitch;
- Tag;
- Dialog.

Somente OWNER acessa a gestão de usuários.

---

# 11. DESIGN SYSTEM PRIMEREACT — REGRA OBRIGATÓRIA

Fonte detalhada:

`docs/PRIMEREACT_DESIGN_SYSTEM.md`

CSS final:

`src/app/prime-design-system.css`

Esse arquivo é carregado por último e é a camada visual canônica enquanto estilos antigos ainda são retirados gradualmente.

## 11.1 Paleta canônica

```css
--unilog-red: #db0812;
--unilog-red-dark: #b8070f;
--unilog-red-soft: #fdecee;
--unilog-ink: #171b24;
--unilog-ink-2: #242a36;
--unilog-graphite: #494a56;
--unilog-graphite-2: #676d77;
--unilog-muted: #8a9099;
--unilog-border: #e2e5e9;
--unilog-border-soft: #edf0f2;
--unilog-canvas: #f5f6f8;
--unilog-surface: #ffffff;
--unilog-surface-soft: #f8f9fb;
--unilog-success: #3f7c59;
--unilog-warning: #a87900;
--unilog-danger: #c91a23;
```

Regras:

- vermelho = marca/CTA/foco/acento;
- grafite = informação e séries principais;
- cinza claro = previsto/referência;
- verde/amarelo/vermelho de estado somente em semântica de sucesso/atenção/erro;
- azul, roxo, teal e índigo do tema Lara não podem aparecer como cores do produto;
- highlights/focus/select do PrimeReact devem ser sobrescritos pelos tokens Unilog.

## 11.2 Cards

Padrão:

```text
raio 14px
borda #e2e5e9
fundo branco
sombra baixa
header separado por borda suave
```

Não criar novos cards com estilo paralelo.

## 11.3 Controles

Sempre preferir PrimeReact quando houver equivalente:

```text
Card
DataTable / Column
Dialog
Dropdown
Button
InputText
Password
InputTextarea
InputSwitch
Checkbox
Tag
Paginator
SelectButton / TabMenu
Skeleton
Message
Chart
```

HTML customizado só quando a estrutura não possuir equivalente apropriado.

---

# 12. GRÁFICOS — PADRÃO E AUDIT

PrimeReact `Chart` + Chart.js é o padrão para:

- barras;
- barras horizontais;
- linhas;
- dispersão;
- combinação barras + linha.

Paleta:

```text
Realizado = grafite #494a56
Previsto = cinza claro #d7dbe0
Meta/referência = cinza médio #9aa0a8
Projeção/acento = vermelho #db0812
```

Regras de eixo:

- nomes longos são abreviados visualmente e preservados no tooltip;
- não forçar todos os labels completos quando houver colisão;
- rotação moderada de 20–35° é permitida;
- séries temporais podem usar `autoSkip`;
- eixos monetários usam formatação compacta quando necessário;
- gráfico nunca pode ter `min-width` maior que o card no mobile;
- tooltips preservam nomes/valores completos.

## 12.1 Estado atual do Dashboard

Visão Executiva:

- KPIs = PrimeReact Card;
- filtros = PrimeReact Dropdown;
- tabs = SelectButton;
- rankings operação/fornecedor = PrimeReact Chart;
- meta/projeção = PrimeReact Chart;
- comparação de competência permanece componente customizado composto, mas usa o design system;
- movimento diário permanece grade informacional customizada.

Analytics:

- Dia da semana = PrimeReact Chart;
- Pareto = PrimeReact Chart combinado bar + line;
- Supervisor = PrimeReact Chart horizontal;
- Linearidade × custo = PrimeReact scatter;
- Responsável pelo custo = PrimeReact Chart;
- Atividades = PrimeReact Chart;
- heatmap permanece customizado por ser matriz;
- oportunidades usam Card + Tag semântica.

Correção obrigatória já incorporada ao padrão: Pareto não pode apresentar nomes de depositantes sobrepostos no eixo X.

---

# 13. RESPONSIVIDADE

## Desktop/notebook

- filtros com `auto-fit/minmax`;
- evitar duas colunas gigantes quando cabem quatro ou mais;
- DataTable mantém leitura tabular;
- gráficos ocupam a largura do card e usam canvas responsivo.

## Mobile

- filtros em uma coluna;
- tabelas viram record cards;
- dialogs possuem scroll interno e ações adaptadas;
- sidebar não distribui itens verticalmente por toda a altura;
- usuário/logout permanece no rodapé;
- usar `100dvh` e safe area;
- heatmap pode ter scroll horizontal interno por ser matriz;
- a página não pode ter overflow horizontal.

---

# 14. CSS LEGADO / ESTRATÉGIA DE RETIRADA

Ainda existem estilos históricos em `src/styles/` e arquivos de ponte usados durante a migração.

Eles não são a fonte visual final.

Regras:

1. `prime-design-system.css` é carregado por último;
2. novos componentes não podem adicionar cores a estilos legados;
3. só remover uma folha antiga depois de confirmar que nenhum componente ativo depende dela;
4. retirada de CSS legado deve ocorrer em mudanças pequenas e verificáveis;
5. não fazer limpeza em massa no mesmo commit de regra funcional.

---

# 15. AUDIT COMPLETO DAS TELAS — 12/09/2026

| Área | Componente-base | Situação |
| --- | --- | --- |
| Login | PrimeReact | migrado |
| Shell/topbar/sidebar | Next + PrimeIcons/Avatar/Tag | migrado |
| Dashboard filtros/KPIs | PrimeReact | migrado |
| Dashboard rankings | PrimeReact Chart | migrado |
| Dashboard projeção | PrimeReact Chart | migrado |
| Analytics bar/line/scatter | PrimeReact Chart | migrado |
| Analytics heatmap | custom matrix + tokens Unilog | aceito |
| Oportunidades | Card + Tag | migrado |
| Solicitações | DataTable + controls + Dialog | migrado |
| Solicitações mobile | record cards | migrado |
| Cadastros | DataTable/TabMenu/controls/Dialog | migrado |
| Cadastros mobile | record cards/seletor | migrado |
| Usuários | DataTable/controls/Dialog | migrado |
| Usuários mobile | record cards | migrado |
| Workflow detalhe/triagem | Dialog + controls PrimeReact | migrado |
| Comparativo competência | custom composto + tokens Unilog | aceito |
| Movimento diário | grade informacional + tokens Unilog | aceito |

Critério: “custom aceito” significa que não há ganho real em forçar um componente genérico, mas a aparência deve obedecer integralmente ao design system.

---

# 16. AUDITORIA FUNCIONAL

Mudanças materiais não devem sobrescrever histórico silenciosamente.

Modelo conceitual:

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

Retriagem de solicitação já precificada permanece bloqueada até existir fluxo explícito de auditoria/reprocessamento.

---

# 17. LEGADO

Legado permanece preservado.

Migração de dados futura:

```text
legado
→ staging
→ normalização
→ equivalências
→ validação
→ importação
```

Preservar origem, ID/linha histórica e lote de importação quando aplicável.

---

# 18. FORA DO ESCOPO SEM NOVA DECISÃO

Não implementar silenciosamente:

- Supabase;
- PostgreSQL dedicado;
- ERP fiscal completo;
- workflow excessivamente burocrático;
- mudança de Apps Script para outro backend;
- mudança de Cloudflare Pages Functions para Next backend;
- WhatsApp automático sem decisão explícita;
- split complexo de item entre várias NFs.

---

# 19. ESTADO DE HOMOLOGAÇÃO / PR

A modernização Next.js + PrimeReact está sendo conduzida no PR #59 em branch isolada.

Regras desse PR:

- permanece Draft durante homologação;
- não mergear sem aprovação explícita;
- confirmar Cloudflare no head exato antes de chamar uma versão de validada;
- qualquer regressão visual deve ser corrigida antes do merge;
- backend e regras de negócio permanecem intactos.

---

# 20. PRÓXIMAS AÇÕES

1. concluir homologação visual do PR #59 em desktop e mobile;
2. validar Dashboard Executivo e Analytics com dados reais e nomes longos;
3. validar Solicitações desktop + record cards mobile;
4. validar todas as seções de Cadastros e dialogs;
5. validar Usuários e reset de senha;
6. validar workflow de detalhe/triagem/comparecimento/correção;
7. remover CSS legado apenas após confirmar ausência de consumidores ativos;
8. somente então marcar PR ready e mergear mediante aprovação explícita.

---

# 21. COMANDO CURTO DE RETOMADA

```text
Retome o projeto Extra Cost Control UNILOG.

Repositório oficial:
https://github.com/srcarneiro1/extra-cost-control-unilog

Antes de qualquer alteração, leia integralmente MEMORIA_PROJETO.md e docs/PRIMEREACT_DESIGN_SYSTEM.md. Trate ambos como fonte de verdade funcional, arquitetural e visual.

Arquitetura vigente: Next.js + React + PrimeReact no Cloudflare Pages; Pages Functions como gateway; Google Apps Script como API/regras; Google Planilhas como persistência. Não usar Supabase.

Regra central: o solicitante informa a necessidade; o Administrativo define fornecedor, congela preços e registra o realizado.

Preserve backend, histórico e regras de negócio. Mudanças visuais devem usar a paleta Unilog e componentes PrimeReact, com Chart.js via PrimeReact Chart para gráficos compatíveis.

Não mergear PR sem build verde no head exato e homologação explícita do usuário.
```
