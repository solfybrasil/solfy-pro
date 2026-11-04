import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import {
  Bell,
  Mail,
  Smartphone,
  Moon,
  ShieldCheck,
  EyeOff,
  Send,
  CheckCircle2,
  Lock,
  AlertCircle,
  Clock,
  WifiOff,
} from 'lucide-react-native';
import { C, R, S, SH, FONT } from '../../constants/theme';
import { CONFIG_TEXTS, traduzirErroServidor } from '../../constants/configTexts';
import {
  SecaoConfig,
  Interruptor,
  EstadoErro,
  EsqueletoLista,
  Aviso,
} from './ConfigComponents';
import {
  carregarPreferenciasNotificacao,
  salvarPreferenciasNotificacao,
  enviarNotificacaoTeste,
  type CategoriaNotificacao,
  type MatrizNotificacoes,
  type PreferenciasNotificacaoResponse,
} from '../../lib/condoConfigApi';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';

export interface NotificacoesConfigViewProps {
  onVoltar: () => void;
  onPreferenciasAtualizadas?: () => void;
}

const CATEGORIAS_ORDEM: CategoriaNotificacao[] = [
  'pedidos_orcamentos',
  'visitas_execucao',
  'prazos',
  'equipe_convites',
  'comunicados_solfy',
  'seguranca_conta',
  'decisoes_cadastro',
];

const CATEGORIAS_OBRIGATORIAS: CategoriaNotificacao[] = [
  'seguranca_conta',
  'decisoes_cadastro',
];

export function NotificacoesConfigView({
  onVoltar,
  onPreferenciasAtualizadas,
}: NotificacoesConfigViewProps) {
  const { user } = useAuth();
  const { enfileirarNotificacao } = useNotifications();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [permissaoPushStatus, setPermissaoPushStatus] = useState<string>('granted');

  // Estado do servidor (baseline para dirty-check)
  const [baseline, setBaseline] = useState<PreferenciasNotificacaoResponse | null>(null);

  // Estados locais editáveis
  const [matriz, setMatriz] = useState<MatrizNotificacoes | null>(null);
  const [silenciosoAtivo, setSilenciosoAtivo] = useState(false);
  const [silenciosoInicio, setSilenciosoInicio] = useState('22:00');
  const [silenciosoFim, setSilenciosoFim] = useState('07:00');
  const [ocultarBloqueada, setOcultarBloqueada] = useState(false);
  const [resumoDiario, setResumoDiario] = useState(false);

  // Toast Feedback
  const [aviso, setAviso] = useState<{
    visivel: boolean;
    tipo: 'sucesso' | 'erro' | 'info';
    mensagem: string;
  }>({ visivel: false, tipo: 'sucesso', mensagem: '' });

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
    });
    return () => unsub();
  }, []);

  // Checa permissão do sistema operacional para Push
  const checarPermissoesSistema = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermissaoPushStatus(status);
    } catch {
      // ignora
    }
  }, []);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      await checarPermissoesSistema();
      const res = await carregarPreferenciasNotificacao();
      setBaseline(res.dados);
      setMatriz(res.dados.matriz);
      setSilenciosoAtivo(res.dados.horario_silencioso.ativo);
      setSilenciosoInicio(res.dados.horario_silencioso.inicio);
      setSilenciosoFim(res.dados.horario_silencioso.fim);
      setOcultarBloqueada(res.dados.ocultar_conteudo_bloqueada);
      setResumoDiario(res.dados.resumo_diario_email);
      if (res.doCacheOffline) setOffline(true);
    } catch (err) {
      const msg = traduzirErroServidor(err);
      setErroCarga(msg);
    } finally {
      setCarregando(false);
    }
  }, [checarPermissoesSistema]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Dirty check: alguma preferência mudou em relação ao baseline?
  const houveAlteracao = useMemo(() => {
    if (!baseline || !matriz) return false;
    if (silenciosoAtivo !== baseline.horario_silencioso.ativo) return true;
    if (silenciosoInicio !== baseline.horario_silencioso.inicio) return true;
    if (silenciosoFim !== baseline.horario_silencioso.fim) return true;
    if (ocultarBloqueada !== baseline.ocultar_conteudo_bloqueada) return true;
    if (resumoDiario !== baseline.resumo_diario_email) return true;
    return JSON.stringify(matriz) !== JSON.stringify(baseline.matriz);
  }, [
    baseline,
    matriz,
    silenciosoAtivo,
    silenciosoInicio,
    silenciosoFim,
    ocultarBloqueada,
    resumoDiario,
  ]);

  // Alteração de célula da matriz (categoria x canal)
  const handleToggleCanal = (
    cat: CategoriaNotificacao,
    canal: 'app' | 'push' | 'email',
    novoValor: boolean
  ) => {
    if (!matriz) return;
    // Categorias obrigatórias não podem ter app ou email desativados
    if (CATEGORIAS_OBRIGATORIAS.includes(cat) && (canal === 'app' || canal === 'email')) {
      setAviso({
        visivel: true,
        tipo: 'info',
        mensagem: CONFIG_TEXTS.notificacoes.ajudaObrigatoria,
      });
      return;
    }

    setMatriz((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [cat]: {
          ...prev[cat],
          [canal]: novoValor,
        },
      };
    });
  };

  const handleSalvar = async () => {
    if (!matriz || offline || salvando) return;
    setSalvando(true);
    try {
      const atualizado = await salvarPreferenciasNotificacao(
        matriz,
        silenciosoAtivo,
        silenciosoInicio.trim(),
        silenciosoFim.trim(),
        ocultarBloqueada,
        resumoDiario
      );
      setBaseline(atualizado);
      setMatriz(atualizado.matriz);
      setAviso({
        visivel: true,
        tipo: 'sucesso',
        mensagem: 'Preferências de notificações salvas com sucesso!',
      });
      onPreferenciasAtualizadas?.();
    } catch (err) {
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: traduzirErroServidor(err),
      });
    } finally {
      setSalvando(false);
    }
  };

  const handleEnviarTeste = async () => {
    if (offline || enviandoTeste) return;
    setEnviandoTeste(true);
    try {
      const item = await enviarNotificacaoTeste(user?.id);
      if (item) {
        enfileirarNotificacao(item);
      }
      setAviso({
        visivel: true,
        tipo: 'sucesso',
        mensagem: CONFIG_TEXTS.notificacoes.sucessoTeste,
      });
    } catch (err) {
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: traduzirErroServidor(err),
      });
    } finally {
      setEnviandoTeste(false);
    }
  };

  const handleAbrirAjustesSistema = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={onVoltar}
          style={styles.botaoVoltar}
          accessibilityRole="button"
          accessibilityLabel={CONFIG_TEXTS.comum.voltar}
        >
          <Text style={styles.botaoVoltarTexto}>‹ {CONFIG_TEXTS.comum.voltar}</Text>
        </TouchableOpacity>
        <Text style={styles.topHeaderTitulo} numberOfLines={1}>
          {CONFIG_TEXTS.notificacoes.titulo}
        </Text>
        <TouchableOpacity
          onPress={handleSalvar}
          disabled={!houveAlteracao || salvando || offline}
          style={[
            styles.botaoSalvarTopo,
            (!houveAlteracao || salvando || offline) && styles.botaoSalvarTopoDesabilitado,
          ]}
          accessibilityRole="button"
          accessibilityLabel={CONFIG_TEXTS.comum.salvar}
        >
          {salvando ? (
            <ActivityIndicator size="small" color={C.primary} />
          ) : (
            <Text
              style={[
                styles.botaoSalvarTopoTexto,
                (!houveAlteracao || offline) && styles.botaoSalvarTopoTextoDesabilitado,
              ]}
            >
              {CONFIG_TEXTS.comum.salvar}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {offline && (
          <View style={styles.offlineBanner} accessibilityRole="alert">
            <WifiOff size={18} color={C.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineBannerTitulo}>
                {CONFIG_TEXTS.comum.offlineBannerTitulo}
              </Text>
              <Text style={styles.offlineBannerSub}>
                {CONFIG_TEXTS.comum.offlineBannerSubtitulo}
              </Text>
            </View>
          </View>
        )}

        {permissaoPushStatus === 'denied' && Platform.OS !== 'web' && (
          <View style={styles.avisoPermissaoCard} accessibilityRole="alert">
            <AlertCircle size={20} color={C.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.avisoPermissaoTitulo}>
                {CONFIG_TEXTS.notificacoes.permissaoPushNegadaTitulo}
              </Text>
              <Text style={styles.avisoPermissaoDesc}>
                {CONFIG_TEXTS.notificacoes.permissaoPushNegadaDescricao}
              </Text>
              <TouchableOpacity
                style={styles.botaoAjustes}
                onPress={handleAbrirAjustesSistema}
                accessibilityRole="button"
              >
                <Text style={styles.botaoAjustesTexto}>
                  {CONFIG_TEXTS.notificacoes.botaoAbrirAjustes}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Aviso
          visivel={aviso.visivel}
          tipo={aviso.tipo}
          mensagem={aviso.mensagem}
          onFechar={() => setAviso((p) => ({ ...p, visivel: false }))}
        />

        {carregando ? (
          <EsqueletoLista linhas={7} />
        ) : erroCarga || !matriz ? (
          <EstadoErro
            mensagem={erroCarga || CONFIG_TEXTS.comum.erroGenericoServidor}
            onTentarDeNovo={carregarDados}
          />
        ) : (
          <>
            {/* ─── 1. MATRIZ CATEGORIA X CANAL ───────────────────────────── */}
            <SecaoConfig
              titulo={CONFIG_TEXTS.notificacoes.secaoCanaisTitulo}
              descricao={CONFIG_TEXTS.notificacoes.secaoCanaisDescricao}
            >
              <View style={styles.cardPadding}>
                {CATEGORIAS_ORDEM.map((catKey) => {
                  const catCfg = CONFIG_TEXTS.notificacoes.categorias[catKey];
                  const valores = matriz[catKey] || { app: true, push: true, email: false };
                  const isObrigatoria = CATEGORIAS_OBRIGATORIAS.includes(catKey);

                  return (
                    <View key={catKey} style={styles.categoriaCard}>
                      <View style={styles.categoriaHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.tituloComSeloRow}>
                            <Text style={styles.categoriaTitulo}>{catCfg.titulo}</Text>
                            {isObrigatoria && (
                              <View style={styles.seloObrigatoria}>
                                <Lock size={10} color={C.primaryDark} />
                                <Text style={styles.seloObrigatoriaTexto}>
                                  {CONFIG_TEXTS.notificacoes.seloObrigatoria}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.categoriaDescricao}>{catCfg.descricao}</Text>
                        </View>
                      </View>

                      {/* Canais: App, Push, E-mail */}
                      <View style={styles.canaisRow}>
                        {/* Canal 1: Central no App */}
                        <TouchableOpacity
                          style={[
                            styles.canalChip,
                            valores.app && styles.canalChipAtivo,
                            isObrigatoria && styles.canalChipTravado,
                          ]}
                          onPress={() => handleToggleCanal(catKey, 'app', !valores.app)}
                          disabled={isObrigatoria || offline}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: valores.app }}
                          accessibilityLabel={`${catCfg.titulo} - Central no App`}
                        >
                          <Smartphone size={13} color={valores.app ? C.primary : C.textTertiary} />
                          <Text
                            style={[
                              styles.canalChipTexto,
                              valores.app && styles.canalChipTextoAtivo,
                            ]}
                          >
                            {CONFIG_TEXTS.notificacoes.canalApp}
                          </Text>
                          {valores.app && <CheckCircle2 size={12} color={C.primary} />}
                        </TouchableOpacity>

                        {/* Canal 2: Push */}
                        <TouchableOpacity
                          style={[
                            styles.canalChip,
                            valores.push && styles.canalChipAtivo,
                          ]}
                          onPress={() => handleToggleCanal(catKey, 'push', !valores.push)}
                          disabled={offline}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: valores.push }}
                          accessibilityLabel={`${catCfg.titulo} - Notificação Push`}
                        >
                          <Bell size={13} color={valores.push ? C.primary : C.textTertiary} />
                          <Text
                            style={[
                              styles.canalChipTexto,
                              valores.push && styles.canalChipTextoAtivo,
                            ]}
                          >
                            {CONFIG_TEXTS.notificacoes.canalPush}
                          </Text>
                          {valores.push && <CheckCircle2 size={12} color={C.primary} />}
                        </TouchableOpacity>

                        {/* Canal 3: E-mail */}
                        <TouchableOpacity
                          style={[
                            styles.canalChip,
                            valores.email && styles.canalChipAtivo,
                            isObrigatoria && styles.canalChipTravado,
                          ]}
                          onPress={() => handleToggleCanal(catKey, 'email', !valores.email)}
                          disabled={isObrigatoria || offline}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: valores.email }}
                          accessibilityLabel={`${catCfg.titulo} - E-mail`}
                        >
                          <Mail size={13} color={valores.email ? C.primary : C.textTertiary} />
                          <Text
                            style={[
                              styles.canalChipTexto,
                              valores.email && styles.canalChipTextoAtivo,
                            ]}
                          >
                            {CONFIG_TEXTS.notificacoes.canalEmail}
                          </Text>
                          {valores.email && <CheckCircle2 size={12} color={C.primary} />}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </SecaoConfig>

            {/* ─── 2. HORÁRIO SILENCIOSO ─────────────────────────────────── */}
            <SecaoConfig
              titulo={CONFIG_TEXTS.notificacoes.secaoSilenciosoTitulo}
              descricao={CONFIG_TEXTS.notificacoes.secaoSilenciosoDescricao}
            >
              <View style={styles.cardPadding}>
                <Interruptor
                  label={CONFIG_TEXTS.notificacoes.silenciosoInterruptorLabel}
                  descricao="Não tocar nem vibrar o celular em horário de descanso"
                  valor={silenciosoAtivo}
                  ativo={silenciosoAtivo}
                  onValueChange={setSilenciosoAtivo}
                  onAlterar={setSilenciosoAtivo}
                  desabilitado={offline}
                />

                {silenciosoAtivo && (
                  <View style={styles.silenciosoHorariosBox}>
                    <View style={styles.horarioItem}>
                      <Text style={styles.horarioLabel}>
                        {CONFIG_TEXTS.notificacoes.silenciosoHorarioInicioLabel}
                      </Text>
                      <TextInput
                        style={styles.horarioInput}
                        value={silenciosoInicio}
                        onChangeText={setSilenciosoInicio}
                        placeholder="22:00"
                        placeholderTextColor={C.textTertiary}
                        maxLength={5}
                        keyboardType="numbers-and-punctuation"
                        editable={!offline}
                        accessibilityLabel="Horário de início do silêncio"
                      />
                    </View>

                    <Text style={styles.horarioAteTexto}>até</Text>

                    <View style={styles.horarioItem}>
                      <Text style={styles.horarioLabel}>
                        {CONFIG_TEXTS.notificacoes.silenciosoHorarioFimLabel}
                      </Text>
                      <TextInput
                        style={styles.horarioInput}
                        value={silenciosoFim}
                        onChangeText={setSilenciosoFim}
                        placeholder="07:00"
                        placeholderTextColor={C.textTertiary}
                        maxLength={5}
                        keyboardType="numbers-and-punctuation"
                        editable={!offline}
                        accessibilityLabel="Horário de término do silêncio"
                      />
                    </View>
                  </View>
                )}
                <Text style={styles.silenciosoAjudaTexto}>
                  {CONFIG_TEXTS.notificacoes.silenciosoHorarioAjuda}
                </Text>
              </View>
            </SecaoConfig>

            {/* ─── 3. PRIVACIDADE & RESUMOS ──────────────────────────────── */}
            <SecaoConfig
              titulo={CONFIG_TEXTS.notificacoes.secaoPrivacidadeTitulo}
              descricao={CONFIG_TEXTS.notificacoes.secaoPrivacidadeDescricao}
            >
              <View style={styles.cardPadding}>
                <Interruptor
                  label={CONFIG_TEXTS.notificacoes.ocultarBloqueadaLabel}
                  descricao={CONFIG_TEXTS.notificacoes.ocultarBloqueadaDescricao}
                  valor={ocultarBloqueada}
                  ativo={ocultarBloqueada}
                  onValueChange={setOcultarBloqueada}
                  onAlterar={setOcultarBloqueada}
                  desabilitado={offline}
                />

                <View style={styles.divisorInterno} />

                <Interruptor
                  label={CONFIG_TEXTS.notificacoes.resumoDiarioLabel}
                  descricao={CONFIG_TEXTS.notificacoes.resumoDiarioDescricao}
                  valor={resumoDiario}
                  ativo={resumoDiario}
                  onValueChange={setResumoDiario}
                  onAlterar={setResumoDiario}
                  desabilitado={offline}
                />
              </View>
            </SecaoConfig>

            {/* ─── 4. DISPOSITIVOS E TESTE EM TEMPO REAL ─────────────────── */}
            <SecaoConfig
              titulo={CONFIG_TEXTS.notificacoes.secaoDispositivosTitulo}
              descricao="Aparelhos ativos vinculados à sua conta de síndico."
            >
              <View style={styles.cardPadding}>
                <View style={styles.dispositivosHeaderRow}>
                  <Smartphone size={20} color={C.primary} />
                  <Text style={styles.dispositivosCountTexto}>
                    {baseline?.dispositivos_push_conectados ?? 0}{' '}
                    {CONFIG_TEXTS.notificacoes.dispositivosConectadosTexto}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.botaoTeste,
                    (offline || enviandoTeste) && styles.botaoTesteDesabilitado,
                  ]}
                  onPress={handleEnviarTeste}
                  disabled={offline || enviandoTeste}
                  accessibilityRole="button"
                  accessibilityLabel={CONFIG_TEXTS.notificacoes.botaoEnviarTeste}
                >
                  {enviandoTeste ? (
                    <ActivityIndicator size="small" color={C.primary} />
                  ) : (
                    <>
                      <Send size={15} color={C.primary} />
                      <Text style={styles.botaoTesteTexto}>
                        {CONFIG_TEXTS.notificacoes.botaoEnviarTeste}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </SecaoConfig>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg0,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  botaoVoltar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    gap: 8,
  },
  botaoVoltarTexto: {
    fontFamily: FONT.medium,
    fontSize: 14,
    color: '#132817',
  },
  topHeaderTitulo: {
    fontFamily: FONT.bold,
    fontSize: 16.5,
    color: '#132817',
    flex: 1,
    textAlign: 'center',
  },
  botaoSalvarTopo: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#2E5A36',
    minHeight: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  botaoSalvarTopoDesabilitado: {
    backgroundColor: '#F1F5F9',
    opacity: 0.6,
  },
  botaoSalvarTopoTexto: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  botaoSalvarTopoTextoDesabilitado: {
    color: '#94A3B8',
  },
  scrollContent: {
    paddingBottom: 48,
  },
  cardPadding: {
    padding: S.md,
    gap: S.md,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.warningBg,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    gap: S.sm,
    marginHorizontal: S.md,
    marginTop: S.sm,
    borderRadius: R.sm,
  },
  offlineBannerTitulo: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: C.warning,
  },
  offlineBannerSub: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: C.textSecondary,
  },
  avisoPermissaoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: S.md,
    borderRadius: R.md,
    marginHorizontal: S.md,
    marginTop: S.sm,
    gap: S.sm,
  },
  avisoPermissaoTitulo: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: '#92400E',
  },
  avisoPermissaoDesc: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: '#78350F',
    marginTop: 2,
    lineHeight: 17,
  },
  botaoAjustes: {
    alignSelf: 'flex-start',
    marginTop: S.xs,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#92400E',
    borderRadius: R.xs,
  },
  botaoAjustesTexto: {
    fontFamily: FONT.semibold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  categoriaCard: {
    paddingVertical: S.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    gap: S.xs,
  },
  categoriaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tituloComSeloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
    flexWrap: 'wrap',
  },
  categoriaTitulo: {
    fontFamily: FONT.semibold,
    fontSize: 14,
    color: C.textPrimary,
  },
  seloObrigatoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.primaryBgLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  seloObrigatoriaTexto: {
    fontFamily: FONT.semibold,
    fontSize: 10,
    color: C.primaryDark,
  },
  categoriaDescricao: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  canaisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
    marginTop: S.xxs,
    flexWrap: 'wrap',
  },
  canalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.divider,
    backgroundColor: C.bg1,
  },
  canalChipAtivo: {
    borderColor: C.primary,
    backgroundColor: C.primaryBgLight,
  },
  canalChipTravado: {
    opacity: 0.85,
    backgroundColor: '#F3F4F6',
  },
  canalChipTexto: {
    fontFamily: FONT.medium,
    fontSize: 11,
    color: C.textSecondary,
  },
  canalChipTextoAtivo: {
    color: C.primaryDark,
    fontFamily: FONT.semibold,
  },
  silenciosoHorariosBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.md,
    marginTop: S.sm,
    paddingVertical: S.sm,
    backgroundColor: C.bg0,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.divider,
  },
  horarioItem: {
    alignItems: 'center',
  },
  horarioLabel: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: C.textSecondary,
    marginBottom: 4,
  },
  horarioInput: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: C.textPrimary,
    borderBottomWidth: 1.5,
    borderBottomColor: C.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    textAlign: 'center',
    minWidth: 70,
  },
  horarioAteTexto: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: C.textTertiary,
    marginTop: 12,
  },
  silenciosoAjudaTexto: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: C.textTertiary,
    marginTop: S.xs,
  },
  divisorInterno: {
    height: 1,
    backgroundColor: C.divider,
    marginVertical: S.xs,
  },
  dispositivosHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
  },
  dispositivosCountTexto: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: C.textPrimary,
    flex: 1,
  },
  botaoTeste: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.xs,
    paddingVertical: S.sm,
    paddingHorizontal: S.md,
    borderRadius: R.sm,
    borderWidth: 1.5,
    borderColor: C.primary,
    backgroundColor: C.primaryBgLight,
    marginTop: S.xs,
    minHeight: 44,
  },
  botaoTesteDesabilitado: {
    opacity: 0.5,
  },
  botaoTesteTexto: {
    fontFamily: FONT.semibold,
    fontSize: 13,
    color: C.primary,
  },
});
