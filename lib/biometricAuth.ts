import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BIOMETRICS_PREF_KEY = 'solfy_biometrics_enabled';

export const BiometricAuth = {
  /**
   * Verifica se o aparelho possui biometria (FaceID ou impressão digital) e se há digitais/face cadastradas.
   */
  async isAvailable(): Promise<{ available: boolean; type: string }> {
    if (Platform.OS === 'web') {
      return { available: false, type: 'none' };
    }

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        return { available: false, type: 'none' };
      }

      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const isFace = supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      const isFingerprint = supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

      const type = isFace ? 'Face ID' : isFingerprint ? 'Biometria' : 'Biometria';
      return { available: true, type };
    } catch {
      return { available: false, type: 'none' };
    }
  },

  /**
   * Verifica se o usuário optou por ativar o bloqueio biométrico ao abrir o app.
   */
  async isEnabled(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(BIOMETRICS_PREF_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Salva a preferência do usuário de ativar/desativar a biometria.
   */
  async setEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(BIOMETRICS_PREF_KEY, enabled ? 'true' : 'false');
    } catch {}
  },

  /**
   * Solicita a leitura biométrica (Face ID ou Touch ID / Digital).
   */
  async authenticate(promptMessage = 'Confirme sua identidade para acessar a Solfy'): Promise<boolean> {
    if (Platform.OS === 'web') return true;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Usar senha',
        disableDeviceFallback: false,
        cancelLabel: 'Cancelar',
      });
      return result.success;
    } catch {
      return false;
    }
  },
};
