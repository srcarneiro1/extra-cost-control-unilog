# Google Forms — sincronização de catálogos

## Objetivo

O Google Forms operacional não deve exigir manutenção manual sempre que um cadastro mudar.

As opções do formulário são derivadas dos cadastros oficiais do sistema e sincronizadas pelo Apps Script.

## Fontes de verdade

| Pergunta no Forms | Fonte |
| --- | --- |
| Supervisor responsável | `CAD_SUPERVISORES` ativos |
| Operação | `CAD_OPERACOES` ativas |
| Atividade | `CAD_ATIVIDADES` ativas, exceto `OUTRO` |
| Função | `CAD_FUNCOES` ativas |
| Turno | valores fixos `DIURNO` e `NOTURNO` |
| Alimentação | produtos elegíveis da categoria `ALIMENTACAO` |
| Bebida | produtos elegíveis da categoria `BEBIDA` |

## Regra de função e turno

Toda função ativa pode ser utilizada em qualquer um dos dois turnos:

- `DIURNO`
- `NOTURNO`

Não existe exceção estrutural para `AUXILIAR OPERACIONAL`, `OPERADOR DE EMPILHADEIRA`, `MOTORISTA` ou futuras funções.

A disponibilidade comercial de uma combinação continua dependente do cadastro de preço vigente em `PRECOS_MO` no momento da triagem.

## Inclusão de novas funções

Depois da migração estrutural do Forms, uma nova função segue somente este fluxo:

1. cadastrar em `CAD_FUNCOES` pelo Web App;
2. manter `ATIVO = SIM`;
3. a sincronização atualiza a pergunta `Função` no Forms;
4. cadastrar os preços necessários em `PRECOS_MO` por fornecedor, turno e tipo de dia.

Não é necessário editar manualmente a pergunta `Função` no Google Forms.

## Produtos de alimentação/bebida

Um produto só aparece no Forms quando, na data da sincronização:

1. o produto está ativo em `CAD_PRODUTOS`;
2. pertence à categoria `ALIMENTACAO` ou `BEBIDA`;
3. existe fornecedor ativo habilitado para alimentação;
4. existe preço de produto ativo e vigente para esse vínculo.

Assim, ativação/inativação de produto, fornecedor e nova vigência de preço podem alterar automaticamente as opções de lanche do Forms.

## Disparadores

A sincronização ocorre por três caminhos:

- edição manual nas abas relevantes da planilha, via trigger `onCatalogEdit`;
- sincronização horária, via `scheduledFormCatalogSync`, como contingência;
- gravações relevantes realizadas pelo Web App chamam a sincronização diretamente pelo Apps Script.

Cadastros nominais de operação, supervisor, função e atividade já usam sincronização imediata.

Fornecedor, produto e preço de produto também devem sincronizar imediatamente porque afetam a elegibilidade de lanches.

## Migração única da estrutura de função/turno

O formulário legado possui campos específicos:

- `Turno — Auxiliar Operacional`
- `Turno — Operador de Empilhadeira`

A nova estrutura utiliza:

- `Função`
- `Turno`

A alteração estrutural não é executada silenciosamente pela sincronização cotidiana porque a pergunta `Função` do Forms legado pode conter navegação por seções.

Após publicar os arquivos Apps Script desta versão, executar uma única vez:

```text
migrateFormFunctionShiftStructure()
```

A rotina:

1. lê as funções ativas de `CAD_FUNCOES`;
2. reaproveita um campo de turno legado quando possível ou cria `Turno`;
3. posiciona `Turno` imediatamente depois de `Função`;
4. define `DIURNO` e `NOTURNO`;
5. transforma `Função` em uma escolha comum, sem roteamento específico por função;
6. remove os campos de turno legados restantes;
7. remove somente seções legadas que ficaram realmente vazias;
8. valida o estado final antes de retornar sucesso.

Depois da migração, executar:

```text
syncFormCatalogs()
```

A partir daí, a sincronização normal passa a atualizar `Função` e `Turno` junto aos demais catálogos.

## Compatibilidade de respostas

`FormResponseNormalizerService` lê prioritariamente o campo genérico `Turno`.

Durante a transição, ainda aceita como fallback:

- `Turno — Auxiliar Operacional`
- `Turno — Operador de Empilhadeira`

Isso protege respostas criadas no modelo anterior durante a janela de implantação.

## Segurança operacional

- Não remover funções históricas da planilha; preferir `ATIVO = NAO`.
- Alterar catálogo não recalcula preços históricos nem solicitações antigas.
- O Forms controla opções de entrada; a precificação continua sendo resolvida na triagem pela data operacional e tabela versionada.
- A sincronização de catálogos não deve alterar autenticação, competência ou valores já congelados.
