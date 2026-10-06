// Medição de desempenho das rotas /api (06/10/2026).
//
// Objetivo: dar a "medição objetiva de gargalo" exigida pela memória do projeto antes de
// qualquer otimização. Não altera respostas, não faz retry e não registra dados pessoais:
// só rota, método, status HTTP e duração.
//
// Onde ver:
// - Navegador: DevTools → Network → requisição /api/... → aba "Timing" → "Server Timing".
// - Cloudflare: Workers & Pages → projeto → Functions/Logs → "Real-time logs" (linhas "api-timing").
//
// Como o Apps Script responde dentro da mesma requisição, a duração medida aqui é
// praticamente toda o tempo de ida e volta até o Google + execução do Apps Script.

export const onRequest: PagesFunction = async (context) => {
  const startedAt = Date.now()
  const response = await context.next()
  const durationMs = Date.now() - startedAt

  const url = new URL(context.request.url)
  try {
    console.log(JSON.stringify({
      evento: 'api-timing',
      rota: url.pathname,
      acao: url.searchParams.get('acao') || undefined,
      metodo: context.request.method,
      status: response.status,
      ms: durationMs,
    }))
  } catch {
    // Log é apenas diagnóstico; nunca interfere na resposta.
  }

  // Copia a resposta para poder acrescentar o cabeçalho (cabeçalhos originais são imutáveis).
  const timed = new Response(response.body, response)
  timed.headers.append('Server-Timing', `api;desc="${url.pathname}";dur=${durationMs}`)
  return timed
}
