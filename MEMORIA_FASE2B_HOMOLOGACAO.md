# Homologação — Fase 2B

Data: 13/09/2026

Fluxo final homologado:
`ATENDIDA -> fechamento consolidado -> AGUARDANDO_NF -> NF registrada -> CONFERIDA -> ENCERRADA`

Regra consolidada:
- fechamento por `COMPETENCIA + FORNECEDOR`;
- uma única NF por fornecedor/competência;
- `RESPONSAVEL_CUSTO` não separa NF;
- acompanhamento diário antes do fechamento;
- `AGUARDANDO_NF`, `CONFERIDA` e `ENCERRADA` pertencem ao fechamento financeiro consolidado, não à solicitação individual;
- resultado da conciliação separado do workflow: `OK | COM_AJUSTE | COM_DIVERGENCIA`;
- `ENCERRADA` = fim da etapa financeira, sem ação pendente.

Homologação real:
- fornecedor: MULT;
- competência: 08/2026;
- fechamento: `FEC-202608-32DA046D`;
- 220 solicitações congeladas;
- valor do controle: R$ 437.670,00;
- NF: 88878;
- valor NF: R$ 437.670,00;
- diferença: R$ 0,00;
- conciliação: `OK` / exibida como Conferida;
- fechamento avançou para `CONFERIDA`;
- ação Encerrar validada;
- fechamento avançou para `ENCERRADA`;
- NF e resultado permaneceram vinculados.

UI homologada:
- painel diário de Fechamentos;
- modal de fechamento;
- registro/edição de NF;
- modal de conciliação;
- opções Conferida / Conferida com ajuste / Conferida com divergência;
- modal de encerramento;
- cards e tabelas padronizados;
- responsividade revisada.

Guardrails:
- transição individual `ATENDIDA -> AGUARDANDO_NF` permanece bloqueada no backend e indisponível na interface;
- nunca executar `migrateSolicitationStatuses()` novamente;
- nunca fazer retry automático em mutações financeiras;
- Apps Script e GitHub devem permanecer sincronizados;
- validar GitHub Actions e Cloudflare no mesmo head final antes de merge;
- nunca fazer merge sem autorização explícita do usuário.