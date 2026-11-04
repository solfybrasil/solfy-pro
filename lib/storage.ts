import { supabase } from './supabase';

// Cache em memória para signed URLs gerais com TTL
const generalSignedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Resolve qualquer URL ou caminho de arquivo do Supabase Storage para uma URL assinada válida.
 * Suporta buckets privados (documents, avatars) e URLs públicas com fallback e cache em memória.
 */
export async function getSignedStorageUrl(rawUrl?: string | null): Promise<string> {
  if (!rawUrl) return '';

  const trimmed = rawUrl.trim();
  const agora = Date.now();
  const cached = generalSignedUrlCache.get(trimmed);
  if (cached && cached.expiresAt > agora + 60000) {
    return cached.url;
  }

  try {
    // 1. Se for uma URL completa do Supabase Storage
    if (trimmed.includes('/storage/v1/object/')) {
      const match = trimmed.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/);
      if (match) {
        const bucket = match[1];
        const path = decodeURIComponent(match[2].split('?')[0]);
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 86400 * 7); // 7 dias de validade

        if (!error && data?.signedUrl) {
          generalSignedUrlCache.set(trimmed, {
            url: data.signedUrl,
            expiresAt: agora + 86400 * 7 * 1000,
          });
          return data.signedUrl;
        }
      }
      return trimmed;
    }

    // 2. Se for caminho relativo (ex: kyc/user_id/xxx.jpg ou user_id/xxx.jpg)
    const cleanPath = trimmed.replace(/^documents\//, '').replace(/^avatars\//, '');
    const bucket = trimmed.startsWith('avatars/') || !trimmed.includes('kyc') ? 'avatars' : 'documents';

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(cleanPath, 86400 * 7);

    if (!error && data?.signedUrl) {
      generalSignedUrlCache.set(trimmed, {
        url: data.signedUrl,
        expiresAt: agora + 86400 * 7 * 1000,
      });
      return data.signedUrl;
    }

    const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
    if (pubData?.publicUrl) {
      return pubData.publicUrl;
    }
  } catch (e) {
    console.error('[storage] Erro ao resolver signed URL:', e);
  }

  return trimmed;
}

/**
 * Faz upload de imagem (URI do Expo ou Web) para o bucket público 'help-images'
 */
export async function uploadHelpImage(uri: string): Promise<string | null> {
  if (!uri) return null;
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  try {
    const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
    const validExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${validExt}`;

    const res = await fetch(uri);
    const blob = await res.blob();

    const { error: uploadError } = await supabase.storage
      .from('help-images')
      .upload(fileName, blob, {
        contentType: blob.type || `image/${validExt === 'jpg' ? 'jpeg' : validExt}`,
        upsert: true,
      });

    if (uploadError) {
      console.warn('[uploadHelpImage] Erro ao enviar imagem:', uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from('help-images').getPublicUrl(fileName);
    return data?.publicUrl || null;
  } catch (err) {
    console.warn('[uploadHelpImage] Falha ao processar arquivo para upload:', err);
    return null;
  }
}
