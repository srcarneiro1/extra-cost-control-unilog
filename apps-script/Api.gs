const Api = (() => {
  const PROPERTY_GATEWAY_TOKEN = 'GATEWAY_TOKEN';

  function handleGet(e) {
    try {
      const route = normalizeRoute_(e && e.parameter && e.parameter.route);

      if (route === 'health') {
        return JsonResponse.ok({
          service: 'extra-cost-control-unilog',
          version: 'mvp1',
        });
      }

      if (route === 'cadastros') {
        return JsonResponse.unauthorized('Acesso aos cadastros disponível somente pelo gateway protegido.');
      }

      if (route === 'solicitacoes_admin') {
        return JsonResponse.unauthorized('Consulta administrativa disponível somente pelo gateway protegido.');
      }

      return JsonResponse.notFound('Rota não encontrada.');
    } catch (error) {
      return handleError_(error);
    }
  }

  function handlePost(e) {
    try {
      const route = normalizeRoute_(e && e.parameter && e.parameter.route);
      const payload = parseJsonBody_(e);

      if (route === 'cadastros') {
        authorizeGateway_(payload);
        return JsonResponse.ok(CatalogService.getActiveCatalogs());
      }

      if (route === 'solicitacoes') {
        const servicePayload = authorizeGateway_(payload);
        return JsonResponse.ok(SolicitationService.create(servicePayload));
      }

      if (route === 'solicitacoes_admin') {
        const servicePayload = authorizeGateway_(payload);
        return JsonResponse.ok(AdministrativeSolicitationQueryService.execute(servicePayload));
      }

      if (route === 'triagem') {
        const servicePayload = authorizeGateway_(payload);
        return JsonResponse.ok(TriageService.apply(servicePayload));
      }

      if (route === 'comparecimento') {
        const servicePayload = authorizeGateway_(payload);
        return JsonResponse.ok(AttendanceService.register(servicePayload));
      }

      return JsonResponse.notFound('Rota não encontrada.');
    } catch (error) {
      return handleError_(error);
    }
  }

  function authorizeGateway_(payload) {
    const expectedToken = PropertiesService
      .getScriptProperties()
      .getProperty(PROPERTY_GATEWAY_TOKEN);

    if (!expectedToken) {
      throw new Error('Propriedade GATEWAY_TOKEN não configurada no Apps Script.');
    }

    const providedToken = String(
      payload && payload._gatewayToken ? payload._gatewayToken : ''
    ).trim();

    if (!providedToken || providedToken !== expectedToken) {
      const error = new Error('Acesso não autorizado.');
      error.name = 'AuthorizationError';
      throw error;
    }

    const sanitizedPayload = Object.assign({}, payload);
    delete sanitizedPayload._gatewayToken;
    return sanitizedPayload;
  }

  function parseJsonBody_(e) {
    const contents = e && e.postData && e.postData.contents
      ? String(e.postData.contents).trim()
      : '';

    if (!contents) {
      ValidationService.fail('Corpo JSON obrigatório para esta operação.');
    }

    try {
      return JSON.parse(contents);
    } catch (error) {
      ValidationService.fail('Corpo JSON inválido.');
    }
  }

  function handleError_(error) {
    if (error && error.name === 'AuthorizationError') {
      return JsonResponse.unauthorized(error.message || 'Acesso não autorizado.');
    }

    if (error && error.name === 'ValidationError') {
      return JsonResponse.badRequest(error.message, error.details || null);
    }

    return JsonResponse.error(error);
  }

  function normalizeRoute_(value) {
    return String(value || 'health').trim().toLowerCase();
  }

  return {
    handleGet,
    handlePost,
  };
})();
