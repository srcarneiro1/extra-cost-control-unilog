const JsonResponse = (() => {
  function send_(payload) {
    return ContentService
      .createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  }

  function ok(data) {
    return send_({ ok: true, data: data || null });
  }

  function badRequest(message, details) {
    return send_({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: message,
        details: details || null,
      },
    });
  }

  function notFound(message) {
    return send_({ ok: false, error: { code: 'NOT_FOUND', message: message } });
  }

  function notImplemented(message) {
    return send_({ ok: false, error: { code: 'NOT_IMPLEMENTED', message: message } });
  }

  function error(errorValue) {
    const message = errorValue && errorValue.message
      ? errorValue.message
      : 'Erro interno não identificado.';

    return send_({ ok: false, error: { code: 'INTERNAL_ERROR', message: message } });
  }

  return {
    ok,
    badRequest,
    notFound,
    notImplemented,
    error,
  };
})();
