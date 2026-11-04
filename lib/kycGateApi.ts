import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import type { KycMeuCasoResponse, KycTipo } from '../types/kyc';

/**
 * Pure JavaScript SHA-256 fallback implementation for React Native / Hermes
 * when crypto.subtle is unavailable.
 */
function sha256PureJs(ascii: string): string {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i = 0, j = 0;
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  
  let hash: number[] = [];
  let k: number[] = [];
  let primeCounter = 0;

  const isPrime: { [n: number]: boolean } = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isPrime[candidate]) {
      for (let n = candidate; n <= 311; n += candidate) {
        isPrime[n] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  hash = hash.slice(0, 8);

  for (i = 0; i < asciiBitLength; i += 8) {
    words[i >> 5] |= (ascii.charCodeAt(i / 8) & 255) << (24 - (i % 32));
  }
  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    const oldHash = hash.slice(0);

    for (j = 0; j < 64; j++) {
      if (j >= 16) {
        const w15 = w[j - 15], w2 = w[j - 2];
        const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
        const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }

      const s1 = ((hash[4] >>> 6) | (hash[4] << 26)) ^ ((hash[4] >>> 11) | (hash[4] << 21)) ^ ((hash[4] >>> 25) | (hash[4] << 7));
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1 + ch + k[j] + w[j]) | 0;
      const s0 = ((hash[0] >>> 2) | (hash[0] << 30)) ^ ((hash[0] >>> 13) | (hash[0] << 19)) ^ ((hash[0] >>> 22) | (hash[0] << 10));
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0 + maj) | 0;

      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (j = 0; j < 8; j++) {
      hash[j] = (hash[j] + oldHash[j]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Utilitário para cálculo de SHA-256 unificado (WebCrypto com fallback puro).
 */
export async function calculateSha256(data: string | ArrayBuffer): Promise<string> {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle?.digest) {
      const buffer = typeof data === 'string' ? new TextEncoder().encode(data).buffer : data;
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {}

  let text = '';
  if (typeof data === 'string') {
    text = data;
  } else {
    const bytes = new Uint8Array(data);
    for (let idx = 0; idx < bytes.length; idx++) {
      text += String.fromCharCode(bytes[idx]);
    }
  }
  return sha256PureJs(text);
}

// In-memory cache
const memoryCache: Record<string, string> = {};

export async function getStoredPublicToken(casoId?: string): Promise<string | null> {
  try {
    if (casoId && memoryCache[`kyc_token_${casoId}`]) {
      return memoryCache[`kyc_token_${casoId}`];
    }
    if (memoryCache['kyc_token_solicitacao']) {
      return memoryCache['kyc_token_solicitacao'];
    }
    const tokenCaso = casoId ? await AsyncStorage.getItem(`@solfy:kyc_token_${casoId}`) : null;
    if (tokenCaso) return tokenCaso;
    return await AsyncStorage.getItem('@solfy:kyc_token_solicitacao');
  } catch {
    return null;
  }
}

export async function setStoredPublicToken(token: string, casoId?: string, email?: string): Promise<void> {
  try {
    memoryCache['kyc_token_solicitacao'] = token;
    await AsyncStorage.setItem('@solfy:kyc_token_solicitacao', token);
    if (casoId) {
      memoryCache[`kyc_token_${casoId}`] = token;
      memoryCache['kyc_ultimo_caso_id'] = casoId;
      await AsyncStorage.setItem(`@solfy:kyc_token_${casoId}`, token);
      await AsyncStorage.setItem('@solfy:kyc_ultimo_caso_id', casoId);
    }
    if (email) {
      memoryCache['kyc_ultimo_email'] = email;
      await AsyncStorage.setItem('@solfy:kyc_ultimo_email', email);
    }
  } catch {}
}

export async function getStoredUltimoCasoId(): Promise<string | null> {
  try {
    if (memoryCache['kyc_ultimo_caso_id']) return memoryCache['kyc_ultimo_caso_id'];
    return await AsyncStorage.getItem('@solfy:kyc_ultimo_caso_id');
  } catch {
    return null;
  }
}

export async function getStoredUltimoEmail(): Promise<string | null> {
  try {
    if (memoryCache['kyc_ultimo_email']) return memoryCache['kyc_ultimo_email'];
    return await AsyncStorage.getItem('@solfy:kyc_ultimo_email');
  } catch {
    return null;
  }
}

/**
 * Consulta em tempo real o status de uma solicitação KYC sem conta através do token público.
 */
export async function kycStatusSolicitacaoToken(
  casoId: string,
  tokenPublico?: string
): Promise<{
  sucesso: boolean;
  caso_id?: string;
  status?: string;
  tipo?: 'sindico' | 'prestador';
  mensagem_ao_usuario?: string;
  pendencias?: Array<{ documento_id: string; motivo: string; detalhe?: string; codigo?: string }>;
  conta_criada?: boolean;
  email?: string;
  erro?: string;
  mensagem?: string;
}> {
  const token = tokenPublico || (await getStoredPublicToken(casoId));
  if (!token) {
    return { sucesso: false, erro: 'token_ausente', mensagem: 'Token de verificação não encontrado.' };
  }

  const { data, error } = await supabase.rpc('kyc_status_solicitacao_token', {
    p_caso_id: casoId,
    p_token_publico: token,
  });

  if (error) {
    return { sucesso: false, erro: error.message, mensagem: error.message };
  }

  return data as any;
}

/**
 * CADASTRO SEM CONTA: Solicitação de Cadastro Anônima e Segura
 */
export async function solicitarCadastroSemConta(params: {
  tipo: KycTipo;
  email: string;
  senha: string;
  nome: string;
  telefone: string;
  dadosIniciais?: Record<string, unknown>;
  honeypot?: string;
}): Promise<{
  sucesso: boolean;
  caso_id?: string;
  token_publico?: string;
  mensagem?: string;
  erro?: string;
}> {
  try {
    // 1. Tenta Edge Function
    try {
      const { data: efData, error: efError } = await supabase.functions.invoke('solicitar-cadastro', {
        body: {
          tipo: params.tipo,
          email: params.email,
          senha: params.senha,
          nome: params.nome,
          telefone: params.telefone,
          dados_iniciais: params.dadosIniciais || {},
          honeypot: params.honeypot || null,
        },
      });

      if (!efError && efData?.sucesso) {
        if (efData.token_publico && efData.caso_id) {
          await setStoredPublicToken(efData.token_publico, efData.caso_id, params.email);
        }
        return efData;
      }
    } catch {}

    // 2. Fallback direto via RPC
    const randomHex = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0')
    ).join('');
    const tokenPublico = randomHex;
    const tokenPublicoHash = await calculateSha256(tokenPublico);

    const { data: rpcData, error: rpcError } = await supabase.rpc('solicitar_cadastro_sem_conta', {
      p_tipo: params.tipo,
      p_email: params.email,
      p_senha: params.senha,
      p_nome: params.nome,
      p_telefone: params.telefone,
      p_dados_iniciais: params.dadosIniciais || {},
      p_token_publico_hash: tokenPublicoHash,
      p_honeypot: params.honeypot || null,
    });

    if (rpcError) {
      return { sucesso: false, erro: rpcError.message, mensagem: rpcError.message };
    }

    if (rpcData?.caso_id) {
      await setStoredPublicToken(tokenPublico, rpcData.caso_id, params.email);
    }

    return {
      ...rpcData,
      token_publico: tokenPublico,
    };
  } catch (err: any) {
    return { sucesso: false, erro: err.message, mensagem: err.message || 'Erro ao enviar solicitação.' };
  }
}

/**
 * Resposta oficial do servidor para o status de cadastro do usuário autenticado.
 */
export interface MeuStatusCadastroResponse {
  ok: boolean;
  autenticado: boolean;
  usuario_id?: string;
  status: 'aprovado' | 'em_analise' | 'pendencia' | 'recusa' | 'suspenso' | 'incompleto' | 'nao_autenticado' | string;
  status_bruto?: string;
  tipo?: 'sindico' | 'prestador' | string;
  caso_id?: string | null;
  mensagem?: string;
  motivo?: string;
  pendencias?: any[];
  prazo_texto?: string;
  contato_suporte?: string;
  enviado_em?: string;
  poll_status_seg?: number;
  nome_completo?: string;
  email?: string;
}

/**
 * Consulta unificada oficial via auth.uid() no servidor (RPC meu_status_cadastro).
 * Garante que status, e-mail e dados nunca venham de parâmetros de URL.
 */
export async function obterMeuStatusCadastro(): Promise<MeuStatusCadastroResponse> {
  try {
    const { data, error } = await supabase.rpc('meu_status_cadastro');
    if (error || !data) {
      return { ok: false, autenticado: false, status: 'nao_autenticado' };
    }
    return data as MeuStatusCadastroResponse;
  } catch (err) {
    console.warn('[kycGateApi] Erro ao chamar meu_status_cadastro:', err);
    return { ok: false, autenticado: false, status: 'nao_autenticado' };
  }
}

/**
 * Consulta unificada do Portão de Acesso KYC para usuário autenticado.
 */
export async function kycMeuCaso(): Promise<KycMeuCasoResponse> {
  const { data, error } = await supabase.rpc('kyc_meu_caso');
  if (error || !data) {
    return { autenticado: false };
  }
  return data as KycMeuCasoResponse;
}

/**
 * Inicializa ou retoma um caso KYC para usuário autenticado.
 */
export async function kycIniciar(
  tipo: KycTipo,
  condominioId?: string
): Promise<{
  sucesso: boolean;
  caso_id?: string;
  tipo?: KycTipo;
  status?: string;
  nivel?: number;
  etapa_atual?: string;
  retomado?: boolean;
  mensagem?: string;
}> {
  const { data, error } = await supabase.rpc('kyc_iniciar', {
    p_tipo: tipo,
    p_condominio_id: condominioId || null,
  });

  if (error) {
    return { sucesso: false, mensagem: error.message };
  }
  return data;
}

/**
 * Salva rascunho dos dados KYC.
 */
export async function kycSalvarRascunho(
  casoId: string,
  dados: Record<string, unknown>,
  etapa?: string,
  tokenPublico?: string
): Promise<{ sucesso: boolean; mensagem?: string }> {
  const token = tokenPublico || (await getStoredPublicToken(casoId));
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && token) {
    const { data, error } = await supabase.rpc('kyc_salvar_rascunho_sem_conta', {
      p_caso_id: casoId,
      p_dados: dados,
      p_etapa: etapa || null,
      p_token_publico: token,
    });
    if (error) return { sucesso: false, mensagem: error.message };
    return data || { sucesso: true };
  }

  const { data, error } = await supabase.rpc('kyc_salvar_rascunho', {
    p_caso_id: casoId,
    p_dados: dados,
    p_etapa: etapa || null,
  });

  if (error) {
    return { sucesso: false, mensagem: error.message };
  }
  return data || { sucesso: true };
}

export interface MobileArquivoUpload {
  uri: string;
  name?: string;
  mimeType?: string;
  base64?: string | null;
  size?: number;
}

/**
 * Envia documento para o bucket seguro 'kyc-documentos-privados' e registra via RPC
 */
export async function kycUploadEDocumento(
  casoId: string,
  tipo: string,
  file: MobileArquivoUpload,
  tokenPublico?: string
): Promise<{
  sucesso: boolean;
  documento_id?: string;
  versao?: number;
  sha256?: string;
  mensagem?: string;
}> {
  try {
    let arrayBuffer: ArrayBuffer;
    if (file.base64) {
      arrayBuffer = decode(file.base64);
    } else if (file.uri.startsWith('data:')) {
      const b64 = file.uri.includes(',') ? file.uri.split(',')[1] : file.uri;
      arrayBuffer = decode(b64);
    } else {
      try {
        const res = await fetch(file.uri);
        const blob = await res.blob();
        arrayBuffer = await blob.arrayBuffer();
      } catch {
        const base64String = await FileSystemLegacy.readAsStringAsync(file.uri, {
          encoding: 'base64' as any,
        });
        arrayBuffer = decode(base64String);
      }
    }
    const sha256 = await calculateSha256(arrayBuffer);
    const timestamp = Date.now();
    const ext = (file.name || file.uri).split('.').pop()?.toLowerCase() || 'jpg';
    const mime = file.mimeType || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg');
    const token = tokenPublico || (await getStoredPublicToken(casoId));

    const { data: { user } } = await supabase.auth.getUser();
    const folderPrefix = user ? user.id : `solicitacoes/${casoId}`;
    const storagePath = `${folderPrefix}/${tipo}_v${timestamp}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('kyc-documentos-privados')
      .upload(storagePath, arrayBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: mime,
      });

    if (uploadError) {
      return { sucesso: false, mensagem: `Falha no upload do arquivo: ${uploadError.message}` };
    }

    const nomeOriginal = file.name || `${tipo}.${ext}`;
    const tamanhoBytes = file.size || arrayBuffer.byteLength;

    if (!user && token) {
      const { data, error: rpcError } = await supabase.rpc('kyc_registrar_documento_sem_conta', {
        p_caso_id: casoId,
        p_tipo: tipo,
        p_storage_path: storagePath,
        p_nome_original: nomeOriginal,
        p_tamanho_bytes: tamanhoBytes,
        p_sha256: sha256,
        p_mime: mime,
        p_token_publico: token,
      });

      if (rpcError) {
        return { sucesso: false, mensagem: rpcError.message };
      }
      return data || { sucesso: true };
    }

    const { data, error: rpcError } = await supabase.rpc('kyc_registrar_documento', {
      p_caso_id: casoId,
      p_tipo: tipo,
      p_storage_path: storagePath,
      p_nome_original: nomeOriginal,
      p_tamanho_bytes: tamanhoBytes,
      p_sha256: sha256,
      p_mime: mime,
    });

    if (rpcError) {
      return { sucesso: false, mensagem: rpcError.message };
    }

    return data || { sucesso: true };
  } catch (err: any) {
    return { sucesso: false, mensagem: err.message || 'Erro inesperado no envio do documento.' };
  }
}

/**
 * Obtém texto legal vigente.
 */
export async function aceiteTexto(codigo: string): Promise<{
  sucesso: boolean;
  codigo?: string;
  versao?: string | number;
  titulo?: string;
  texto_md?: string;
  sha256_texto?: string;
  mensagem?: string;
}> {
  const { data, error } = await supabase.rpc('aceite_texto', {
    p_codigo: codigo,
  });

  if (error) {
    return { sucesso: false, mensagem: error.message };
  }
  return data;
}

/**
 * Registra o aceite eletrônico (Clickwrap).
 */
export async function aceiteRegistrar(dados: {
  casoId: string;
  documentoCodigo: string;
  versao: string | number;
  sha256Texto: string;
  tokenPublico?: string;
}): Promise<{ sucesso: boolean; aceite_id?: string; mensagem?: string }> {
  const versaoInt = typeof dados.versao === 'string' ? parseInt(dados.versao, 10) : dados.versao;
  const token = dados.tokenPublico || (await getStoredPublicToken(dados.casoId));
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && token) {
    const { data, error } = await supabase.rpc('aceite_registrar_sem_conta', {
      p_caso_id: dados.casoId,
      p_documento_codigo: dados.documentoCodigo,
      p_versao: versaoInt,
      p_sha256_texto: dados.sha256Texto,
      p_user_agent: 'SolfyApp-Mobile/iOS-Android',
      p_rolou: true,
      p_token_publico: token,
    });
    if (error) return { sucesso: false, mensagem: error.message };
    return data;
  }

  const { data, error } = await supabase.rpc('aceite_registrar', {
    p_caso_id: dados.casoId,
    p_documento_codigo: dados.documentoCodigo,
    p_versao: versaoInt,
    p_sha256_texto: dados.sha256Texto,
    p_user_agent: 'SolfyApp-Mobile/iOS-Android',
    p_rolou: true,
  });

  if (error) {
    return { sucesso: false, mensagem: error.message };
  }
  return data;
}

/**
 * Envia o caso para análise da auditoria humana (rascunho -> enviado).
 */
export async function kycEnviar(casoId: string, tokenPublico?: string): Promise<{
  sucesso: boolean;
  caso_id?: string;
  status?: string;
  prazo_texto?: string;
  mensagem?: string;
}> {
  const token = tokenPublico || (await getStoredPublicToken(casoId));
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && token) {
    const { data, error } = await supabase.rpc('kyc_enviar_sem_conta', {
      p_caso_id: casoId,
      p_token_publico: token,
    });
    if (error) return { sucesso: false, mensagem: error.message };
    return data;
  }

  const { data, error } = await supabase.rpc('kyc_enviar', {
    p_caso_id: casoId,
  });

  if (error) {
    return { sucesso: false, mensagem: error.message };
  }
  return data;
}
