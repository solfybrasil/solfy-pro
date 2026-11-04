// ─── TYPES: Comparador de Cotações Lado a Lado (Solfy Condo) ────────────────

export type BadgeCotacao =
  | 'menor_preco'
  | 'menor_prazo'
  | 'maior_garantia'
  | 'melhor_avaliacao'
  | 'menor_mao_de_obra'
  | 'menor_material';

export type MotivoAprovacaoCodigo =
  | 'menor_preco'
  | 'menor_prazo'
  | 'melhor_avaliacao'
  | 'maior_garantia'
  | 'outro';

export type StatusCotacao =
  | 'enviada'
  | 'substituida'
  | 'aprovada'
  | 'recusada'
  | 'expirada'
  | 'retirada';

export type TipoItemCotacao = 'mao_de_obra' | 'material' | 'deslocamento' | 'outros';

export type UnidadeItemCotacao = 'un' | 'm' | 'm2' | 'm3' | 'kg' | 'l' | 'h' | 'dia' | 'cj' | 'vb';

export type MaterialFornecidoPor = 'prestador' | 'condominio' | 'nao_se_aplica';

export type ComposicaoCotacao = 'detalhada' | 'valor_unico';

export type AlertaEquivalencia =
  | 'material_ausente_em_algumas'
  | 'mistura_valor_unico_e_detalhada'
  | 'material_por_conta_do_condominio';

export interface CotacaoItemDetalhado {
  id?: string;
  cotacao_id?: string;
  ordem: number;
  tipo: TipoItemCotacao;
  descricao: string;
  marca_modelo?: string | null;
  quantidade: number;
  unidade: UnidadeItemCotacao;
  valor_unitario_centavos: number;
  total_centavos: number;
}

export interface EscopoItem {
  titulo: string;
  incluso: boolean;
}

export interface AnexoCotacao {
  nome: string;
  url: string;
  tipo?: string;
  tamanho_bytes?: number;
}

export interface CotacaoComparadorItem {
  id: string;
  prestador_id: string;
  nome_exibicao: string;
  foto_perfil_url?: string | null;
  service_type?: string;
  selo_verificado: boolean;
  nota_media: number;
  qtd_avaliacoes: number;
  valor_total_centavos: number;
  composicao: ComposicaoCotacao;
  material_fornecido_por: MaterialFornecidoPor;
  subtotal_mao_de_obra_centavos: number;
  subtotal_material_centavos: number;
  subtotal_outros_centavos: number;
  prazo_execucao_dias: number | null;
  inicio_previsto: string | null;
  garantia_meses: number | null;
  validade_proposta_ate: string;
  expirada: boolean;
  condicoes_pagamento: string | null;
  escopo_incluso: any;
  observacoes: string | null;
  anexos: AnexoCotacao[];
  versao: number;
  status: StatusCotacao;
  selecionada: boolean;
  foi_revisada: boolean;
  valor_anterior_centavos: number | null;
  rank_preco: number;
  rank_mao_de_obra?: number | null;
  diff_vs_menor_centavos: number;
  diff_vs_menor_pct: number;
  diff_vs_media_pct: number;
  diff_mo_vs_menor_centavos?: number | null;
  badges: BadgeCotacao[];
  itens?: CotacaoItemDetalhado[];
  alerta_preco?: AlertaPrecoCotacao | null;
}

export type NivelAlertaPrecoCamadaB =
  | 'dentro'
  | 'acima'
  | 'muito_acima'
  | 'abaixo'
  | 'muito_abaixo'
  | 'sem_base';

export type NivelAlertaPrecoCamadaA =
  | 'na_media'
  | 'acima_dos_demais'
  | 'abaixo_dos_demais';

export interface ItemContribuinteAlerta {
  descricao: string;
  unidade: string;
  quantidade: number;
  valor_unitario_centavos: number;
  p50_referencia_centavos: number;
  total_cotacao_centavos: number;
  total_esperado_centavos: number;
  desvio_pct: number;
  nivel_geo: 'cidade' | 'regiao' | 'uf';
}

export interface AlertaPrecoCamadaB {
  nivel: NivelAlertaPrecoCamadaB;
  desvio_pct?: number;
  cobertura_pct?: number;
  nivel_geo?: 'cidade' | 'regiao' | 'uf';
  faixa_esperada_centavos?: {
    p25: number;
    p50: number;
    p75: number;
  };
  amostra?: {
    n: number;
    n_prestadores: number;
    n_condominios: number;
  };
  itens_contribuintes?: ItemContribuinteAlerta[];
  texto: string;
}

export interface AlertaPrecoCamadaA {
  nivel: NivelAlertaPrecoCamadaA;
  desvio_pct: number;
  mediana_demais_centavos: number;
  escopo_comparado: 'total' | 'mao_de_obra';
  texto: string;
}

export interface AlertaPrecoCotacao {
  camada_a?: AlertaPrecoCamadaA | null;
  camada_b?: AlertaPrecoCamadaB | null;
}

export interface ComparadorMeta {
  pedido_id: string;
  status_pedido: string;
  total_cotacoes_validas: number;
  minimo_exigido: number;
  faltam: number;
  pode_aprovar: boolean;
  prazo_limite_cotacoes?: string | null;
  alertas_equivalencia?: AlertaEquivalencia[];
}

export interface ComparadorDados {
  meta: ComparadorMeta;
  cotacoes: CotacaoComparadorItem[];
}

export interface AprovacaoCotacaoInput {
  pedido_id: string;
  cotacao_id: string;
  motivo_codigo: MotivoAprovacaoCodigo;
  motivo_texto?: string | null;
  ciente_alertas?: boolean;
}

export interface AprovacaoCotacaoRegistro {
  id: string;
  pedido_id: string;
  cotacao_id: string;
  aprovado_por: string;
  motivo_codigo: MotivoAprovacaoCodigo;
  motivo_texto?: string | null;
  snapshot_comparador: ComparadorDados;
  created_at: string;
  aprovador_nome?: string;
  ciente_alertas?: boolean;
}

// ─── FEATURE 10: APROVAÇÃO EM UM TOQUE, COM REGISTRO FORENSE ─────────────────

export interface CienciaExigidaItem {
  codigo: string;
  versao: number;
  texto: string;
}

export interface CienciaConfirmadaItem {
  codigo: string;
  versao: number;
  texto?: string;
  aceita_em?: string;
}

export interface MotivoOpcao {
  codigo: MotivoAprovacaoCodigo;
  label: string;
  exige_texto: boolean;
}

export interface AprovacaoPreparada {
  pedido_id: string;
  cotacao_id: string;
  condominio_id: string;
  etag: string;
  pode_aprovar: boolean;
  bloqueios: Array<{ codigo: string; mensagem: string }>;
  precisa_motivo: boolean;
  motivo_exigido_por: 'nao_e_menor_preco' | null;
  motivos_disponiveis: MotivoOpcao[];
  ciencias_exigidas: CienciaExigidaItem[];
  resumo_cotacao: {
    prestador_id: string;
    prestador_nome: string;
    prestador_foto?: string | null;
    prestador_verificado: boolean;
    valor_total_centavos: number;
    prazo_execucao_dias: number | null;
    garantia_meses: number | null;
    diferenca_menor_centavos: number;
    diferenca_menor_pct: number;
    is_menor_preco: boolean;
  };
  alertas_ativos: {
    preco?: AlertaPrecoCotacao | null;
    escopo_incompleto?: boolean;
  };
  contador_previsao?: {
    ano: number;
    proximo_numero_estimado: string;
  };
}

export interface AprovacaoExecutarInput {
  pedido_id: string;
  cotacao_id: string;
  motivo_codigo?: MotivoAprovacaoCodigo | null;
  motivo_texto?: string | null;
  ciencias: Array<{ codigo: string; versao: number }>;
  etag: string;
  idempotency_key: string;
  app_meta?: {
    plataforma: string;
    versao: string;
    userAgent?: string;
  };
  reauth_token?: string | null;
}

export interface ComprovanteCondominioInfo {
  id: string;
  nome: string;
  cnpj?: string | null;
}

export interface ComprovantePedidoInfo {
  id: string;
  titulo: string;
  categoria?: string | null;
}

export interface ComprovanteAprovadorInfo {
  id: string;
  nome: string;
  papel_no_momento: string;
}

export interface ComprovanteCotacaoEscolhida {
  id: string;
  prestador_id?: string;
  prestador_nome: string;
  valor_total_centavos: number;
  prazo_execucao_dias: number | null;
  garantia_meses: number | null;
  validade_proposta_ate?: string | null;
}

export interface ComprovanteCotacaoConcorrente {
  id: string;
  prestador_nome: string;
  valor_total_centavos: number;
  prazo_execucao_dias?: number | null;
}

export interface ComprovanteIntegridadeInfo {
  hash_snapshot: string;
  hash_anterior: string | null;
  hash_encadeado: string;
  valido?: boolean;
}

export interface ComprovanteAprovacao {
  id: string;
  comprovante_numero: string;
  created_at: string;
  condominio: ComprovanteCondominioInfo;
  pedido: ComprovantePedidoInfo;
  aprovador: ComprovanteAprovadorInfo;
  cotacao_escolhida: ComprovanteCotacaoEscolhida;
  demais_cotacoes: ComprovanteCotacaoConcorrente[];
  motivo: {
    codigo: string;
    texto: string | null;
  };
  ciencias: Array<{
    codigo: string;
    versao: number;
    texto: string;
    aceita_em: string;
  }>;
  integridade: ComprovanteIntegridadeInfo;
  app: {
    plataforma: string;
    versao: string;
  };
  estado_aprovacao: 'registrada' | 'aguardando_segunda_aprovacao' | string;
}

export interface VerificacaoIntegridadeResult {
  id: string;
  comprovante_numero: string;
  valido: boolean;
  hash_snapshot_correto: boolean;
  hash_encadeado_correto: boolean;
  elo_anterior_valido: boolean;
  detalhes?: {
    hash_snapshot_banco: string;
    hash_snapshot_recalculado: string;
    hash_encadeado_banco: string;
    hash_encadeado_recalculado: string;
    hash_anterior_aprovacao_id: string | null;
  };
}

export interface HistoricoAprovacaoItem {
  id: string;
  comprovante_numero: string;
  created_at: string;
  pedido_id: string;
  pedido_titulo: string;
  prestador_nome: string;
  valor_total_centavos: number;
  aprovador_nome: string;
  papel_no_momento: string;
  motivo_codigo: string;
  qtd_ciencias: number;
  hash_encadeado: string;
  estado_aprovacao: string;
}

export interface HistoricoAprovacaoFiltros {
  ano?: number;
  q?: string;
  prestador?: string;
  aprovador?: string;
}

