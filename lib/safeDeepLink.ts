const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const ALLOWED_INTERNAL_PREFIXES = [
  '/demandas',
  '/(app)/demandas',
  '/notificacoes',
  '/(app)/notificacoes',
  '/perfil',
  '/(app)/perfil',
  '/mensagens',
  '/(app)/mensagens',
  '/agenda',
  '/(app)/agenda',
  '/chat',
  '/(app)/chat',
  '/orcamentos',
  '/(app)/orcamentos',
  '/prestadores',
  '/(app)/prestadores',
  '/termos',
];

const DYNAMIC_ENTITIES = ['demandas', 'chat', 'orcamentos', 'prestadores', 'propostas'];

function sanitizeAndValidateDeepLink(targetUrl: unknown): string | null {
  if (!targetUrl || typeof targetUrl !== 'string') return null;

  const trimmed = targetUrl.trim();

  // Rejeita URLs com protocolos externos
  if (/^(https?:|\/\/|javascript:|data:|file:|intent:)/i.test(trimmed)) {
    return null;
  }

  // Normaliza caminho relativo
  let path = trimmed;
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  const [routePath] = path.split('?');
  const segments = routePath.split('/').filter(Boolean);

  const isPrefixAllowed = ALLOWED_INTERNAL_PREFIXES.some(
    (prefix) => routePath === prefix || routePath.startsWith(prefix + '/')
  );

  if (!isPrefixAllowed) {
    return null;
  }

  // Se a rota for de entidade dinâmica (ex: /demandas/:id ou /(app)/demandas/:id)
  const isDynamicEntity = segments.some((s) => DYNAMIC_ENTITIES.includes(s));
  if (isDynamicEntity && segments.length >= 2) {
    const idSegment = segments[segments.length - 1];
    if (!UUID_REGEX.test(idSegment)) {
      return null;
    }
  }

  return path;
}

export { sanitizeAndValidateDeepLink };
