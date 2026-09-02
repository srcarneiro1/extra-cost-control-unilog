# CLOUDFLARE API GATEWAY — MVP 1

## Objetivo

Intermediar chamadas protegidas entre o frontend Cloudflare Pages e o Google Apps Script sem expor segredos no navegador.

Arquitetura:

```text
Usuário autenticado
→ Cloudflare Access
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

As duas rotas aceitam autenticação por Cloudflare Access. Durante a transição, o header temporário abaixo continua funcionando somente para testes controlados:

```text
x-gateway-test-token
```

O fallback de teste deve ser removido depois que o Access estiver validado em Preview e Production.

## Cloudflare Access

Configurar uma aplicação Access protegendo o domínio do Pages usado pelo produto.

Fluxo sugerido para o MVP:

```text
Cloudflare Access
→ One-time PIN por e-mail
→ política Allow apenas para e-mails autorizados
```

Se futuramente existir IdP corporativo, Google Workspace ou outro provedor, ele pode substituir o One-time PIN sem alterar o contrato interno da aplicação.

A Pages Function valida o JWT enviado pelo Access no header:

```text
Cf-Access-Jwt-Assertion
```

A validação verifica:

- assinatura contra as chaves públicas do time Cloudflare;
- issuer do time;
- audience da aplicação Access;
- presença de e-mail autenticado.

A identidade confiável é utilizada em `POST /api/solicitacoes` para sobrescrever `usuarioCriacao`. O navegador não é fonte confiável desse campo quando o request vem via Access.

## Variáveis / segredos no Cloudflare Pages

Configurar por ambiente:

```text
APPS_SCRIPT_URL
APPS_SCRIPT_GATEWAY_TOKEN
GATEWAY_TEST_TOKEN
CLOUDFLARE_ACCESS_TEAM_DOMAIN
CLOUDFLARE_ACCESS_AUD
```

Regras:

- `APPS_SCRIPT_URL`: URL estável `/exec` da implantação do Web App;
- `APPS_SCRIPT_GATEWAY_TOKEN`: segredo compartilhado Cloudflare → Apps Script;
- `GATEWAY_TEST_TOKEN`: segredo temporário para testes; remover após estabilização do Access;
- `CLOUDFLARE_ACCESS_TEAM_DOMAIN`: domínio do time, por exemplo `https://empresa.cloudflareaccess.com`;
- `CLOUDFLARE_ACCESS_AUD`: Application Audience (AUD) da aplicação Access;
- nenhum desses valores deve ser incluído no bundle React;
- `CLOUDFLARE_ACCESS_TEAM_DOMAIN` e `CLOUDFLARE_ACCESS_AUD` não são segredos de autenticação do usuário, mas permanecem como configuração server-side.

## Propriedade no Apps Script

Em **Configurações do projeto → Propriedades do script**:

```text
GATEWAY_TOKEN
```

O valor deve ser exatamente o mesmo configurado no Cloudflare como:

```text
APPS_SCRIPT_GATEWAY_TOKEN
```

O Apps Script continua protegido por autenticação serviço-a-serviço. Cloudflare Access não substitui `APPS_SCRIPT_GATEWAY_TOKEN`.

## Compatibilidade de transição

Enquanto `GATEWAY_TEST_TOKEN` estiver configurado, estes dois modos são aceitos:

```text
1. sessão válida do Cloudflare Access
2. x-gateway-test-token válido
```

Sem nenhum dos dois, a Function responde `401 UNAUTHORIZED`.

## Testes mínimos antes de remover o token temporário

1. request sem Access e sem token temporário → `401`;
2. request com `GATEWAY_TEST_TOKEN` → continua funcionando durante a transição;
3. navegador autenticado pelo Access → `/api/cadastros` retorna `200` sem segredo no React;
4. criação de solicitação pelo navegador autenticado → `USUARIO_CRIACAO` recebe o e-mail validado pelo Access;
5. tentativa de enviar outro `usuarioCriacao` no body → deve ser ignorada quando a identidade vier do Access.

## Próxima evolução

Após validar Access em Preview e Production:

1. remover `GATEWAY_TEST_TOKEN` dos ambientes;
2. remover o fallback de teste do middleware;
3. conectar o frontend tipado a `/api/cadastros`;
4. estruturar os formulários reais;
5. manter `APPS_SCRIPT_GATEWAY_TOKEN` exclusivamente como autenticação Cloudflare → Apps Script.
