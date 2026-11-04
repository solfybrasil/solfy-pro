import { supabase } from './supabase';

export interface GeocodingResult {
  cep: string;
  cidade: string;
  estado: string;
  bairro?: string | null;
  cidade_ibge: string | null;
  latitude: number | null;
  longitude: number | null;
  origem: 'brasilapi_cep' | 'centroide_cidade' | 'manual';
  aproximado: boolean;
}

/**
 * Geocodifica um CEP brasileiro de forma resiliente e com custo zero.
 * 1. Tenta BrasilAPI v2 (coordenadas de alta precisão + IBGE)
 * 2. Em caso de falha/ausência de coordenadas, obtém o centroide oficial da cidade pelo IBGE
 * 3. Enfileira tentativa posterior sem bloquear o cadastro do usuário
 */
export async function geocodificarEnderecoCep(cep: string): Promise<GeocodingResult> {
  const cleanCep = (cep || '').replace(/\D/g, '');

  const resultadoPadrao: GeocodingResult = {
    cep: cleanCep,
    cidade: '',
    estado: '',
    cidade_ibge: null,
    latitude: null,
    longitude: null,
    origem: 'centroide_cidade',
    aproximado: true,
  };

  if (cleanCep.length !== 8) {
    return resultadoPadrao;
  }

  // 1. Tentativa via BrasilAPI v2
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
    if (res.ok) {
      const data = await res.json();
      const coords = data.location?.coordinates;
      const ibgeCity = data.ibge?.city || null;
      const city = data.city || '';
      const state = data.state || '';
      const neighborhood = data.neighborhood || null;

      if (coords?.latitude && coords?.longitude) {
        return {
          cep: cleanCep,
          cidade: city,
          estado: state,
          bairro: neighborhood,
          cidade_ibge: ibgeCity,
          latitude: parseFloat(coords.latitude),
          longitude: parseFloat(coords.longitude),
          origem: 'brasilapi_cep',
          aproximado: false,
        };
      }

      // Se veio sem coordenadas mas tem cidade/estado/IBGE, busca o centroide
      if (ibgeCity || (city && state)) {
        const centroide = await buscarCentroideCidade(ibgeCity, city, state);
        if (centroide) {
          return {
            cep: cleanCep,
            cidade: city,
            estado: state,
            bairro: neighborhood,
            cidade_ibge: centroide.codigo_ibge,
            latitude: centroide.latitude,
            longitude: centroide.longitude,
            origem: 'centroide_cidade',
            aproximado: true,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[Geocoding] Falha ao consultar BrasilAPI v2, acionando fallback:', err);
  }

  // 2. Fallback via ViaCEP + Centroide IBGE
  try {
    const resViaCep = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    if (resViaCep.ok) {
      const vdata = await resViaCep.json();
      if (!vdata.erro) {
        const ibgeCod = vdata.ibge || null;
        const city = vdata.localidade || '';
        const state = vdata.uf || '';

        const centroide = await buscarCentroideCidade(ibgeCod, city, state);
        if (centroide) {
          return {
            cep: cleanCep,
            cidade: city,
            estado: state,
            cidade_ibge: centroide.codigo_ibge,
            latitude: centroide.latitude,
            longitude: centroide.longitude,
            origem: 'centroide_cidade',
            aproximado: true,
          };
        }

        return {
          cep: cleanCep,
          cidade: city,
          estado: state,
          cidade_ibge: ibgeCod,
          latitude: null,
          longitude: null,
          origem: 'centroide_cidade',
          aproximado: true,
        };
      }
    }
  } catch (errViaCep) {
    console.warn('[Geocoding] Falha ao consultar ViaCEP fallback:', errViaCep);
  }

  return resultadoPadrao;
}

/**
 * Consulta centroide oficial na tabela cidades_ibge do banco
 */
async function buscarCentroideCidade(
  ibgeCod: string | null,
  cidade: string,
  estado: string
): Promise<{ codigo_ibge: string; latitude: number; longitude: number } | null> {
  try {
    if (ibgeCod) {
      const { data } = await supabase
        .from('cidades_ibge')
        .select('codigo_ibge, latitude, longitude')
        .eq('codigo_ibge', ibgeCod)
        .maybeSingle();
      if (data?.latitude && data?.longitude) {
        return data as any;
      }
    }

    if (cidade && estado) {
      const { data } = await supabase
        .from('cidades_ibge')
        .select('codigo_ibge, latitude, longitude')
        .ilike('cidade', cidade)
        .ilike('estado', estado)
        .maybeSingle();
      if (data?.latitude && data?.longitude) {
        return data as any;
      }
    }
  } catch (err) {
    console.warn('[Geocoding] Falha ao buscar centroide no banco:', err);
  }
  return null;
}
