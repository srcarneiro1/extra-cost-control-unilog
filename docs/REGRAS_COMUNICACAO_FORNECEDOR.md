# Regras de Comunicação com Fornecedores

Este documento registra as regras vigentes para mensagens externas geradas pelo Extra Cost Control — UNILOG.

## Princípio

A comunicação enviada ou copiada para fornecedores deve conter apenas informações necessárias para o atendimento operacional. Dados de controle interno permanecem exclusivamente no sistema.

## Não enviar externamente

- protocolo / `ID_SOLICITACAO`;
- justificativa / observação interna.

Esses dados continuam preservados internamente no detalhe da solicitação, histórico e auditoria.

## Conteúdo permitido na mensagem externa

A mensagem pode conter, conforme o tipo da solicitação:

- data operacional;
- alimentação/bebida solicitada e suas quantidades;
- quantidade e função de mão de obra;
- atividade;
- turno;
- supervisor responsável.

## Implementação vigente

A composição da mensagem externa está centralizada em `buildWhatsAppMessage()` no arquivo:

`src/components/SolicitationDetailModal.tsx`

A mesma composição é utilizada por `Copiar resumo` e pela abertura do WhatsApp. Alterações futuras devem manter a separação entre dados internos e dados compartilhados externamente.

## Regra de segurança funcional

Remover um dado da mensagem externa não significa removê-lo da solicitação, da planilha ou da auditoria. Protocolo e justificativa continuam sendo dados internos obrigatórios para rastreabilidade quando aplicável.
