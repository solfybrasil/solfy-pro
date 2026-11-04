import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowRight, UserPlus, LogIn } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { GradientButton } from '../../components/GradientButton';
import { useAuth } from '../../contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ONBOARDING_STORAGE_KEY = '@solfy_pro:onboarding_completed';

interface SlideItem {
  id: number;
  illustration: any;
  title: string;
  subtitle: string;
  accentCircleColor: string;
  accentBorderColor: string;
}

const SLIDES: SlideItem[] = [
  {
    id: 1,
    illustration: require('../../assets/illustrations/home-office.svg'),
    title: 'Demandas qualificadas',
    subtitle: 'Receba chamados prediais e oportunidades de manutenção direto no seu raio geográfico de atendimento.',
    accentCircleColor: '#EDF4EE',
    accentBorderColor: '#C8E2CC',
  },
  {
    id: 2,
    illustration: require('../../assets/illustrations/charts.svg'),
    title: 'Visitas ou cotação direta',
    subtitle: 'Decida se agenda vistoria técnica com o síndico ou envia sua proposta detalhada direto pelo aplicativo.',
    accentCircleColor: '#E2EFE4',
    accentBorderColor: '#B5D8BA',
  },
  {
    id: 3,
    illustration: require('../../assets/illustrations/partnership.svg'),
    title: 'Comissão pós-paga justa',
    subtitle: 'Sem cobrança antecipada. A comissão de sucesso só é devida após a formalização e conclusão do serviço.',
    accentCircleColor: '#EDF4EE',
    accentBorderColor: '#C8E2CC',
  },
  {
    id: 4,
    illustration: require('../../assets/illustrations/order-completed.svg'),
    title: 'Reputação e grande porte',
    subtitle: 'Construa seu histórico com avaliações verificadas de condomínios e desbloqueie contratos corporativos maiores.',
    accentCircleColor: '#E2EFE4',
    accentBorderColor: '#2E5A36',
  },
];

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setOnboardingCompleted } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const touchStartX = useRef(0);

  const isLastStep = currentStep === SLIDES.length - 1;
  const activeSlide = SLIDES[currentStep];

  // Salvar no storage que o onboarding foi concluído
  const markCompleted = useCallback(async () => {
    try {
      await setOnboardingCompleted();
    } catch (e) {
      console.warn('Erro ao salvar status do onboarding:', e);
    }
  }, [setOnboardingCompleted]);

  const goToStep = useCallback((step: number) => {
    const nextStep = Math.max(0, Math.min(step, SLIDES.length - 1));
    setCurrentStep(nextStep);
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  const handleNext = () => {
    if (currentStep < SLIDES.length - 1) {
      goToStep(currentStep + 1);
    } else {
      handleNavigateRegister();
    }
  };

  const handleSkip = () => {
    goToStep(SLIDES.length - 1);
  };

  const handleNavigateRegister = async () => {
    await markCompleted();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    router.push('/(auth)/cadastro');
  };

  const handleNavigateLogin = async () => {
    await markCompleted();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    router.push('/(auth)/login');
  };

  // Suporte a swipe por toque
  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
  };

  const handleTouchEnd = (e: any) => {
    const touchEndX = e.nativeEvent.pageX;
    const diff = touchStartX.current - touchEndX;
    if (diff > 45) {
      if (currentStep < SLIDES.length - 1) {
        goToStep(currentStep + 1);
      }
    } else if (diff < -45) {
      if (currentStep > 0) {
        goToStep(currentStep - 1);
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View
        style={[
          styles.contentWrapper,
          {
            paddingTop: Math.max(insets.top, 16) + 8,
            paddingBottom: Math.max(insets.bottom, 20) + 12,
          },
        ]}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── 1. HEADER TOPO (LOGO SOLFY NO VERDE MILITAR + TEXTO PULAR FORA DE CARD) ── */}
        <View style={styles.headerRow}>
          <View style={styles.logoGroup}>
            <Image
              source={require('../../assets/images/logo-full.png')}
              style={styles.logoImg}
              contentFit="contain"
              tintColor="#1E3E25"
              priority="high"
            />
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>PRO</Text>
            </View>
          </View>

          {!isLastStep ? (
            <TouchableOpacity
              onPress={handleSkip}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
              style={styles.skipBtn}
            >
              <Text style={styles.skipBtnText}>Pular</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {/* ── 2. ÁREA CENTRAL DA ILUSTRAÇÃO (COM HALO EM VERDE MILITAR SUAVE) ── */}
        <View style={styles.illustrationArea}>
          <Animated.View
            key={`illu-step-${currentStep}`}
            entering={FadeIn.duration(300)}
            style={styles.illustrationContainer}
          >
            {/* Círculo Geométrico Colorido em Verde Militar Solfy */}
            <View
              style={[
                styles.geometricBackdrop,
                {
                  backgroundColor: activeSlide.accentCircleColor,
                  borderColor: activeSlide.accentBorderColor,
                },
              ]}
            />

            {/* Ilustração SVG Vetorial */}
            <Image
              source={activeSlide.illustration}
              style={styles.illustrationImage}
              contentFit="contain"
              priority="high"
            />
          </Animated.View>
        </View>

        {/* ── 3. LINHA DIVISÓRIA EM VERDE MILITAR ── */}
        <View style={styles.dividerBar} />

        {/* ── 4. BLOCO DE TEXTOS (TÍTULO EDITORIAL + SUBTÍTULO) ── */}
        <Animated.View
          key={`caption-step-${currentStep}`}
          entering={FadeInDown.duration(280)}
          style={styles.textContainer}
        >
          <Text style={styles.slideTitle}>{activeSlide.title}</Text>
          <Text style={styles.slideSubtitle}>{activeSlide.subtitle}</Text>
        </Animated.View>

        {/* ── 5. RODAPÉ DE CONTROLE (DOTS + BOTÃO CIRCULAR VERDE MILITAR) ── */}
        <View style={styles.footerContainer}>
          {/* Indicador de Paginação */}
          <View style={styles.dotsRow}>
            {SLIDES.map((s, idx) => {
              const isActive = idx === currentStep;
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => goToStep(idx)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <View
                    style={[
                      styles.dot,
                      isActive ? styles.dotActive : styles.dotInactive,
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Botões de Ação na Base */}
          {isLastStep ? (
            <Animated.View entering={FadeInDown.duration(260)} style={styles.lastStepActionsWrap}>
              {/* Botão Primário Largo em Gradiente Verde Militar */}
              <GradientButton
                variant="primary"
                size="md"
                onPress={handleNavigateRegister}
                title="Começar Agora"
                icon={<UserPlus size={18} color="#FFFFFF" strokeWidth={2.4} />}
                rightIcon={<ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />}
                style={styles.actionBtnFull}
              />

              {/* Botão Secundário de Login com Gradiente Suave Verde Militar */}
              <GradientButton
                variant="secondary"
                size="md"
                onPress={handleNavigateLogin}
                title="Já tenho uma conta"
                icon={<LogIn size={16} color="#1E3E25" strokeWidth={2.2} />}
                style={styles.actionBtnFull}
              />
            </Animated.View>
          ) : (
            <View style={styles.nextStepWrap}>
              {/* Botão Circular com Seta em Gradiente Verde Militar com Hover e Click */}
              <GradientButton
                variant="circular"
                onPress={handleNext}
                accessibilityLabel="Avançar slide"
                icon={<ArrowRight size={24} color="#FFFFFF" strokeWidth={2.5} />}
              />

              {/* Link Direto de Login (Apenas Texto Limpo, fora de cards) */}
              <TouchableOpacity
                onPress={handleNavigateLogin}
                hitSlop={{ top: 12, bottom: 12, left: 14, right: 14 }}
                activeOpacity={0.7}
                style={styles.quickLoginLink}
              >
                <Text style={styles.quickLoginText}>
                  Já possui conta? <Text style={styles.quickLoginHighlight}>Entrar</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 480,
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },

  // 1. Header com Logo em Verde Militar
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  logoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoImg: {
    width: 74,
    height: 28,
  },
  logoBadge: {
    backgroundColor: '#EDF4EE',
    borderWidth: 1,
    borderColor: '#C8E2CC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  logoBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#1E3E25',
    letterSpacing: 1.0,
  },
  skipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },

  // 2. Área Central da Ilustração
  illustrationArea: {
    flex: 1,
    maxHeight: 320,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  illustrationContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  geometricBackdrop: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 2,
    zIndex: 1,
  },
  illustrationImage: {
    width: SCREEN_WIDTH > 400 ? 270 : 230,
    height: SCREEN_WIDTH > 400 ? 250 : 210,
    zIndex: 2,
  },

  // 3. Linha Divisória em Verde Militar
  dividerBar: {
    width: 36,
    height: 2.5,
    backgroundColor: '#1E3E25',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 8,
  },

  // 4. Bloco de Textos
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 12,
    marginVertical: 8,
  },
  slideTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#132817',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  slideSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 290,
  },

  // 5. Rodapé
  footerContainer: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 22,
    backgroundColor: '#1E3E25',
  },
  dotInactive: {
    width: 6,
    backgroundColor: '#D4E5D6',
  },

  // Ações nos Slides 1, 2, 3
  nextStepWrap: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  circularNextBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E3E25',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 14px rgba(30, 62, 37, 0.32)' }
      : {
          shadowColor: '#1E3E25',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.28,
          shadowRadius: 8,
          elevation: 4,
        }),
  },
  quickLoginLink: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  quickLoginText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  quickLoginHighlight: {
    color: '#1E3E25',
    fontWeight: '800',
  },

  // Ações no Último Slide
  lastStepActionsWrap: {
    width: '100%',
    gap: 12,
  },
  actionBtnFull: {
    width: '100%',
    height: 52,
    borderRadius: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1E3E25',
    height: 50,
    borderRadius: 14,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 14px rgba(30, 62, 37, 0.28)' }
      : {
          shadowColor: '#1E3E25',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 3,
        }),
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EDF4EE',
    borderWidth: 1,
    borderColor: '#C8E2CC',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E3E25',
  },
});
