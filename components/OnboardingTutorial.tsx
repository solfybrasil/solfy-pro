import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Animated, Modal, useWindowDimensions, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated2, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, CheckCircle2, Hand, ToggleRight, DollarSign, ClipboardList, Briefcase, Map, Coins, BarChart3, Trophy, Rocket, Lightbulb } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { C, FONT } from '../constants/theme';
import { normalize } from '../constants/layout';
import { tutorialMeasurements, subscribeToSpots } from './TutorialFocus';

const TUTORIAL_KEY = '@solfy:tutorial_done_v3';

type Spot = {
  top: number; left: number;
  width: number; height: number;
  radius: number;
} | null;

type Step = {
  id: string; route: string; spot: Spot;
  Icon: any; color: string; grad: [string, string];
  label: string; title: string; desc: string; tip?: string;
};

const getSteps = (SW: number, SH: number): Step[] => {
  const isWeb = Platform.OS === 'web';
  const topInset = isWeb ? 0 : 40; // rough safe area margin

  return [
    {
      id: 'welcome', route: '/(app)', spot: null,
      Icon: Hand, color: '#F59E0B', grad: ['#F59E0B', '#F59E0B'],
      label: 'Bem-vindo!',
      title: 'Bem-vindo ao\nSolfy PRO',
      desc: 'Vou te mostrar o app passo a passo. Você verá as telas reais enquanto explico cada função.',
      tip: 'Toque em "Próximo" para começar o tour ⚡',
    },
    {
      id: 'online', route: '/(app)',
      spot: { top: topInset + normalize(68), left: SW - normalize(85), width: normalize(70), height: normalize(48), radius: normalize(24) },
      Icon: ToggleRight, color: '#22C55E', grad: ['#22C55E', '#16A34A'],
      label: 'INÍCIO → canto superior direito',
      title: 'Online / Offline',
      desc: 'Este toggle controla sua disponibilidade. Verde = online e recebendo pedidos. Cinza = offline, sem pedidos.',
      tip: 'Fique online no horário comercial para não perder oportunidades!',
    },
    {
      id: 'earnings', route: '/(app)',
      spot: { top: topInset + normalize(130), left: normalize(12), width: SW - normalize(24), height: normalize(125), radius: normalize(20) },
      Icon: DollarSign, color: '#3B82F6', grad: ['#3B82F6', '#2563EB'],
      label: 'INÍCIO → Card de Ganhos',
      title: 'Ganho do Dia',
      desc: 'Veja quanto ganhou hoje vs. ontem. O ícone de olho oculta o valor para privacidade pública.',
    },
    {
      id: 'pedidos', route: '/(app)',
      spot: { top: topInset + normalize(330), left: normalize(12), width: SW - normalize(24), height: normalize(300), radius: normalize(16) },
      Icon: ClipboardList, color: '#F59E0B', grad: ['#F59E0B', '#D97706'],
      label: 'INÍCIO → Lista de Pedidos',
      title: 'Pedidos Disponíveis',
      desc: 'Pedidos enviados para você com base na sua cidade e especialidade. Veja valor, distância e concorrência.',
      tip: 'Use os filtros Urgente / Hoje / Semana para organizar a lista!',
    },
    {
      id: 'servicos', route: '/(app)/servicos',
      spot: { top: topInset + normalize(140), left: normalize(12), width: SW - normalize(24), height: normalize(280), radius: normalize(16) },
      Icon: Briefcase, color: '#8B5CF6', grad: ['#8B5CF6', '#7C3AED'],
      label: 'SERVIÇOS → Lista',
      title: 'Meus Serviços Ativos',
      desc: 'Aqui ficam os pedidos que você aceitou. Alterne entre "Ativos" e "Concluídos" com os botões no topo.',
    },
    {
      id: 'finalizar', route: '/(app)/servicos',
      spot: { top: topInset + normalize(280), left: Math.max(SW / 2, SW - normalize(160)), width: Math.min(SW / 2 - 16, normalize(144)), height: normalize(48), radius: normalize(24) },
      Icon: CheckCircle2, color: '#F59E0B', grad: ['#F59E0B', '#F59E0B'],
      label: 'SERVIÇOS → Botão FINALIZAR',
      title: 'Finalizar um Serviço',
      desc: 'Toque em FINALIZAR e peça ao cliente o código de 8 dígitos do painel dele. Depois informe o valor final negociado.',
      tip: 'Sem o código do cliente, o serviço não pode ser encerrado — isso te protege!',
    },
    {
      id: 'mapa', route: '/(app)/mapa',
      spot: { top: topInset + normalize(60), left: 0, width: SW, height: SH - normalize(180), radius: 0 },
      Icon: Map, color: '#10B981', grad: ['#10B981', '#059669'],
      label: 'Aba MAPA',
      title: 'Radar de Oportunidades',
      desc: 'Veja os pedidos no mapa em tempo real. Toque em um pin para ver detalhes e aceitar com rota integrada ao Waze.',
    },
    {
      id: 'solfcoin', route: '/(app)/financeiro',
      spot: { top: topInset + normalize(45), left: SW - normalize(125), width: normalize(110), height: normalize(44), radius: normalize(22) },
      Icon: Coins, color: '#F59E0B', grad: ['#F59E0B', '#F59E0B'],
      label: 'GANHOS → Botão SolfCoin',
      title: 'SolfCoins',
      desc: 'Cada pedido aceito custa 3 SolfCoins. Recarregue: Básico (5→R$5), Popular (50→R$49), Premium (100→R$99). PIX instantâneo.',
      tip: 'Mantenha sempre saldo reserva para não perder boas oportunidades!',
    },
    {
      id: 'metricas', route: '/(app)/financeiro',
      spot: { top: topInset + normalize(260), left: normalize(12), width: SW - normalize(24), height: normalize(280), radius: normalize(16) },
      Icon: BarChart3, color: '#3B82F6', grad: ['#3B82F6', '#2563EB'],
      label: 'GANHOS → Métricas',
      title: 'Painel Financeiro',
      desc: 'Gráfico dos últimos 7 dias, ticket médio, total de serviços e barra de meta semanal de R$ 1.500.',
    },
    {
      id: 'nivel', route: '/(app)/perfil',
      spot: { top: topInset + normalize(280), left: SW - normalize(125), width: normalize(115), height: normalize(95), radius: normalize(20) },
      Icon: Trophy, color: '#A855F7', grad: ['#A855F7', '#7C3AED'],
      label: 'PERFIL → Card de Nível',
      title: 'Sistema de Níveis',
      desc: 'Bronze → Prata → Ouro → Diamante → Elite Solfy. Cada serviço concluído sobe seu nível. Toque para ver os requisitos.',
    },
    {
      id: 'done', route: '/(app)', spot: null,
      Icon: Rocket, color: '#F59E0B', grad: ['#F59E0B', '#F59E0B'],
      label: 'Tudo pronto!',
      title: 'Pronto!\nBoas Vendas!',
      desc: 'Configure seu perfil, fique online e aguarde os pedidos. Dúvidas? Aba Perfil → Suporte e Ajuda.',
      tip: 'Você pode rever este tutorial em Perfil → Ver Tutorial do App',
    },
  ];
};

// ── Hook auxiliar ────────────────────────────────────────────
export function useOnboardingTutorial() {
  return { resetTutorial: () => AsyncStorage.removeItem(TUTORIAL_KEY) };
}

// ── Componente ───────────────────────────────────────────────
interface Props { forceShow?: boolean; onComplete?: () => void; }

export default function OnboardingTutorial({ forceShow = false, onComplete }: Props) {
  const { width: SW, height: SH } = useWindowDimensions();
  const TAB_H = Platform.OS === 'web' ? 60 : 84;

  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [, setLayoutUpdateTick] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  // Escuta atualizações de layout real
  useEffect(() => {
    const unsub = subscribeToSpots(() => {
      setLayoutUpdateTick(k => k + 1); // força re-render suave, sem re-animar o card
    });
    return () => {
      unsub();
    };
  }, []);

  // Pulse no spotlight
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [step]);

  // Barra de progresso
  useEffect(() => {
    if (!visible) return;
    Animated.timing(progressAnim, {
      toValue: (step + 1) / getSteps(SW, SH).length,
      duration: 200, useNativeDriver: false,
    }).start();
  }, [step, visible, SW, SH]);

  // Verificação de primeira vez
  useEffect(() => {
    (async () => {
      if (forceShow) { setVisible(true); return; }
      const done = await AsyncStorage.getItem(TUTORIAL_KEY);
      if (!done) setTimeout(() => setVisible(true), 1600);
    })();
  }, [forceShow]);

  const goTo = useCallback((idx: number) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setStep(idx);
    setAnimKey(k => k + 1);
    try { router.replace(getSteps(SW, SH)[idx].route as any); } catch (_) {}
  }, [router, SW, SH]);

  const handleNext = () => step < getSteps(SW, SH).length - 1 ? goTo(step + 1) : handleDone();
  const handlePrev = () => step > 0 && goTo(step - 1);

  const handleDone = async () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem(TUTORIAL_KEY, 'true');
    setVisible(false);
    onComplete?.();
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(TUTORIAL_KEY, 'true');
    setVisible(false);
    onComplete?.();
  };

  if (!visible) return null;

  const STEPS = getSteps(SW, SH);
  const cur = STEPS[step];
  
  // Tenta pegar a posição exata pelo DOM/Nativo, caso contrário usa o fallback
  const exactSpot = tutorialMeasurements[cur.id];
  const spot = exactSpot || cur.spot;

  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const spotMidY = spot ? spot.top + spot.height / 2 : 0;
  const spotInTop = spot ? spotMidY < SH * 0.55 : false;

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  // Margem lateral do card
  const cardMX = 12;
  const cardW = SW - cardMX * 2;

  // Posição vertical do card dinâmico inteligente
  const cardStyle: any = { left: cardMX, width: cardW };
  if (!spot) {
    cardStyle.top = SH * 0.22;
  } else if (spotInTop) {
    // Spotlight em cima, card em baixo
    const cardTop = spot.top + spot.height + 40;
    cardStyle.top = Math.min(cardTop, SH - 260); // garante que não vaza por baixo
  } else {
    // Spotlight em baixo, card em cima
    const cardBottom = SH - spot.top + 30;
    cardStyle.bottom = Math.min(cardBottom, SH - 240); // garante que não vaza por cima
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1 }}>

        {/* ── OVERLAY COM RECORTE ── */}
        {spot ? (
          <>
            {/* topo */}
            <View style={[s.dark, { top: 0, left: 0, right: 0, height: spot.top }]} />
            {/* fundo */}
            <View style={[s.dark, { top: spot.top + spot.height, left: 0, right: 0, bottom: 0 }]} />
            {/* esquerda */}
            <View style={[s.dark, { top: spot.top, left: 0, width: spot.left, height: spot.height }]} />
            {/* direita */}
            <View style={[s.dark, { top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height }]} />
            {/* borda pulsante */}
            <Animated.View style={[s.spotBorder, {
              top: spot.top - 3, left: spot.left - 3,
              width: spot.width + 6, height: spot.height + 6,
              borderRadius: spot.radius + 3,
              borderColor: cur.color,
              shadowColor: cur.color,
              transform: [{ scale: pulseAnim }],
            }]} />
            {/* seta direcional */}
            {spotInTop
              ? <View style={{ position: 'absolute', top: spot.top + spot.height + 6, left: spot.left + spot.width / 2 - 10 }}>
                  <View style={[s.arrowUp, { borderBottomColor: cur.color }]} />
                </View>
              : <View style={{ position: 'absolute', top: spot.top - 22, left: spot.left + spot.width / 2 - 10 }}>
                  <View style={[s.arrowDown, { borderTopColor: cur.color }]} />
                </View>
            }
          </>
        ) : (
          <View style={[s.dark, StyleSheet.absoluteFillObject]} />
        )}

        {/* ── CARD TUTORIAL ── */}
        <Animated2.View
          key={animKey}
          entering={(spot && !spotInTop ? FadeInUp : FadeInDown).duration(200).springify()}
          style={[s.card, cardStyle]}
        >
          {/* Barra de progresso */}
          <View style={s.progBg}>
            <Animated.View style={[s.progFill, { width: progressWidth, backgroundColor: cur.color }]} />
          </View>

          {/* Cabeçalho */}
          <View style={s.head}>
            <Animated2.View key={`e-${animKey}`} entering={ZoomIn.duration(300).delay(80)}
              style={[s.iconBubble, { backgroundColor: cur.color + '15' }]}>
              <cur.Icon size={22} color={cur.color} />
            </Animated2.View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.labelTxt, { color: cur.color }]} numberOfLines={1}>{cur.label.toUpperCase()}</Text>
              <Text style={s.counterTxt}>{step + 1} de {STEPS.length}</Text>
            </View>
            {!isLast && (
              <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={s.skipTxt}>Pular</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Conteúdo scrollável */}
          <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={{ maxHeight: 200 }}>
            <Animated2.View key={`b-${animKey}`} entering={FadeInUp.duration(280).delay(100)}>
              <Text style={s.title}>{cur.title}</Text>
              <Text style={s.desc}>{cur.desc}</Text>
              {cur.tip && (
                <View style={[s.tipBox, { backgroundColor: cur.color + '15', borderLeftColor: cur.color }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Lightbulb size={12} color={cur.color} />
                    <Text style={[s.tipLabel, { color: cur.color }]}>DICA</Text>
                  </View>
                  <Text style={[s.tipTxt, { color: cur.color }]}>{cur.tip}</Text>
                </View>
              )}
            </Animated2.View>
          </ScrollView>

          {/* Dots */}
          <View style={s.dots}>
            {STEPS.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => goTo(i)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <View style={[
                  s.dot,
                  i === step && { backgroundColor: cur.color, width: 18 },
                  i < step && { backgroundColor: cur.color + '66' },
                ]} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Botões */}
          <View style={s.footer}>
            {!isFirst && (
              <TouchableOpacity onPress={handlePrev} style={s.prevBtn}>
                <ChevronLeft size={18} color={C.textSecondary} />
                <Text style={s.prevTxt}>Voltar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleNext} style={[s.nextBtn, isFirst && { flex: 1 }]} activeOpacity={0.85}>
              <LinearGradient colors={cur.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.nextGrad}>
                {isLast
                  ? <><CheckCircle2 size={18} color="#000" /><Text style={s.nextTxt}>Começar!</Text></>
                  : <><Text style={s.nextTxt}>Próximo</Text><ChevronRight size={18} color="#000" /></>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated2.View>
      </View>
    </Modal>
  );
}


const s = StyleSheet.create({
  dark: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.82)' },
  spotBorder: {
    position: 'absolute', borderWidth: 2.5,
    shadowOpacity: 0.85, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  arrowUp: {
    width: 0, height: 0,
    borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 14,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  arrowDown: {
    width: 0, height: 0,
    borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 14,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  card: {
    position: 'absolute',
    backgroundColor: '#FFFFFF', // Light theme like home page
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0', // Soft gray border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 20,
  },
  progBg: { height: 4, backgroundColor: '#F1F5F9', borderRadius: 2, marginBottom: 16, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconBubble: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  labelTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  counterTxt: { fontSize: 12, color: C.textTertiary, fontWeight: '600', marginTop: 2 },
  skipTxt: { fontSize: 13, color: C.textTertiary, textDecorationLine: 'underline', flexShrink: 0 },
  title: { fontSize: 22, fontWeight: '900', color: C.textPrimary, lineHeight: 28, marginBottom: 8, letterSpacing: -0.5 },
  desc: { fontSize: 14, color: C.textSecondary, lineHeight: 22, fontWeight: '500', marginBottom: 12 },
  tipBox: { borderRadius: 12, padding: 12, borderLeftWidth: 3, marginBottom: 4 },
  tipLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  tipTxt: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginVertical: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E2E8F0' },
  footer: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  prevBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 16, backgroundColor: '#F8FAFC',
    borderWidth: 1, borderColor: '#E2E8F0'
  },
  prevTxt: { fontSize: 14, fontWeight: '700', color: C.textSecondary },
  nextBtn: { flex: 1, borderRadius: 16, overflow: 'hidden', shadowColor: '#F59E0B', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  nextGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  nextTxt: { fontSize: 16, fontWeight: '900', color: '#000' },
});
