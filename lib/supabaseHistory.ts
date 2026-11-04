import 'react-native-url-polyfill/auto';
import { supabase } from './supabase';

/**
 * CLIENTE SUPABASE UNIFICADO (BANCO 1)
 * Todas as operações agora rodam 100% no Banco 1 (wcpsumxlolkngiqiqzpy).
 * Exportamos supabaseHistory como alias de supabase para compatibilidade total.
 */
export const supabaseHistory = supabase;
export { supabase };
export default supabase;
