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
      return JsonResponse.error(error);
    }
  }

  function handlePost() {
    return JsonResponse.notImplemented('Rotas POST ainda não implementadas nesta etapa.');
  }

  function normalizeRoute_(value) {
    return String(value || 'health').trim().toLowerCase();
  }

  return {
    handleGet,
    handlePost,
  };
})();
