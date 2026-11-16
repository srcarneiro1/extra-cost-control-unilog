/**
 * HEADCOUNT G5 — API Google Apps Script independente.
 * Fonte: planilha COLABORADORES G5 (Cadastros + CAD_USUARIOS).
 * Dados de pessoas: somente leitura. Usuários: cadastro manual e troca de senha controlada.
 * Implantação Web App: executar como proprietário; acesso via token secreto Cloudflare.
 * Script Properties: SPREADSHEET_ID, GATEWAY_TOKEN, AUTH_PASSWORD_PEPPER (criada pelo setup).
 */
var HC_HEADERS = ['EMAIL','NOME','SENHA_HASH','SALT','PERFIL','MODULOS','ATIVO','EXIGE_TROCA_SENHA','ULTIMA_ALTERACAO'];
var HC_HASH_ROUNDS = 2048; // Algoritmo compatível com o fluxo do Extra Cost; avaliar migração para KDF adaptativo.

function doGet() { return hcJson_({ok:false,error:'Método indisponível.'}); }
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var props = PropertiesService.getScriptProperties();
    var gateway = props.getProperty('GATEWAY_TOKEN');
    if(!gateway || !body || typeof body.token !== 'string' || body.token !== gateway) return hcJson_({ok:false,error:'Acesso não autorizado.'});
    var action = String(body.action || '').trim().toUpperCase();
    if(action === 'LOGIN') return hcJson_({ok:true,data:hcLogin_(body)});
    if(action === 'HEADCOUNT_READ') return hcJson_(hcRead_(body));
    return hcJson_({ok:false,error:'Ação desconhecida.'});
  } catch(err) {
    console.error('Headcount gateway: ' + (err && err.name ? err.name : 'Error'));
    return hcJson_({ok:false,error:'Operação recusada ou indisponível.'});
  }
}
function hcJson_(data) {return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function hcWorkbook_() {
  var id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if(!id)throw new Error('SPREADSHEET_ID ausente');
  return SpreadsheetApp.openById(id);
}
function hcText_(v) {return String(v==null?'':v).trim();}
function hcEmail_(v) {return hcText_(v).toLowerCase();}
function hcUpper_(v) {return hcText_(v).toUpperCase();}
function hcActive_(v) {return ['SIM','TRUE','1','ATIVO','YES'].indexOf(hcUpper_(v)) >= 0;}
function hcModules_(v) {
  var parts=hcUpper_(v).split(/[;,|]/).map(function(s){return s.trim();}).filter(Boolean);
  return parts.filter(function(s,i){return (s==='*'||/^[A-Z0-9_-]{1,24}$/.test(s)) && parts.indexOf(s)===i;});
}
function hcAccess_(email) {
  var sheet=hcWorkbook_().getSheetByName('CAD_USUARIOS');
  if(!sheet||sheet.getLastRow()<2)throw new Error('Usuários não provisionados');
  var headers=sheet.getRange(1,1,1,HC_HEADERS.length).getDisplayValues()[0];
  if(HC_HEADERS.some(function(x,i){return x!==hcUpper_(headers[i]);}))throw new Error('Cabeçalhos CAD_USUARIOS inválidos');
  var rows=sheet.getRange(2,1,sheet.getLastRow()-1,HC_HEADERS.length).getDisplayValues();
  var found=null;
  for(var i=0;i<rows.length;i++) {
    if(hcEmail_(rows[i][0])===email){if(found)throw new Error('E-mail duplicado');found={row:i+2,record:rows[i]};}
  }
  if(!found||!hcActive_(found.record[6]))throw new Error('Credenciais ou acesso inválidos');
  var role=hcUpper_(found.record[4]);
  var modules=hcModules_(found.record[5]);
  if(['OWNER','ADMIN','VISUALIZADOR'].indexOf(role)<0||!modules.length)throw new Error('Perfil sem acesso');
  return {sheet:sheet,row:found.row,email:email,name:hcText_(found.record[1])||email,role:role,modules:modules,hash:hcText_(found.record[2]),salt:hcText_(found.record[3]),firstAccess:hcActive_(found.record[7])};
}
function hcSecureEquals_(a,b) {
  var difference=a.length^b.length, length=Math.max(a.length,b.length);
  for(var i=0;i<length;i++)difference|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return difference===0;
}
function hcHex_(bytes) {return bytes.map(function(x){return ('0'+(x<0?x+256:x).toString(16)).slice(-2);}).join('');}
function hcHash_(password,salt) {
  var pepper=PropertiesService.getScriptProperties().getProperty('AUTH_PASSWORD_PEPPER');
  if(!pepper||pepper.length<32)throw new Error('AUTH_PASSWORD_PEPPER não configurado');
  var value=salt+'|'+password+'|'+pepper;
  for(var i=0;i<HC_HASH_ROUNDS;i++)value=hcHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8))+'|'+pepper;
  return value.split('|')[0];
}
function hcLogin_(body) {
  var email=hcEmail_(body.email), password=String(body.password||'');
  if(!/^\S+@\S+\.\S+$/.test(email)||!password||password.length>256)throw new Error('Credenciais inválidas');
  var record=hcAccess_(email);
  if(!record.hash||!record.salt||!hcSecureEquals_(record.hash,hcHash_(password,record.salt)))throw new Error('Credenciais inválidas');
  if(record.firstAccess) {
    var next=String(body.newPassword||'');
    if(!next)return {email:email,nome:record.name,perfil:record.role,modules:record.modules,exigeTrocaSenha:true};
    if(next.length<10||next.length>256||next===password)throw new Error('A nova senha precisa ter 10 caracteres e ser diferente da anterior');
    var salt=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
    record.sheet.getRange(record.row,3,1,2).setNumberFormat('@').setValues([[hcHash_(next,salt),salt]]);
    record.sheet.getRange(record.row,8).setValue('NAO');
    record.sheet.getRange(record.row,9).setValue(new Date());
  }
  return {email:email,nome:record.name,perfil:record.role,modules:record.modules,exigeTrocaSenha:false};
}
function hcRead_(body) {
  var email=hcEmail_(body.email);
  if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('Usuário inválido');
  // Nova leitura do perfil a cada consulta: suspensões e mudanças de módulos têm efeito imediato.
  var profile=hcAccess_(email);
  var sheet=hcWorkbook_().getSheetByName('Cadastros');
  if(!sheet)throw new Error('Aba Cadastros ausente');
  var count=sheet.getLastRow();
  var rows=count>1?sheet.getRange(2,1,count-1,22).getDisplayValues():[];
  // Pendências da origem com linha, matrícula, nome e motivo (sem dados sensíveis), para corrigir na aba Cadastros.
  var users=[],seen=Object.create(null),duplicateIds=0,invalidRows=0,issues=[],ISSUE_LIMIT=500;
  for(var i=0;i<rows.length;i++) {
    var row=rows[i];if(!row.some(Boolean))continue;
    var module=hcUpper_(row[20]);
    if(!profile.modules.includes('*') && !profile.modules.includes(module))continue;
    var id=hcText_(row[6]),name=hcText_(row[0]);
    if(!id||!name){invalidRows++;if(issues.length<ISSUE_LIMIT)issues.push({row:i+2,id:id,name:name,module:module,type:'INVALIDO',reason:!id&&!name?'Matrícula e nome ausentes':!id?'Matrícula ausente':'Nome ausente'});continue;}
    if(Object.prototype.hasOwnProperty.call(seen,id)){duplicateIds++;if(issues.length<ISSUE_LIMIT)issues.push({row:i+2,id:id,name:name,module:module,type:'DUPLICADO',reason:'Matrícula repetida (primeira ocorrência na linha '+seen[id]+')'});continue;}
    seen[id]=i+2;
    users.push({id:id,name:name,role:hcText_(row[4]),area:hcText_(row[5]),admission:hcText_(row[7]),costCenter:hcText_(row[12]),status:hcText_(row[13]),client:hcText_(row[14]),shift:hcText_(row[15]),supervisorId:hcText_(row[16]),supervisor:hcText_(row[17]),leadId:hcText_(row[18]),lead:hcText_(row[19]),module:module,process:hcText_(row[21])});
  }
  var summary=hcWorkbook_().getSheetByName('Dados');
  var sourceDate=summary?hcText_(summary.getRange('L1').getDisplayValue()):'';
  return {ok:true,updatedAt:new Date().toISOString(),sourceDate:sourceDate,employees:users,profile:{email:email,name:profile.name,role:profile.role,modules:profile.modules},quality:{duplicateIds:duplicateIds,invalidRows:invalidRows,issues:issues}};
}
/** Executar MANUALMENTE, uma vez, no editor Apps Script. Não altera a aba Cadastros. */
function setupHeadcountAuthSheet() {
  var doc=hcWorkbook_(),sheet=doc.getSheetByName('CAD_USUARIOS');
  if(!sheet){sheet=doc.insertSheet('CAD_USUARIOS');sheet.getRange(1,1,1,HC_HEADERS.length).setValues([HC_HEADERS]);sheet.setFrozenRows(1);}
  else {
    var hdr=sheet.getRange(1,1,1,HC_HEADERS.length).getDisplayValues()[0];
    if(HC_HEADERS.some(function(s,i){return s!==hcUpper_(hdr[i]);}))throw new Error('CAD_USUARIOS existente possui cabeçalhos diferentes. Não houve alteração.');
  }
  var props=PropertiesService.getScriptProperties();
  if(!props.getProperty('AUTH_PASSWORD_PEPPER'))props.setProperty('AUTH_PASSWORD_PEPPER',Utilities.getUuid()+Utilities.getUuid());
  sheet.getRange('A:D').setNumberFormat('@');
  return 'CAD_USUARIOS pronta. Insira EMAIL, NOME, PERFIL, MODULOS e ATIVO; configure senha separadamente.';
}
/**
 * Crie previamente a linha do usuário em CAD_USUARIOS:
 * EMAIL, NOME, (vazio), (vazio), OWNER/ADMIN/VISUALIZADOR, M04;M05 ou *, SIM.
 * Em Script Properties defina AUTH_PENDING_EMAIL e AUTH_PENDING_PASSWORD; execute esta função.
 * As duas propriedades temporárias são removidas até em caso de erro.
 */
function applyPendingUserPassword() {
  var props=PropertiesService.getScriptProperties();
  var email=hcEmail_(props.getProperty('AUTH_PENDING_EMAIL'));
  var password=String(props.getProperty('AUTH_PENDING_PASSWORD')||'');
  try {
    if(!email)throw new Error('AUTH_PENDING_EMAIL ausente. Cadastre o e-mail do usuário em Configurações do projeto > Propriedades do script.');
    if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('AUTH_PENDING_EMAIL não contém um e-mail válido.');
    if(!password)throw new Error('AUTH_PENDING_PASSWORD ausente. Cadastre a senha provisória em Configurações do projeto > Propriedades do script.');
    if(password.length<10||password.length>256)throw new Error('AUTH_PENDING_PASSWORD precisa ter entre 10 e 256 caracteres.');
    var user=hcAccess_(email);
    var salt=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
    user.sheet.getRange(user.row,3,1,2).setNumberFormat('@').setValues([[hcHash_(password,salt),salt]]);
    user.sheet.getRange(user.row,8).setValue('SIM');
    user.sheet.getRange(user.row,9).setValue(new Date());
    return 'Senha protegida configurada para '+email+'; troca exigida no primeiro acesso.';
  } finally {
    props.deleteProperty('AUTH_PENDING_EMAIL');
    props.deleteProperty('AUTH_PENDING_PASSWORD');
  }
}
