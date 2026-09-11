import {
  canAdministerSolicitations,
  canManageCatalogs,
  hasValidOperationScope,
  identityOperation,
  identityProfile,
  isOwner,
  operationScope,
  type GatewayIdentity,
} from './_auth';

export type AccessArea = 'DASHBOARD' | 'SOLICITACOES' | 'CADASTROS' | 'USUARIOS';

export function forbidden(message = 'Você não possui permissão para esta ação.'): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message,
      },
    }),
    {
      status: 403,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
}

export function validateAreaAccess(identity: GatewayIdentity, area: AccessArea): Response | null {
  if (!hasValidOperationScope(identity)) {
    return forbidden('Usuário operacional precisa estar vinculado a uma operação específica.');
  }

  if (area === 'USUARIOS' && !isOwner(identity)) {
    return forbidden('Somente o perfil OWNER pode administrar usuários.');
  }

  if (area === 'CADASTROS' && !canManageCatalogs(identity)) {
    return forbidden('Perfil operacional não possui acesso aos cadastros administrativos.');
  }

  return null;
}

export function validateAdministrativeAction(identity: GatewayIdentity): Response | null {
  if (!canAdministerSolicitations(identity)) {
    return forbidden('Esta ação é restrita aos perfis OWNER e ADMINISTRATIVO.');
  }
  return null;
}

export function enforceOperationScope(
  identity: GatewayIdentity,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const scope = operationScope(identity);
  if (!scope) return payload;
  return {
    ...payload,
    operacaoEscopo: scope,
  };
}

export function enforceDashboardScope(
  identity: GatewayIdentity,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const scope = operationScope(identity);
  if (!scope) return payload;
  return {
    ...payload,
    operacao: scope,
  };
}

export function enforceCreationScope(
  identity: GatewayIdentity,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const profile = identityProfile(identity);
  if (profile !== 'OPERACIONAL') return payload;

  const operation = identityOperation(identity);
  return {
    ...payload,
    operacao: operation,
  };
}
