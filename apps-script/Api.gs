const Api = (() => {
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
        return JsonResponse.ok(CatalogService.getActiveCatalogs());
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

      if (route === 'solicitacoes') {
        return JsonResponse.ok(SolicitationService.create(payload));
      }

      return JsonResponse.notFound('Rota não encontrada.');
    } catch (error) {
      return handleError_(error);
    }
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
