# Extra Cost Control — UNILOG

MVP para controle de custos extras operacionais da UNILOG.

## Arquitetura vigente

```text
Cloudflare Pages
  → React + TypeScript + Vite
  → API Google Apps Script
  → Google Planilhas
```

A fonte de verdade funcional, arquitetural e visual é `MEMORIA_PROJETO.md`.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Validação de produção:

```bash
npm run build
```

## Cloudflare Pages

Configuração do projeto conectado ao GitHub:

```text
Production branch: main
Build command: npm run build
Build output directory: dist
Root directory: vazio / raiz do repositório
```

## Referência visual

O frontend reutiliza como referência técnica os padrões maduros do projeto `bi-logistico-v2`, especialmente tokens visuais, shell, responsividade e acessibilidade. Lógica funcional, integrações e persistência não são copiadas entre os projetos.

## Segurança

Não incluir segredos no código React ou no repositório. Segredos futuros devem ficar em Cloudflare Secrets/Environment Variables ou Apps Script `PropertiesService`, conforme a memória do projeto.
