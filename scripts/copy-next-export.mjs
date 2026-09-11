import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'

const source = 'out'
const destination = 'dist'

if (!existsSync(source)) {
  throw new Error('Diretório out não encontrado após next build.')
}

rmSync(destination, { recursive: true, force: true })
mkdirSync(destination, { recursive: true })
cpSync(source, destination, { recursive: true })

console.log('Next static export copiado de out/ para dist/.')
