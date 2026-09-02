# CLOUDFLARE API GATEWAY — MVP 1

## Objetivo

Intermediar chamadas protegidas entre o frontend Cloudflare Pages e o Google Apps Script sem expor segredos no navegador.

Arquitetura desta etapa:

```text
Cliente de teste / futuro frontend autenticado
→ Cloudflare Pages Function
→ segredo de integração
→ Apps Script Web App
→ Google Sheets
```

## Rotas Cloudflare

```text
GET  /api/cadastros
POST /api/solicitacoes
```

Nesta fase, enquanto o login definitivo ainda não existe, as duas rotas exigem o header temporário:

```text
x-gateway-test-token
```

Esse token existe apenas para testes controlados e deverá ser removido quando a autenticação real do produto for implementada.

## Variáveis / segredos no Cloudflare Pages

Configurar no ambiente do projeto:

```text
APPS_SCRIPT_URL
APPS_SCRIPT_GATEWAY_TOKEN
GATEWAY_TEST_TOKEN
```

Regras:

- `APPS_SCRIPT_URL`: URL estável `/exec` da implantação do Web App;
- `APPS_SCRIPT_GATEWAY_TOKEN`: segredo compartilhado Cloudflare → Apps Script;
- `GATEWAY_TEST_TOKEN`: segredo temporário para autorizar testes do cliente → Cloudflare;
- nenhum desses valores deve ser commitado no GitHub ou incluído no bundle React.

## Propriedade no Apps Script

Em **Configurações do projeto → Propriedades do script**, adicionar:

```text
GATEWAY_TOKEN
```

O valor deve ser exatamente o mesmo configurado no Cloudflare como:

```text
APPS_SCRIPT_GATEWAY_TOKEN
```

## Implantação do Apps Script

O Cloudflare não possui a sessão Google usada no navegador. Portanto a implantação do Web App precisa permitir que o request chegue ao `doPost` sem login interativo.

A proteção de escrita deixa de depender da sessão Google e passa a depender da validação explícita do `GATEWAY_TOKEN` dentro da API.

Antes de tornar a implantação acessível sem login:

1. atualizar `Api.gs` e `JsonResponse.gs` com a versão desta PR;
2. configurar `GATEWAY_TOKEN` nas propriedades do script;
3. salvar;
4. criar nova versão da implantação;
5. somente então ajustar a implantação para permitir acesso sem sessão Google, conforme as opções disponíveis na conta Workspace.

`GET ?route=health` permanece público e não grava dados.

`cadastros` e `solicitacoes` exigem o token do gateway.

## Teste controlado

Exemplo conceitual:

```text
POST https://<dominio-pages>/api/solicitacoes
x-gateway-test-token: <segredo temporário>
Content-Type: application/json
```

O cliente nunca envia `APPS_SCRIPT_GATEWAY_TOKEN`. A Pages Function adiciona esse segredo somente no request server-side enviado ao Apps Script.

## Próxima evolução

Quando o login do produto estiver implementado:

1. remover `GATEWAY_TEST_TOKEN` e o header temporário;
2. validar a sessão/identidade do usuário na Function;
3. derivar a identidade de criação a partir da sessão confiável;
4. manter `APPS_SCRIPT_GATEWAY_TOKEN` exclusivamente como autenticação serviço-a-serviço Cloudflare → Apps Script.
