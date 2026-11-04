import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Search,
  Plus,
  X,
  Bell,
  Building2,
  ChevronRight,
  MessageSquare,
  Wrench,
  Clock,
} from 'lucide-react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { SolfyLoader } from '../../../components/SolfyLoader';
import ChatThreadView from '../../../components/ChatThreadView';
import {
  listarConversasDoPrestador,
  ConversaItemPrestador,
} from '../../../lib/prestadorChatApi';
import { buscarOportunidadesPrestador } from '../../../lib/prestadorPedidosApi';

type TipoFiltro = 'todas' | 'demandas' | 'arq';

const FILTROS_CONFIG: { id: TipoFiltro; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'demandas', label: 'Demandas' },
  { id: 'arq', label: 'Arquivadas' },
];

const AVATAR_COLORS = [
  '#059669', // Emerald
  '#0369A1', // Sky
  '#4338CA', // Indigo
  '#B45309', // Amber
  '#0F766E', // Teal
  '#2E5A36', // Forest
  '#BE185D', // Rose
  '#6D28D9', // Purple
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export default function ChatListPrestadorScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, prestador } = useAuth();

  const [conversas, setConversas] = useState<ConversaItemPrestador[]>([]);
  const [arquivadasIds, setArquivadasIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros & Busca
  const [filtroAtivo, setFiltroAtivo] = useState<TipoFiltro>('todas');
  const [busca, setBusca] = useState('');

  // Conversa ativa selecionada (visualização do chat thread)
  const [conversaAtiva, setConversaAtiva] = useState<ConversaItemPrestador | null>(null);

  // Oculta a barra de navegação inferior quando uma conversa estiver aberta (igual ao Condo)
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: { display: conversaAtiva ? 'none' : undefined },
    });
    return () => {
      navigation.setOptions({
        tabBarStyle: { display: undefined },
      });
    };
  }, [conversaAtiva, navigation]);

  // Modal "Nova Conversa"
  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const [oportunidadesDisponiveis, setOportunidadesDisponiveis] = useState<any[]>([]);
  const [carregandoNova, setCarregandoNova] = useState(false);

  const carregarConversas = useCallback(async () => {
    if (!prestador?.id) {
      setConversas([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const dados = await listarConversasDoPrestador(prestador.id);
      setConversas(dados || []);
    } catch (err) {
      console.error('[ChatPrestador] Erro ao carregar conversas:', err);
      setConversas([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [prestador?.id]);

  useEffect(() => {
    setLoading(true);
    carregarConversas();
  }, [carregarConversas]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    carregarConversas();
  }, [carregarConversas]);

  // Contagem para cada filtro
  const counts = useMemo(() => {
    const isArq = (c: ConversaItemPrestador) => arquivadasIds.includes(c.id);
    const naoArq = (c: ConversaItemPrestador) => !isArq(c);

    return {
      todas: conversas.filter(naoArq).length,
      demandas: conversas.filter((c) => naoArq(c) && !!c.solicitacao_id).length,
      arq: conversas.filter(isArq).length,
    };
  }, [conversas, arquivadasIds]);

  // Filtra conversas conforme aba e busca
  const conversasFiltradas = useMemo(() => {
    return conversas.filter((c) => {
      const estaArquivada = arquivadasIds.includes(c.id);

      if (filtroAtivo === 'arq') {
        if (!estaArquivada) return false;
      } else {
        if (estaArquivada) return false;
        if (filtroAtivo === 'demandas' && !c.solicitacao_id) {
          return false;
        }
      }

      if (busca.trim()) {
        const termo = busca.toLowerCase().trim();
        const condo = (c.condominio_nome || '').toLowerCase();
        const titulo = (c.solicitacao_titulo || '').toLowerCase();
        const ultima = (c.ultima_mensagem_texto || '').toLowerCase();
        return condo.includes(termo) || titulo.includes(termo) || ultima.includes(termo);
      }

      return true;
    });
  }, [conversas, arquivadasIds, filtroAtivo, busca]);

  const abrirNovaConversa = async () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setModalNovaAberto(true);
    setCarregandoNova(true);

    if (!prestador?.id) {
      setCarregandoNova(false);
      return;
    }

    try {
      const ops = await buscarOportunidadesPrestador(prestador.id);
      setOportunidadesDisponiveis(ops || []);
    } catch (e) {
      console.warn('[NovaConversa] Erro:', e);
    } finally {
      setCarregandoNova(false);
    }
  };

  const selecionarOportunidadeNova = (op: any) => {
    setModalNovaAberto(false);
    // Procura se já existe conversa aberta para este chamado
    const existente = conversas.find((c) => c.solicitacao_id === op.solicitacao_id);
    if (existente) {
      setConversaAtiva(existente);
    } else {
      router.push(`/(app)/chat/${op.solicitacao_id}?condominioId=${op.condominio?.id || ''}&prestadorId=${prestador?.id || ''}` as any);
    }
  };

  const alternarArquivamento = (id: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setArquivadasIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const hoje = new Date();
      if (d.toDateString() === hoje.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      const ontem = new Date();
      ontem.setDate(hoje.getDate() - 1);
      if (d.toDateString() === ontem.toDateString()) {
        return 'Ontem';
      }
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  // Se uma conversa estiver aberta na mesma tela, exibe a thread (exatamente como no Condo)
  if (conversaAtiva) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F3F5F2' }}>
        <ChatThreadView
          conversaId={conversaAtiva.id}
          conversaInicial={conversaAtiva as any}
          onBack={() => setConversaAtiva(null)}
          onArchiveToggle={alternarArquivamento}
          isArchived={arquivadasIds.includes(conversaAtiva.id)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + Math.max(insets.bottom, 24) }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#059669"
            colors={['#059669']}
          />
        }
      >
        {/* ── LARGE TITLE HEADER (.dm-large) ── */}
        <View style={[styles.largeHeader, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 24 : 16) + 4 }]}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.largeTitle}>Mensagens</Text>
            <Text style={styles.largeSubtitle} numberOfLines={1}>
              {conversas.length > 0 ? 'Tudo em dia • Alinhamento com condomínios' : 'Comunicação direta'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.fabBtn}
            activeOpacity={0.8}
            onPress={abrirNovaConversa}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Plus size={20} color="#0D1B12" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {/* ── SEARCH BAR (.dm-search) ── */}
        <View style={styles.searchBar}>
          <Search size={18} color="#94A3B8" strokeWidth={2.2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar condomínio ou demanda"
            placeholderTextColor="#94A3B8"
            value={busca}
            onChangeText={setBusca}
            returnKeyType="search"
          />
          {!!busca && (
            <TouchableOpacity
              onPress={() => setBusca('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={16} color="#94A3B8" strokeWidth={2.2} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── FILTER CHIPS (.dm-chips) ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          {FILTROS_CONFIG.map((f) => {
            const count = counts[f.id] || 0;
            if (f.id === 'arq' && count === 0 && filtroAtivo !== 'arq') return null;

            const isActive = filtroAtivo === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.chip, isActive && styles.chipActive]}
                activeOpacity={0.75}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.selectionAsync().catch(() => {});
                  }
                  setFiltroAtivo(f.id);
                }}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {f.label}
                </Text>
                <View style={[styles.chipBadge, isActive && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, isActive && styles.chipBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── CONVERSATION LIST (.ch-list) ── */}
        {loading ? (
          <View style={styles.centerLoading}>
            <SolfyLoader size="md" />
          </View>
        ) : conversasFiltradas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              {busca ? (
                <Search size={28} color="#059669" strokeWidth={2} />
              ) : (
                <Bell size={28} color="#059669" strokeWidth={2} />
              )}
            </View>
            <Text style={styles.emptyTitle}>
              {busca ? 'Nada encontrado' : 'Sem conversas aqui'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {busca
                ? `Nenhuma conversa corresponde a "${busca}".`
                : 'As conversas com os condomínios atendidos aparecerão aqui.'}
            </Text>
          </View>
        ) : (
          <View style={styles.chatList}>
            {conversasFiltradas.map((c, index) => {
              const nome = c.condominio_nome || 'Condomínio';
              const iniciais = nome
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'CO';
              const corBg = getAvatarColor(nome);

              return (
                <View key={c.id}>
                  <TouchableOpacity
                    style={styles.chatRow}
                    activeOpacity={0.75}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      }
                      setConversaAtiva(c);
                    }}
                  >
                    <View style={styles.avatarWrap}>
                      <View style={[styles.avatarSquircle, { backgroundColor: corBg }]}>
                        <Text style={styles.avatarInitials}>{iniciais}</Text>
                      </View>
                      <View style={styles.onlineDot} />
                    </View>

                    <View style={styles.bodyWrap}>
                      <View style={styles.line1}>
                        <Text style={styles.nameText} numberOfLines={1}>
                          {nome}
                        </Text>
                        <Text style={styles.timeText}>
                          {formatTime(c.ultima_mensagem_em)}
                        </Text>
                      </View>

                      {!!c.solicitacao_titulo && (
                        <Text style={styles.ctxLineText} numberOfLines={1}>
                          Demanda: {c.solicitacao_titulo}
                        </Text>
                      )}

                      <View style={styles.line2}>
                        <Text style={styles.previewText} numberOfLines={1}>
                          {c.ultima_mensagem_texto || 'Toque para conversar com o síndico'}
                        </Text>
                        {c.nao_lidas_count > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>
                              {c.nao_lidas_count}
                            </Text>
                          </View>
                        )}
                        <ChevronRight size={14} color="#94A3B8" />
                      </View>
                    </View>
                  </TouchableOpacity>

                  {index < conversasFiltradas.length - 1 && (
                    <View style={styles.separator} />
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── MODAL NOVA CONVERSA ── */}
      <Modal
        visible={modalNovaAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setModalNovaAberto(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setModalNovaAberto(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Nova Conversa</Text>
                <Text style={styles.modalSubtitle}>
                  Selecione um condomínio com pedido aberto
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalNovaAberto(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {carregandoNova ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <SolfyLoader size="sm" />
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: 380 }}
                showsVerticalScrollIndicator={false}
              >
                {oportunidadesDisponiveis.length > 0 ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.sectionHeader}>Demandas Despachadas</Text>
                    {oportunidadesDisponiveis.map((item, idx) => {
                      const condoNome = item.condominio_nome || 'Condomínio';
                      const iniciais = condoNome.substring(0, 2).toUpperCase();

                      return (
                        <TouchableOpacity
                          key={`${item.solicitacao_id}_${idx}`}
                          style={styles.newChatItem}
                          activeOpacity={0.7}
                          onPress={() => selecionarOportunidadeNova(item)}
                        >
                          <View
                            style={[
                              styles.newChatAvatar,
                              { backgroundColor: '#059669' },
                            ]}
                          >
                            <Text style={styles.newChatAvatarText}>{iniciais}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.newChatName}>{condoNome}</Text>
                            <Text style={styles.newChatRole}>
                              {item.categoria} · {item.titulo || 'Demanda'}
                            </Text>
                          </View>
                          <ChevronRight size={18} color="#CBD5E1" strokeWidth={2} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                      Nenhuma demanda com chat pendente no momento.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.7}
              onPress={() => setModalNovaAberto(false)}
            >
              <Text style={styles.cancelBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F5F2',
  },
  scrollContent: {
    paddingTop: 0,
  },
  largeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  largeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0D1B12',
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  largeSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
    fontWeight: '500',
  },
  fabBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(13, 27, 18, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 6px rgba(13,27,18,0.06)' }
      : {
          elevation: 2,
          shadowColor: '#0D1B12',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 3,
        }),
  },
  searchBar: {
    height: 44,
    marginHorizontal: 20,
    marginBottom: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(13, 27, 18, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0D1B12',
    height: '100%',
  },
  chipsContainer: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 16,
  },
  chip: {
    height: 34,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(13, 27, 18, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipActive: {
    backgroundColor: '#0D1B12',
    borderColor: '#0D1B12',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0D1B12',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(13, 27, 18, 0.06)',
  },
  chipBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  chipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  chipBadgeTextActive: {
    color: '#FFFFFF',
  },
  chatList: {
    paddingHorizontal: 16,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F3F5F2',
  },
  avatarWrap: {
    position: 'relative',
    width: 52,
    height: 52,
  },
  avatarSquircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2.5,
    borderColor: '#F3F5F2',
  },
  bodyWrap: {
    flex: 1,
    minWidth: 0,
  },
  line1: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  nameText: {
    flex: 1,
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0D1B12',
    letterSpacing: -0.2,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  ctxLineText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#059669',
    marginTop: 2,
  },
  line2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 3,
  },
  previewText: {
    flex: 1,
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 18,
  },
  unreadBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  separator: {
    height: 1,
    marginLeft: 76,
    marginRight: 12,
    backgroundColor: 'rgba(13, 27, 18, 0.06)',
  },
  centerLoading: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 50,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0D1B12',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    maxHeight: '80%',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }
      : {
          elevation: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0D1B12',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 6,
  },
  newChatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  newChatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  newChatName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0D1B12',
  },
  newChatRole: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  cancelBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
