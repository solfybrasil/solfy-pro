import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  SafeAreaView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Search,
  ChevronRight,
  Clock,
  Layers,
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
  Hourglass,
  XCircle,
  X,
  ArrowDownUp,
  Sparkles,
  AlertCircle,
  Sun,
  CalendarCheck2,
  DollarSign,
  RotateCw,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SolfyLoader } from '../../../components/SolfyLoader';
import { useAuth } from '../../../contexts/AuthContext';
import {
  buscarOportunidadesPrestador,
  OportunidadePrestador,
  EstadoPedidoPrestador,
} from '../../../lib/prestadorPedidosApi';

// ─── DESIGN TOKENS APPLE / SOLFY (IDÊNTICO AO CONDO) ─────────────────────────
const THEME = {
  bg: '#F3F5F2',               // --dm-bg
  surface: '#FFFFFF',          // --dm-surface
  ink: '#0D1B12',              // --dm-ink
  sub: '#5C6B61',              // --dm-sub
  mute: '#8A978E',             // --dm-mute
  line: 'rgba(13, 27, 18, 0.08)', // --dm-line
  deep: '#132817',             // --dm-deep
  mid: '#2E5A36',              // --dm-mid
  accent: '#059669',           // --dm-accent
  accentSoft: '#E3F5EC',       // --dm-accent-soft
  amber: '#B45309',            // --dm-amber
  amberSoft: '#FEF3C7',        // --dm-amber-soft
  indigo: '#4338CA',           // --dm-indigo
  indigoSoft: '#E8EAFE',       // --dm-indigo-soft
  rose: '#BE123C',             // --dm-rose
  roseSoft: '#FFE4E6',         // --dm-rose-soft
  slate: '#475569',            // --dm-slate
  slateSoft: '#E8ECEF',        // --dm-slate-soft
};

// ─── ÍCONE E CORES POR CATEGORIA DE SERVIÇO ──────────────────────────────────
interface CategoryVisual {
  Icon: any;
  bg: string;
  color: string;
}

const getCategoryVisual = (categoria?: string): CategoryVisual => {
  const cat = (categoria || '').toLowerCase();
  if (cat.includes('solar') || cat.includes('fotovolt') || cat.includes('inversor')) {
    return { Icon: Sun, bg: '#FFEBD5', color: '#C2410C' };
  }
  if (cat.includes('eletric') || cat.includes('luz') || cat.includes('energia')) {
    return { Icon: Zap, bg: '#FEF3C7', color: '#B45309' };
  }
  if (cat.includes('hidraul') || cat.includes('vaza') || cat.includes('encan') || cat.includes('água') || cat.includes('agua')) {
    return { Icon: Droplets, bg: '#DFF1FB', color: '#0369A1' };
  }
  if (cat.includes('pint')) {
    return { Icon: Paintbrush, bg: '#FFE4EC', color: '#BE185D' };
  }
  if (cat.includes('segur') || cat.includes('portaria') || cat.includes('camera') || cat.includes('portao')) {
    return { Icon: ShieldCheck, bg: '#E7ECF1', color: '#334155' };
  }
  if (cat.includes('estrut') || cat.includes('obra') || cat.includes('reforma') || cat.includes('civil')) {
    return { Icon: Hammer, bg: '#E8EAFE', color: '#4338CA' };
  }
  if (cat.includes('limp')) {
    return { Icon: Sparkles, bg: '#DDF5F1', color: '#0F766E' };
  }
  return { Icon: Wrench, bg: '#E3F5EC', color: '#166534' };
};

// ─── CHIP DE STATUS (ESTILO APPLE HIG PARA O PRESTADOR) ──────────────────────
const getEstadoChipConfig = (estado: EstadoPedidoPrestador) => {
  switch (estado) {
    case 'recebido':
      return { bg: THEME.amberSoft, text: THEME.amber, label: 'Novo Recebido' };
    case 'visita_agendada':
      return { bg: THEME.indigoSoft, text: THEME.indigo, label: 'Visita Agendada' };
    case 'aguardando_cotacao':
      return { bg: THEME.accentSoft, text: THEME.mid, label: 'Aguardando Cotação' };
    case 'cotacao_enviada':
      return { bg: THEME.accentSoft, text: '#047857', label: 'Cotação Enviada' };
    case 'aprovada':
      return { bg: '#D1FAE5', text: '#065F46', label: 'Proposta Aprovada 🎉' };
    case 'concluida':
      return { bg: '#E6F2EC', text: '#0A7A4F', label: 'Concluído ✓' };
    case 'recusado':
      return { bg: THEME.roseSoft, text: THEME.rose, label: 'Recusado' };
    case 'cancelada':
      return { bg: THEME.slateSoft, text: THEME.slate, label: 'Cancelada' };
    default:
      return { bg: THEME.slateSoft, text: THEME.slate, label: String(estado) };
  }
};

// ─── INDICADOR DE URGÊNCIA ───────────────────────────────────────────────────
const getUrgenciaDot = (urgencia?: string) => {
  switch (urgencia) {
    case 'urgente':
      return { color: '#DC2626', label: 'Urgente' };
    case 'alta':
      return { color: '#D97706', label: 'Alta' };
    case 'baixa':
      return { color: '#94A3B8', label: 'Baixa' };
    case 'normal':
    default:
      return { color: '#8A978E', label: 'Normal' };
  }
};

// ─── DEFINIÇÃO DOS CHIPS DE FILTRO COM CONTAGEM ──────────────────────────────
// Função auxiliar: identifica se o pedido já foi concluído (comissão faturada/gerada)
export const isPedidoConcluido = (o: OportunidadePrestador) => {
  return (
    o.estado_fluxo === 'concluida' ||
    o.status_solicitacao === 'concluida' ||
    o.finalizacao_status === 'concluida'
  );
};

const FILTROS_DEF = [
  { id: 'todas', label: 'Todas' },
  { id: 'recebido', label: 'Novas', estados: ['recebido', 'convite_pendente'] },
  { id: 'visita_agendada', label: 'Visitas', estados: ['visita_agendada'] },
  { id: 'aguardando_cotacao', label: 'A Cotar', estados: ['aguardando_cotacao', 'aceito_escolher_caminho'] },
  { id: 'cotacao_enviada', label: 'Em Análise', estados: ['cotacao_enviada'] },
  { id: 'aprovada', label: 'Aprovadas', estados: ['aprovada'] },
  { id: 'concluida', label: 'Concluídos', estados: ['concluida'] },
] as const;

export default function DemandasPrestadorFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerPaddingTop = Math.max(insets.top, Platform.OS === 'android' ? 24 : 16) + 4;
  const { prestador } = useAuth();

  const [oportunidades, setOportunidades] = useState<OportunidadePrestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState<string>('todas');

  const carregar = useCallback(async () => {
    if (!prestador?.id) {
      setOportunidades([]);
      setLoading(false);
      return;
    }

    try {
      const data = await buscarOportunidadesPrestador(prestador.id);
      setOportunidades(data || []);
    } catch (err) {
      console.error('[Demandas] Erro ao carregar feed:', err);
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

  // Contagens por filtro para os badges nos chips
  const contagens = useMemo(() => {
    const counts: Record<string, number> = {
      // Concluídos NUNCA aparecem em todas ("nao aparecem nem em todos")
      todas: oportunidades.filter((o) => !isPedidoConcluido(o)).length,
      recebido: oportunidades.filter(
        (o) => !isPedidoConcluido(o) && (o.estado_fluxo === 'recebido' || o.estado_fluxo === 'convite_pendente')
      ).length,
      visita_agendada: oportunidades.filter(
        (o) => !isPedidoConcluido(o) && o.estado_fluxo === 'visita_agendada'
      ).length,
      aguardando_cotacao: oportunidades.filter(
        (o) => !isPedidoConcluido(o) && (o.estado_fluxo === 'aguardando_cotacao' || o.estado_fluxo === 'aceito_escolher_caminho')
      ).length,
      cotacao_enviada: oportunidades.filter(
        (o) => !isPedidoConcluido(o) && o.estado_fluxo === 'cotacao_enviada'
      ).length,
      aprovada: oportunidades.filter(
        (o) => !isPedidoConcluido(o) && o.estado_fluxo === 'aprovada'
      ).length,
      concluida: oportunidades.filter((o) => isPedidoConcluido(o)).length,
    };
    return counts;
  }, [oportunidades]);

  // Demandas pendentes de ação do prestador para o card "Precisa de você"
  const demandasAcaoPrestador = useMemo(() => {
    return oportunidades.filter((o) => {
      if (isPedidoConcluido(o)) return false;
      return (
        o.estado_fluxo === 'recebido' ||
        o.estado_fluxo === 'aguardando_cotacao' ||
        (o.estado_fluxo === 'visita_agendada' && o.visita && !o.visita.ja_passou)
      );
    });
  }, [oportunidades]);

  // Filtragem combinada por chip de status e busca textual
  const oportunidadesFiltradas = useMemo(() => {
    let result = oportunidades;

    if (filtroAtivo === 'concluida') {
      // Os pedidos concluídos ficam apenas na aba concluídos
      result = result.filter((o) => isPedidoConcluido(o));
    } else if (filtroAtivo === 'todas') {
      // Concluídos NUNCA aparecem em "Todas" ("nao aparecem nem em todos")
      result = result.filter((o) => !isPedidoConcluido(o));
    } else {
      const chip = FILTROS_DEF.find((c) => c.id === filtroAtivo);
      if (chip && 'estados' in chip && chip.estados) {
        result = result.filter(
          (o) => (chip.estados as readonly string[]).includes(o.estado_fluxo) && !isPedidoConcluido(o)
        );
      }
    }

    if (busca.trim()) {
      const term = busca.toLowerCase();
      result = result.filter(
        (o) =>
          (o.titulo && o.titulo.toLowerCase().includes(term)) ||
          (o.descricao && o.descricao.toLowerCase().includes(term)) ||
          (o.categoria && o.categoria.toLowerCase().includes(term)) ||
          (o.condominio_nome && o.condominio_nome.toLowerCase().includes(term)) ||
          (o.localizacao_exibida && o.localizacao_exibida.toLowerCase().includes(term))
      );
    }

    return result;
  }, [oportunidades, filtroAtivo, busca]);

  return (
    <View style={styles.safeArea}>
      {/* ── CABEÇALHO GRANDE APPLE (LARGE TITLE) ───────────────────────────── */}
      <View style={[styles.largeHeader, { paddingTop: headerPaddingTop }]}>
        <View style={styles.largeHeaderTitles}>
          <Text style={styles.largeTitle}>Demandas</Text>
          <Text style={styles.largeSubtitle} numberOfLines={1}>
            {oportunidades.length === 1
              ? '1 oportunidade disponível para você'
              : `${oportunidades.length} oportunidades disponíveis para você`}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.appleFab}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Recarregar demandas"
            onPress={onRefresh}
          >
            <LinearGradient
              colors={[THEME.deep, THEME.mid]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.appleFabGradient}
            >
              <RotateCw size={18} color="#FFFFFF" strokeWidth={2.4} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── BARRA DE BUSCA APPLE HIG ────────────────────────────────────────── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={16} color={THEME.mute} strokeWidth={2.2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por serviço, condomínio ou categoria..."
            placeholderTextColor={THEME.mute}
            value={busca}
            onChangeText={setBusca}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {!!busca && (
            <TouchableOpacity
              onPress={() => setBusca('')}
              style={styles.clearSearchBtn}
              activeOpacity={0.7}
            >
              <X size={12} color="#FFFFFF" strokeWidth={3} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── CARTÃO 'PRECISA DE VOCÊ' (CASO HAJA OPORTUNIDADES AGUARDANDO RESPOSTA) ── */}
      {demandasAcaoPrestador.length > 0 && !busca && filtroAtivo === 'todas' && (
        <View style={styles.attnSection}>
          <LinearGradient
            colors={['#132817', '#1F3D24', '#2E5A36']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.attnCard}
          >
            <View style={styles.attnHeader}>
              <Text style={styles.attnTitle}>Precisa de você</Text>
              <Text style={styles.attnSubtitle}>
                {demandasAcaoPrestador.length === 1
                  ? '1 oportunidade aguardando sua resposta ou cotação'
                  : `${demandasAcaoPrestador.length} oportunidades aguardando sua resposta ou cotação`}
              </Text>
            </View>

            {demandasAcaoPrestador.slice(0, 2).map((item) => {
              const isNovo = item.estado_fluxo === 'recebido';
              const isAguardandoCotacao = item.estado_fluxo === 'aguardando_cotacao';
              const isVisita = item.estado_fluxo === 'visita_agendada';

              let subText = 'Responda para enviar sua proposta';
              if (isNovo) subText = 'Nova oportunidade recebida — aceite para cotar';
              else if (isAguardandoCotacao) subText = 'Envie sua proposta de valor e prazo';
              else if (isVisita && item.visita) subText = `Visita marcada para ${item.visita.data_visita}`;

              return (
                <TouchableOpacity
                  key={item.despacho_id || item.solicitacao_id}
                  style={styles.attnRow}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }
                    router.push(`/(app)/demandas/${item.solicitacao_id}` as any);
                  }}
                >
                  <View style={styles.attnIconBox}>
                    {isNovo ? (
                      <Sparkles size={16} color="#34D399" strokeWidth={2.2} />
                    ) : isVisita ? (
                      <CalendarCheck2 size={16} color="#A7F3D0" strokeWidth={2.2} />
                    ) : (
                      <DollarSign size={16} color="#34D399" strokeWidth={2.2} />
                    )}
                  </View>
                  <View style={styles.attnRowContent}>
                    <Text style={styles.attnRowTitle} numberOfLines={1}>
                      {item.titulo || item.descricao}
                    </Text>
                    <Text style={styles.attnRowSub} numberOfLines={1}>
                      {subText}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#A7F3D0" strokeWidth={2.4} style={{ opacity: 0.8 }} />
                </TouchableOpacity>
              );
            })}
          </LinearGradient>
        </View>
      )}

      {/* ── CHIPS DE FILTRO COM CONTADORES (ESTILO APPLE HIG) ────────────────── */}
      <View style={styles.chipsSection}>
        <FlatList
          horizontal
          data={FILTROS_DEF}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
          renderItem={({ item }) => {
            const isSelected = item.id === filtroAtivo;
            const count = contagens[item.id] ?? 0;

            return (
              <TouchableOpacity
                style={[styles.appleChip, isSelected && styles.appleChipActive]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={isSelected ? { selected: true } : {}}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.selectionAsync().catch(() => {});
                  }
                  setFiltroAtivo(item.id);
                }}
              >
                <Text style={[styles.appleChipText, isSelected && styles.appleChipTextActive]}>
                  {item.label}
                </Text>
                <View style={[styles.chipBadge, isSelected && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, isSelected && styles.chipBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* ── LINHA DE CONTAGEM E ORDENAÇÃO ────────────────────────────────────── */}
      <View style={styles.sortRow}>
        <Text style={styles.sortCountText}>
          {oportunidadesFiltradas.length === 1
            ? '1 oportunidade encontrada'
            : `${oportunidadesFiltradas.length} oportunidades encontradas`}
        </Text>
        <View style={styles.sortAction}>
          <Text style={styles.sortActionText}>Mais recentes</Text>
          <ArrowDownUp size={12} color={THEME.accent} strokeWidth={2.4} />
        </View>
      </View>

      {/* ── LISTAGEM DE CARDS APPLE DESIGN ──────────────────────────────────── */}
      {loading ? (
        <View style={styles.loadingBox}>
          <SolfyLoader size="md" />
        </View>
      ) : (
        <FlatList
          data={oportunidadesFiltradas}
          keyExtractor={(item) => item.despacho_id || item.solicitacao_id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 110 + Math.max(insets.bottom, 24) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={THEME.mid}
              colors={[THEME.mid]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                {filtroAtivo === 'concluida' ? (
                  <CheckCircle2 size={26} color="#0A7A4F" strokeWidth={2.2} />
                ) : (
                  <Layers size={26} color={THEME.accent} strokeWidth={2.2} />
                )}
              </View>
              <Text style={styles.emptyCardTitle}>
                {filtroAtivo === 'concluida'
                  ? 'Nenhum pedido concluído'
                  : 'Nenhuma oportunidade encontrada'}
              </Text>
              <Text style={styles.emptyCardText}>
                {busca
                  ? 'Nenhum resultado corresponde aos termos da pesquisa.'
                  : filtroAtivo === 'concluida'
                  ? 'Seus serviços finalizados com contrato aprovado e comissão gerada ficarão arquivados com segurança aqui.'
                  : 'Quando novos condomínios solicitarem serviços da sua especialidade, eles aparecerão aqui.'}
              </Text>
              {busca !== '' && (
                <TouchableOpacity
                  style={styles.emptyClearBtn}
                  onPress={() => setBusca('')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyClearBtnText}>Limpar busca</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item, index }) => {
            const visual = getCategoryVisual(item.categoria);
            const statusConfig = getEstadoChipConfig(item.estado_fluxo);
            const urgencia = getUrgenciaDot(item.urgencia);

            const dataFormatada = item.notificado_em
              ? new Date(item.notificado_em).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                })
              : '';

            return (
              <Animated.View entering={FadeInDown.delay(index * 30).duration(300)}>
                <TouchableOpacity
                  style={styles.demandCard}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Oportunidade ${item.titulo || item.categoria}`}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }
                    router.push(`/(app)/demandas/${item.solicitacao_id}` as any);
                  }}
                >
                  {/* Cabeçalho do Card: Ícone da Categoria + Título + Status Chip */}
                  <View style={styles.cardTopRow}>
                    <View style={[styles.categoryIconBox, { backgroundColor: visual.bg }]}>
                      <visual.Icon size={20} color={visual.color} strokeWidth={2.2} />
                    </View>

                    <View style={styles.cardHeaderCenter}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {item.titulo || item.descricao}
                      </Text>
                      <View style={styles.locRow}>
                        <Building2 size={11} color={THEME.sub} strokeWidth={2.2} />
                        <Text style={styles.locText} numberOfLines={1}>
                          {item.condominio_nome || 'Condomínio'}
                          {item.localizacao_exibida ? ` • ${item.localizacao_exibida}` : ''}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.statusChipPill, { backgroundColor: statusConfig.bg }]}>
                      <Text style={[styles.statusChipText, { color: statusConfig.text }]}>
                        {statusConfig.label}
                      </Text>
                    </View>
                  </View>

                  {/* Descrição resumida */}
                  {!!item.descricao && (
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {item.descricao}
                    </Text>
                  )}

                  {/* Caixa Extra com Resumo de Status / Proposta */}
                  <View style={styles.extraBox}>
                    <View style={styles.extraRow}>
                      <Text style={styles.extraLabel}>Status Operacional</Text>
                      {item.cotacao ? (
                        <View style={styles.cotacaoValorBadge}>
                          <Text style={styles.cotacaoValorLabel}>Sua proposta:</Text>
                          <Text style={styles.cotacaoValorVal}>
                            R$ {Number(item.cotacao.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </Text>
                        </View>
                      ) : item.visita ? (
                        <View style={styles.visitaAgendaBadge}>
                          <CalendarCheck2 size={12} color={THEME.indigo} />
                          <Text style={styles.visitaAgendaVal}>
                            {item.visita.data_visita} ({item.visita.horario_inicio.substring(0, 5)})
                          </Text>
                        </View>
                      ) : item.estado_fluxo === 'recebido' ? (
                        <Text style={[styles.extraValue, { color: THEME.amber }]}>
                          Novo • Aguarda Aceite
                        </Text>
                      ) : (
                        <Text style={styles.extraValue}>
                          Aguardando Envio de Proposta
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Rodapé: Ponto de Urgência Apple + Data + Chevron */}
                  <View style={styles.cardFootRow}>
                    <View style={styles.urgencyWrap}>
                      <View style={[styles.urgencyDot, { backgroundColor: urgencia.color }]} />
                      <Text style={[styles.urgencyText, { color: urgencia.color }]}>
                        {urgencia.label}
                      </Text>
                    </View>

                    <View style={styles.footRight}>
                      {!!dataFormatada && <Text style={styles.dateText}>{dataFormatada}</Text>}
                      <ChevronRight size={14} color={THEME.accent} strokeWidth={2.6} />
                    </View>
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

// ─── ESTILOS APPLE HIG FIÉIS AO CONDO ────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.bg,
  },

  // Apple Large Title Header
  largeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: THEME.bg,
  },
  largeHeaderTitles: {
    flex: 1,
    marginRight: 12,
  },
  largeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.ink,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  largeSubtitle: {
    fontSize: 12,
    color: THEME.sub,
    marginTop: 2,
    lineHeight: 16,
    fontWeight: '500',
  },
  appleFab: {
    width: 40,
    height: 40,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px -2px rgba(19, 40, 23, 0.45)',
      },
      default: {
        shadowColor: THEME.deep,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
      },
    }),
  },
  appleFabGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search Bar
  searchSection: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchBar: {
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(13, 27, 18, 0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.ink,
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(13, 27, 18, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 'Precisa de Você' Card
  attnSection: {
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  attnCard: {
    borderRadius: 26,
    padding: 18,
    paddingBottom: 10,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 18px 34px -18px rgba(19, 40, 23, 0.7)',
      },
      default: {
        shadowColor: THEME.deep,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 6,
      },
    }),
  },
  attnHeader: {
    marginBottom: 10,
  },
  attnTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  attnSubtitle: {
    fontSize: 12.5,
    color: '#A7F3D0',
    marginTop: 2,
    fontWeight: '500',
  },
  attnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  attnIconBox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attnRowContent: {
    flex: 1,
  },
  attnRowTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  attnRowSub: {
    fontSize: 11.5,
    color: '#B7E4CE',
    marginTop: 2,
  },

  // Chips Section
  chipsSection: {
    paddingBottom: 8,
  },
  chipsScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  appleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  appleChipActive: {
    backgroundColor: THEME.deep,
    borderColor: THEME.deep,
  },
  appleChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.sub,
  },
  appleChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  chipBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.slateSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  chipBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  chipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.slate,
  },
  chipBadgeTextActive: {
    color: '#FFFFFF',
  },

  // Sort & Counter Row
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  sortCountText: {
    fontSize: 12.5,
    color: THEME.mute,
    fontWeight: '600',
  },
  sortAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortActionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: THEME.accent,
  },

  // Demand Card List
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 110,
    gap: 12,
  },
  demandCard: {
    backgroundColor: THEME.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.line,
    gap: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(13,27,18,.04), 0 10px 28px -14px rgba(13,27,18,.16)',
      },
      default: {
        shadowColor: THEME.ink,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
      },
    }),
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderCenter: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.ink,
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  locText: {
    fontSize: 12,
    color: THEME.sub,
    fontWeight: '500',
  },
  statusChipPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: THEME.sub,
  },

  // Extra Box
  extraBox: {
    backgroundColor: THEME.bg,
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  extraLabel: {
    fontSize: 12,
    color: THEME.sub,
    fontWeight: '500',
  },
  extraValue: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.ink,
  },
  cotacaoValorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cotacaoValorLabel: {
    fontSize: 11,
    color: THEME.sub,
    fontWeight: '500',
  },
  cotacaoValorVal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: THEME.deep,
  },
  visitaAgendaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  visitaAgendaVal: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.indigo,
  },

  // Card Footer
  cardFootRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  urgencyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  urgencyDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  urgencyText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  footRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 11.5,
    color: THEME.mute,
    fontWeight: '600',
  },

  // Loading & Empty States
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: THEME.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(13, 27, 18, 0.16)',
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    textAlign: 'center',
    marginTop: 12,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: THEME.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.ink,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  emptyCardText: {
    fontSize: 13,
    color: THEME.sub,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyClearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: THEME.accentSoft,
  },
  emptyClearBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: THEME.accent,
  },
});
