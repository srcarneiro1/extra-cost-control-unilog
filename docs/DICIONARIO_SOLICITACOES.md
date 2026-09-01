# DICIONÁRIO — CADASTROS INICIAIS E SOLICITACOES

**Projeto:** Extra Cost Control — UNILOG  
**Referência funcional:** `MEMORIA_PROJETO.md`  
**Data de consolidação:** 01/09/2026

> Este documento detalha a execução das ações 1 e 2 da seção **Próximas ações** da memória do projeto. Em caso de divergência, `MEMORIA_PROJETO.md` continua sendo a fonte de verdade.

---

# 1. CADASTROS INICIAIS CONFIRMADOS

## 1.1 CAD_OPERACOES

Estrutura vigente:

```text
OPERACAO | ATIVO
```

Carga inicial confirmada:

```text
BARBOURS | SIM
CAFFEINE B2C | SIM
APICE | SIM
OLLIE | SIM
BAOBA B2C | SIM
MEGALABS | SIM
LESCENT | SIM
CAFFEINE B2B | SIM
CELLERA | SIM
DACOLONIA | SIM
SALLVE | SIM
FOREVER | SIM
BAOBA B2B | SIM
ADM | SIM
```

Decisão confirmada em 01/09/2026:

- usar `MEGALABS` como nome canônico, sem espaço;
- esta lista é a carga inicial e poderá ser incrementada posteriormente;
- não promover automaticamente outras variações históricas para o cadastro ativo.

Não incluídos nesta primeira carga:

- PROJETOS;
- BTC B2B;
- KOKESHI;
- LOLA;
- CELLERA FARMA;
- CELLERA CONSUMO.

Esses valores permanecem apenas como ocorrências do legado até validação posterior.

## 1.2 CAD_SUPERVISORES

Estrutura vigente:

```text
SUPERVISOR | ATIVO
```

Carga inicial confirmada:

```text
RODRIGO GIMENES | SIM
DIMAS CASTELO | SIM
ELIELSON PATROCINIO | SIM
DORIEDSON CAETANO | SIM
ALEX GUIDINI | SIM
HANANI CELESTINO | SIM
ALLAN OLIVEIRA | SIM
```

Padronização inicial:

- `DORIEDSON CAETANO` é o nome canônico para novas solicitações;
- variações históricas serão tratadas futuramente no mapa de equivalência da migração.

---

# 2. PRINCÍPIO DA ABA SOLICITACOES

`SOLICITACOES` será a persistência operacional normalizada do MVP.

Uma linha representa **uma solicitação**.

A mesma aba suporta os dois tipos do MVP:

```text
MAO_DE_OBRA
ALIMENTACAO_BEBIDA
```

Campos não aplicáveis ao tipo da solicitação permanecem vazios.

Não criar neste momento uma segunda aba de itens ou uma estrutura relacional adicional. A separação entre mão de obra e alimentação/bebida ocorre pelas colunas específicas e pelas regras da API.

A planilha não executa regras de negócio por fórmulas dinâmicas. A API calcula, valida e grava snapshots.

---

# 3. DICIONÁRIO DEFINITIVO — SOLICITACOES

## 3.1 Identificação e rastreabilidade

| Coluna | Tipo | Obrigatório | Origem/regra |
|---|---|---:|---|
| ID_SOLICITACAO | texto | sim | Gerado pela API. Não usar número da linha. |
| TIPO_SOLICITACAO | texto controlado | sim | `MAO_DE_OBRA` ou `ALIMENTACAO_BEBIDA`. |
| DATA_CRIACAO | data/hora | sim | Gerada pela API no registro. |
| USUARIO_CRIACAO | texto | sim | Identificação do usuário que criou a solicitação. |
| ORIGEM | texto | sim | Identifica origem do registro; necessário para rastreabilidade e futura migração. |
| ID_ORIGEM | texto | não | Identificador/linha da origem quando aplicável ao legado. |
| LOTE_IMPORTACAO | texto | não | Preenchido somente em migrações controladas. |

## 3.2 Contexto comum

| Coluna | Tipo | Obrigatório | Origem/regra |
|---|---|---:|---|
| SUPERVISOR | texto controlado | sim | Deve existir ativo em `CAD_SUPERVISORES`. |
| OPERACAO | texto controlado | sim | Deve existir ativa em `CAD_OPERACOES`. |
| DATA_OPERACIONAL | data | sim | Data de execução para MO ou data de atendimento para alimentação/bebida. |
| COMPETENCIA | texto | sim | Derivada pela API de `DATA_OPERACIONAL`, conforme ciclo 21 → 20. Não digitada livremente. |
| FORNECEDOR | texto controlado | sim | Deve existir ativo e habilitado para o tipo correspondente em `CAD_FORNECEDORES`. |
| JUSTIFICATIVA | texto | sim | Justificativa/detalhamento operacional da solicitação. |
| RESPONSAVEL_CUSTO | texto controlado | sim | `CLIENTE` ou `UNILOG`. |
| CENTRO_CUSTO | texto | condicional | Obrigatório quando `RESPONSAVEL_CUSTO = UNILOG`; somente dígitos e armazenado como texto. Vazio quando CLIENTE. |

Regra confirmada para CLIENTE:

```text
cliente responsável deriva da própria OPERACAO
```

Não é necessário duplicar o nome do cliente em outra coluna operacional.

---

# 4. CAMPOS ESPECÍFICOS — MÃO DE OBRA

Preenchidos somente quando:

```text
TIPO_SOLICITACAO = MAO_DE_OBRA
```

| Coluna | Tipo | Obrigatório | Origem/regra |
|---|---|---:|---|
| ATIVIDADE | texto controlado | sim | `CAD_ATIVIDADES`. Representa trabalho executado. |
| FUNCAO | texto controlado | sim | `CAD_FUNCOES`. `OPERADOR DE EMPILHADEIRA` é função, não atividade. |
| TURNO | texto controlado | sim | `DIURNO` ou `NOTURNO`. Informado manualmente. |
| QTD_SOLICITADA | número | sim | Quantidade solicitada de recursos. |
| QTD_COMPARECIDA | número | posterior | Registrada administrativamente após execução; pode ser zero ou superar a solicitada. |
| VOLUME_REFERENCIA | número/texto normalizado | não | Campo opcional de referência operacional. |
| UNIDADE_VOLUME | texto | não | Unidade correspondente ao volume, quando informada. |
| PRECO_UNITARIO_APLICADO | moeda | sim | Snapshot do preço vigente obtido pela API. |
| VALOR_PREVISTO | moeda | sim | `QTD_SOLICITADA × PRECO_UNITARIO_APLICADO`. Gravado pela API. |
| VALOR_REAL | moeda | posterior | `QTD_COMPARECIDA × PRECO_UNITARIO_APLICADO`. Gravado/atualizado pela API após comparecimento. |

Não inferir `TURNO` por horário.

`QTD_COMPARECIDA` não deve ser bloqueada por divergência em relação à quantidade solicitada. A divergência deve ser evidenciada pelo sistema.

---

# 5. CAMPOS ESPECÍFICOS — ALIMENTAÇÃO / BEBIDAS

Preenchidos somente quando:

```text
TIPO_SOLICITACAO = ALIMENTACAO_BEBIDA
```

Pelo menos um dos grupos abaixo deve estar preenchido.

## 5.1 Alimentação

| Coluna | Tipo | Obrigatório | Origem/regra |
|---|---|---:|---|
| PRODUTO_ALIMENTACAO | texto controlado | condicional | Produto ativo de categoria `ALIMENTACAO` em `CAD_PRODUTOS`. |
| QTD_ALIMENTACAO | número | condicional | Obrigatória quando houver `PRODUTO_ALIMENTACAO`. |
| PRECO_ALIMENTACAO_APLICADO | moeda | condicional | Snapshot do preço vigente do produto. |
| VALOR_ALIMENTACAO | moeda | condicional | `QTD_ALIMENTACAO × PRECO_ALIMENTACAO_APLICADO`. |

## 5.2 Bebida

| Coluna | Tipo | Obrigatório | Origem/regra |
|---|---|---:|---|
| PRODUTO_BEBIDA | texto controlado | condicional | Produto ativo de categoria `BEBIDA` em `CAD_PRODUTOS`. |
| QTD_BEBIDA | número | condicional | Obrigatória quando houver `PRODUTO_BEBIDA`. |
| PRECO_BEBIDA_APLICADO | moeda | condicional | Snapshot do preço vigente do produto. |
| VALOR_BEBIDA | moeda | condicional | `QTD_BEBIDA × PRECO_BEBIDA_APLICADO`. |

## 5.3 Total da solicitação de alimentação/bebida

| Coluna | Tipo | Obrigatório | Origem/regra |
|---|---|---:|---|
| VALOR_PREVISTO | moeda | sim | Soma dos valores de alimentação e bebida preenchidos. |

Para alimentação/bebida não existe `QTD_COMPARECIDA` nem cálculo financeiro por quantidade realizada.

---

# 6. ORDEM FÍSICA PROPOSTA DOS CABEÇALHOS

A ordem abaixo é a ordem de produção recomendada para a aba `SOLICITACOES`:

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
```

Total: **33 colunas**.

---

# 7. REGRAS DE PERSISTÊNCIA

1. O frontend nunca referencia coluna ou célula da planilha diretamente.
2. A API recebe/retorna objetos com nomes de campos estáveis.
3. Preços aplicados são snapshots imutáveis para o registro histórico.
4. `COMPETENCIA` é derivada, nunca digitada pelo usuário.
5. `CENTRO_CUSTO` é texto, mesmo sendo composto somente por dígitos.
6. Campos não aplicáveis permanecem vazios; não usar textos como `N/A` como dado operacional.
7. O legado não deve ser adaptado diretamente nesta aba; a migração ocorrerá posteriormente por staging, normalização e equivalências.
8. Alterações administrativas relevantes devem futuramente gerar trilha em `AUDITORIA`/`LOG`, conforme memória do projeto.

---

# 8. DECISÕES CONFIRMADAS X IMPLEMENTAÇÃO POSTERIOR

## Confirmado neste documento

- carga inicial de operações e supervisores;
- `MEGALABS` como nome canônico;
- uma linha por solicitação na aba `SOLICITACOES`;
- suporte aos dois tipos do MVP na mesma aba;
- grupos de colunas específicos por tipo;
- competência 21 → 20;
- responsabilidade financeira CLIENTE/UNILOG;
- centro de custo condicional;
- solicitado x comparecido separados para MO;
- preço aplicado congelado;
- sem quantidade comparecida para alimentação/bebida;
- preservação de origem para migração futura.

## Ainda não implementar como regra definitiva

- tabelas `PRECOS_MO` e `PRECOS_PRODUTOS`, até validação das vigências/regras atuais;
- status/workflow adicional além do mínimo necessário;
- regras de autenticação/autorização detalhadas;
- migração do legado;
- dashboard;
- Supabase.

---

# 9. PRÓXIMO PASSO

Com as ações 1 e 2 documentadas, a próxima ação vigente da memória é:

```text
3. criar PRECOS_MO e PRECOS_PRODUTOS somente após validação das regras
```

Como as regras de preços ainda precisam ser validadas, o desenvolvimento da API deve aguardar o fechamento dessa validação antes de implementar resolução definitiva de preços.

O contrato da API pode ser detalhado somente depois dessa etapa, conforme ordem definida em `MEMORIA_PROJETO.md`.
