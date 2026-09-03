# MEMÓRIA TÉCNICA — EXTRA COST CONTROL UNILOG

**Projeto:** Extra Cost Control — UNILOG  
**Repositório oficial:** `srcarneiro1/extra-cost-control-unilog`  
**Status:** MVP 1 em desenvolvimento  
**Última consolidação:** 02/09/2026 — pós-merge da triagem e comparecimento

---

# 1. REGRA DE RETOMADA

Antes de alterar o projeto, leia este arquivo e trate-o como fonte de verdade funcional, arquitetural e visual.

Decisões vigentes:

1. Não usar Supabase neste MVP.
2. Google Planilhas é a persistência operacional.
3. Google Apps Script é a API e camada de regras de negócio.
4. React + TypeScript + Vite roda em Cloudflare Pages.
5. Cloudflare Pages Functions é o gateway protegido entre frontend e Apps Script.
6. GitHub privado é a fonte oficial de código, branches, PRs e merges.
7. Segredos somente em Cloudflare Environment/Secrets e Apps Script `PropertiesService`.
8. Bases legadas devem permanecer intactas.
9. Competência financeira usa o ciclo dia 21 → dia 20.
10. Entrada operacional permanece aberta via Google Forms.
11. Autenticação é destinada ao módulo administrativo/gestão.
12. Regra central: **o solicitante informa a necessidade; o Administrativo decide quem atende.**
13. Fornecedor, preço aplicado e realizado não são preenchidos pelo solicitante.
14. Mudanças devem ser pequenas, testáveis e sem regras inventadas.

---

# 2. OBJETIVO DO MVP

Controlar Custos Extras da UNILOG com rastreabilidade, solicitado x realizado, histórico de preços e tratamento administrativo simples.

Escopo atual:

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
- rastreabilidade da origem.

Fluxo vigente:

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

# 3. ARQUITETURA

## 3.1 Entrada operacional

```text
Usuário operacional
→ Google Forms público
→ RESPOSTAS_FORM
→ gatilho onFormSubmit
→ FormResponseNormalizerService
→ SOLICITACOES
```

O Forms é o canal operacional oficial do MVP.

## 3.2 Administrativo

```text
Usuário administrativo autenticado
→ Cloudflare Access
→ React / Cloudflare Pages
→ Pages Functions
→ Apps Script Web App
→ Google Sheets
```

Regra de desacoplamento:

```text
Frontend → API → Planilha
```

Nunca criar dependência do frontend com posição física de coluna/célula.

---

# 4. SEGURANÇA

Permitido:

- Cloudflare Secrets / Environment Variables;
- Apps Script `PropertiesService`.

Proibido:

- segredos no React;
- segredos no GitHub;
- segredos em células;
- `.env` sensível commitado.

Integração Cloudflare → Apps Script usa:

```text
APPS_SCRIPT_GATEWAY_TOKEN
GATEWAY_TOKEN
```

Cloudflare Access já está incorporado ao gateway. O middleware valida `Cf-Access-Jwt-Assertion`, issuer, audience e identidade autenticada.

O token temporário `GATEWAY_TEST_TOKEN` continua permitido somente para transição/testes controlados.

Ainda é necessário homologar Access no ambiente Cloudflare com:

- `CLOUDFLARE_ACCESS_TEAM_DOMAIN`;
- `CLOUDFLARE_ACCESS_AUD`;
- request sem autenticação → 401;
- request autenticado → permitido;
- identidade administrativa derivada da autenticação confiável.

---

# 5. PLANILHA CENTRAL

Planilha oficial:

`Controle de Custos Extras - UNILOG`

ID:

`18dpLKAFHQI3rHRgn1XzP0cAtzYzZsrU-r6FulFkHXvo`

Locale: `pt_BR`  
Timezone: `America/Sao_Paulo`

Abas:

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
```

`RESPOSTAS_FORM` é origem bruta e não deve ser corrigida para caber no modelo final.

## 5.1 SOLICITACOES

Estrutura vigente: **36 colunas**.

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

- `PRODUTO_ALIMENTACAO` e `PRODUTO_BEBIDA` preservam o pedido original;
- campos `*_APLICADO` armazenam o item efetivamente atendido;
- se aplicado ≠ solicitado, `MOTIVO_AJUSTE_PRODUTO` é obrigatório;
- `COMPETENCIA`, `CENTRO_CUSTO` e `ID_ORIGEM` devem preservar comportamento textual quando necessário;
- centro de custo deve preservar zeros à esquerda;
- `QTD_COMPARECIDA` é campo administrativo e está visualmente destacado na planilha;
- `VALOR_REAL` é calculado, nunca digitado manualmente.

---

# 6. CADASTROS

## CAD_OPERACOES

```text
OPERACAO | ATIVO
```

## CAD_SUPERVISORES

```text
SUPERVISOR | ATIVO
```

## CAD_FORNECEDORES

```text
FORNECEDOR | MAO_DE_OBRA | ALIMENTACAO | ATIVO
```

Fornecedores cadastrados incluem MULT, AGUIA, ALMIRANTE e W-SLOW. Elegibilidade sempre deve vir do cadastro atual.

## CAD_ATIVIDADES

```text
ATIVIDADE | ATIVO
```

`OPERADOR DE EMPILHADEIRA` é função, não atividade.

O Forms usa `Outro` nativo para atividade livre.

## CAD_FUNCOES

```text
FUNCAO | ATIVO
```

Funções atuais:

- AUXILIAR OPERACIONAL;
- OPERADOR DE EMPILHADEIRA.

Regra de turno:

- AUXILIAR OPERACIONAL → DIURNO;
- OPERADOR DE EMPILHADEIRA → DIURNO ou NOTURNO.

Turno é manual. Não inferir horário.

## CAD_PRODUTOS

```text
PRODUTO | CATEGORIA | ATIVO
```

Categorias:

- ALIMENTACAO;
- BEBIDA.

Produto só aparece no Forms quando estiver ativo e houver pelo menos um fornecedor ativo/compatível com preço ativo e vigente.

---

# 7. GOOGLE FORMS

Formulário oficial:

**UNILOG | Solicitação de Custo Extra**

ID nativo:

`1y_2dEWZS0cPofJotpPI2f4DcNe-l-ODVhzoUru9hT-o`

O Forms é aberto e não exige e-mail. `Nome do solicitante` é obrigatório.

Regra central:

> O solicitante informa a necessidade. Fornecedor e preços são definidos depois pelo Administrativo.

Fluxos:

### Mão de obra

- solicitante;
- supervisor;
- operação;
- data operacional;
- justificativa;
- atividade;
- quantidade solicitada;
- volume/unidade opcionais;
- função;
- turno conforme função;
- responsável pelo custo;
- centro de custo somente se UNILOG.

### Alimentação/Bebidas

- mesmos campos comuns;
- alimentação e quantidade quando houver;
- bebida e quantidade quando houver;
- pelo menos um grupo deve existir;
- catálogo unificado, sem fornecedor no Forms.

---

# 8. SINCRONIZAÇÃO DO FORMS

Serviço:

`FormCatalogSyncService.gs`

Funções principais:

```text
syncFormCatalogs
onCatalogEdit
scheduledFormCatalogSync
installFormCatalogSyncTriggers
```

Sincroniza:

- supervisor;
- operação;
- atividade;
- alimentação;
- bebida.

Não sincroniza `Função`, porque o campo controla ramificação do Forms.

Elegibilidade de produto:

```text
produto ativo
+ preço ativo
+ preço vigente
+ fornecedor ativo
+ fornecedor com ALIMENTACAO = SIM
```

Gatilhos homologados:

- edição da planilha;
- execução horária de segurança.

---

# 9. NORMALIZAÇÃO FORMS → SOLICITACOES

Serviços:

```text
FormResponseNormalizerService.gs
ProtocolService.gs
```

Gatilho:

`onOperationalFormSubmit`

O normalizador:

- usa `FormResponse.getId()` como `ID_ORIGEM`;
- impede duplicidade por `ORIGEM=GOOGLE_FORMS + ID_ORIGEM`;
- gera `CE-YYYY-######`;
- deriva competência;
- revalida cadastros ativos;
- deixa fornecedor/preços/valores administrativos vazios;
- preserva respostas inválidas apenas na origem bruta.

Homologação:

`CE-2026-000007` foi criado corretamente via Forms.

Teste inválido `AUXILIAR OPERACIONAL + NOTURNO` foi bloqueado sem contaminar `SOLICITACOES`.

---

# 10. PROTOCOLO E COMPETÊNCIA

Protocolo:

`CE-YYYY-######`

Nunca usar número de linha como ID.

`ProtocolService` é a referência única para geração de protocolo.

Competência:

```text
dia 21 de um mês → dia 20 do mês seguinte
```

Representação:

`YYYY-MM`

---

# 11. PREÇOS VERSIONADOS

## PRECOS_MO

```text
FORNECEDOR
FUNCAO
TURNO
VIGENCIA_INICIO
VIGENCIA_FIM
PRECO_UNITARIO
ATIVO
```

## PRECOS_PRODUTOS

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

Snapshots:

- `PRECO_UNITARIO_APLICADO`;
- `PRECO_ALIMENTACAO_APLICADO`;
- `PRECO_BEBIDA_APLICADO`.

Alteração futura de tabela não pode recalcular histórico.

---

# 12. TRIAGEM ADMINISTRATIVA

Serviço:

`TriageService.gs`

Rota Apps Script:

`route=triagem`

Gateway:

`POST /api/triagem`

A triagem:

1. localiza por `ID_SOLICITACAO`;
2. exige fornecedor ativo;
3. valida compatibilidade com o tipo;
4. usa `DATA_OPERACIONAL` para resolver o preço;
5. grava fornecedor;
6. congela preço(s);
7. calcula `VALOR_PREVISTO`;
8. preserva produto original;
9. grava produto aplicado separadamente;
10. exige motivo quando houver troca de produto;
11. bloqueia retriagem silenciosa de solicitação já precificada.

Homologação de mão de obra concluída com:

```text
CE-2026-000007
FORNECEDOR = MULT
PRECO_UNITARIO_APLICADO = 180
QTD_SOLICITADA = 12
VALOR_PREVISTO = 2160
```

A lógica de ajuste de alimentação/bebida está implementada. Antes de depender dela na UI, ainda é recomendada uma homologação dirigida de produto solicitado x aplicado.

---

# 13. COMPARECIMENTO / REALIZADO DE MÃO DE OBRA

Serviço:

`AttendanceService.gs`

Rota Apps Script:

`route=comparecimento`

Gateway:

`POST /api/comparecimento`

Regras:

```text
VALOR_REAL = QTD_COMPARECIDA × PRECO_UNITARIO_APLICADO
```

`QTD_COMPARECIDA`:

- pode ser 0;
- pode ser menor que a solicitada;
- pode ser igual;
- pode ser maior;
- divergência não bloqueia o registro.

`VALOR_REAL` nunca é informado manualmente.

Homologação concluída:

```text
CE-2026-000007
QTD_SOLICITADA = 12
QTD_COMPARECIDA = 10
PRECO_UNITARIO_APLICADO = 180
VALOR_PREVISTO = 2160
VALOR_REAL = 1800
DIVERGENCIA = true
```

---

# 14. ALIMENTAÇÃO / BEBIDAS

Não existe quantidade comparecida.

Cálculos:

```text
VALOR_ALIMENTACAO = QTD_ALIMENTACAO × PRECO_ALIMENTACAO_APLICADO
VALOR_BEBIDA = QTD_BEBIDA × PRECO_BEBIDA_APLICADO
VALOR_PREVISTO = VALOR_ALIMENTACAO + VALOR_BEBIDA
```

Quando o fornecedor escolhido não atender exatamente o item solicitado:

- o item original permanece nos campos originais;
- o Administrativo informa o produto aplicado;
- motivo do ajuste é obrigatório;
- não é permitido adicionar uma categoria que não existia no pedido original.

---

# 15. APPS SCRIPT — ARQUIVOS PRINCIPAIS

```text
Code.gs
Api.gs
CatalogService.gs
SheetRepository.gs
JsonResponse.gs
PricingService.gs
DateService.gs
ValidationService.gs
SolicitationService.gs
FormCatalogSyncService.gs
FormResponseNormalizerService.gs
ProtocolService.gs
TriageService.gs
AttendanceService.gs
```

Capacidades implementadas e já incorporadas ao `main`:

- health;
- catálogos;
- criação via API;
- preços;
- protocolo;
- sincronização do Forms;
- normalização do Forms;
- triagem administrativa;
- comparecimento/realizado de mão de obra.

---

# 16. FRONTEND

Stack:

- React;
- TypeScript;
- Vite;
- Cloudflare Pages.

Já existe client tipado inicial de catálogos.

Próxima necessidade funcional do frontend:

1. listagem de solicitações administrativas;
2. detalhe da solicitação;
3. ação de triagem;
4. ação de registro do real;
5. feedback de divergências e ajustes.

Ordem correta:

```text
regra → API → teste → interface
```

---

# 17. IDENTIDADE VISUAL

Paleta base:

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

Vermelho é marca/CTA/foco, não sinônimo automático de erro.

Tipografia preferencial: Roboto.

Princípios:

- alta legibilidade;
- baixa carga cognitiva;
- responsividade real;
- tabela vira record cards no mobile;
- foco visível;
- touch targets adequados;
- `prefers-reduced-motion`;
- campos administrativos visualmente distintos quando isso reduzir erro operacional.

---

# 18. AUDITORIA

Mudanças materiais não devem sobrescrever histórico silenciosamente.

Modelo conceitual futuro:

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

# 19. LEGADO

Legado permanece intocado.

Migração futura:

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

# 20. FORA DO MVP 1

Não implementar sem nova decisão explícita:

- Supabase;
- PostgreSQL dedicado;
- ERP fiscal completo;
- workflow excessivamente burocrático;
- dashboard BI sofisticado antes do fluxo administrativo;
- WhatsApp automático;
- split complexo de item entre várias NFs.

---

# 21. ESTADO HOMOLOGADO EM 02/09/2026

Concluído/homologado e incorporado ao `main`:

- planilha central;
- `SOLICITACOES` com 36 colunas;
- preços versionados;
- API-base e gateway;
- Google Forms operacional;
- sincronização automática de catálogos;
- normalização Forms → `SOLICITACOES`;
- protocolo compartilhado;
- triagem administrativa de mão de obra;
- congelamento de fornecedor/preço;
- cálculo de valor previsto;
- comparecimento real de mão de obra;
- cálculo de valor real;
- proteção contra retriagem silenciosa;
- rastreabilidade de produto solicitado x aplicado;
- Cloudflare Access incorporado ao código.

Referências de merge deste marco:

- PR #14 — comparecimento real de mão de obra;
- PR #15 — triagem administrativa;
- PR #13 — consolidação documental anterior.

Ainda pendente:

- homologação dirigida da troca de produto em alimentação/bebida;
- listagem/detalhe administrativo via API;
- frontend administrativo completo;
- validação operacional do Cloudflare Access no ambiente Cloudflare;
- migração do legado.

---

# 22. PRÓXIMAS AÇÕES

1. Criar API de listagem e detalhe de solicitações administrativas.
2. Homologar um caso de alimentação/bebida com produto aplicado diferente do solicitado.
3. Construir tela administrativa de fila/detalhe.
4. Integrar ações de triagem e comparecimento na UI.
5. Configurar e validar Cloudflare Access em Preview/Production.
6. Remover dependência do token temporário após homologação do Access.
7. Somente depois avançar para migração do legado.

**Não iniciar pelo dashboard.**

---

# 23. COMANDO CURTO DE RETOMADA

```text
Retome o projeto Extra Cost Control UNILOG.

Repositório oficial:
https://github.com/srcarneiro1/extra-cost-control-unilog

Antes de qualquer alteração, leia integralmente MEMORIA_PROJETO.md e trate-o como fonte de verdade funcional, arquitetural e visual.

Arquitetura vigente: Google Forms aberto para entrada operacional; React + TypeScript + Vite no Cloudflare Pages para administrativo; Cloudflare Access/gateway para camada protegida; Google Apps Script como API/regras; Google Planilhas como persistência. Não usar Supabase.

Regra central: o solicitante informa a necessidade; o Administrativo define fornecedor, congela preços e registra o realizado.

Preserve o legado e avance em mudanças pequenas e verificáveis.

Continue pela seção Próximas ações.
```
