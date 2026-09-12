# DESIGN SYSTEM — NEXT.JS + PRIMEREACT | EXTRA COST CONTROL UNILOG

**Status:** padrão visual vigente  
**Data de consolidação:** 12/09/2026  
**Escopo:** frontend ativo do Extra Cost Control  

## 1. Objetivo

Este documento é a fonte de verdade visual da interface. O objetivo é impedir que telas novas ou refatorações reintroduzam componentes, cores, grids e comportamentos do frontend legado.

A interface deve parecer um único produto. Não deve haver diferenças perceptíveis de linguagem entre Login, Dashboard, Solicitações, Cadastros, Usuários e dialogs de workflow.

## 2. Stack visual vigente

- Next.js 15 com App Router;
- React 19;
- PrimeReact 10;
- PrimeIcons;
- PrimeReact `Chart` com Chart.js para bar, line e scatter;
- CSS de integração carregado por último em `src/app/prime-design-system.css`;
- Cloudflare Pages com export estático;
- Pages Functions preservadas em `/api/*`.

O tema Lara pode continuar como base técnica do PrimeReact, mas nenhuma cor índigo/azul padrão do tema deve ficar visível no produto. Os tokens Unilog sobrescrevem foco, highlight, seleção e estados de componentes.

## 3. Paleta canônica

### Marca e neutros

```css
--unilog-red: #db0812;
--unilog-red-dark: #b8070f;
--unilog-red-soft: #fdecee;
--unilog-ink: #171b24;
--unilog-ink-2: #242a36;
--unilog-graphite: #494a56;
--unilog-graphite-2: #676d77;
--unilog-muted: #8a9099;
--unilog-border: #e2e5e9;
--unilog-border-soft: #edf0f2;
--unilog-canvas: #f5f6f8;
--unilog-surface: #ffffff;
--unilog-surface-soft: #f8f9fb;
```

### Estados semânticos

```css
--unilog-success: #3f7c59;
--unilog-warning: #a87900;
--unilog-danger: #c91a23;
```

Regras:

- vermelho Unilog = marca, CTA, foco e destaque principal;
- grafite = informação, realizado, texto forte e séries neutras;
- cinza claro = previsto, referência e estrutura;
- verde = somente sucesso/estado favorável;
- amarelo = somente atenção/limite;
- vermelho de perigo = somente erro, desvio negativo ou ação destrutiva;
- não usar azul, roxo, teal ou outras cores decorativas fora dessa semântica.

## 4. Componentes obrigatórios

Sempre preferir PrimeReact quando houver componente equivalente.

| Necessidade | Componente padrão |
| --- | --- |
| card/painel | `Card` |
| tabela | `DataTable` + `Column` |
| modal | `Dialog` via `Modal` compartilhado |
| seleção | `Dropdown` |
| botão | `Button` |
| texto | `InputText` |
| senha | `Password` |
| textarea | `InputTextarea` |
| toggle | `InputSwitch` |
| checkbox | `Checkbox` |
| status | `Tag` |
| paginação | `Paginator` |
| tabs simples | `SelectButton` / `TabMenu` conforme contexto |
| barras, linhas, dispersão | `Chart` do PrimeReact |
| loading | `Skeleton` |
| aviso | `Message` ou notice compartilhado |

HTML customizado só deve permanecer quando não houver equivalente adequado ou quando o conteúdo não for um widget genérico, como matriz heatmap, detalhe textual, comparativo financeiro ou record card mobile.

## 5. Cards e painéis

Padrão:

- raio: 14px;
- borda: `#e2e5e9`;
- fundo branco;
- sombra baixa `0 6px 22px rgba(18,24,34,.045)`;
- cabeçalho separado por borda suave;
- títulos em grafite escuro;
- eyebrow em cinza muted;
- não usar fundos coloridos fortes em cards comuns.

Cards de KPI podem usar uma borda lateral semântica. A cor nunca deve preencher o card inteiro.

## 6. Gráficos

### Componentes

Usar PrimeReact `Chart`/Chart.js para:

- bar;
- horizontal bar;
- line;
- scatter;
- combinações bar + line.

Heatmap pode continuar customizado porque é uma matriz, desde que use os tokens da paleta.

### Séries

- realizado: grafite `#494a56`;
- previsto: cinza claro `#d7dbe0`;
- projeção/acento: vermelho `#db0812`;
- meta/referência: cinza médio `#9aa0a8`;
- destaque de pico: vermelho Unilog somente quando agrega leitura.

### Eixos e labels

- nunca forçar todos os labels completos se houver risco de colisão;
- nomes longos devem ser abreviados no eixo e exibidos integralmente no tooltip;
- permitir rotação moderada de 20–35 graus quando necessário;
- `autoSkip` pode ser usado em séries temporais;
- eixo Y monetário deve usar formatação compacta quando o espaço for reduzido;
- não permitir `min-width` do gráfico maior que o card no mobile;
- chart stage controla altura; o canvas deve ocupar 100% da largura disponível;
- tooltips devem preservar o valor e nome completos.

## 7. Tabelas e listas

Desktop/tablet:

- `DataTable` com header neutro;
- hover suave;
- status via `Tag`;
- ações via `Button`;
- paginação PrimeReact.

Mobile:

- não reduzir uma tabela desktop até ficar ilegível;
- linhas devem virar record cards verticais;
- cada valor recebe label contextual;
- protocolo/nome principal vira cabeçalho do card;
- ações ficam em área própria no final;
- uma coluna em celulares estreitos;
- scroll horizontal fica restrito a estruturas genuinamente matriciais, como heatmap.

## 8. Filtros e formulários

Desktop:

- grids fluidos com `auto-fit/minmax`;
- evitar dropdowns gigantes em notebooks;
- grupos de filtro devem ter labels individuais;
- busca não pode compartilhar a mesma célula estrutural de um grid interno inteiro.

Mobile:

- filtros em uma coluna;
- controles com largura 100%;
- botões principais ocupam largura útil quando isso melhora toque;
- dialogs têm scroll interno, header/footer estáveis e ações empilhadas quando necessário.

## 9. Navegação

Desktop:

- sidebar grafite;
- ativo = fundo grafite mais claro + faixa vermelha;
- perfil e logout pertencem ao bloco do usuário;
- topbar não deve repetir perfil ou escopo técnico;
- topbar mostra apenas conectividade quando útil.

Mobile:

- drawer compacto;
- itens agrupados no topo, sem distribuição vertical artificial;
- bloco do usuário permanece no rodapé;
- usar `100dvh` e `safe-area-inset-bottom`;
- drawer deve ocupar no máximo aproximadamente 78vw / 292px.

## 10. Estado do audit em 12/09/2026

### Login

- migrado;
- PrimeReact inputs/password/button;
- identidade aprovada como referência visual.

### Shell

- migrado;
- sidebar/topbar Next.js + PrimeReact;
- perfil e logout agrupados no rodapé;
- topbar simplificado para conectividade.

### Dashboard — Visão Executiva

- filtros, tabs, cards, mensagens e skeleton em PrimeReact;
- ranking operação/fornecedor migrado para PrimeReact Chart;
- projeção/meta migrada para PrimeReact Chart;
- comparativo competência × anterior permanece customizado porque é um componente composto, mas usa o design system;
- movimento diário permanece customizado como grade informacional, também sob design system.

### Dashboard — Analytics

- gráficos Dia da Semana, Pareto, Supervisor e Linearidade usam PrimeReact Chart;
- Pareto abrevia labels longos e preserva nome completo em tooltip;
- heatmap permanece customizado por ser matriz;
- oportunidades usam PrimeReact Card + Tag semântica;
- rankings Responsável pelo custo e Atividades usam o mesmo componente PrimeReact Chart da visão executiva.

### Solicitações

- DataTable, Dropdown, Paginator, Tag, Button e Dialog PrimeReact;
- workflow interno usa inputs/dropdowns/textareas PrimeReact;
- mobile usa record cards verticais.

### Cadastros

- TabMenu/Dropdown, DataTable, Paginator, InputText, InputSwitch, Checkbox e Dialog PrimeReact;
- mobile usa seletor/record cards conforme contexto.

### Usuários

- DataTable, Dropdown, Password, InputSwitch, Tag e Dialog PrimeReact;
- mobile usa record cards verticais.

## 11. CSS legado

Arquivos históricos em `src/styles/` ainda podem fornecer estrutura para componentes em transição. Eles não são a fonte visual final.

Regra:

1. `prime-design-system.css` é carregado por último;
2. novas telas não devem adicionar mais regras de cor em CSS legado;
3. ao substituir o último consumidor de uma classe legada, remover o CSS correspondente em PR separado e testável;
4. não apagar em massa arquivos históricos dentro do mesmo PR visual se houver risco de regressão funcional.

## 12. Critérios para considerar uma tela padronizada

Uma tela só está concluída quando:

- usa a paleta canônica;
- não expõe azul/índigo do tema PrimeReact;
- usa componentes PrimeReact quando aplicáveis;
- cards seguem borda/raio/sombra únicos;
- filtros não se comprimem ou esticam indevidamente;
- tabelas viram cards no mobile;
- gráficos não cortam nem sobrepõem eixos/labels;
- textos longos preservam conteúdo via tooltip/ellipsis apropriado;
- não há overflow horizontal da página;
- funciona em desktop, notebook, tablet e smartphone;
- mantém as regras de negócio existentes sem duplicá-las no frontend.
