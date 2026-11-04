// ─── Types: Solfy Condo Mobile ───────────────────────────────────────────
// Tipos TypeScript para o app nativo do Síndico (Solfy Condo)

export type PapelCondominio =
  | 'sindico'
  | 'subsindico'
  | 'conselho'
  | 'zelador'
  | 'morador'
  | 'administradora_terceirizada';

export type TipoConta =
  | 'sindico_profissional'
  | 'morador'
  | 'prestador'
  | 'admin_solfy';

export type PlanoCondominio = 'piloto' | 'basico' | 'completo';

export interface EnderecoCondominio {
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

export interface Condominio {
  id: string;
  cnpj: string;
  nome: string;
  endereco: EnderecoCondominio;
  plano: PlanoCondominio;
  criado_em: string;
  ativo: boolean;
  status_aprovacao?: 'aprovado' | 'pendente_analise' | 'rejeitado';
  solicitado_por?: string | null;
  data_solicitacao?: string | null;
}

export type StatusAprovacaoSindico = 'pendente_onboarding' | 'em_analise' | 'aprovado' | 'rejeitado';

export type TipoDocumentoKYC =
  | 'identidade_frente'
  | 'identidade_verso'
  | 'identidade_completa'
  | 'contrato_social'
  | 'cartao_cnpj'
  | 'comprovante_endereco'
  | 'ata_assembleia'
  | 'contrato_administradora'
  | 'cnpj_cartao';

export type StatusDocumentoKYC = 'pendente' | 'em_analise' | 'aprovado' | 'rejeitado';

export interface SindicoDocumentoVerificacao {
  id: string;
  user_id: string;
  tipo_documento: TipoDocumentoKYC;
  arquivo_url: string;
  status: StatusDocumentoKYC;
  motivo_rejeicao?: string | null;
  analisado_por?: string | null;
  enviado_em: string;
  analisado_em?: string | null;
}

export interface Perfil {
  user_id: string;
  nome_completo: string | null;
  telefone: string | null;
  foto_url: string | null;
  tipo_conta: TipoConta | null;
  status_aprovacao?: StatusAprovacaoSindico;
  motivo_rejeicao?: string | null;
  telefone_verificado?: boolean;
  tipo_pessoa?: 'pf' | 'pj' | null;
  documento_numero?: string | null;
  data_submissao_analise?: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface MembroCondominio {
  id: string;
  user_id: string;
  condominio_id: string;
  papel: PapelCondominio;
  alcada_aprovacao: number | null;
  ativo: boolean;
  convidado_por: string | null;
  criado_em: string;
  nome_completo?: string | null;
  email?: string | null;
  perfil?: Perfil | null;
}

export type StatusSolicitacao =
  | 'rascunho'
  | 'aberta'
  | 'cotando'
  | 'aguardando_aprovacao'
  | 'aprovada'
  | 'em_execucao'
  | 'concluida'
  | 'cancelada';

export type UrgenciaSolicitacao = 'baixa' | 'normal' | 'alta' | 'urgente';

export interface Prestador {
  id: string;
  user_id?: string;
  name: string;
  phone?: string;
  service_type?: string;
  rating?: number;
  completed_requests?: number;
  foto_perfil_url?: string;
  foto_capa_url?: string;
  nivel?: string;
  bio_apresentacao?: string;
  razao_social?: string;
  nome_fantasia?: string;
  status_cadastro?: string;
  categorias_atendidas?: string[];
  regioes_atendimento?: string[];
  raio_atendimento_km?: number;
  apto_servicos_grandes?: boolean;
  solfcoins_saldo?: number;
  selo_verificado?: boolean;
  total_servicos_concluidos?: number;
  nota_media?: number;
  total_avaliacoes?: number;
}

export interface Cotacao {
  id: string;
  solicitacao_id: string;
  prestador_id: string;
  valor: number;
  prazo_execucao_dias: number;
  observacoes?: string | null;
  selecionada: boolean;
  criado_em: string;
  prestador?: Prestador | null;
}

export interface Solicitacao {
  id: string;
  condominio_id: string;
  solicitado_por: string;
  categoria: string;
  descricao: string;
  fotos_urls?: string[];
  valor_estimado?: number | null;
  status: StatusSolicitacao;
  urgencia: UrgenciaSolicitacao;
  titulo?: string;
  local_especifico?: string | null;
  prazo_desejado?: string | null;
  janela_horario_preferida?: string | null;
  acesso_observacoes?: string | null;
  forma_pagamento_prevista?: string | null;
  cotacoes_recebidas_count?: number;
  max_cotacoes?: number;
  criado_em: string;
  atualizado_em: string;
  cotacoes?: Cotacao[];
  condominio?: Condominio;
}

export type FormaPagamentoPrevista = 'avista' | 'parcelado_etapas' | 'a_combinar' | 'pix' | 'boleto_30_dias' | 'cartao_credito' | 'medicao_quinzenal';
export type VisibilidadeCotacao = 'aberta_todos_habilitados' | 'apenas_preferenciais' | 'convite_direto' | 'prestadores_favoritos';
export type TipoCampoDinamico = 'texto' | 'numero' | 'select' | 'multiselect' | 'data' | 'boolean';

export interface CategoriaMestre {
  id: string;
  chave: string;
  label: string;
  icone?: string | null;
  descricao_curta?: string | null;
  cor_tema?: string | null;
  ativa: boolean;
  ordem_exibicao: number;
  versao_formulario: number;
}

export interface CategoriaCampoDinamico {
  id?: string;
  categoria: string;
  categoria_id?: string;
  campo_chave: string;
  campo_label: string;
  tipo_campo: TipoCampoDinamico;
  opcoes: string[] | null;
  obrigatorio: boolean;
  ordem_exibicao: number;
  exige_foto: boolean;
  placeholder?: string | null;
  texto_ajuda?: string | null;
  validacao?: { min?: number; max?: number; regex?: string } | null;
  depende_de_campo?: string | null;
  depende_de_valor?: any;
  grupo_visual?: string | null;
}

export interface SolicitacaoAnexo {
  id?: string;
  solicitacao_id?: string;
  tipo_arquivo: 'foto' | 'video' | 'documento';
  arquivo_url: string;
  descricao?: string;
}

export interface SolicitacaoRespostaDinamica {
  id?: string;
  solicitacao_id: string;
  campo_chave: string;
  valor: string;
}

export interface CriarSolicitacaoInput {
  condominio_id: string;
  titulo?: string;
  categoria: string;
  descricao: string;
  fotos_urls?: string[];
  valor_estimado?: number | null;
  urgencia: UrgenciaSolicitacao;
  local_especifico?: string;
  prazo_desejado?: string | null;
  janela_horario_preferida?: string | null;
  visita_janela_data_inicio?: string | null;
  visita_janela_data_fim?: string | null;
  visita_janela_horario_inicio?: string | null;
  visita_janela_horario_fim?: string | null;
  acesso_observacoes?: string | null;
  forma_pagamento_prevista?: FormaPagamentoPrevista;
  visibilidade_cotacao?: VisibilidadeCotacao;
  numero_cotacoes_desejado?: number;
  status?: StatusSolicitacao | 'aberta' | 'rascunho';
  respostas_dinamicas?: Record<string, any>;
  anexos?: SolicitacaoAnexo[];
  prestadores_convite?: string[];
}

export interface Aprovacao {
  id: string;
  solicitacao_id: string;
  aprovador_id: string;
  decisao: 'aprovado' | 'rejeitado';
  assinatura_digital: string;
  comentario?: string | null;
  criado_em: string;
}

export interface RegistrarAprovacaoInput {
  solicitacao_id: string;
  decisao: 'aprovado' | 'rejeitado';
  comentario?: string;
}

export interface AvisoMural {
  id: string;
  condominio_id: string;
  titulo: string;
  conteudo: string;
  origem: 'manual' | 'automatica';
  solicitacao_id?: string | null;
  publicado_por?: string | null;
  criado_em: string;
  autor?: {
    user_id: string;
    nome_completo?: string | null;
    foto_url?: string | null;
  } | null;
}

export interface Notificacao {
  id: string;
  user_id: string;
  condominio_id: string;
  titulo: string;
  mensagem: string;
  tipo?: string;
  lida: boolean;
  criado_em: string;
  link?: string;
}

export interface ChatMensagem {
  id: string;
  conversa_id: string;
  remetente_id: string;
  conteudo: string;
  tipo: 'texto' | 'imagem' | 'arquivo' | 'sistema';
  lida: boolean;
  criado_em: string;
  remetente?: {
    nome_completo?: string | null;
    foto_url?: string | null;
  } | null;
}

export interface ChatConversa {
  id: string;
  condominio_id: string;
  solicitacao_id?: string | null;
  tipo_conversa?: string;
  nome_grupo?: string | null;
  participante_nome?: string | null;
  cargo_ou_funcao?: string | null;
  foto_url?: string | null;
  ultima_mensagem_texto?: string | null;
  ultima_mensagem_em?: string | null;
  criado_em: string;
  solicitacao?: {
    id: string;
    titulo?: string;
    categoria?: string;
    status?: string;
  } | null;
}

// ─── Dicionários de Estilo e Textos ──────────────────────────────────────────

export const STATUS_SOLICITACAO_LABELS: Record<StatusSolicitacao, string> = {
  rascunho: 'Rascunho',
  aberta: 'Aberta',
  cotando: 'Em Cotação',
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovada: 'Aprovada',
  em_execucao: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const STATUS_SOLICITACAO_COLORS: Record<StatusSolicitacao, { bg: string; text: string; border: string }> = {
  rascunho: { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' },
  aberta: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  cotando: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  aguardando_aprovacao: { bg: '#FAF5FF', text: '#9333EA', border: '#E9D5FF' },
  aprovada: { bg: '#EDF4EE', text: '#1E3E25', border: '#D8E6DA' },
  em_execucao: { bg: '#F0FDF4', text: '#2E5A36', border: '#D8E6DA' },
  concluida: { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
  cancelada: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
};

export const URGENCIA_LABELS: Record<UrgenciaSolicitacao, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta Prioridade',
  urgente: 'Emergencial',
};

export const URGENCIA_COLORS: Record<UrgenciaSolicitacao, { bg: string; text: string }> = {
  baixa: { bg: '#F1F5F9', text: '#64748B' },
  normal: { bg: '#EDF4EE', text: '#1E3E25' },
  alta: { bg: '#FFFBEB', text: '#D97706' },
  urgente: { bg: '#FEF2F2', text: '#DC2626' },
};

// ─── Configurações Gerais, Governança & KYC ──────────────────────────────────

export interface CondominioConfiguracoes {
  condominio_id: string;
  logo_url?: string | null;
  cor_tema?: string | null;
  fuso_horario: string;
  dia_fechamento_financeiro: number;
  limite_aprovacao_automatica?: number | null;
  exigir_dupla_aprovacao_acima_de?: number | null;
  permitir_morador_ver_financeiro: boolean;
  chave_pix?: string | null;
  banco_dados?: {
    banco?: string;
    agencia?: string;
    conta?: string;
    titular?: string;
  } | null;
  atualizado_em?: string;
  atualizado_por?: string | null;
}

export interface UsuarioPreferencias {
  user_id: string;
  idioma: string;
  tema_interface: 'claro' | 'escuro' | 'sistema';
  notificacoes_email: boolean;
  notificacoes_whatsapp: boolean;
  notificacoes_push: boolean;
  horario_silencioso_inicio?: string | null;
  horario_silencioso_fim?: string | null;
  resumo_diario_email: boolean;
  atualizado_em?: string;
}

export interface SlaCategoria {
  id: string;
  condominio_id?: string | null;
  categoria: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'emergencial';
  tempo_resposta_horas: number;
  tempo_solucao_horas: number;
  criado_em?: string;
  atualizado_em?: string;
}

export type TipoIntegracao =
  | 'whatsapp_business'
  | 'google_calendar'
  | 'contabilidade_externa'
  | 'administradora_sistema';

export type StatusIntegracao = 'desconectado' | 'conectado' | 'erro';

export interface CondominioIntegracao {
  id: string;
  condominio_id: string;
  tipo_integracao: TipoIntegracao;
  status: StatusIntegracao;
  credenciais_criptografadas?: string | null;
  conectado_por?: string | null;
  conectado_em?: string | null;
  atualizado_em?: string;
}

export interface CondominioPlanoAssinatura {
  condominio_id: string;
  plano_atual: string;
  nome_plano?: string;
  status?: string;
  data_inicio: string;
  data_proxima_cobranca?: string | null;
  valor_mensal?: number | null;
  status_pagamento: 'em_dia' | 'atrasado' | 'isento_piloto';
  limite_condominios_incluidos?: number | null;
  atualizado_em?: string;
}

export interface SessaoAtiva {
  id: string;
  user_id: string;
  dispositivo_info?: string;
  dispositivo?: string;
  navegador?: string;
  sistema_operacional?: string;
  ip?: string;
  ip_aproximado?: string;
  localizacao_aproximada?: string | null;
  criado_em: string;
  ultima_atividade: string;
  revogada?: boolean;
  atual?: boolean;
}

export interface SolicitacaoExportacaoDados {
  id: string;
  user_id: string;
  tipo: 'exportar_meus_dados' | 'excluir_conta';
  status: 'solicitado' | 'processando' | 'concluido' | 'bloqueado';
  arquivo_url?: string | null;
  detalhes?: string | null;
  solicitado_em: string;
  concluido_em?: string | null;
}

export interface SindicoDadosPessoais {
  user_id: string;
  cpf?: string | null;
  rg?: string | null;
  data_nascimento?: string | null;
  telefone_secundario?: string | null;
  registro_profissional?: string | null; // CRECI / CRA
  biografia?: string | null;
  atualizado_em?: string;
}

export interface SindicoMandato {
  id: string;
  condominio_id: string;
  sindico_id: string;
  data_inicio_mandato: string;
  data_fim_mandato: string;
  status_mandato: 'vigente' | 'vencido' | 'renovado' | 'revogado';
  documento_nomeacao_url?: string | null;
  numero_ata_eleicao?: string | null;
  observacoes?: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface NivelVerificacaoInfo {
  nivel: number; // 1: Básico, 2: Bronze, 3: Prata, 4: Ouro, 5: Diamante
  label: string;
  cor: string;
  selo_url?: string | null;
  pendenciasProximoNivel?: string[];
}

export type { AgendaCompromissoItem } from '../lib/condoAgendaApi';

export type StatusContratoFinalizacao =
  | 'aguardando_envios'
  | 'aguardando_analise'
  | 'aprovado'
  | 'divergente'
  | 'cancelado';

export interface ContratoFinalizacao {
  id: string;
  solicitacao_id: string;
  cotacao_id?: string | null;
  prestador_id: string;
  sindico_user_id?: string | null;
  valor_declarado_sindico?: number | null;
  contrato_url_sindico?: string | null;
  enviado_em_sindico?: string | null;
  observacoes_sindico?: string | null;
  valor_declarado_prestador?: number | null;
  contrato_url_prestador?: string | null;
  enviado_em_prestador?: string | null;
  observacoes_prestador?: string | null;
  status: StatusContratoFinalizacao;
  observacoes_divergencia?: string | null;
  auditado_por?: string | null;
  auditado_em?: string | null;
  criado_em: string;
  atualizado_em: string;
  solicitacao?: Solicitacao | null;
  prestador?: Prestador | null;
}

export type StatusOrdemPagamentoComissao =
  | 'pendente'
  | 'comprovante_enviado'
  | 'pago'
  | 'em_atraso'
  | 'cobranca_juridica'
  | 'cancelada';

export interface OrdemPagamentoComissao {
  id: string;
  numero_op: string;
  contrato_finalizacao_id: string;
  solicitacao_id: string;
  prestador_id: string;
  valor_base_contrato: number;
  valor_comissao: number;
  data_vencimento?: string;
  chave_pix?: string | null;
  comprovante_url?: string | null;
  comprovante_enviado_em?: string | null;
  pago_em?: string | null;
  status: StatusOrdemPagamentoComissao;
  criado_em: string;
  atualizado_em: string;
  solicitacao?: {
    id: string;
    titulo: string;
    categoria: string;
    condominio?: {
      nome: string;
    };
  };
}

export type NivelPrestador = 'bronze' | 'prata' | 'ouro' | 'diamante';
export type StatusCadastroPrestador = 'incompleto' | 'em_analise' | 'aprovado' | 'pendente' | 'bloqueado' | 'rejeitado';
export type TipoPessoaPrestador = 'pf' | 'pj';
export type TipoDocumentoPrestador =
  | 'cnh'
  | 'rg'
  | 'rg_cpf'
  | 'doc_frente'
  | 'doc_verso'
  | 'selfie_documento'
  | 'selfie_verificacao'
  | 'comprovante_residencia'
  | 'comprovante_endereco'
  | 'cnpj_cartao'
  | 'seguro_responsabilidade_civil'
  | 'certificado_tecnico'
  | 'antecedentes_criminais'
  | 'certidao_negativa'
  | 'ccmei_contrato_social'
  | 'outros';
export type StatusDocumentoPrestador = 'pendente' | 'aprovado' | 'rejeitado' | 'em_analise';

export interface PrestadorPerfilPro {
  id: string;
  user_id?: string | null;
  name: string;
  service_type: string;
  phone?: string;
  rating?: number;
  completed_requests?: number;
  created_at?: string;
  categorias_atendidas: string[];
  regioes_atendimento: string[];
  raio_atendimento_km: number;
  nivel: NivelPrestador;
  solfcoins_saldo: number;
  apto_servicos_grandes: boolean;
  status_cadastro: StatusCadastroPrestador;
  foto_perfil_url?: string | null;
  foto_capa_url?: string | null;
  bio_apresentacao?: string | null;
  total_servicos_concluidos?: number;
  nome_fantasia?: string | null;
  documento_fiscal?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
}

export interface PrestadorPessoaJuridica {
  prestador_id: string;
  tipo_pessoa: TipoPessoaPrestador;
  cpf?: string | null;
  cnpj?: string | null;
  razao_social?: string | null;
  possui_mei: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

export interface PrestadorDocumento {
  id: string;
  prestador_id: string;
  tipo_documento: TipoDocumentoPrestador;
  arquivo_url: string;
  status: StatusDocumentoPrestador;
  motivo_rejeicao?: string | null;
  analisado_por?: string | null;
  enviado_em: string;
  atualizado_em?: string;
}

export interface PrestadorDisponibilidade {
  id?: string;
  prestador_id: string;
  dia_semana: number; // 0=domingo, 6=sábado
  horario_inicio: string; // HH:mm:ss
  horario_fim: string; // HH:mm:ss
  ativo: boolean;
  criado_em?: string;
}

export type StatusPagamentoPrestador = 'pendente' | 'liberado' | 'bloqueado' | 'pago';
export type StatusSaquePrestador = 'solicitado' | 'processando' | 'pago' | 'rejeitado';
export type TipoSolfcoinTransacao = 'credito' | 'debito' | 'estorno' | 'bonus';

export interface PrestadorPortfolioItem {
  id: string;
  prestador_id: string;
  foto_url: string;
  titulo?: string | null;
  descricao?: string | null;
  categoria_relacionada?: string | null;
  solicitacao_id?: string | null;
  solicitacao_titulo?: string | null;
  ordem_exibicao: number;
  criado_em?: string;
}

export interface PrestadorPerfilPublico {
  id: string;
  name: string;
  service_type: string;
  phone?: string | null;
  foto_capa_url?: string | null;
  foto_perfil_url?: string | null;
  bio_apresentacao?: string | null;
  nivel: NivelPrestador;
  categorias_atendidas: string[];
  regioes_atendimento: string[];
  total_servicos_concluidos: number;
  nota_media: number;
  total_avaliacoes: number;
}

export interface PrestadorUltimoPedido {
  solicitacao_id: string;
  prestador_id: string;
  titulo: string;
  categoria: string;
  status: string;
  criado_em: string;
  condominio_id: string;
  condominio_nome: string;
  valor: number;
  nota?: number | null;
}

export interface PrestadorAvaliacao {
  id: string;
  prestador_id: string;
  solicitacao_id?: string | null;
  avaliador_id: string;
  nota: number;
  comentario?: string | null;
  criado_em: string;
  avaliador_nome?: string;
}

export interface PrestadorFinanceiroRegistro {
  id: string;
  prestador_id: string;
  solicitacao_id?: string | null;
  valor_bruto: number;
  comissao_solfy_percentual: number;
  comissao_solfy_valor: number;
  valor_liquido: number;
  status_pagamento: StatusPagamentoPrestador;
  pago_em?: string | null;
  criado_em: string;
  solicitacao_titulo?: string;
}

export interface PrestadorSaqueSolicitacao {
  id: string;
  prestador_id: string;
  valor: number;
  chave_pix?: string | null;
  banco_info?: any;
  status: StatusSaquePrestador;
  motivo_recusa?: string | null;
  solicitado_em: string;
  processado_em?: string | null;
}

export interface SolfcoinTransacao {
  id: string;
  prestador_id: string;
  tipo: TipoSolfcoinTransacao;
  quantidade: number;
  referencia_solicitacao_id?: string | null;
  descricao?: string | null;
  criado_em: string;
}

export interface NivelRegra {
  nivel: NivelPrestador;
  servicos_minimos_concluidos: number;
  nota_media_minima: number;
  taxa_cancelamento_maxima: number;
  beneficios: {
    comissao_solfy: number;
    badge: string;
    prioridade_matching: number;
    destaque?: boolean;
    atendimento_vip?: boolean;
    [key: string]: any;
  };
}

export interface PrestadorTermoAceite {
  id: string;
  user_id: string;
  prestador_id?: string | null;
  versao_termo: string;
  texto_integral: string;
  tipo_porte: string;
  aparelho?: string | null;
  ip_origem?: string | null;
  aceito_em: string;
}

