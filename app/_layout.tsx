import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { CondoProvider } from '../contexts/CondoContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { AlertProvider } from '../components/AlertProvider';
import { useEffect, Component, ReactNode } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { SolfyLoader } from '../components/SolfyLoader';

// Previne o auto-hide da splash screen nativa (Android/iOS) para não piscar a interface
SplashScreen.preventAutoHideAsync().catch(() => {});

// Em builds de produção, silencia logs de debug/sessão para prevenir vazamento em logs do sistema
if (!__DEV__) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

// ─── Enforce Arial como fonte única e oficial no Web ─────────────────────────
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'solfy-global-arial-font';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = `
      * {
        font-family: 'Arial Rounded MT Bold', 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, Arial, sans-serif !important;
      }
      body, button, input, textarea, select {
        font-family: 'Arial Rounded MT Bold', 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, Arial, sans-serif !important;
      }
    `;
    document.head.appendChild(s);
  }
}

// ─── Global Error Boundary (Apple HIG Style) ────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error?.message ?? 'Erro desconhecido' };
  }
  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary] Crash capturado:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={eb.container}>
          <View style={eb.card}>
            <Text style={eb.emoji}>🏢</Text>
            <Text style={eb.title}>Ops, algo inesperado ocorreu</Text>
            <Text style={eb.msg}>{this.state.error}</Text>
            <TouchableOpacity
              style={eb.btn}
              activeOpacity={0.8}
              onPress={() => this.setState({ hasError: false, error: '' })}
            >
              <Text style={eb.btnTxt}>Recarregar Aplicativo</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7F9',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 4,
        }),
  },
  emoji: { fontSize: 44, marginBottom: 16 },
  title: { color: '#092215', fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  msg: { color: '#6B7280', fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  btn: { backgroundColor: '#092215', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  btnTxt: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});

import { PostLoginLoader } from '../components/PostLoginLoader';
import { AppLockGuard } from '../components/config/AppLockGuard';
import { GlobalLembreteAlarmeModal } from '../components/GlobalLembreteAlarmeModal';

// ─── Navegação e Guarda de Rotas ───────────────────────────────────────────
function RootLayoutNav({ fontsLoaded }: { fontsLoaded: boolean }) {
  const {
    session,
    isLoading,
    perfil,
    isPostLogin,
    mfaRequired,
    finishPostLogin,
    hasOnboarded,
    statusAprovacao,
    isContaBloqueadaSindico,
  } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Inicializa o serviço nativo de Push Notifications
  usePushNotifications({ userId: session?.user?.id });

  // Oculta a splash screen nativa somente após fontes e checagem de auth estarem prontas
  useEffect(() => {
    if (!isLoading && fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading, fontsLoaded]);

  useEffect(() => {
    // Remove o foco de elementos ativos na troca de telas da Web para prevenir erros de aria-hidden
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        (document.activeElement as HTMLElement)?.blur?.();
      } catch {}
    }
  }, [segments]);

  useEffect(() => {
    // BLOQUEIO OBRIGATÓRIO: Não redireciona enquanto a tela pós-login de 8 segundos ou 2FA (AAL2) estiver pendente
    if (isLoading || isPostLogin || mfaRequired) return;

    const inAuthGroup = segments[0] === '(auth)';
    const currentScreen = (segments as string[])[1];

    if (!session && !inAuthGroup) {
      if (hasOnboarded) {
        router.replace('/(auth)/login');
      } else {
        router.replace('/(auth)/welcome');
      }
    } else if (session) {
      if (isContaBloqueadaSindico) {
        if (currentScreen !== 'login') {
          router.replace('/(auth)/login');
        }
        return;
      }

      const status = statusAprovacao || perfil?.status_aprovacao;
      const isIncompleto = status === 'incompleto' || status === 'rascunho';
      const isAprovado = status === 'aprovado';

      if (!isAprovado) {
        if (isIncompleto) {
          if (currentScreen !== 'cadastro') {
            router.replace('/(auth)/cadastro' as any);
          }
        } else {
          // Qualquer status não-aprovado (em_analise, enviado, pendente, pendencia, recusa, rejeitado, reprovado, suspenso)
          if (currentScreen !== 'status-analise' && currentScreen !== 'cadastro') {
            router.replace('/(auth)/status-analise' as any);
          }
        }
      } else if (inAuthGroup && currentScreen !== 'cadastro') {
        router.replace('/(app)');
      }
    }
  }, [session, isLoading, isPostLogin, mfaRequired, segments, statusAprovacao, perfil?.status_aprovacao, hasOnboarded, isContaBloqueadaSindico]);

  // Enquanto a checagem de sessão estiver ocorrendo, não renderiza as rotas internas nem a Stack
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#132817' }}>
        <SolfyLoader fullscreen size="lg" />
      </View>
    );
  }

  return (
    <AppLockGuard>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F6F7F9' } }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(auth)" />
      </Stack>
      <StatusBar style="dark" />
      {/* Tela de carregamento obrigatória pós-login de 8 segundos */}
      {isPostLogin && (
        <PostLoginLoader durationSeconds={8} onFinish={finishPostLogin} />
      )}
      {/* Alarme de Lembretes Global (visível em qualquer tela em 1º plano) */}
      <GlobalLembreteAlarmeModal />
    </AppLockGuard>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'TTFellows-Regular': require('../assets/fonts/TTFellows-Regular.ttf'),
    'TTFellows-Medium': require('../assets/fonts/TTFellows-Medium.ttf'),
    'TTFellows-DemiBold': require('../assets/fonts/TTFellows-DemiBold.ttf'),
    'TTFellows-Bold': require('../assets/fonts/TTFellows-Bold.ttf'),
    'TTFellows-ExtraBold': require('../assets/fonts/TTFellows-ExtraBold.ttf'),
    'TTFellows-Black': require('../assets/fonts/TTFellows-Black.ttf'),
  });

  const isFontsReady = fontsLoaded || !!fontError;

  if (!isFontsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AlertProvider>
          <AuthProvider>
            <CondoProvider>
              <NotificationProvider>
                <RootLayoutNav fontsLoaded={isFontsReady} />
              </NotificationProvider>
            </CondoProvider>
          </AuthProvider>
        </AlertProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
