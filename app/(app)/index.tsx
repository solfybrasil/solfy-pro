import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Dimensions,
  InteractionManager,
  LayoutAnimation,
  UIManager,
  Modal,
  TextInput,
  AppState,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Droplets,
  Flame,
  Hammer,
  HelpCircle,
  Layers,
  MapPin,
  MessageSquare,
  Paintbrush,
  Plus,
  ShieldCheck,
  Sliders,
  Sparkles,
  Star,
  Sun,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { SolfyLoader } from '../../components/SolfyLoader';
import { NotificationBell } from '../../components/NotificationBell';
import AuroraBackground from '../../components/AuroraBackground';
import { BannerBloqueioComissao } from '../../components/BannerBloqueioComissao';
import { TermoAceiteCnpjGrandeModal } from '../../components/TermoAceiteCnpjGrandeModal';
import { HomeBannersCarousel } from '../../components/HomeBannersCarousel';
import { HomeGlassMainCard } from '../../components/HomeGlassMainCard';
import { ModalPagamentoComissaoPix } from '../../components/ModalPagamentoComissaoPix';
import {
  buscarResumoHomePrestador,
  PrestadorResumoHome,
} from '../../lib/prestadorHomeApi';
import {
  buscarOportunidadesHome,
  aceitarConviteDespacho,
  recusarConviteDespacho,
  OportunidadeCard,
} from '../../lib/prestadorPedidosApi';
import { supabase } from '../../lib/supabase';

// Habilita LayoutAnimation no Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getCategoryIcon = (categoria?: string) => {
  const cat = (categoria || '').toLowerCase();
  if (cat.includes('eletric') || cat.includes('luz') || cat.includes('energia')) return Zap;
  if (cat.includes('hidraul') || cat.includes('vaza') || cat.includes('encan') || cat.includes('água') || cat.includes('agua')) return Droplets;
  if (cat.includes('pint')) return Paintbrush;
  if (cat.includes('estrut') || cat.includes('obra') || cat.includes('reforma') || cat.includes('civil')) return Hammer;
  if (cat.includes('solar')) return Sun;
  return Wrench;
};

function formatarTempoRestante(segundos: number): string {
  if (segundos <= 0) return 'Expirado';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  }
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default function PrestadorHomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ oportunidade?: string; destaque?: string }>();
  const {
    user,
    perfil,
    prestador,
    inadimplencia,
    recarregarInadimplencia,
    termoCnpjGrandeAceito,
    recarregarTermoCnpj,
    isLoading: authLoading,
  } = useAuth();
  const { naoLidasTotal } = useNotifications();
  const insets = useSafeAreaInsets();
  const headerPaddingTop = Math.max(insets.top, Platform.OS === 'android' ? 24 : 16) + 4;

  const [oportunidades, setOportunidades] = useState<OportunidadeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [termoModalOpen, setTermoModalOpen] = useState(false);

  // Card Principal de Vidro (Resumo consolidado via RPC prestador_resumo_home)
  const [resumoHome, setResumoHome] = useState<PrestadorResumoHome | null>(null);
  const [loadingResumo, setLoadingResumo] = useState(true);
  const [erroResumo, setErroResumo] = useState<string | null>(null);
  const [modalPixVisible, setModalPixVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const oportunidadesSectionYRef = useRef<number>(0);

  // Cobrança formatada para o modal de pagamento PIX
  const cobrancaParaPagar = useMemo(() => {
    if (!resumoHome?.financeiro) return null;
    const f = resumoHome.financeiro;
    return {
      id: f.cobranca_id || 'cobranca_resumo',
      solicitacao_id: '',
      base_centavos: Math.round((f.valor_total || 0) * 100),
      percentual: 10,
      valor_centavos: Math.round((f.valor_total || 0) * 100),
      valor_reais: f.valor_total || 0,
      status: (f.situacao === 'vencida' ? 'vencida' : 'pendente') as any,
      vencimento: f.vencimento_formatado || new Date().toISOString(),
      bloqueia_novos_pedidos: f.situacao === 'vencida',
      criado_em: new Date().toISOString(),
      solicitacao_categoria: 'Comissão Solfy',
      solicitacao_descricao: f.texto_linha,
      condominio_nome: 'Solfy Serviços',
      chave_pix: f.pix_copia_cola || '',
      codigo_pix_copia_cola: f.pix_copia_cola || undefined,
    };
  }, [resumoHome?.financeiro]);

  // Estados de ações
  const [aceitandoId, setAceitandoId] = useState<string | null>(null);
  const [modalSucessoAceite, setModalSucessoAceite] = useState<{ visivel: boolean; titulo: string } | null>(null);

  // Modal de Recusa
  const [recusandoCard, setRecusandoCard] = useState<OportunidadeCard | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState<'indisponivel' | 'fora_raio' | 'agenda_lotada' | 'outro'>('indisponivel');
  const [obsRecusa, setObsRecusa] = useState('');
  const [processandoRecusa, setProcessandoRecusa] = useState(false);

  // Animação e remoção suave de card
  const removerCardAnimado = useCallback((solicitacaoId: string) => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOportunidades((prev) => prev.filter((o) => o.solicitacao_id !== solicitacaoId));
  }, []);

  const recarregarInadimplenciaRef = useRef(recarregarInadimplencia);
  useEffect(() => {
    recarregarInadimplenciaRef.current = recarregarInadimplencia;
  }, [recarregarInadimplencia]);

  // 1. CARREGAR RESUMO HOME DA RPC DO SERVIDOR (prestador_resumo_home)
  const carregarResumoHome = useCallback(async () => {
    if (!prestador?.id) {
      setResumoHome(null);
      setLoadingResumo(false);
      return;
    }

    try {
      setErroResumo(null);
      const data = await buscarResumoHomePrestador(prestador.id);
      setResumoHome(data);
    } catch (err: any) {
      console.error('[DashboardPrestador] Erro ao carregar resumo do card principal:', err);
      setErroResumo(err?.message || 'Falha ao atualizar dados');
    } finally {
      setLoadingResumo(false);
    }
  }, [prestador?.id]);

  // 1.1 CARREGAR OPORTUNIDADES DA RPC DO SERVIDOR (prestador_oportunidades)
  const carregarDados = useCallback(async () => {
    if (!prestador?.id) {
      setOportunidades([]);
      setLoading(false);
      return;
    }

    try {
      const data = await buscarOportunidadesHome(prestador.id);
      setOportunidades(data || []);
      recarregarInadimplenciaRef.current?.().catch(() => {});
    } catch (err) {
      console.error('[DashboardPrestador] Erro ao carregar oportunidades:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [prestador?.id]);

  const carregarTudo = useCallback(() => {
    carregarDados();
    carregarResumoHome();
  }, [carregarDados, carregarResumoHome]);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  useFocusEffect(
    useCallback(() => {
      carregarTudo();
    }, [carregarTudo])
  );

  // Recarregar ao voltar do segundo plano (AppState = 'active')
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        carregarResumoHome();
        carregarDados();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [carregarResumoHome, carregarDados]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    carregarDados();
    carregarResumoHome();
  }, [carregarDados, carregarResumoHome]);

  // 2. CRONÔMETRO VIVO (Contagem regressiva de segundos em tempo real)
  useEffect(() => {
    const timer = setInterval(() => {
      setOportunidades((atuais) => {
        let mudou = false;
        const filtradas: OportunidadeCard[] = [];
        for (const op of atuais) {
          const restante = op.segundos_restantes_aceite - 1;
          if (restante <= 0) {
            mudou = true;
            // O prazo de resposta esgotou: remove o card da lista
            continue;
          }
          if (restante !== op.segundos_restantes_aceite) {
            mudou = true;
            filtradas.push({ ...op, segundos_restantes_aceite: restante });
          } else {
            filtradas.push(op);
          }
        }
        return mudou ? filtradas : atuais;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 3. TEMPO REAL: Quando vagas preenchem, prazo vence ou pedido é cancelado/fechado, card SOME na hora
  useEffect(() => {
    if (!prestador?.id) return;

    const channelName = `realtime_home_oportunidades_${prestador.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitacao_despacho',
          filter: `prestador_id=eq.${prestador.id}`,
        },
        (payload) => {
          const status = (payload.new as any)?.status_prestador;
          if (
            status &&
            ['vagas_preenchidas', 'expirado', 'recusado', 'aceito_cotar', 'sem_resposta'].includes(status)
          ) {
            removerCardAnimado((payload.new as any).solicitacao_id);
          } else {
            carregarDados();
          }
          carregarResumoHome();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'solicitacoes',
        },
        (payload) => {
          const st = (payload.new as any)?.status;
          if (['cancelada', 'concluida', 'contrato_fechado', 'em_execucao', 'finalizada'].includes(st)) {
            removerCardAnimado((payload.new as any).id);
          }
          carregarResumoHome();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financeiro_cobrancas',
          filter: `prestador_id=eq.${prestador.id}`,
        },
        () => {
          carregarResumoHome();
          recarregarInadimplencia().catch(() => {});
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordens_pagamento_comissao',
          filter: `prestador_id=eq.${prestador.id}`,
        },
        () => {
          carregarResumoHome();
          recarregarInadimplencia().catch(() => {});
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitacao_visitas_tecnicas',
          filter: `prestador_id=eq.${prestador.id}`,
        },
        () => {
          carregarResumoHome();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [prestador?.id]);

  // Se for CNPJ de Grande Porte e ainda não tiver aceito o termo digital, abre o modal
  useEffect(() => {
    if (
      prestador &&
      (prestador.apto_servicos_grandes === false || termoCnpjGrandeAceito === false)
    ) {
      setTermoModalOpen(true);
    }
  }, [prestador, termoCnpjGrandeAceito]);

  // 4. AÇÃO: ACEITAR CONVITE
  const handleAceitar = async (card: OportunidadeCard) => {
    if (!prestador?.id || aceitandoId) return;

    try {
      setAceitandoId(card.despacho_id);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }

      const res = await aceitarConviteDespacho(card.despacho_id, prestador.id);

      if (res.sucesso) {
        // Transição: Remove o card da Home imediatamente com animação suave
        removerCardAnimado(card.solicitacao_id);
        setModalSucessoAceite({
          visivel: true,
          titulo: card.titulo,
        });
      } else {
        // Se já expirou ou vagas foram preenchidas, remove da Home
        removerCardAnimado(card.solicitacao_id);
        alert(res.mensagem || 'Não foi possível aceitar este convite.');
      }
    } catch (err: any) {
      console.error('[Home] Erro ao aceitar:', err);
      alert('Erro de conexão ao aceitar convite.');
    } finally {
      setAceitandoId(null);
    }
  };

  // 5. AÇÃO: RECUSAR CONVITE
  const handleConfirmarRecusa = async () => {
    if (!recusandoCard || !prestador?.id || processandoRecusa) return;

    try {
      setProcessandoRecusa(true);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      await recusarConviteDespacho(
        recusandoCard.despacho_id,
        prestador.id,
        motivoRecusa,
        obsRecusa.trim() || undefined
      );

      // Card some da Home e nunca mais volta
      removerCardAnimado(recusandoCard.solicitacao_id);
      setRecusandoCard(null);
      setObsRecusa('');
    } catch (err) {
      console.error('[Home] Erro ao recusar:', err);
      alert('Erro ao registrar recusa.');
    } finally {
      setProcessandoRecusa(false);
    }
  };

  if (authLoading) {
    return <SolfyLoader fullscreen size="lg" />;
  }

  if (!user) {
    return null;
  }

  const nomeExibicao = prestador?.name || (perfil as any)?.nome_exibicao || perfil?.nome_completo || 'Prestador';
  const nivelPrestador = (prestador?.nivel || 'BRONZE').toUpperCase();
  const notaPrestador =
    typeof prestador?.rating === 'number' && prestador.rating > 0
      ? prestador.rating.toFixed(1).replace('.', ',')
      : '5,0';

  const itemDestaqueId = params.oportunidade || params.destaque;

  return (
    <View style={styles.container}>
      {/* ── GRADIENTE SUTIL DE FUNDO ── */}
      <View style={[styles.ambientBackground, { pointerEvents: 'none' }]}>
        <AuroraBackground lightMode={true} />
        <LinearGradient
          colors={['transparent', 'rgba(248, 250, 252, 0.1)', 'rgba(248, 250, 252, 0.65)', '#F8FAFC']}
          start={{ x: 0, y: 0.7 }}
          end={{ x: 0, y: 1.0 }}
          style={[StyleSheet.absoluteFillObject, { pointerEvents: 'none' }]}
        />
      </View>

      <View style={{ flex: 1 }}>
        {/* ── TOP HEADER (ESTILO SOLFY CONDO: AVATAR / NOME / NOTA / NOTIFICAÇÕES) ── */}
        <View style={[styles.topHeader, { paddingTop: headerPaddingTop }]}>
          <TouchableOpacity
            style={styles.headerLeftProfile}
            activeOpacity={0.8}
            onPress={() => router.push('/(app)/perfil')}
          >
            <Wrench size={24} color="#FFFFFF" strokeWidth={2.2} />

            <View style={styles.headerProfileText}>
              <Text style={styles.headerName} numberOfLines={1}>
                {nomeExibicao}
              </Text>
              <View style={styles.headerRatingRow}>
                <Star size={12} color="#FBBF24" fill="#FBBF24" />
                <Text style={styles.headerRatingValue}>{notaPrestador}</Text>
                <Text style={styles.headerRoleDot}>•</Text>
                <Text style={styles.headerRole}>Nível {nivelPrestador}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <NotificationBell />
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 110 + Math.max(insets.bottom, 24) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4A5835"
              colors={['#4A5835']}
            />
          }
        >
          {/* Banner de Bloqueio por Comissão em Atraso (se houver inadimplência) */}
          {inadimplencia && (
            <BannerBloqueioComissao inadimplencia={inadimplencia} onRefresh={carregarDados} />
          )}

          {/* ── 1. CARD SUPERIOR PRINCIPAL (EFEITO VIDRO / GLASS CARD REESTRUTURADO) ── */}
          <HomeGlassMainCard
            resumo={resumoHome}
            loading={loadingResumo}
            erro={erroResumo}
            onRetry={carregarResumoHome}
            onPressOportunidades={() => {
              if (oportunidadesSectionYRef.current > 0) {
                scrollViewRef.current?.scrollTo({
                  y: Math.max(0, oportunidadesSectionYRef.current - 16),
                  animated: true,
                });
              }
            }}
            onPressPagar={() => {
              if (resumoHome?.financeiro?.pix_copia_cola || resumoHome?.financeiro?.cobranca_id) {
                setModalPixVisible(true);
              } else {
                router.push('/(app)/financeiro' as any);
              }
            }}
          />

          {/* ── BANNERS NO TOPO DA HOME (ACIMA DE OPORTUNIDADES) ── */}
          <HomeBannersCarousel onRefreshTrigger={refreshing ? 1 : 0} />

          {/* ── 2. SEÇÃO OPORTUNIDADES (SUBSTITUI O HISTÓRICO DE DEMANDAS) ── */}
          <View
            style={styles.oportunidadesSection}
            onLayout={(e) => {
              oportunidadesSectionYRef.current = e.nativeEvent.layout.y;
            }}
          >
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Oportunidades</Text>
                <Text style={styles.sectionSubtitle}>
                  Chamados disponíveis na sua região aguardando sua resposta
                </Text>
              </View>

              {oportunidades.length > 0 && (
                <View style={styles.liveIndicatorBadge}>
                  <View style={styles.pulseDot} />
                  <Text style={styles.liveIndicatorText}>Ao vivo</Text>
                </View>
              )}
            </View>

            {/* ESTADO VAZIO */}
            {oportunidades.length === 0 ? (
              <View style={styles.emptyCardContainer}>
                <View style={styles.emptyIconCircle}>
                  <Compass size={28} color="#2E5A36" strokeWidth={2} />
                </View>
                <Text style={styles.emptyTitle}>Nenhuma oportunidade agora</Text>
                <Text style={styles.emptySubtitle}>
                  Avisaremos quando chegar um novo chamado compatível com a sua especialidade e localização.
                </Text>

                <View style={styles.emptyShortcutsRow}>
                  <TouchableOpacity
                    style={styles.emptyShortcutBtn}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                      router.push('/(app)/perfil/disponibilidade');
                    }}
                  >
                    <Clock size={15} color="#2E5A36" strokeWidth={2.2} />
                    <Text style={styles.emptyShortcutText}>Disponibilidade</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.emptyShortcutBtn}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                      router.push('/(app)/perfil/especialidades_raio');
                    }}
                  >
                    <Sliders size={15} color="#2E5A36" strokeWidth={2.2} />
                    <Text style={styles.emptyShortcutText}>Raio de Atendimento</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* LISTAGEM DE CARDS DE OPORTUNIDADE */
              <View style={styles.cardsList}>
                {oportunidades.map((op, idx) => {
                  const ItemIcon = getCategoryIcon(op.categoria);
                  const isDestaque = itemDestaqueId === op.solicitacao_id;
                  const urgente = op.segundos_restantes_aceite <= 1800; // Menos de 30 minutos

                  return (
                    <Animated.View
                      key={op.despacho_id || op.solicitacao_id}
                      entering={FadeInDown.delay(idx * 60).duration(350)}
                      exiting={FadeOutDown.duration(250)}
                      style={[
                        styles.opCard,
                        isDestaque && styles.opCardDestaque,
                        op.eh_emergencia && styles.opCardEmergencia,
                      ]}
                    >
                      {/* Topo do Card: Categoria, Selo Emergência e Cronômetro */}
                      <View style={styles.opCardHeaderRow}>
                        <View style={styles.opCategoryBadge}>
                          <ItemIcon size={13} color="#2E5A36" strokeWidth={2.4} />
                          <Text style={styles.opCategoryText}>
                            {op.categoria.toUpperCase()}
                          </Text>
                        </View>

                        <View style={styles.opBadgesRight}>
                          {op.eh_emergencia && (
                            <View style={styles.emergenciaBadge}>
                              <Flame size={12} color="#DC2626" fill="#DC2626" />
                              <Text style={styles.emergenciaText}>EMERGÊNCIA</Text>
                            </View>
                          )}

                          {/* Cronômetro "Responda até..." */}
                          <View
                            style={[
                              styles.timerBadge,
                              urgente && styles.timerBadgeUrgente,
                            ]}
                          >
                            <Clock
                              size={12}
                              color={urgente ? '#DC2626' : '#5C6B61'}
                              strokeWidth={2.2}
                            />
                            <Text
                              style={[
                                styles.timerText,
                                urgente && styles.timerTextUrgente,
                              ]}
                            >
                              {formatarTempoRestante(op.segundos_restantes_aceite)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Título da Demanda */}
                      <Text style={styles.opTitulo} numberOfLines={2}>
                        {op.titulo || `${op.categoria} Predial`}
                      </Text>

                      {/* Localização protegida (sem expor endereço físico) */}
                      <View style={styles.opMetaRow}>
                        <MapPin size={14} color="#5C6B61" strokeWidth={2} />
                        <Text style={styles.opMetaText} numberOfLines={1}>
                          {op.bairro}, {op.cidade} •{' '}
                          <Text style={styles.opDistanciaText}>
                            {op.distancia_km.toFixed(1).replace('.', ',')} km
                          </Text>
                        </Text>
                      </View>

                      {/* Descrição resumida */}
                      {!!op.descricao && (
                        <Text style={styles.opDescricao} numberOfLines={2}>
                          {op.descricao}
                        </Text>
                      )}

                      {/* Vagas restantes */}
                      <View style={styles.opVagasRow}>
                        <Users size={12} color="#8A978E" />
                        <Text style={styles.opVagasText}>
                          {op.vagas_restantes}{' '}
                          {op.vagas_restantes === 1 ? 'vaga restante' : 'vagas restantes'}{' '}
                          para orçamento
                        </Text>
                      </View>

                      {/* Divisor */}
                      <View style={styles.opDivider} />

                      {/* Botões de Ação: Ver / Recusar / Aceitar */}
                      <View style={styles.opActionsRow}>
                        <TouchableOpacity
                          style={styles.opBtnVer}
                          activeOpacity={0.75}
                          onPress={() => {
                            if (Platform.OS !== 'web') {
                              Haptics.selectionAsync().catch(() => {});
                            }
                            router.push(`/(app)/demandas/${op.solicitacao_id}`);
                          }}
                        >
                          <Text style={styles.opBtnVerText}>Ver detalhes</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.opBtnRecusar}
                          activeOpacity={0.75}
                          onPress={() => {
                            setRecusandoCard(op);
                          }}
                        >
                          <Text style={styles.opBtnRecusarText}>Recusar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.opBtnAceitar,
                            aceitandoId === op.despacho_id && styles.opBtnAceitarDesativado,
                          ]}
                          activeOpacity={0.8}
                          disabled={aceitandoId === op.despacho_id}
                          onPress={() => handleAceitar(op)}
                        >
                          {aceitandoId === op.despacho_id ? (
                            <Text style={styles.opBtnAceitarText}>Aceitando...</Text>
                          ) : (
                            <>
                              <Check size={15} color="#FFFFFF" strokeWidth={2.6} />
                              <Text style={styles.opBtnAceitarText}>Aceitar</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* ── MODAL DE CONFIRMAÇÃO DE RECUSA ── */}
      <Modal
        visible={!!recusandoCard}
        transparent
        animationType="fade"
        onRequestClose={() => setRecusandoCard(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Recusar Oportunidade</Text>
              <TouchableOpacity
                onPress={() => setRecusandoCard(null)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color="#5C6B61" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Selecione o motivo para recusar "{recusandoCard?.titulo}". O chamado sairá da sua lista imediatamente.
            </Text>

            <View style={styles.motivosList}>
              {[
                { id: 'indisponivel', label: 'Indisponível no momento' },
                { id: 'agenda_lotada', label: 'Agenda lotada para a data' },
                { id: 'fora_raio', label: 'Fora da minha área de atuação' },
                { id: 'outro', label: 'Outro motivo' },
              ].map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.motivoRadioRow,
                    motivoRecusa === m.id && styles.motivoRadioRowAtivo,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setMotivoRecusa(m.id as any)}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      motivoRecusa === m.id && styles.radioCircleAtivo,
                    ]}
                  >
                    {motivoRecusa === m.id && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.motivoLabel}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {motivoRecusa === 'outro' && (
              <TextInput
                style={styles.inputObs}
                placeholder="Descreva brevemente (opcional)"
                placeholderTextColor="#94A3B8"
                value={obsRecusa}
                onChangeText={setObsRecusa}
                maxLength={140}
              />
            )}

            <View style={styles.modalBtnsRow}>
              <TouchableOpacity
                style={styles.modalBtnCancelar}
                onPress={() => setRecusandoCard(null)}
                disabled={processandoRecusa}
              >
                <Text style={styles.modalBtnCancelarText}>Voltar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalBtnConfirmarRecusa}
                onPress={handleConfirmarRecusa}
                disabled={processandoRecusa}
              >
                <Text style={styles.modalBtnConfirmarRecusaText}>
                  {processandoRecusa ? 'Recusando...' : 'Confirmar recusa'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL DE CONFIRMAÇÃO DE ACEITE ── */}
      <Modal
        visible={!!modalSucessoAceite?.visivel}
        transparent
        animationType="fade"
        onRequestClose={() => setModalSucessoAceite(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center' }]}>
            <View style={styles.sucessoIconCircle}>
              <CheckCircle2 size={36} color="#059669" strokeWidth={2.4} />
            </View>

            <Text style={styles.sucessoModalTitle}>Pedido adicionado às suas demandas!</Text>
            <Text style={styles.sucessoModalSubtitle}>
              Você aceitou participar de "{modalSucessoAceite?.titulo}". Acompanhe e agende visita ou envie sua proposta na aba Demandas.
            </Text>

            <View style={styles.sucessoBtnsRow}>
              <TouchableOpacity
                style={styles.sucessoBtnFicar}
                onPress={() => setModalSucessoAceite(null)}
              >
                <Text style={styles.sucessoBtnFicarText}>Continuar na Home</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sucessoBtnIr}
                onPress={() => {
                  setModalSucessoAceite(null);
                  router.push('/(app)/demandas');
                }}
              >
                <Text style={styles.sucessoBtnIrText}>Ir para Demandas</Text>
                <ArrowRight size={15} color="#FFFFFF" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Pagamento Comissão PIX */}
      <ModalPagamentoComissaoPix
        visible={modalPixVisible}
        onClose={() => setModalPixVisible(false)}
        cobranca={cobrancaParaPagar}
        onSucesso={() => {
          setModalPixVisible(false);
          carregarResumoHome();
        }}
      />

      {/* Modal Termo de Aceite CNPJ Grande */}
      <TermoAceiteCnpjGrandeModal
        visible={termoModalOpen}
        onClose={() => setTermoModalOpen(false)}
        onSuccess={() => {
          setTermoModalOpen(false);
          recarregarTermoCnpj();
        }}
        onAceito={() => {
          setTermoModalOpen(false);
          recarregarTermoCnpj();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  ambientBackground: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerLeftProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerProfileText: {
    flex: 1,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  headerRatingValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerRoleDot: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  headerRole: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  // Card Superior 1 (Efeito Vidro Principal)
  glassCardWrapper: {
    borderRadius: 24,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#132817',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.10,
        shadowRadius: 16,
      },
      web: {
        boxShadow: '0 8px 24px rgba(19, 40, 23, 0.12)',
      },
      default: {
        elevation: 0,
      },
    }),
  },
  glassCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.38)',
    position: 'relative',
    overflow: 'hidden',
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.50)',
    zIndex: 10,
  },
  glassTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  glassMainNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  glassSubLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    marginTop: 3,
  },
  glassAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  alertDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertDotText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  glassActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  glassActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)',
      },
      default: {
        elevation: 0,
      },
    }),
  },
  actionBtnIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Card Superior 2 (Efeito Vidro Secundário)
  glassSecondaryWrapper: {
    borderRadius: 18,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#132817',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      web: {
        boxShadow: '0 4px 12px rgba(19, 40, 23, 0.08)',
      },
      default: {
        elevation: 0,
      },
    }),
  },
  glassSecondaryCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    position: 'relative',
    overflow: 'hidden',
  },
  glassSecondaryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  glassSecondaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  glassSecondaryMeta: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  miniChevronCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oportunidadesSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(13, 27, 18, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0D1B12',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#5C6B61',
    marginTop: 2,
  },
  liveIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F5EC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  liveIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  emptyCardContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E3F5EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D1B12',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#5C6B61',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 290,
  },
  emptyShortcutsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  emptyShortcutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F5F2',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(13, 27, 18, 0.08)',
  },
  emptyShortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E5A36',
  },
  cardsList: {
    gap: 14,
  },
  opCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(13, 27, 18, 0.09)',
    shadowColor: '#0D1B12',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  opCardDestaque: {
    borderColor: '#2E5A36',
    borderWidth: 2,
    backgroundColor: '#FDFEFC',
  },
  opCardEmergencia: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  opCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  opCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F5EC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  opCategoryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.4,
  },
  opBadgesRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emergenciaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  emergenciaText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.3,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F5F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 5,
  },
  timerBadgeUrgente: {
    backgroundColor: '#FEF2F2',
  },
  timerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C6B61',
  },
  timerTextUrgente: {
    color: '#DC2626',
  },
  opTitulo: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D1B12',
    lineHeight: 21,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  opMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  opMetaText: {
    fontSize: 13,
    color: '#5C6B61',
    fontWeight: '500',
  },
  opDistanciaText: {
    color: '#2E5A36',
    fontWeight: '700',
  },
  opDescricao: {
    fontSize: 13,
    color: '#5C6B61',
    lineHeight: 18,
    marginBottom: 8,
  },
  opVagasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  opVagasText: {
    fontSize: 11,
    color: '#8A978E',
    fontWeight: '600',
  },
  opDivider: {
    height: 1,
    backgroundColor: 'rgba(13, 27, 18, 0.06)',
    marginBottom: 12,
  },
  opActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  opBtnVer: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F3F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  opBtnVerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E5A36',
  },
  opBtnRecusar: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  opBtnRecusarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  opBtnAceitar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#2E5A36',
    gap: 6,
    shadowColor: '#2E5A36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  opBtnAceitarDesativado: {
    opacity: 0.6,
  },
  opBtnAceitarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0D1B12',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#5C6B61',
    lineHeight: 18,
    marginBottom: 16,
  },
  motivosList: {
    gap: 8,
    marginBottom: 14,
  },
  motivoRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  motivoRadioRowAtivo: {
    borderColor: '#2E5A36',
    backgroundColor: '#F3F8F4',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleAtivo: {
    borderColor: '#2E5A36',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E5A36',
  },
  motivoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0D1B12',
  },
  inputObs: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    fontSize: 13,
    color: '#0D1B12',
    marginBottom: 16,
  },
  modalBtnsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalBtnCancelar: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalBtnCancelarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modalBtnConfirmarRecusa: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  modalBtnConfirmarRecusaText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sucessoIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E3F5EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sucessoModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0D1B12',
    textAlign: 'center',
    marginBottom: 8,
  },
  sucessoModalSubtitle: {
    fontSize: 13,
    color: '#5C6B61',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  sucessoBtnsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  sucessoBtnFicar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sucessoBtnFicarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E5A36',
  },
  sucessoBtnIr: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2E5A36',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sucessoBtnIrText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
