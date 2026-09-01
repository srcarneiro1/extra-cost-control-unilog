# API DE CRIAÇÃO DE SOLICITAÇÕES — MVP 1

## Objetivo

Implementar a primeira escrita controlada na aba `SOLICITACOES`, preservando o desacoplamento:

```text
Frontend / Forms
→ Apps Script API
→ Google Sheets
```

## Endpoint

```text
POST ?route=solicitacoes
Content-Type: application/json
```

O protocolo é gerado pela API no formato:

```text
CE-AAAA-000001
```

A API também deriva `COMPETENCIA` no formato `AAAA-MM`, representando o mês de fechamento do ciclo 21 → 20.

Exemplos:

```text
2026-08-20 → 2026-08
2026-08-21 → 2026-09
2026-09-20 → 2026-09
2026-09-21 → 2026-10
```

## Mão de obra

Payload mínimo:

```json
{
  "tipoSolicitacao": "MAO_DE_OBRA",
  "usuarioCriacao": "teste@unilog.com.br",
  "origem": "TESTE_API",
  "supervisor": "RODRIGO GIMENES",
  "operacao": "ADM",
  "dataOperacional": "2026-09-01",
  "fornecedor": "MULT",
  "justificativa": "TESTE CONTROLADO DA API",
  "responsavelCusto": "CLIENTE",
  "atividade": "SEPARACAO",
  "funcao": "AUXILIAR OPERACIONAL",
  "turno": "DIURNO",
  "qtdSolicitada": 1
}
```

A API valida os cadastros, seleciona o preço vigente e grava `PRECO_UNITARIO_APLICADO` e `VALOR_PREVISTO` como snapshot.

## Alimentação / bebida

Payload mínimo de exemplo:

```json
{
  "tipoSolicitacao": "ALIMENTACAO_BEBIDA",
  "usuarioCriacao": "teste@unilog.com.br",
  "origem": "TESTE_API",
  "supervisor": "RODRIGO GIMENES",
  "operacao": "ADM",
  "dataOperacional": "2026-09-01",
  "fornecedor": "ALMIRANTE",
  "justificativa": "TESTE CONTROLADO DA API",
  "responsavelCusto": "CLIENTE",
  "produtoAlimentacao": "X-TUDO",
  "qtdAlimentacao": 1,
  "produtoBebida": "COCA-COLA LATA",
  "qtdBebida": 1
}
```

## Regras implementadas

- supervisor, operação, fornecedor, atividade, função e produto devem estar ativos;
- fornecedor deve estar habilitado para o tipo solicitado;
- `RESPONSAVEL_CUSTO` aceita `CLIENTE` ou `UNILOG`;
- centro de custo é obrigatório e somente numérico quando `UNILOG`;
- turno é manual: `DIURNO` ou `NOTURNO`;
- quantidade solicitada/quantidades de produtos devem ser inteiros maiores que zero;
- data operacional aceita `AAAA-MM-DD`;
- campos não aplicáveis são gravados vazios;
- preço histórico é congelado no momento da criação;
- protocolo é gerado sob `LockService` para evitar duplicidade concorrente.

## Feriados — pendência deliberada

Sábado e domingo são classificados automaticamente.

A fonte oficial de feriados ainda não foi definida. Até essa definição, dias úteis são classificados como `UTIL`; portanto solicitações em feriados de segunda a sexta não devem ser lançadas em produção por este endpoint sem antes fechar a fonte de feriados.

O código de preços já suporta `DOMINGO_FERIADO`, mas a identificação automática de feriado será implementada em etapa própria.

## Autenticação

A autenticação/autorização definitiva ainda não faz parte deste PR. `USUARIO_CRIACAO` usa o usuário ativo da sessão do Apps Script quando disponível; caso contrário, exige `usuarioCriacao` no payload. Essa regra é transitória e será substituída pelo mecanismo de autenticação do produto.
