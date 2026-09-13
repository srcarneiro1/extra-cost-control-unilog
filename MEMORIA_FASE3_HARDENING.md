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

## Guardrails

- Nunca executar `migrateSolicitationStatuses()` novamente.
- Não reabrir fechamento financeiro automaticamente.
- Não criar segunda NF silenciosa para o mesmo fornecedor/competência.
- Não sobrescrever `COMPETENCIA` operacional.
- GitHub e Apps Script manual devem permanecer sincronizados.
- Não criar funcionalidades novas durante hardening sem necessidade real de correção.
- Mutações não recebem retry automático.
- Merge somente com autorização explícita do usuário.
