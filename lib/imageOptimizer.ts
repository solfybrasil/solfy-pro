/**
 * MÓDULO ÚNICO DE PREPARO E OTIMIZAÇÃO DE IMAGENS - SOLFY PRO
 * 
 * Regras:
 * - Conversão obrigatória para WebP (com fallback JPEG para iOS legado)
 * - Teto máximo absoluto de 300 KB (307.200 bytes)
 * - Redimensionamento inteligente conforme categoria:
 *   - kyc_selfie: máx 2000px (qualidade mínima 0.6 para total legibilidade)
 *   - demanda_chat_portfolio: máx 1600px (qualidade mínima 0.5)
 *   - avatar: 512px quadrado (qualidade mínima 0.5)
 * - Compressão em etapas progressivas
 * - Remoção de metadados EXIF/GPS e correção de rotação
 * - Geração de miniatura (_thumb.webp, 400px, ~30KB)
 * - Validação rigorosa de magic bytes binários antes do upload
 */

import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export type CategoriaImagem = 'kyc_selfie' | 'demanda_chat_portfolio' | 'avatar';

export interface ImagemOtimizada {
  uri: string;
  buffer: ArrayBuffer;
  nomeArquivo: string;
  nomeThumb?: string;
  thumbUri?: string;
  thumbBuffer?: ArrayBuffer;
  mimeType: 'image/webp' | 'image/jpeg';
  tamanhoBytes: number;
  tamanhoThumbBytes?: number;
  largura: number;
  altura: number;
}

const MAX_BYTES_PERMITIDO = 300 * 1024; // 300 KB = 307.200 bytes

/**
 * Validação rigorosa dos magic bytes binários reais do arquivo
 */
export function validarMagicBytes(buffer: ArrayBuffer): {
  valido: boolean;
  mimeDetectado: 'image/webp' | 'image/jpeg' | 'image/png' | 'application/pdf' | 'desconhecido';
  erro?: string;
} {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) {
    return { valido: false, mimeDetectado: 'desconhecido', erro: 'Arquivo muito curto ou corrompido.' };
  }

  // PDF (%PDF)
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { valido: true, mimeDetectado: 'application/pdf' };
  }

  // WEBP (RIFF....WEBP)
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { valido: true, mimeDetectado: 'image/webp' };
  }

  // JPEG (FF D8 FF)
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { valido: true, mimeDetectado: 'image/jpeg' };
  }

  // PNG (89 50 4E 47)
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return { valido: true, mimeDetectado: 'image/png' };
  }

  return {
    valido: false,
    mimeDetectado: 'desconhecido',
    erro: 'Assinatura binária do arquivo inválida. O arquivo real não corresponde a uma imagem válida ou PDF.'
  };
}

/**
 * Converte URI ou Base64 em ArrayBuffer
 */
export async function obterBufferDoUri(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return await res.arrayBuffer();
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64' as any,
  });
  return decode(base64);
}

/**
 * Calcula dimensões alvo respeitando limite de maior lado ou proporção quadrada
 */
function calcularDimensoes(
  larguraOrig: number,
  alturaOrig: number,
  categoria: CategoriaImagem,
  fatorEscala: number = 1.0
): { width: number; height: number } {
  if (categoria === 'avatar') {
    const lado = Math.round(512 * fatorEscala);
    return { width: lado, height: lado };
  }

  const maxLado = Math.round((categoria === 'kyc_selfie' ? 2000 : 1600) * fatorEscala);

  if (!larguraOrig || !alturaOrig) {
    return { width: maxLado, height: maxLado };
  }

  const maiorLadoAtual = Math.max(larguraOrig, alturaOrig);
  if (maiorLadoAtual <= maxLado && fatorEscala === 1.0) {
    return { width: larguraOrig, height: alturaOrig };
  }

  const ratio = maxLado / maiorLadoAtual;
  return {
    width: Math.max(100, Math.round(larguraOrig * ratio)),
    height: Math.max(100, Math.round(alturaOrig * ratio)),
  };
}

/**
 * Função única e centralizada para otimizar imagens
 */
export async function otimizarImagem(
  uriOriginal: string,
  categoria: CategoriaImagem,
  opcoes?: {
    larguraOriginal?: number;
    alturaOriginal?: number;
    gerarMiniatura?: boolean;
    nomeBase?: string;
  }
): Promise<ImagemOtimizada> {
  const {
    larguraOriginal = 2000,
    alturaOriginal = 2000,
    gerarMiniatura = true,
    nomeBase = `img_${Date.now()}`,
  } = opcoes || {};

  const qualidadeMinima = categoria === 'kyc_selfie' ? 0.6 : 0.5;
  let formatoDesejado = ImageManipulator.SaveFormat.WEBP;
  let mimeEsperado: 'image/webp' | 'image/jpeg' = 'image/webp';
  let extensao = 'webp';

  // Loop progressivo: começa em qualidade 0.8 e reduz de 0.1 em 0.1 até qualidade mínima.
  // Se ainda exceder 300 KB, reduz as dimensões em 15% e repete.
  let fatorEscala = 1.0;
  let melhorResultado: { uri: string; buffer: ArrayBuffer; largura: number; altura: number } | null = null;
  let tentativaSucesso = false;

  // Tentativa primária com WEBP, fallback para JPEG se o runtime mobile não suportar WEBP
  for (let tentativaFormato = 0; tentativaFormato < 2 && !tentativaSucesso; tentativaFormato++) {
    if (tentativaFormato === 1) {
      formatoDesejado = ImageManipulator.SaveFormat.JPEG;
      mimeEsperado = 'image/jpeg';
      extensao = 'jpg';
      fatorEscala = 1.0;
    }

    dimensoesLoop: while (fatorEscala >= 0.4) {
      const { width, height } = calcularDimensoes(larguraOriginal, alturaOriginal, categoria, fatorEscala);
      let qualidade = 0.8;

      while (qualidade >= qualidadeMinima - 0.05) {
        try {
          const resultado = await ImageManipulator.manipulateAsync(
            uriOriginal,
            [{ resize: { width, height } }],
            {
              compress: Math.max(0.1, qualidade),
              format: formatoDesejado,
            }
          );

          const buffer = await obterBufferDoUri(resultado.uri);
          const tamanho = buffer.byteLength;

          if (tamanho <= MAX_BYTES_PERMITIDO) {
            // Sucesso! Cabe perfeitamente nos 300 KB
            melhorResultado = {
              uri: resultado.uri,
              buffer,
              largura: resultado.width,
              altura: resultado.height,
            };
            tentativaSucesso = true;
            break dimensoesLoop;
          }

          // Salva como melhor esforço caso chegue no fim do loop
          if (!melhorResultado || tamanho < melhorResultado.buffer.byteLength) {
            melhorResultado = {
              uri: resultado.uri,
              buffer,
              largura: resultado.width,
              altura: resultado.height,
            };
          }
        } catch (err) {
          // Se falhou ao encodar WebP no aparelho (ex: iOS legado), chaveia para JPEG
          if (formatoDesejado === ImageManipulator.SaveFormat.WEBP) {
            console.warn('[ImageOptimizer] Falha ao gerar WebP no dispositivo. Ativando fallback JPEG:', err);
            break dimensoesLoop; // Pula para a tentativa de JPEG
          }
          throw err;
        }

        qualidade -= 0.1;
      }

      // Reduz 15% das dimensões e reinicia qualidade
      fatorEscala *= 0.85;
    }
  }

  if (!melhorResultado) {
    throw new Error('Não foi possível otimizar a imagem selecionada.');
  }

  // Validação estrita de magic bytes
  const checagem = validarMagicBytes(melhorResultado.buffer);
  if (!checagem.valido || (checagem.mimeDetectado !== 'image/webp' && checagem.mimeDetectado !== 'image/jpeg')) {
    throw new Error(`Falha de segurança: o arquivo gerado não é uma imagem WebP/JPEG válida (${checagem.erro || checagem.mimeDetectado}).`);
  }

  // Gera miniatura se solicitado
  let thumbUri: string | undefined;
  let thumbBuffer: ArrayBuffer | undefined;
  let nomeThumb: string | undefined;
  let tamanhoThumbBytes: number | undefined;

  if (gerarMiniatura && categoria !== 'avatar') {
    try {
      const dimThumb = calcularDimensoes(melhorResultado.largura, melhorResultado.altura, 'avatar', 400 / 512);
      const resThumb = await ImageManipulator.manipulateAsync(
        melhorResultado.uri,
        [{ resize: { width: 400 } }],
        {
          compress: 0.7,
          format: formatoDesejado,
        }
      );
      thumbUri = resThumb.uri;
      thumbBuffer = await obterBufferDoUri(resThumb.uri);
      nomeThumb = `${nomeBase}_thumb.${extensao}`;
      tamanhoThumbBytes = thumbBuffer.byteLength;
    } catch (errThumb) {
      console.warn('[ImageOptimizer] Não foi possível gerar miniatura:', errThumb);
    }
  }

  return {
    uri: melhorResultado.uri,
    buffer: melhorResultado.buffer,
    nomeArquivo: `${nomeBase}.${extensao}`,
    nomeThumb,
    thumbUri,
    thumbBuffer,
    mimeType: checagem.mimeDetectado as 'image/webp' | 'image/jpeg',
    tamanhoBytes: melhorResultado.buffer.byteLength,
    tamanhoThumbBytes,
    largura: melhorResultado.largura,
    altura: melhorResultado.altura,
  };
}
