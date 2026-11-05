import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Platform,
  InteractionManager,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Search,
  ChevronRight,
  Clock,
  MapPin,
  Building2,
  FileText,
  Wrench,
  Zap,
  Droplets,
  Paintbrush,
  Hammer,
  ShieldCheck,
  CheckCircle2,
  Award,
  Calendar,
  DollarSign,
  AlertCircle,
  Sun,
  Sparkles,
  Layers,
  ArrowRight,
  XCircle,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SolfyLoader } from '../../../components/SolfyLoader';
import { useAuth } from '../../../contexts/AuthContext';
import {
  buscarMinhasDemandasPrestador,
  MinhaDemandaItem,
} from '../../../lib/prestadorPedidosApi';
import { supabase } from '../../../lib/supabase';

const THEME = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  ink: '#0D1B12',
  sub: '#5C6B61',
  mute: '#8A978E',
  line: 'rgba(13, 27, 18, 0.08)',
  mid: '#2E5A36',
  accent: '#059669',
  accentSoft: '#E3F5EC',
  amber: '#B45309',
  amberSoft: '#FEF3C7',
  indigo: '#4338CA',
  indigoSoft: '#E8EAFE',
  rose: '#BE123C',
  roseSoft: '#FFE4E6',
  slate: '#475569',
  slateSoft: '#E8ECEF',
};

const getCategoryIcon = (categoria?: string) => {
  const cat = (categoria || '').toLowerCase();
  if (cat.includes('eletric') || cat.includes('luz') || cat.includes('energia')) return Zap;
  if (cat.includes('hidraul') || cat.includes('vaza') || cat.includes('encan') || cat.includes('água') || cat.includes('agua')) return Droplets;
  if (cat.includes('pint')) return Paintbrush;
  if (cat.includes('estrut') || cat.includes('obra') || cat.includes('reforma') || cat.includes('civil')) return Hammer;
  if (cat.includes('solar')) return Sun;
  return Wrench;
};

type SubAbaType = 'em_andamento' | 'fechados' | 'encerrados';

export default function DemandasPrestadorFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerPaddingTop = Math.max(insets.top, Platform.OS === 'android' ? 24 : 16) + 4;
  const { prestador } = useAuth();

  const [demandas, setDemandas] = useState<MinhaDemandaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subAbaAtiva, setSubAbaAtiva] = useState<SubAbaType>('em_andamento');
  const [busca, setBusca] = useState('');

  // 1. CARREGA VIA RPC DO SERVIDOR (prestador_minhas_demandas)
  const carregarDemandas = useCallback(async () => {
    if (!prestador?.id) {
      setDemandas([]);
      setLoading(false);
      return;
    }

    try {
      const data = await buscarMinhasDemandasPrestador(prestador.id);
      setDemandas(data || []);
    } catch (err) {
      console.error('[Demandas] Erro ao carregar demandas via RPC:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [prestador?.id]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        carregarDemandas();
      });
      return () => task.cancel();
    }, [carregarDemandas])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    carregarDemandas();
  }, [carregarDemandas]);

  // 2. TEMPO REAL: Atualiza lista quando houver novidades em cotações, visitas ou pedidos
  const carregarDemandasRef = useRef(carregarDemandas);
  useEffect(() => {
    carregarDemandasRef.current = carregarDemandas;
  }, [carregarDemandas]);

  useEffect(() => {
    if (!prestador?.id) return;

    const channelName = `realtime_demandas_${prestador.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
        () => carregarDemandasRef.current()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cotacoes',
          filter: `prestador_id=eq.${prestador.id}`,
        },
        () => carregarDemandasRef.current()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitacao_visitas_tecnicas',
          filter: `prestador_id=eq.${prestador.id}`,
        },
        () => carregarDemandasRef.current()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [prestador?.id]);

  // Contadores por sub-aba
  const contadores = useMemo(() => {
    return {
      em_andamento: demandas.filter((d) => d.aba === 'em_andamento').length,
      fechados: demandas.filter((d) => d.aba === 'fechados').length,
      encerrados: demandas.filter((d) => d.aba === 'encerrados').length,
    };
  }, [demandas]);

  // Filtra por sub-aba e texto de busca
  const demandasFiltradas = useMemo(() => {
    let result = demandas.filter((d) => d.aba === subAbaAtiva);

    if (busca.trim()) {
      const q = busca.toLowerCase();
      result = result.filter(
        (d) =>
          d.titulo.toLowerCase().includes(q) ||
          d.categoria.toLowerCase().includes(q) ||
          d.condominio_nome.toLowerCase().includes(q) ||
          d.local.bairro.toLowerCase().includes(q)
      );
    }

    return result;
  }, [demandas, subAbaAtiva, busca]);

  return (
    <View style={styles.container}>
      {/* ── HEADER DA ABA DEMANDAS ── */}
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Demandas</Text>
            <Text style={styles.headerSub}>
              Acompanhe seus serviços em andamento e obras fechadas
            </Text>
          </View>
        </View>

        {/* ── SUB-ABAS MANDATÓRIAS ── */}
        <View style={styles.subAbasRow}>
          <TouchableOpacity
            style={[
              styles.subAbaBtn,
              subAbaAtiva === 'em_andamento' && styles.subAbaBtnAtiva,
            ]}
            activeOpacity={0.8}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              setSubAbaAtiva('em_andamento');
            }}
          >
            <Text
              style={[
                styles.subAbaText,
                subAbaAtiva === 'em_andamento' && styles.subAbaTextAtiva,
              ]}
            >
              Em andamento
            </Text>
            <View
              style={[
                styles.subAbaBadge,
                subAbaAtiva === 'em_andamento' && styles.subAbaBadgeAtiva,
              ]}
            >
              <Text
                style={[
                  styles.subAbaBadgeText,
                  subAbaAtiva === 'em_andamento' && styles.subAbaBadgeTextAtiva,
                ]}
              >
                {contadores.em_andamento}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.subAbaBtn,
              subAbaAtiva === 'fechados' && styles.subAbaBtnAtiva,
            ]}
            activeOpacity={0.8}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              setSubAbaAtiva('fechados');
            }}
          >
            <Text
              style={[
                styles.subAbaText,
                subAbaAtiva === 'fechados' && styles.subAbaTextAtiva,
              ]}
            >
              Fechados
            </Text>
            <View
              style={[
                styles.subAbaBadge,
                subAbaAtiva === 'fechados' && styles.subAbaBadgeAtiva,
              ]}
            >
              <Text
                style={[
                  styles.subAbaBadgeText,
                  subAbaAtiva === 'fechados' && styles.subAbaBadgeTextAtiva,
                ]}
              >
                {contadores.fechados}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.subAbaBtn,
              subAbaAtiva === 'encerrados' && styles.subAbaBtnAtiva,
            ]}
            activeOpacity={0.8}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              setSubAbaAtiva('encerrados');
            }}
          >
            <Text
              style={[
                styles.subAbaText,
                subAbaAtiva === 'encerrados' && styles.subAbaTextAtiva,
              ]}
            >
              Encerrados
            </Text>
            <View
              style={[
                styles.subAbaBadge,
                subAbaAtiva === 'encerrados' && styles.subAbaBadgeAtiva,
              ]}
            >
              <Text
                style={[
                  styles.subAbaBadgeText,
                  subAbaAtiva === 'encerrados' && styles.subAbaBadgeTextAtiva,
                ]}
              >
                {contadores.encerrados}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── BARRA DE BUSCA ── */}
        <View style={styles.searchBox}>
          <Search size={16} color="#8A978E" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por título, condomínio ou bairro..."
            placeholderTextColor="#8A978E"
            value={busca}
            onChangeText={setBusca}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* ── LISTA DE DEMANDAS ── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <SolfyLoader size="md" />
        </View>
      ) : demandasFiltradas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            {subAbaAtiva === 'fechados' ? (
              <Award size={32} color="#059669" strokeWidth={2} />
            ) : subAbaAtiva === 'encerrados' ? (
              <XCircle size={32} color="#64748B" strokeWidth={2} />
            ) : (
              <Layers size={32} color="#2E5A36" strokeWidth={2} />
            )}
          </View>

          <Text style={styles.emptyTitle}>
            {subAbaAtiva === 'fechados'
              ? 'Nenhum contrato fechado ainda'
              : subAbaAtiva === 'encerrados'
              ? 'Nenhum chamado encerrado'
              : 'Nenhum serviço em andamento'}
          </Text>

          <Text style={styles.emptySub}>
            {subAbaAtiva === 'fechados'
              ? 'Quando o síndico aprovar sua proposta, a obra ganha aparecerá nesta aba.'
              : subAbaAtiva === 'encerrados'
              ? 'Chamados não selecionados ou cancelados pelo condomínio aparecem aqui para seu controle.'
              : 'Aceite oportunidades disponíveis na Home para adicionar novos serviços à sua fila.'}
          </Text>

          {subAbaAtiva === 'em_andamento' && (
            <TouchableOpacity
              style={styles.emptyHomeBtn}
              activeOpacity={0.8}
              onPress={() => router.push('/(app)')}
            >
              <Text style={styles.emptyHomeBtnText}>Ver Oportunidades na Home</Text>
              <ArrowRight size={14} color="#FFFFFF" strokeWidth={2.4} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={demandasFiltradas}
          keyExtractor={(item) => item.despacho_id || item.solicitacao_id}
          contentContainerStyle={[
            styles.listContent,
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
          renderItem={({ item, index }) => {
            const ItemIcon = getCategoryIcon(item.categoria);
            const enderecoFormatado = [
              item.local.logradouro,
              item.local.numero,
              item.local.bairro,
            ]
              .filter(Boolean)
              .join(', ');

            // Cor e ícone do pill de Próxima Ação
            let acaoBg = '#EFF6FF';
            let acaoColor = '#2563EB';
            let acaoIcon = Clock;

            if (item.proxima_acao_codigo === 'executar_servico') {
              acaoBg = '#ECFDF5';
              acaoColor = '#059669';
              acaoIcon = Award;
            } else if (item.proxima_acao_codigo === 'enviar_orcamento') {
              acaoBg = '#FEF3C7';
              acaoColor = '#B45309';
              acaoIcon = DollarSign;
            } else if (item.proxima_acao_codigo === 'realizar_visita') {
              acaoBg = '#EEF2FF';
              acaoColor = '#4F46E5';
              acaoIcon = Calendar;
            } else if (item.proxima_acao_codigo === 'encerrado') {
              acaoBg = '#F1F5F9';
              acaoColor = '#64748B';
              acaoIcon = AlertCircle;
            }

            const AcaoIconComponent = acaoIcon;

            return (
              <Animated.View
                entering={FadeInDown.delay(index * 40).duration(300)}
                style={styles.demandaCardWrapper}
              >
                <TouchableOpacity
                  style={styles.demandaCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.selectionAsync().catch(() => {});
                    }
                    router.push(`/(app)/demandas/${item.solicitacao_id}`);
                  }}
                >
                  {/* ── TOPO: SUA PRÓXIMA AÇÃO EM DESTAQUE ── */}
                  <View style={[styles.proximaAcaoPill, { backgroundColor: acaoBg }]}>
                    <AcaoIconComponent size={13} color={acaoColor} strokeWidth={2.4} />
                    <Text
                      style={[styles.proximaAcaoText, { color: acaoColor }]}
                      numberOfLines={1}
                    >
                      {item.proxima_acao}
                    </Text>
                  </View>

                  {/* Header do Card: Categoria e Distância */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.categoryBadge}>
                      <ItemIcon size={12} color="#166534" strokeWidth={2.4} />
                      <Text style={styles.categoryBadgeText}>
                        {item.categoria.toUpperCase()}
                      </Text>
                    </View>

                    {item.eh_emergencia && (
                      <View style={styles.emergenciaBadge}>
                        <Text style={styles.emergenciaText}>EMERGÊNCIA</Text>
                      </View>
                    )}
                  </View>

                  {/* Título da Demanda */}
                  <Text style={styles.demandaTitulo} numberOfLines={2}>
                    {item.titulo}
                  </Text>

                  {/* Condomínio e Endereço Completo (Liberado pois aceitou) */}
                  <View style={styles.metaRow}>
                    <Building2 size={13} color="#2E5A36" strokeWidth={2} />
                    <Text style={styles.condoNome} numberOfLines={1}>
                      {item.condominio_nome}
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <MapPin size={13} color="#5C6B61" strokeWidth={2} />
                    <Text style={styles.enderecoText} numberOfLines={1}>
                      {enderecoFormatado || `${item.local.bairro}, ${item.local.cidade}`}
                      {item.local.distancia_km ? ` • ${item.local.distancia_km} km` : ''}
                    </Text>
                  </View>

                  {/* Detalhes de Cotação ou Visita (se houver) */}
                  {(item.cotacao || item.visita) && (
                    <View style={styles.cardDetailsBox}>
                      {item.cotacao && (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Sua proposta:</Text>
                          <Text style={styles.detailValue}>
                            R$ {item.cotacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </Text>
                          <Text style={styles.detailPrazo}>
                            ({item.cotacao.prazo_execucao_dias} {item.cotacao.prazo_execucao_dias === 1 ? 'dia' : 'dias'})
                          </Text>
                        </View>
                      )}

                      {item.visita && (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Visita técnica:</Text>
                          <Text style={styles.detailValue}>
                            {new Date(`${item.visita.data_visita}T12:00:00`).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                            })}{' '}
                            às {item.visita.horario_inicio.slice(0, 5)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Rodapé: Acessar */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.verDetalhesText}>Ver chamado completo</Text>
                    <ChevronRight size={14} color="#2E5A36" strokeWidth={2.4} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(13, 27, 18, 0.08)',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTopRow: {
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0D1B12',
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 13,
    color: '#5C6B61',
    marginTop: 2,
  },
  subAbasRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 3,
    marginBottom: 12,
  },
  subAbaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 11,
    gap: 6,
  },
  subAbaBtnAtiva: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  subAbaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  subAbaTextAtiva: {
    color: '#0D1B12',
    fontWeight: '800',
  },
  subAbaBadge: {
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  subAbaBadgeAtiva: {
    backgroundColor: '#2E5A36',
  },
  subAbaBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  subAbaBadgeTextAtiva: {
    color: '#FFFFFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0D1B12',
  },
  listContent: {
    padding: 16,
    gap: 14,
  },
  demandaCardWrapper: {
    marginBottom: 2,
  },
  demandaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(13, 27, 18, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  proximaAcaoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
    marginBottom: 12,
  },
  proximaAcaoText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F5EC',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.4,
  },
  emergenciaBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  emergenciaText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  demandaTitulo: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D1B12',
    lineHeight: 21,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  condoNome: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E5A36',
    flex: 1,
  },
  enderecoText: {
    fontSize: 12,
    color: '#5C6B61',
    fontWeight: '500',
    flex: 1,
  },
  cardDetailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D1B12',
  },
  detailPrazo: {
    fontSize: 12,
    color: '#64748B',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(13, 27, 18, 0.05)',
  },
  verDetalhesText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E5A36',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0D1B12',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: '#5C6B61',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  emptyHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E5A36',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  emptyHomeBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
