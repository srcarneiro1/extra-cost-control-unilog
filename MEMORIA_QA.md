# MEMÓRIA DE QA — EXTRA COST CONTROL UNILOG

Complemento técnico da `MEMORIA_PROJETO.md` para evitar regressões visuais e acúmulo de código morto.

## Regras permanentes

1. Em `DataTable` ou qualquer container com `overflow`, não simular tooltip reaproveitando `.p-button-label`, pseudo-elementos presos à célula ou overlays que dependam de espaço lateral.
2. Ações compactas em tabelas devem ser realmente `icon-only`, com `aria-label` e `title` nativos ou tooltip global fora do container de overflow.
3. Não esconder um label visualmente para depois reexibi-lo no `hover`; isso pode sofrer clipping, compressão ou quebra vertical na borda do viewport.
4. Botões icon-only da mesma coluna devem ter dimensões, alinhamento, foco e comportamento de hover consistentes. Diferenças de cor só podem existir quando tiverem significado semântico real.
5. As ações de workflow em Solicitações são contextuais ao status. Não mostrar transições inválidas apenas para preencher a interface. Em `ATENDIDA`, permanecem somente ações administrativas aplicáveis, como abrir, editar ou excluir.
6. Antes de criar CSS corretivo, confirmar qual entrypoint e quais folhas são realmente carregados pelo Next.js App Router atual.
7. O frontend ativo é Next.js App Router. Arquivos React/Vite antigos não devem permanecer por inércia: confirmar ausência de import/referência e remover quando comprovadamente órfãos.
8. Limpeza de código deve ser baseada em evidência de uso: imports, entrypoints, build e referências. Não apagar arquivos apenas por nome ou aparência de legado.
9. Após qualquer limpeza estrutural, exigir build verde no head exato e Cloudflare Pages verde antes de homologação.
10. Nunca aplicar retry automático a mutações. Retry automático é permitido apenas para leituras idempotentes; mutações ambíguas devem usar reconciliação por leitura.

## Incidente de referência — 13/09/2026

Na fila de Solicitações, o CSS transformava `.p-button-label` oculto em um tooltip no `hover`. Como a coluna ficava dentro da `DataTable` com `overflow-x:auto`, o texto podia ser cortado e comprimido na borda direita, chegando a aparecer verticalmente, como ocorreu com `Excluir`.

Correção adotada:
- remover o hack de `.p-button-label`;
- renderizar botões sem `label` visual;
- usar `aria-label` + `title`;
- manter dimensões fixas e consistentes para os ícones;
- reduzir a largura da coluna de ações;
- remover arquivos Vite/React antigos somente após comprovar que o build atual usa exclusivamente Next.js.

Este arquivo deve ser considerado junto com `MEMORIA_PROJETO.md` em futuras rodadas de QA/refatoração.
