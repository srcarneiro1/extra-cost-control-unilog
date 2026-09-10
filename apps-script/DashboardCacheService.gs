const DashboardCacheService = (() => {
  const VERSION_KEY = 'dashboard_cache_version_v1';
  const CACHE_PREFIX = 'dashboard_response_v1_';
  const CACHE_SECONDS = 45;

  function get(payload) {
    const input = payload || {};
    const key = cacheKey_(input);

    try {
      const cached = CacheService.getScriptCache().get(key);
      if (cached) return JSON.parse(cached);
    } catch (error) {
      // Cache é apenas otimização.
    }

    const result = DashboardService.getDashboard(input);

    try {
      CacheService.getScriptCache().put(key, JSON.stringify(result), CACHE_SECONDS);
    } catch (error) {
      // Respostas maiores que o limite do CacheService seguem funcionando sem cache.
    }

    return result;
  }

  function clear() {
    try {
      CacheService.getScriptCache().put(VERSION_KEY, String(Date.now()), 21600);
    } catch (error) {
      // Falha de cache não pode bloquear uma gravação operacional.
    }
  }

  function cacheKey_(payload) {
    const version = currentVersion_();
    const normalized = [
      value_(payload.ano),
      value_(payload.mesCompetencia),
      value_(payload.operacao),
      value_(payload.supervisor),
      value_(payload.fornecedor),
      value_(payload.tipo),
      value_(payload.responsavelCusto),
      value_(payload.atividade),
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
    return ValidationService.normalizeUpper(value || 'TODOS');
  }

  return {
    get,
    clear,
  };
})();
