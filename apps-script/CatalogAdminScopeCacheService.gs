const CatalogAdminScopeCacheService = (() => {
  const VERSION_KEY = 'catalog_admin_scope_cache_version_v1';
  const CACHE_PREFIX = 'catalog_admin_scope_response_v1_';
  const STATIC_CACHE_SECONDS = 120;
  const PRICE_CACHE_SECONDS = 30;

  function get(payload) {
    const input = payload || {};
    const scope = ValidationService.normalizeUpper(input.escopo || '');
    const isPriceScope =
      scope === CatalogAdminQueryService.SCOPES.LABOR_PRICES ||
      scope === CatalogAdminQueryService.SCOPES.PRODUCT_PRICES;
    const ttl = isPriceScope ? PRICE_CACHE_SECONDS : STATIC_CACHE_SECONDS;
    const key = cacheKey_(input, scope);

    try {
      const cached = CacheService.getScriptCache().get(key);
      if (cached) return JSON.parse(cached);
    } catch (error) {
      // Cache é apenas otimização.
    }

    const result = CatalogAdminQueryService.getScope(input);

    try {
      CacheService.getScriptCache().put(key, JSON.stringify(result), ttl);
    } catch (error) {
      // Respostas acima do limite do CacheService seguem funcionando sem cache.
    }

    return result;
  }

  function clear() {
    try {
      CacheService.getScriptCache().put(VERSION_KEY, String(Date.now()), 21600);
    } catch (error) {
      // Falha de cache nunca pode bloquear uma gravação administrativa.
    }
  }

  function cacheKey_(payload, scope) {
    const version = currentVersion_();
    const normalized = [
      scope || 'SEM_ESCOPO',
      value_(payload.pagina || 1),
      value_(payload.tamanhoPagina || 25),
      value_(payload.busca),
    ].join('|');

    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      normalized,
      Utilities.Charset.UTF_8
    ).map(function (byte) {
      const value = byte < 0 ? byte + 256 : byte;
      return ('0' + value.toString(16)).slice(-2);
    }).join('');

    return CACHE_PREFIX + version + '_' + digest;
  }

  function currentVersion_() {
    try {
      const cache = CacheService.getScriptCache();
      let version = cache.get(VERSION_KEY);
      if (!version) {
        version = '1';
        cache.put(VERSION_KEY, version, 21600);
      }
      return version;
    } catch (error) {
      return 'nocache';
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
