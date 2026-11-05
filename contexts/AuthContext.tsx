import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Perfil, PrestadorPerfilPro } from '../types/condo';
import { removerDispositivoPushToken } from '../lib/condoConfigApi';
import {
  obterOuCriarPrestadorLogado,
  verificarInadimplenciaComissaoPrestador,
  verificarAceiteTermoCnpjGrande,
} from '../lib/condoPrestadorPainelApi';

const ONBOARDING_STORAGE_KEY = '@solfy_pro:onboarding_completed';

export interface InadimplenciaInfo {
  inadimplente: boolean;
  totalEmAtraso: number;
  opsAtrasadas: any[];
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  perfil: Perfil | null;
  prestador: PrestadorPerfilPro | null;
  isPrestador: boolean;
  isContaBloqueadaSindico: boolean;
  statusAprovacao: string | null;
  kycCaso: any | null;
  inadimplencia: InadimplenciaInfo;
  termoCnpjGrandeAceito: boolean;
  isLoading: boolean;
  isPostLogin: boolean;
  mfaRequired: boolean;
  mfaFactorId: string | null;
  hasOnboarded: boolean;
  setOnboardingCompleted: () => Promise<void>;
  clearMfaRequired: () => void;
  startPostLogin: () => void;
  finishPostLogin: () => void;
  signIn: (email: string, pass: string, captchaToken?: string) => Promise<{ mfaRequired: boolean; factorId: string | null; isPrestadorValido: boolean }>;
  signOut: () => Promise<void>;
  signOutAllDevices: () => Promise<void>;
  refreshPerfil: () => Promise<void>;
  recarregarInadimplencia: () => Promise<void>;
  recarregarTermoCnpj: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  perfil: null,
  prestador: null,
  isPrestador: false,
  isContaBloqueadaSindico: false,
  statusAprovacao: null,
  kycCaso: null,
  inadimplencia: { inadimplente: false, totalEmAtraso: 0, opsAtrasadas: [] },
  termoCnpjGrandeAceito: false,
  isLoading: true,
  isPostLogin: false,
  mfaRequired: false,
  mfaFactorId: null,
  hasOnboarded: false,
  setOnboardingCompleted: async () => {},
  clearMfaRequired: () => {},
  startPostLogin: () => {},
  finishPostLogin: () => {},
  signIn: async () => ({ mfaRequired: false, factorId: null, isPrestadorValido: false }),
  signOut: async () => {},
  signOutAllDevices: async () => {},
  refreshPerfil: async () => {},
  recarregarInadimplencia: async () => {},
  recarregarTermoCnpj: async () => {},
});

async function registrarDispositivoSessaoLocal(registrarLoginNovo = false): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    const disp =
      Platform.OS === 'web'
        ? 'Navegador Web'
        : `${Platform.OS.toUpperCase()} (${String(Platform.Version ?? '')})`.trim();
    const plat =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    await supabase.rpc('registrar_dispositivo_sessao_atual', {
      p_aparelho: disp,
      p_plataforma: plat,
      p_navegador_ou_so: `${Platform.OS} ${String(Platform.Version ?? '')}`.trim(),
    });
    if (registrarLoginNovo) {
      await supabase.rpc('registrar_atividade_conta_rpc', {
        p_tipo: 'login_realizado',
        p_meta: { plataforma: plat, dispositivo: disp },
        p_dispositivo_curto: disp,
      });
    }
  } catch {
    // Silencioso se offline
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [prestador, setPrestador] = useState<PrestadorPerfilPro | null>(null);
  const [isPrestador, setIsPrestador] = useState<boolean>(false);
  const [isContaBloqueadaSindico, setIsContaBloqueadaSindico] = useState<boolean>(false);
  const [statusAprovacao, setStatusAprovacao] = useState<string | null>(null);
  const [kycCaso, setKycCaso] = useState<any | null>(null);
  const [inadimplencia, setInadimplencia] = useState<InadimplenciaInfo>({
    inadimplente: false,
    totalEmAtraso: 0,
    opsAtrasadas: [],
  });
  const [termoCnpjGrandeAceito, setTermoCnpjGrandeAceito] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState(true);
  const [hasOnboarded, setHasOnboarded] = useState<boolean>(false);
  const [isPostLogin, setIsPostLogin] = useState<boolean>(false);
  const [mfaRequired, setMfaRequired] = useState<boolean>(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);

  const clearMfaRequired = useCallback(() => {
    setMfaRequired(false);
    setMfaFactorId(null);
  }, []);

  const startPostLogin = useCallback(() => {
    setIsPostLogin(true);
  }, []);

  const finishPostLogin = useCallback(() => {
    setIsPostLogin(false);
  }, []);

  const setOnboardingCompleted = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      setHasOnboarded(true);
    } catch (e) {
      console.warn('Erro ao salvar status do onboarding:', e);
    }
  }, []);

  const carregarPerfilEStatus = useCallback(async (userId: string) => {
    try {
      // 1. Busca perfil na tabela perfis (servidor, confiável)
      const { data: pData } = await supabase
        .from('perfis')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (pData) {
        setPerfil(pData as Perfil);
      }

      // 2. Busca prestador na tabela prestadores
      const { data: prestadorData } = await supabase
        .from('prestadores')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (prestadorData) {
        setPrestador(prestadorData as PrestadorPerfilPro);
      }

      // 3. Consulta portão KYC unificado (RPC kyc_meu_caso)
      let kycInfo: any = null;
      try {
        const { data: kycRes } = await supabase.rpc('kyc_meu_caso');
        if (kycRes && kycRes.autenticado) {
          kycInfo = kycRes;
          setKycCaso(kycRes);
        }
      } catch (errKyc) {
        console.warn('[AuthContext] Aviso ao consultar kyc_meu_caso:', errKyc);
      }

      // 4. Determinação não-adulterável de Papel (Prestador vs Síndico)
      const contaTipoPrestador = pData?.tipo_conta === 'prestador';
      const temRegistroPrestador = !!prestadorData;
      const kycTipoPrestador = kycInfo?.tipo === 'prestador';

      // Checa se a conta é exclusiva de síndico
      const isSindicoProf = pData?.tipo_conta === 'sindico_profissional' || pData?.tipo_conta === 'sindico';
      const { data: membroSindico } = await supabase
        .from('membros_condominio')
        .select('id')
        .eq('user_id', userId)
        .eq('ativo', true)
        .in('papel', ['sindico', 'subsindico', 'administradora_terceirizada'])
        .limit(1)
        .maybeSingle();

      const { data: criadoCondo } = await supabase
        .from('condominios')
        .select('id')
        .eq('criado_por', userId)
        .limit(1)
        .maybeSingle();

      const ehApenasSindico = (isSindicoProf || !!membroSindico || !!criadoCondo) && !temRegistroPrestador && !contaTipoPrestador;

      if (ehApenasSindico) {
        setIsPrestador(false);
        setIsContaBloqueadaSindico(true);
        setStatusAprovacao('conta_sindico');
        return;
      }

      setIsContaBloqueadaSindico(false);

      if (temRegistroPrestador || contaTipoPrestador || kycTipoPrestador) {
        setIsPrestador(true);

        // Status de aprovação: prioriza KYC, depois prestadores, depois perfis
        const statusReal =
          kycInfo?.status ||
          prestadorData?.status_cadastro ||
          pData?.status_aprovacao ||
          'aprovado';

        setStatusAprovacao(statusReal);

        // 5. Inadimplência de comissões (Bloqueio)
        if (prestadorData?.id) {
          const inad = await verificarInadimplenciaComissaoPrestador(prestadorData.id);
          setInadimplencia((prev) => {
            if (
              prev.inadimplente === inad.inadimplente &&
              prev.totalEmAtraso === inad.totalEmAtraso &&
              prev.opsAtrasadas.length === inad.opsAtrasadas.length
            ) {
              return prev;
            }
            return inad;
          });
        }

        // 6. Termo de CNPJ Grande
        const termoCheck = await verificarAceiteTermoCnpjGrande();
        setTermoCnpjGrandeAceito(termoCheck.aceito);
      } else {
        // Usuário novo autenticado sem perfil prestador ainda criado
        setIsPrestador(false);
        setStatusAprovacao('incompleto');
      }
    } catch (err) {
      console.warn('[AuthContext] Aviso ao verificar permissões de prestador:', err);
    }
  }, []);

  const recarregarInadimplencia = useCallback(async () => {
    if (prestador?.id) {
      const inad = await verificarInadimplenciaComissaoPrestador(prestador.id);
      setInadimplencia((prev) => {
        if (
          prev.inadimplente === inad.inadimplente &&
          prev.totalEmAtraso === inad.totalEmAtraso &&
          prev.opsAtrasadas.length === inad.opsAtrasadas.length
        ) {
          return prev;
        }
        return inad;
      });
    }
  }, [prestador?.id]);

  const recarregarTermoCnpj = useCallback(async () => {
    const termoCheck = await verificarAceiteTermoCnpjGrande();
    setTermoCnpjGrandeAceito(termoCheck.aceito);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const [sessionRes, onboardedVal] = await Promise.all([
          supabase.auth.getSession().catch(() => ({ data: { session: null } })),
          AsyncStorage.getItem(ONBOARDING_STORAGE_KEY).catch(() => null),
        ]);

        if (!isMounted) return;
        setHasOnboarded(onboardedVal === 'true');

        const initialSession = sessionRes?.data?.session;

        if (initialSession?.user?.id) {
          const { error: userError } = await supabase.auth.getUser();
          if (userError) {
            console.warn('[AuthContext] Sessão expirada:', userError.message);
            await supabase.auth.signOut().catch(() => {});
            if (isMounted) {
              setSession(null);
              setUser(null);
              setPerfil(null);
              setPrestador(null);
              setIsPrestador(false);
              setIsLoading(false);
            }
            return;
          }

          if (isMounted) {
            setSession(initialSession);
            setUser(initialSession.user);
          }
          registrarDispositivoSessaoLocal(false).catch(() => {});
          await carregarPerfilEStatus(initialSession.user.id);
        } else {
          if (isMounted) {
            setSession(null);
            setUser(null);
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Erro ao inicializar autenticação:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || !session) {
        setSession(null);
        setUser(null);
        setPerfil(null);
        setPrestador(null);
        setIsPrestador(false);
        setIsContaBloqueadaSindico(false);
        setMfaRequired(false);
        setMfaFactorId(null);
        setIsLoading(false);
      } else if (session?.user?.id) {
        setSession(session);
        setUser(session.user);
        carregarPerfilEStatus(session.user.id).finally(() => {
          if (isMounted) setIsLoading(false);
        });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [carregarPerfilEStatus]);

  const signIn = async (email: string, pass: string, captchaToken?: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: pass,
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (error) {
      throw error;
    }

    let precisaMfa = false;
    let factorId: string | null = null;
    try {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const verifiedTotp = factors?.totp?.find((f) => f.status === 'verified');
        if (verifiedTotp) {
          precisaMfa = true;
          factorId = verifiedTotp.id;
        }
      }
    } catch {}

    setMfaRequired(precisaMfa);
    setMfaFactorId(factorId);
    setSession(data.session);
    setUser(data.user);

    let isValido = true;
    if (data.user?.id) {
      registrarDispositivoSessaoLocal(true).catch(() => {});
      await carregarPerfilEStatus(data.user.id);
    }

    return { mfaRequired: precisaMfa, factorId, isPrestadorValido: isValido };
  };

  const signOut = async () => {
    try {
      await removerDispositivoPushToken().catch(() => {});
      await Promise.race([
        supabase.auth.signOut().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);

      // Garante remoção local das chaves caso offline ou erro de rede
      if (Platform.OS !== 'web') {
        const allKeys = await AsyncStorage.getAllKeys().catch(() => []);
        const authKeys = allKeys.filter((k) => k.includes('auth-token') || k.includes('supabase.auth'));
        if (authKeys.length > 0) {
          await AsyncStorage.multiRemove(authKeys).catch(() => {});
        }
      } else if (typeof window !== 'undefined') {
        try {
          Object.keys(localStorage).forEach((k) => {
            if (k.includes('auth-token') || k.includes('supabase.auth')) {
              localStorage.removeItem(k);
            }
          });
        } catch {}
      }
    } catch (e) {
      console.warn('Logout error:', e);
    } finally {
      setSession(null);
      setUser(null);
      setPerfil(null);
      setPrestador(null);
      setIsPrestador(false);
      setIsContaBloqueadaSindico(false);
      setMfaRequired(false);
      setMfaFactorId(null);
      setIsPostLogin(false);
      setIsLoading(false);
    }
  };

  const signOutAllDevices = async () => {
    try {
      await removerDispositivoPushToken().catch(() => {});
      await Promise.race([
        supabase.auth.signOut({ scope: 'global' }).catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);

      if (Platform.OS !== 'web') {
        const allKeys = await AsyncStorage.getAllKeys().catch(() => []);
        const authKeys = allKeys.filter((k) => k.includes('auth-token') || k.includes('supabase.auth'));
        if (authKeys.length > 0) {
          await AsyncStorage.multiRemove(authKeys).catch(() => {});
        }
      } else if (typeof window !== 'undefined') {
        try {
          Object.keys(localStorage).forEach((k) => {
            if (k.includes('auth-token') || k.includes('supabase.auth')) {
              localStorage.removeItem(k);
            }
          });
        } catch {}
      }
    } catch (e) {
      console.warn('Logout global error:', e);
    } finally {
      setSession(null);
      setUser(null);
      setPerfil(null);
      setPrestador(null);
      setIsPrestador(false);
      setIsContaBloqueadaSindico(false);
      setMfaRequired(false);
      setMfaFactorId(null);
      setIsPostLogin(false);
      setIsLoading(false);
    }
  };

  const refreshPerfil = async () => {
    if (user?.id) {
      await carregarPerfilEStatus(user.id);
    }
  };

  const contextValue = useMemo(
    () => ({
      user,
      session,
      perfil,
      prestador,
      isPrestador,
      isContaBloqueadaSindico,
      statusAprovacao,
      kycCaso,
      inadimplencia,
      termoCnpjGrandeAceito,
      isLoading,
      isPostLogin,
      mfaRequired,
      mfaFactorId,
      hasOnboarded,
      setOnboardingCompleted,
      clearMfaRequired,
      startPostLogin,
      finishPostLogin,
      signIn,
      signOut,
      signOutAllDevices,
      refreshPerfil,
      recarregarInadimplencia,
      recarregarTermoCnpj,
    }),
    [
      user,
      session,
      perfil,
      prestador,
      isPrestador,
      isContaBloqueadaSindico,
      statusAprovacao,
      kycCaso,
      inadimplencia,
      termoCnpjGrandeAceito,
      isLoading,
      isPostLogin,
      mfaRequired,
      mfaFactorId,
      hasOnboarded,
      setOnboardingCompleted,
      clearMfaRequired,
      startPostLogin,
      finishPostLogin,
      signIn,
      signOut,
      signOutAllDevices,
      refreshPerfil,
      recarregarInadimplencia,
      recarregarTermoCnpj,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return ctx;
}
