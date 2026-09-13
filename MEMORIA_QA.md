# MEMÓRIA DE QA — EXTRA COST CONTROL UNILOG

Complemento técnico da `MEMORIA_PROJETO.md` para evitar regressões visuais e acúmulo de código morto.

## Regras permanentes

1. Em `DataTable` ou qualquer container com `overflow`, não simular tooltip reaproveitando `.p-button-label`, pseudo-elementos presos à célula ou overlays que dependam de espaço lateral.
2. Ações compactas em tabelas devem ser realmente `icon-only`, com `aria-label` e `title` nativos ou tooltip global fora do container de overflow.
3. Não esconder um label visualmente para depois reexibi-lo no `hover`; isso pode sofrer clipping, compressão ou quebra vertical na borda do viewport.
4. Botões icon-only da mesma coluna devem ter dimensões, alinhamento, foco e comportamento de hover consistentes. Diferenças de cor só podem existir quando tiverem significado semântico real.
5. Ações de workflow são contextuais ao status e não podem remover regras de negócio apenas para preencher layout.
6. Antes de criar CSS corretivo, confirmar qual entrypoint e quais folhas são realmente carregados pelo Next.js App Router atual.
7. Limpeza de código deve ser baseada em evidência de uso.
8. Após mudança estrutural, exigir build verde no head exato e Cloudflare Pages verde antes de homologação.
9. Nunca aplicar retry automático a mutações. Retry automático é permitido apenas para leituras idempotentes e autenticação upstream transitória; mutações ambíguas usam reconciliação por leitura.
10. Ações do modal de solicitações devem liberar o loading quando a própria mutação responder; releitura de detalhe/lista deve ocorrer em background.
11. A DataTable de Solicitações usa `table-layout: fixed`, larguras explícitas nas colunas e slots estáveis na célula de Ações para impedir layout shift.
12. O grid de Ações atualmente usa seletores CSS por `aria-label`; se um label for renomeado, atualizar também `src/app/prime-solicitations.css`.
13. Nunca executar novamente `migrateSolicitationStatuses()`; a migração histórica já foi concluída.
14. Edge cache deve manter autorização antes do lookup e `cache-control: no-store` para o navegador.

## Incidente de referência — 13/09/2026

Na fila de Solicitações, o CSS transformava `.p-button-label` oculto em tooltip no hover. Como a coluna ficava dentro da DataTable com overflow, o texto podia ser cortado e comprimido na borda direita.

Correção adotada:
- remover hack de `.p-button-label`;
- renderizar botões sem label visual;
- usar `aria-label` + `title`;
- manter dimensões fixas;
- fixar a geometria da tabela e da coluna de ações;
- preservar ações condicionais por slots de layout, sem tornar ações inválidas clicáveis.

Este arquivo deve ser considerado junto com `MEMORIA_PROJETO.md` em futuras rodadas de QA/refatoração.
