import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  SafeAreaView,
  Dimensions,
  InteractionManager,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Building2,
  CalendarDays,
  ChevronRight,
  Clock,
  Droplets,
  Hammer,
  MessageSquare,
  Paintbrush,
  Plus,
  ShieldCheck,
  Star,
  Sun,
  Wrench,
  Zap,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { SolfyLoader } from '../../components/SolfyLoader';
import { NotificationBell } from '../../components/NotificationBell';
import AuroraBackground from '../../components/AuroraBackground';
import { BannerBloqueioComissao } from '../../components/BannerBloqueioComissao';
import { TermoAceiteCnpjGrandeModal } from '../../components/TermoAceiteCnpjGrandeModal';
import {
  buscarOportunidadesPrestador,
  OportunidadePrestador,
} from '../../lib/prestadorPedidosApi';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const getCategoryIcon = (categoria?: string) => {
  const cat = (categoria || '').toLowerCase();
  if (cat.includes('eletric') || cat.includes('luz') || cat.includes('energia')) return Zap;
  if (cat.includes('hidraul') || cat.includes('vaza') || cat.includes('encan') || cat.includes('água') || cat.includes('agua')) return Droplets;
  if (cat.includes('pint')) return Paintbrush;
  if (cat.includes('estrut') || cat.includes('obra') || cat.includes('reforma') || cat.includes('civil')) return Hammer;
  if (cat.includes('solar')) return Sun;
  return Wrench;
};

const STATUS_PRESTADOR_LABELS: Record<string, string> = {
  recebido: 'Nova Demanda',
  visita_agendada: 'Visita Agendada',
  aguardando_cotacao: 'Aguardando Cotação',
  cotacao_enviada: 'Cotação Enviada',
  aprovada: 'Obra Ganha 🎉',
  recusado: 'Recusado',
  cancelada: 'Cancelada',
};

const STATUS_PRESTADOR_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  recebido: { bg: '#EFF6FF', text: '#2563EB', border: '#DBEAFE' },
  visita_agendada: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  aguardando_cotacao: { bg: '#EEF2FF', text: '#4F46E5', border: '#E0E7FF' },
  cotacao_enviada: { bg: '#F5F3FF', text: '#7C3AED', border: '#EDE9FE' },
  aprovada: { bg: '#ECFDF5', text: '#059669', border: '#D1FAE5' },
  recusado: { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' },
  cancelada: { bg: '#FEF2F2', text: '#DC2626', border: '#FEE2E2' },
};

export default function PrestadorDashboardScreen() {
  const router = useRouter();
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

  const [oportunidades, setOportunidades] = useState<OportunidadePrestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [termoModalOpen, setTermoModalOpen] = useState(false);

  // Carrega dados de despacho do prestador
  const carregarDados = useCallback(async () => {
    if (!prestador?.id) {
      setOportunidades([]);
      setLoading(false);
      return;
    }

    try {
      const data = await buscarOportunidadesPrestador(prestador.id);
      setOportunidades(data || []);
      recarregarInadimplencia().catch(() => {});
    } catch (err) {
      console.error('[DashboardPrestador] Erro ao carregar oportunidades:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [prestador?.id, recarregarInadimplencia]);

  // Adia a carga pesada de dados até a conclusão suave da transição/animação da tab bar
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        carregarDados();
      });
      return () => task.cancel();
    }, [carregarDados])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    carregarDados();
  }, [carregarDados]);

  // Se for CNPJ de Grande Porte e ainda não tiver aceito o termo digital, abre o modal
  useEffect(() => {
    if (
      prestador &&
      (prestador.apto_servicos_grandes === false || termoCnpjGrandeAceito === false)
    ) {
      setTermoModalOpen(true);
    }
  }, [prestador, termoCnpjGrandeAceito]);

  // Contadores analíticos
  const contadores = useMemo(() => {
    const recebidos = oportunidades.filter((o) => o.estado_fluxo === 'recebido').length;
    const visitas = oportunidades.filter((o) => o.estado_fluxo === 'visita_agendada').length;
    const cotados = oportunidades.filter((o) => o.estado_fluxo === 'cotacao_enviada').length;
    const aprovados = oportunidades.filter((o) => o.estado_fluxo === 'aprovada').length;

    return { recebidos, visitas, cotados, aprovados };
  }, [oportunidades]);

  // Na aba Início, apenas as 3 últimas oportunidades/demandas são exibidas
  const ultimasOportunidades = useMemo(() => {
    return oportunidades.slice(0, 3);
  }, [oportunidades]);

  if (authLoading || (loading && oportunidades.length === 0)) {
    return <SolfyLoader fullscreen size="lg" />;
  }

  if (!user) {
    return null;
  }

  const nomeExibicao = prestador?.name || perfil?.nome_completo || 'Prestador';
  const nivelPrestador = (prestador?.nivel || 'BRONZE').toUpperCase();
  const notaPrestador = typeof prestador?.rating === 'number' && prestador.rating > 0
    ? prestador.rating.toFixed(1).replace('.', ',')
    : '5,0';

  return (
    <View style={styles.container}>
      {/* ── GRADIENTE SUTIL DE FUNDO ── */}
      <View style={[styles.ambientBackground, { pointerEvents: 'none' }]}>
        <AuroraBackground lightMode={true} />
        {/* Soft bottom transition gradient to clean background */}
        <LinearGradient
          colors={['transparent', 'rgba(248, 250, 252, 0.1)', 'rgba(248, 250, 252, 0.65)', '#F8FAFC']}
          start={{ x: 0, y: 0.70 }}
          end={{ x: 0, y: 1.0 }}
          style={[StyleSheet.absoluteFillObject, { pointerEvents: 'none' }]}
        />
      </View>

      <View style={{ flex: 1 }}>
        {/* ── TOP HEADER (ESTILO SOLFY CONDO: AVATAR / NOME / CARGO / NOTIFICAÇÃO) ── */}
        <View style={[styles.topHeader, { paddingTop: headerPaddingTop }]}>
          <TouchableOpacity
            style={styles.headerLeftProfile}
            activeOpacity={0.8}
            onPress={() => router.push('/(app)/perfil')}
          >
            {/* Ícone direto branco sem card, idêntico ao Solfy Condo */}
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
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + Math.max(insets.bottom, 24) }]}
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
          {inadimplencia && <BannerBloqueioComissao inadimplencia={inadimplencia} onRefresh={carregarDados} />}

          {/* ── 1. CARD SUPERIOR PRINCIPAL (EFEITO VIDRO / GLASS CARD MAIS TRANSLÚCIDO) ── */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.glassCardWrapper}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.28)', 'rgba(255, 255, 255, 0.12)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.glassCard}
            >
              {/* Linha de reflexo de vidro superior */}
              <View style={[styles.glassHighlight, { pointerEvents: 'none' }]} />

              <View style={styles.glassTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.glassMainNumber}>
                    {oportunidades.length} {oportunidades.length === 1 ? 'Oportunidade' : 'Oportunidades'}
                  </Text>
                  <Text style={styles.glassSubLabel}>
                    {contadores.recebidos} novas • {contadores.visitas} visitas • {contadores.aprovados} ganhas
                  </Text>
                </View>

                {/* Badge no canto superior direito */}
                <TouchableOpacity
                  style={styles.glassAlertBadge}
                  activeOpacity={0.8}
                  onPress={() => router.push('/(app)/demandas')}
                >
                  <View style={styles.alertDot}>
                    <Text style={styles.alertDotText}>{contadores.recebidos || contadores.visitas || 1}</Text>
                  </View>
                  <ChevronRight size={13} color="#FFFFFF" strokeWidth={2.4} />
                </TouchableOpacity>
              </View>

              {/* Botões de Ação em Pílula Translúcida */}
              <View style={styles.glassActionsRow}>
                <TouchableOpacity
                  style={styles.glassActionBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    router.push('/(app)/demandas');
                  }}
                >
                  <View style={styles.actionBtnIconCircle}>
                    <Wrench size={14} color="#FFFFFF" strokeWidth={2.6} />
                  </View>
                  <Text style={styles.actionBtnText}>Ver Oportunidades</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.glassActionBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                    router.push('/(app)/agenda');
                  }}
                >
                  <View style={styles.actionBtnIconCircle}>
                    <CalendarDays size={14} color="#FFFFFF" strokeWidth={2.4} />
                  </View>
                  <Text style={styles.actionBtnText}>Agenda ({contadores.visitas})</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ── 2. CARD SUPERIOR SECUNDÁRIO (EFEITO VIDRO SECUNDÁRIO TRANSLÚCIDO) ── */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.glassSecondaryWrapper}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.22)', 'rgba(255, 255, 255, 0.10)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.glassSecondaryCard}
            >
              <View style={[styles.glassHighlight, { pointerEvents: 'none' }]} />
              <TouchableOpacity
                style={styles.glassSecondaryInner}
                activeOpacity={0.75}
                onPress={() => router.push('/(app)/demandas')}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.glassSecondaryTitle}>Status das Operações</Text>
                  <Text style={styles.glassSecondaryMeta}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
                      {contadores.cotados} cotações enviadas
                    </Text>
                    {' • '}
                    <Text style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                      {contadores.aprovados > 0 ? `${contadores.aprovados} obras ganhas` : 'Pronto para novos serviços'}
                    </Text>
                  </Text>
                </View>
                <View style={styles.miniChevronCircle}>
                  <ChevronRight size={13} color="#FFFFFF" strokeWidth={2.6} />
                </View>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>

          {/* ── 3. CONTAINER BRANCO CURVADO (SLOTS PARA NOVAS ABAS) ── */}
          <View style={styles.whiteBodyContainer}>
            {/* Fileira Superior: 4 Slots */}
            <View style={styles.slotsTopRow}>
              {[1, 2, 3, 4].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={styles.slotTopItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                  }}
                >
                  <View style={styles.slotTopIconBox}>
                    <Plus size={18} color="#94A3B8" strokeWidth={2.2} />
                  </View>
                  <Text style={styles.slotTopLabel}>Slot {num}</Text>
                  <Text style={styles.slotTopSub}>Vazio</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Fileira Inferior: 2 Slots Maiores */}
            <View style={styles.slotsBottomRow}>
              <TouchableOpacity
                style={styles.slotLargeCard}
                activeOpacity={0.75}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                }}
              >
                <View style={styles.slotLargeHeader}>
                  <Text style={styles.slotLargeTitle}>Slot 5</Text>
                  <View style={styles.slotLargeBadge}>
                    <Text style={styles.slotLargeBadgeText}>Vazio</Text>
                  </View>
                </View>
                <View style={styles.slotLargeFooter}>
                  <Plus size={14} color="#94A3B8" strokeWidth={2.2} />
                  <Text style={styles.slotLargeDesc}>Disponível para aba</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.slotLargeCard}
                activeOpacity={0.75}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                }}
              >
                <View style={styles.slotLargeHeader}>
                  <Text style={styles.slotLargeTitle}>Slot 6</Text>
                  <View style={styles.slotLargeBadge}>
                    <Text style={styles.slotLargeBadgeText}>Vazio</Text>
                  </View>
                </View>
                <View style={styles.slotLargeFooter}>
                  <Plus size={14} color="#94A3B8" strokeWidth={2.2} />
                  <Text style={styles.slotLargeDesc}>Disponível para aba</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Seção Inferior: Histórico de Demandas (Apenas as 3 últimas) */}
            <View style={styles.historySection}>
              <View style={styles.historyHeaderRow}>
                <View>
                  <Text style={styles.historySectionTitle}>Histórico de Demandas</Text>
                  <Text style={styles.historySectionSub}>Últimos pedidos despachados para você</Text>
                </View>

                <TouchableOpacity
                  style={styles.historyPillFilter}
                  activeOpacity={0.75}
                  onPress={() => router.push('/(app)/demandas')}
                >
                  <Text style={styles.historyPillFilterText}>Ver todas</Text>
                  <ChevronRight size={12} color="#2E5A36" strokeWidth={2.4} />
                </TouchableOpacity>
              </View>

              {loading ? (
                <View style={styles.loadingBox}>
                  <SolfyLoader size="md" />
                </View>
              ) : ultimasOportunidades.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Nenhuma oportunidade ativa</Text>
                  <Text style={styles.emptySub}>Você receberá avisos push assim que novas demandas forem abertas.</Text>
                </View>
              ) : (
                ultimasOportunidades.map((op) => {
                  const statusConfig = STATUS_PRESTADOR_COLORS[op.estado_fluxo] || {
                    bg: '#F3F4F6',
                    text: '#6B7280',
                    border: '#E5E7EB',
                  };
                  const statusLabel = STATUS_PRESTADOR_LABELS[op.estado_fluxo] || op.estado_fluxo;
                  const dataCriacao = op.notificado_em
                    ? new Date(op.notificado_em).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                      })
                    : 'Hoje';
                  const ItemIcon = getCategoryIcon(op.categoria);

                  return (
                    <TouchableOpacity
                      key={op.despacho_id || op.solicitacao_id}
                      style={styles.historyItemRow}
                      activeOpacity={0.75}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        }
                        router.push(`/(app)/demandas/${op.solicitacao_id}`);
                      }}
                    >
                      <View style={styles.historyItemIconBox}>
                        <ItemIcon size={16} color="#2E5A36" strokeWidth={2.2} />
                      </View>

                      <View style={styles.historyItemInfo}>
                        <Text style={styles.historyItemTitle} numberOfLines={1}>
                          {op.titulo || `${op.categoria || 'Demanda'} Predial`}
                        </Text>
                        <Text style={styles.historyItemMeta} numberOfLines={1}>
                          {op.categoria.toUpperCase()} • {op.condominio_nome || op.localizacao_exibida || dataCriacao}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusBadgeSmall,
                          { backgroundColor: statusConfig.bg, borderColor: statusConfig.border },
                        ]}
                      >
                        <Text style={[styles.statusBadgeSmallText, { color: statusConfig.text }]}>
                          {statusLabel}
                        </Text>
                      </View>

                      <ChevronRight size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        </ScrollView>
      </View>

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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT ? Math.max(SCREEN_HEIGHT * 0.85, 780) : 780,
    overflow: 'hidden',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerLeftProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  headerAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  headerProfileText: {
    flex: 1,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  redSquare: {
    width: 14,
    height: 14,
    backgroundColor: '#EF4444',
    borderRadius: 2,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    lineHeight: 22,
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
    color: 'rgba(255, 255, 255, 0.6)',
    marginHorizontal: 2,
  },
  headerRole: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
    lineHeight: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 110,
  },
  // Card Superior 1 (Efeito Vidro Principal)
  glassCardWrapper: {
    borderRadius: 24,
    marginBottom: 12,
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

  // Container Branco Curvado (Body)
  whiteBodyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#132817',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    gap: 16,
  },

  // Fileira Superior: 4 Slots
  slotsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 2,
  },
  slotTopItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  slotTopIconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
  },
  slotTopLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  slotTopSub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: -2,
  },

  // Fileira Inferior: 2 Slots Maiores
  slotsBottomRow: {
    flexDirection: 'row',
    gap: 12,
  },
  slotLargeCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    minHeight: 82,
    justifyContent: 'space-between',
  },
  slotLargeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotLargeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
  slotLargeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  slotLargeBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
  },
  slotLargeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  slotLargeDesc: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },

  // Seção de Histórico
  historySection: {
    marginTop: 4,
    gap: 10,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historySectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#132817',
  },
  historySectionSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  historyPillFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  historyPillFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2E5A36',
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#132817',
  },
  emptySub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // Itens da Lista de Histórico
  historyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  historyItemIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  historyItemInfo: {
    flex: 1,
    gap: 2,
  },
  historyItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#132817',
  },
  historyItemMeta: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeSmallText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
