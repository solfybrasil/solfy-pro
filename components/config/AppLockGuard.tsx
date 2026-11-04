import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  Platform,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Lock, ShieldCheck, LogOut } from 'lucide-react-native';
import { C, R, S, FONT } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { lerConfigTravaLocalAparelho } from '../../lib/condoConfigApi';

export function AppLockGuard({ children }: { children: React.ReactNode }) {
  const { session, signOut } = useAuth();
  const [bloqueado, setBloqueado] = useState(false);
  const [autenticando, setAutenticando] = useState(false);
  const [erroBiometria, setErroBiometria] = useState<string | null>(null);
  const backgroundAtRef = useRef<number | null>(null);

  const solicitarDesbloqueio = useCallback(async () => {
    if (Platform.OS === 'web') {
      setBloqueado(false);
      return;
    }
    setAutenticando(true);
    setErroBiometria(null);
    try {
      const temHardware = await LocalAuthentication.hasHardwareAsync();
      const temCadastro = await LocalAuthentication.isEnrolledAsync();
      if (!temHardware || !temCadastro) {
        setBloqueado(false);
        return;
      }

      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Desbloquear Solfy Condo',
        fallbackLabel: 'Usar PIN do aparelho',
        cancelLabel: 'Cancelar',
      });

      if (res.success) {
        setBloqueado(false);
      } else {
        setErroBiometria('Autenticação cancelada. Confirme sua biometria ou PIN para continuar.');
      }
    } catch {
      setErroBiometria('Não foi possível validar a biometria. Tente novamente.');
    } finally {
      setAutenticando(false);
    }
  }, []);

  useEffect(() => {
    if (!session || Platform.OS === 'web') {
      setBloqueado(false);
      return;
    }

    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (backgroundAtRef.current === null) {
          backgroundAtRef.current = Date.now();
        }
      } else if (nextState === 'active' && backgroundAtRef.current !== null) {
        const elapsedMs = Date.now() - backgroundAtRef.current;
        backgroundAtRef.current = null;

        try {
          const cfg = await lerConfigTravaLocalAparelho();
          if (!cfg.ativa) return;

          const limiteMs =
            cfg.tempoBloqueio === 'imediato'
              ? 0
              : cfg.tempoBloqueio === '1min'
              ? 60_000
              : 300_000;

          if (elapsedMs >= limiteMs) {
            setBloqueado(true);
            solicitarDesbloqueio();
          }
        } catch {
          // ignora erro de leitura local
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [session, solicitarDesbloqueio]);

  return (
    <View style={styles.root}>
      {children}
      {bloqueado && !!session && (
        <View style={styles.lockOverlay} accessibilityViewIsModal>
          <View style={styles.lockCard}>
            <View style={styles.iconCircle}>
              <Lock size={28} color={C.primary} />
            </View>
            <Text style={styles.titulo}>Solfy Condo Bloqueado</Text>
            <Text style={styles.subtitulo}>
              Para proteger os dados do condomínio, confirme sua biometria ou PIN do aparelho.
            </Text>

            {!!erroBiometria && (
              <Text style={styles.erroTexto}>{erroBiometria}</Text>
            )}

            <TouchableOpacity
              style={styles.botaoDesbloquear}
              onPress={solicitarDesbloqueio}
              disabled={autenticando}
              accessibilityRole="button"
              accessibilityLabel="Desbloquear com biometria ou PIN"
            >
              <ShieldCheck size={18} color={C.textInverse} />
              <Text style={styles.botaoDesbloquearTexto}>
                {autenticando ? 'Verificando...' : 'Desbloquear agora'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.botaoSair}
              onPress={async () => {
                setBloqueado(false);
                await signOut();
              }}
              accessibilityRole="button"
              accessibilityLabel="Sair da conta"
            >
              <LogOut size={15} color={C.textSecondary} />
              <Text style={styles.botaoSairTexto}>Entrar com outra conta</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#092215',
    alignItems: 'center',
    justifyContent: 'center',
    padding: S.xl,
    zIndex: 9999,
  },
  lockCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: C.bg1,
    borderRadius: R.xl,
    padding: S.xl,
    alignItems: 'center',
    gap: S.md,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.primaryBgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    fontFamily: FONT.bold,
    fontSize: 19,
    color: C.textPrimary,
    textAlign: 'center',
  },
  subtitulo: {
    fontFamily: FONT.regular,
    fontSize: 13.5,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  erroTexto: {
    fontFamily: FONT.medium,
    fontSize: 12.5,
    color: C.danger,
    textAlign: 'center',
  },
  botaoDesbloquear: {
    width: '100%',
    minHeight: 48,
    backgroundColor: C.primary,
    borderRadius: R.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.xs,
    marginTop: S.xs,
  },
  botaoDesbloquearTexto: {
    fontFamily: FONT.bold,
    fontSize: 14.5,
    color: C.textInverse,
  },
  botaoSair: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: S.md,
  },
  botaoSairTexto: {
    fontFamily: FONT.semibold,
    fontSize: 13,
    color: C.textSecondary,
  },
});
