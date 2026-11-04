import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  DollarSign,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ChevronRight,
  Building2,
  FileText,
  CreditCard,
  XCircle,
} from 'lucide-react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { SolfyLoader } from '../../../components/SolfyLoader';
import {
  obterExtratoComissoesPrestador,
  CobrancaComissaoItem,
  ExtratoComissoesResponse,
} from '../../../lib/prestadorExecucaoApi';
import { ModalPagamentoComissaoPix } from '../../../components/ModalPagamentoComissaoPix';

const THEME = {
  bg: '#F3F5F2',
  surface: '#FFFFFF',
  ink: '#0D1B12',
  sub: '#5C6B61',
  mute: '#8A978E',
  line: 'rgba(13, 27, 18, 0.08)',
  deep: '#132817',
  mid: '#2E5A36',
  accent: '#059669',
  accentSoft: '#E3F5EC',
  amber: '#B45309',
  amberSoft: '#FEF3C7',
  indigo: '#4338CA',
  indigoSoft: '#E8EAFE',
  rose: '#BE123C',
  roseSoft: '#FFE4E6',
};

const FILTROS = [
  { id: 'todas', label: 'Todas' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'paga', label: 'Pagas' },
  { id: 'vencida', label: 'Em Atraso' },
] as const;

export default function FinanceiroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prestador } = useAuth();

  const [extrato, setExtrato] = useState<ExtratoComissoesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroAtivo, setFiltroAtivo] = useState<string>('todas');
  const [cobrancaModal, setCobrancaModal] = useState<CobrancaComissaoItem | null>(null);

  const carregar = useCallback(async () => {
    try {
      const data = await obterExtratoComissoesPrestador(prestador?.id);
      setExtrato(data);
    } catch (err) {
      console.error('[FinanceiroScreen] Erro ao carregar extrato:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [prestador?.id]);

  useEffect(() => {
    setLoading(true);
    carregar();
  }, [carregar]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    carregar();
  }, [carregar]);

  const cobrancasFiltradas = useMemo(() => {
    if (!extrato?.cobrancas) return [];
    if (filtroAtivo === 'todas') return extrato.cobrancas;

    return extrato.cobrancas.filter((c) => {
      if (filtroAtivo === 'pendente') return c.status === 'pendente' || c.status === 'em_analise';
      if (filtroAtivo === 'paga') return c.status === 'paga';
      if (filtroAtivo === 'vencida') return c.status === 'vencida' || c.bloqueia_novos_pedidos;
      return true;
    });
  }, [extrato, filtroAtivo]);

  const getStatusBadge = (c: CobrancaComissaoItem) => {
    if (c.status === 'paga') {
      return { bg: THEME.accentSoft, text: '#047857', label: 'Paga' };
    }
    if (c.status === 'em_analise') {
      return { bg: THEME.indigoSoft, text: THEME.indigo, label: 'Em Análise' };
    }
    if (c.status === 'vencida' || c.bloqueia_novos_pedidos) {
      return { bg: THEME.roseSoft, text: THEME.rose, label: 'Vencida' };
    }
    return { bg: THEME.amberSoft, text: THEME.amber, label: 'Pendente' };
  };

  const renderItem = ({ item }: { item: CobrancaComissaoItem }) => {
    const badge = getStatusBadge(item);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
          setCobrancaModal(item);
        }}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderCol}>
            <Text style={styles.condoText} numberOfLines={1}>
              {item.condominio_nome}
            </Text>
            <Text style={styles.servicoText} numberOfLines={1}>
              {item.solicitacao_titulo || item.solicitacao_descricao || 'Manutenção Predial'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.footerLabel}>Comissão Solfy</Text>
            <Text style={styles.valorText}>
              R$ {item.valor_reais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.footerLabel}>Vencimento</Text>
            <Text style={styles.vencimentoText}>
              {item.vencimento ? new Date(item.vencimento).toLocaleDateString('pt-BR') : 'Imediato'}
            </Text>
          </View>
          <ChevronRight size={18} color={THEME.mute} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 6) }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={THEME.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Financeiro & Comissões</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Hero dos Totais */}
      <View style={styles.heroWrapper}>
        <LinearGradient
          colors={[THEME.deep, THEME.mid]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroLabel}>TOTAL A PAGAR</Text>
              <Text style={styles.heroVal}>
                R$ {(extrato?.totais.total_em_aberto_reais || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.statusPill}>
              {extrato?.totais.esta_bloqueado ? (
                <>
                  <AlertTriangle size={14} color="#FCA5A5" />
                  <Text style={[styles.statusPillText, { color: '#FCA5A5' }]}>Comissão em Atraso</Text>
                </>
              ) : (
                <>
                  <ShieldCheck size={14} color="#6EE7B7" />
                  <Text style={[styles.statusPillText, { color: '#6EE7B7' }]}>Conta Regular</Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.subMetricsRow}>
            <View style={styles.subMetric}>
              <Text style={styles.subMetricLabel}>Total Já Pago</Text>
              <Text style={styles.subMetricVal}>
                R$ {(extrato?.totais.total_pago_reais || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.subMetric}>
              <Text style={styles.subMetricLabel}>Total de Ordens</Text>
              <Text style={styles.subMetricVal}>{extrato?.totais.total_cobrancas || 0}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Filtros */}
      <View style={styles.filtrosRow}>
        {FILTROS.map((f) => {
          const isSelected = filtroAtivo === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.filtroBtn, isSelected && styles.filtroBtnSelected]}
              onPress={() => {
                setFiltroAtivo(f.id);
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
              }}
            >
              <Text style={[styles.filtroText, isSelected && styles.filtroTextSelected]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Lista */}
      {loading ? (
        <View style={styles.center}>
          <SolfyLoader size={54} color={THEME.mid} />
        </View>
      ) : (
        <FlatList
          data={cobrancasFiltradas}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.mid} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <DollarSign size={32} color={THEME.mute} />
              <Text style={styles.emptyTitle}>Nenhuma comissão encontrada</Text>
              <Text style={styles.emptyDesc}>
                As ordens de pagamento de comissão são geradas após a conclusão e homologação das obras.
              </Text>
            </View>
          }
        />
      )}

      {/* Modal PIX Copia-e-Cola e Comprovante */}
      <ModalPagamentoComissaoPix
        visible={Boolean(cobrancaModal)}
        onClose={() => setCobrancaModal(null)}
        cobranca={cobrancaModal}
        onSucesso={carregar}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: THEME.bg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.ink,
  },
  heroWrapper: {
    padding: 16,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.5,
  },
  heroVal: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginVertical: 14,
  },
  subMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subMetric: {
    flex: 1,
  },
  subMetricLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '500',
  },
  subMetricVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  filtrosRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  filtroBtn: {
    flex: 1,
    backgroundColor: THEME.surface,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.line,
  },
  filtroBtnSelected: {
    backgroundColor: THEME.deep,
    borderColor: THEME.deep,
  },
  filtroText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.sub,
  },
  filtroTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: THEME.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardHeaderCol: {
    flex: 1,
    marginRight: 8,
  },
  condoText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.ink,
  },
  servicoText: {
    fontSize: 12,
    color: THEME.sub,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
  },
  footerLabel: {
    fontSize: 10,
    color: THEME.mute,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  valorText: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.ink,
    marginTop: 2,
  },
  vencimentoText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.sub,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.ink,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: THEME.sub,
    textAlign: 'center',
    lineHeight: 18,
  },
});
