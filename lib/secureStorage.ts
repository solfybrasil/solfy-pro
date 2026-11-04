import { supabase } from './supabase';

interface CachedSignedUrl {
  url: string;
  expiresAt: number;
}

// Cache em memória de Signed URLs com timestamp de expiração (TTL)
const signedUrlCache = new Map<string, CachedSignedUrl>();
const SAFETY_MARGIN_MS = 5 * 60 * 1000; // 5 minutos de margem de segurança antes de expirar
const DEFAULT_EXPIRY_SECONDS = 3600; // 1 hora

function extrairBucketECaminho(trimmed: string): { bucket: string; path: string } {
  let bucket = 'solicitacao-anexos';
  let path = trimmed;

  const publicIdx = path.indexOf('/storage/v1/object/public/');
  if (publicIdx !== -1) {
    const after = path.substring(publicIdx + '/storage/v1/object/public/'.length);
    const slash = after.indexOf('/');
    if (slash !== -1) {
      bucket = after.substring(0, slash);
      path = after.substring(slash + 1);
    }
  } else {
    const signIdx = path.indexOf('/storage/v1/object/sign/');
    if (signIdx !== -1) {
      const after = path.substring(signIdx + '/storage/v1/object/sign/'.length);
      const slash = after.indexOf('/');
      if (slash !== -1) {
        bucket = after.substring(0, slash);
        path = after.substring(slash + 1).split('?')[0];
      }
    }
  }

  return { bucket, path };
}

/**
 * Converte qualquer caminho ou URL pública antiga do Supabase em uma Signed URL segura.
 * Utiliza cache em memória para evitar requisições redundantes a cada renderização da tela.
 */
export async function resolverFotoDemanda(urlOuPath: string | null | undefined): Promise<string> {
  if (!urlOuPath || typeof urlOuPath !== 'string') return '';
  const trimmed = urlOuPath.trim();
  if (!trimmed) return '';

  // Imagens externas (ex: placeholder, unsplash) não precisam de assinatura
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (!trimmed.includes('.supabase.co/storage/')) {
      return trimmed;
    }
  }

  // 1. Consulta o cache em memória
  const agora = Date.now();
  const cached = signedUrlCache.get(trimmed);
  if (cached && cached.expiresAt > agora + SAFETY_MARGIN_MS) {
    return cached.url;
  }

  const { bucket, path } = extrairBucketECaminho(trimmed);

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, DEFAULT_EXPIRY_SECONDS);

    if (data?.signedUrl) {
      signedUrlCache.set(trimmed, {
        url: data.signedUrl,
        expiresAt: agora + DEFAULT_EXPIRY_SECONDS * 1000,
      });
      return data.signedUrl;
    }
  } catch (err) {
    console.warn('[SecureStorage] Falha ao criar signed URL:', err);
  }

  return trimmed;
}

/**
 * Converte um lote de fotos em URLs assinadas de forma otimizada.
 * Utiliza cache em memória para acertos e createSignedUrls em lote para as pendentes.
 */
export async function resolverFotosDemandas(urlsOuPaths: string[] | null | undefined): Promise<string[]> {
  if (!urlsOuPaths || !Array.isArray(urlsOuPaths)) return [];
  if (urlsOuPaths.length === 0) return [];

  const agora = Date.now();
  const resultados: (string | null)[] = new Array(urlsOuPaths.length).fill(null);
  const pendentesPorBucket = new Map<string, { originalIndex: number; key: string; path: string }[]>();

  // 1. Separa o que já está em cache fresco
  urlsOuPaths.forEach((urlOuPath, idx) => {
    if (!urlOuPath || typeof urlOuPath !== 'string') {
      resultados[idx] = '';
      return;
    }
    const trimmed = urlOuPath.trim();
    if (!trimmed) {
      resultados[idx] = '';
      return;
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (!trimmed.includes('.supabase.co/storage/')) {
        resultados[idx] = trimmed;
        return;
      }
    }

    const cached = signedUrlCache.get(trimmed);
    if (cached && cached.expiresAt > agora + SAFETY_MARGIN_MS) {
      resultados[idx] = cached.url;
      return;
    }

    const { bucket, path } = extrairBucketECaminho(trimmed);
    if (!pendentesPorBucket.has(bucket)) {
      pendentesPorBucket.set(bucket, []);
    }
    pendentesPorBucket.get(bucket)!.push({ originalIndex: idx, key: trimmed, path });
  });

  // 2. Busca em lote (createSignedUrls) para cada bucket
  const promises = Array.from(pendentesPorBucket.entries()).map(async ([bucket, itens]) => {
    try {
      const paths = itens.map((item) => item.path);
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrls(paths, DEFAULT_EXPIRY_SECONDS);

      if (!error && data && Array.isArray(data)) {
        data.forEach((res, i) => {
          const item = itens[i];
          if (res?.signedUrl) {
            signedUrlCache.set(item.key, {
              url: res.signedUrl,
              expiresAt: agora + DEFAULT_EXPIRY_SECONDS * 1000,
            });
            resultados[item.originalIndex] = res.signedUrl;
          } else {
            resultados[item.originalIndex] = item.key;
          }
        });
      } else {
        // Fallback unitário se lote falhar
        for (const item of itens) {
          resultados[item.originalIndex] = await resolverFotoDemanda(item.key);
        }
      }
    } catch {
      for (const item of itens) {
        resultados[item.originalIndex] = item.key;
      }
    }
  });

  await Promise.all(promises);
  return resultados.map((r, i) => r ?? urlsOuPaths[i] ?? '');
}
