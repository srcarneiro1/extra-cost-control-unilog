import type {Employee, HubPayload} from '../types'
// Amostra inteiramente sintética: nomes, matrículas e distribuições inventados.
const roles=['OPERADOR DE DEPÓSITO','OPERADOR DE EMPILHADEIRA','AUXILIAR DE ESTOQUE','ASSISTENTE DE LOGÍSTICA','ANALISTA DE LOGÍSTICA']
const clients=['CELLERA','CAFFEINE B2B','SALLVE','SERVIER','BAOBÁ B2B','HERSHEY','LOLA','MULTI CLIENTES']
const supervisors=['SUPERVISÃO ALFA','SUPERVISÃO BETA','SUPERVISÃO GAMA','SUPERVISÃO DELTA','SUPERVISÃO ÉPSILON']
const statuses=['Trabalhando','Trabalhando','Trabalhando','Trabalhando','Trabalhando','Trabalhando','Férias','Afastado']
export const demoEmployees:Employee[]=Array.from({length:96},(_,i)=>{
 const n=i+1
 return {id:String(900001+i),name:`COLABORADOR FICTÍCIO ${String(n).padStart(3,'0')}`,role:roles[i%roles.length],area:i%7===0?'ADMINISTRATIVO':'OPERAÇÃO',admission:`${String(i%27+1).padStart(2,'0')}/${String(i%12+1).padStart(2,'0')}/202${i%6}`,costCenter:String([209,309,409,709,909][Math.floor(i/5)%5]),status:statuses[i%statuses.length],client:clients[i%clients.length],shift:['MATUTINO','VESPERTINO','NOTURNO','4X3'][i%4],supervisorId:String(8001+i%5),supervisor:supervisors[i%5],leadId:i%11===0?'':`E${String(i%9+1).padStart(3,'0')}`,lead:i%11===0?supervisors[i%5]:`ENCARREGADO FICTÍCIO ${i%9+1}`,module:['M04','M05','M06','M07','M08','M09'][i%6],process:['PRODUÇÃO','RECEBIMENTO','EXPEDIÇÃO','ESTOQUE E MOVIMENTAÇÃO'][i%4]}
})
export const demoHub:HubPayload={updatedAt:'2026-11-16T12:00:00-03:00',source:'demo',employees:demoEmployees,profile:{email:'visualizacao@exemplo.invalid',name:'Usuário Demonstração',role:'VISUALIZADOR',modules:['M04','M05']},quality:{duplicateIds:2,invalidRows:1,issues:[
  {row:57,id:'900012',name:'COLABORADOR FICTÍCIO 012',module:'M04',type:'DUPLICADO',reason:'Matrícula repetida (primeira ocorrência na linha 14)'},
  {row:83,id:'900045',name:'COLABORADOR FICTÍCIO 045',module:'M05',type:'DUPLICADO',reason:'Matrícula repetida (primeira ocorrência na linha 47)'},
  {row:101,id:'',name:'COLABORADOR FICTÍCIO SEM MATRÍCULA',module:'M04',type:'INVALIDO',reason:'Matrícula ausente'}]}}
