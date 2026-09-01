# MEMÓRIA TÉCNICA — EXTRA COST CONTROL UNILOG

**Projeto:** Extra Cost Control — UNILOG  
**Repositório:** `srcarneiro1/Extra-Cost-Control-Unilog`  
**Data de consolidação:** 01/09/2026  
**Status:** MVP 1 — arquitetura redefinida e aprovada como direção de trabalho

---

## 1. INSTRUÇÃO PARA RETOMADA EM NOVO CHAT

Antes de propor, implementar ou alterar qualquer parte deste projeto, leia integralmente este arquivo.

Considere como decisão vigente:

1. **NÃO usar Supabase neste MVP.**
2. Usar **Google Planilhas como camada de persistência de dados**.
3. Usar **Google Apps Script como API e camada de regras de negócio**.
4. Usar **Cloudflare Pages para o frontend** e, quando necessário, **Cloudflare Pages Functions/Worker como camada intermediária segura entre o navegador e o Apps Script**.
5. Usar **GitHub como fonte oficial do código**, com controle por commits, branches, Pull Requests e merges.
6. Não armazenar dados operacionais, dados pessoais, planilhas, tokens, credenciais ou segredos no GitHub.
7. Manter o MVP simples e incremental. Não reabrir a arquitetura Supabase sem necessidade concreta e nova decisão explícita.
8. Preservar as bases legadas atuais e migrá-las somente de forma controlada.
9. Mão de obra e alimentação/bebidas podem compartilhar o mesmo fluxo de entrada, mas **não compartilham a mesma lógica financeira**.
10. A competência financeira permanece **dia 21 até dia 20 do mês seguinte**.

---

# 2. OBJETIVO DO PROJETO

Criar um sistema simples para controlar **Custos Extras da UNILOG**, substituindo gradualmente o processo fragmentado atual de Google Forms + Google Sheets, sem criar neste momento uma infraestrutura pesada.

O MVP deve controlar inicialmente:

- solicitação de mão de obra terceirizada;
- solicitação de alimentação e bebidas;
- operação/depositante;
- supervisor responsável;
- fornecedor;
- responsabilidade financeira (CLIENTE ou UNILOG);
- centro de custo quando aplicável;
- preço vigente na data do serviço;
- congelamento/snapshot do preço aplicado;
- quantidade solicitada;
- quantidade efetivamente comparecida para mão de obra;
- custo previsto;
- custo realizado;
- histórico e rastreabilidade básica;
- legado das planilhas atuais.

O objetivo do MVP 1 não é reproduzir um ERP. O objetivo é resolver os principais problemas atuais de qualidade, preço histórico, rastreabilidade e consolidação dos dados.

---

# 3. ARQUITETURA DEFINITIVA DO MVP 1

```text
USUÁRIO
   ↓
CLOUDFLARE PAGES
Frontend React + TypeScript
   ↓
CLOUDFLARE FUNCTION / WORKER
quando necessário para proteger chamadas e segredos
   ↓
GOOGLE APPS SCRIPT WEB APP
API + regras de negócio
   ↓
GOOGLE PLANILHAS
Persistência operacional
```

Código:

```text
GitHub
srcarneiro1/Extra-Cost-Control-Unilog
```

Deploy:

```text
GitHub
  ↓
Cloudflare Pages
```

Dados:

```text
Google Planilhas
Controle de Custos Extras - UNILOG
```

Regras/backend:

```text
Google Apps Script
Web App / API
```

---

# 4. POR QUE NÃO USAREMOS SUPABASE NESTE MVP

A decisão foi alterada por razões práticas:

- a conta atual possui limitação de quantidade de projetos Supabase;
- não há necessidade de banco relacional dedicado para provar o fluxo do MVP;
- as bases atuais já estão em Google Planilhas;
- a equipe já utiliza Google Forms/Sheets;
- Apps Script permite construir uma API suficiente para o volume inicial;
- a migração do legado fica mais simples;
- reduzimos o número de tecnologias e o esforço de implantação;
- GitHub + Cloudflare continuam garantindo versionamento e deploy profissional do frontend.

Isto **não significa** que Google Sheets é o banco definitivo para qualquer escala futura.

Se volume, concorrência, segurança, auditoria ou performance excederem os limites práticos do Sheets/Apps Script, a aplicação poderá migrar a persistência posteriormente sem descartar o frontend, desde que a API seja mantida como contrato entre as camadas.

---

# 5. PRINCÍPIO DE DESACOPLAMENTO

O frontend não deve conhecer a estrutura física da planilha.

Errado:

```text
Frontend → escreve diretamente na coluna N da aba SOLICITACOES
```

Correto:

```text
Frontend
   ↓
POST /solicitacoes
   ↓
Apps Script
   ↓
valida regra
   ↓
grava na planilha
```

Assim, no futuro podemos substituir Google Sheets por outro banco sem reescrever a aplicação inteira.

---

# 6. SEGURANÇA DA API

Não colocar segredo do Apps Script dentro do JavaScript enviado ao navegador.

Quando uma operação exigir segredo ou autenticação de backend, usar:

```text
Browser
   ↓
Cloudflare Function / Worker
   ↓  segredo armazenado no Cloudflare
Apps Script
```

Segredos devem ficar apenas em:

- Cloudflare Secrets / Environment Variables;
- Apps Script PropertiesService.

Nunca em:

- GitHub;
- `.env` commitado;
- código JavaScript público;
- células de planilha expostas ao frontend.

O arquivo `.env.example` poderá conter somente nomes das variáveis, sem valores reais.

---

# 7. FONTES LEGADAS EXISTENTES

Existem duas bases operacionais que devem ser preservadas.

## 7.1 Mão de obra

Arquivo/base:

`Solicitação de mão de obra terceirizada (respostas)`

Campos históricos relevantes encontrados:

- Carimbo de data/hora;
- Supervisor;
- Cliente / Operação;
- Atividade;
- Empresa terceirizada;
- Quantidade de pessoas;
- Quantidade de pedidos para fazer;
- Data da execução do serviço;
- Observações gerais;
- Custo;
- Tabela acordada;
- Real;
- valor realizado em coluna auxiliar.

Problemas identificados:

- atividade e função/recurso foram misturados;
- `OPERADOR DE EMPILHADEIRA` aparece historicamente como atividade;
- o campo `Quantidade de pedidos para fazer` contém números e textos heterogêneos;
- existem variações de nomes de supervisores e operações;
- há linhas vazias preenchidas apenas por fórmulas;
- preço histórico pode ser afetado por fórmulas/tabelas atuais;
- existem divergências entre solicitado e comparecido.

## 7.2 Alimentação / bebidas

Arquivo/base:

`Solicitação de Lanches`

Campos históricos relevantes:

- Carimbo de data/hora;
- Supervisor;
- Empresa terceirizada;
- Operação;
- Data da solicitação/atendimento;
- Alimentação;
- Quantidade;
- Bebida;
- Quantidade bebida;
- Justificativa;
- Custo/responsável;
- Valor alimentação;
- Valor bebida;
- Valor total.

Problemas identificados:

- preço histórico depende da tabela/fórmula atual;
- fornecedores e produtos precisam de cadastro controlado;
- nomes históricos apresentam variações;
- alimentação e bebida possuem lógica diferente de mão de obra quanto ao realizado.

---

# 8. NOVA PLANILHA CENTRAL

Planilha criada:

`Controle de Custos Extras - UNILOG`

Estado verificado na primeira revisão:

- aba `RESPOSTAS_FORM`;
- aba `SOLICITACOES`.

Naquele momento `RESPOSTAS_FORM` possuía somente:

- Carimbo de data/hora;
- O que você deseja solicitar?

A estrutura ainda estava no início.

---

# 9. ABAS PLANEJADAS PARA O MVP

Não criar tudo de uma vez. A implementação será incremental.

Base mínima planejada:

```text
SOLICITACOES
CAD_OPERACOES
CAD_SUPERVISORES
CAD_FORNECEDORES
CAD_ATIVIDADES
CAD_FUNCOES
CAD_PRODUTOS
PRECOS_MO
PRECOS_PRODUTOS
AUDITORIA / LOG
```

`RESPOSTAS_FORM` poderá permanecer durante a transição caso o Google Form seja usado como fallback ou fonte temporária, mas a aplicação web não deve depender obrigatoriamente dele.

As bases legadas não devem ser alteradas.

Quando a migração for iniciada, usar staging/abas de legado ou processo de importação controlado, nunca copiar cegamente para `SOLICITACOES`.

---

# 10. CADASTROS DO MVP

## 10.1 Operações

`CAD_OPERACOES`

```text
OPERACAO | ATIVO
```

Os nomes novos devem ser padronizados.

As variações históricas serão tratadas em mapa de equivalência na migração.

## 10.2 Supervisores

`CAD_SUPERVISORES`

```text
SUPERVISOR | ATIVO
```

Usar nome padronizado.

## 10.3 Fornecedores

`CAD_FORNECEDORES`

Estrutura recomendada:

```text
FORNECEDOR | MAO_DE_OBRA | ALIMENTACAO | ATIVO
```

Exemplos conhecidos do legado:

- MULT;
- ÁGUIA;
- ALMIRANTE;
- W-SLOW.

## 10.4 Atividades

`CAD_ATIVIDADES`

Atividade representa **o trabalho executado**.

Exemplos já identificados:

- SEPARAÇÃO;
- EMBALAGEM;
- CARGA E DESCARGA;
- EXPEDIÇÃO;
- ETIQUETAGEM;
- RESSUPRIMENTO;
- MOVIMENTAÇÃO;
- PREPARAÇÃO DE SAMPLING;
- OUTRO.

## 10.5 Funções / recursos

`CAD_FUNCOES`

Inicialmente:

- AUXILIAR OPERACIONAL;
- OPERADOR DE EMPILHADEIRA.

Regra fundamental:

**OPERADOR DE EMPILHADEIRA é função/recurso, não atividade.**

## 10.6 Produtos

`CAD_PRODUTOS`

```text
PRODUTO | CATEGORIA | ATIVO
```

Categorias:

- ALIMENTACAO;
- BEBIDA.

Produtos históricos identificados incluem, entre outros:

- X-TUDO;
- X-FRANGO;
- PODRÃO;
- GOURMET;
- COCA-COLA 2L;
- COCA-COLA 600ML;
- COCA-COLA LATA;
- GUARANÁ 2L.

O catálogo definitivo será validado contra o histórico antes de produção.

---

# 11. FORMULÁRIO / INTERFACE DO MVP

O conceito de entrada continua sendo uma **Solicitação de Custo Extra**.

Tipos iniciais:

```text
MÃO DE OBRA TERCEIRIZADA
ALIMENTAÇÃO / BEBIDAS
```

O frontend deve exibir apenas os campos pertinentes ao tipo escolhido.

Para manter o MVP simples, cada envio pode representar uma necessidade/tipo principal. Não tentar reproduzir agora um ERP com dezenas de itens, workflows e subtelas.

---

# 12. CAMPOS DE MÃO DE OBRA

Base funcional planejada:

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

Turno deve ser informado manualmente:

- DIURNO;
- NOTURNO.

Não inferir turno por horário no MVP.

---

# 13. CAMPOS DE ALIMENTAÇÃO / BEBIDAS

Base funcional planejada:

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

---

# 14. RESPONSABILIDADE FINANCEIRA

Campo obrigatório:

```text
RESPONSAVEL_CUSTO
```

Valores do MVP:

- CLIENTE;
- UNILOG.

Regra:

```text
CLIENTE
→ cliente/operação deriva da própria solicitação
→ não exigir centro de custo
```

```text
UNILOG
→ centro de custo obrigatório
→ aceitar somente dígitos
→ armazenar como texto para preservar zeros à esquerda
```

---

# 15. REGRAS FINANCEIRAS — MÃO DE OBRA

A lógica fundamental permanece:

```text
Valor previsto
= quantidade solicitada × preço unitário aplicado
```

```text
Valor realizado
= quantidade comparecida × preço unitário congelado
```

A quantidade comparecida é informação administrativa, posterior à execução.

Pode ser zero.

Não impedir automaticamente comparecimento maior do que solicitado; registrar a realidade e evidenciar a divergência.

---

# 16. REGRAS FINANCEIRAS — ALIMENTAÇÃO/BEBIDAS

Diferente da mão de obra:

```text
Valor esperado
= quantidade solicitada × preço aplicado
```

Não existe conceito de `pessoas comparecidas` para alimentação/bebidas.

Não misturar a lógica financeira dos dois tipos.

---

# 17. PREÇOS VERSIONADOS E SNAPSHOT

Um dos principais objetivos do MVP é acabar com a alteração retroativa de preço histórico.

## 17.1 Mão de obra

`PRECOS_MO`

Estrutura conceitual:

```text
FORNECEDOR
FUNCAO
TURNO
VIGENCIA_INICIO
VIGENCIA_FIM
PRECO_UNITARIO
ATIVO
```

## 17.2 Produtos

`PRECOS_PRODUTOS`

```text
FORNECEDOR
PRODUTO
VIGENCIA_INICIO
VIGENCIA_FIM
PRECO_UNITARIO
ATIVO
```

## 17.3 Regra de histórico

Quando a API encontrar o preço aplicável, deve gravar na solicitação o valor utilizado como snapshot.

Exemplo:

```text
PRECO_UNITARIO_APLICADO = 160,00
```

Se posteriormente o cadastro passar a R$ 180, a solicitação antiga continua R$ 160.

Nunca depender de fórmula dinâmica apontando para o preço atual para reconstruir custo histórico.

---

# 18. REGRAS DE PREÇO JÁ IDENTIFICADAS NO LEGADO

Histórico conhecido de mão de obra contém, entre outros:

- auxiliar operacional com preço base histórico de R$ 160;
- operador de empilhadeira com preço de R$ 240 em períodos observados;
- regras posteriores já discutidas envolvendo R$ 180, finais de semana, domingos/feriados e turno noturno.

**Importante:** não codificar novas regras automaticamente apenas a partir desta memória.

Antes de implementar a tabela definitiva de preços, validar as regras vigentes com o responsável funcional e registrar a vigência corretamente.

---

# 19. COMPETÊNCIA FINANCEIRA

Regra obrigatória:

```text
21 de um mês
até
20 do mês seguinte
```

Exemplo:

```text
21/08/2026 a 20/09/2026
```

A competência deve ser derivada da data operacional do item/serviço, e não digitada livremente pelo usuário.

---

# 20. API APPS SCRIPT — PRINCÍPIO

Apps Script será tratado como uma API, não como scripts soltos ligados a células.

Estrutura conceitual esperada:

```text
GET  /health
GET  /cadastros
GET  /solicitacoes
GET  /solicitacoes/:id
POST /solicitacoes
PUT  /solicitacoes/:id
POST /solicitacoes/:id/comparecimento
```

Apps Script Web Apps normalmente recebem chamadas por `doGet(e)` e `doPost(e)`; o roteamento interno será implementado na aplicação.

PUT lógico pode ser encaminhado por POST com `action`/`method` caso as limitações práticas do Web App indiquem isso.

Não definir contrato final da API antes de fechar os campos de `SOLICITACOES`.

---

# 21. PROTOCOLO

Cada solicitação nova deve receber identificador único gerado pela API.

Formato exato ainda pode ser validado.

Exemplo conceitual:

```text
CE-2026-000001
```

Não usar número da linha da planilha como identificador permanente.

---

# 22. AUDITORIA MÍNIMA

Mesmo usando Google Sheets, alterações importantes precisam de rastreabilidade.

Criar posteriormente `AUDITORIA` ou `LOG` com, no mínimo:

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

Não permitir que o histórico administrativo relevante seja silenciosamente sobrescrito.

---

# 23. LEGADO

As duas planilhas antigas são fontes históricas e não devem ser alteradas para se adaptarem ao novo sistema.

Processo futuro:

```text
bases antigas
   ↓
leitura
   ↓
normalização
   ↓
mapeamento de nomes
   ↓
validação
   ↓
importação para estrutura do MVP
```

Cada registro migrado deve preservar referência de origem, por exemplo:

```text
ORIGEM = LEGADO_MO
ORIGEM = LEGADO_LANCHES
```

Além de identificador/linha original quando disponível.

Linhas preenchidas somente por fórmulas e sem solicitação real devem ser descartadas na migração.

---

# 24. GOOGLE FORMS

O Google Form pode permanecer como:

- contingência;
- entrada temporária durante a implantação;
- fallback caso a aplicação web esteja indisponível.

Porém a arquitetura principal passa a ser:

```text
Cloudflare frontend
→ Apps Script API
→ Google Sheets
```

Não é obrigatório manter o Form como interface principal depois que o frontend MVP estiver funcional.

---

# 25. GITHUB E FLUXO DE DESENVOLVIMENTO

Repositório oficial:

`srcarneiro1/Extra-Cost-Control-Unilog`

O repositório deve permanecer privado.

Fluxo preferencial:

```text
main
  ↑
Pull Request
  ↑
feature/* ou fix/*
```

Para mudanças relevantes:

1. criar branch;
2. implementar alteração;
3. revisar diff;
4. abrir PR;
5. validar build/testes;
6. fazer merge;
7. verificar deploy Cloudflare.

Evitar alterações manuais diretas em produção sem commit correspondente.

---

# 26. ESTRUTURA DE REPOSITÓRIO RECOMENDADA

```text
Extra-Cost-Control-Unilog/
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── types/
│   └── utils/
│
├── functions/
│   └── api/
│
├── apps-script/
│   ├── Code.gs
│   ├── Api.gs
│   ├── SheetRepository.gs
│   ├── PricingService.gs
│   └── ValidationService.gs
│
├── docs/
│
├── public/
│
├── .env.example
├── .gitignore
├── README.md
├── MEMORIA_PROJETO.md
├── package.json
└── wrangler.jsonc
```

O código Apps Script ficará versionado no GitHub, mesmo que a implantação no Google precise inicialmente de cópia/deploy pelo Apps Script.

Posteriormente pode ser avaliado `clasp`, mas não é requisito do MVP 1.

---

# 27. CLOUDFLARE

Cloudflare será responsável por hospedar o frontend.

Arquitetura recomendada:

```text
Cloudflare Pages
├── React/Vite SPA
└── Pages Functions / Worker para chamadas protegidas
```

Variáveis e secrets de produção devem ser configurados no Cloudflare, não commitados.

---

# 28. TECNOLOGIA DO FRONTEND

Direção já adotada anteriormente e mantida:

- React;
- TypeScript;
- Vite;
- Cloudflare Pages;
- GitHub.

O frontend deve ser responsivo e adequado a desktop e mobile.

Não adicionar frameworks ou dependências pesadas sem necessidade concreta.

---

# 29. ESCOPO EXCLUÍDO DO MVP 1

Não implementar agora, salvo nova decisão explícita:

- Supabase;
- banco PostgreSQL dedicado;
- arquitetura multiaplicação da UNILOG;
- reorganização do Forecast Planner;
- dashboard BI sofisticado;
- integração automática com WhatsApp;
- envio automático de anexos;
- sistema fiscal completo;
- workflow excessivamente detalhado;
- split complexo de item entre várias NFs;
- dezenas de status operacionais.

Esses itens podem ser reavaliados depois que o processo básico estiver funcional.

---

# 30. STATUS SIMPLIFICADO DO MVP

Não criar muitos status.

Direção inicial:

```text
ENVIADA
EM_VALIDACAO
VALIDADA
AGUARDANDO_EXECUCAO / AGUARDANDO_REAL quando aplicável
AGUARDANDO_NF
CONFERIDA
ENCERRADA
```

A lista final será reduzida e validada antes da implementação.

Não usar esta seção como autorização para criar todos os status sem validação funcional.

---

# 31. PRINCÍPIO DE PROCESSO

O sistema deve diferenciar sempre:

```text
SOLICITADO
REALIZADO
FATURADO
```

Para mão de obra:

```text
solicitado = quantidade pedida
realizado = quantidade comparecida
faturado = valor efetivamente cobrado na NF
```

Para alimentação:

```text
solicitado = quantidade pedida
esperado = quantidade × preço congelado
faturado = valor cobrado na NF
```

---

# 32. NOTA FISCAL — DIREÇÃO FUTURA

O processo já levantado anteriormente permanece como referência, mas não é o primeiro bloco do MVP.

Uma NF:

- pertence a um fornecedor;
- pode consolidar itens de várias solicitações;
- um fornecedor pode emitir mais de uma NF na mesma competência;
- o sistema deve comparar esperado × faturado.

Na V1, evitar fracionamento de um mesmo item entre várias notas, salvo se a operação provar que isso é necessário.

---

# 33. PRINCÍPIO DE MELHORIA DE PROCESSO

Este projeto deve ser conduzido como melhoria de processo, não apenas digitalização de um formulário ruim.

Sempre questionar:

- o campo é realmente necessário?
- o dado deveria ser digitado ou derivado?
- existe cadastro para evitar texto livre?
- existe risco de alterar histórico?
- solicitado, realizado e faturado estão separados?
- a regra pertence ao frontend ou à API?
- o dado pode ser auditado?
- o processo está mais simples que o atual?

O MVP deve reduzir trabalho manual, e não apenas deslocá-lo para outra tela.

---

# 34. PRÓXIMA AÇÃO RECOMENDADA

Não iniciar pelo dashboard e não reabrir Supabase.

Sequência recomendada:

1. revisar a planilha `Controle de Custos Extras - UNILOG`;
2. criar/validar os cadastros mínimos;
3. definir a estrutura definitiva da aba `SOLICITACOES`;
4. definir o contrato mínimo da API Apps Script;
5. implementar Apps Script `health` + leitura dos cadastros;
6. implementar `POST /solicitacoes`;
7. testar escrita/leitura diretamente pela API;
8. criar o frontend React no GitHub;
9. conectar Cloudflare ao GitHub;
10. integrar frontend com API por camada segura;
11. criar tela administrativa para quantidade real de MO;
12. implementar preços versionados e snapshot;
13. migrar legado somente depois que a estrutura nova estiver estável.

---

# 35. REGRA PARA AS PRÓXIMAS CONVERSAS

Ao retomar este projeto:

- usar este arquivo como memória principal;
- diferenciar decisões confirmadas de propostas;
- não inventar campos ou regras;
- não ampliar escopo sem benefício operacional claro;
- priorizar MVP funcional;
- manter Google Sheets + Apps Script API como persistência/backend vigente;
- manter GitHub + Cloudflare como código/deploy vigente;
- preservar legado;
- avançar em pequenos PRs verificáveis.

---

## RESUMO EXECUTIVO

```text
SEM SUPABASE.

Frontend:
React + TypeScript + Vite
        ↓
Cloudflare Pages
        ↓
Cloudflare Function/Worker quando necessário
        ↓
Apps Script API
        ↓
Google Planilhas

Código e governança:
GitHub privado
srcarneiro1/Extra-Cost-Control-Unilog

MVP:
Custos Extras
├── Mão de obra terceirizada
└── Alimentação / Bebidas

Prioridades:
padronizar entrada
→ congelar preço histórico
→ separar solicitado x realizado
→ preservar legado
→ criar API simples
→ depois evoluir.
```
