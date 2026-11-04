export type KycTipo = 'sindico' | 'prestador';

export type KycStatus = 
  | 'rascunho' 
  | 'enviado' 
  | 'verificando' 
  | 'pendencia' 
  | 'revisao_manual' 
  | 'aprovado' 
  | 'reprovado' 
  | 'suspenso' 
  | 'expirado' 
  | 'legado';

export type KycNivel = 0 | 1 | 2;

export type KycDocumentoTipo = 
  | 'identidade_frente' 
  | 'identidade_verso' 
  | 'selfie' 
  | 'cartao_cnpj' 
  | 'ata_assembleia' 
  | 'contrato_social' 
  | 'procuracao' 
  | 'comprovante_seguro' 
  | 'certificado_nr' 
  | 'comprovante_consulta_cnpj' 
  | 'outro';

export type KycDocumentoStatus = 'recebido' | 'legivel' | 'ilegivel' | 'aceito' | 'rejeitado';

export interface KycDocumento {
  id: string;
  caso_id: string;
  tipo: KycDocumentoTipo;
  storage_path: string;
  nome_original_seguro: string;
  mime: string;
  tamanho_bytes: number;
  sha256: string;
  versao: number;
  substituido_por?: string | null;
  status: KycDocumentoStatus;
  validade_ate?: string | null;
  extracao?: Record<string, unknown>;
  scan_status: 'pendente' | 'limpo' | 'suspeito';
  enviado_em: string;
}

export interface KycPendencia {
  codigo?: string;
  documento_id?: string;
  motivo?: string;
  detalhe?: string;
  mensagem_ao_usuario?: string;
}

export interface DocumentoLegal {
  codigo: string;
  versao: number;
  titulo: string;
  texto_md: string;
  sha256_texto: string;
  vigente_desde: string;
  ativo: boolean;
  juridico_aprovado: boolean;
}

export interface AceiteLegal {
  id: string;
  usuario_id: string;
  caso_id: string;
  documento_codigo: string;
  versao: number;
  sha256_texto: string;
  aceito_em: string;
  confirmacao_otp: boolean;
  otp_canal: 'email' | 'sms';
  pdf_path: string;
  pdf_sha256: string;
  codigo_verificacao: string;
}

export interface KycMeuCasoResponse {
  autenticado: boolean;
  tem_caso?: boolean;
  caso_id?: string;
  tipo?: KycTipo;
  status?: KycStatus;
  nivel?: KycNivel;
  etapa_atual?: string;
  pendencias?: KycPendencia[];
  mensagem_ao_usuario?: string | null;
  enviado_em?: string | null;
  prazo_texto?: string;
  contato_suporte?: string;
  resumo?: string;
  poll_status_seg?: number;
  gate_ativo?: boolean;
  bloqueado?: boolean;
  motivo_bloqueio?: string | null;
  validade_ate?: string | null;
  sugestao_nivel?: KycNivel;
  sugestao_motivos?: string[];
  condominio?: {
    id: string;
    nome: string;
    cnpj: string;
  } | null;
  documentos?: Array<{
    id: string;
    tipo: KycDocumentoTipo;
    versao: number;
    status: KycDocumentoStatus;
    validade_ate?: string | null;
    storage_path: string;
  }>;
  email?: string;
}
