# DICIONÁRIO — CADASTROS INICIAIS E SOLICITACOES

**Projeto:** Extra Cost Control — UNILOG  
**Referência funcional:** `MEMORIA_PROJETO.md`  
**Data de consolidação:** 12/09/2026

> Este documento detalha a estrutura vigente da aba `SOLICITACOES` e dos cadastros relacionados. Em caso de divergência com implementação mais recente, prevalece o código ativo do projeto.

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
KOKESHI | SIM
YENZAH | SIM
RITUARIA | SIM
BEAUTY HUB | SIM
```

Decisão confirmada em 01/09/2026:

- usar `MEGALABS` como nome canônico, sem espaço;
- manter `LESCENT` como operação ativa já presente na carga inicial;
- incluir `KOKESHI`, `YENZAH`, `RITUARIA` e `BEAUTY HUB` como operações ativas;
- esta lista é a carga inicial e poderá ser incrementada posteriormente;
- não promover automaticamente outras variações históricas para o cadastro ativo.

Não incluídos nesta primeira carga:

- PROJETOS;
- BTC B2B;
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

`SOLICITACOES` é a persistência operacional normalizada do MVP.

Uma linha representa **uma solicitação**.

A mesma aba suporta:

```text
MAO_DE_OBRA
ALIMENTACAO_BEBIDA
```

Campos não aplicáveis ao tipo da solicitação permanecem vazios.

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
| ORIGEM | texto | sim | Identifica origem do registro. |
| ID_ORIGEM | texto | não | Identificador da origem quando aplicável. |
| LOTE_IMPORTACAO | texto | não | Preenchido somente em migrações controladas. |

## 3.2 Contexto comum

| Coluna | Tipo | Obrigatório | Origem/regra |
|---|---|---:|---|
| SUPERVISOR | texto controlado | sim | Deve existir ativo em `CAD_SUPERVISORES`. |
| OPERACAO | texto controlado | sim | Deve existir ativa em `CAD_OPERACOES`. |
| DATA_OPERACIONAL | data | sim | Data de execução/atendimento. |
| COMPETENCIA | texto | sim | Derivada pela API de `DATA_OPERACIONAL`, conforme ciclo 21 → 20. |
| FORNECEDOR | texto controlado | posterior | Definido na triagem administrativa. |
| JUSTIFICATIVA | texto | sim | Justificativa/detalhamento operacional. |
| RESPONSAVEL_CUSTO | texto controlado | sim | `CLIENTE` ou `UNILOG`. |
| CENTRO_CUSTO | texto | condicional | Obrigatório quando `RESPONSAVEL_CUSTO = UNILOG`; somente dígitos e armazenado como texto. |

---

# 4. CAMPOS ESPECÍFICOS — MÃO DE OBRA

Preenchidos quando:

```text
TIPO_SOLICITACAO = MAO_DE_OBRA
```

| Coluna | Tipo | Obrigatório | Origem/regra |
|---|---|---:|---|
| ATIVIDADE | texto controlado | sim | `CAD_ATIVIDADES`. |
| FUNCAO | texto controlado | sim | `CAD_FUNCOES`. |
| TURNO | texto controlado | sim | `DIURNO` ou `NOTURNO`; qualquer função ativa pode usar qualquer um dos dois turnos. |
| QTD_SOLICITADA | número | sim | Quantidade solicitada de recursos. |
| QTD_COMPARECIDA | número | posterior | Registrada após execução; pode ser zero ou superar a solicitada. |
| VOLUME_REFERENCIA | número/texto | não | Referência operacional opcional. |
| UNIDADE_VOLUME | texto | não | Unidade correspondente ao volume. |
| PRECO_UNITARIO_APLICADO | moeda | posterior | Snapshot do preço vigente na triagem. |
| VALOR_PREVISTO | moeda | posterior | `QTD_SOLICITADA × PRECO_UNITARIO_APLICADO`. |
| VALOR_REAL | moeda | posterior | Calculado a partir do realizado. |

Não inferir `TURNO` por horário.

---

# 5. CAMPOS ESPECÍFICOS — ALIMENTAÇÃO / BEBIDAS

Preenchidos quando:

```text
TIPO_SOLICITACAO = ALIMENTACAO_BEBIDA
```

Pelo menos alimentação ou bebida deve estar preenchida.

## 5.1 Solicitação original

| Coluna | Tipo | Obrigatório | Origem/regra |
|---|---|---:|---|
| PRODUTO_ALIMENTACAO | texto controlado | condicional | Produto solicitado, categoria `ALIMENTACAO`. |
| QTD_ALIMENTACAO | número | condicional | Obrigatória quando houver alimentação. |
| PRODUTO_BEBIDA | texto controlado | condicional | Produto solicitado, categoria `BEBIDA`. |
| QTD_BEBIDA | número | condicional | Obrigatória quando houver bebida. |

## 5.2 Produto efetivamente aplicado na triagem

| Coluna | Tipo | Obrigatório | Origem/regra |
|---|---|---:|---|
| PRODUTO_ALIMENTACAO_APLICADO | texto controlado | posterior | Produto efetivamente aplicado pelo administrativo; pode ser igual ao solicitado. |
| PRODUTO_BEBIDA_APLICADO | texto controlado | posterior | Produto efetivamente aplicado pelo administrativo; pode ser igual ao solicitado. |
| MOTIVO_AJUSTE_PRODUTO | texto | condicional | Obrigatório quando produto aplicado divergir do produto originalmente solicitado. |

## 5.3 Preços e valores congelados

| Coluna | Tipo | Obrigatório | Origem/regra |
|---|---|---:|---|
| PRECO_ALIMENTACAO_APLICADO | moeda | posterior | Snapshot do preço vigente do produto aplicado. |
| VALOR_ALIMENTACAO | moeda | posterior | `QTD_ALIMENTACAO × PRECO_ALIMENTACAO_APLICADO`. |
| PRECO_BEBIDA_APLICADO | moeda | posterior | Snapshot do preço vigente do produto aplicado. |
| VALOR_BEBIDA | moeda | posterior | `QTD_BEBIDA × PRECO_BEBIDA_APLICADO`. |
| VALOR_PREVISTO | moeda | posterior | Soma dos valores de alimentação e bebida. |

Para alimentação/bebida não existe `QTD_COMPARECIDA`.

---

# 6. ORDEM FÍSICA VIGENTE DOS CABEÇALHOS

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

Total: **36 colunas**.

---

# 7. REGRAS DE PERSISTÊNCIA

1. O frontend nunca referencia coluna ou célula da planilha diretamente.
2. A API recebe/retorna objetos com nomes de campos estáveis.
3. Preços aplicados são snapshots imutáveis para o registro histórico.
4. `COMPETENCIA` é derivada, nunca digitada pelo usuário.
5. `CENTRO_CUSTO` é texto, mesmo sendo composto somente por dígitos.
6. Campos não aplicáveis permanecem vazios.
7. Produto solicitado e produto aplicado são preservados separadamente.
8. Quando houver substituição de produto na triagem, `MOTIVO_AJUSTE_PRODUTO` é obrigatório.

---

# 8. CADASTROS E ESTRUTURAS RELACIONADAS

```text
CAD_OPERACOES: OPERACAO | ATIVO
CAD_SUPERVISORES: SUPERVISOR | ATIVO
CAD_ATIVIDADES: ATIVIDADE | ATIVO
CAD_FUNCOES: FUNCAO | ATIVO
CAD_PRODUTOS: PRODUTO | CATEGORIA | ATIVO
PRECOS_MO: FORNECEDOR | FUNCAO | TURNO | TIPO_DIA | VIGENCIA_INICIO | VIGENCIA_FIM | PRECO_UNITARIO | ATIVO
PRECOS_PRODUTOS: FORNECEDOR | PRODUTO | VIGENCIA_INICIO | VIGENCIA_FIM | CATEGORIA | PRECO_UNITARIO | ATIVO
METAS_MO: COMPETENCIA | META_MO
```
