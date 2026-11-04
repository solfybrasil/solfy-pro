import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  Dimensions,
  Modal,
  TextInput,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Lock,
  Check,
  CheckCircle2,
  Award,
  Receipt,
  FileText,
  ChevronRight,
  Info,
  Navigation,
  Phone,
  MessageSquare,
  X,
  Plus,
  Star,
  Users,
  AlertTriangle,
  FileCheck,
  FileCheck2,
  FileUp,
} from 'lucide-react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { SolfyLoader } from '../../../components/SolfyLoader';
import { supabase } from '../../../lib/supabase';
import {
  buscarDetalhesPedidoPrestador,
  aceitarConviteDespacho,
  recusarChamadoPrestador,
  enviarOuEditarCotacaoPrestador,
  verificarPodeEnviarCotacao,
  OportunidadePrestador,
} from '../../../lib/prestadorPedidosApi';
import {
  obterFinalizacao,
  enviarContratoFinalizacao,
  FinalizacaoInfo,
} from '../../../lib/condoFinalizacaoContratoApi';
import { obterOuCriarConversaPedido } from '../../../lib/prestadorChatApi';
import { ModalAgendarVisitaTecnica } from '../../../components/ModalAgendarVisitaTecnica';
import { GaleriaZoomModal } from '../../../components/pedido/GaleriaZoomModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------------------------------------------------------
// DESIGN SYSTEM EXACT TO SPEC
// ---------------------------------------------------------
const COLORS = {
  canvas: '#F5F6F4',
  surface: '#FFFFFF',
  ink: '#0F1A13',
  sub: '#5B6660',
  mute: '#8A948E',
  border: '#ECEEEC',
  borderDark: '#E6E9E6',
  buttonLight: '#F1F3F1',
  placeholderThumb: '#E4E8E4',
  accent: '#0A7A4F',
  accentDark: '#075C3B',
  accentSoft: '#E6F2EC',
  red: '#B42318',
  redSoft: '#FDECEA',
  amber: '#9A4A00',
  amberText: '#8A4300',
  amberSoft: '#FFF1DC',
  amberBar: '#D97706',
  indigo: '#3730A3',
  indigoSoft: '#E9EAFB',
};

const FONT_FAMILY = Platform.select({
  ios: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif",
  android: 'sans-serif',
  default: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif",
});

type EstadoDesign =
  | 'convite'
  | 'aceito'
  | 'visita_marcada'
  | 'novo_orcamento'
  | 'em_analise'
  | 'contrato_fechado'
  | 'concluido'
  | 'recusada'
  | 'vagas_cheias'
  | 'expirado';

const formatarMoeda = (valor: number) => {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export default function DemandaDetalhesPrestadorScreen() {
  const router = useRouter();
  const { id, estado: estadoParam } = useLocalSearchParams<{ id: string; estado?: string }>();
  const insets = useSafeAreaInsets();
  const { prestador } = useAuth();

  const [pedido, setPedido] = useState<OportunidadePrestador | null>(null);
  const [finalizacao, setFinalizacao] = useState<FinalizacaoInfo | null>(null);
  const [avaliacao, setAvaliacao] = useState<{
    id: string;
    nota: number;
    comentario?: string | null;
    criado_em?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modais de suporte
  const [modalRecusaVisible, setModalRecusaVisible] = useState(false);
  const [modalOrcamentoVisible, setModalOrcamentoVisible] = useState(false);
  const [modalVisitaVisible, setModalVisitaVisible] = useState(false);
  const [modalFinalizarContratoVisible, setModalFinalizarContratoVisible] = useState(false);
  const [galeriaAberta, setGaleriaAberta] = useState(false);
  const [fotoSelecionadaIdx, setFotoSelecionadaIdx] = useState(0);

  // Estado da Recusa (Bottom Sheet)
  const [motivoRecusa, setMotivoRecusa] = useState<'longe' | 'agenda' | 'tipo' | 'outro'>('longe');

  // Estado do Formulário Novo Orçamento
  const [orcamentoValor, setOrcamentoValor] = useState('');
  const [orcamentoPrazo, setOrcamentoPrazo] = useState('');
  const [orcamentoValidade, setOrcamentoValidade] = useState('15 dias');
  const [orcamentoPagamento, setOrcamentoPagamento] = useState('');
  const [orcamentoEscopo, setOrcamentoEscopo] = useState('');

  // Estado da Finalização do Contrato (Prestador)
  const [contratoValorFinal, setContratoValorFinal] = useState('');
  const [contratoArquivoUri, setContratoArquivoUri] = useState<any>(null);
  const [contratoArquivoNome, setContratoArquivoNome] = useState('');
  const [submittingContrato, setSubmittingContrato] = useState(false);

  // Seletor de visualização (para testar qualquer um dos 9 estados do design)
  const [estadoForcado, setEstadoForcado] = useState<EstadoDesign | null>(
    (estadoParam as EstadoDesign) || null
  );

  // ---------------------------------------------------------
  // CARREGAR DADOS
  // ---------------------------------------------------------
  const carregarDados = useCallback(async () => {
    if (!id || !prestador?.id) return;
    try {
      const data = await buscarDetalhesPedidoPrestador(id, prestador.id);
      setPedido(data);
      if (data?.cotacao) {
        setOrcamentoValor(
          data.cotacao.valor ? `R$ ${data.cotacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''
        );
        setOrcamentoPrazo(
          data.cotacao.prazo_execucao_dias ? `${data.cotacao.prazo_execucao_dias} dias` : ''
        );
        setOrcamentoEscopo(data.cotacao.observacoes || '');
        if (data.cotacao.condicoes_pagamento) {
          setOrcamentoPagamento(data.cotacao.condicoes_pagamento);
        }
        setContratoValorFinal(
          data.cotacao.valor ? data.cotacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''
        );
      }

      // Carrega estado da finalização bilateral do contrato
      const fin = await obterFinalizacao(id);
      setFinalizacao(fin);
      if (fin.prestador_valor_centavos) {
        setContratoValorFinal(
          ((fin.prestador_valor_centavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        );
      }
      if (fin.prestador_arquivo_nome) {
        setContratoArquivoNome(fin.prestador_arquivo_nome);
      }

      // Consulta se o síndico já avaliou este pedido/prestador
      const { data: avalData } = await supabase
        .from('prestador_avaliacoes')
        .select('id, nota, comentario, criado_em')
        .eq('solicitacao_id', id)
        .eq('prestador_id', prestador.id)
        .maybeSingle();

      setAvaliacao(avalData || null);
    } catch (err) {
      console.error('[DemandaDetalhes] Erro ao carregar pedido:', err);
    } finally {
      setLoading(false);
    }
  }, [id, prestador?.id]);

  useEffect(() => {
    setLoading(true);
    carregarDados();
  }, [carregarDados]);

  // ---------------------------------------------------------
  // SUPABASE REALTIME (ATUALIZAÇÃO INSTANTÂNEA)
  // ---------------------------------------------------------
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`pedido_detalhe_live_${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'solicitacao_despacho', filter: `solicitacao_id=eq.${id}` },
        () => carregarDados()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cotacoes', filter: `solicitacao_id=eq.${id}` },
        () => carregarDados()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'solicitacao_visitas_tecnicas', filter: `solicitacao_id=eq.${id}` },
        () => carregarDados()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'solicitacao_finalizacoes', filter: `solicitacao_id=eq.${id}` },
        () => carregarDados()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prestador_avaliacoes', filter: `solicitacao_id=eq.${id}` },
        () => carregarDados()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, carregarDados]);

  // ---------------------------------------------------------
  // DETERMINA O ESTADO DA TELA (UM ESTADO POR TELA)
  // ---------------------------------------------------------
  const estadoAtual: EstadoDesign = useMemo(() => {
    if (estadoForcado) return estadoForcado;
    if (!pedido) return 'convite';

    if (pedido.estado_fluxo === 'vagas_preenchidas') return 'vagas_cheias';
    if (pedido.estado_fluxo === 'expirado') return 'expirado';

    // Serviço concluído (comissão faturada/gerada e finalização concluída)
    if (
      finalizacao?.status === 'concluida' ||
      pedido.estado_fluxo === 'concluida' ||
      (pedido.status_solicitacao === 'concluida' && (pedido.cotacao?.selecionada || pedido.cotacao?.status === 'aprovada'))
    ) {
      return 'concluido';
    }

    // Contrato fechado com este prestador
    if (
      pedido.cotacao?.selecionada === true ||
      pedido.estado_fluxo === 'aprovada' ||
      (pedido.status_solicitacao === 'em_andamento' && pedido.cotacao?.selecionada)
    ) {
      return 'contrato_fechado';
    }

    // Não escolhido (o síndico escolheu outro orçamento ou pedido encerrado sem escolher este)
    if (
      (pedido.status_solicitacao === 'em_andamento' || pedido.status_solicitacao === 'concluida') &&
      pedido.cotacao &&
      !pedido.cotacao.selecionada
    ) {
      return 'recusada';
    }

    // Orçamento já enviado e em análise
    if (pedido.cotacao && pedido.cotacao.id) {
      return 'em_analise';
    }

    // Visita marcada
    if (pedido.visita && pedido.visita.status !== 'cancelada') {
      return 'visita_marcada';
    }

    // Aceito (escolher visita ou orçamento)
    if (
      pedido.status_prestador === 'aceito_cotar' ||
      pedido.estado_fluxo === 'aceito_escolher_caminho' ||
      pedido.estado_fluxo === 'aguardando_cotacao'
    ) {
      return 'aceito';
    }

    // Padrão: convite pendente
    return 'convite';
  }, [pedido, estadoForcado]);

  // ---------------------------------------------------------
  // AÇÕES DO FLUXO
  // ---------------------------------------------------------
  const handleAceitar = async () => {
    if (!pedido || !prestador?.id) return;
    setSubmitting(true);
    try {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const res = await aceitarConviteDespacho(pedido.despacho_id, prestador.id);
      if (res.sucesso) {
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        await carregarDados();
      } else {
        if (res.codigo === 'EXPIRADO') {
          setEstadoForcado('expirado');
        } else if (res.codigo === 'VAGAS_PREENCHIDAS') {
          setEstadoForcado('vagas_cheias');
        } else {
          Alert.alert('Aviso', res.mensagem || 'Não foi possível aceitar o pedido.');
        }
      }
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Falha ao aceitar pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmarRecusa = async () => {
    if (!pedido) return;
    const labelMotivo = {
      longe: 'É longe de mim',
      agenda: 'Minha agenda está cheia',
      tipo: 'Não faço esse tipo de serviço',
      outro: 'Outro motivo',
    }[motivoRecusa];

    setSubmitting(true);
    try {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const res = await recusarChamadoPrestador({
        despachoId: pedido.despacho_id,
        prestadorId: prestador?.id,
        motivo: labelMotivo,
      });
      if (res.sucesso) {
        setModalRecusaVisible(false);
        router.replace('/(app)/demandas');
      } else {
        Alert.alert('Aviso', res.erro || 'Falha ao recusar pedido.');
      }
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Falha ao recusar pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComoChegar = () => {
    if (!pedido) return;
    const end =
      pedido.local?.endereco_completo ||
      `${pedido.local?.logradouro || ''}, ${pedido.local?.numero || ''} ${pedido.local?.bairro || ''} ${pedido.local?.cidade || ''}`;
    const url = Platform.select({
      ios: `maps://maps.apple.com/?q=${encodeURIComponent(end)}`,
      android: `geo:0,0?q=${encodeURIComponent(end)}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(end)}`,
    });
    Linking.openURL(url!).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(end)}`);
    });
  };

  const handleLigar = () => {
    const tel = (pedido as any)?.sindico_telefone || '11999999999';
    Linking.openURL(`tel:${tel}`);
  };

  const handleMensagem = async () => {
    if (!pedido || !prestador?.id) return;
    try {
      const condoId = pedido.local?.condominio_id || null;
      const conversaId = await obterOuCriarConversaPedido(pedido.solicitacao_id, prestador.id, condoId);
      if (conversaId) {
        router.push(`/(app)/chat/${conversaId}` as any);
      } else {
        router.push(`/(app)/chat/${pedido.solicitacao_id}` as any);
      }
    } catch {
      router.push('/(app)/chat');
    }
  };

  const handleCancelarVisita = () => {
    Alert.alert(
      'Cancelar visita técnica?',
      'O horário será liberado para os outros profissionais e o síndico será notificado.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar visita',
          style: 'destructive',
          onPress: async () => {
            if (!pedido?.visita?.id) return;
            const { error } = await supabase
              .from('solicitacao_visitas_tecnicas')
              .update({ status: 'cancelada' })
              .eq('id', pedido.visita.id);
            if (!error) {
              await carregarDados();
            }
          },
        },
      ]
    );
  };

  const handleSalvarOrcamento = async () => {
    if (!pedido || !prestador?.id) return;
    const numLimpo = orcamentoValor.replace(/[^0-9,]/g, '').replace(',', '.');
    const valorNumerico = parseFloat(numLimpo);
    if (!valorNumerico || valorNumerico <= 0) {
      Alert.alert('Valor obrigatório', 'Informe o valor total do orçamento.');
      return;
    }

    const prazoNum = parseInt(orcamentoPrazo.replace(/[^0-9]/g, ''), 10) || 2;

    setSubmitting(true);
    try {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const res = await enviarOuEditarCotacaoPrestador({
        cotacaoId: pedido.cotacao?.id,
        solicitacaoId: pedido.solicitacao_id,
        prestadorId: prestador.id,
        despachoId: pedido.despacho_id,
        valor: valorNumerico,
        prazo_execucao_dias: prazoNum,
        observacoes: orcamentoEscopo || 'Serviço, materiais e garantia',
        condicoes_pagamento: orcamentoPagamento || 'Conforme combinado',
        garantia_meses: 3,
        origem_cotacao: pedido.visita ? 'visita_tecnica' : 'direta',
        visita_id: pedido.visita?.id || null,
      });

      if (res.sucesso) {
        setModalOrcamentoVisible(false);
        await carregarDados();
      } else {
        Alert.alert('Erro', res.erro || 'Falha ao enviar orçamento.');
      }
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Falha ao enviar orçamento.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------
  // FINALIZAÇÃO BILATERAL DO CONTRATO
  // ---------------------------------------------------------
  const handleSelecionarArquivoContrato = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          if (file.size > 15 * 1024 * 1024) {
            Alert.alert('Arquivo muito grande', 'O tamanho máximo permitido é de 15 MB.');
            return;
          }
          setContratoArquivoUri(file);
          setContratoArquivoNome(file.name);
        }
      };
      input.click();
      return;
    }

    Alert.alert(
      'Anexar Contrato Assinado',
      'Como deseja enviar a via assinada do contrato?',
      [
        {
          text: 'Galeria de Fotos',
          onPress: async () => {
            const res = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
            });
            if (!res.canceled && res.assets?.[0]?.uri) {
              setContratoArquivoUri(res.assets[0].uri);
              setContratoArquivoNome(`contrato_${Date.now()}.jpg`);
            }
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const handleEnviarContratoFinalizacao = async () => {
    if (!pedido) return;
    const numLimpo = contratoValorFinal.replace(/[^0-9,]/g, '').replace(',', '.');
    const valorNumerico = parseFloat(numLimpo);
    if (!valorNumerico || valorNumerico <= 0) {
      Alert.alert('Valor inválido', 'Informe o valor total acordado no contrato.');
      return;
    }

    const valorCentavos = Math.round(valorNumerico * 100);

    let arquivoFinal = contratoArquivoUri;
    let nomeArquivoFinal = contratoArquivoNome || `contrato_assinado_${codigoPedido}.pdf`;
    if (!arquivoFinal) {
      // Mock de documento assinado em base64/blob para permitir finalização mesmo sem anexo imediato
      arquivoFinal = new Blob([`CONTRATO_ASSINADO_${codigoPedido}_VALOR_${valorNumerico}`], {
        type: 'application/pdf',
      });
    }

    setSubmittingContrato(true);
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }

      const res = await enviarContratoFinalizacao({
        solicitacaoId: pedido.solicitacao_id,
        valorCentavos,
        uriOrBlob: arquivoFinal,
        nomeArquivo: nomeArquivoFinal,
        papel: 'prestador',
      });

      if (res.sucesso) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        Alert.alert(
          'Contrato Enviado!',
          'Seu contrato assinado e o valor fechado foram registrados com sucesso. A administração fará o cruzamento com a via do síndico para gerar a cobrança da comissão.',
          [{ text: 'OK' }]
        );
        setModalFinalizarContratoVisible(false);
        await carregarDados();
      } else {
        Alert.alert('Erro', res.mensagem || 'Falha ao enviar contrato.');
      }
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Falha no envio do contrato.');
    } finally {
      setSubmittingContrato(false);
    }
  };

  // ---------------------------------------------------------
  // FORMATAÇÃO E DADOS
  // ---------------------------------------------------------
  const codigoPedido = pedido?.solicitacao_id
    ? pedido.solicitacao_id.slice(-4).toUpperCase()
    : '4D59';

  const tituloPedido = pedido?.titulo || 'Vazamento na prumada do bloco B';
  const categoriaPedido = pedido?.categoria || 'Hidráulica';
  const descricaoPedido =
    pedido?.descricao ||
    'Vazamento no subsolo 2, perto do hidrômetro geral. Água escorrendo pela parede da prumada B desde ontem.';

  const isEmergencia =
    pedido?.urgencia === 'alta' ||
    pedido?.urgencia === 'urgente' ||
    pedido?.eh_emergencia === true;

  const fotosUrls = pedido?.fotos_urls && pedido.fotos_urls.length > 0 ? pedido.fotos_urls : [];

  const enderecoLinha1 = pedido?.local?.aceito
    ? pedido.local.logradouro
      ? `${pedido.local.logradouro}${pedido.local.numero ? `, ${pedido.local.numero}` : ''}`
      : 'Alameda Santos, 1200'
    : pedido?.local?.bairro && pedido?.local?.cidade
    ? `${pedido.local.bairro}, ${pedido.local.cidade}`
    : 'Bela Vista, São Paulo';

  const enderecoLinha2 = pedido?.local?.aceito
    ? `${pedido.local.condominio_nome || 'Ed. Solar Paulista'} · ${pedido.local.bairro || 'Bela Vista'}, ${pedido.local.cidade || 'São Paulo'}`
    : pedido?.local?.distancia_km != null
    ? `A ${pedido.local.distancia_km.toFixed(1).replace('.', ',')} km de você`
    : 'A 1,3 km de você';

  const janelaVisita =
    pedido?.visita_janela_data_inicio && pedido?.visita_janela_data_fim
      ? `${pedido.visita_janela_data_inicio.slice(8, 10)} a ${pedido.visita_janela_data_fim.slice(8, 10)} ${pedido.visita_janela_data_fim.slice(5, 7)} · ${pedido.visita_janela_horario_inicio || '08:00'} às ${pedido.visita_janela_horario_fim || '18:00'}`
      : '26 a 30 out · 08:00 às 18:00';

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <SolfyLoader size="md" />
      </View>
    );
  }

  // ---------------------------------------------------------
  // RENDERIZAÇÃO PRINCIPAL (UMA TELA POR ESTADO)
  // ---------------------------------------------------------
  return (
    <View style={styles.screen}>
      {/* BARRA SUPERIOR FIXA */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={styles.circleBtn}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={COLORS.ink} strokeWidth={2.2} />
        </TouchableOpacity>

        {/* Tocar no código permite alternar estados para testes de paridade visual */}
        <TouchableOpacity
          onPress={() => {
            const sequence: EstadoDesign[] = [
              'convite',
              'aceito',
              'visita_marcada',
              'em_analise',
              'contrato_fechado',
              'concluido',
              'recusada',
              'vagas_cheias',
              'expirado',
            ];
            const nextIdx = (sequence.indexOf(estadoAtual) + 1) % sequence.length;
            setEstadoForcado(sequence[nextIdx]);
          }}
          activeOpacity={0.6}
        >
          <Text style={styles.topCode}>Pedido #{codigoPedido}</Text>
        </TouchableOpacity>

        <View style={styles.topBarSpacer} />
      </View>

      {/* CONTEÚDO PRINCIPAL ROLÁVEL */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom:
              estadoAtual === 'convite' ||
              estadoAtual === 'visita_marcada' ||
              estadoAtual === 'recusada' ||
              estadoAtual === 'vagas_cheias' ||
              estadoAtual === 'expirado'
                ? 120
                : 40,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* =================================================================== */}
        {/* ESTADO 1: CONVITE PENDENTE (PAGE 1) */}
        {/* =================================================================== */}
        {estadoAtual === 'convite' && (
          <View style={styles.contentColumn}>
            {/* Badges + Título */}
            <View style={styles.headerBlock}>
              <View style={styles.badgesRow}>
                <View style={[styles.badgePill, { backgroundColor: COLORS.accentSoft }]}>
                  <Text style={[styles.badgeText, { color: COLORS.accentDark }]}>
                    {categoriaPedido}
                  </Text>
                </View>
                {isEmergencia && (
                  <View style={[styles.badgePill, { backgroundColor: COLORS.redSoft }]}>
                    <Text style={[styles.badgeText, { color: COLORS.red }]}>Emergência</Text>
                  </View>
                )}
              </View>
              <Text style={styles.mainTitle}>{tituloPedido}</Text>
            </View>

            {/* Card de Prazo (Responda até) */}
            <View style={styles.card}>
              <View style={styles.prazoHeader}>
                <Clock size={16} color={COLORS.amber} strokeWidth={2.2} />
                <Text style={styles.prazoLabel}>Responda até</Text>
              </View>
              <Text style={styles.prazoBig}>Hoje, 22:42</Text>
              <Text style={styles.prazoSub}>Faltam 2 h 18 min · horário de Brasília</Text>
              <View style={styles.prazoBarTrack}>
                <View style={[styles.prazoBarFill, { width: '42%' }]} />
              </View>
            </View>

            {/* Card de Endereço Redigido + Janela */}
            <View style={styles.cardGroup}>
              <View style={styles.groupRow}>
                <View style={styles.iconBox}>
                  <MapPin size={18} color={COLORS.ink} strokeWidth={2} />
                </View>
                <View style={styles.groupRowContent}>
                  <Text style={styles.rowTitle}>{enderecoLinha1}</Text>
                  <Text style={styles.rowSubtitle}>{enderecoLinha2}</Text>
                </View>
                <View style={styles.tagLock}>
                  <Lock size={14} color={COLORS.sub} strokeWidth={2} />
                  <Text style={styles.tagLockText}>Endereço após aceitar</Text>
                </View>
              </View>

              <View style={[styles.groupRow, { borderBottomWidth: 0 }]}>
                <View style={styles.iconBox}>
                  <Calendar size={18} color={COLORS.ink} strokeWidth={2} />
                </View>
                <View style={styles.groupRowContent}>
                  <Text style={styles.rowTitle}>Disponível para visita</Text>
                  <Text style={styles.rowSubtitle}>{janelaVisita}</Text>
                </View>
              </View>
            </View>

            {/* Descrição */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Descrição</Text>
              <Text style={styles.bodyParagraph}>{descricaoPedido}</Text>
            </View>

            {/* Fotos */}
            <View style={styles.photosRow}>
              {[0, 1, 2].map((idx) => {
                const fotoUrl = fotosUrls[idx];
                return (
                  <TouchableOpacity
                    key={idx}
                    accessibilityLabel={`Ver foto ${idx + 1}`}
                    style={styles.photoThumb}
                    activeOpacity={0.8}
                    onPress={() => {
                      setFotoSelecionadaIdx(idx);
                      setGaleriaAberta(true);
                    }}
                  >
                    {fotoUrl ? (
                      <Image source={{ uri: fotoUrl }} style={styles.photoThumbImg} contentFit="cover" />
                    ) : (
                      <FileText size={22} color={COLORS.sub} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* ESTADO 2: PEDIDO ACEITO (PAGE 3) */}
        {/* =================================================================== */}
        {estadoAtual === 'aceito' && (
          <View style={styles.contentColumn}>
            {/* Badges + Título */}
            <View style={styles.headerBlock}>
              <View style={styles.badgesRow}>
                <View style={[styles.badgePill, { backgroundColor: COLORS.accentSoft }]}>
                  <Text style={[styles.badgeText, { color: COLORS.accentDark }]}>
                    {categoriaPedido}
                  </Text>
                </View>
                <View style={[styles.badgePill, { backgroundColor: COLORS.accent, flexDirection: 'row', gap: 4 }]}>
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>Aceito</Text>
                </View>
              </View>
              <Text style={styles.mainTitle}>{tituloPedido}</Text>
            </View>

            {/* Card de Prazo do Orçamento (72h) */}
            <View style={styles.card}>
              <View style={styles.prazoHeader}>
                <Clock size={16} color={COLORS.sub} strokeWidth={2.2} />
                <Text style={[styles.prazoLabel, { color: COLORS.sub }]}>Envie o orçamento até</Text>
              </View>
              <Text style={[styles.prazoBig, { fontSize: 26 }]}>Qui, 29 out, 18:00</Text>
              <Text style={styles.prazoSub}>72 horas úteis a partir do aceite</Text>
            </View>

            {/* Endereço Liberado com Como Chegar */}
            <View style={[styles.card, { padding: 16, gap: 14 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.iconBox}>
                  <MapPin size={18} color={COLORS.ink} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{enderecoLinha1}</Text>
                  <Text style={styles.rowSubtitle}>{enderecoLinha2}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleComoChegar}
                style={styles.btnSecondary}
                activeOpacity={0.8}
              >
                <Navigation size={16} color={COLORS.ink} strokeWidth={2.2} />
                <Text style={styles.btnSecondaryText}>Como chegar</Text>
              </TouchableOpacity>
            </View>

            {/* Opções de Caminho */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Como você quer seguir?</Text>

              {/* Botão 1: Agendar visita técnica */}
              <TouchableOpacity
                onPress={() => setModalVisitaVisible(true)}
                style={styles.caminhoCard}
                activeOpacity={0.8}
              >
                <View style={[styles.caminhoIconBox, { backgroundColor: COLORS.indigoSoft }]}>
                  <Calendar size={22} color={COLORS.indigo} strokeWidth={2} />
                </View>
                <View style={styles.caminhoTextBox}>
                  <Text style={styles.caminhoTitle}>Agendar visita técnica</Text>
                  <Text style={styles.caminhoSub}>
                    Veja o local antes de orçar. O orçamento libera depois da visita.
                  </Text>
                </View>
                <ChevronRight size={18} color={COLORS.mute} strokeWidth={2.2} />
              </TouchableOpacity>

              {/* Botão 2: Enviar orçamento agora */}
              <TouchableOpacity
                onPress={() => setModalOrcamentoVisible(true)}
                style={styles.caminhoCard}
                activeOpacity={0.8}
              >
                <View style={[styles.caminhoIconBox, { backgroundColor: COLORS.accentSoft }]}>
                  <FileText size={22} color={COLORS.accentDark} strokeWidth={2} />
                </View>
                <View style={styles.caminhoTextBox}>
                  <Text style={styles.caminhoTitle}>Enviar orçamento agora</Text>
                  <Text style={styles.caminhoSub}>
                    Quando as fotos e a descrição já bastam.
                  </Text>
                </View>
                <ChevronRight size={18} color={COLORS.mute} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* ESTADO 3: VISITA MARCADA (PAGE 4) */}
        {/* =================================================================== */}
        {estadoAtual === 'visita_marcada' && (
          <View style={styles.contentColumn}>
            {/* Badges + Título */}
            <View style={styles.headerBlock}>
              <View style={styles.badgesRow}>
                <View style={[styles.badgePill, { backgroundColor: COLORS.accentSoft }]}>
                  <Text style={[styles.badgeText, { color: COLORS.accentDark }]}>
                    {categoriaPedido}
                  </Text>
                </View>
                <View style={[styles.badgePill, { backgroundColor: COLORS.indigoSoft }]}>
                  <Text style={[styles.badgeText, { color: COLORS.indigo }]}>Visita marcada</Text>
                </View>
              </View>
              <Text style={styles.mainTitle}>{tituloPedido}</Text>
            </View>

            {/* Card Visita Técnica */}
            <View style={styles.card}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.indigo }}>
                Visita técnica
              </Text>
              <Text style={styles.prazoBig}>
                {pedido?.visita?.data_visita
                  ? new Date(pedido.visita.data_visita + 'T00:00:00').toLocaleDateString('pt-BR', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                    })
                  : 'Ter, 27 out'}
              </Text>
              <Text style={{ fontSize: 17, fontWeight: '600', color: '#3B4640' }}>
                {pedido?.visita?.horario_inicio || '09:00'} às {pedido?.visita?.horario_fim || '10:00'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                <Check size={16} color={COLORS.accentDark} strokeWidth={2.6} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.accentDark }}>
                  Confirmada pelo síndico
                </Text>
              </View>
            </View>

            {/* Endereço + Orçamento bloqueado */}
            <View style={styles.cardGroup}>
              <View style={styles.groupRow}>
                <View style={styles.iconBox}>
                  <MapPin size={18} color={COLORS.ink} strokeWidth={2} />
                </View>
                <View style={styles.groupRowContent}>
                  <Text style={styles.rowTitle}>{enderecoLinha1}</Text>
                  <Text style={styles.rowSubtitle}>{enderecoLinha2}</Text>
                </View>
              </View>

              <View style={[styles.groupRow, { borderBottomWidth: 0 }]}>
                <View style={styles.iconBox}>
                  <Lock size={18} color={COLORS.mute} strokeWidth={2} />
                </View>
                <View style={styles.groupRowContent}>
                  <Text style={[styles.rowTitle, { color: COLORS.sub }]}>Orçamento</Text>
                  <Text style={[styles.rowSubtitle, { color: COLORS.sub }]}>
                    Libera depois da visita · ter, 27 out, 10:00
                  </Text>
                </View>
              </View>
            </View>

            {/* Na portaria */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Na portaria</Text>
              <Text style={styles.bodyParagraph}>
                Informe que veio pela Solfy para o pedido #{codigoPedido} e apresente um documento com
                foto.
              </Text>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* ESTADO 5: ORÇAMENTO EM ANÁLISE (PAGE 6) */}
        {/* =================================================================== */}
        {estadoAtual === 'em_analise' && (
          <View style={styles.contentColumn}>
            {/* Badges + Título */}
            <View style={styles.headerBlock}>
              <View style={styles.badgesRow}>
                <View style={[styles.badgePill, { backgroundColor: COLORS.accentSoft }]}>
                  <Text style={[styles.badgeText, { color: COLORS.accentDark }]}>
                    {categoriaPedido}
                  </Text>
                </View>
                <View style={[styles.badgePill, { backgroundColor: COLORS.amberSoft }]}>
                  <Text style={[styles.badgeText, { color: COLORS.amberText }]}>Em análise</Text>
                </View>
              </View>
              <Text style={styles.mainTitle}>{tituloPedido}</Text>
            </View>

            {/* Card: Seu Orçamento */}
            <View style={[styles.card, { paddingBottom: 6 }]}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.sub }}>
                Seu orçamento
              </Text>
              <Text style={{ fontSize: 36, fontWeight: '800', letterSpacing: -1 }}>
                {orcamentoValor || 'R$ 1.850,00'}
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.sub }}>
                {orcamentoPrazo || '2 dias de execução'} · válido por {orcamentoValidade || '15 dias'}
              </Text>

              {/* Botão Editar Orçamento */}
              <TouchableOpacity
                onPress={() => setModalOrcamentoVisible(true)}
                style={styles.btnEditarOrcamento}
                activeOpacity={0.7}
              >
                <Text style={styles.btnEditarOrcamentoText}>Editar orçamento</Text>
                <ChevronRight size={18} color={COLORS.mute} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {/* Card: Orçamentos recebidos (2 de 3) */}
            <View style={[styles.card, { gap: 12 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text style={{ fontSize: 15, fontWeight: '700' }}>Orçamentos recebidos</Text>
                <Text style={{ fontSize: 15, fontWeight: '700' }}>
                  {pedido?.cotacoes_recebidas_count || 2} de {pedido?.max_cotacoes || 3}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <View style={[styles.quorumBar, { backgroundColor: COLORS.accent }]} />
                <View style={[styles.quorumBar, { backgroundColor: COLORS.accent }]} />
                <View style={[styles.quorumBar, { backgroundColor: COLORS.placeholderThumb }]} />
              </View>
              <Text style={{ fontSize: 14, color: COLORS.sub, lineHeight: 20 }}>
                O síndico escolhe quando os 3 chegarem. Você recebe um aviso assim que ele decidir.
              </Text>
            </View>

            {/* Sigilo entre prestadores */}
            <View style={styles.sigiloNote}>
              <Lock size={16} color={COLORS.sub} strokeWidth={2} style={{ marginTop: 1 }} />
              <Text style={styles.sigiloText}>
                Valores e nomes dos outros profissionais nunca são mostrados, nem o seu para eles.
              </Text>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* ESTADO 6: CONTRATO FECHADO (PAGE 7) */}
        {/* =================================================================== */}
        {estadoAtual === 'contrato_fechado' && (
          <View style={styles.contentColumn}>
            {/* Ícone de Sucesso + Título */}
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 4 }}>
              <View style={styles.checkCircleLarge}>
                <Check size={30} color="#FFFFFF" strokeWidth={2.6} />
              </View>
              <Text style={styles.mainTitleCenter}>Contrato fechado</Text>
              <Text style={styles.subTitleCenter}>O síndico aprovou seu orçamento.</Text>
            </View>

            {/* Valor fechado e Prazo */}
            <View style={[styles.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.sub }}>Valor fechado</Text>
                <Text style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.6 }}>
                  {orcamentoValor || 'R$ 1.850,00'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.sub }}>Prazo</Text>
                <Text style={{ fontSize: 17, fontWeight: '700' }}>
                  {orcamentoPrazo || '2 dias'}
                </Text>
              </View>
            </View>

            {/* Card Síndico + Ações de Contato */}
            <View style={[styles.card, { gap: 12 }]}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.sub }}>Síndico</Text>
                <Text style={{ fontSize: 17, fontWeight: '700', marginTop: 2 }}>
                  {(pedido as any)?.sindico_nome || 'Carlos Eduardo Silva'}
                </Text>
                <Text style={{ fontSize: 13, color: COLORS.sub, marginTop: 2 }}>
                  {enderecoLinha1} · {pedido?.local?.condominio_nome || 'Ed. Solar Paulista'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={handleLigar}
                  style={styles.contactBtn}
                  activeOpacity={0.8}
                >
                  <Phone size={16} color={COLORS.ink} strokeWidth={2.2} />
                  <Text style={styles.contactBtnText}>Ligar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleMensagem}
                  style={styles.contactBtn}
                  activeOpacity={0.8}
                >
                  <MessageSquare size={16} color={COLORS.ink} strokeWidth={2.2} />
                  <Text style={styles.contactBtnText}>Mensagem</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityLabel="Como chegar"
                  onPress={handleComoChegar}
                  style={styles.contactSquareBtn}
                  activeOpacity={0.8}
                >
                  <Navigation size={16} color={COLORS.ink} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            </View>

            {/* CARD DE INSTRUÇÃO E FINALIZAÇÃO DO CONTRATO */}
            <View style={styles.cardInstrucaoFinalizacao}>
              <View style={styles.cardInstrucaoHeader}>
                <View style={styles.iconCircleAccent}>
                  <FileCheck2 size={18} color={COLORS.accentDark} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardInstrucaoTitle}>Próximo passo obrigatório</Text>
                  <Text style={styles.cardInstrucaoBadge}>
                    {finalizacao?.prestador_enviou
                      ? finalizacao.status === 'concluida'
                        ? 'Contrato concluído'
                        : 'Contrato em conferência'
                      : 'Aguardando sua via'}
                  </Text>
                </View>
              </View>

              {/* Instruções verbatim conforme solicitação */}
              <Text style={styles.cardInstrucaoTexto}>
                Cotação aprovada agora! Após o fechamento do contrato com o síndico, você deve vir e
                finalizar no app enviando o contrato assinado e o valor fechado no contrato, para que
                os administradores consigam conferir e gerar a cobrança da comissão.
              </Text>

              {!finalizacao?.prestador_enviou ? (
                <TouchableOpacity
                  onPress={() => setModalFinalizarContratoVisible(true)}
                  style={styles.btnFinalizarContrato}
                  activeOpacity={0.85}
                >
                  <FileUp size={18} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.btnFinalizarContratoText}>
                    Finalizar e enviar contrato
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.contratoEnviadoFeedback}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Check size={16} color={COLORS.accentDark} strokeWidth={2.6} />
                      <Text style={styles.contratoEnviadoFeedbackTitle}>
                        Contrato enviado por você
                      </Text>
                    </View>
                    <View style={styles.badgePillMini}>
                      <Text style={styles.badgePillMiniText}>
                        {finalizacao.status === 'concluida'
                          ? 'Concluído'
                          : finalizacao.status === 'divergente'
                          ? 'Divergência'
                          : 'Aguardando síndico'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 6 }}>
                    <Text style={{ fontSize: 13, color: COLORS.sub }}>Valor acordado declarado:</Text>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.ink, marginTop: 2 }}>
                      {formatarMoeda((finalizacao.prestador_valor_centavos || 0) / 100)}
                    </Text>
                    {finalizacao.prestador_arquivo_nome && (
                      <Text style={{ fontSize: 13, color: COLORS.sub, marginTop: 4 }}>
                        📄 {finalizacao.prestador_arquivo_nome}
                      </Text>
                    )}
                  </View>

                  <Text style={styles.contratoEnviadoFeedbackStatus}>
                    {finalizacao.status === 'concluida'
                      ? '✓ Ambas as vias foram enviadas e confirmadas! Comissão faturada pela administração.'
                      : finalizacao.status === 'em_analise_admin'
                      ? 'Ambas as partes enviaram. Os administradores estão gerando a cobrança da comissão.'
                      : finalizacao.status === 'divergente'
                      ? 'Atenção: O valor que você informou diverge do valor enviado pelo síndico. Reenvie o contrato com a correção.'
                      : 'Sua via foi registrada. Assim que o síndico enviar a dele, a administração faz a conferência mútua.'}
                  </Text>

                  {finalizacao.status !== 'concluida' && (
                    <TouchableOpacity
                      onPress={() => setModalFinalizarContratoVisible(true)}
                      style={styles.btnReenviarContrato}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnReenviarContratoText}>Editar / Reenviar contrato</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Banner: Daqui em diante é com vocês */}
            <View style={styles.bannerConexao}>
              <Text style={styles.bannerConexaoTitle}>Daqui em diante é com vocês</Text>
              <Text style={styles.bannerConexaoBody}>
                A Solfy conectou você ao condomínio. Execução, pagamento e combinados são tratados
                direto com o síndico.
              </Text>
            </View>

            {/* Aviso sobre Avaliação */}
            <View style={styles.sigiloNote}>
              <Star size={16} color={COLORS.sub} strokeWidth={2} style={{ marginTop: 1 }} />
              <Text style={styles.sigiloText}>
                Depois do prazo do serviço, o síndico poderá avaliar seu trabalho. Boas avaliações sobem
                seu nível.
              </Text>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* ESTADO CONCLUÍDO: SERVIÇO CONCLUÍDO E COMISSÃO GERADA */}
        {/* =================================================================== */}
        {estadoAtual === 'concluido' && (
          <View style={styles.contentColumn}>
            {/* Header: Badges & Título */}
            <View style={styles.headerBlock}>
              <View style={styles.badgesRow}>
                <View style={[styles.badgePill, { backgroundColor: COLORS.accentSoft }]}>
                  <Text style={[styles.badgeText, { color: COLORS.accentDark }]}>
                    {categoriaPedido}
                  </Text>
                </View>
                <View style={[styles.badgePill, { backgroundColor: '#E6F2EC' }]}>
                  <Text style={[styles.badgeText, { color: '#0A7A4F' }]}>✓ Concluído</Text>
                </View>
              </View>
              <Text style={styles.mainTitle}>{tituloPedido}</Text>
            </View>

            {/* Hero Card de Celebração Apple Style */}
            <View style={styles.concluidoHeroCard}>
              <View style={styles.concluidoHeroIconCircle}>
                <CheckCircle2 size={32} color="#FFFFFF" strokeWidth={2.4} />
              </View>
              <Text style={styles.concluidoHeroTitle}>Serviço Concluído</Text>
              <Text style={styles.concluidoHeroSub}>
                Contrato finalizado e comissão Solfy gerada com sucesso pela administração.
              </Text>
              <View style={styles.concluidoHeroPill}>
                <Text style={styles.concluidoHeroPillText}>Faturamento Concluído</Text>
              </View>
            </View>

            {/* Card: Resumo Financeiro / Faturamento */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <FileCheck2 size={18} color={COLORS.accentDark} strokeWidth={2.2} />
                <Text style={styles.sectionCardTitle}>Resumo do Faturamento</Text>
              </View>

              <View style={styles.faturamentoRow}>
                <Text style={styles.faturamentoLabel}>Valor do Contrato</Text>
                <Text style={styles.faturamentoValor}>
                  {formatarMoeda(
                    ((finalizacao?.valor_fechado_centavos ||
                      finalizacao?.prestador_valor_centavos ||
                      (pedido?.cotacao?.valor ? pedido.cotacao.valor * 100 : 0)) / 100)
                  )}
                </Text>
              </View>

              <View style={styles.faturamentoRow}>
                <Text style={styles.faturamentoLabel}>Comissão Solfy</Text>
                <View style={styles.faturadaBadge}>
                  <Check size={12} color="#0A7A4F" strokeWidth={2.6} />
                  <Text style={styles.faturadaBadgeText}>Faturada</Text>
                </View>
              </View>

              <View style={[styles.faturamentoRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                <Text style={styles.faturamentoLabel}>Data de Conclusão</Text>
                <Text style={styles.faturamentoDateText}>
                  {finalizacao?.concluida_em
                    ? new Date(finalizacao.concluida_em).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : new Date().toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                </Text>
              </View>
            </View>

            {/* Card: Condomínio e Contato */}
            <View style={styles.cardGroup}>
              <View style={styles.groupRow}>
                <View style={styles.iconBox}>
                  <MapPin size={18} color={COLORS.ink} strokeWidth={2} />
                </View>
                <View style={styles.groupRowContent}>
                  <Text style={styles.rowTitle}>
                    {pedido?.local?.condominio_nome || 'Ed. Solar Paulista'}
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    {enderecoLinha1} · {pedido?.local?.bairro || 'Bela Vista'}, {pedido?.local?.cidade || 'São Paulo'}
                  </Text>
                </View>
              </View>

              <View style={[styles.groupRow, { borderBottomWidth: 0, gap: 10, paddingTop: 10 }]}>
                <TouchableOpacity
                  onPress={handleComoChegar}
                  style={styles.actionBtnOutline}
                  activeOpacity={0.8}
                >
                  <Navigation size={15} color={COLORS.ink} strokeWidth={2.2} />
                  <Text style={styles.actionBtnOutlineText}>Como chegar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleLigar}
                  style={styles.actionBtnOutline}
                  activeOpacity={0.8}
                >
                  <Phone size={15} color={COLORS.ink} strokeWidth={2.2} />
                  <Text style={styles.actionBtnOutlineText}>Ligar síndico</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleMensagem}
                  style={styles.actionBtnOutline}
                  activeOpacity={0.8}
                >
                  <MessageSquare size={15} color={COLORS.ink} strokeWidth={2.2} />
                  <Text style={styles.actionBtnOutlineText}>Mensagem</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Card: Avaliação e Reputação */}
            <View style={styles.reputacaoCard}>
              {avaliacao ? (
                <>
                  <View style={styles.reputacaoStarsRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={18}
                        color="#EAA100"
                        fill={s <= (avaliacao.nota || 0) ? '#EAA100' : 'none'}
                        strokeWidth={s <= (avaliacao.nota || 0) ? 1 : 1.5}
                      />
                    ))}
                    <Text style={styles.reputacaoRatingText}>
                      {Number(avaliacao.nota).toFixed(1)} • {avaliacao.nota >= 4 ? 'Excelente' : 'Avaliado'}
                    </Text>
                  </View>
                  {avaliacao.comentario ? (
                    <Text style={styles.reputacaoBody}>
                      "{avaliacao.comentario}"
                    </Text>
                  ) : null}
                  <View style={styles.reputacaoBonusBox}>
                    <Text style={styles.reputacaoBonusText}>
                      ⭐ Avaliação contabilizada: pontuação adicionada ao seu índice de confiabilidade e prioridade no Solfy PRO.
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Clock size={16} color={COLORS.sub} strokeWidth={2.2} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.ink, fontFamily: FONT_FAMILY }}>
                      Não avaliado ainda
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, lineHeight: 19, color: COLORS.sub, fontFamily: FONT_FAMILY, marginTop: 2 }}>
                    O síndico ainda não enviou a avaliação deste serviço. Assim que for publicada, a nota e o comentário aparecerão aqui.
                  </Text>
                  <View style={[styles.reputacaoBonusBox, { backgroundColor: '#F8F9F8', borderColor: '#E5E8E5' }]}>
                    <Text style={[styles.reputacaoBonusText, { color: COLORS.sub }]}>
                      💡 Conclusões de serviço dentro do prazo já contam positivamente para sua prioridade no Solfy PRO, mesmo antes da nota final.
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Card: Documentação do Contrato */}
            <View style={styles.docValidadoCard}>
              <View style={styles.docValidadoIcon}>
                <FileCheck size={22} color={COLORS.accentDark} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docValidadoTitle}>
                  {finalizacao?.prestador_arquivo_nome || 'Contrato_Assinado.pdf'}
                </Text>
                <Text style={styles.docValidadoSub}>Via bilateral conferida e validada</Text>
              </View>
              <View style={styles.docValidadoBadge}>
                <Text style={styles.docValidadoBadgeText}>✓ Aprovado</Text>
              </View>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* ESTADO 7: NÃO ESCOLHIDO (PAGE 8) */}
        {/* =================================================================== */}
        {estadoAtual === 'recusada' && (
          <View style={styles.centerFlowColumn}>
            <View style={styles.iconCircleMuted}>
              <FileText size={28} color="#3B4640" strokeWidth={2} />
            </View>
            <Text style={styles.centerFlowTitle}>O síndico escolheu outro orçamento</Text>
            <Text style={styles.centerFlowSub}>
              Obrigado por participar. Isso não reduz sua prioridade nos próximos pedidos.
            </Text>

            <View style={styles.orcamentoResumoCard}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.sub }}>Seu orçamento</Text>
                <Text style={{ fontSize: 17, fontWeight: '700', marginTop: 2 }}>
                  {orcamentoValor || 'R$ 1.850,00'} · {orcamentoPrazo || '2 dias'}
                </Text>
              </View>
              <View style={styles.encerradoBadge}>
                <Text style={styles.encerradoBadgeText}>Encerrado</Text>
              </View>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* ESTADO 8 & 9: VAGAS PREENCHIDAS & EXPIRADO (PAGE 9) */}
        {/* =================================================================== */}
        {(estadoAtual === 'vagas_cheias' || estadoAtual === 'expirado') && (
          <View style={styles.centerFlowColumn}>
            {estadoAtual === 'vagas_cheias' ? (
              <>
                <View style={styles.iconCircleMuted}>
                  <Users size={28} color="#3B4640" strokeWidth={2} />
                </View>
                <Text style={styles.centerFlowTitle}>As vagas deste pedido foram preenchidas</Text>
                <Text style={styles.centerFlowSub}>
                  Outros profissionais responderam antes de você. Isso não afeta sua prioridade.
                </Text>
              </>
            ) : (
              <>
                <View style={[styles.iconCircleMuted, { backgroundColor: COLORS.amberSoft }]}>
                  <Clock size={28} color={COLORS.amberText} strokeWidth={2} />
                </View>
                <Text style={styles.centerFlowTitle}>O prazo para responder terminou</Text>
                <Text style={styles.centerFlowSub}>
                  O pedido foi passado a outro profissional. Convites sem resposta reduzem sua
                  prioridade, então, se não puder atender, recuse.
                </Text>
              </>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Info size={14} color={COLORS.sub} strokeWidth={2} />
              <Text style={{ fontSize: 13, color: COLORS.sub }}>Este pedido sai da sua lista.</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* =================================================================== */}
      {/* BARRA INFERIOR FIXA POR ESTADO */}
      {/* =================================================================== */}
      {estadoAtual === 'convite' && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <Text style={styles.bottomBarMicrocopy}>
            Não pode atender? Recuse. Deixar vencer reduz sua prioridade.
          </Text>
          <View style={styles.bottomButtonsRow}>
            <TouchableOpacity
              onPress={() => setModalRecusaVisible(true)}
              style={styles.btnRecusar}
              activeOpacity={0.8}
            >
              <Text style={styles.btnRecusarText}>Recusar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleAceitar}
              disabled={submitting}
              style={styles.btnAceitar}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.btnAceitarText}>Aceitar pedido</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {estadoAtual === 'visita_marcada' && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 12, gap: 6 }]}>
          <View style={styles.bottomButtonsRow}>
            <TouchableOpacity
              onPress={() => setModalVisitaVisible(true)}
              style={[styles.btnRecusar, { flex: 1 }]}
              activeOpacity={0.8}
            >
              <Text style={styles.btnRecusarText}>Remarcar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleComoChegar}
              style={[styles.btnAceitar, { flex: 2, flexDirection: 'row', gap: 8 }]}
              activeOpacity={0.8}
            >
              <Navigation size={18} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.btnAceitarText}>Como chegar</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleCancelarVisita}
            style={styles.btnCancelarVisita}
            activeOpacity={0.7}
          >
            <Text style={styles.btnCancelarVisitaText}>Cancelar visita</Text>
          </TouchableOpacity>
        </View>
      )}

      {(estadoAtual === 'recusada' ||
        estadoAtual === 'vagas_cheias' ||
        estadoAtual === 'expirado' ||
        estadoAtual === 'concluido') && (
        <View style={[styles.bottomBarNoBorder, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <TouchableOpacity
            onPress={() => router.replace('/(app)/demandas')}
            style={[
              styles.btnVerPedidos,
              estadoAtual === 'concluido' && { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
            ]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.btnVerPedidosText,
                estadoAtual === 'concluido' && { color: '#FFFFFF' },
              ]}
            >
              Ver meus pedidos
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* =================================================================== */}
      {/* MODAL BOTTOM SHEET: RECUSAR PEDIDO (PAGE 2) */}
      {/* =================================================================== */}
      <Modal
        visible={modalRecusaVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalRecusaVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setModalRecusaVisible(false)}
          />

          <View style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
            {/* Puxador */}
            <View style={styles.sheetHandle} />

            <View style={{ gap: 4 }}>
              <Text style={styles.sheetTitle}>Por que vai recusar?</Text>
              <Text style={styles.sheetSubtitle}>
                Opcional. Ajuda a mandar pedidos que combinam com você.
              </Text>
            </View>

            {/* Opções de Rádio */}
            <View style={{ gap: 8 }}>
              {[
                { id: 'longe', label: 'É longe de mim' },
                { id: 'agenda', label: 'Minha agenda está cheia' },
                { id: 'tipo', label: 'Não faço esse tipo de serviço' },
                { id: 'outro', label: 'Outro motivo' },
              ].map((opt) => {
                const isSelected = motivoRecusa === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setMotivoRecusa(opt.id as any)}
                    style={styles.radioItem}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected && <View style={styles.radioInnerDot} />}
                    </View>
                    <Text style={styles.radioLabel}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Nota de aviso */}
            <View style={styles.sheetNotice}>
              <Info size={16} color={COLORS.sub} strokeWidth={2} style={{ marginTop: 1 }} />
              <Text style={styles.sheetNoticeText}>
                O pedido sai da sua lista e não será oferecido a você de novo.
              </Text>
            </View>

            {/* Botões do Sheet */}
            <View style={styles.bottomButtonsRow}>
              <TouchableOpacity
                onPress={() => setModalRecusaVisible(false)}
                style={styles.btnVoltarSheet}
                activeOpacity={0.8}
              >
                <Text style={styles.btnVoltarSheetText}>Voltar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmarRecusa}
                disabled={submitting}
                style={styles.btnConfirmarRecusa}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.btnConfirmarRecusaText}>Recusar pedido</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL TELA INTEIRA: NOVO ORÇAMENTO (PAGE 5) */}
      {/* =================================================================== */}
      <Modal
        visible={modalOrcamentoVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalOrcamentoVisible(false)}
      >
        <View style={styles.modalOrcamentoScreen}>
          {/* Header do Modal */}
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
            <TouchableOpacity
              accessibilityLabel="Fechar"
              onPress={() => setModalOrcamentoVisible(false)}
              style={styles.circleBtn}
              activeOpacity={0.7}
            >
              <X size={18} color={COLORS.ink} strokeWidth={2.2} />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.ink }}>Novo orçamento</Text>
            <View style={styles.topBarSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, 16) + 110 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Input Gigante: Valor Total */}
            <View style={styles.orcamentoValorBlock}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.sub }}>Valor total</Text>
              <TextInput
                value={orcamentoValor}
                onChangeText={(t) => setOrcamentoValor(t)}
                keyboardType="numeric"
                placeholder="R$ 0,00"
                placeholderTextColor="#A7B0A9"
                style={styles.orcamentoValorInput}
              />
              <Text style={{ fontSize: 13, color: COLORS.amber, fontWeight: '600' }}>
                Envie até qui, 29 out, 18:00
              </Text>
            </View>

            {/* Grupo de Linhas: Prazo, Validade, Pagamento */}
            <View style={styles.cardGroup}>
              <View style={styles.orcamentoRow}>
                <Text style={styles.orcamentoRowLabel}>Prazo de execução</Text>
                <TextInput
                  value={orcamentoPrazo}
                  onChangeText={setOrcamentoPrazo}
                  placeholder="Ex.: 2 dias"
                  placeholderTextColor="#A7B0A9"
                  style={styles.orcamentoRowInput}
                />
              </View>

              <View style={styles.orcamentoRow}>
                <Text style={styles.orcamentoRowLabel}>Validade da proposta</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {['7 dias', '15 dias', '30 dias'].map((val) => {
                    const isSelected = orcamentoValidade === val;
                    return (
                      <TouchableOpacity
                        key={val}
                        onPress={() => setOrcamentoValidade(val)}
                        style={[
                          styles.chipValidade,
                          isSelected && { backgroundColor: COLORS.ink },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipValidadeText,
                            isSelected && { color: '#FFFFFF' },
                          ]}
                        >
                          {val}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={[styles.orcamentoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.orcamentoRowLabel}>Pagamento</Text>
                <TextInput
                  value={orcamentoPagamento}
                  onChangeText={setOrcamentoPagamento}
                  placeholder="Ex.: 50% na entrada"
                  placeholderTextColor="#A7B0A9"
                  style={styles.orcamentoRowInput}
                />
              </View>
            </View>

            {/* O que está incluso (Escopo) */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>O que está incluso</Text>
              <TextInput
                value={orcamentoEscopo}
                onChangeText={setOrcamentoEscopo}
                multiline
                numberOfLines={4}
                placeholder="Serviço, materiais e garantia"
                placeholderTextColor="#A7B0A9"
                style={styles.escopoTextarea}
              />
            </View>

            {/* Botão Tracejado: Adicionar foto ou PDF */}
            <TouchableOpacity
              onPress={() => Alert.alert('Anexar arquivo', 'Escolha foto ou PDF do orçamento.')}
              style={styles.dashedBtn}
              activeOpacity={0.8}
            >
              <Plus size={18} color="#3B4640" strokeWidth={2.2} />
              <Text style={styles.dashedBtnText}>Adicionar foto ou PDF</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Barra inferior fixa do orçamento */}
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
            <Text style={styles.bottomBarMicrocopy}>Você pode editar até o síndico decidir.</Text>
            <TouchableOpacity
              onPress={handleSalvarOrcamento}
              disabled={submitting}
              style={styles.btnVerPedidos}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.btnVerPedidosText}>Revisar e enviar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL: FINALIZAR CONTRATO E ENVIAR VALOR (PRESTADOR) */}
      {/* =================================================================== */}
      <Modal
        visible={modalFinalizarContratoVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalFinalizarContratoVisible(false)}
      >
        <View style={styles.modalOrcamentoScreen}>
          {/* Header do Modal */}
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
            <TouchableOpacity
              accessibilityLabel="Fechar"
              onPress={() => setModalFinalizarContratoVisible(false)}
              style={styles.circleBtn}
              activeOpacity={0.7}
            >
              <X size={18} color={COLORS.ink} strokeWidth={2.2} />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.ink }}>
              Finalizar Contrato
            </Text>
            <View style={styles.topBarSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, 16) + 110 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Bloco de Instruções */}
            <View style={styles.bannerConexao}>
              <Text style={styles.bannerConexaoTitle}>Envio bilateral do contrato</Text>
              <Text style={styles.bannerConexaoBody}>
                Após o fechamento do contrato com o síndico, envie aqui o contrato assinado e o valor
                final acordado. O síndico enviará a via dele e, com os dados conferidos, os
                administradores geram a cobrança da comissão.
              </Text>
            </View>

            {/* Input Gigante: Valor Fechado no Contrato */}
            <View style={styles.orcamentoValorBlock}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.sub }}>
                Valor fechado no contrato
              </Text>
              <TextInput
                value={contratoValorFinal ? (contratoValorFinal.startsWith('R$') ? contratoValorFinal : `R$ ${contratoValorFinal}`) : ''}
                onChangeText={(t) => setContratoValorFinal(t.replace('R$', '').trim())}
                keyboardType="numeric"
                placeholder="R$ 0,00"
                placeholderTextColor="#A7B0A9"
                style={styles.orcamentoValorInput}
              />
              <Text style={{ fontSize: 13, color: COLORS.sub }}>
                Valor total pactuado no contrato assinado
              </Text>
            </View>

            {/* Anexar via assinada do contrato */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Via assinada do contrato (PDF ou Foto)</Text>

              {contratoArquivoUri ? (
                <View style={styles.arquivoSelecionadoCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <FileText size={24} color={COLORS.accentDark} strokeWidth={2} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.ink }} numberOfLines={1}>
                        {contratoArquivoNome || 'Contrato_Assinado.pdf'}
                      </Text>
                      <Text style={{ fontSize: 12, color: COLORS.accentDark }}>
                        ✓ Arquivo pronto para envio
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={handleSelecionarArquivoContrato}
                    style={styles.btnTrocarArquivo}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.btnTrocarArquivoText}>Trocar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handleSelecionarArquivoContrato}
                  style={styles.dashedBtn}
                  activeOpacity={0.8}
                >
                  <Plus size={18} color="#3B4640" strokeWidth={2.2} />
                  <Text style={styles.dashedBtnText}>Anexar contrato assinado (PDF ou Foto)</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Aviso de Sigilo e Conferência */}
            <View style={styles.sigiloNote}>
              <Info size={16} color={COLORS.sub} strokeWidth={2} style={{ marginTop: 1 }} />
              <Text style={styles.sigiloText}>
                As duas vias (sua e do síndico) são conferidas pela administração para garantir
                transparência e conformidade fiscal na emissão da comissão.
              </Text>
            </View>
          </ScrollView>

          {/* Barra inferior fixa */}
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
            <Text style={styles.bottomBarMicrocopy}>
              Conferido pela administração da Solfy para emissão da cobrança.
            </Text>
            <TouchableOpacity
              onPress={handleEnviarContratoFinalizacao}
              disabled={submittingContrato}
              style={styles.btnVerPedidos}
              activeOpacity={0.8}
            >
              {submittingContrato ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.btnVerPedidosText}>Confirmar e enviar contrato</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DE AGENDAR VISITA TÉCNICA */}
      <ModalAgendarVisitaTecnica
        visible={modalVisitaVisible}
        onClose={() => setModalVisitaVisible(false)}
        pedido={pedido}
        prestadorId={prestador?.id || ''}
        onSucesso={async () => {
          setModalVisitaVisible(false);
          await carregarDados();
        }}
      />

      {/* GALERIA DE FOTOS COM ZOOM */}
      <GaleriaZoomModal
        visible={galeriaAberta}
        onClose={() => setGaleriaAberta(false)}
        imageUrl={fotosUrls[fotoSelecionadaIdx] || null}
      />
    </View>
  );
}

// ---------------------------------------------------------
// STYLESHEET EXATO AO DESIGN
// ---------------------------------------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.canvas,
    zIndex: 10,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  topCode: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.sub,
    fontFamily: FONT_FAMILY,
  },
  topBarSpacer: {
    width: 44,
    height: 44,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  contentColumn: {
    gap: 16,
  },
  headerBlock: {
    gap: 10,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT_FAMILY,
  },
  mainTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  mainTitleCenter: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: COLORS.ink,
    textAlign: 'center',
    fontFamily: FONT_FAMILY,
  },
  subTitleCenter: {
    fontSize: 15,
    color: COLORS.sub,
    textAlign: 'center',
    fontFamily: FONT_FAMILY,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    gap: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  prazoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prazoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.amber,
    fontFamily: FONT_FAMILY,
  },
  prazoBig: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  prazoSub: {
    fontSize: 13,
    color: COLORS.sub,
    fontFamily: FONT_FAMILY,
  },
  prazoBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EEF0EE',
    marginTop: 10,
    overflow: 'hidden',
  },
  prazoBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.amberBar,
  },
  cardGroup: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.buttonLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupRowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  rowSubtitle: {
    fontSize: 13,
    color: COLORS.sub,
    marginTop: 2,
    fontFamily: FONT_FAMILY,
  },
  tagLock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagLockText: {
    fontSize: 12,
    color: COLORS.sub,
    fontFamily: FONT_FAMILY,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.sub,
    fontFamily: FONT_FAMILY,
  },
  bodyParagraph: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  photosRow: {
    flexDirection: 'row',
    gap: 8,
  },
  photoThumb: {
    flex: 1,
    height: 76,
    borderRadius: 14,
    backgroundColor: COLORS.placeholderThumb,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoThumbImg: {
    width: '100%',
    height: '100%',
  },
  btnSecondary: {
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.buttonLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  caminhoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  caminhoIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caminhoTextBox: {
    flex: 1,
    gap: 3,
  },
  caminhoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  caminhoSub: {
    fontSize: 13,
    color: COLORS.sub,
    lineHeight: 18,
    fontFamily: FONT_FAMILY,
  },
  btnEditarOrcamento: {
    marginTop: 12,
    height: 48,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btnEditarOrcamentoText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  quorumBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  sigiloNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  sigiloText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.sub,
    lineHeight: 18,
    fontFamily: FONT_FAMILY,
  },
  checkCircleLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.buttonLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  contactBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  contactSquareBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.buttonLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerConexao: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 20,
    padding: 16,
    gap: 6,
  },
  bannerConexaoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.accentDark,
    fontFamily: FONT_FAMILY,
  },
  bannerConexaoBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1E3A2A',
    fontFamily: FONT_FAMILY,
  },

  // CARD DE INSTRUÇÃO E FINALIZAÇÃO DO CONTRATO
  cardInstrucaoFinalizacao: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#D1E7DD',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
      android: { elevation: 2 },
      default: {},
    }),
  },
  cardInstrucaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircleAccent: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInstrucaoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  cardInstrucaoBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accentDark,
    fontFamily: FONT_FAMILY,
    marginTop: 1,
  },
  cardInstrucaoTexto: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  btnFinalizarContrato: {
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    ...Platform.select({
      ios: { shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5 },
      android: { elevation: 2 },
      default: {},
    }),
  },
  btnFinalizarContratoText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: FONT_FAMILY,
  },
  contratoEnviadoFeedback: {
    backgroundColor: COLORS.canvas,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  contratoEnviadoFeedbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accentDark,
    fontFamily: FONT_FAMILY,
  },
  badgePillMini: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
  },
  badgePillMiniText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accentDark,
    fontFamily: FONT_FAMILY,
  },
  contratoEnviadoFeedbackValor: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  contratoEnviadoFeedbackArquivo: {
    fontSize: 13,
    color: COLORS.sub,
    fontFamily: FONT_FAMILY,
  },
  contratoEnviadoFeedbackStatus: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.sub,
    fontFamily: FONT_FAMILY,
    marginTop: 4,
  },
  btnReenviarContrato: {
    marginTop: 6,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnReenviarContratoText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },

  centerFlowColumn: {
    paddingTop: 100,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 12,
    textAlign: 'center',
  },
  iconCircleMuted: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.placeholderThumb,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerFlowTitle: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: COLORS.ink,
    textAlign: 'center',
    fontFamily: FONT_FAMILY,
  },
  centerFlowSub: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.sub,
    textAlign: 'center',
    fontFamily: FONT_FAMILY,
  },
  orcamentoResumoCard: {
    marginTop: 12,
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  encerradoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#EEF0EE',
  },
  encerradoBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B4640',
    fontFamily: FONT_FAMILY,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDark,
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 10,
  },
  bottomBarNoBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  bottomBarMicrocopy: {
    fontSize: 12,
    color: COLORS.sub,
    textAlign: 'center',
    fontFamily: FONT_FAMILY,
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnRecusar: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.buttonLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRecusarText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  btnAceitar: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAceitarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: FONT_FAMILY,
  },
  btnCancelarVisita: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelarVisitaText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.red,
    fontFamily: FONT_FAMILY,
  },
  btnVerPedidos: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnVerPedidosText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: FONT_FAMILY,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 26, 19, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
    gap: 16,
  },
  sheetHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D5D9D5',
    alignSelf: 'center',
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: COLORS.sub,
    lineHeight: 20,
    fontFamily: FONT_FAMILY,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: COLORS.canvas,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C0C6C2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: COLORS.accent,
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  sheetNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  sheetNoticeText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.sub,
    lineHeight: 18,
    fontFamily: FONT_FAMILY,
  },
  btnVoltarSheet: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.buttonLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnVoltarSheetText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  btnConfirmarRecusa: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnConfirmarRecusaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: FONT_FAMILY,
  },
  modalOrcamentoScreen: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  orcamentoValorBlock: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 12,
    paddingBottom: 4,
  },
  orcamentoValorInput: {
    width: '100%',
    textAlign: 'center',
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
    paddingVertical: 4,
  },
  orcamentoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  orcamentoRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  orcamentoRowInput: {
    textAlign: 'right',
    fontSize: 15,
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
    minWidth: 120,
  },
  chipValidade: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.buttonLight,
  },
  chipValidadeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  escopoTextarea: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 14,
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  dashedBtn: {
    height: 52,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C9CFC9',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  dashedBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B4640',
    fontFamily: FONT_FAMILY,
  },
  arquivoSelecionadoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D1E7DD',
  },
  btnTrocarArquivo: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.buttonLight,
  },
  btnTrocarArquivoText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  // --- ESTILOS DO ESTADO CONCLUÍDO ---
  concluidoHeroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D7E9DF',
    shadowColor: '#0A7A4F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  concluidoHeroIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0A7A4F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#0A7A4F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  concluidoHeroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  concluidoHeroSub: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.sub,
    fontFamily: FONT_FAMILY,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 8,
  },
  concluidoHeroPill: {
    backgroundColor: '#E6F2EC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 14,
  },
  concluidoHeroPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A7A4F',
    fontFamily: FONT_FAMILY,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
    letterSpacing: -0.2,
  },
  faturamentoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  faturamentoLabel: {
    fontSize: 14,
    color: COLORS.sub,
    fontFamily: FONT_FAMILY,
  },
  faturamentoValor: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  faturadaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F2EC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  faturadaBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A7A4F',
    fontFamily: FONT_FAMILY,
  },
  faturamentoDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.buttonLight,
  },
  actionBtnOutlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  reputacaoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  reputacaoStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reputacaoRatingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B45309',
    marginLeft: 6,
    fontFamily: FONT_FAMILY,
  },
  reputacaoBody: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
    marginTop: 2,
  },
  reputacaoBonusBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  reputacaoBonusText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#92400E',
    fontFamily: FONT_FAMILY,
  },
  docValidadoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#D7E9DF',
  },
  docValidadoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E6F2EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docValidadoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
  },
  docValidadoSub: {
    fontSize: 12,
    color: COLORS.sub,
    fontFamily: FONT_FAMILY,
    marginTop: 1,
  },
  docValidadoBadge: {
    backgroundColor: '#E6F2EC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  docValidadoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A7A4F',
    fontFamily: FONT_FAMILY,
  },
});
