// Gera o tema PrimeReact da Unilog a partir do Lara Light Indigo oficial.
//
// Por que existe: o Lara usa ~320 cores indigo/roxas fixas (hex), não só variáveis CSS.
// Sobrescrever componente por componente deixava estados escapando (hover, foco,
// selecionado, calendário, paginação, checkbox). Aqui a troca é feita na origem,
// a cada build, mantendo o tema sincronizado com a versão instalada do PrimeReact.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const source = require.resolve('primereact/resources/themes/lara-light-indigo/theme.css')
const target = path.join(process.cwd(), 'src/app/generated/primereact-unilog-theme.css')

// Escala indigo (Tailwind) do Lara → escala vermelho Unilog (#db0812).
const PALETTE = {
  // Cores de severidade do Lara → identidade Unilog (Manual 2026, Rev. 2) — 06/11/2026.
  // info (azul) → cinza; danger → vermelho oficial; help (roxo) → cinza;
  // success/warning mantêm o significado, em tons suaves que conversam com a paleta.
  '#0ea5e9': '#6d6e78', '#0284c7': '#494a56', '#3b82f6': '#6d6e78', '#2563eb': '#494a56',
  '#ef4444': '#db0812', '#dc2626': '#b00610',
  '#a855f7': '#6d6e78', '#9333ea': '#494a56',
  '#22c55e': '#3f7c59', '#16a34a': '#2f6d49', '#15803d': '#23603c',
  '#f97316': '#a87900', '#ea580c': '#8c6800', '#eab308': '#a87900',
  '#14b8a6': '#5f8f8b',
  '#eef2ff': '#fbe6e7', // 50  fundo de item selecionado (vermelho 10 do manual)
  '#e0e7ff': '#fbd9dc', // 100
  '#c7d2fe': '#f5b5b9', // 200 anel de foco
  '#a5b4fc': '#ee8a90', // 300
  '#818cf8': '#e55a62', // 400
  '#6366f1': '#db0812', // 500 primária
  '#4f46e5': '#b00610', // 600 hover (manual Rev. 2)
  '#4338ca': '#9e060d', // 700 texto destacado
  '#3730a3': '#83050b', // 800
  '#312e81': '#6a0409', // 900
  // Escala "primary/indigo" própria do Lara 10 (variáveis --primary-* e --indigo-*)
  '#f7f7fe': '#fff5f6', // 50
  '#dadafc': '#fbd9dc', // 100
  '#bcbdf9': '#f5b5b9', // 200
  '#9ea0f6': '#ee8a90', // 300
  '#8183f4': '#e55a62', // 400
  '#5457cd': '#b8070f', // 600
  '#4547a9': '#9e060d', // 700
  '#363885': '#83050b', // 800
  '#282960': '#6a0409', // 900
  '#b1b3f8': '#f5b5b9', // anel de foco dos botões
}

let css = await readFile(source, 'utf8')

// Retrabalho: tipografia canônica é Roboto, então remove a Inter embutida no Lara.
// Extra Cost Control usa Inter: rode com --keep-fonts para preservar as @font-face;
// os arquivos de fonte são copiados para junto do CSS gerado (url("./fonts/...")).
const keepFonts = process.argv.includes('--keep-fonts')
if (!keepFonts) {
  css = css.replace(/@font-face\s*{[^}]*}/g, '')
}

for (const [from, to] of Object.entries(PALETTE)) {
  css = css.replace(new RegExp(from, 'gi'), to)
}
css = css.replace(/rgba\(\s*99,\s*102,\s*241,/g, 'rgba(219, 8, 18,')

const leftover = css.match(/#(eef2ff|e0e7ff|c7d2fe|a5b4fc|818cf8|6366f1|4f46e5|4338ca|3730a3|312e81|f7f7fe|dadafc|bcbdf9|9ea0f6|8183f4|5457cd|4547a9|363885|282960|b1b3f8)\b|rgba\(\s*99,\s*102,\s*241/gi)
if (leftover) {
  throw new Error(`Tema Unilog: restaram ${leftover.length} cores indigo no tema gerado.`)
}

await mkdir(path.dirname(target), { recursive: true })
if (keepFonts) {
  const { cp } = await import('node:fs/promises')
  await cp(path.join(path.dirname(source), 'fonts'), path.join(path.dirname(target), 'fonts'), { recursive: true })
}
await writeFile(
  target,
  '/* ARQUIVO GERADO por scripts/build-unilog-theme.mjs — não editar manualmente. */\n' + css,
)
console.log('Tema PrimeReact Unilog gerado:', path.relative(process.cwd(), target))
