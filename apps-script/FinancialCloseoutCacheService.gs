// Cache das leituras da aba Fechamentos (22/10/2026).
// Mesmo padrão de AdministrativeSolicitationCacheService: chave versionada no CacheService.
// - LISTAR (fechamento de uma competência): 30 s; METADADOS (competências): 5 min.
// - Qualquer gravação do sistema (Api.writeAndInvalidate_) troca a versão e invalida tudo,
//   inclusive mudanças em solicitações, que alteram o fechamento.
// - fresh=1 (botão Atualizar) ignora o cache e grava a resposta nova.
const FinancialCloseoutCacheService = (() => {
  const VERSION_KEY = 'financial_closeout_cache_version_v1';
  const CACHE_PREFIX = 'financial_closeout_response_v1_';
  const LIST_CACHE_SECONDS = 30;
  const METADATA_CACHE_SECONDS = 300;

  function get(payload, loader) {
    const input = payload || {};
    const action = ValidationService.normalizeUpper(input.acao || FinancialCloseoutService.ACTIONS.LIST);
    const ttl = action === FinancialCloseoutService.ACTIONS.METADATA ? METADATA_CACHE_SECONDS : LIST_CACHE_SECONDS;
    const key = cacheKey_(action, input.competencia);
    const fresh = String(input.fresh || '') === '1' || input.fresh === true;

    if (!fresh) {
      try {
        const cached = CacheService.getScriptCache().get(key);
        if (cached) return JSON.parse(cached);
      } catch (error) {
        // Cache é apenas otimização.
      }
    }

    const result = loader(input);

    try {
      CacheService.getScriptCache().put(key, JSON.stringify(result), ttl);
    } catch (error) {
      // Respostas acima do limite do CacheService seguem funcionando sem cache.
    }
    return result;
  }

  function clear() {
    try {
      // Versão única (horário + sufixo aleatório): duas gravações no mesmo milissegundo
      // também geram versões diferentes e invalidam o cache.
      CacheService.getScriptCache().put(VERSION_KEY, Date.now() + '-' + Math.random().toString(36).slice(2, 10), 21600);
    } catch (error) {
      // Falha de cache nunca pode bloquear uma gravação.
    }
  }

  function cacheKey_(action, competence) {
    return CACHE_PREFIX + version_() + '_' + action + '_' + String(competence || 'TODAS').trim();
  }

  function version_() {
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

  return { get, clear };
})();
