const AdministrativeSolicitationCacheService = (() => {
  const LIST_VERSION_KEY = 'admin_solicitations_list_cache_version_v2';
  const METADATA_VERSION_KEY = 'admin_solicitations_metadata_cache_version_v2';
  const CACHE_PREFIX = 'admin_solicitations_response_v2_';
  const LIST_CACHE_SECONDS = 30;
  const METADATA_CACHE_SECONDS = 300;

  function get(payload) {
    const input = payload || {};
    const action = ValidationService.normalizeUpper(
      input.acao || AdministrativeSolicitationQueryService.ACTIONS.LIST
    );

    if (action === AdministrativeSolicitationQueryService.ACTIONS.DETAIL) {
      return AdministrativeSolicitationQueryService.execute(input);
    }

    const ttl = action === AdministrativeSolicitationQueryService.ACTIONS.METADATA
      ? METADATA_CACHE_SECONDS
      : LIST_CACHE_SECONDS;
    const key = cacheKey_(input, action);

    try {
      const cached = CacheService.getScriptCache().get(key);
      if (cached) return JSON.parse(cached);
    } catch (error) {
      // Cache é apenas otimização.
    }

    const result = AdministrativeSolicitationQueryService.execute(input);

    try {
      CacheService.getScriptCache().put(key, JSON.stringify(result), ttl);
    } catch (error) {
      // Respostas acima do limite do CacheService seguem funcionando sem cache.
    }

    return result;
  }

  function clear(options) {
    const input = options || {};
    bumpVersion_(LIST_VERSION_KEY);
    if (input.metadata === true) bumpVersion_(METADATA_VERSION_KEY);
  }

  function cacheKey_(payload, action) {
    const version = currentVersion_(action);
    const normalized = [
      action,
      value_(payload.pagina || 1),
      value_(payload.tamanhoPagina || payload.limite || 20),
      value_(payload.busca),
      value_(payload.tipo),
      value_(payload.status),
      value_(payload.anoRegistro),
      value_(payload.mesRegistro),
      value_(payload.dataRegistro),
      value_(payload.operacaoEscopo),
    ].join('|');

    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      normalized,
      Utilities.Charset.UTF_8
    ).map(function (byte) {
      const normalizedByte = byte < 0 ? byte + 256 : byte;
      return ('0' + normalizedByte.toString(16)).slice(-2);
    }).join('');

    return CACHE_PREFIX + version + '_' + digest;
  }

  function currentVersion_(action) {
    const versionKey = action === AdministrativeSolicitationQueryService.ACTIONS.METADATA
      ? METADATA_VERSION_KEY
      : LIST_VERSION_KEY;

    try {
      const cache = CacheService.getScriptCache();
      let version = cache.get(versionKey);
      if (!version) {
        version = '1';
        cache.put(versionKey, version, 21600);
      }
      return version;
    } catch (error) {
      return 'nocache';
    }
  }

  function bumpVersion_(versionKey) {
    try {
      CacheService.getScriptCache().put(versionKey, String(Date.now()), 21600);
    } catch (error) {
      // Falha de cache nunca pode bloquear uma gravação operacional.
    }
  }

  function value_(value) {
    return ValidationService.normalizeUpper(value == null || value === '' ? 'TODOS' : value);
  }

  return {
    get,
    clear,
  };
})();
