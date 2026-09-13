# Fase 3 — Hardening e consolidação final da V1

Atualizado em 14/09/2026.

## Estado de partida

- PR #67 mergeado no `main` em `a1f2fc694aebe80cdc0c71f0b0866dafbdd8d1c1`.
- Fase 2B homologada ponta a ponta.
- Fase 2C concluída e mergeada.
- Solicitação individual termina operacionalmente em `ATENDIDA`.
- Fechamento financeiro ocorre por `COMPETENCIA_FATURAMENTO + FORNECEDOR`.
- Exceções tardias possuem destino explícito: reclassificação para competência futura ou `ABSORVIDA_NAO_FATURADA`.

## Objetivo

Encerrar a V1 sem criar novos módulos. A Fase 3 existe apenas para reduzir risco técnico, consolidar regras já homologadas e remover resíduos obsoletos.

## Escopo

1. Permissões e escopo de acesso
   - OWNER;
   - ADMINISTRATIVO;
   - OPERACIONAL;
   - rotas administrativas e financeiras.

2. Estados e transições
   - procurar transições obsoletas;
   - estados impossíveis;
   - ações de frontend sem equivalente válido no backend;
   - rotas ou tipos residuais.

3. Regressão funcional
   - criação e triagem de solicitação;
   - envio ao fornecedor;
   - atendimento e realizado;
   - jornada parcial;
   - fechamento por fornecedor/competência;
   - NF, conciliação e encerramento;
   - exceções tardias.

4. Cache e mutações
   - nenhuma mutação com retry automático;
   - releitura fresca quando consistência imediata for necessária;
   - leitura normal pode manter cache de otimização.

5. Responsividade
   - desktop/web;
   - larguras intermediárias;
   - mobile;
   - tabelas administrativas em modo card quando aplicável;
   - ações e modais sem overflow funcional.

6. Limpeza técnica
   - JSX morto;
   - CSS legado;
   - seletores de ocultação de funcionalidades removidas;
   - rotas e serviços não usados;
   - documentação contraditória.

7. Encerramento
   - atualizar memórias finais;
   - GitHub Actions no head exato;
   - Cloudflare no mesmo head;
   - smoke test final;
   - merge somente com autorização explícita do usuário.

## Estado do hardening no PR #68

- exclusão administrativa de solicitação vinculada ao financeiro foi bloqueada;
- função executável de migração histórica de status foi removida;
- matriz OWNER / ADMINISTRATIVO / OPERACIONAL revisada sem brecha identificada;
- retries automáticos permanecem restritos a leituras e autenticação upstream transitória; mutações não possuem retry automático;
- responsividade de Solicitações e Fechamentos revisada;
- hacks antigos de `.p-button-label` e ocultações obsoletas por CSS não permanecem;
- documentação do gateway define que `GATEWAY_TEST_TOKEN` não deve existir em produção;
- usuário confirmou em 13/09/2026 que `GATEWAY_TEST_TOKEN` não está configurado no ambiente Cloudflare de produção, tornando o fallback legado inerte;
- GitHub Actions e Cloudflare Pages ficaram verdes no head `be9b1025956db27830b12103e598d8383cefed5f`.

## Smoke test final — bloqueio atual

No preview do PR #68, tentativa de login retornou:

`O serviço de autenticação retornou uma resposta inválida.`

O gateway mapeia esse caso para `AUTH_INVALID_RESPONSE`: a chamada ao Apps Script retorna HTTP, porém o corpo recebido não pode ser interpretado como JSON.

Diagnóstico de código:
- `apps-script/Api.gs` trata `route=auth` e devolve `JsonResponse.ok(...)` ou erro estruturado;
- `apps-script/JsonResponse.gs` serializa respostas como JSON;
- `functions/api/auth/login.ts` já possui uma segunda tentativa para falha de rede, mas não repete quando a primeira resposta HTTP é não JSON;
- `functions/api/dashboard.ts` já possui o padrão homologado de repetir uma única vez após resposta upstream inválida;
- correção proposta: alinhar somente o login a esse padrão de autenticação/leitura transitória, sem aplicar retry a mutações.

A correção ainda não foi gravada no GitHub porque o conector bloqueou a operação antes de qualquer alteração. O PR deve permanecer Draft até corrigir e homologar o login.

## Guardrails

- Nunca executar `migrateSolicitationStatuses()` novamente.
- Não reabrir fechamento financeiro automaticamente.
- Não criar segunda NF silenciosa para o mesmo fornecedor/competência.
- Não sobrescrever `COMPETENCIA` operacional.
- GitHub e Apps Script manual devem permanecer sincronizados.
- Não criar funcionalidades novas durante hardening sem necessidade real de correção.
- Mutações não recebem retry automático.
- Merge somente com autorização explícita do usuário.
