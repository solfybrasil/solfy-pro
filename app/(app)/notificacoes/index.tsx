import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  Clock,
  Shield,
  FileText,
  Calendar,
  Users,
  Megaphone,
  CheckCircle2,
  Sliders,
  WifiOff,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { FONT, C, R, S, SH } from '../../../constants/theme';
import { CONFIG_TEXTS } from '../../../constants/configTexts';
import {
  listarNotificacoesCentral,
  marcarNotificacaoComoLida,
  marcarTodasComoLidas,
  type NotificacaoItem,
  type CategoriaNotificacao,
} from '../../../lib/condoConfigApi';
import { useNotifications } from '../../../contexts/NotificationContext';
import { supabase } from '../../../lib/supabase';

export default function NotificacoesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { recarregarContador, naoLidasTotal } = useNotifications();

  const [itens, setItens] = useState<NotificacaoItem[]>([]);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [recarregando, setRecarregando] = useState(false);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const [filtro, setFiltro] = useState<'todas' | 'nao_lidas'>('todas');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((st) => {
      setOffline(!st.isConnected);
    });
    return () => unsub();
  }, []);

  const carregarNotificacoes = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRecarregando(true);
    } else {
      setCarregando(true);
    }

    try {
      const res = await listarNotificacoesCentral(100, 0);
      setItens(res.dados.itens);
      setTotalNaoLidas(res.dados.total_nao_lidas);

      if (Platform.OS !== 'web') {
        Notifications.setBadgeCountAsync(res.dados.total_nao_lidas).catch(() => {});
      }
    } catch (err) {
      console.warn('[Notificacoes] Erro ao listar notificações:', err);
    } finally {
      setCarregando(false);
      setRecarregando(false);
    }
  }, []);

  // Sincroniza notificações utilizando o canal global único do NotificationContext
  useEffect(() => {
    carregarNotificacoes();
  }, [carregarNotificacoes, naoLidasTotal]);

  const handleMarcarTodas = async () => {
    if (marcandoTodas || totalNaoLidas === 0) return;
    setMarcandoTodas(true);
    try {
      await marcarTodasComoLidas();
      setItens((prev) => prev.map((item) => ({ ...item, lida: true })));
      setTotalNaoLidas(0);
      recarregarContador().catch(() => {});
      if (Platform.OS !== 'web') {
        Notifications.setBadgeCountAsync(0).catch(() => {});
      }
    } catch (err) {
      console.warn('[Notificacoes] Erro ao marcar todas:', err);
    } finally {
      setMarcandoTodas(false);
    }
  };

  const handleToqueItem = async (item: NotificacaoItem) => {
    // 1. Marca como lida se ainda não foi
    if (!item.lida) {
      setItens((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, lida: true } : it))
      );
      setTotalNaoLidas((prev) => Math.max(0, prev - 1));
      if (Platform.OS !== 'web') {
        Notifications.setBadgeCountAsync(Math.max(0, totalNaoLidas - 1)).catch(() => {});
      }
      marcarNotificacaoComoLida(item.id).catch(() => {});
      recarregarContador().catch(() => {});
    }

    // 2. Deep linking se houver acao_url
    if (item.acao_url && item.acao_url.trim().length > 0) {
      const rota = item.acao_url.trim();
      try {
        router.push(rota as any);
      } catch {
        console.warn('[Notificacoes] Rota de deep link não reconhecida:', rota);
      }
    }
  };

  const itensFiltrados = itens.filter((it) => {
    if (filtro === 'nao_lidas') return !it.lida;
    return true;
  });

  const renderIconeCategoria = (categoria: CategoriaNotificacao) => {
    switch (categoria) {
      case 'seguranca_conta':
        return <Shield size={18} color={C.primary} />;
      case 'pedidos_orcamentos':
        return <FileText size={18} color="#D97706" />;
      case 'visitas_execucao':
        return <Calendar size={18} color="#059669" />;
      case 'prazos':
        return <Clock size={18} color="#DC2626" />;
      case 'equipe_convites':
        return <Users size={18} color="#2563EB" />;
      case 'comunicados_solfy':
        return <Megaphone size={18} color="#7C3AED" />;
      case 'decisoes_cadastro':
        return <CheckCircle2 size={18} color={C.primary} />;
      default:
        return <Bell size={18} color={C.primary} />;
    }
  };

  const obterBadgeCategoria = (cat: CategoriaNotificacao) => {
    return (CONFIG_TEXTS.notificacoes.categorias as Record<string, { titulo: string }>)[cat]?.titulo || 'Geral';
  };

  return (
    <View style={styles.container}>
      {/* Barra de Topo */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 24 : 16) + 4 }]}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <ArrowLeft size={20} color={C.textPrimary} strokeWidth={2.4} />
          </TouchableOpacity>
          <View>
            <Text style={styles.topBarTitle}>Notificações</Text>
            {totalNaoLidas > 0 ? (
              <Text style={styles.topBarSub}>
                {totalNaoLidas} {totalNaoLidas === 1 ? 'não lida' : 'não lidas'}
              </Text>
            ) : (
              <Text style={styles.topBarSub}>Todas lidas</Text>
            )}
          </View>
        </View>

        <View style={styles.topBarRight}>
          {totalNaoLidas > 0 && (
            <TouchableOpacity
              style={styles.acaoTopoBtn}
              onPress={handleMarcarTodas}
              disabled={marcandoTodas}
              accessibilityRole="button"
              accessibilityLabel="Marcar todas como lidas"
            >
              {marcandoTodas ? (
                <ActivityIndicator size="small" color={C.primary} />
              ) : (
                <>
                  <CheckCheck size={16} color={C.primary} />
                  <Text style={styles.acaoTopoTexto}>Ler todas</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.ajustesBtn}
            onPress={() => router.push('/(app)/perfil?secao=notificacoes' as any)}
            accessibilityRole="button"
            accessibilityLabel="Configurar preferências de notificação"
          >
            <Sliders size={18} color={C.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Banner Offline */}
      {offline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={16} color={C.warning} />
          <Text style={styles.offlineTexto}>
            Modo offline. Exibindo notificações salvas no dispositivo.
          </Text>
        </View>
      )}

      {/* Filtros em Pílulas */}
      <View style={styles.filtrosRow}>
        <TouchableOpacity
          style={[styles.filtroPill, filtro === 'todas' && styles.filtroPillAtiva]}
          onPress={() => setFiltro('todas')}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.filtroPillTexto,
              filtro === 'todas' && styles.filtroPillTextoAtiva,
            ]}
          >
            Todas ({itens.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filtroPill, filtro === 'nao_lidas' && styles.filtroPillAtiva]}
          onPress={() => setFiltro('nao_lidas')}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.filtroPillTexto,
              filtro === 'nao_lidas' && styles.filtroPillTextoAtiva,
            ]}
          >
            Não lidas ({totalNaoLidas})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Notificações */}
      {carregando && itens.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingTexto}>Carregando notificações...</Text>
        </View>
      ) : (
        <FlatList
          data={itensFiltrados}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 40 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={recarregando}
              onRefresh={() => carregarNotificacoes(true)}
              colors={[C.primary]}
              tintColor={C.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <Bell size={36} color={C.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>
                {filtro === 'nao_lidas'
                  ? 'Nenhuma notificação não lida'
                  : 'Nenhuma notificação por aqui'}
              </Text>
              <Text style={styles.emptyDesc}>
                {filtro === 'nao_lidas'
                  ? 'Você já leu todos os comunicados e atualizações recentes.'
                  : 'Quando houver novidades sobre orçamentos, vistorias ou segurança da sua conta, elas aparecerão aqui.'}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index * 25, 200)).duration(260)}>
              <TouchableOpacity
                style={[styles.notifCard, !item.lida && styles.notifCardNaoLida]}
                activeOpacity={0.8}
                onPress={() => handleToqueItem(item)}
                accessibilityRole="button"
              >
                {!item.lida && <View style={styles.pontoNaoLida} />}

                <View
                  style={[
                    styles.notifIconWrap,
                    !item.lida && styles.notifIconWrapNaoLida,
                  ]}
                >
                  {renderIconeCategoria(item.categoria)}
                </View>

                <View style={styles.notifCorpo}>
                  <View style={styles.notifCabecalho}>
                    <View style={styles.badgeCategoria}>
                      <Text style={styles.badgeCategoriaTexto}>
                        {obterBadgeCategoria(item.categoria)}
                      </Text>
                    </View>
                    <Text style={styles.notifDate}>{item.criado_em_fmt}</Text>
                  </View>

                  <Text
                    style={[styles.notifTitle, !item.lida && styles.notifTitleDestaque]}
                    numberOfLines={2}
                  >
                    {item.titulo}
                  </Text>

                  <Text style={styles.notifDesc} numberOfLines={3}>
                    {item.corpo}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    backgroundColor: C.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  ajustesBtn: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    backgroundColor: C.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  acaoTopoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: R.md,
    backgroundColor: C.primaryLight,
  },
  acaoTopoTexto: {
    fontSize: 12,
    fontFamily: FONT.semiBold,
    color: C.primary,
  },
  topBarTitle: {
    fontSize: 16,
    fontFamily: FONT.bold,
    color: C.textPrimary,
  },
  topBarSub: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: C.textSecondary,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  offlineTexto: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: '#92400E',
    flex: 1,
  },
  filtrosRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  filtroPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: R.full,
    backgroundColor: C.background,
    borderWidth: 1,
    borderColor: C.border,
  },
  filtroPillAtiva: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  filtroPillTexto: {
    fontSize: 12.5,
    fontFamily: FONT.medium,
    color: C.textSecondary,
  },
  filtroPillTextoAtiva: {
    color: '#FFFFFF',
    fontFamily: FONT.bold,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 12,
  },
  notifCard: {
    position: 'relative',
    flexDirection: 'row',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: R.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    ...SH.card,
  },
  notifCardNaoLida: {
    borderColor: C.primary,
    backgroundColor: '#FAFDFB',
  },
  pontoNaoLida: {
    position: 'absolute',
    top: 14,
    left: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.primary,
  },
  notifIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  notifIconWrapNaoLida: {
    backgroundColor: C.primaryLight,
    borderColor: C.primary,
  },
  notifCorpo: {
    flex: 1,
    gap: 4,
  },
  notifCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  badgeCategoria: {
    backgroundColor: C.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: C.border,
  },
  badgeCategoriaTexto: {
    fontSize: 10.5,
    fontFamily: FONT.medium,
    color: C.textSecondary,
  },
  notifDate: {
    fontSize: 11,
    fontFamily: FONT.regular,
    color: C.textMuted,
  },
  notifTitle: {
    fontSize: 14,
    fontFamily: FONT.semiBold,
    color: C.textPrimary,
    lineHeight: 18,
  },
  notifTitleDestaque: {
    fontFamily: FONT.bold,
    color: C.textPrimary,
  },
  notifDesc: {
    fontSize: 12.5,
    fontFamily: FONT.regular,
    color: C.textSecondary,
    lineHeight: 17,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 60,
  },
  loadingTexto: {
    fontSize: 13,
    fontFamily: FONT.medium,
    color: C.textMuted,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: FONT.bold,
    color: C.textPrimary,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: FONT.regular,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
