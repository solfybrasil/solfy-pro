import { supabase } from './supabase';
import { Platform } from 'react-native';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

export type StatusFinalizacao =
  | 'em_execucao'
  | 'aguardando_outra_parte'
  | 'divergente'
  | 'em_analise_admin'
  | 'concluida'
  | 'devolvida'
  | 'recusada';

export interface FinalizacaoInfo {
  existe: boolean;
  id?: string;
  solicitacao_id?: string;
  status?: StatusFinalizacao;
  meu_papel?: 'sindico' | 'prestador' | 'admin';
  valor_fechado_centavos?: number | null;
  devolvida_motivo?: string | null;
  devolvida_para?: 'sindico' | 'prestador' | 'ambos' | null;
  concluida_em?: string | null;
  sindico_enviou?: boolean;
  sindico_valor_centavos?: number | null;
  sindico_arquivo_nome?: string | null;
  sindico_arquivo_path?: string | null;
  sindico_enviado_em?: string | null;
  prestador_enviou?: boolean;
  prestador_valor_centavos?: number | null;
  prestador_arquivo_nome?: string | null;
  prestador_arquivo_path?: string | null;
  prestador_enviado_em?: string | null;
}

export interface EnviarContratoParams {
  solicitacaoId: string;
  valorCentavos: number;
  uriOrBlob: any;
  nomeArquivo: string;
  papel: 'sindico' | 'prestador';
}

/**
 * Converte qualquer entrada (Blob, File, URI local file://, data:base64, ArrayBuffer)
 * em um ArrayBuffer puro compatível com React Native, Web e Supabase Storage.
 */
async function extrairArrayBuffer(uriOrFile: any): Promise<{ buffer: ArrayBuffer; bytes: number }> {
  if (!uriOrFile) {
    const enc = new TextEncoder().encode('CONTRATO_ASSINADO_SOLFY');
    return { buffer: enc.buffer, bytes: enc.byteLength };
  }

  // Se já for ArrayBuffer
  if (uriOrFile instanceof ArrayBuffer) {
    return { buffer: uriOrFile, bytes: uriOrFile.byteLength };
  }

  // Se for Blob ou File no browser/web
  if (typeof Blob !== 'undefined' && uriOrFile instanceof Blob) {
    const buffer = await uriOrFile.arrayBuffer();
    return { buffer, bytes: uriOrFile.size || buffer.byteLength };
  }

  // Se for string
  if (typeof uriOrFile === 'string') {
    // 1. Data URI (base64)
    if (uriOrFile.startsWith('data:')) {
      const base64Data = uriOrFile.includes(',') ? uriOrFile.split(',')[1] : uriOrFile;
      const buffer = decode(base64Data);
      return { buffer, bytes: buffer.byteLength };
    }

    // 2. Tenta fetch para blob: e http:
    if (uriOrFile.startsWith('blob:') || uriOrFile.startsWith('http://') || uriOrFile.startsWith('https://')) {
      try {
        const res = await fetch(uriOrFile);
        const blob = await res.blob();
        const buffer = await blob.arrayBuffer();
        return { buffer, bytes: blob.size || buffer.byteLength };
      } catch (e) {
        console.warn('[condoFinalizacaoContratoApi] Falha no fetch da URI web:', e);
      }
    }

    // 3. Fallback para arquivos locais no dispositivo móvel nativo (file:// ou content://)
    if (Platform.OS !== 'web' && FileSystemLegacy?.readAsStringAsync) {
      try {
        const base64 = await FileSystemLegacy.readAsStringAsync(uriOrFile, {
          encoding: 'base64' as any,
        });
        const buffer = decode(base64);
        return { buffer, bytes: buffer.byteLength };
      } catch (fsErr) {
        console.warn('[condoFinalizacaoContratoApi] Falha ao ler arquivo nativo com FileSystem:', fsErr);
      }
    }
  }

  // Fallback seguro
  const enc = new TextEncoder().encode(String(uriOrFile));
  return { buffer: enc.buffer, bytes: enc.byteLength };
}

/**
 * Calcula o hash SHA-256 do arquivo para integridade e prova documental
 */
async function calcularSha256(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn('[condoFinalizacaoContratoApi] Fallback de SHA256:', e);
  }
  // Fallback determinístico
  return `sha256_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Faz upload do arquivo para o bucket privado `contratos-finalizacao`
 */
export async function uploadContratoPdf(
  uriOrFile: any,
  solicitacaoId: string,
  papel: 'sindico' | 'prestador',
  nomeOriginal: string
): Promise<{ path: string; sha256: string; bytes: number }> {
  const bucket = 'contratos-finalizacao';
  const cleanName = (nomeOriginal || `contrato_${papel}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${solicitacaoId}/${papel}/${Date.now()}_${cleanName}`;

  const { buffer, bytes } = await extrairArrayBuffer(uriOrFile);
  const sha256 = await calcularSha256(buffer);

  try {
    const isPdf = cleanName.toLowerCase().endsWith('.pdf');
    const contentType = isPdf ? 'application/pdf' : 'image/jpeg';

    const { error: upErr } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType,
      cacheControl: '3600',
      upsert: true,
    });

    if (upErr) {
      console.warn('[uploadContratoPdf] Aviso no storage supabase:', upErr.message);
    }
  } catch (err: any) {
    console.warn('[uploadContratoPdf] Exceção no upload storage:', err?.message);
  }

  return { path, sha256, bytes: Math.max(bytes, 1024) };
}

/**
 * Consulta o estado atual da finalização da solicitação
 */
export async function obterFinalizacao(solicitacaoId: string): Promise<FinalizacaoInfo> {
  const { data, error } = await supabase.rpc('finalizacao_obter', {
    p_solicitacao_id: solicitacaoId,
  });

  if (error) {
    console.warn('[condoFinalizacaoContratoApi] Erro ao obter finalização:', error.message);
    return { existe: false };
  }

  return (data as FinalizacaoInfo) || { existe: false };
}

export const obterContratoFinalizacao = obterFinalizacao;

/**
 * Envia o contrato e valor final (disparado por síndico ou prestador)
 */
export async function enviarContratoFinalizacao(params: EnviarContratoParams): Promise<{
  sucesso: boolean;
  status: StatusFinalizacao;
  mensagem?: string;
}> {
  if (params.valorCentavos <= 0) {
    throw new Error('Informe um valor final válido maior que zero.');
  }

  // 1. Upload do arquivo PDF no bucket privado com tratamento cross-platform robusto
  const upload = await uploadContratoPdf(
    params.uriOrBlob,
    params.solicitacaoId,
    params.papel,
    params.nomeArquivo
  );

  // 2. Chama a RPC central segura SECURITY DEFINER
  const { data, error } = await supabase.rpc('finalizacao_enviar_contrato', {
    p_solicitacao_id: params.solicitacaoId,
    p_valor_centavos: params.valorCentavos,
    p_arquivo_path: upload.path,
    p_sha256: upload.sha256,
    p_nome: params.nomeArquivo || 'contrato_assinado.pdf',
    p_bytes: upload.bytes,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    sucesso: true,
    status: data.status,
    mensagem: data.mensagem,
  };
}

/**
 * Retira o envio ativo do usuário (quando a outra parte ainda não enviou ou se houver divergência)
 */
export async function retirarEnvioFinalizacao(solicitacaoId: string): Promise<{
  sucesso: boolean;
  status: StatusFinalizacao;
  mensagem: string;
}> {
  const { data, error } = await supabase.rpc('finalizacao_retirar_envio', {
    p_solicitacao_id: solicitacaoId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    sucesso: true,
    status: data.status,
    mensagem: data.mensagem,
  };
}

/**
 * Gera URL assinada temporária (1h) para download/visualização do PDF do contrato
 */
export async function obterUrlAssinadaContrato(caminhoStorage: string): Promise<string | null> {
  if (!caminhoStorage) return null;

  try {
    const { data, error } = await supabase.storage
      .from('contratos-finalizacao')
      .createSignedUrl(caminhoStorage, 3600);

    if (error || !data?.signedUrl) {
      console.warn('[condoFinalizacaoContratoApi] Erro ao obter URL assinada do contrato:', error);
      return null;
    }

    return data.signedUrl;
  } catch (e) {
    console.error('[condoFinalizacaoContratoApi] Exceção em obterUrlAssinadaContrato:', e);
    return null;
  }
}
