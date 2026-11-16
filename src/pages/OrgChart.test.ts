import {describe, expect, it} from 'vitest'
import {encarregados, equipe} from './OrgChart'
import type {Employee} from '../types'

const base: Employee = {id: '', name: '', role: '', area: '', admission: '', costCenter: '', status: '', client: '', shift: '', supervisorId: 'S1', supervisor: 'ANA SUPERVISORA', lead: '', module: '', process: ''}
const p = (id: string, name: string, lead: string, extra: Partial<Employee> = {}): Employee => ({...base, id, name, lead, ...extra})

describe('organograma', () => {
  const rows = [
    p('S1', 'ANA SUPERVISORA', 'ANA SUPERVISORA'),          // o próprio supervisor
    p('1', 'JOÃO', 'CARLOS ENCARREGADO'),
    p('2', 'MARIA', 'CARLOS ENCARREGADO'),
    p('3', 'PEDRO', 'Ana Supervisora'),                   // responde direto (nome do supervisor no encarregado)
    p('4', 'LUCAS', ''),                                  // sem encarregado
  ]
  it('a equipe não inclui o próprio supervisor', () => {
    expect(equipe(rows, {id: 'S1', name: 'ANA SUPERVISORA'}).map(x => x.id)).toEqual(['1', '2', '3', '4'])
  })
  it('o supervisor não aparece como linha dentro dele mesmo', () => {
    const linhas = encarregados(equipe(rows, {id: 'S1', name: 'ANA SUPERVISORA'}), 'ANA SUPERVISORA')
    expect(linhas.map(l => l.name)).not.toContain('ANA SUPERVISORA')
    expect(linhas).toEqual([{name: 'CARLOS ENCARREGADO', value: 2}, {name: 'Equipe direta (sem encarregado)', value: 2}])
  })
})
