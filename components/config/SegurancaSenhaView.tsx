import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import NetInfo from '@react-native-community/netinfo';
import {
  ArrowLeft,
  Lock,
  Shield,
  ShieldCheck,
  Smartphone,
  Laptop,
  Copy,
  Check,
  Eye,
  EyeOff,
  Mail,
  Activity,
  HelpCircle,
  WifiOff,
  X,
  LogOut,
  KeyRound,
} from 'lucide-react-native';
import { C, R, S, SH, FONT } from '../../constants/theme';
import { CONFIG_TEXTS, traduzirErroServidor } from '../../constants/configTexts';
import { useAuth } from '../../contexts/AuthContext';
import PasswordStrength, {
  type PasswordRule,
  evaluatePasswordStrength,
} from '../PasswordStrength';
import {
  SecaoConfig,
  CampoFormulario,
  Interruptor,
  ControleSegmentado,
  FolhaConfirmar,
  FolhaReautenticar,
  EstadoErro,
  EsqueletoLista,
  Aviso,
} from './ConfigComponents';
import {
  carregarPainelSeguranca,
  alterarMinhaSenhaComSeguranca,
  iniciarCadastroMfaTotp,
  confirmarAtivacaoMfaTotp,
  desativarMfaTotpComReautenticacao,
  solicitarRecuperacao2faComReautenticacao,
  encerrarAparelhoSessao,
  lerConfigTravaLocalAparelho,
  salvarConfigTravaLocalAparelho,
  type PainelSegurancaResponse,
  type ConfigTravaLocalAparelho,
  type SessaoDispositivoItem,
} from '../../lib/condoConfigApi';

export interface SegurancaSenhaViewProps {
  onVoltar: () => void;
  onSairTodosDispositivos: () => void;
  onSegurancaAtualizada?: () => void;
}

const REGRAS_SENHA_FINANCEIRA: readonly PasswordRule[] = [
  {
    id: 'length',
    label: CONFIG_TEXTS.segurancaSenha.regraTamanho,
    test: (v) => v.length >= 8,
  },
  {
    id: 'case',
    label: CONFIG_TEXTS.segurancaSenha.regraMaiusculaMinuscula,
    test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v),
  },
  {
    id: 'digit',
    label: CONFIG_TEXTS.segurancaSenha.regraNumero,
    test: (v) => /\d/.test(v),
  },
  {
    id: 'symbol',
    label: CONFIG_TEXTS.segurancaSenha.regraSimbolo,
    test: (v) => /[!-/:-@[-`{-~]/.test(v),
  },
];

const LABELS_FORCA_SENHA = [
  'Vazia',
  CONFIG_TEXTS.segurancaSenha.forcaFraca,
  CONFIG_TEXTS.segurancaSenha.forcaMedia,
  CONFIG_TEXTS.segurancaSenha.forcaForte,
  CONFIG_TEXTS.segurancaSenha.forcaExcelente,
] as const;

export function SegurancaSenhaView({
  onVoltar,
  onSairTodosDispositivos,
  onSegurancaAtualizada,
}: SegurancaSenhaViewProps) {
  const { signOut } = useAuth();
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [painel, setPainel] = useState<PainelSegurancaResponse | null>(null);

  // Estado da seção 1: Alterar Senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [erroFormSenha, setErroFormSenha] = useState<string | null>(null);

  // Estado da seção 2: 2FA TOTP (Enroll / Verify / Unenroll / Recuperação)
  const [iniciandoMfa, setIniciandoMfa] = useState(false);
  const [dadosEnrollMfa, setDadosEnrollMfa] = useState<{
    factorId: string;
    qrCodeDataUri: string;
    secretManual: string;
  } | null>(null);
  const [codigoTotp, setCodigoTotp] = useState('');
  const [confirmandoMfa, setConfirmandoMfa] = useState(false);
  const [erroMfa, setErroMfa] = useState<string | null>(null);
  const [chaveCopiada, setChaveCopiada] = useState(false);

  // Desativar 2FA com FolhaReautenticar
  const [fatorParaDesativar, setFatorParaDesativar] = useState<string | null>(null);
  const [desativandoMfa, setDesativandoMfa] = useState(false);
  const [erroDesativarMfa, setErroDesativarMfa] = useState<string | null>(null);

  // Recuperação de 2FA ao Admin (Decisão D3)
  const [modalRecuperacaoVisivel, setModalRecuperacaoVisivel] = useState(false);
  const [motivoRecuperacao, setMotivoRecuperacao] = useState('');
  const [erroMotivoRecuperacao, setErroMotivoRecuperacao] = useState<string | null>(null);
  const [reauthRecuperacaoVisivel, setReauthRecuperacaoVisivel] = useState(false);
  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false);
  const [erroReauthRecuperacao, setErroReauthRecuperacao] = useState<string | null>(null);

  // Estado da seção 3: Encerrar sessão de aparelho específico
  const [sessaoParaEncerrar, setSessaoParaEncerrar] =
    useState<SessaoDispositivoItem | null>(null);
  const [encerrandoSessao, setEncerrandoSessao] = useState(false);

  // Estado da seção 5: Trava local do app no aparelho (só local)
  const [travaLocal, setTravaLocal] = useState<ConfigTravaLocalAparelho>({
    ativa: false,
    tempoBloqueio: 'imediato',
  });

  // Feedback Toast
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

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      const [resPainel, cfgTrava] = await Promise.all([
        carregarPainelSeguranca(),
        lerConfigTravaLocalAparelho(),
      ]);
      setPainel(resPainel.dados);
      setTravaLocal(cfgTrava);
      if (resPainel.doCacheOffline) {
        setOffline(true);
      }
    } catch (err) {
      setErroCarga(traduzirErroServidor(err));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const avaliacaoSenha = useMemo(
    () =>
      evaluatePasswordStrength(
        novaSenha,
        REGRAS_SENHA_FINANCEIRA,
        LABELS_FORCA_SENHA
      ),
    [novaSenha]
  );

  const todasRegrasSenhaCumpridas = useMemo(
    () =>
      avaliacaoSenha.rules.every((r) => r.met) && !avaliacaoSenha.guessable,
    [avaliacaoSenha]
  );

  // 1. Submissão de Alteração de Senha
  const handleAlterarSenha = async () => {
    if (offline) {
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: CONFIG_TEXTS.comum.offlineBloqueioEscrita,
      });
      return;
    }

    if (!senhaAtual.trim()) {
      setErroFormSenha(CONFIG_TEXTS.segurancaSenha.erroSenhaAtualVazia);
      return;
    }
    if (!todasRegrasSenhaCumpridas) {
      setErroFormSenha(CONFIG_TEXTS.segurancaSenha.erroNovaSenhaFraca);
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErroFormSenha(CONFIG_TEXTS.segurancaSenha.erroConfirmacaoDiferente);
      return;
    }
    if (novaSenha === senhaAtual) {
      setErroFormSenha(CONFIG_TEXTS.segurancaSenha.erroNovaIgualAtual);
      return;
    }

    setErroFormSenha(null);
    setSalvandoSenha(true);
    try {
      await alterarMinhaSenhaComSeguranca({
        emailConta: painel?.email_conta || '',
        senhaAtual,
        novaSenha,
      });
      // Limpa campos imediatamente (nunca reter senha em estado)
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      await carregarDados();
      onSegurancaAtualizada?.();
      setAviso({
        visivel: true,
        tipo: 'sucesso',
        mensagem: CONFIG_TEXTS.segurancaSenha.sucessoSenhaAlterada,
      });
    } catch (err) {
      setErroFormSenha(traduzirErroServidor(err));
    } finally {
      setSalvandoSenha(false);
    }
  };

  // 2. Iniciar configuração de 2FA TOTP
  const handleIniciarConfiguracao2fa = async () => {
    if (offline) {
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: CONFIG_TEXTS.comum.offlineBloqueioEscrita,
      });
      return;
    }

    setIniciandoMfa(true);
    setErroMfa(null);
    try {
      const enroll = await iniciarCadastroMfaTotp();
      setDadosEnrollMfa(enroll);
      setCodigoTotp('');
    } catch (err) {
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: traduzirErroServidor(err),
      });
    } finally {
      setIniciandoMfa(false);
    }
  };

  const handleCopiarChaveManual = async () => {
    if (!dadosEnrollMfa?.secretManual) return;
    await Clipboard.setStringAsync(dadosEnrollMfa.secretManual);
    setChaveCopiada(true);
    setTimeout(() => setChaveCopiada(false), 3000);
  };

  const handleConfirmarCodigo2fa = async () => {
    if (!dadosEnrollMfa) return;
    const limpo = codigoTotp.replace(/\D/g, '');
    if (limpo.length !== 6) {
      setErroMfa(CONFIG_TEXTS.segurancaSenha.erroCodigoTotpInvalido);
      return;
    }

    setConfirmandoMfa(true);
    setErroMfa(null);
    try {
      await confirmarAtivacaoMfaTotp({
        factorId: dadosEnrollMfa.factorId,
        codigo6Digitos: limpo,
      });
      setDadosEnrollMfa(null);
      setCodigoTotp('');
      await carregarDados();
      onSegurancaAtualizada?.();
      setAviso({
        visivel: true,
        tipo: 'sucesso',
        mensagem: CONFIG_TEXTS.segurancaSenha.sucesso2faAtivado,
      });
    } catch (err) {
      setErroMfa(traduzirErroServidor(err));
    } finally {
      setConfirmandoMfa(false);
    }
  };

  const handleConfirmarDesativar2fa = async (senhaConfirmada: string) => {
    if (!fatorParaDesativar || !painel) return;
    setDesativandoMfa(true);
    setErroDesativarMfa(null);
    try {
      await desativarMfaTotpComReautenticacao({
        emailConta: painel.email_conta,
        senhaAtual: senhaConfirmada,
        factorId: fatorParaDesativar,
      });
      setFatorParaDesativar(null);
      await carregarDados();
      onSegurancaAtualizada?.();
      setAviso({
        visivel: true,
        tipo: 'sucesso',
        mensagem: CONFIG_TEXTS.segurancaSenha.sucesso2faDesativado,
      });
    } catch (err) {
      setErroDesativarMfa(traduzirErroServidor(err));
    } finally {
      setDesativandoMfa(false);
    }
  };

  // Recuperação de 2FA ao Admin
  const handleAvancarRecuperacaoParaReauth = () => {
    if (motivoRecuperacao.trim().length < 10) {
      setErroMotivoRecuperacao(CONFIG_TEXTS.meuPerfil.solicitacaoErroMotivo);
      return;
    }
    setErroMotivoRecuperacao(null);
    setModalRecuperacaoVisivel(false);
    setErroReauthRecuperacao(null);
    setReauthRecuperacaoVisivel(true);
  };

  const handleConfirmarReauthRecuperacao = async (senhaConfirmada: string) => {
    if (!painel) return;
    setEnviandoRecuperacao(true);
    setErroReauthRecuperacao(null);
    try {
      await solicitarRecuperacao2faComReautenticacao({
        emailConta: painel.email_conta,
        senhaAtual: senhaConfirmada,
        motivo: motivoRecuperacao.trim(),
      });
      setReauthRecuperacaoVisivel(false);
      setMotivoRecuperacao('');
      await carregarDados();
      setAviso({
        visivel: true,
        tipo: 'sucesso',
        mensagem: CONFIG_TEXTS.segurancaSenha.sucessoRecuperacao2fa,
      });
    } catch (err) {
      setErroReauthRecuperacao(traduzirErroServidor(err));
    } finally {
      setEnviandoRecuperacao(false);
    }
  };

  // 3. Encerrar sessão de aparelho
  const handleConfirmarEncerrarSessao = async () => {
    if (!sessaoParaEncerrar) return;
    setEncerrandoSessao(true);
    try {
      await encerrarAparelhoSessao(sessaoParaEncerrar.session_id);
      setSessaoParaEncerrar(null);
      await carregarDados();
      setAviso({
        visivel: true,
        tipo: 'sucesso',
        mensagem: CONFIG_TEXTS.segurancaSenha.sucessoAparelhoEncerrado,
      });
    } catch (err) {
      setSessaoParaEncerrar(null);
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: traduzirErroServidor(err),
      });
    } finally {
      setEncerrandoSessao(false);
    }
  };

  // 5. Atualizar preferência de trava local do aparelho (só local, com expo-local-authentication)
  const handleAtualizarTravaLocal = async (
    novaCfg: ConfigTravaLocalAparelho
  ) => {
    if (Platform.OS !== 'web' && novaCfg.ativa !== travaLocal.ativa) {
      try {
        const temHardware = await LocalAuthentication.hasHardwareAsync();
        const temBiometriaCadastrada = await LocalAuthentication.isEnrolledAsync();
        if (!temHardware || !temBiometriaCadastrada) {
          setAviso({
            visivel: true,
            tipo: 'info',
            mensagem:
              'Configure uma biometria (Face ID / impressão digital) ou bloqueio de tela nas configurações do seu aparelho para usar a trava automática.',
          });
          return;
        }
        const resultadoAuth = await LocalAuthentication.authenticateAsync({
          promptMessage: novaCfg.ativa
            ? 'Confirme sua biometria ou PIN para ativar a trava do app'
            : 'Confirme sua biometria ou PIN para desativar a trava do app',
          fallbackLabel: 'Usar PIN do aparelho',
          cancelLabel: 'Cancelar',
        });
        if (!resultadoAuth.success) {
          return;
        }
      } catch {
        // fallback seguro
      }
    }

    setTravaLocal(novaCfg);
    await salvarConfigTravaLocalAparelho(novaCfg);
    setAviso({
      visivel: true,
      tipo: 'sucesso',
      mensagem: CONFIG_TEXTS.segurancaSenha.travaLocalSalvaAviso,
    });
  };

  const fatorVerificado = useMemo(
    () => painel?.mfa.fatores.find((f) => f.status === 'verified') || null,
    [painel]
  );

  return (
    <View style={styles.container}>
      {/* Barra superior com botão voltar */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={onVoltar}
          accessibilityRole="button"
          accessibilityLabel={CONFIG_TEXTS.comum.voltar}
        >
          <ArrowLeft size={20} color={C.textPrimary} />
          <Text style={styles.botaoVoltarTexto}>{CONFIG_TEXTS.comum.voltar}</Text>
        </TouchableOpacity>
        <Text style={styles.topHeaderTitulo}>
          {CONFIG_TEXTS.segurancaSenha.titulo}
        </Text>
        <View style={styles.topHeaderSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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

        <Aviso
          visivel={aviso.visivel}
          tipo={aviso.tipo}
          mensagem={aviso.mensagem}
          onFechar={() => setAviso((p) => ({ ...p, visivel: false }))}
        />

        {carregando ? (
          <EsqueletoLista linhas={6} />
        ) : erroCarga || !painel ? (
          <View style={{ alignItems: 'center' }}>
            <EstadoErro
              mensagem={erroCarga || CONFIG_TEXTS.comum.erroGenericoServidor}
              onTentarDeNovo={carregarDados}
            />
            {erroCarga?.toLowerCase().includes('sessão') && (
              <TouchableOpacity
                style={[
                  styles.botaoPrimario,
                  { marginTop: S.md, alignSelf: 'center', paddingHorizontal: S.xl },
                ]}
                onPress={() => signOut()}
                accessibilityRole="button"
                accessibilityLabel="Fazer login novamente"
              >
                <Text style={styles.botaoPrimarioTexto}>Fazer login novamente</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {/* ─── 1. ALTERAR SENHA DE ACESSO ───────────────────────────── */}
            <SecaoConfig
              titulo={CONFIG_TEXTS.segurancaSenha.secaoSenhaTitulo}
              descricao={CONFIG_TEXTS.segurancaSenha.secaoSenhaDescricao}
            >
              <View style={styles.cardPadding}>
                {/* Senha atual */}
                <View style={styles.campoGrupo}>
                  <Text style={styles.campoLabel}>
                    {CONFIG_TEXTS.segurancaSenha.senhaAtualLabel}
                  </Text>
                  <View style={styles.inputSenhaRow}>
                    <KeyRound size={17} color={C.textSecondary} />
                    <TextInput
                      style={styles.inputSenhaFlex}
                      value={senhaAtual}
                      onChangeText={(t) => {
                        setSenhaAtual(t);
                        if (erroFormSenha) setErroFormSenha(null);
                      }}
                      placeholder={
                        CONFIG_TEXTS.segurancaSenha.senhaAtualPlaceholder
                      }
                      placeholderTextColor={C.textTertiary}
                      secureTextEntry={!mostrarSenhaAtual}
                      autoCapitalize="none"
                      editable={!offline && !salvandoSenha}
                      accessibilityLabel={
                        CONFIG_TEXTS.segurancaSenha.senhaAtualLabel
                      }
                    />
                    <TouchableOpacity
                      onPress={() => setMostrarSenhaAtual((v) => !v)}
                      style={styles.iconeOlhoBtn}
                      accessibilityRole="button"
                      accessibilityLabel={
                        mostrarSenhaAtual ? 'Ocultar senha' : 'Mostrar senha'
                      }
                    >
                      {mostrarSenhaAtual ? (
                        <EyeOff size={18} color={C.textSecondary} />
                      ) : (
                        <Eye size={18} color={C.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Nova senha */}
                <View style={styles.campoGrupo}>
                  <Text style={styles.campoLabel}>
                    {CONFIG_TEXTS.segurancaSenha.novaSenhaLabel}
                  </Text>
                  <View style={styles.inputSenhaRow}>
                    <Lock size={17} color={C.textSecondary} />
                    <TextInput
                      style={styles.inputSenhaFlex}
                      value={novaSenha}
                      onChangeText={(t) => {
                        setNovaSenha(t);
                        if (erroFormSenha) setErroFormSenha(null);
                      }}
                      placeholder={
                        CONFIG_TEXTS.segurancaSenha.novaSenhaPlaceholder
                      }
                      placeholderTextColor={C.textTertiary}
                      secureTextEntry={!mostrarNovaSenha}
                      autoCapitalize="none"
                      editable={!offline && !salvandoSenha}
                      accessibilityLabel={
                        CONFIG_TEXTS.segurancaSenha.novaSenhaLabel
                      }
                    />
                    <TouchableOpacity
                      onPress={() => setMostrarNovaSenha((v) => !v)}
                      style={styles.iconeOlhoBtn}
                      accessibilityRole="button"
                      accessibilityLabel={
                        mostrarNovaSenha ? 'Ocultar senha' : 'Mostrar senha'
                      }
                    >
                      {mostrarNovaSenha ? (
                        <EyeOff size={18} color={C.textSecondary} />
                      ) : (
                        <Eye size={18} color={C.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Medidor de força com regras claras */}
                  <PasswordStrength
                    value={novaSenha}
                    rules={REGRAS_SENHA_FINANCEIRA}
                    labels={LABELS_FORCA_SENHA}
                    showRules
                  />
                </View>

                {/* Confirmar nova senha */}
                <View style={styles.campoGrupo}>
                  <Text style={styles.campoLabel}>
                    {CONFIG_TEXTS.segurancaSenha.confirmarSenhaLabel}
                  </Text>
                  <View style={styles.inputSenhaRow}>
                    <Lock size={17} color={C.textSecondary} />
                    <TextInput
                      style={styles.inputSenhaFlex}
                      value={confirmarSenha}
                      onChangeText={(t) => {
                        setConfirmarSenha(t);
                        if (erroFormSenha) setErroFormSenha(null);
                      }}
                      placeholder={
                        CONFIG_TEXTS.segurancaSenha.confirmarSenhaPlaceholder
                      }
                      placeholderTextColor={C.textTertiary}
                      secureTextEntry={!mostrarNovaSenha}
                      autoCapitalize="none"
                      editable={!offline && !salvandoSenha}
                      accessibilityLabel={
                        CONFIG_TEXTS.segurancaSenha.confirmarSenhaLabel
                      }
                    />
                  </View>
                </View>

                {!!erroFormSenha && (
                  <Text style={styles.erroTexto}>{erroFormSenha}</Text>
                )}

                <TouchableOpacity
                  style={[
                    styles.botaoPrimario,
                    (!senhaAtual ||
                      !todasRegrasSenhaCumpridas ||
                      novaSenha !== confirmarSenha ||
                      salvandoSenha ||
                      offline) &&
                      styles.botaoDesabilitado,
                  ]}
                  onPress={handleAlterarSenha}
                  disabled={
                    !senhaAtual ||
                    !todasRegrasSenhaCumpridas ||
                    novaSenha !== confirmarSenha ||
                    salvandoSenha ||
                    offline
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    CONFIG_TEXTS.segurancaSenha.botaoAlterarSenha
                  }
                >
                  {salvandoSenha ? (
                    <ActivityIndicator size="small" color={C.textInverse} />
                  ) : (
                    <Text style={styles.botaoPrimarioTexto}>
                      {CONFIG_TEXTS.segurancaSenha.botaoAlterarSenha}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </SecaoConfig>

            {/* ─── 2. VERIFICAÇÃO EM DUAS ETAPAS (TOTP, APP AUTENTICADOR) ─ */}
            <SecaoConfig
              titulo={CONFIG_TEXTS.segurancaSenha.secaoMfaTitulo}
              descricao={CONFIG_TEXTS.segurancaSenha.secaoMfaDescricao}
            >
              <View style={styles.cardPadding}>
                <View style={styles.mfaStatusHeaderRow}>
                  <View style={styles.mfaStatusLeft}>
                    <ShieldCheck
                      size={20}
                      color={painel.mfa.ativo ? C.primary : C.warning}
                    />
                    <Text style={styles.mfaStatusTitulo}>
                      {painel.mfa.ativo
                        ? CONFIG_TEXTS.segurancaSenha.selo2faAtivo
                        : painel.mfa.exigido_pelo_servidor
                        ? CONFIG_TEXTS.segurancaSenha.selo2faObrigatorio
                        : CONFIG_TEXTS.segurancaSenha.selo2faRecomendado}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badgeStatusMfa,
                      painel.mfa.ativo
                        ? styles.badgeStatusAtivo
                        : styles.badgeStatusAlerta,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeStatusMfaTexto,
                        painel.mfa.ativo
                          ? styles.badgeTextoVerde
                          : styles.badgeTextoAlerta,
                      ]}
                    >
                      {painel.mfa.ativo ? 'Ativa' : 'Desligada'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.mfaExplicacaoTexto}>
                  {painel.mfa.ativo
                    ? CONFIG_TEXTS.segurancaSenha.mfaExplicacaoAtivo
                    : CONFIG_TEXTS.segurancaSenha.mfaExplicacaoInativo}
                </Text>

                {/* Se já está ativo: mostra o fator verificado e opção de desativar com reautenticação */}
                {painel.mfa.ativo && fatorVerificado ? (
                  <View style={styles.fatorVerificadoCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fatorNomeTexto}>
                        {fatorVerificado.friendly_name}
                      </Text>
                      <Text style={styles.fatorMetaTexto}>
                        Vinculado em {fatorVerificado.criado_em_fmt}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.botaoPerigoPequeno}
                      onPress={() => {
                        setErroDesativarMfa(null);
                        setFatorParaDesativar(fatorVerificado.id);
                      }}
                      disabled={offline}
                      accessibilityRole="button"
                      accessibilityLabel={
                        CONFIG_TEXTS.segurancaSenha.botaoDesativar2fa
                      }
                    >
                      <Text style={styles.botaoPerigoPequenoTexto}>
                        {CONFIG_TEXTS.segurancaSenha.botaoDesativar2fa}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : !dadosEnrollMfa ? (
                  <TouchableOpacity
                    style={[
                      styles.botaoPrimario,
                      (iniciandoMfa || offline) && styles.botaoDesabilitado,
                    ]}
                    onPress={handleIniciarConfiguracao2fa}
                    disabled={iniciandoMfa || offline}
                    accessibilityRole="button"
                    accessibilityLabel={
                      CONFIG_TEXTS.segurancaSenha.botaoConfigurar2fa
                    }
                  >
                    {iniciandoMfa ? (
                      <ActivityIndicator size="small" color={C.textInverse} />
                    ) : (
                      <Text style={styles.botaoPrimarioTexto}>
                        {CONFIG_TEXTS.segurancaSenha.botaoConfigurar2fa}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  /* Fluxo passo a passo de ativação TOTP: QR Code + Chave Manual + Primeiro Código */
                  <View style={styles.enrollBox}>
                    <Text style={styles.enrollPassoTitulo}>
                      {CONFIG_TEXTS.segurancaSenha.passo1QrTitulo}
                    </Text>
                    <Text style={styles.enrollPassoSub}>
                      {CONFIG_TEXTS.segurancaSenha.passo1QrSubtitulo}
                    </Text>

                    <View style={styles.qrWrapper}>
                      <Image
                        source={{ uri: dadosEnrollMfa.qrCodeDataUri }}
                        style={styles.qrImage}
                        contentFit="contain"
                        accessibilityLabel="QR Code para aplicativo autenticador 2FA"
                      />
                    </View>

                    <Text style={styles.enrollPassoSub}>
                      {CONFIG_TEXTS.segurancaSenha.passo2ChaveManualTitulo}
                    </Text>
                    <View style={styles.chaveManualBox}>
                      <Text selectable style={styles.chaveManualTexto}>
                        {dadosEnrollMfa.secretManual}
                      </Text>
                      <TouchableOpacity
                        style={styles.botaoCopiarChave}
                        onPress={handleCopiarChaveManual}
                        accessibilityRole="button"
                        accessibilityLabel={
                          CONFIG_TEXTS.segurancaSenha.botaoCopiarChave
                        }
                      >
                        {chaveCopiada ? (
                          <Check size={16} color={C.primary} />
                        ) : (
                          <Copy size={16} color={C.primary} />
                        )}
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.enrollPassoTitulo}>
                      {CONFIG_TEXTS.segurancaSenha.passo3CodigoTitulo}
                    </Text>
                    <TextInput
                      style={styles.inputCodigoTotp}
                      value={codigoTotp}
                      onChangeText={(t) => {
                        setCodigoTotp(t.replace(/\D/g, '').slice(0, 6));
                        if (erroMfa) setErroMfa(null);
                      }}
                      placeholder={
                        CONFIG_TEXTS.segurancaSenha.codigoTotpPlaceholder
                      }
                      placeholderTextColor={C.textTertiary}
                      keyboardType="numeric"
                      maxLength={6}
                      accessibilityLabel="Código de 6 dígitos do autenticador"
                    />

                    {!!erroMfa && (
                      <Text style={styles.erroTexto}>{erroMfa}</Text>
                    )}

                    <View style={styles.enrollBotoesRow}>
                      <TouchableOpacity
                        style={styles.botaoSecundario}
                        onPress={() => setDadosEnrollMfa(null)}
                        disabled={confirmandoMfa}
                      >
                        <Text style={styles.botaoSecundarioTexto}>
                          {CONFIG_TEXTS.comum.cancelar}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.botaoPrimarioFlex,
                          (codigoTotp.length !== 6 || confirmandoMfa) &&
                            styles.botaoDesabilitado,
                        ]}
                        onPress={handleConfirmarCodigo2fa}
                        disabled={codigoTotp.length !== 6 || confirmandoMfa}
                        accessibilityRole="button"
                        accessibilityLabel={
                          CONFIG_TEXTS.segurancaSenha.botaoConfirmarAtivacao2fa
                        }
                      >
                        {confirmandoMfa ? (
                          <ActivityIndicator
                            size="small"
                            color={C.textInverse}
                          />
                        ) : (
                          <Text style={styles.botaoPrimarioTexto}>
                            {
                              CONFIG_TEXTS.segurancaSenha
                                .botaoConfirmarAtivacao2fa
                            }
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Recuperação de 2FA (Mesa de Conferência — Decisão D3) */}
                <View style={styles.recuperacaoCard}>
                  <View style={styles.recuperacaoHeaderRow}>
                    <HelpCircle size={16} color={C.primary} />
                    <Text style={styles.recuperacaoTitulo}>
                      {CONFIG_TEXTS.segurancaSenha.recuperacao2faCardTitulo}
                    </Text>
                  </View>
                  <Text style={styles.recuperacaoSub}>
                    {CONFIG_TEXTS.segurancaSenha.recuperacao2faCardSubtitulo}
                  </Text>

                  {painel.mfa.recuperacao_pendente ? (
                    <View style={styles.recuperacaoPendenteBadge}>
                      <Text style={styles.recuperacaoPendenteTexto}>
                        Solicitação em análise pela Mesa de Conferência (enviada
                        em {painel.mfa.recuperacao_pendente.criado_em_fmt})
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.botaoOutlineVerde}
                      onPress={() => {
                        setMotivoRecuperacao('');
                        setErroMotivoRecuperacao(null);
                        setModalRecuperacaoVisivel(true);
                      }}
                      disabled={offline}
                      accessibilityRole="button"
                      accessibilityLabel={
                        CONFIG_TEXTS.segurancaSenha
                          .botaoSolicitarRecuperacao2fa
                      }
                    >
                      <Text style={styles.botaoOutlineVerdeTexto}>
                        {
                          CONFIG_TEXTS.segurancaSenha
                            .botaoSolicitarRecuperacao2fa
                        }
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </SecaoConfig>

            {/* ─── 3. SESSÕES E APARELHOS CONECTADOS ────────────────────── */}
            <SecaoConfig
              titulo={CONFIG_TEXTS.segurancaSenha.secaoSessoesTitulo}
              descricao={CONFIG_TEXTS.segurancaSenha.secaoSessoesDescricao}
            >
              <View style={styles.cardPadding}>
                {painel.sessoes_ativas.map((sess) => (
                  <View key={sess.session_id} style={styles.sessaoItemRow}>
                    <View style={styles.sessaoIconBox}>
                      {sess.plataforma === 'ios' ||
                      sess.plataforma === 'android' ||
                      sess.plataforma === 'mobile' ? (
                        <Smartphone size={18} color={C.primary} />
                      ) : (
                        <Laptop size={18} color={C.primary} />
                      )}
                    </View>

                    <View style={styles.sessaoTextosCol}>
                      <View style={styles.sessaoTituloRow}>
                        <Text style={styles.sessaoAparelhoTexto} numberOfLines={1}>
                          {sess.aparelho}
                        </Text>
                        {sess.atual && (
                          <View style={styles.seloSessaoAtual}>
                            <Text style={styles.seloSessaoAtualTexto}>
                              {CONFIG_TEXTS.segurancaSenha.seloEsteAparelho}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.sessaoMetaTexto}>
                        Último acesso: {sess.ultimo_acesso_fmt} • Nível:{' '}
                        {sess.aal.toUpperCase()}
                      </Text>
                    </View>

                    {!sess.atual && (
                      <TouchableOpacity
                        style={styles.botaoEncerrarSessao}
                        onPress={() => setSessaoParaEncerrar(sess)}
                        disabled={offline}
                        accessibilityRole="button"
                        accessibilityLabel={`${CONFIG_TEXTS.segurancaSenha.botaoEncerrarAparelho} ${sess.aparelho}`}
                      >
                        <Text style={styles.botaoEncerrarSessaoTexto}>
                          {CONFIG_TEXTS.segurancaSenha.botaoEncerrarAparelho}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.botaoSairTodos}
                  onPress={onSairTodosDispositivos}
                  accessibilityRole="button"
                  accessibilityLabel={CONFIG_TEXTS.desconectar.botaoTodos}
                >
                  <LogOut size={16} color={C.danger} />
                  <Text style={styles.botaoSairTodosTexto}>
                    {CONFIG_TEXTS.desconectar.botaoTodos}
                  </Text>
                </TouchableOpacity>
              </View>
            </SecaoConfig>

            {/* ─── 4. TRAVA DO APP NO APARELHO (OPCIONAL, SÓ LOCAL) ────── */}
            <SecaoConfig
              titulo={CONFIG_TEXTS.segurancaSenha.secaoTravaLocalTitulo}
              descricao={CONFIG_TEXTS.segurancaSenha.secaoTravaLocalDescricao}
            >
              <Interruptor
                label={CONFIG_TEXTS.segurancaSenha.travaLocalInterruptorLabel}
                valor={travaLocal.ativa}
                onValueChange={(novo) =>
                  handleAtualizarTravaLocal({ ...travaLocal, ativa: novo })
                }
              />
              {travaLocal.ativa && (
                <View style={styles.cardPadding}>
                  <ControleSegmentado
                    label={CONFIG_TEXTS.segurancaSenha.travaLocalTempoLabel}
                    opcoes={
                      CONFIG_TEXTS.segurancaSenha.travaLocalOpcoesTempo
                    }
                    valorSelecionado={travaLocal.tempoBloqueio}
                    onSelecionar={(tempoBloqueio) =>
                      handleAtualizarTravaLocal({
                        ...travaLocal,
                        tempoBloqueio,
                      })
                    }
                  />
                </View>
              )}
            </SecaoConfig>

            {/* ─── 5. AVISOS POR E-MAIL DE EVENTOS CRÍTICOS (OBRIGATÓRIOS) ─ */}
            <SecaoConfig
              titulo={CONFIG_TEXTS.segurancaSenha.secaoAvisosEmailTitulo}
              descricao={CONFIG_TEXTS.segurancaSenha.secaoAvisosEmailDescricao}
            >
              <View style={styles.cardPadding}>
                <View style={styles.avisoEmailHeaderRow}>
                  <View style={styles.sessaoIconBox}>
                    <Mail size={18} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessaoAparelhoTexto}>
                      {painel.avisos_email.email_destino}
                    </Text>
                    <Text style={styles.sessaoMetaTexto}>
                      Senha alterada, 2FA, troca de e-mail e novos acessos
                    </Text>
                  </View>
                  <View style={styles.seloSessaoAtual}>
                    <Text style={styles.seloSessaoAtualTexto}>
                      {CONFIG_TEXTS.segurancaSenha.seloObrigatorioAtivo}
                    </Text>
                  </View>
                </View>

                {painel.avisos_email.historico.slice(0, 4).map((item) => (
                  <View key={item.id} style={styles.historicoItemRow}>
                    <Text style={styles.historicoTituloTexto}>
                      {item.assunto}
                    </Text>
                    <Text style={styles.historicoMetaTexto}>
                      {item.criado_em_fmt} • {item.dispositivo_curto}
                    </Text>
                  </View>
                ))}
              </View>
            </SecaoConfig>

            {/* ─── 6. ATIVIDADE RECENTE DE SEGURANÇA ────────────────────── */}
            <SecaoConfig
              titulo={CONFIG_TEXTS.segurancaSenha.secaoAtividadesTitulo}
              descricao={CONFIG_TEXTS.segurancaSenha.secaoAtividadesDescricao}
            >
              <View style={styles.cardPadding}>
                {painel.atividades_seguranca.map((ativ) => (
                  <View key={ativ.id} style={styles.historicoItemRow}>
                    <View style={styles.atividadeRowTop}>
                      <Activity size={14} color={C.primary} />
                      <Text style={styles.historicoTituloTexto}>
                        {ativ.tipo.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.historicoMetaTexto}>
                      {ativ.criado_em_fmt} • {ativ.dispositivo_curto}
                    </Text>
                  </View>
                ))}
              </View>
            </SecaoConfig>
          </>
        )}
      </ScrollView>

      {/* Folha de Reautenticação para Desativar 2FA */}
      <FolhaReautenticar
        visivel={!!fatorParaDesativar}
        titulo={CONFIG_TEXTS.segurancaSenha.botaoDesativar2fa}
        subtitulo="Por segurança, confirme sua senha atual para remover o segundo fator de autenticação."
        carregando={desativandoMfa}
        erro={erroDesativarMfa}
        onConfirmarSenha={handleConfirmarDesativar2fa}
        onCancelar={() => setFatorParaDesativar(null)}
      />

      {/* Confirmação para encerrar um aparelho específico */}
      <FolhaConfirmar
        visivel={!!sessaoParaEncerrar}
        titulo={CONFIG_TEXTS.segurancaSenha.confirmarEncerrarAparelhoTitulo}
        mensagem={`${CONFIG_TEXTS.segurancaSenha.confirmarEncerrarAparelhoMsg} (${sessaoParaEncerrar?.aparelho || ''})`}
        textoConfirmar={CONFIG_TEXTS.segurancaSenha.botaoEncerrarAparelho}
        perigo
        carregando={encerrandoSessao}
        onConfirmar={handleConfirmarEncerrarSessao}
        onCancelar={() => setSessaoParaEncerrar(null)}
      />

      {/* Modal: Solicitar Recuperação de 2FA ao Admin */}
      <Modal
        visible={modalRecuperacaoVisivel}
        transparent
        animationType="fade"
        onRequestClose={() => setModalRecuperacaoVisivel(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitulo}>
                {CONFIG_TEXTS.segurancaSenha.modalRecuperacao2faTitulo}
              </Text>
              <TouchableOpacity
                onPress={() => setModalRecuperacaoVisivel(false)}
                style={styles.botaoFecharModal}
              >
                <X size={20} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitulo}>
              {CONFIG_TEXTS.segurancaSenha.modalRecuperacao2faSubtitulo}
            </Text>

            <CampoFormulario
              label={CONFIG_TEXTS.segurancaSenha.recuperacaoMotivoLabel}
              valor={motivoRecuperacao}
              onChangeText={(t) => {
                setMotivoRecuperacao(t);
                if (erroMotivoRecuperacao) setErroMotivoRecuperacao(null);
              }}
              placeholder={
                CONFIG_TEXTS.segurancaSenha.recuperacaoMotivoPlaceholder
              }
              erro={erroMotivoRecuperacao}
              multiline
              maxLength={1000}
            />

            <View style={styles.enrollBotoesRow}>
              <TouchableOpacity
                style={styles.botaoSecundario}
                onPress={() => setModalRecuperacaoVisivel(false)}
              >
                <Text style={styles.botaoSecundarioTexto}>
                  {CONFIG_TEXTS.comum.cancelar}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.botaoPrimarioFlex}
                onPress={handleAvancarRecuperacaoParaReauth}
              >
                <Text style={styles.botaoPrimarioTexto}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reautenticação para enviar solicitação de recuperação 2FA */}
      <FolhaReautenticar
        visivel={reauthRecuperacaoVisivel}
        carregando={enviandoRecuperacao}
        erro={erroReauthRecuperacao}
        onConfirmarSenha={handleConfirmarReauthRecuperacao}
        onCancelar={() => setReauthRecuperacaoVisivel(false)}
      />
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
  },
  topHeaderSpacer: {
    width: 68,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: S.xxxl * 2,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.warningBg,
    borderWidth: 1,
    borderColor: C.warning,
    borderRadius: R.sm,
    padding: S.sm,
    marginBottom: S.md,
    gap: S.sm,
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
  cardPadding: {
    padding: 16,
  },
  campoGrupo: {
    marginBottom: 16,
  },
  campoLabel: {
    fontFamily: FONT.semibold,
    fontSize: 13,
    color: C.textPrimary,
    marginBottom: 6,
  },
  inputSenhaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  inputSenhaFlex: {
    flex: 1,
    minHeight: 44,
    fontFamily: FONT.regular,
    fontSize: 15,
    color: C.textPrimary,
  },
  iconeOlhoBtn: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  erroTexto: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: C.danger,
    marginBottom: S.sm,
  },
  botaoPrimario: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#2E5A36',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: S.md,
  },
  botaoPrimarioFlex: {
    flex: 1,
    minHeight: 46,
    borderRadius: R.sm,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: S.md,
  },
  botaoDesabilitado: {
    opacity: 0.45,
  },
  botaoPrimarioTexto: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: C.textInverse,
  },
  botaoSecundario: {
    minHeight: 46,
    paddingHorizontal: S.md,
    borderRadius: R.sm,
    backgroundColor: C.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoSecundarioTexto: {
    fontFamily: FONT.semibold,
    fontSize: 13,
    color: C.textPrimary,
  },
  mfaStatusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S.xs,
  },
  mfaStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
  },
  mfaStatusTitulo: {
    fontFamily: FONT.bold,
    fontSize: 15,
    color: C.textPrimary,
  },
  badgeStatusMfa: {
    paddingHorizontal: S.xs,
    paddingVertical: 3,
    borderRadius: R.pill,
  },
  badgeStatusAtivo: {
    backgroundColor: C.primaryBgLight,
  },
  badgeStatusAlerta: {
    backgroundColor: C.warningBg,
  },
  badgeStatusMfaTexto: {
    fontFamily: FONT.semibold,
    fontSize: 11,
  },
  badgeTextoVerde: {
    color: C.primary,
  },
  badgeTextoAlerta: {
    color: C.warning,
  },
  mfaExplicacaoTexto: {
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
    color: C.textSecondary,
    marginBottom: S.md,
  },
  fatorVerificadoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg0,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.divider,
    padding: S.sm,
    marginBottom: S.md,
    gap: S.sm,
  },
  fatorNomeTexto: {
    fontFamily: FONT.semibold,
    fontSize: 14,
    color: C.textPrimary,
  },
  fatorMetaTexto: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },
  botaoPerigoPequeno: {
    minHeight: 38,
    paddingHorizontal: S.sm,
    borderRadius: R.xs,
    backgroundColor: C.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoPerigoPequenoTexto: {
    fontFamily: FONT.semibold,
    fontSize: 12,
    color: C.danger,
  },
  enrollBox: {
    backgroundColor: C.bg0,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.divider,
    padding: S.md,
    marginBottom: S.md,
  },
  enrollPassoTitulo: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: C.textPrimary,
    marginBottom: 4,
  },
  enrollPassoSub: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: C.textSecondary,
    marginBottom: S.sm,
  },
  qrWrapper: {
    alignSelf: 'center',
    width: 184,
    height: 184,
    backgroundColor: C.bg1,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.divider,
    padding: S.xs,
    marginBottom: S.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: 164,
    height: 164,
  },
  chaveManualBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg1,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.divider,
    paddingHorizontal: S.sm,
    paddingVertical: S.xs,
    marginBottom: S.md,
    gap: S.xs,
  },
  chaveManualTexto: {
    flex: 1,
    fontFamily: FONT.bold,
    fontSize: 13,
    letterSpacing: 1,
    color: C.textPrimary,
  },
  botaoCopiarChave: {
    minWidth: 38,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputCodigoTotp: {
    minHeight: 50,
    backgroundColor: C.bg1,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.primary,
    fontFamily: FONT.bold,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
    color: C.textPrimary,
    marginBottom: S.md,
  },
  enrollBotoesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
  },
  recuperacaoCard: {
    marginTop: S.sm,
    paddingTop: S.md,
    borderTopWidth: 1,
    borderTopColor: C.divider,
  },
  recuperacaoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
    marginBottom: 4,
  },
  recuperacaoTitulo: {
    fontFamily: FONT.semibold,
    fontSize: 13,
    color: C.textPrimary,
  },
  recuperacaoSub: {
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: C.textSecondary,
    marginBottom: S.sm,
  },
  recuperacaoPendenteBadge: {
    backgroundColor: C.warningBg,
    borderRadius: R.sm,
    padding: S.sm,
  },
  recuperacaoPendenteTexto: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: C.warning,
  },
  botaoOutlineVerde: {
    minHeight: 42,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.primary,
    backgroundColor: C.primaryBgLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: S.md,
  },
  botaoOutlineVerdeTexto: {
    fontFamily: FONT.semibold,
    fontSize: 13,
    color: C.primary,
  },
  sessaoItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: S.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    gap: S.sm,
  },
  sessaoIconBox: {
    width: 38,
    height: 38,
    borderRadius: R.sm,
    backgroundColor: C.primaryBgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessaoTextosCol: {
    flex: 1,
  },
  sessaoTituloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: S.xs,
  },
  sessaoAparelhoTexto: {
    fontFamily: FONT.semibold,
    fontSize: 14,
    color: C.textPrimary,
  },
  seloSessaoAtual: {
    backgroundColor: C.primaryBgLight,
    paddingHorizontal: S.xs,
    paddingVertical: 2,
    borderRadius: R.pill,
  },
  seloSessaoAtualTexto: {
    fontFamily: FONT.semibold,
    fontSize: 10,
    color: C.primary,
  },
  sessaoMetaTexto: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },
  botaoEncerrarSessao: {
    minHeight: 36,
    paddingHorizontal: S.sm,
    borderRadius: R.xs,
    backgroundColor: C.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoEncerrarSessaoTexto: {
    fontFamily: FONT.semibold,
    fontSize: 12,
    color: C.danger,
  },
  botaoSairTodos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.danger,
    backgroundColor: C.dangerBg,
    marginTop: S.md,
    gap: S.xs,
  },
  botaoSairTodosTexto: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: C.danger,
  },
  avisoEmailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: S.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    marginBottom: S.xs,
    gap: S.sm,
  },
  historicoItemRow: {
    paddingVertical: S.xs,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  atividadeRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xxs,
  },
  historicoTituloTexto: {
    fontFamily: FONT.semibold,
    fontSize: 12,
    color: C.textPrimary,
  },
  historicoMetaTexto: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: C.textSecondary,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(19, 40, 23, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: S.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: C.bg1,
    borderRadius: R.lg,
    padding: S.lg,
    ...SH.md,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S.xs,
  },
  modalTitulo: {
    fontFamily: FONT.bold,
    fontSize: 17,
    color: C.textPrimary,
  },
  botaoFecharModal: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubtitulo: {
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
    color: C.textSecondary,
    marginBottom: S.md,
  },
});
