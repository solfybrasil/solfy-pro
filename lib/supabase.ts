import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { LargeSecureStore } from './vaultStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Configuração crítica de ambiente ausente: EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY devem ser configurados no arquivo .env ou no painel do EAS.'
  );
}

// Em navegadores web, usa localStorage nativo.
// Em aparelhos nativos (iOS e Android), armazena no Cofre Seguro (LargeSecureStore: Keychain/Keystore + AES-256).
const authStorage = Platform.OS === 'web' ? undefined : LargeSecureStore;

// Custom lock implementation to prevent NavigatorLockAcquireTimeoutError and
// "Lock broken by another request with the 'steal' option" in browser and React Native environments.
const noOpLock = async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
  return await fn();
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    lock: noOpLock,
  },
});
