import { Linking } from 'react-native';
import { supabase } from './supabase';

export interface BannerItem {
  id: string;
  titulo: string;
  imagem_path: string;
  imagem_url: string;
  texto_alternativo: string;
  link_tipo: 'nenhum' | 'interno' | 'externo';
  link_valor: string | null;
  ordem: number;
}

export const BANNER_INTERNAL_ALLOWLIST: string[] = [
  '/(app)/demandas',
  '/(app)/agenda',
  '/(app)/financeiro',
  '/(app)/notificacoes',
  '/(app)/perfil',
  '/(app)/perfil/disponibilidade',
  '/(app)/perfil/especialidades_raio',
  '/(app)/perfil/documentos',
  '/(app)/perfil/dados_bancarios',
  '/(app)/nova-demanda',
  '/demandas',
  '/agenda',
  '/financeiro',
  '/notificacoes',
  '/perfil',
  '/perfil/disponibilidade',
  '/perfil/especialidades_raio',
  '/perfil/documentos',
  '/perfil/dados_bancarios',
  '/nova-demanda',
  '/configuracoes/disponibilidade',
];

/**
 * Valida se a rota interna pertence à allowlist de deep links permitidos
 */
export function isInternalRouteAllowed(route: string): boolean {
  if (!route) return false;
  const cleanRoute = route.split('?')[0].trim();
  return BANNER_INTERNAL_ALLOWLIST.includes(cleanRoute);
}

/**
 * Valida se o link externo é uma URL HTTPS segura
 */
export function isExternalUrlAllowed(url: string): boolean {
  if (!url) return false;
  const cleanUrl = url.trim();
  return /^https:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/i.test(cleanUrl);
}

/**
 * Busca banners ativos para o usuário logado via RPC
 */
export async function buscarBannersAtivos(): Promise<BannerItem[]> {
  try {
    const { data, error } = await supabase.rpc('banners_ativos_para_mim');

    if (error) {
      console.warn('[BannersApi] Erro na RPC banners_ativos_para_mim:', error.message);
      return [];
    }

    if (!data || !Array.isArray(data)) {
      return [];
    }

    return data.map((b: any) => {
      let imagemUrl = b.imagem_path || '';
      if (imagemUrl && !imagemUrl.startsWith('http://') && !imagemUrl.startsWith('https://')) {
        const { data: pubData } = supabase.storage.from('banners').getPublicUrl(imagemUrl);
        imagemUrl = pubData?.publicUrl || imagemUrl;
      }

      return {
        id: b.id,
        titulo: b.titulo,
        imagem_path: b.imagem_path,
        imagem_url: imagemUrl,
        texto_alternativo: b.texto_alternativo || b.titulo,
        link_tipo: b.link_tipo || 'nenhum',
        link_valor: b.link_valor || null,
        ordem: b.ordem ?? 0,
      };
    });
  } catch (err) {
    console.warn('[BannersApi] Exceção ao carregar banners:', err);
    return [];
  }
}

/**
 * Registra visualização ou clique de banner
 */
export async function registrarEventoBanner(bannerId: string, tipo: 'visualizacao' | 'clique'): Promise<void> {
  try {
    if (!bannerId) return;
    await supabase.rpc('registrar_evento_banner', {
      p_banner_id: bannerId,
      p_tipo: tipo,
    });
  } catch (err) {
    // Falha silenciosa de telemetria sem afetar UX
    console.warn('[BannersApi] Erro ao registrar evento de banner:', err);
  }
}

/**
 * Executa ação de clique do banner com proteção de deep link e navegador externo
 */
export async function handleBannerPress(
  banner: BannerItem,
  onNavigateInternal: (route: string) => void
): Promise<void> {
  // 1. Registra telemetria de clique
  registrarEventoBanner(banner.id, 'clique');

  // 2. Ação conforme tipo de link
  if (banner.link_tipo === 'nenhum' || !banner.link_valor) {
    return;
  }

  if (banner.link_tipo === 'interno') {
    const route = banner.link_valor.trim();
    if (isInternalRouteAllowed(route)) {
      onNavigateInternal(route);
    } else {
      console.warn('[BannersApi] Rota interna bloqueada por não constar na allowlist:', route);
    }
    return;
  }

  if (banner.link_tipo === 'externo') {
    const url = banner.link_valor.trim();
    if (isExternalUrlAllowed(url)) {
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        }
      } catch (err) {
        console.warn('[BannersApi] Erro ao abrir URL externa:', err);
      }
    } else {
      console.warn('[BannersApi] URL externa bloqueada (deve ser https):', url);
    }
  }
}
