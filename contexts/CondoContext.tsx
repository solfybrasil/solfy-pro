import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import {
  buscarCondominiosDoUsuario,
  buscarPapelNoCondominio,
} from '../lib/condoApi';
import type { Condominio, PapelCondominio } from '../types/condo';

const CONDO_ATIVO_KEY = 'solfy_condo_ativo_id';

interface CondoContextType {
  condominios: Condominio[];
  condominioAtivo: Condominio | null;
  papelAtual: PapelCondominio | null;
  alcadaAtual: number | null;
  loading: boolean;
  isSindico: boolean;
  trocarCondominio: (condominioId: string) => Promise<void>;
  recarregarCondominios: () => Promise<void>;
}

const CondoContext = createContext<CondoContextType | undefined>(undefined);

export function CondoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [condominioAtivo, setCondominioAtivo] = useState<Condominio | null>(null);
  const [papelAtual, setPapelAtual] = useState<PapelCondominio | null>(null);
  const [alcadaAtual, setAlcadaAtual] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const papelCacheRef = useRef<Map<string, { papel: PapelCondominio | null; alcada: number | null }>>(
    new Map()
  );

  const recarregarCondominios = useCallback(async () => {
    if (!user) {
      setCondominios([]);
      setCondominioAtivo(null);
      setPapelAtual(null);
      setAlcadaAtual(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const condos = await buscarCondominiosDoUsuario();
      setCondominios(condos);

      if (condos.length === 0) {
        setCondominioAtivo(null);
        setPapelAtual(null);
        setAlcadaAtual(null);
        setLoading(false);
        return;
      }

      // Restaura último condomínio ativo do AsyncStorage
      let savedId: string | null = null;
      try {
        savedId = await AsyncStorage.getItem(CONDO_ATIVO_KEY);
      } catch (_) {}

      const restoredCondo = savedId
        ? condos.find((c: any) => c.id === savedId)
        : null;
      const activeCondo = restoredCondo || condos[0];

      setCondominioAtivo(activeCondo);

      // Busca papel e alçada
      const { papel, alcada } = await buscarPapelNoCondominio(activeCondo.id);
      papelCacheRef.current.set(activeCondo.id, { papel, alcada });
      setPapelAtual(papel);
      setAlcadaAtual(alcada);
    } catch (err) {
      console.error('[CondoContext] Erro ao carregar condomínios:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    recarregarCondominios();
  }, [recarregarCondominios]);

  const trocarCondominio = useCallback(
    async (condominioId: string) => {
      const condo = condominios.find((c) => c.id === condominioId);
      if (!condo) return;

      // 1. Atualização instantânea
      setCondominioAtivo(condo);
      try {
        await AsyncStorage.setItem(CONDO_ATIVO_KEY, condominioId);
      } catch (_) {}

      // 2. Cache síncrono
      const cached = papelCacheRef.current.get(condominioId);
      if (cached) {
        setPapelAtual(cached.papel);
        setAlcadaAtual(cached.alcada);
      }

      // 3. Atualização em segundo plano
      try {
        const { papel, alcada } = await buscarPapelNoCondominio(condominioId);
        papelCacheRef.current.set(condominioId, { papel, alcada });
        setPapelAtual(papel);
        setAlcadaAtual(alcada);
      } catch (err) {
        console.warn('[CondoContext] Erro ao buscar papel no background:', err);
      }
    },
    [condominios]
  );

  const isSindico = papelAtual === 'sindico' || papelAtual === 'subsindico';

  return (
    <CondoContext.Provider
      value={{
        condominios,
        condominioAtivo,
        papelAtual,
        alcadaAtual,
        loading,
        isSindico,
        trocarCondominio,
        recarregarCondominios,
      }}
    >
      {children}
    </CondoContext.Provider>
  );
}

export function useCondo() {
  const context = useContext(CondoContext);
  if (!context) {
    throw new Error('useCondo deve ser usado dentro de um CondoProvider');
  }
  return context;
}
