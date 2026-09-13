# CLOUDFLARE API GATEWAY

## Objetivo

Intermediar chamadas protegidas entre o frontend Cloudflare Pages e o Google Apps Script sem expor segredos no navegador, usando a sessão própria do Extra Cost Control para autenticação e autorização funcional.

Arquitetura:

```text
Usuário
→ Login do Extra Cost Control
→ cookie de sessão JWT HttpOnly/Secure
→ Cloudflare Pages Function
→ cache de borda para leituras elegíveis
→ segredo de integração
→ Apps Script Web App
→ Google Sheets
```

Cloudflare Access não é requisito da aplicação. O domínio pode permanecer público para exibir a tela de login; as rotas de dados validam a sessão própria antes de executar qualquer leitura ou escrita protegida.

## Autenticação da aplicação

O login é realizado em `POST /api/auth/login`. A Pages Function envia as credenciais ao Apps Script pela rota protegida `auth`, usando `APPS_SCRIPT_GATEWAY_TOKEN`. Após autenticação válida, a Function cria um JWT de sessão assinado com `APP_SESSION_SECRET` e grava o cookie `extra_cost_session` com:

- `HttpOnly`;
- `Secure`;
- `SameSite=Lax`;
- validade de 8 horas.

As rotas protegidas usam `authorizeGatewayRequest()` e validam perfil/operação antes de chamar o Apps Script. Usuários operacionais precisam possuir uma operação específica. OWNER e ADMINISTRATIVO seguem as regras de acesso definidas em `_access-control.ts`.

O header `x-gateway-test-token` continua disponível somente como fallback controlado de testes enquanto `GATEWAY_TEST_TOKEN` estiver configurado. Ele não deve ser utilizado pelo frontend normal.

## Cache de borda

As leituras elegíveis usam a Cache API nativa das Pages Functions (`caches.default`), sem KV.

TTLs:

```text
GET /api/dashboard                 120 s
GET /api/solicitacoes - listagem   30 s
GET /api/solicitacoes?metadata=1  300 s
GET /api/cadastros                 300 s
```

A chave de cache inclui a URL original e o escopo resolvido da identidade:

```text
_profile=<perfil>
_scope=<operacao efetiva ou TODOS>
```

Esses parâmetros existem apenas na chave interna do edge cache e não são enviados ao Apps Script.

A resposta devolvida ao navegador continua com:

```text
cache-control: no-store
```

A cópia armazenada no edge recebe `cache-control: public, max-age=<TTL>`. Falha ou indisponibilidade da Cache API é tratada como otimização perdida: a requisição segue normalmente para o Apps Script.

Rotas de escrita não são cacheadas. Detalhes individuais de solicitação também não usam edge cache.

## Proteção do login

Sem Cloudflare Access na frente do domínio, `/api/auth/login` fica acessível publicamente. A Function aplica um cooldown curto após falha de autenticação, usando a própria Cache API e uma chave composta por IP Cloudflare + e-mail. Essa proteção é fail-open e complementar; políticas de WAF/rate limiting podem ser adicionadas na Cloudflare sem alterar o contrato da aplicação.

## Variáveis / segredos no Cloudflare Pages

Configurar por ambiente:

```text
APPS_SCRIPT_URL
APPS_SCRIPT_GATEWAY_TOKEN
APP_SESSION_SECRET
GATEWAY_TEST_TOKEN
```

Regras:

- `APPS_SCRIPT_URL`: URL estável `/exec` da implantação do Web App;
- `APPS_SCRIPT_GATEWAY_TOKEN`: segredo compartilhado Cloudflare → Apps Script;
- `APP_SESSION_SECRET`: segredo com pelo menos 32 caracteres usado para assinar a sessão do aplicativo;
- `GATEWAY_TEST_TOKEN`: fallback temporário para testes controlados;
- nenhum desses valores deve ser incluído no bundle React.

As antigas variáveis `CLOUDFLARE_ACCESS_TEAM_DOMAIN` e `CLOUDFLARE_ACCESS_AUD` deixam de ser utilizadas pelo código e podem ser removidas dos ambientes depois da homologação da arquitetura sem Access.

## Propriedade no Apps Script

Em **Configurações do projeto → Propriedades do script**:

```text
GATEWAY_TOKEN
```

O valor deve ser exatamente o mesmo de `APPS_SCRIPT_GATEWAY_TOKEN` no Cloudflare. O Apps Script continua protegido por autenticação serviço-a-serviço mesmo com o domínio Pages sem Cloudflare Access.

## Homologação antes de remover Cloudflare Access

Validar no Preview, nesta ordem:

1. abrir a aplicação e autenticar pelo login próprio;
2. `/api/auth/me` reconhecer a sessão;
3. OWNER/ADMINISTRATIVO acessarem dados administrativos normalmente;
4. OPERACIONAL enxergar somente a própria operação;
5. request sem sessão para rota protegida retornar `401`;
6. escrita continuar exigindo sessão/permissão e gateway token no backend;
7. repetir leituras de dashboard, solicitações e catálogos e confirmar redução de latência por cache de borda;
8. logout invalidar o cookie de sessão.

Somente depois dessa homologação a aplicação/política Cloudflare Access que protege o domínio deve ser desativada no painel da Cloudflare.
