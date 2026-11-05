import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  ChevronRight,
  Layers,
  Sparkles,
  RefreshCw,
  QrCode,
  ArrowUpRight,
} from 'lucide-react-native';
import { PrestadorResumoHome } from '../lib/prestadorHomeApi';

interface HomeGlassMainCardProps {
  resumo: PrestadorResumoHome | null;
  loading: boolean;
  erro: string | null;
  onRetry: () => void;
  onPressOportunidades?: () => void;
  onPressPagar?: () => void;
}

const BRAND_GREEN = '#0D592A';

export const HomeGlassMainCard: React.FC<HomeGlassMainCardProps> = ({
  resumo,
  loading,
  erro,
  onRetry,
  onPressOportunidades,
  onPressPagar,
}) => {
  const router = useRouter();

  // 1. ESTADO DE CARREGANDO (SKELETON NO MESMO FORMATO DO CARD)
  if (loading && !resumo) {
    return (
      <View style={styles.glassCardWrapper}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.28)', 'rgba(255, 255, 255, 0.12)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.glassCard}
        >
          <View style={[styles.glassHighlight, { pointerEvents: 'none' }]} />
          {/* Skeleton Pílula */}
          <View style={styles.skeletonPilula} />
          {/* Skeleton Pedidos (3 Colunas) */}
          <View style={styles.skeletonColsRow}>
            <View style={styles.skeletonCol}>
              <View style={styles.skeletonNum} />
              <View style={styles.skeletonTextSmall} />
              <View style={styles.skeletonTextTiny} />
            </View>
            <View style={styles.skeletonCol}>
              <View style={styles.skeletonNum} />
              <View style={styles.skeletonTextSmall} />
              <View style={styles.skeletonTextTiny} />
            </View>
            <View style={styles.skeletonCol}>
              <View style={styles.skeletonNum} />
              <View style={styles.skeletonTextSmall} />
              <View style={styles.skeletonTextTiny} />
            </View>
          </View>
          {/* Skeleton Divisória e Financeiro */}
          <View style={styles.divider} />
          <View style={styles.skeletonFinRow}>
            <View style={styles.skeletonFinText} />
            <View style={styles.skeletonFinBtn} />
          </View>
        </LinearGradient>
      </View>
    );
  }

  // 2. ESTADO DE ERRO DISCRETO (SEM QUEBRAR A HOME)
  if (erro && !resumo) {
    return (
      <View style={styles.glassCardWrapper}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.28)', 'rgba(255, 255, 255, 0.12)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.glassCard}
        >
          <View style={[styles.glassHighlight, { pointerEvents: 'none' }]} />
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Não foi possível atualizar</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              activeOpacity={0.8}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                onRetry();
              }}
            >
              <RefreshCw size={13} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.retryBtnText}>Tentar de novo</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (!resumo) return null;

  const { status_pilula, pedidos, financeiro } = resumo;

  // Estilos da pílula conforme cor
  const getPilulaStyle = () => {
    switch (status_pilula.cor) {
      case 'vermelho':
        return {
          container: styles.pilulaVermelha,
          text: styles.pilulaVermelhaText,
          dotColor: '#FCA5A5',
        };
      case 'ambar':
        return {
          container: styles.pilulaAmbar,
          text: styles.pilulaAmbarText,
          dotColor: '#FDE047',
        };
      case 'cinza':
        return {
          container: styles.pilulaCinza,
          text: styles.pilulaCinzaText,
          dotColor: '#E5E7EB',
        };
      case 'verde':
      default:
        return {
          container: styles.pilulaVerde,
          text: styles.pilulaVerdeText,
          dotColor: '#4ADE80',
        };
    }
  };

  const pilulaEstilo = getPilulaStyle();

  const handlePressPilula = () => {
    if (status_pilula.rota) {
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      router.push(status_pilula.rota as any);
    }
  };

  const handlePressOportunidades = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    if (onPressOportunidades) {
      onPressOportunidades();
    }
  };

  const handlePressDemandas = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    router.push('/(app)/demandas' as any);
  };

  const handlePressAgenda = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    router.push('/(app)/agenda' as any);
  };

  return (
    <View style={styles.glassCardWrapper}>
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.28)', 'rgba(255, 255, 255, 0.12)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glassCard}
      >
        {/* Linha de reflexo de vidro superior */}
        <View style={[styles.glassHighlight, { pointerEvents: 'none' }]} />

        {/* ── 1. LINHA DE STATUS (PÍLULA NO TOPO POR PRIORIDADE) ── */}
        <View style={styles.topStatusRow}>
          <TouchableOpacity
            style={[styles.statusPilulaBase, pilulaEstilo.container]}
            activeOpacity={status_pilula.rota ? 0.75 : 1}
            onPress={handlePressPilula}
            disabled={!status_pilula.rota}
          >
            <View style={[styles.statusDot, { backgroundColor: pilulaEstilo.dotColor }]} />
            <Text style={[styles.statusPilulaText, pilulaEstilo.text]} numberOfLines={1}>
              {status_pilula.texto}
            </Text>
            {status_pilula.rota && (
              <ChevronRight size={13} color="rgba(255, 255, 255, 0.90)" strokeWidth={2.4} />
            )}
          </TouchableOpacity>
        </View>

        {/* ── 2. PEDIDOS (BLOCO PRINCIPAL COM NÚMEROS GRANDES) ── */}
        <View style={styles.pedidosContainer}>
          {/* Coluna 1: Oportunidades */}
          <TouchableOpacity
            style={styles.pedidoColuna}
            activeOpacity={0.7}
            onPress={handlePressOportunidades}
          >
            <Text style={styles.bigNumber}>{pedidos.oportunidades.total}</Text>
            <Text style={styles.colLabel}>Oportunidades</Text>
            <Text style={styles.colSubtext} numberOfLines={2}>
              {pedidos.oportunidades.texto_urgencia}
            </Text>
          </TouchableOpacity>

          <View style={styles.colSeparator} />

          {/* Coluna 2: Demandas */}
          <TouchableOpacity
            style={styles.pedidoColuna}
            activeOpacity={0.7}
            onPress={handlePressDemandas}
          >
            <Text style={styles.bigNumber}>{pedidos.demandas.em_andamento}</Text>
            <Text style={styles.colLabel}>Demandas</Text>
            <Text style={styles.colSubtext}>em andamento</Text>
          </TouchableOpacity>

          <View style={styles.colSeparator} />

          {/* Coluna 3: Próxima Visita */}
          <TouchableOpacity
            style={styles.pedidoColuna}
            activeOpacity={0.7}
            onPress={handlePressAgenda}
          >
            <View style={styles.visitaHeaderRow}>
              <Calendar size={18} color="#FFFFFF" strokeWidth={2.4} />
            </View>
            <Text style={styles.colLabel}>Próxima Visita</Text>
            <Text
              style={[
                styles.colSubtext,
                pedidos.proxima_visita.agendada ? styles.colSubtextVisitaAtiva : null,
              ]}
              numberOfLines={2}
            >
              {pedidos.proxima_visita.agendada
                ? pedidos.proxima_visita.resumo
                : 'Nenhuma'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── DIVISÓRIA FINA TRANSLÚCIDA ── */}
        <View style={styles.divider} />

        {/* ── 3. FINANCEIRO (LINHA COMPACTA EMBAIXO) ── */}
        {financeiro.situacao === 'vencida' ? (
          // Estado: Fatura Vencida (Linha destacada em vermelho + botão Pagar agora + texto de apoio)
          <View style={styles.finVencidaContainer}>
            <View style={styles.finVencidaLinhaPrincipal}>
              <View style={styles.finVencidaInfo}>
                <AlertTriangle size={15} color="#FCA5A5" strokeWidth={2.4} />
                <Text style={styles.finVencidaTexto} numberOfLines={1}>
                  {financeiro.texto_linha}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.btnPagarVencida}
                activeOpacity={0.8}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  if (onPressPagar) {
                    onPressPagar();
                  } else {
                    router.push('/(app)/financeiro' as any);
                  }
                }}
              >
                <QrCode size={13} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.btnPagarVencidaText}>Pagar agora</Text>
              </TouchableOpacity>
            </View>
            {financeiro.texto_apoio && (
              <Text style={styles.finVencidaTextoApoio}>{financeiro.texto_apoio}</Text>
            )}
          </View>
        ) : financeiro.situacao === 'aberta' ? (
          // Estado: Fatura Aberta a Vencer (Texto com valor e vencimento + botão Pagar)
          <View style={styles.finAbertaContainer}>
            <View style={styles.finAbertaInfo}>
              <Clock size={15} color="#FDE68A" strokeWidth={2.2} />
              <Text style={styles.finAbertaTexto} numberOfLines={1}>
                {financeiro.texto_linha}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.btnPagarAberta}
              activeOpacity={0.8}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                if (onPressPagar) {
                  onPressPagar();
                } else {
                  router.push('/(app)/financeiro' as any);
                }
              }}
            >
              <QrCode size={13} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.btnPagarAbertaText}>Pagar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Estado: Em dia (Comissões em dia + ícone check)
          <TouchableOpacity
            style={styles.finEmDiaContainer}
            activeOpacity={0.7}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              router.push('/(app)/financeiro' as any);
            }}
          >
            <View style={styles.finEmDiaInfo}>
              <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.finEmDiaTexto}>{financeiro.texto_linha}</Text>
            </View>
            <View style={styles.finExtratoLink}>
              <Text style={styles.finExtratoLinkText}>Ver extrato</Text>
              <ArrowUpRight size={13} color="rgba(255, 255, 255, 0.85)" strokeWidth={2.2} />
            </View>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  glassCardWrapper: {
    borderRadius: 24,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#132817',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
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
    padding: 18,
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
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    zIndex: 10,
  },

  // 1. Linha de Status (Topo)
  topStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  statusPilulaBase: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    maxWidth: '100%',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPilulaText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  pilulaVerde: {
    backgroundColor: 'rgba(13, 89, 42, 0.70)',
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  pilulaVerdeText: {
    color: '#FFFFFF',
  },
  pilulaAmbar: {
    backgroundColor: 'rgba(180, 83, 9, 0.70)',
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  pilulaAmbarText: {
    color: '#FFFFFF',
  },
  pilulaVermelha: {
    backgroundColor: 'rgba(185, 28, 28, 0.80)',
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  pilulaVermelhaText: {
    color: '#FFFFFF',
  },
  pilulaCinza: {
    backgroundColor: 'rgba(75, 85, 99, 0.70)',
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  pilulaCinzaText: {
    color: '#FFFFFF',
  },

  // 2. Pedidos (3 Colunas)
  pedidosContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  pedidoColuna: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  colSeparator: {
    width: 1,
    height: 52,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    marginHorizontal: 2,
    marginTop: 6,
  },
  bigNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  visitaHeaderRow: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
    textAlign: 'center',
  },
  colSubtext: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.72)',
    marginTop: 2,
    textAlign: 'center',
    lineHeight: 14,
    fontWeight: '500',
  },
  colSubtextVisitaAtiva: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Divisória fina
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    marginVertical: 14,
  },

  // 3. Financeiro
  finEmDiaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  finEmDiaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  finEmDiaTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  finExtratoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  finExtratoLinkText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
  },

  finAbertaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  finAbertaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    marginRight: 8,
  },
  finAbertaTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  btnPagarAberta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_GREEN,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 5,
  },
  btnPagarAbertaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  finVencidaContainer: {
    backgroundColor: 'rgba(220, 38, 38, 0.25)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.40)',
  },
  finVencidaLinhaPrincipal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  finVencidaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 6,
  },
  finVencidaTexto: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
  },
  btnPagarVencida: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 5,
  },
  btnPagarVencidaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  finVencidaTextoApoio: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 6,
    fontWeight: '500',
  },

  // Skeletons
  skeletonPilula: {
    width: 140,
    height: 22,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    marginBottom: 16,
  },
  skeletonColsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  skeletonCol: {
    alignItems: 'center',
    flex: 1,
  },
  skeletonNum: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.50)',
    marginBottom: 6,
  },
  skeletonTextSmall: {
    width: 70,
    height: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.40)',
    marginBottom: 4,
  },
  skeletonTextTiny: {
    width: 50,
    height: 10,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.30)',
  },
  skeletonFinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  skeletonFinText: {
    width: 130,
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.40)',
  },
  skeletonFinBtn: {
    width: 60,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },

  // Erro discreto
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  errorText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
  },
  retryBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
