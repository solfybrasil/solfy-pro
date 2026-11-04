import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
  AppState,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Clock,
  ShieldCheck,
  AlertCircle,
  XCircle,
  CheckCircle2,
  RotateCw,
  LogOut,
  HelpCircle,
  ArrowRight,
  Building2,
  AlertTriangle,
  Mail,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../components/AlertProvider';
import { GradientButton } from '../../components/GradientButton';
import {
  obterMeuStatusCadastro,
  MeuStatusCadastroResponse,
  kycMeuCaso,
} from '../../lib/kycGateApi';

export default function StatusAnaliseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut, refreshPerfil } = useAuth();
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [recarregando, setRecarregando] = useState(false);
  const [caso, setCaso] = useState<MeuStatusCadastroResponse | null>(null);

  const statusAnteriorRef = useRef<string | null>(null);
  const pollTimerRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  // Consulta obrigatória e unificada ao servidor via RPC meu_status_cadastro(auth.uid())
  // O status NUNCA vem de parâmetros de rota (URL).
  const carregarStatus = useCallback(async (): Promise<MeuStatusCadastroResponse | null> => {
    try {
      const resp = await obterMeuStatusCadastro();
      if (resp && resp.autenticado) {
        if (isMountedRef.current) {
          setCaso(resp);
        }
        if (resp.status === 'aprovado') {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
          router.replace('/(app)');
        }
        return resp;
      }

      // Se a sessão caiu ou não está autenticado, redireciona ao login
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.replace('/(auth)/login');
      }
      return null;
    } catch (e) {
      console.warn('[status-analise] Erro ao carregar status:', e);
      return null;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [router]);

  // Carga inicial
  useEffect(() => {
    isMountedRef.current = true;
    carregarStatus();

    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [carregarStatus]);

  const status = (caso?.status || 'em_analise') as string;
  const suporteEmail = caso?.contato_suporte || 'suporte@solfy.online';
  const prazoTexto = caso?.prazo_texto || 'de 2 a 24 horas';
  const emailExibicao = caso?.email || user?.email || '';

  // Smart Polling a cada 5 segundos enquanto aguarda análise
  useEffect(() => {
    const precisaPolling =
      caso?.autenticado &&
      ['enviado', 'em_analise', 'verificando', 'revisao_manual', 'rascunho'].includes(status);

    if (!precisaPolling) return;

    const agendarProximo = () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      pollTimerRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;
        await carregarStatus();
        agendarProximo();
      }, (caso?.poll_status_seg || 5) * 1000);
    };

    agendarProximo();

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [caso?.autenticado, status, carregarStatus]);

  // Realtime subscription no Supabase: monitora atualizações imediatas no cadastro do usuário
  useEffect(() => {
    const currentUid = user?.id || caso?.usuario_id;
    if (!currentUid) return;

    const channel = supabase
      .channel(`status_analise_realtime_${currentUid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kyc_casos',
          filter: `usuario_id=eq.${currentUid}`,
        },
        async () => {
          await refreshPerfil();
          await carregarStatus();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'perfis',
          filter: `user_id=eq.${currentUid}`,
        },
        async () => {
          await refreshPerfil();
          await carregarStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, caso?.usuario_id, carregarStatus, refreshPerfil]);

  // Revalidação imediata quando o app volta do segundo plano para o primeiro plano (background -> active)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        carregarStatus();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [carregarStatus]);

  // Notificação com feedback tátil e transição automática ao mudar de status
  useEffect(() => {
    if (!statusAnteriorRef.current) {
      statusAnteriorRef.current = status;
      return;
    }

    if (statusAnteriorRef.current !== status) {
      if (status === 'aprovado') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert('Cadastro aprovado!', 'Parabéns! Seu cadastro foi homologado pela equipe Solfy.');
        router.replace('/(app)');
      } else if (status === 'pendencia') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        Alert.alert('Ajustes Solicitados', 'A equipe de análise solicitou correções no seu cadastro.');
      } else if (status === 'recusa' || status === 'reprovado') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        Alert.alert('Aviso', 'A análise do seu cadastro foi concluída com recusa.');
      }
      statusAnteriorRef.current = status;
    }
  }, [status, router]);

  const handleManualRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRecarregando(true);
    try {
      await refreshPerfil();
      const novoCaso = await carregarStatus();
      const novoStatus = novoCaso?.status || status;
      if (novoStatus === 'aprovado') {
        Alert.alert('Parabéns!', 'Seu cadastro foi aprovado!');
        if (novoCaso?.autenticado || user) {
          router.replace('/(app)');
        }
      } else if (novoStatus === 'pendencia') {
        Alert.alert('Aviso', 'Ajustes necessários no cadastro.');
      } else if (novoStatus === 'reprovado') {
        Alert.alert('Aviso', 'Cadastro não aprovado.');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar o status no momento.');
    } finally {
      setRecarregando(false);
    }
  };

  const handleLogout = () => {
    const executarLogout = async () => {
      try {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        }
        await signOut();
      } catch (err) {
        console.warn('Erro ao sair:', err);
      } finally {
        router.replace('/(auth)/welcome');
      }
    };

    if (showAlert) {
      showAlert({
        title: 'Sair da Conta',
        message: 'Deseja realmente sair do Solfy PRO?',
        type: 'confirm',
        confirmText: 'Sair',
        cancelText: 'Cancelar',
        isDestructive: true,
        onConfirm: executarLogout,
      });
      return;
    }

    if (Platform.OS === 'web') {
      const confirmou = typeof window !== 'undefined'
        ? window.confirm('Deseja realmente sair do Solfy PRO?')
        : true;
      if (confirmou) {
        executarLogout();
      }
      return;
    }

    Alert.alert('Sair da Conta', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: executarLogout,
      },
    ]);
  };

  const handleAcessar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isAutenticado = Boolean(caso?.autenticado || user);
    if (isAutenticado) {
      router.replace('/(app)');
    } else {
      router.replace('/(auth)/login');
    }
  };

  const handleCorrigir = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    router.replace('/(auth)/cadastro' as any);
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.safeArea, { paddingTop: insets.top }]}>
        <View style={s.loadingContainer}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
          <ActivityIndicator size="small" color="#059669" style={{ marginTop: 16 }} />
          <Text style={s.loadingText}>Verificando status da conta...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── ESTADO: APROVADO ───────────────────────────────────────────────────────
  if (status === 'aprovado') {
    const isAutenticado = Boolean(caso?.autenticado || user);

    return (
      <SafeAreaView style={[s.safeArea, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={s.centerContainer}>
          <View style={s.approvedIconBox}>
            <CheckCircle2 size={48} color="#1E3E25" />
          </View>

          <View style={s.approvedBadge}>
            <ShieldCheck size={14} color="#1E3E25" />
            <Text style={s.approvedBadgeText}>Acesso Liberado</Text>
          </View>

          <Text style={s.approvedTitle}>Cadastro Aprovado!</Text>
          <Text style={s.approvedDesc}>
            {isAutenticado
              ? 'Seu cadastro foi verificado com sucesso pela auditoria do Solfy PRO. Você já pode acessar seu painel operacional.'
              : 'Seu cadastro foi homologado com sucesso! Entre com seu CPF e senha para acessar o painel Solfy PRO.'}
          </Text>

          {emailExibicao ? (
            <View style={s.emailBadge}>
              <Text style={s.emailBadgeLabel}>E-mail da conta:</Text>
              <Text style={s.emailBadgeValue}>{emailExibicao}</Text>
            </View>
          ) : null}

          <View style={{ width: '100%', marginTop: 24 }}>
            <GradientButton
              title={isAutenticado ? 'Acessar Painel Agora' : 'Fazer Login e Acessar'}
              onPress={handleAcessar}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safeArea, { paddingTop: insets.top }]}>
      {/* Header Fixo Superior */}
      <View style={s.topHeader}>
        <View style={s.brandGroup}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={{ width: 36, height: 36 }}
            contentFit="contain"
          />
          <View style={{ marginLeft: 8 }}>
            <Text style={s.brandTitle}>SOLFY PRO</Text>
            <Text style={s.brandSubtitle}>VERIFICAÇÃO DE CADASTRO</Text>
          </View>
        </View>

        <View style={s.topActions}>
          <TouchableOpacity
            onPress={handleManualRefresh}
            disabled={recarregando}
            style={s.refreshBtn}
            activeOpacity={0.7}
          >
            <RotateCw
              size={14}
              color="#092215"
              style={recarregando ? { transform: [{ rotate: '45deg' }] } : undefined}
            />
            <Text style={s.refreshBtnText}>
              {recarregando ? 'Atualizando...' : 'Verificar'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogout}
            style={s.logoutBtn}
            activeOpacity={0.7}
          >
            <LogOut size={16} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ESTADOS: EM ANÁLISE / ENVIADO / VERIFICANDO / REVISÃO MANUAL */}
        {['enviado', 'em_analise', 'verificando', 'revisao_manual', 'rascunho'].includes(status) && (
          <View style={s.mainCard}>
            <View style={s.clockCircle}>
              <Clock size={40} color="#1E3E25" strokeWidth={2.2} />
            </View>

            <View style={s.statusPill}>
              <View style={s.pulsingDot} />
              <Text style={s.statusPillText}>
                {status === 'revisao_manual' || status === 'verificando'
                  ? 'Em Análise pela Mesa'
                  : 'Documentos em Análise'}
              </Text>
            </View>

            <Text style={s.cardTitle}>
              {params.recemCadastrado === 'true' ? 'Cadastro enviado!' : 'Cadastro em análise'}
            </Text>

            <Text style={s.cardDescClean}>
              Seus documentos estão em análise. A verificação leva de 2 a 24 horas.{'\n'}
              Você será notificado assim que for aprovado.
            </Text>

            {/* Informações Resumidas */}
            <View style={s.detailsBox}>
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Prazo estimado:</Text>
                <Text style={s.detailValue}>de 2 a 24 horas</Text>
              </View>

              {emailExibicao ? (
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>E-mail cadastrado:</Text>
                  <Text style={s.detailValue}>{emailExibicao}</Text>
                </View>
              ) : null}

              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Atualização:</Text>
                <View style={s.autoUpdateBadge}>
                  <View style={s.smallPulsingDot} />
                  <Text style={s.autoUpdateText}>Automática em tempo real</Text>
                </View>
              </View>
            </View>

            {/* Botão Principal Entendi */}
            <View style={{ width: '100%', marginTop: 20 }}>
              <GradientButton
                title="Entendi"
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                  Alert.alert(
                    'Cadastro em Análise',
                    'Avisaremos por notificação e e-mail assim que sua conta for homologada. Você não precisa refazer o cadastro.',
                    [{ text: 'OK' }]
                  );
                }}
              />
            </View>
          </View>
        )}

        {/* ESTADO: PENDÊNCIA OU RECUSA COM MOTIVO E REENVIO */}
        {['pendencia', 'pendente', 'rejeitado', 'reprovado'].includes(status) && (
          <View style={[s.mainCard, s.pendenciaCard]}>
            <View style={s.warningCircle}>
              <AlertTriangle size={38} color="#D97706" strokeWidth={2.2} />
            </View>

            <View style={s.pendenciaPill}>
              <Text style={s.pendenciaPillText}>Ajuste Necessário</Text>
            </View>

            <Text style={s.cardTitle}>Ajuste no Cadastro</Text>

            <Text style={s.cardDesc}>
              A equipe de validação identificou uma pendência em sua documentação. Confira o motivo abaixo e reenvie o documento solicitado para liberação.
            </Text>

            <View style={s.auditorBox}>
              <Text style={s.auditorLabel}>MOTIVO DA PENDÊNCIA:</Text>
              <Text style={s.auditorText}>
                {caso?.mensagem_ao_usuario ||
                  params.mensagem ||
                  caso?.motivo_bloqueio ||
                  'Um ou mais documentos enviados ficaram ilegíveis ou com reflexo. Por favor, reenvie o documento com boa iluminação.'}
              </Text>
            </View>

            {caso?.pendencias && caso.pendencias.length > 0 && (
              <View style={s.pendenciasList}>
                <Text style={s.pendenciasHeader}>CAMPOS A CORRIGIR:</Text>
                {caso.pendencias.map((pend, idx) => (
                  <View key={idx} style={s.pendenciaItem}>
                    <AlertCircle size={18} color="#D97706" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.pendenciaDocName}>
                        {pend.codigo ? pend.codigo.replace(/_/g, ' ').toUpperCase() : 'DOCUMENTO'}
                      </Text>
                      <Text style={s.pendenciaDocReason}>
                        {pend.motivo ? pend.motivo.replace(/_/g, ' ') : pend.mensagem_ao_usuario || 'Necessita novo envio'}
                      </Text>
                      {pend.detalhe ? (
                        <Text style={s.pendenciaDocDetail}>"{pend.detalhe}"</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={{ width: '100%', marginTop: 20 }}>
              <GradientButton
                title="Reenviar documento"
                onPress={() => handleCorrigir()}
              />
            </View>

            <TouchableOpacity
              onPress={() => Linking.openURL(`mailto:${suporteEmail}`)}
              style={s.supportLinkBox}
              activeOpacity={0.7}
            >
              <Mail size={16} color="#059669" />
              <Text style={s.supportLinkText}>
                Fale com nossa equipe em <Text style={{ fontWeight: '800' }}>{suporteEmail}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ESTADO: SUSPENSO */}
        {status === 'suspenso' && (
          <View style={s.mainCard}>
            <View style={s.neutralCircle}>
              <AlertCircle size={36} color="#64748B" />
            </View>

            <View style={s.neutralPill}>
              <Text style={s.neutralPillText}>Suspensão Operacional</Text>
            </View>

            <Text style={s.cardTitle}>Cadastro Temporariamente Suspenso</Text>

            <Text style={s.cardDesc}>
              O acesso operacional a esta conta encontra-se suspenso preventivamente para validação cadastral ou documental.
            </Text>

            {caso?.mensagem_ao_usuario && (
              <View style={s.auditorBoxNeutral}>
                <Text style={s.auditorLabelNeutral}>INFORMAÇÕES:</Text>
                <Text style={s.auditorTextNeutral}>{caso.mensagem_ao_usuario}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => Linking.openURL(`mailto:${suporteEmail}`)}
              style={s.supportLinkBox}
              activeOpacity={0.7}
            >
              <Mail size={16} color="#059669" />
              <Text style={s.supportLinkText}>
                Contate a equipe em <Text style={{ fontWeight: '800' }}>{suporteEmail}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Footer Suporte */}
      <View style={s.bottomFooter}>
        <HelpCircle size={15} color="#94A3B8" />
        <Text style={s.bottomFooterText}>
          Precisa de ajuda? Suporte Solfy em{' '}
          <Text
            onPress={() => Linking.openURL(`mailto:${suporteEmail}`)}
            style={{ fontWeight: '700', color: '#059669' }}
          >
            {suporteEmail}
          </Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FDFCFB',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  brandIconBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#092215',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#34D399',
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 12,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEAE4',
    backgroundColor: '#FDFCFB',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandSquare: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#092215',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandSquareText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#34D399',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#092215',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.8,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#092215',
  },
  logoutBtn: {
    padding: 8,
    borderRadius: 10,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  centerContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  mainCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    padding: 24,
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 16px rgba(9, 34, 21, 0.05)' }
      : {
          shadowColor: '#092215',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 3,
        }),
  },
  pendenciaCard: {
    borderColor: '#FDE68A',
  },
  reprovadoCard: {
    borderColor: '#FECDD3',
  },
  clockCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  warningCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dangerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  neutralCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  approvedIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    marginBottom: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#059669',
  },
  pendenciaPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    marginBottom: 12,
  },
  pendenciaPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reprovadoPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#FFE4E6',
    marginBottom: 12,
  },
  reprovadoPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9F1239',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  neutralPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },
  neutralPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  approvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    marginBottom: 14,
  },
  approvedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#092215',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  cardDescClean: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    fontWeight: '500',
  },
  approvedTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#092215',
    textAlign: 'center',
    marginBottom: 10,
  },
  approvedDesc: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 380,
    marginBottom: 18,
  },
  detailsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
    marginBottom: 18,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#092215',
  },
  detailValueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  autoUpdateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallPulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  autoUpdateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  subTextFooter: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
  auditorBox: {
    width: '100%',
    padding: 14,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    marginBottom: 16,
  },
  auditorLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  auditorText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  auditorBoxNeutral: {
    width: '100%',
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    marginBottom: 16,
  },
  auditorLabelNeutral: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  auditorTextNeutral: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
  },
  pendenciasList: {
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  pendenciasHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  pendenciaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pendenciaDocName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#092215',
    textTransform: 'capitalize',
  },
  pendenciaDocReason: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  pendenciaDocDetail: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#64748B',
    marginTop: 4,
  },
  actionBtn: {
    width: '100%',
    backgroundColor: '#092215',
    borderRadius: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 14px rgba(9, 34, 21, 0.25)' }
      : {
          shadowColor: '#092215',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 3,
        }),
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginBottom: 24,
  },
  emailBadgeLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  emailBadgeValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#092215',
  },
  supportLinkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  supportLinkText: {
    fontSize: 12,
    color: '#059669',
  },
  bottomFooter: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#ECEAE4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  bottomFooterText: {
    fontSize: 11,
    color: '#94A3B8',
  },
});
