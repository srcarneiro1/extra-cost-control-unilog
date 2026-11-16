import {describe,expect,it} from 'vitest'
import {demoEmployees} from '../data/demo'
import {distribution,filterEmployees,parseBRDate,searchEmployees,stats,supervisors,tenureDistribution} from './metrics'
import {emptyFilters} from '../types'
describe('indicadores headcount G5',()=>{
 it('preserva o total e o recorte',()=>{const s=stats(demoEmployees);expect(s.total).toBe(96);expect(s.working+s.other).toBe(s.total)})
 it('busca local por matrícula ou nome sem acentos',()=>{expect(searchEmployees(demoEmployees,'ficticio 001')).toHaveLength(1)})
 it('filtra por cliente e turno (listas)',()=>{const rows=filterEmployees(demoEmployees,{...emptyFilters,client:['CELLERA'],shift:['MATUTINO']});expect(rows.length).toBeGreaterThan(0);expect(rows.every(r=>r.client==='CELLERA'&&r.shift==='MATUTINO')).toBe(true)})
 it('aceita vários valores no mesmo filtro',()=>{const rows=filterEmployees(demoEmployees,{...emptyFilters,client:['CELLERA','LOLA']});expect(new Set(rows.map(r=>r.client))).toEqual(new Set(['CELLERA','LOLA']))})
 it('desconsidera centros de custo: marcar todos menos um tira esse da contagem',()=>{const todos=[...new Set(demoEmployees.map(r=>r.costCenter))];const fora=todos[0];const rows=filterEmployees(demoEmployees,{...emptyFilters,costCenter:todos.filter(c=>c!==fora)});expect(rows.some(r=>r.costCenter===fora)).toBe(false);expect(rows.length).toBe(demoEmployees.filter(r=>r.costCenter!==fora).length)})
 it('filtro vazio não restringe',()=>{expect(filterEmployees(demoEmployees,emptyFilters)).toHaveLength(demoEmployees.length)})
 it('separa centros de custo sem presumir 1 por supervisor',()=>{const s=supervisors(demoEmployees);expect(s.reduce((n,x)=>n+x.total,0)).toBe(96);expect(s.some(x=>x.costCenters.size>1)).toBe(true)})
 it('todas distribuições conciliam',()=>{expect(distribution(demoEmployees,'client').reduce((s,r)=>s+r.value,0)).toBe(96);expect(tenureDistribution(demoEmployees).reduce((s,r)=>s+r.value,0)).toBe(96)})
 it('rejeita datas impossíveis',()=>{expect(parseBRDate('31/02/2026')).toBe(null);expect(parseBRDate('16/11/2026')).not.toBe(null)})
})
