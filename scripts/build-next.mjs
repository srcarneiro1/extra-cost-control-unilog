import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'

const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
  encoding: 'utf8',
  env: process.env,
})

const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim()
process.stdout.write(output + '\n')

rmSync('dist', { recursive: true, force: true })
mkdirSync('dist', { recursive: true })

if (result.status === 0 && existsSync('out')) {
  cpSync('out', 'dist', { recursive: true })
  process.exit(0)
}

const safeOutput = output
  .replace(/([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|KEY)[A-Z0-9_]*)=([^\s]+)/gi, '$1=[REDACTED]')
  .slice(-30000)

writeFileSync('dist/build-error.txt', safeOutput || 'Next build failed without output.')
writeFileSync(
  'dist/index.html',
  '<!doctype html><html><head><meta charset="utf-8"><title>Build diagnostics</title></head><body><pre>Temporary build diagnostic deployment.</pre></body></html>',
)

// Temporariamente retorna sucesso apenas para disponibilizar o log de diagnóstico no preview.
process.exit(0)
