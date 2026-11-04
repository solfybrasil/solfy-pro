import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Platform,
  Dimensions,
  StatusBar,
  TextInput,
  FlatList,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Clock,
  Check,
  ShieldCheck,
  Wrench,
  Zap,
  Droplets,
  AlertCircle,
  User,
  MapPin,
  X,
  MessageSquare,
  Building2,
  Bell,
  Sparkles,
  Calendar as CalendarIcon,
  Sun,
  Paintbrush,
  RotateCcw,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { SolfyLoader } from '../../../components/SolfyLoader';
import {
  listarCompromissosAgenda,
  confirmarVisitaPelaAgenda,
  cancelarVisitaPelaAgenda,
  type AgendaCompromissoItem,
} from '../../../lib/condoAgendaApi';
import { supabase } from '../../../lib/supabase';
import AuroraBackground from '../../../components/AuroraBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── GEOMETRIA DO CARROSSEL COVERFLOW 3D ─────────────────────────────────────
const CAROUSEL_ITEM_WIDTH = 62;
const CAROUSEL_ITEM_SPACING = 10;

// ─── PALETA E CORES DO DESIGN ────────────────────────────────────────────────
const THEME = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  ink: '#0F172A',
  sub: '#64748B',
  mute: '#94A3B8',
  line: 'rgba(13, 27, 18, 0.08)',
  deep: '#132817',
  mid: '#2E5A36',
  accent: '#059669',
  accentSoft: '#DCFCE7',
  accentInk: '#15803D',
  purple: '#8B5CF6',
  purpleSoft: '#EDE9FE',
  purpleBg: '#FAF5FF',
};

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const DIAS_LONGOS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function formatIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromIso(iso: string): Date {
  const [ano, mes, dia] = iso.split('-');
  return new Date(Number(ano), Number(mes) - 1, Number(dia), 12, 0, 0);
}

function addDaysIso(iso: string, n: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return formatIso(d);
}

// ─── CARROSSEL DAY ITEM ──────────────────────────────────────────────────────
interface CoverflowDayItemProps {
  item: { iso: string; diaNum: number; diaNomeFormatado: string };
  isSelected: boolean;
  isToday: boolean;
  eventCount: number;
  onSelect: (iso: string) => void;
}

const CoverflowDayItem = React.memo(function CoverflowDayItem({
  item,
  isSelected,
  isToday,
  eventCount,
  onSelect,
}: CoverflowDayItemProps) {
  return (
    <View style={styles.coverflowSlide}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onSelect(item.iso)}
        style={[
          styles.dayPill,
          isSelected && styles.dayPillActive,
        ]}
      >
        {isSelected && <View style={styles.dayPillHighlight} />}

        <Text
          style={[
            styles.dayPillWeekday,
            isSelected && styles.dayPillWeekdayActive,
          ]}
        >
          {item.diaNomeFormatado}
        </Text>

        <Text
          style={[
            styles.dayPillNum,
            isSelected
              ? styles.dayPillNumActive
              : isToday
              ? styles.dayPillNumToday
              : styles.dayPillNumInactive,
          ]}
        >
          {item.diaNum}
        </Text>

        {/* Pontos de eventos */}
        <View style={styles.dayPillDots}>
          {Array.from({ length: Math.min(eventCount, 3) }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dayPillDot,
                isSelected && styles.dayPillDotActive,
              ]}
            />
          ))}
        </View>
      </TouchableOpacity>
    </View>
  );
});

// ─── TELA PRINCIPAL DA AGENDA DO PRESTADOR ───────────────────────────────────
export default function AgendaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prestador } = useAuth();
  const { enfileirarNotificacao } = useNotifications();

  const [hojeIso] = useState(() => formatIso(new Date()));
  const [diaSelecionadoIso, setDiaSelecionadoIso] = useState(hojeIso);
  const [mesNavegado, setMesNavegado] = useState(() => new Date());
  const [modoVisualizacao, setModoVisualizacao] = useState<'semana' | 'mes'>('semana');

  // Filtro de tipos: todos, visita_tecnica, execucao_obra
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'visita_tecnica' | 'execucao_obra'>('todos');

  const [compromissos, setCompromissos] = useState<AgendaCompromissoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modais
  const [compromissoSelecionado, setCompromissoSelecionado] = useState<AgendaCompromissoItem | null>(null);
  const [modalCancelarVisivel, setModalCancelarVisivel] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [executandoAcao, setExecutandoAcao] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMsg(null), 3000);
  };

  // Carrossel
  const carouselFlatListRef = useRef<FlatList<any>>(null);

  const diasCarrossel = useMemo(() => {
    const list = [];
    for (let i = -15; i <= 15; i++) {
      const iso = addDaysIso(hojeIso, i);
      const d = fromIso(iso);
      list.push({
        iso,
        diaNum: d.getDate(),
        diaNomeFormatado: DIAS_SEMANA[d.getDay()],
        d,
      });
    }
    return list;
  }, [hojeIso]);

  const hojeIndexNoCarrossel = useMemo(() => {
    const idx = diasCarrossel.findIndex((d) => d.iso === hojeIso);
    return idx >= 0 ? idx : 15;
  }, [diasCarrossel, hojeIso]);

  const centralizarDia = useCallback(
    (iso: string, smooth = true) => {
      setDiaSelecionadoIso(iso);
      const idx = diasCarrossel.findIndex((d) => d.iso === iso);
      if (idx >= 0 && carouselFlatListRef.current) {
        const itemWidth = CAROUSEL_ITEM_WIDTH + CAROUSEL_ITEM_SPACING;
        const targetOffset = Math.max(0, 20 + idx * itemWidth - SCREEN_WIDTH / 2 + CAROUSEL_ITEM_WIDTH / 2);
        carouselFlatListRef.current.scrollToOffset({
          offset: targetOffset,
          animated: smooth,
        });
      }
    },
    [diasCarrossel]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (hojeIndexNoCarrossel >= 0 && carouselFlatListRef.current) {
        const itemWidth = CAROUSEL_ITEM_WIDTH + CAROUSEL_ITEM_SPACING;
        const targetOffset = Math.max(0, 20 + hojeIndexNoCarrossel * itemWidth - SCREEN_WIDTH / 2 + CAROUSEL_ITEM_WIDTH / 2);
        carouselFlatListRef.current.scrollToOffset({
          offset: targetOffset,
          animated: false,
        });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [hojeIndexNoCarrossel]);

  // Carrega compromissos do prestador
  const carregarCompromissos = useCallback(
    async (silent = false) => {
      if (!prestador?.id) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (!silent) setLoading(true);
        const dados = await listarCompromissosAgenda({ prestadorId: prestador.id });
        setCompromissos(dados || []);
      } catch (err) {
        console.error('[AgendaPrestador] Erro ao carregar compromissos:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [prestador?.id]
  );

  useEffect(() => {
    carregarCompromissos();
  }, [carregarCompromissos]);

  // Realtime Supabase filtrado para o prestador
  useEffect(() => {
    if (!prestador?.id) return;
    const channel = supabase
      .channel(`agenda_realtime_prestador_${prestador.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agenda_compromissos',
          filter: `prestador_id=eq.${prestador.id}`,
        },
        () => {
          carregarCompromissos(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [prestador?.id, carregarCompromissos]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    carregarCompromissos();
  }, [carregarCompromissos]);

  // Contagem de eventos por data
  const contagemPorData = useMemo(() => {
    const map = new Map<string, number>();
    compromissos.forEach((c) => {
      if (c.status !== 'cancelado' && c.data_inicio) {
        map.set(c.data_inicio, (map.get(c.data_inicio) || 0) + 1);
      }
    });
    return map;
  }, [compromissos]);

  // Compromissos do dia selecionado
  const compromissosDoDia = useMemo(() => {
    return compromissos.filter((c) => {
      if (c.status === 'cancelado') return false;
      return c.data_inicio === diaSelecionadoIso;
    });
  }, [compromissos, diaSelecionadoIso]);

  // Compromissos filtrados por tipo (todos, visita_tecnica, execucao_obra)
  const compromissosFiltrados = useMemo(() => {
    if (filtroTipo === 'todos') return compromissosDoDia;
    return compromissosDoDia.filter((c) => c.tipo === filtroTipo);
  }, [compromissosDoDia, filtroTipo]);

  // Subtítulo dinâmico do Header
  const heroSubtitulo = useMemo(() => {
    const pendentesHoje = compromissos.filter((c) => c.data_inicio === hojeIso);
    if (pendentesHoje.length > 0) {
      const primeiro = pendentesHoje[0];
      return `${pendentesHoje.length} ${
        pendentesHoje.length > 1 ? 'visitas técnicas hoje' : 'visita técnica hoje'
      } • próxima às ${primeiro.horario_inicio}`;
    }
    return 'Acompanhe suas vistorias e obras agendadas com síndicos';
  }, [compromissos, hojeIso]);

  // Título e subtítulo da seção no card branco
  const { sectionTitle, sectionSubdate } = useMemo(() => {
    const d = fromIso(diaSelecionadoIso);
    const mesNome = NOMES_MESES[d.getMonth()];
    const diaNum = d.getDate();
    const diaSemanaLongo = DIAS_LONGOS[d.getDay()];

    let title = `Agenda • ${diaNum} de ${mesNome}`;
    if (diaSelecionadoIso === hojeIso) title = 'Agenda de hoje';
    else if (diaSelecionadoIso === addDaysIso(hojeIso, 1)) title = 'Agenda de amanhã';
    else if (diaSelecionadoIso === addDaysIso(hojeIso, -1)) title = 'Agenda de ontem';

    return {
      sectionTitle: title,
      sectionSubdate: `${diaSemanaLongo}, ${diaNum} de ${mesNome}`,
    };
  }, [diaSelecionadoIso, hojeIso]);

  // Insights do Prestador
  const { totalConfirmados, totalPendentes, insightTexto } = useMemo(() => {
    const confirmados = compromissosDoDia.filter((c) => c.status === 'confirmado').length;
    const pendentes = compromissosDoDia.filter((c) => c.status === 'agendado').length;

    let texto = 'Dia livre. Nenhuma visita técnica ou obra agendada para esta data.';
    if (compromissosDoDia.length > 0) {
      texto = `${compromissosDoDia.length} compromisso${compromissosDoDia.length > 1 ? 's' : ''} em condomínio${
        compromissosDoDia.length > 1 ? 's' : ''
      } para este dia. Lembre-se de comparecer na janela acordada com o síndico.`;
    }

    return {
      totalConfirmados: confirmados,
      totalPendentes: pendentes,
      insightTexto: texto,
    };
  }, [compromissosDoDia]);

  // Alterna confirmação de presença do prestador
  const handleAlternarConfirmacao = async (item: AgendaCompromissoItem) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    const novoStatus = item.status === 'confirmado' ? 'agendado' : 'confirmado';

    setCompromissos((prev) =>
      prev.map((c) => (c.id === item.id ? { ...c, status: novoStatus } : c))
    );

    try {
      if (novoStatus === 'confirmado') {
        await confirmarVisitaPelaAgenda(item.id, 'prestador');
        showToast('Presença confirmada no condomínio!');
      } else {
        showToast('Visita marcada como pendente de confirmação.');
      }
      carregarCompromissos(true);
    } catch (e) {
      console.error('[AgendaPrestador] Erro ao alternar:', e);
      carregarCompromissos(true);
    }
  };

  // Cancelar visita
  const handleConfirmarCancelar = async () => {
    if (!compromissoSelecionado) return;
    try {
      setExecutandoAcao(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
      await cancelarVisitaPelaAgenda(
        compromissoSelecionado.id,
        motivoCancelamento || 'Solicitado pelo prestador'
      );
      setCompromissos((prev) => prev.filter((c) => c.id !== compromissoSelecionado.id));
      setModalCancelarVisivel(false);
      setCompromissoSelecionado(null);
      setMotivoCancelamento('');
      showToast('Compromisso cancelado e síndico avisado.');
      carregarCompromissos(true);
    } catch (err) {
      console.error('[AgendaPrestador] Erro ao cancelar:', err);
    } finally {
      setExecutandoAcao(false);
    }
  };

  // Grade do Mês
  const diasDoMes = useMemo(() => {
    const ano = mesNavegado.getFullYear();
    const mes = mesNavegado.getMonth();
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const totalDiasNoMes = new Date(ano, mes + 1, 0).getDate();

    const grid = [];
    for (let i = 0; i < primeiroDiaSemana; i++) grid.push(null);
    for (let d = 1; d <= totalDiasNoMes; d++) {
      const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      grid.push({ dia: d, iso });
    }
    return grid;
  }, [mesNavegado]);

  const renderIconeCategoria = (tipo?: string, titulo?: string) => {
    const tit = (titulo || '').toLowerCase();
    if (tit.includes('elét') || tit.includes('elet') || tit.includes('luz')) {
      return <Zap size={18} color="#B45309" strokeWidth={2.2} />;
    }
    if (tit.includes('hidr') || tit.includes('água') || tit.includes('vazam') || tit.includes('cano')) {
      return <Droplets size={18} color="#0369A1" strokeWidth={2.2} />;
    }
    if (tit.includes('elevad')) {
      return <Building2 size={18} color="#4338CA" strokeWidth={2.2} />;
    }
    if (tit.includes('solar') || tit.includes('fotovolt')) {
      return <Sun size={18} color="#C2410C" strokeWidth={2.2} />;
    }
    if (tit.includes('pint') || tit.includes('fachada')) {
      return <Paintbrush size={18} color="#BE185D" strokeWidth={2.2} />;
    }
    return <Wrench size={18} color="#15803D" strokeWidth={2.2} />;
  };

  const getCategoriaBoxStyle = (titulo?: string) => {
    const tit = (titulo || '').toLowerCase();
    if (tit.includes('elét') || tit.includes('elet') || tit.includes('luz')) return { backgroundColor: '#FEF3C7' };
    if (tit.includes('hidr') || tit.includes('água') || tit.includes('vazam')) return { backgroundColor: '#DFF1FB' };
    if (tit.includes('elevad')) return { backgroundColor: '#E8EAFE' };
    if (tit.includes('solar') || tit.includes('fotovolt')) return { backgroundColor: '#FFEBD5' };
    if (tit.includes('pint')) return { backgroundColor: '#FFE4EC' };
    return { backgroundColor: '#DCFCE7' };
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── AMBIENT AURORA BACKGROUND ── */}
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

      {/* ── 1. HERO COM AURORA E CABEÇALHO ── */}
      <View style={styles.heroContainer}>
        <View
          style={[
            styles.topHeaderRow,
            { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 24 : 16) + 4 },
          ]}
        >
          <View style={styles.headerLeftCol}>
            <Text style={styles.mainTitle}>Agenda</Text>
            <Text style={styles.mainSubtitle} numberOfLines={1}>
              {heroSubtitulo}
            </Text>
          </View>

          <View style={styles.headerRightActions}>
            {diaSelecionadoIso !== hojeIso && (
              <TouchableOpacity
                style={styles.hojePillBtn}
                activeOpacity={0.8}
                onPress={() => centralizarDia(hojeIso, true)}
              >
                <Text style={styles.hojePillBtnText}>Hoje</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.plusButton3D}
              activeOpacity={0.75}
              onPress={() => router.push('/(app)/demandas')}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.22)', 'rgba(255, 255, 255, 0.08)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.plusGlassCard}
              >
                <View style={styles.plusGlassHighlight} pointerEvents="none" />
                <Plus size={20} color="#FFFFFF" strokeWidth={2.4} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 2. CARROSSEL DE DIAS COVERFLOW ── */}
        <View style={styles.coverflowContainer}>
          <FlatList
            ref={carouselFlatListRef}
            data={diasCarrossel}
            keyExtractor={(item) => item.iso}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="normal"
            style={styles.coverflowFlatList}
            contentContainerStyle={styles.coverflowContentList}
            getItemLayout={(_, index) => ({
              length: CAROUSEL_ITEM_WIDTH + CAROUSEL_ITEM_SPACING,
              offset: 20 + (CAROUSEL_ITEM_WIDTH + CAROUSEL_ITEM_SPACING) * index,
              index,
            })}
            renderItem={({ item }) => (
              <CoverflowDayItem
                item={item}
                isSelected={item.iso === diaSelecionadoIso}
                isToday={item.iso === hojeIso}
                eventCount={contagemPorData.get(item.iso) || 0}
                onSelect={(iso) => centralizarDia(iso, true)}
              />
            )}
          />
        </View>
      </View>

      {/* ── 3. FOLHA BRANCA ARREDONDADA ── */}
      <View style={styles.whiteBodyCard}>
        <ScrollView
          contentContainerStyle={[styles.scrollContainer, { paddingBottom: 110 + Math.max(insets.bottom, 24) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#059669"
              colors={['#059669']}
            />
          }
        >
          {/* Mês Expandido (Dropdown) */}
          {modoVisualizacao === 'mes' && (
            <Animated.View entering={FadeInDown.duration(280)} style={styles.monthCalendarCard}>
              <View style={styles.monthNavRow}>
                <TouchableOpacity
                  style={styles.monthNavArrow}
                  onPress={() => {
                    const d = new Date(mesNavegado);
                    d.setMonth(d.getMonth() - 1);
                    setMesNavegado(d);
                  }}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={18} color={THEME.ink} strokeWidth={2.5} />
                </TouchableOpacity>

                <View style={styles.monthNavCenter}>
                  <Text style={styles.monthNavTitle}>
                    {NOMES_MESES[mesNavegado.getMonth()].toUpperCase()} {mesNavegado.getFullYear()}
                  </Text>
                  {diaSelecionadoIso !== hojeIso && (
                    <TouchableOpacity
                      style={styles.todayQuickBtn}
                      onPress={() => centralizarDia(hojeIso, true)}
                    >
                      <Text style={styles.todayQuickBtnText}>Hoje</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.monthNavArrow}
                  onPress={() => {
                    const d = new Date(mesNavegado);
                    d.setMonth(d.getMonth() + 1);
                    setMesNavegado(d);
                  }}
                  activeOpacity={0.7}
                >
                  <ChevronRight size={18} color={THEME.ink} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              {/* Dias da Semana (D S T Q Q S S) */}
              <View style={styles.monthWeekdaysRow}>
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((letra, i) => (
                  <Text key={i} style={styles.monthWeekdayLetter}>
                    {letra}
                  </Text>
                ))}
              </View>

              {/* Grade de Dias */}
              <View style={styles.monthDaysGrid}>
                {diasDoMes.map((item, idx) => {
                  if (item === null) {
                    return <View key={`blank_${idx}`} style={styles.monthDayCell} />;
                  }

                  const isSelected = item.iso === diaSelecionadoIso;
                  const isToday = item.iso === hojeIso;
                  const hasEvents = (contagemPorData.get(item.iso) || 0) > 0;

                  return (
                    <TouchableOpacity
                      key={item.iso}
                      style={[
                        styles.monthDayCell,
                        isSelected && styles.monthDayCellSelected,
                        isToday && !isSelected && styles.monthDayCellToday,
                      ]}
                      activeOpacity={0.8}
                      onPress={() => {
                        centralizarDia(item.iso, true);
                        setModoVisualizacao('semana');
                      }}
                    >
                      <Text
                        style={[
                          styles.monthDayCellText,
                          isSelected && styles.monthDayCellTextSelected,
                          isToday && !isSelected && styles.monthDayCellTextToday,
                        ]}
                      >
                        {item.dia}
                      </Text>
                      {hasEvents && (
                        <View
                          style={[
                            styles.monthDot,
                            isSelected && { backgroundColor: '#6EE7B7' },
                          ]}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* Section Header Row */}
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>{sectionTitle}</Text>
              <Text style={styles.sectionSubdate}>{sectionSubdate}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.dateDropdownPill,
                modoVisualizacao === 'mes' && styles.dateDropdownPillActive,
              ]}
              activeOpacity={0.75}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.selectionAsync().catch(() => {});
                }
                setModoVisualizacao(modoVisualizacao === 'semana' ? 'mes' : 'semana');
              }}
            >
              <CalendarIcon
                size={13}
                color={modoVisualizacao === 'mes' ? '#FFFFFF' : '#334155'}
                strokeWidth={2.4}
              />
              <Text
                style={[
                  styles.dateDropdownText,
                  modoVisualizacao === 'mes' && styles.dateDropdownTextActive,
                ]}
              >
                {`${NOMES_MESES[fromIso(diaSelecionadoIso).getMonth()]} ${fromIso(diaSelecionadoIso).getFullYear()}`}
              </Text>
              <ChevronDown
                size={12}
                color={modoVisualizacao === 'mes' ? '#FFFFFF' : '#334155'}
                strokeWidth={2.4}
                style={{
                  transform: [{ rotate: modoVisualizacao === 'mes' ? '180deg' : '0deg' }],
                }}
              />
            </TouchableOpacity>
          </View>

          {/* ── CARD INSIGHT PONTILHADO (DASHED) ── */}
          <View style={styles.dashedInsightCard}>
            <View style={styles.insightIconSquircle}>
              <Sparkles size={16} color="#8B5CF6" strokeWidth={2.4} />
            </View>
            <View style={styles.insightTextCol}>
              <Text style={styles.insightTitle}>Solfy Agenda Insight</Text>
              <Text style={styles.insightDesc}>{insightTexto}</Text>
            </View>
          </View>

          {/* ── SEGMENTED FILTER BUTTONS (.seg) ── */}
          {compromissosDoDia.length > 0 && (
            <View style={styles.segContainer}>
              <TouchableOpacity
                style={[styles.segBtn, filtroTipo === 'todos' && styles.segBtnActive]}
                activeOpacity={0.75}
                onPress={() => setFiltroTipo('todos')}
              >
                <Text style={[styles.segBtnText, filtroTipo === 'todos' && styles.segBtnTextActive]}>
                  Todos
                </Text>
                <Text style={[styles.segBtnCount, filtroTipo === 'todos' && styles.segBtnCountActive]}>
                  {compromissosDoDia.length}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segBtn, filtroTipo === 'visita_tecnica' && styles.segBtnActive]}
                activeOpacity={0.75}
                onPress={() => setFiltroTipo('visita_tecnica')}
              >
                <Text style={[styles.segBtnText, filtroTipo === 'visita_tecnica' && styles.segBtnTextActive]}>
                  Vistorias
                </Text>
                <Text style={[styles.segBtnCount, filtroTipo === 'visita_tecnica' && styles.segBtnCountActive]}>
                  {compromissosDoDia.filter((c) => c.tipo === 'visita_tecnica').length}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segBtn, filtroTipo === 'execucao_obra' && styles.segBtnActive]}
                activeOpacity={0.75}
                onPress={() => setFiltroTipo('execucao_obra')}
              >
                <Text style={[styles.segBtnText, filtroTipo === 'execucao_obra' && styles.segBtnTextActive]}>
                  Obras
                </Text>
                <Text style={[styles.segBtnCount, filtroTipo === 'execucao_obra' && styles.segBtnCountActive]}>
                  {compromissosDoDia.filter((c) => c.tipo === 'execucao_obra').length}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── LISTA DE COMPROMISSOS ── */}
          {loading ? (
            <View style={styles.centerLoading}>
              <SolfyLoader size="md" />
            </View>
          ) : compromissosFiltrados.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconBox}>
                <CalendarIcon size={26} color="#059669" strokeWidth={2} />
              </View>
              <Text style={styles.emptyTitle}>
                {compromissosDoDia.length > 0
                  ? 'Nada neste filtro'
                  : 'Nenhum compromisso nesta data'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {compromissosDoDia.length > 0
                  ? 'Troque o filtro acima para ver os outros compromissos do dia.'
                  : 'Quando você aceitar agendamentos de visita técnica ou tiver obras em andamento, eles aparecerão aqui.'}
              </Text>
            </View>
          ) : (
            <View style={styles.timelineList}>
              {compromissosFiltrados.map((item, index) => {
                const isConfirmado = item.status === 'confirmado';

                return (
                  <Animated.View
                    key={item.id}
                    entering={FadeInDown.delay(index * 30).duration(240)}
                  >
                    <TouchableOpacity
                      style={styles.reliefCard}
                      activeOpacity={0.85}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.selectionAsync().catch(() => {});
                        }
                        setCompromissoSelecionado(item);
                      }}
                    >
                      {/* Checkbox Circular */}
                      <TouchableOpacity
                        style={[
                          styles.checkboxRadio,
                          isConfirmado && styles.checkboxRadioChecked,
                        ]}
                        activeOpacity={0.7}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleAlternarConfirmacao(item);
                        }}
                      >
                        {isConfirmado && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                      </TouchableOpacity>

                      {/* Cápsula de Categoria Temática */}
                      <View style={[styles.categoryPillBox, getCategoriaBoxStyle(item.titulo)]}>
                        {renderIconeCategoria(item.tipo, item.titulo)}
                      </View>

                      {/* Conteúdo Central */}
                      <View style={styles.cardContent}>
                        <Text style={styles.cardMainTitle} numberOfLines={1}>
                          {item.titulo}
                        </Text>
                        <Text style={styles.cardSubText} numberOfLines={1}>
                          {item.horario_inicio} – {item.horario_fim} • {item.condominio_nome || item.local_especifico || 'Condomínio'}
                        </Text>

                        {/* Chips de Status */}
                        <View style={styles.cardChipsRow}>
                          <View
                            style={[
                              styles.chipBadge,
                              isConfirmado ? styles.chipGreen : styles.chipAmber,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipBadgeText,
                                isConfirmado ? styles.chipGreenText : styles.chipAmberText,
                              ]}
                            >
                              {isConfirmado ? 'Confirmado' : 'Agendado'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <ChevronRight size={15} color="#94A3B8" strokeWidth={2.4} />
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>

      {/* ── MODAL DETALHES DO COMPROMISSO (BOTTOM SHEET) ── */}
      <Modal
        visible={!!compromissoSelecionado && !modalCancelarVisivel}
        transparent
        animationType="slide"
        onRequestClose={() => setCompromissoSelecionado(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCompromissoSelecionado(null)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalOverline}>
                  {compromissoSelecionado?.tipo === 'visita_tecnica' ? 'Vistoria Técnica' : 'Execução de Obra'}
                </Text>
                <Text style={styles.modalTitle}>{compromissoSelecionado?.titulo}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setCompromissoSelecionado(null)}
              >
                <X size={16} color="#64748B" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              {compromissoSelecionado?.descricao || 'Visita técnica registrada no condomínio.'}
            </Text>

            {/* Grid 2x2 Meta */}
            <View style={styles.modalMetaGrid}>
              <View style={styles.metaCard}>
                <Text style={styles.metaCardLabel}>DATA</Text>
                <Text style={styles.metaCardValue}>
                  {fromIso(compromissoSelecionado?.data_inicio || hojeIso).getDate()}{' '}
                  {NOMES_MESES[fromIso(compromissoSelecionado?.data_inicio || hojeIso).getMonth()].slice(0, 3)}
                </Text>
              </View>
              <View style={styles.metaCard}>
                <Text style={styles.metaCardLabel}>HORÁRIO</Text>
                <Text style={styles.metaCardValue}>
                  {compromissoSelecionado?.horario_inicio} - {compromissoSelecionado?.horario_fim}
                </Text>
              </View>
              <View style={styles.metaCard}>
                <Text style={styles.metaCardLabel}>CONDOMÍNIO</Text>
                <Text style={styles.metaCardValue} numberOfLines={1}>
                  {compromissoSelecionado?.condominio_nome || 'Condomínio'}
                </Text>
              </View>
              <View style={styles.metaCard}>
                <Text style={styles.metaCardLabel}>LOCAL ESPECÍFICO</Text>
                <Text style={styles.metaCardValue} numberOfLines={1}>
                  {compromissoSelecionado?.local_especifico || 'Área Comum'}
                </Text>
              </View>
            </View>

            {/* Ações */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={
                  compromissoSelecionado?.status === 'confirmado'
                    ? styles.btnSoftAction
                    : styles.btnPrimaryAction
                }
                activeOpacity={0.85}
                onPress={() => {
                  if (compromissoSelecionado) {
                    handleAlternarConfirmacao(compromissoSelecionado);
                    setCompromissoSelecionado(null);
                  }
                }}
              >
                <Check size={18} color={compromissoSelecionado?.status === 'confirmado' ? '#047857' : '#FFFFFF'} strokeWidth={2.6} />
                <Text
                  style={
                    compromissoSelecionado?.status === 'confirmado'
                      ? styles.btnSoftActionText
                      : styles.btnPrimaryActionText
                  }
                >
                  {compromissoSelecionado?.status === 'confirmado'
                    ? 'Presença confirmada · Desfazer'
                    : 'Confirmar Presença no Condomínio'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnSecondaryAction}
                activeOpacity={0.8}
                onPress={() => {
                  setCompromissoSelecionado(null);
                  router.push('/(app)/chat');
                }}
              >
                <MessageSquare size={17} color="#0F172A" strokeWidth={2.2} />
                <Text style={styles.btnSecondaryActionText}>Conversar com o Síndico</Text>
              </TouchableOpacity>

              {compromissoSelecionado?.solicitacao_id && (
                <TouchableOpacity
                  style={[styles.btnSecondaryAction, { marginTop: 8 }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    const sid = compromissoSelecionado.solicitacao_id;
                    setCompromissoSelecionado(null);
                    router.push(`/(app)/demandas/${sid}` as any);
                  }}
                >
                  <Wrench size={16} color="#0F172A" strokeWidth={2.2} />
                  <Text style={styles.btnSecondaryActionText}>Ver Detalhes da Demanda / Cotação</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── TOAST FLUTUANTE ── */}
      {toastMsg && (
        <View style={styles.toastWrap}>
          <Check size={14} color="#FFFFFF" strokeWidth={2.8} />
          <Text style={styles.toastWrapText}>{toastMsg}</Text>
        </View>
      )}
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
    height: 480,
    overflow: 'hidden',
  },
  heroContainer: {
    paddingBottom: 20,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerLeftCol: {
    flex: 1,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  mainSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hojePillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  hojePillBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  plusButton3D: {
    width: 40,
    height: 40,
    borderRadius: 14,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 0,
      },
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  plusGlassCard: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    position: 'relative',
    overflow: 'hidden',
  },
  plusGlassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    zIndex: 10,
  },
  coverflowContainer: {
    marginTop: 6,
  },
  coverflowFlatList: {
    overflow: 'visible',
  },
  coverflowContentList: {
    paddingHorizontal: 20,
    gap: CAROUSEL_ITEM_SPACING,
  },
  coverflowSlide: {
    width: CAROUSEL_ITEM_WIDTH,
  },
  dayPill: {
    height: 74,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  dayPillActive: {
    backgroundColor: '#0D1B12',
    borderColor: '#10B981',
  },
  dayPillHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dayPillWeekday: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'uppercase',
  },
  dayPillWeekdayActive: {
    color: '#6EE7B7',
  },
  dayPillNum: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  dayPillNumActive: {
    color: '#FFFFFF',
  },
  dayPillNumToday: {
    color: '#6EE7B7',
  },
  dayPillNumInactive: {
    color: '#FFFFFF',
  },
  dayPillDots: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 4,
    height: 4,
  },
  dayPillDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10B981',
  },
  dayPillDotActive: {
    backgroundColor: '#6EE7B7',
  },
  whiteBodyCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sectionSubdate: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 1,
  },
  dateDropdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  dateDropdownPillActive: {
    backgroundColor: '#0D1B12',
  },
  dateDropdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  dateDropdownTextActive: {
    color: '#FFFFFF',
  },
  dashedInsightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#FAF5FF',
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  insightIconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTextCol: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#4C1D95',
    marginBottom: 1,
  },
  insightDesc: {
    fontSize: 11.5,
    color: '#6D28D9',
    lineHeight: 15,
  },
  segContainer: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginBottom: 16,
  },
  segBtn: {
    flex: 1,
    height: 32,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  segBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  segBtnTextActive: {
    color: '#0F172A',
  },
  segBtnCount: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#94A3B8',
  },
  segBtnCountActive: {
    color: '#059669',
  },
  timelineList: {
    gap: 10,
  },
  reliefCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(13, 27, 18, 0.08)',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)' }
      : {
          elevation: 1,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
        }),
  },
  checkboxRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxRadioChecked: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  categoryPillBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  cardMainTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.15,
  },
  cardSubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  cardChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  chipBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  chipBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  chipGreen: {
    backgroundColor: '#DCFCE7',
  },
  chipGreenText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#15803D',
  },
  chipAmber: {
    backgroundColor: '#FEF3C7',
  },
  chipAmberText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#B45309',
  },
  centerLoading: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalOverline: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  metaCard: {
    width: (SCREEN_WIDTH - 50) / 2,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaCardValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 3,
  },
  modalActions: {
    gap: 10,
  },
  btnPrimaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#059669',
  },
  btnPrimaryActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnSoftAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
  },
  btnSoftActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803D',
  },
  btnSecondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  btnSecondaryActionText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  toastWrap: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0D1B12',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  toastWrapText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  monthCalendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthNavArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthNavTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  todayQuickBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#059669',
  },
  todayQuickBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  monthWeekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  monthWeekdayLetter: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    width: 32,
    textAlign: 'center',
  },
  monthDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  monthDayCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    position: 'relative',
  },
  monthDayCellSelected: {
    backgroundColor: '#0D1B12',
  },
  monthDayCellToday: {
    borderWidth: 1.5,
    borderColor: '#059669',
  },
  monthDayCellText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  monthDayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  monthDayCellTextToday: {
    color: '#059669',
    fontWeight: '800',
  },
  monthDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#059669',
  },
});
