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
  KeyboardAvoidingView,
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
  Trash2,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { tocarSomNotificacao } from '../../../lib/notificationSound';
import { SolfyLoader } from '../../../components/SolfyLoader';
import {
  listarCompromissosAgenda,
  confirmarVisitaPelaAgenda,
  cancelarVisitaPelaAgenda,
  criarLembreteAgenda,
  excluirLembreteAgenda,
  type AgendaCompromissoItem,
  type FaixaHorarioItem,
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

  // ── ESTADO DO NOVO LEMBRETE ──
  const [modalNovoLembreteVisivel, setModalNovoLembreteVisivel] = useState(false);
  const [lembreteData, setLembreteData] = useState<string>(hojeIso);
  const [lembreteTitulo, setLembreteTitulo] = useState('');
  const [lembreteDescricao, setLembreteDescricao] = useState('');
  const [faixasHorario, setFaixasHorario] = useState<FaixaHorarioItem[]>([
    { id: '1', de: '08:00', ate: '09:00' },
  ]);
  const [salvandoLembrete, setSalvandoLembrete] = useState(false);
  const [bannerLembreteCriado, setBannerLembreteCriado] = useState<{
    titulo: string;
    data: string;
    horario: string;
  } | null>(null);
  const bannerTimeoutRef = useRef<any>(null);

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
  const carregarCompromissosRef = useRef(carregarCompromissos);
  useEffect(() => {
    carregarCompromissosRef.current = carregarCompromissos;
  }, [carregarCompromissos]);

  useEffect(() => {
    if (!prestador?.id) return;
    let channel: any = null;
    try {
      const channelName = `agenda_realtime_prestador_${prestador.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'agenda_compromissos',
            filter: `prestador_id=eq.${prestador.id}`,
          },
          () => {
            carregarCompromissosRef.current(true);
          }
        );
      channel.subscribe((status: string, err?: Error) => {
        if (err) {
          console.warn('[AgendaRealtime] Status:', status, err);
        }
      });
    } catch (e) {
      console.warn('[AgendaRealtime] Erro ao conectar canal:', e);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (_) {}
      }
    };
  }, [prestador?.id]);

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

  // ── FUNÇÕES DE NOVO LEMBRETE ──
  const formatarHoraFaixa = (t: string) => {
    if (t.includes(':')) {
      const partes = t.split(':');
      const hh = partes[0].replace(/\D/g, '').slice(0, 2);
      const mm = (partes[1] || '').replace(/\D/g, '').slice(0, 2);
      return partes.length > 1 ? `${hh}:${mm}` : hh;
    }
    const digitos = t.replace(/\D/g, '').slice(0, 4);
    return digitos.length > 2 ? `${digitos.slice(0, 2)}:${digitos.slice(2)}` : digitos;
  };

  const abrirModalNovoLembrete = (dataPreDefinida?: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setLembreteData(dataPreDefinida || diaSelecionadoIso || hojeIso);
    setLembreteTitulo('');
    setLembreteDescricao('');
    setFaixasHorario([{ id: '1', de: '08:00', ate: '09:00' }]);
    setModalNovoLembreteVisivel(true);
  };

  const handleAdicionarFaixaHorario = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const ultima = faixasHorario[faixasHorario.length - 1];
    let proximoDe = '09:00';
    let proximoAte = '10:00';
    if (ultima && ultima.ate && ultima.ate.includes(':')) {
      proximoDe = ultima.ate;
      const [hh, mm] = ultima.ate.split(':').map(Number);
      if (!isNaN(hh)) {
        const proxH = (hh + 1) % 24;
        proximoAte = `${String(proxH).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')}`;
      }
    }
    setFaixasHorario((prev) => [
      ...prev,
      { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), de: proximoDe, ate: proximoAte },
    ]);
  };

  const handleRemoverFaixaHorario = (id: string) => {
    if (faixasHorario.length <= 1) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setFaixasHorario((prev) => prev.filter((f) => f.id !== id));
  };

  const handleAlterarFaixaHorario = (id: string, campo: 'de' | 'ate', valor: string) => {
    const valFormatado = formatarHoraFaixa(valor);
    setFaixasHorario((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [campo]: valFormatado } : f))
    );
  };

  const handleSalvarNovoLembrete = async () => {
    if (!lembreteTitulo.trim()) {
      showToast('Por favor, informe a tarefa ou título do lembrete.');
      return;
    }
    try {
      setSalvandoLembrete(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      const novos = await criarLembreteAgenda({
        prestadorId: prestador?.id || null,
        data: lembreteData,
        titulo: lembreteTitulo,
        descricao: lembreteDescricao,
        horarios: faixasHorario,
      });

      setCompromissos((prev) => {
        const ids = new Set(prev.map((c) => c.id));
        const unicos = novos.filter((n) => !ids.has(n.id));
        return [...prev, ...unicos];
      });
      setModalNovoLembreteVisivel(false);

      // 🔔 Efeito sonoro oficial Solfy + vibração tátil
      tocarSomNotificacao().catch(() => {});

      // 📱 Exibe o banner de lembrete criado na tela
      const horarioStr = faixasHorario.map((f) => `${f.de} – ${f.ate}`).join(
);
      setBannerLembreteCriado({
        titulo: lembreteTitulo,
        data: dataLembreteExtenso,
        horario: horarioStr,
      });

      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      bannerTimeoutRef.current = setTimeout(() => {
        setBannerLembreteCriado(null);
      }, 5000);

      showToast(novos.length > 1 ? `${novos.length} horários agendados!` : 'Lembrete adicionado com sucesso!');

      if (lembreteData !== diaSelecionadoIso) {
        centralizarDia(lembreteData, true);
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao criar lembrete');
    } finally {
      setSalvandoLembrete(false);
    }
  };

  const handleExcluirLembrete = async (item: AgendaCompromissoItem) => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
      await excluirLembreteAgenda(item.id);
      setCompromissos((prev) => prev.filter((c) => c.id !== item.id));
      setCompromissoSelecionado(null);
      showToast('Lembrete excluído com sucesso.');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao excluir lembrete');
    }
  };

  // Lista de dias para o seletor do modal
  const diasSelecaoModal = useMemo(() => {
    const lista: { iso: string; diaNum: number; diaSemana: string; mesNome: string }[] = [];
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    for (let i = 0; i < 28; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      lista.push({
        iso: formatIso(d),
        diaNum: d.getDate(),
        diaSemana: DIAS_SEMANA[d.getDay()],
        mesNome: NOMES_MESES[d.getMonth()],
      });
    }
    return lista;
  }, []);

  const dataLembreteExtenso = useMemo(() => {
    if (!lembreteData) return '';
    const d = fromIso(lembreteData);
    const diaSem = DIAS_LONGOS[d.getDay()];
    const diaNum = String(d.getDate()).padStart(2, '0');
    const mes = NOMES_MESES[d.getMonth()];
    return `${diaSem}, ${diaNum} de ${mes}`;
  }, [lembreteData]);

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
    if (tipo === 'outro') {
      return <Bell size={18} color="#059669" strokeWidth={2.2} />;
    }
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
              onPress={() => abrirModalNovoLembrete()}
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
                  : 'Quando você aceitar agendamentos ou criar lembretes neste dia, eles aparecerão aqui.'}
              </Text>
              {compromissosDoDia.length === 0 && (
                <TouchableOpacity
                  style={styles.emptyCriarBtn}
                  activeOpacity={0.8}
                  onPress={() => abrirModalNovoLembrete(diaSelecionadoIso)}
                >
                  <Plus size={15} color="#FFFFFF" strokeWidth={2.6} />
                  <Text style={styles.emptyCriarBtnText}>Criar Lembrete Neste Dia</Text>
                </TouchableOpacity>
              )}
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
                  {compromissoSelecionado?.tipo === 'outro' ? 'Lembrete Pessoal' : compromissoSelecionado?.tipo === 'visita_tecnica' ? 'Vistoria Técnica' : 'Execução de Obra'}
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
              {compromissoSelecionado?.tipo === 'outro' && (
                <TouchableOpacity
                  style={styles.btnDangerAction}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (compromissoSelecionado) {
                      handleExcluirLembrete(compromissoSelecionado);
                    }
                  }}
                >
                  <Trash2 size={16} color="#DC2626" strokeWidth={2.2} />
                  <Text style={styles.btnDangerActionText}>Excluir este Lembrete</Text>
                </TouchableOpacity>
              )}
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

      {/* ── MODAL NOVO LEMBRETE (BASEADO NO EXEMPLO DO VÍDEO COM CORES SOLFY) ── */}
      <Modal
        visible={modalNovoLembreteVisivel}
        transparent
        animationType="slide"
        onRequestClose={() => setModalNovoLembreteVisivel(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', justifyContent: 'flex-end', flex: 1 }}
          >
            <View style={styles.lembreteSheet}>
              <View style={styles.modalHandle} />

              {/* Header do Modal */}
              <View style={styles.lembreteHeader}>
                <View style={styles.lembreteHeaderTitleRow}>
                  <View style={styles.lembreteBadgeIcon}>
                    <Bell size={18} color="#059669" strokeWidth={2.4} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lembreteMainTitle}>Novo Lembrete</Text>
                    <Text style={styles.lembreteMainSubtitle}>Defina o dia, horário e anotações</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.modalClose}
                  activeOpacity={0.7}
                  onPress={() => setModalNovoLembreteVisivel(false)}
                >
                  <X size={16} color="#64748B" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ maxHeight: SCREEN_WIDTH * 1.25 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                {/* 1. SELEÇÃO DE DIA */}
                <View style={styles.lembreteSectionCard}>
                  <View style={styles.lembreteCardHeaderRow}>
                    <Text style={styles.lembreteSectionLabel}>DIA DO COMPROMISSO</Text>
                    <Text style={styles.lembreteCardHeaderHint}>Toque para trocar</Text>
                  </View>
                  <View style={styles.lembreteDataDestaqueRow}>
                    <CalendarIcon size={16} color="#059669" strokeWidth={2.2} />
                    <Text style={styles.lembreteDataDestaqueText}>{dataLembreteExtenso}</Text>
                  </View>

                  {/* Atalhos Rápidos */}
                  <View style={styles.lembreteAtalhosRow}>
                    <TouchableOpacity
                      style={[styles.lembreteAtalhoChip, lembreteData === hojeIso && styles.lembreteAtalhoChipAtivo]}
                      activeOpacity={0.8}
                      onPress={() => setLembreteData(hojeIso)}
                    >
                      <Text style={[styles.lembreteAtalhoChipText, lembreteData === hojeIso && styles.lembreteAtalhoChipTextAtivo]}>Hoje</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.lembreteAtalhoChip,
                        lembreteData === formatIso(new Date(Date.now() + 86400000)) && styles.lembreteAtalhoChipAtivo,
                      ]}
                      activeOpacity={0.8}
                      onPress={() => setLembreteData(formatIso(new Date(Date.now() + 86400000)))}
                    >
                      <Text
                        style={[
                          styles.lembreteAtalhoChipText,
                          lembreteData === formatIso(new Date(Date.now() + 86400000)) && styles.lembreteAtalhoChipTextAtivo,
                        ]}
                      >
                        Amanhã
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Carrossel de Dias para Seleção Fácil */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.lembreteDiasStrip}
                  >
                    {diasSelecaoModal.map((item) => {
                      const isSel = item.iso === lembreteData;
                      return (
                        <TouchableOpacity
                          key={item.iso}
                          style={[styles.lembreteDiaBtn, isSel && styles.lembreteDiaBtnAtivo]}
                          activeOpacity={0.75}
                          onPress={() => setLembreteData(item.iso)}
                        >
                          <Text style={[styles.lembreteDiaBtnSemana, isSel && styles.lembreteDiaBtnSemanaAtivo]}>
                            {item.diaSemana}
                          </Text>
                          <Text style={[styles.lembreteDiaBtnNum, isSel && styles.lembreteDiaBtnNumAtivo]}>
                            {item.diaNum}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* 2. SISTEMA DE HORÁRIOS (ESTILO DO VÍDEO EXATO) */}
                <View style={styles.lembreteSectionCard}>
                  <View style={styles.lembreteCardHeaderRow}>
                    <Text style={styles.lembreteSectionLabel}>HORÁRIOS</Text>
                    <Text style={styles.lembreteCardHeaderHint}>
                      {faixasHorario.length > 1 ? `${faixasHorario.length} faixas de horário` : '1 faixa de horário'}
                    </Text>
                  </View>

                  {faixasHorario.map((faixa, idx) => (
                    <View key={faixa.id} style={styles.faixaHorarioRow}>
                      <Text style={styles.faixaRotuloText}>De</Text>
                      <TextInput
                        style={styles.faixaInput}
                        value={faixa.de}
                        onChangeText={(t) => handleAlterarFaixaHorario(faixa.id, 'de', t)}
                        placeholder="08:00"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                      />
                      <Text style={styles.faixaRotuloText}>Até</Text>
                      <TextInput
                        style={styles.faixaInput}
                        value={faixa.ate}
                        onChangeText={(t) => handleAlterarFaixaHorario(faixa.id, 'ate', t)}
                        placeholder="09:00"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                      />

                      {faixasHorario.length > 1 ? (
                        <TouchableOpacity
                          style={styles.btnFaixaDelete}
                          activeOpacity={0.7}
                          onPress={() => handleRemoverFaixaHorario(faixa.id)}
                        >
                          <X size={15} color="#DC2626" strokeWidth={2.4} />
                        </TouchableOpacity>
                      ) : (
                        <View style={{ width: 34 }} />
                      )}
                    </View>
                  ))}

                  {/* Botão + Adicionar outro horário (igual ao + Add More do vídeo) */}
                  <TouchableOpacity
                    style={styles.btnAddMorePill}
                    activeOpacity={0.75}
                    onPress={handleAdicionarFaixaHorario}
                  >
                    <Plus size={16} color="#059669" strokeWidth={2.6} />
                    <Text style={styles.btnAddMorePillText}>+ Adicionar outro horário</Text>
                  </TouchableOpacity>
                </View>

                {/* 3. CAMPO PARA ESCREVER */}
                <View style={styles.lembreteSectionCard}>
                  <Text style={styles.lembreteSectionLabel}>O QUE VOCÊ PRECISA FAZER?</Text>
                  <TextInput
                    style={styles.lembreteInputTitulo}
                    value={lembreteTitulo}
                    onChangeText={setLembreteTitulo}
                    placeholder="Ex.: Comprar peças hidráulicas, ligar para o síndico..."
                    placeholderTextColor="#94A3B8"
                    maxLength={100}
                  />

                  <Text style={[styles.fieldSubLabel, { marginTop: 12 }]}>Anotações ou observações adicionais</Text>
                  <TextInput
                    style={styles.lembreteInputDescricao}
                    value={lembreteDescricao}
                    onChangeText={setLembreteDescricao}
                    placeholder="Detalhes, itens para comprar, apartamento/bloco..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    scrollEnabled={false}
                  />
                </View>

                {/* 4. BOTÃO SALVAR */}
                <TouchableOpacity
                  style={[styles.btnSalvarLembretePrincipal, salvandoLembrete && { opacity: 0.7 }]}
                  activeOpacity={0.85}
                  disabled={salvandoLembrete}
                  onPress={handleSalvarNovoLembrete}
                >
                  <Check size={18} color="#FFFFFF" strokeWidth={2.8} />
                  <Text style={styles.btnSalvarLembretePrincipalText}>
                    {salvandoLembrete ? 'Salvando...' : 'Salvar Lembrete na Agenda'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      {/* ── BANNER VISUAL DE LEMBRETE CRIADO NA TELA ── */}
      {bannerLembreteCriado && (
        <Animated.View
          entering={FadeInDown.duration(350).springify()}
          style={[styles.lembreteCriadoBanner, { top: insets.top + 8 }]}
        >
          <View style={styles.lembreteCriadoIconBox}>
            <Bell size={20} color="#059669" strokeWidth={2.4} />
          </View>
          <View style={styles.lembreteCriadoContent}>
            <View style={styles.lembreteCriadoHeaderRow}>
              <Text style={styles.lembreteCriadoTag}>LEMBRETE AGENDADO</Text>
              <Text style={styles.lembreteCriadoHorario}>{bannerLembreteCriado.horario}</Text>
            </View>
            <Text style={styles.lembreteCriadoTitulo} numberOfLines={1}>
              {bannerLembreteCriado.titulo}
            </Text>
            <Text style={styles.lembreteCriadoSub} numberOfLines={1}>
              {bannerLembreteCriado.data}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.lembreteCriadoCloseBtn}
            onPress={() => setBannerLembreteCriado(null)}
            activeOpacity={0.7}
          >
            <X size={15} color="#94A3B8" strokeWidth={2.4} />
          </TouchableOpacity>
        </Animated.View>
      )}
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
  emptyCriarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
  },
  emptyCriarBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDangerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  btnDangerActionText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  lembreteSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '92%',
  },
  lembreteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  lembreteHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  lembreteBadgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lembreteMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  lembreteMainSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  lembreteSectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  lembreteCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  lembreteSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lembreteCardHeaderHint: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  lembreteDataDestaqueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  lembreteDataDestaqueText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
  },
  lembreteAtalhosRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  lembreteAtalhoChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  lembreteAtalhoChipAtivo: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  lembreteAtalhoChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  lembreteAtalhoChipTextAtivo: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  lembreteDiasStrip: {
    gap: 8,
    paddingVertical: 4,
  },
  lembreteDiaBtn: {
    width: 52,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lembreteDiaBtnAtivo: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  lembreteDiaBtnSemana: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  lembreteDiaBtnSemanaAtivo: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  lembreteDiaBtnNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  lembreteDiaBtnNumAtivo: {
    color: '#FFFFFF',
  },
  faixaHorarioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  faixaRotuloText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  faixaInput: {
    width: 78,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  btnFaixaDelete: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAddMorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  btnAddMorePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  fieldSubLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  lembreteInputTitulo: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  lembreteInputDescricao: {
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#334155',
    textAlignVertical: 'top',
  },
  btnSalvarLembretePrincipal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#059669',
    marginTop: 6,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnSalvarLembretePrincipalText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  lembreteCriadoBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#10B981',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 24px rgba(5, 150, 105, 0.2)' }
      : {
          elevation: 8,
          shadowColor: '#059669',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 12,
        }),
  },
  lembreteCriadoIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lembreteCriadoContent: {
    flex: 1,
    minWidth: 0,
  },
  lembreteCriadoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  lembreteCriadoTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  lembreteCriadoHorario: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  lembreteCriadoTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  lembreteCriadoSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  lembreteCriadoCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
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
