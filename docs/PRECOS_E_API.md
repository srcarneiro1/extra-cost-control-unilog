# PREÇOS E FUNDAÇÃO DA API — EXTRA COST CONTROL UNILOG

**Data:** 01/09/2026  
**Fonte de verdade principal:** `MEMORIA_PROJETO.md`

Este documento registra decisões já confirmadas para permitir o avanço da estrutura de preços e da API sem introduzir regras por inferência.

## 1. Estrutura de preços de mão de obra

A estrutura vigente proposta para `PRECOS_MO` passa a contemplar o tipo de dia explicitamente:

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

Valores controlados para `TIPO_DIA`:

```text
UTIL
SABADO
DOMINGO_FERIADO
```

### Matriz confirmada

| FUNCAO | TURNO | TIPO_DIA | PRECO_UNITARIO |
|---|---|---|---:|
| AUXILIAR OPERACIONAL | DIURNO | UTIL | 180,00 |
| AUXILIAR OPERACIONAL | DIURNO | SABADO | 270,00 |
| AUXILIAR OPERACIONAL | DIURNO | DOMINGO_FERIADO | 360,00 |
| OPERADOR DE EMPILHADEIRA | DIURNO | UTIL | 240,00 |
| OPERADOR DE EMPILHADEIRA | DIURNO | SABADO | 360,00 |
| OPERADOR DE EMPILHADEIRA | DIURNO | DOMINGO_FERIADO | 480,00 |
| OPERADOR DE EMPILHADEIRA | NOTURNO | UTIL | 300,00 |
| OPERADOR DE EMPILHADEIRA | NOTURNO | SABADO | 450,00 |
| OPERADOR DE EMPILHADEIRA | NOTURNO | DOMINGO_FERIADO | 600,00 |

Regras adicionais:

- turno continua sendo informado manualmente;
- não inferir `NOTURNO` por horário;
- não existe tarifa noturna separada confirmada para `AUXILIAR OPERACIONAL`;
- a data histórica inicial dos valores de operador permanece pendente de confirmação;
- a ausência dessa data não bloqueia a estrutura da API, mas bloqueia carga retroativa segura dessa vigência.

## 2. Estrutura de preços de produtos

```text
PRECOS_PRODUTOS
FORNECEDOR
PRODUTO
VIGENCIA_INICIO
VIGENCIA_FIM
PRECO_UNITARIO
ATIVO
```

Produtos adicionais encontrados na tabela ativa do legado e aptos a entrar no cadastro controlado:

```text
FANTA LARANJA 2L | BEBIDA
FANTA UVA 2L | BEBIDA
MARMITA P | ALIMENTACAO
MARMITA G | ALIMENTACAO
CAFE DA MANHA | ALIMENTACAO
CAFE DA TARDE | ALIMENTACAO
PIZZA G | ALIMENTACAO
```

A grafia operacional futura deve usar nomes padronizados sem acentos, preservando equivalências do legado somente na migração.

## 3. Contrato mínimo da API

Nesta fase, ficam autorizados os seguintes contratos mínimos:

```text
GET /health
GET /cadastros
```

Contratos já previstos na memória, mas ainda não implementados nesta fundação:

```text
GET  /solicitacoes
GET  /solicitacoes/:id
POST /solicitacoes
POST /solicitacoes/:id/comparecimento
```

### GET /health

Resposta mínima:

```json
{
  "ok": true,
  "service": "extra-cost-control-unilog",
  "version": "mvp1"
}
```

### GET /cadastros

Retorna somente registros ativos necessários ao frontend:

```json
{
  "ok": true,
  "data": {
    "operacoes": [],
    "supervisores": [],
    "fornecedores": [],
    "atividades": [],
    "funcoes": [],
    "produtos": []
  }
}
```

O frontend não referencia ranges, células ou índices da planilha.

## 4. Configuração do Apps Script

O Apps Script deve obter o ID da planilha por `PropertiesService` usando a chave:

```text
SPREADSHEET_ID
```

O ID real da planilha não deve ser necessário no frontend.

## 5. Pendências preservadas

- vigência histórica inicial de operador diurno/noturno;
- criação física das abas `PRECOS_MO` e `PRECOS_PRODUTOS` na planilha oficial;
- carga definitiva dos preços por fornecedor;
- autenticação/autorização;
- criação de solicitação;
- comparecimento real;
- migração do legado.
