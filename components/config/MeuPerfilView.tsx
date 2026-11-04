import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import NetInfo from '@react-native-community/netinfo';
import {
  ArrowLeft,
  Camera,
  Trash2,
  ShieldCheck,
  FileCheck,
  Mail,
  Lock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  WifiOff,
  FileEdit,
  Eye,
  X,
} from 'lucide-react-native';
import { C, R, S, SH, FONT } from '../../constants/theme';
import { CONFIG_TEXTS, traduzirErroServidor } from '../../constants/configTexts';
import {
  SecaoConfig,
  CampoFormulario,
  ControleSegmentado,
  FolhaConfirmar,
  FolhaReautenticar,
  EstadoErro,
  EsqueletoLista,
  Aviso,
} from './ConfigComponents';
import {
  carregarMeuPerfilCompleto,
  salvarMeuPerfilEditavel,
  enviarFotoAvatarSegura,
  enviarSolicitacaoAlteracaoCadastro,
  solicitarTrocaEmailComReautenticacao,
  type MeuPerfilCompletoResponse,
} from '../../lib/condoConfigApi';

export interface MeuPerfilViewProps {
  onVoltar: () => void;
  onPerfilAtualizado?: () => void;
}

function formatarTelefoneBrMask(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (digitos.length === 0) return '';
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7, 11)}`;
}

export function MeuPerfilView({ onVoltar, onPerfilAtualizado }: MeuPerfilViewProps) {
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [dadosServidor, setDadosServidor] = useState<MeuPerfilCompletoResponse | null>(null);

  // Estado dos campos editáveis
  const [nomeExibicao, setNomeExibicao] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cargo, setCargo] = useState('');
  const [bio, setBio] = useState('');
  const [preferenciaContato, setPreferenciaContato] = useState<
    'whatsapp' | 'chat_app' | 'email' | 'telefone'
  >('whatsapp');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [abaPreview, setAbaPreview] = useState<'prestador' | 'equipe'>('prestador');

  // Erros de validação ao sair do campo (onBlur)
  const [errosCampos, setErrosCampos] = useState<{
    nomeExibicao?: string | null;
    telefone?: string | null;
    cargo?: string | null;
    bio?: string | null;
  }>({});

  // Estados de ação
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [confirmarRemoverFoto, setConfirmarRemoverFoto] = useState(false);
  const [confirmarSaidaSemSalvar, setConfirmarSaidaSemSalvar] = useState(false);
  const [aviso, setAviso] = useState<{
    visivel: boolean;
    tipo: 'sucesso' | 'erro' | 'info';
    mensagem: string;
  }>({ visivel: false, tipo: 'sucesso', mensagem: '' });

  // Modal de troca de e-mail com reautenticação
  const [modalEmailVisivel, setModalEmailVisivel] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [erroNovoEmail, setErroNovoEmail] = useState<string | null>(null);
  const [folhaReauthEmailVisivel, setFolhaReauthEmailVisivel] = useState(false);
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const [erroReauthEmail, setErroReauthEmail] = useState<string | null>(null);

  // Modal de Solicitar Alteração de Dados Verificados
  const [modalSolicitacaoVisivel, setModalSolicitacaoVisivel] = useState(false);
  const [campoSolicitado, setCampoSolicitado] = useState<
    'ata_mandato' | 'nome_completo' | 'documento_identidade' | 'cpf'
  >('ata_mandato');
  const [valorProposto, setValorProposto] = useState('');
  const [motivoSolicitacao, setMotivoSolicitacao] = useState('');
  const [anexoSolicitacao, setAnexoSolicitacao] = useState<{
    nome: string;
    tipo: string;
  } | null>(null);
  const [erroMotivoSolicitacao, setErroMotivoSolicitacao] = useState<string | null>(null);
  const [enviandoSolicitacao, setEnviandoSolicitacao] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
    });
    return () => unsub();
  }, []);

  const sincronizarEstadoForm = useCallback((perfil: MeuPerfilCompletoResponse) => {
    setDadosServidor(perfil);
    setNomeExibicao(perfil.editaveis.nome_exibicao || '');
    setTelefone(perfil.editaveis.telefone || '');
    setCargo(perfil.editaveis.cargo || '');
    setBio(perfil.editaveis.bio || '');
    setPreferenciaContato(perfil.editaveis.preferencia_contato || 'whatsapp');
    setFotoUrl(perfil.editaveis.foto_url || null);
    setErrosCampos({});
  }, []);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      const res = await carregarMeuPerfilCompleto();
      sincronizarEstadoForm(res.dados);
      if (res.doCacheOffline) {
        setOffline(true);
      }
    } catch (err) {
      setErroCarga(traduzirErroServidor(err));
    } finally {
      setCarregando(false);
    }
  }, [sincronizarEstadoForm]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Verifica se algo mudou em relação aos dados salvos no servidor
  const formSujo = useMemo(() => {
    if (!dadosServidor) return false;
    const orig = dadosServidor.editaveis;
    return (
      nomeExibicao.trim() !== (orig.nome_exibicao || '').trim() ||
      telefone.trim() !== (orig.telefone || '').trim() ||
      cargo.trim() !== (orig.cargo || '').trim() ||
      bio.trim() !== (orig.bio || '').trim() ||
      preferenciaContato !== (orig.preferencia_contato || 'whatsapp')
    );
  }, [dadosServidor, nomeExibicao, telefone, cargo, bio, preferenciaContato]);

  // Validações individuais onBlur
  const validarNomeExibicao = useCallback((): boolean => {
    const v = nomeExibicao.trim();
    if (v.length < 2 || v.length > 80 || /<[^>]*>/i.test(v)) {
      setErrosCampos((prev) => ({
        ...prev,
        nomeExibicao: CONFIG_TEXTS.meuPerfil.nomeExibicaoErro,
      }));
      return false;
    }
    setErrosCampos((prev) => ({ ...prev, nomeExibicao: null }));
    return true;
  }, [nomeExibicao]);

  const validarTelefone = useCallback((): boolean => {
    const v = telefone.trim();
    if (!v) {
      setErrosCampos((prev) => ({ ...prev, telefone: null }));
      return true;
    }
    const digitos = v.replace(/\D/g, '');
    if (digitos.length !== 10 && digitos.length !== 11) {
      setErrosCampos((prev) => ({
        ...prev,
        telefone: CONFIG_TEXTS.meuPerfil.telefoneErro,
      }));
      return false;
    }
    setErrosCampos((prev) => ({ ...prev, telefone: null }));
    return true;
  }, [telefone]);

  const validarCargo = useCallback((): boolean => {
    if (cargo.trim().length > 80 || /<[^>]*>/i.test(cargo)) {
      setErrosCampos((prev) => ({
        ...prev,
        cargo: CONFIG_TEXTS.meuPerfil.cargoErro,
      }));
      return false;
    }
    setErrosCampos((prev) => ({ ...prev, cargo: null }));
    return true;
  }, [cargo]);

  const validarBio = useCallback((): boolean => {
    if (bio.trim().length > 280 || /<[^>]*>/i.test(bio)) {
      setErrosCampos((prev) => ({
        ...prev,
        bio: CONFIG_TEXTS.meuPerfil.bioErro,
      }));
      return false;
    }
    setErrosCampos((prev) => ({ ...prev, bio: null }));
    return true;
  }, [bio]);

  const handleTentativaVoltar = () => {
    if (formSujo) {
      setConfirmarSaidaSemSalvar(true);
    } else {
      onVoltar();
    }
  };

  const handleSalvarPerfil = async () => {
    if (offline) {
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: CONFIG_TEXTS.comum.offlineBloqueioEscrita,
      });
      return;
    }

    const okNome = validarNomeExibicao();
    const okTel = validarTelefone();
    const okCargo = validarCargo();
    const okBio = validarBio();
    if (!okNome || !okTel || !okCargo || !okBio) return;

    setSalvando(true);
    setAviso({ visivel: false, tipo: 'sucesso', mensagem: '' });
    try {
      const atualizado = await salvarMeuPerfilEditavel({
        nome_exibicao: nomeExibicao.trim(),
        telefone: telefone.trim(),
        cargo: cargo.trim(),
        bio: bio.trim(),
        preferencia_contato: preferenciaContato,
      });
      sincronizarEstadoForm(atualizado);
      onPerfilAtualizado?.();
      setAviso({
        visivel: true,
        tipo: 'sucesso',
        mensagem: CONFIG_TEXTS.meuPerfil.salvarSucesso,
      });
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

  // Escolha de foto com recorte 1:1 (circular na UI) e remoção automática de EXIF (exif: false)
  const handleTrocarFoto = async () => {
    if (offline) {
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: CONFIG_TEXTS.comum.offlineBloqueioEscrita,
      });
      return;
    }

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted && Platform.OS !== 'web') {
        setAviso({
          visivel: true,
          tipo: 'erro',
          mensagem: 'Permita o acesso às fotos nas configurações do aparelho para escolher seu avatar.',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.78, // Comprime no aparelho mantendo nitidez
        base64: true,
        exif: false, // Remove metadados EXIF / localização (Regra B8 / Módulo 1)
      });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        setAviso({
          visivel: true,
          tipo: 'erro',
          mensagem: CONFIG_TEXTS.meuPerfil.fotoErroTamanho,
        });
        return;
      }

      if (!asset.base64) {
        setAviso({
          visivel: true,
          tipo: 'erro',
          mensagem: 'Não foi possível processar a imagem selecionada.',
        });
        return;
      }

      setEnviandoFoto(true);
      const novaUrl = await enviarFotoAvatarSegura({
        base64Data: asset.base64,
        mimeType: asset.mimeType || 'image/jpeg',
        fileSize: asset.fileSize,
      });

      const atualizado = await salvarMeuPerfilEditavel({
        foto_url: novaUrl,
      });
      sincronizarEstadoForm(atualizado);
      onPerfilAtualizado?.();
      setAviso({
        visivel: true,
        tipo: 'sucesso',
        mensagem: CONFIG_TEXTS.meuPerfil.fotoSucesso,
      });
    } catch (err) {
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: traduzirErroServidor(err),
      });
    } finally {
      setEnviandoFoto(false);
    }
  };

  const handleConfirmarRemoverFoto = async () => {
    setConfirmarRemoverFoto(false);
    if (offline) {
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: CONFIG_TEXTS.comum.offlineBloqueioEscrita,
      });
      return;
    }

    setEnviandoFoto(true);
    try {
      const atualizado = await salvarMeuPerfilEditavel({
        remover_foto: true,
      });
      sincronizarEstadoForm(atualizado);
      onPerfilAtualizado?.();
      setAviso({
        visivel: true,
        tipo: 'sucesso',
        mensagem: CONFIG_TEXTS.meuPerfil.fotoRemovidaSucesso,
      });
    } catch (err) {
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: traduzirErroServidor(err),
      });
    } finally {
      setEnviandoFoto(false);
    }
  };

  // Fluxo de troca de e-mail com reautenticação
  const handleAvancarParaReauthEmail = () => {
    const emailAtual = dadosServidor?.email_info.email_atual || '';
    const limpo = novoEmail.trim().toLowerCase();
    if (!limpo.includes('@') || !limpo.includes('.') || limpo === emailAtual.toLowerCase()) {
      setErroNovoEmail(CONFIG_TEXTS.meuPerfil.emailErroInvalido);
      return;
    }
    setErroNovoEmail(null);
    setModalEmailVisivel(false);
    setErroReauthEmail(null);
    setFolhaReauthEmailVisivel(true);
  };

  const handleConfirmarReauthEmail = async (senhaAtual: string) => {
    if (!dadosServidor) return;
    setSalvandoEmail(true);
    setErroReauthEmail(null);
    try {
      await solicitarTrocaEmailComReautenticacao({
        emailAtual: dadosServidor.email_info.email_atual,
        novoEmail,
        senhaAtual,
      });
      setFolhaReauthEmailVisivel(false);
      setNovoEmail('');
      await carregarDados();
      setAviso({
        visivel: true,
        tipo: 'sucesso',
        mensagem: CONFIG_TEXTS.meuPerfil.emailSucessoSolicitacao,
      });
    } catch (err) {
      setErroReauthEmail(traduzirErroServidor(err));
    } finally {
      setSalvandoEmail(false);
    }
  };

  // Anexo opcional para solicitação de alteração cadastral
  const handleEscolherAnexoSolicitacao = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.75,
        exif: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setAnexoSolicitacao({
          nome: asset.fileName || `comprovante_${Date.now()}.jpg`,
          tipo: asset.mimeType || 'image/jpeg',
        });
      }
    } catch {
      // ignora cancelamento
    }
  };

  const handleEnviarSolicitacaoAlteracao = async () => {
    if (motivoSolicitacao.trim().length < 10) {
      setErroMotivoSolicitacao(CONFIG_TEXTS.meuPerfil.solicitacaoErroMotivo);
      return;
    }
    setErroMotivoSolicitacao(null);
    setEnviandoSolicitacao(true);
    try {
      await enviarSolicitacaoAlteracaoCadastro({
        campo: campoSolicitado,
        motivo: motivoSolicitacao.trim(),
        valorProposto: valorProposto.trim() || undefined,
        anexos: anexoSolicitacao ? [anexoSolicitacao] : [],
      });
      setModalSolicitacaoVisivel(false);
      setMotivoSolicitacao('');
      setValorProposto('');
      setAnexoSolicitacao(null);
      await carregarDados();
      setAviso({
        visivel: true,
        tipo: 'sucesso',
        mensagem: CONFIG_TEXTS.meuPerfil.solicitacaoSucesso,
      });
    } catch (err) {
      setErroMotivoSolicitacao(traduzirErroServidor(err));
    } finally {
      setEnviandoSolicitacao(false);
    }
  };

  const iniciais = useMemo(() => {
    const base = (nomeExibicao || dadosServidor?.verificados.nome_completo || 'S').trim();
    const partes = base.split(/\s+/);
    if (partes.length >= 2) {
      return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
    }
    return base.slice(0, 2).toUpperCase();
  }, [nomeExibicao, dadosServidor]);

  return (
    <View style={styles.container}>
      {/* Barra superior com botão voltar consistente */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={handleTentativaVoltar}
          accessibilityRole="button"
          accessibilityLabel={CONFIG_TEXTS.comum.voltar}
        >
          <ArrowLeft size={20} color={C.textPrimary} />
          <Text style={styles.botaoVoltarTexto}>{CONFIG_TEXTS.comum.voltar}</Text>
        </TouchableOpacity>
        <Text style={styles.topHeaderTitulo}>{CONFIG_TEXTS.meuPerfil.titulo}</Text>
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
            <View style={styles.offlineBannerTextos}>
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
          onFechar={() => setAviso((prev) => ({ ...prev, visivel: false }))}
        />

        {carregando ? (
          <EsqueletoLista linhas={6} />
        ) : erroCarga || !dadosServidor ? (
          <EstadoErro
            mensagem={erroCarga || CONFIG_TEXTS.comum.erroGenericoServidor}
            onTentarDeNovo={carregarDados}
          />
        ) : (
          <>
            {/* 1. Cartão de Foto com recorte circular + Progresso de perfil */}
            <View style={styles.cardTopo}>
              <View style={styles.fotoRow}>
                <View style={styles.avatarContainer}>
                  {fotoUrl ? (
                    <Image
                      source={{ uri: fotoUrl }}
                      style={styles.avatarImg}
                      accessibilityLabel="Foto de perfil do síndico"
                    />
                  ) : (
                    <View style={styles.avatarIniciaisBox}>
                      <Text style={styles.avatarIniciaisTexto}>{iniciais}</Text>
                    </View>
                  )}
                  {enviandoFoto && (
                    <View style={styles.avatarOverlayLoad}>
                      <ActivityIndicator size="small" color={C.textInverse} />
                    </View>
                  )}
                </View>

                <View style={styles.fotoTextosCol}>
                  <Text style={styles.fotoTitulo}>
                    {CONFIG_TEXTS.meuPerfil.fotoSecaoTitulo}
                  </Text>
                  <Text style={styles.fotoSubtitulo}>
                    {CONFIG_TEXTS.meuPerfil.fotoSecaoSubtitulo}
                  </Text>

                  <View style={styles.fotoBotoesRow}>
                    <TouchableOpacity
                      style={styles.botaoTrocarFoto}
                      onPress={handleTrocarFoto}
                      disabled={enviandoFoto || offline}
                      accessibilityRole="button"
                      accessibilityLabel={CONFIG_TEXTS.meuPerfil.fotoTrocar}
                    >
                      <Camera size={15} color={C.primary} />
                      <Text style={styles.botaoTrocarFotoTexto}>
                        {CONFIG_TEXTS.meuPerfil.fotoTrocar}
                      </Text>
                    </TouchableOpacity>

                    {!!fotoUrl && (
                      <TouchableOpacity
                        style={styles.botaoRemoverFoto}
                        onPress={() => setConfirmarRemoverFoto(true)}
                        disabled={enviandoFoto || offline}
                        accessibilityRole="button"
                        accessibilityLabel={CONFIG_TEXTS.meuPerfil.fotoRemover}
                      >
                        <Trash2 size={15} color={C.danger} />
                        <Text style={styles.botaoRemoverFotoTexto}>
                          {CONFIG_TEXTS.meuPerfil.fotoRemover}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              {/* Barra de progresso do perfil */}
              <View style={styles.progressoBox}>
                <View style={styles.progressoHeaderRow}>
                  <Text style={styles.progressoLabel}>
                    {CONFIG_TEXTS.meuPerfil.progressoTitulo}
                  </Text>
                  <Text style={styles.progressoPctTexto}>
                    {dadosServidor.progresso.percentual}%
                  </Text>
                </View>
                <View style={styles.progressoTrack}>
                  <View
                    style={[
                      styles.progressoFill,
                      { width: `${dadosServidor.progresso.percentual}%` },
                    ]}
                  />
                </View>
                {dadosServidor.progresso.completo ? (
                  <Text style={styles.progressoCompletoTexto}>
                    {CONFIG_TEXTS.meuPerfil.progressoCompleto}
                  </Text>
                ) : (
                  <Text style={styles.progressoFaltantesTexto}>
                    Falta: {dadosServidor.progresso.itens_faltantes.join(' • ')}
                  </Text>
                )}
              </View>
            </View>

            {/* 2. Seção de Dados Editáveis */}
            <SecaoConfig titulo={CONFIG_TEXTS.meuPerfil.secaoEditaveisTitulo}>
              <View style={styles.formPadding}>
                <CampoFormulario
                  label={CONFIG_TEXTS.meuPerfil.nomeExibicaoLabel}
                  valor={nomeExibicao}
                  onChangeText={setNomeExibicao}
                  onBlur={validarNomeExibicao}
                  placeholder={CONFIG_TEXTS.meuPerfil.nomeExibicaoPlaceholder}
                  ajuda={CONFIG_TEXTS.meuPerfil.nomeExibicaoAjuda}
                  erro={errosCampos.nomeExibicao}
                  maxLength={80}
                  editable={!offline && !salvando}
                />

                <CampoFormulario
                  label={CONFIG_TEXTS.meuPerfil.telefoneLabel}
                  valor={telefone}
                  onChangeText={(t) => setTelefone(formatarTelefoneBrMask(t))}
                  onBlur={validarTelefone}
                  placeholder={CONFIG_TEXTS.meuPerfil.telefonePlaceholder}
                  ajuda={CONFIG_TEXTS.meuPerfil.telefoneAjuda}
                  erro={errosCampos.telefone}
                  seloDireita={
                    telefone.trim()
                      ? CONFIG_TEXTS.meuPerfil.telefoneSeloNaoVerificado
                      : undefined
                  }
                  keyboardType="phone-pad"
                  maxLength={15}
                  editable={!offline && !salvando}
                />

                <CampoFormulario
                  label={CONFIG_TEXTS.meuPerfil.cargoLabel}
                  valor={cargo}
                  onChangeText={setCargo}
                  onBlur={validarCargo}
                  placeholder={CONFIG_TEXTS.meuPerfil.cargoPlaceholder}
                  ajuda={CONFIG_TEXTS.meuPerfil.cargoAjuda}
                  erro={errosCampos.cargo}
                  maxLength={80}
                  editable={!offline && !salvando}
                />

                <CampoFormulario
                  label={CONFIG_TEXTS.meuPerfil.bioLabel}
                  valor={bio}
                  onChangeText={setBio}
                  onBlur={validarBio}
                  placeholder={CONFIG_TEXTS.meuPerfil.bioPlaceholder}
                  ajuda={`${bio.length}/280 • ${CONFIG_TEXTS.meuPerfil.bioAjuda}`}
                  erro={errosCampos.bio}
                  multiline
                  maxLength={280}
                  editable={!offline && !salvando}
                />

                <ControleSegmentado
                  label={CONFIG_TEXTS.meuPerfil.preferenciaContatoLabel}
                  opcoes={CONFIG_TEXTS.meuPerfil.preferenciasContatoOpcoes}
                  valorSelecionado={preferenciaContato}
                  onSelecionar={setPreferenciaContato}
                  desabilitado={offline || salvando}
                />

                {/* Botão Salvar só ativo quando algo mudou (formSujo) */}
                <TouchableOpacity
                  style={[
                    styles.botaoSalvarPrincipal,
                    (!formSujo || salvando || offline) && styles.botaoDesabilitado,
                  ]}
                  onPress={handleSalvarPerfil}
                  disabled={!formSujo || salvando || offline}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !formSujo || salvando || offline }}
                  accessibilityLabel={CONFIG_TEXTS.comum.salvar}
                >
                  {salvando ? (
                    <ActivityIndicator size="small" color={C.textInverse} />
                  ) : (
                    <Text style={styles.botaoSalvarTexto}>
                      {CONFIG_TEXTS.comum.salvar}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </SecaoConfig>

            {/* 3. Seção de E-mail de Acesso (Troca com reautenticação) */}
            <SecaoConfig titulo={CONFIG_TEXTS.meuPerfil.secaoEmailTitulo}>
              <View style={styles.formPadding}>
                <View style={styles.emailAtualRow}>
                  <View style={styles.emailIconBox}>
                    <Mail size={18} color={C.primary} />
                  </View>
                  <View style={styles.emailTextosCol}>
                    <Text style={styles.emailLabel}>
                      {CONFIG_TEXTS.meuPerfil.emailAtualLabel}
                    </Text>
                    <Text style={styles.emailValor}>
                      {dadosServidor.email_info.email_atual}
                    </Text>
                  </View>
                </View>

                {!!dadosServidor.email_info.email_pendente && (
                  <View style={styles.emailPendenteBox}>
                    <Clock size={16} color={C.warning} />
                    <View style={styles.emailTextosCol}>
                      <Text style={styles.emailPendenteTitulo}>
                        Novo e-mail aguardando confirmação:{' '}
                        {dadosServidor.email_info.email_pendente}
                      </Text>
                      <Text style={styles.emailPendenteSub}>
                        {CONFIG_TEXTS.meuPerfil.emailPendenteAviso}
                      </Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.botaoSecundarioOutline}
                  onPress={() => {
                    setNovoEmail('');
                    setErroNovoEmail(null);
                    setModalEmailVisivel(true);
                  }}
                  disabled={offline}
                  accessibilityRole="button"
                  accessibilityLabel={CONFIG_TEXTS.meuPerfil.emailBotaoAlterar}
                >
                  <Lock size={15} color={C.primary} />
                  <Text style={styles.botaoSecundarioOutlineTexto}>
                    {CONFIG_TEXTS.meuPerfil.emailBotaoAlterar}
                  </Text>
                </TouchableOpacity>
              </View>
            </SecaoConfig>

            {/* 4. Cartão "Seus dados verificados" (Separado e travado por segurança) */}
            <SecaoConfig
              titulo={CONFIG_TEXTS.meuPerfil.secaoVerificadosTitulo}
              descricao={CONFIG_TEXTS.meuPerfil.secaoVerificadosExplicacao}
            >
              <View style={styles.formPadding}>
                <View style={styles.verificadoHeaderBanner}>
                  <ShieldCheck size={20} color={C.primary} />
                  <Text style={styles.verificadoHeaderTexto}>
                    {dadosServidor.verificados.verificado_em
                      ? `${CONFIG_TEXTS.meuPerfil.seloVerificadoEm} ${dadosServidor.verificados.verificado_em}`
                      : CONFIG_TEXTS.cabecalho.seloVerificado}
                  </Text>
                </View>

                <View style={styles.dadoTravadoItem}>
                  <View style={styles.dadoTravadoRow}>
                    <Text style={styles.dadoTravadoLabel}>
                      {CONFIG_TEXTS.meuPerfil.nomeCompletoVerificadoLabel}
                    </Text>
                    <View style={styles.seloVerificadoMini}>
                      <CheckCircle2 size={12} color={C.primary} />
                      <Text style={styles.seloVerificadoMiniTexto}>
                        {CONFIG_TEXTS.meuPerfil.seloAprovado}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.dadoTravadoValor}>
                    {dadosServidor.verificados.nome_completo}
                  </Text>
                </View>

                <View style={styles.dadoTravadoItem}>
                  <View style={styles.dadoTravadoRow}>
                    <Text style={styles.dadoTravadoLabel}>
                      {CONFIG_TEXTS.meuPerfil.cpfVerificadoLabel}
                    </Text>
                    <View style={styles.seloVerificadoMini}>
                      <CheckCircle2 size={12} color={C.primary} />
                      <Text style={styles.seloVerificadoMiniTexto}>
                        {CONFIG_TEXTS.meuPerfil.seloAprovado}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.dadoTravadoValor}>
                    {dadosServidor.verificados.cpf_mascarado}
                  </Text>
                </View>

                {/* Documentos aprovados no cadastro */}
                <Text style={styles.docsSubtitulo}>
                  {CONFIG_TEXTS.meuPerfil.documentosVerificadosLabel}
                </Text>
                {dadosServidor.verificados.documentos.map((doc) => (
                  <View key={doc.id} style={styles.docVerificadoRow}>
                    <FileCheck size={17} color={C.primary} />
                    <View style={styles.docTextosCol}>
                      <Text style={styles.docTitulo}>{doc.label}</Text>
                      <Text style={styles.docMeta}>
                        {CONFIG_TEXTS.meuPerfil.seloVerificadoEm} {doc.enviado_em_fmt}
                      </Text>
                    </View>
                    <View style={styles.seloVerificadoMini}>
                      <Text style={styles.seloVerificadoMiniTexto}>Homologado</Text>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.botaoSolicitarAlteracao}
                  onPress={() => {
                    setErroMotivoSolicitacao(null);
                    setModalSolicitacaoVisivel(true);
                  }}
                  disabled={offline}
                  accessibilityRole="button"
                  accessibilityLabel={CONFIG_TEXTS.meuPerfil.botaoSolicitarAlteracao}
                >
                  <FileEdit size={16} color={C.primary} />
                  <Text style={styles.botaoSecundarioOutlineTexto}>
                    {CONFIG_TEXTS.meuPerfil.botaoSolicitarAlteracao}
                  </Text>
                </TouchableOpacity>

                {/* Histórico de solicitações enviadas */}
                {dadosServidor.solicitacoes_alteracao.length > 0 && (
                  <View style={styles.historicoSolicitacoesBox}>
                    <Text style={styles.docsSubtitulo}>
                      {CONFIG_TEXTS.meuPerfil.historicoSolicitacoesTitulo}
                    </Text>
                    {dadosServidor.solicitacoes_alteracao.map((sol) => (
                      <View key={sol.id} style={styles.solicitacaoItemCard}>
                        <View style={styles.dadoTravadoRow}>
                          <Text style={styles.docTitulo}>{sol.campo_label}</Text>
                          <View
                            style={[
                              styles.seloStatusSol,
                              sol.status === 'aprovado' && styles.seloStatusAprovado,
                              sol.status === 'rejeitado' && styles.seloStatusRejeitado,
                            ]}
                          >
                            <Text style={styles.seloStatusSolTexto}>
                              {sol.status === 'pendente'
                                ? 'Em análise'
                                : sol.status === 'aprovado'
                                ? 'Aprovado'
                                : sol.status === 'rejeitado'
                                ? 'Não aprovado'
                                : sol.status}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.docMeta}>
                          Solicitado em {sol.criado_em_fmt}
                        </Text>
                        <Text style={styles.solicitacaoMotivoTexto} numberOfLines={2}>
                          {sol.motivo}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </SecaoConfig>

            {/* 5. Pré-visualização "Como os outros te veem" (Decisão D1: Prestadores vs Equipe) */}
            <SecaoConfig
              titulo="COMO OS OUTROS TE VEEM"
              descricao="Pré-visualização exata das informações exibidas para prestadores de serviço e para os membros da sua equipe no condomínio."
            >
              <View style={styles.formPadding}>
                <ControleSegmentado
                  label="Simular visualização de"
                  opcoes={[
                    { valor: 'prestador', label: 'Prestadores de Serviço' },
                    { valor: 'equipe', label: 'Equipe do Condomínio' },
                  ]}
                  valorSelecionado={abaPreview}
                  onSelecionar={setAbaPreview}
                />

                <View
                  style={{
                    marginTop: S.sm,
                    padding: S.md,
                    borderRadius: R.lg,
                    backgroundColor: C.bg0,
                    borderWidth: 1,
                    borderColor: C.glassBorder,
                    gap: S.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        overflow: 'hidden',
                        backgroundColor: C.primaryBgLight,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1.5,
                        borderColor: C.primary,
                      }}
                    >
                      {fotoUrl ? (
                        <Image
                          source={{ uri: fotoUrl }}
                          style={{ width: 52, height: 52, borderRadius: 26 }}
                        />
                      ) : (
                        <Text
                          style={{
                            fontFamily: FONT.bold,
                            fontSize: 17,
                            color: C.primary,
                          }}
                        >
                          {iniciais}
                        </Text>
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text
                          style={{
                            fontFamily: FONT.bold,
                            fontSize: 15,
                            color: C.textPrimary,
                          }}
                        >
                          {nomeExibicao.trim() || dadosServidor.verificados.nome_completo}
                        </Text>
                        <View style={styles.seloVerificadoMini}>
                          <ShieldCheck size={12} color={C.primary} />
                          <Text style={styles.seloVerificadoMiniTexto}>
                            {abaPreview === 'prestador' ? 'Síndico Verificado' : 'Gestão Ativa'}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={{
                          fontFamily: FONT.medium,
                          fontSize: 12.5,
                          color: C.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {cargo.trim() || 'Síndico(a) Responsável'}
                      </Text>
                    </View>
                  </View>

                  {abaPreview === 'prestador' ? (
                    <View
                      style={{
                        marginTop: 4,
                        paddingTop: S.sm,
                        borderTopWidth: 1,
                        borderTopColor: C.divider,
                        gap: 6,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Eye size={14} color={C.primary} />
                        <Text style={{ fontFamily: FONT.semibold, fontSize: 12, color: C.textPrimary }}>
                          Visível nas cotações e ordens de serviço:
                        </Text>
                      </View>
                      <Text style={{ fontFamily: FONT.regular, fontSize: 12, color: C.textSecondary, lineHeight: 18 }}>
                        • Nome de exibição, foto de perfil, cargo e selo de verificação KYC.{'\n'}
                        • Canal de atendimento protegido pelo Chat Solfy Condo.{'\n'}
                        • Oculto por privacidade: seu CPF, documentos da ata e e-mail pessoal nunca são exibidos a prestadores.
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={{
                        marginTop: 4,
                        paddingTop: S.sm,
                        borderTopWidth: 1,
                        borderTopColor: C.divider,
                        gap: 6,
                      }}
                    >
                      {!!bio.trim() && (
                        <Text
                          style={{
                            fontFamily: FONT.regular,
                            fontSize: 12.5,
                            color: C.textPrimary,
                            lineHeight: 18,
                          }}
                        >
                          “{bio.trim()}”
                        </Text>
                      )}
                      <Text style={{ fontFamily: FONT.semibold, fontSize: 12, color: C.textPrimary }}>
                        Canal preferencial para a equipe:{' '}
                        <Text style={{ fontFamily: FONT.regular, color: C.textSecondary }}>
                          {preferenciaContato === 'whatsapp'
                            ? 'WhatsApp'
                            : preferenciaContato === 'chat_app'
                            ? 'Chat do App'
                            : preferenciaContato === 'email'
                            ? 'E-mail'
                            : 'Telefone'}
                        </Text>
                      </Text>
                      <Text style={{ fontFamily: FONT.semibold, fontSize: 12, color: C.textPrimary }}>
                        Telefone de contato interno:{' '}
                        <Text style={{ fontFamily: FONT.regular, color: C.textSecondary }}>
                          {telefone.trim() || 'Não informado'}
                        </Text>
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </SecaoConfig>
          </>
        )}
      </ScrollView>

      {/* Confirmação para remover foto */}
      <FolhaConfirmar
        visivel={confirmarRemoverFoto}
        titulo={CONFIG_TEXTS.meuPerfil.fotoConfirmarRemoverTitulo}
        mensagem={CONFIG_TEXTS.meuPerfil.fotoConfirmarRemoverMsg}
        textoConfirmar={CONFIG_TEXTS.meuPerfil.fotoRemover}
        perigo
        onConfirmar={handleConfirmarRemoverFoto}
        onCancelar={() => setConfirmarRemoverFoto(false)}
      />

      {/* Aviso ao sair com alterações não salvas */}
      <FolhaConfirmar
        visivel={confirmarSaidaSemSalvar}
        titulo={CONFIG_TEXTS.comum.alteracoesNaoSalvasTitulo}
        mensagem={CONFIG_TEXTS.comum.alteracoesNaoSalvasSubtitulo}
        textoConfirmar={CONFIG_TEXTS.comum.descartar}
        textoCancelar={CONFIG_TEXTS.comum.continuarEditando}
        perigo
        onConfirmar={() => {
          setConfirmarSaidaSemSalvar(false);
          onVoltar();
        }}
        onCancelar={() => setConfirmarSaidaSemSalvar(false)}
      />

      {/* Modal 1: Informar novo e-mail antes de reautenticar */}
      <Modal
        visible={modalEmailVisivel}
        transparent
        animationType="fade"
        onRequestClose={() => setModalEmailVisivel(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitulo}>
                {CONFIG_TEXTS.meuPerfil.emailModalTitulo}
              </Text>
              <TouchableOpacity
                onPress={() => setModalEmailVisivel(false)}
                style={styles.botaoFecharModal}
                accessibilityRole="button"
                accessibilityLabel={CONFIG_TEXTS.comum.fechar}
              >
                <X size={20} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitulo}>
              {CONFIG_TEXTS.meuPerfil.emailModalSubtitulo}
            </Text>

            <CampoFormulario
              label={CONFIG_TEXTS.meuPerfil.emailNovoLabel}
              valor={novoEmail}
              onChangeText={(t) => {
                setNovoEmail(t);
                if (erroNovoEmail) setErroNovoEmail(null);
              }}
              placeholder={CONFIG_TEXTS.meuPerfil.emailNovoPlaceholder}
              erro={erroNovoEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.modalFooterBotoes}>
              <TouchableOpacity
                style={styles.botaoModalCancelar}
                onPress={() => setModalEmailVisivel(false)}
              >
                <Text style={styles.botaoModalCancelarTexto}>
                  {CONFIG_TEXTS.comum.cancelar}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.botaoModalConfirmar}
                onPress={handleAvancarParaReauthEmail}
              >
                <Text style={styles.botaoSalvarTexto}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Folha de Reautenticação por senha para concluir troca de e-mail */}
      <FolhaReautenticar
        visivel={folhaReauthEmailVisivel}
        carregando={salvandoEmail}
        erro={erroReauthEmail}
        onConfirmarSenha={handleConfirmarReauthEmail}
        onCancelar={() => setFolhaReauthEmailVisivel(false)}
      />

      {/* Modal 2: Solicitar Alteração de Dados Verificados ao Admin */}
      <Modal
        visible={modalSolicitacaoVisivel}
        transparent
        animationType="fade"
        onRequestClose={() => setModalSolicitacaoVisivel(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitulo}>
                {CONFIG_TEXTS.meuPerfil.modalSolicitacaoTitulo}
              </Text>
              <TouchableOpacity
                onPress={() => setModalSolicitacaoVisivel(false)}
                style={styles.botaoFecharModal}
                accessibilityRole="button"
                accessibilityLabel={CONFIG_TEXTS.comum.fechar}
              >
                <X size={20} color={C.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitulo}>
              {CONFIG_TEXTS.meuPerfil.modalSolicitacaoSubtitulo}
            </Text>

            <ControleSegmentado
              label={CONFIG_TEXTS.meuPerfil.solicitacaoCampoLabel}
              opcoes={CONFIG_TEXTS.meuPerfil.solicitacaoCamposOpcoes}
              valorSelecionado={campoSolicitado}
              onSelecionar={setCampoSolicitado}
              desabilitado={enviandoSolicitacao}
            />

            <CampoFormulario
              label={CONFIG_TEXTS.meuPerfil.solicitacaoValorPropostoLabel}
              valor={valorProposto}
              onChangeText={setValorProposto}
              placeholder={CONFIG_TEXTS.meuPerfil.solicitacaoValorPropostoPlaceholder}
              maxLength={140}
              editable={!enviandoSolicitacao}
            />

            <CampoFormulario
              label={CONFIG_TEXTS.meuPerfil.solicitacaoMotivoLabel}
              valor={motivoSolicitacao}
              onChangeText={(t) => {
                setMotivoSolicitacao(t);
                if (erroMotivoSolicitacao) setErroMotivoSolicitacao(null);
              }}
              placeholder={CONFIG_TEXTS.meuPerfil.solicitacaoMotivoPlaceholder}
              erro={erroMotivoSolicitacao}
              multiline
              maxLength={1000}
              editable={!enviandoSolicitacao}
            />

            <TouchableOpacity
              style={styles.botaoAnexo}
              onPress={handleEscolherAnexoSolicitacao}
              disabled={enviandoSolicitacao}
              accessibilityRole="button"
            >
              <FileCheck size={16} color={C.primary} />
              <Text style={styles.botaoSecundarioOutlineTexto} numberOfLines={1}>
                {anexoSolicitacao
                  ? `${CONFIG_TEXTS.meuPerfil.solicitacaoAnexoTrocar}: ${anexoSolicitacao.nome}`
                  : CONFIG_TEXTS.meuPerfil.solicitacaoAnexoBotao}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalFooterBotoes}>
              <TouchableOpacity
                style={styles.botaoModalCancelar}
                onPress={() => setModalSolicitacaoVisivel(false)}
                disabled={enviandoSolicitacao}
              >
                <Text style={styles.botaoModalCancelarTexto}>
                  {CONFIG_TEXTS.comum.cancelar}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.botaoModalConfirmar,
                  enviandoSolicitacao && styles.botaoDesabilitado,
                ]}
                onPress={handleEnviarSolicitacaoAlteracao}
                disabled={enviandoSolicitacao}
              >
                {enviandoSolicitacao ? (
                  <ActivityIndicator size="small" color={C.textInverse} />
                ) : (
                  <Text style={styles.botaoSalvarTexto}>
                    {CONFIG_TEXTS.meuPerfil.solicitacaoEnviarBotao}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  offlineBannerTextos: {
    flex: 1,
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
  cardTopo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 20,
  },
  fotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: '#EDF4EE',
    borderWidth: 2,
    borderColor: '#2E5A36',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarIniciaisBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIniciaisTexto: {
    fontFamily: FONT.bold,
    fontSize: 24,
    color: C.primary,
  },
  avatarOverlayLoad: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(19, 40, 23, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoTextosCol: {
    flex: 1,
  },
  fotoTitulo: {
    fontFamily: FONT.bold,
    fontSize: 15,
    color: C.textPrimary,
  },
  fotoSubtitulo: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
    marginBottom: S.sm,
  },
  fotoBotoesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: S.xs,
  },
  botaoTrocarFoto: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 38,
    paddingHorizontal: S.sm,
    paddingVertical: S.xs,
    borderRadius: R.xs,
    backgroundColor: C.primaryBgLight,
    gap: S.xxs,
  },
  botaoTrocarFotoTexto: {
    fontFamily: FONT.semibold,
    fontSize: 12,
    color: C.primary,
  },
  botaoRemoverFoto: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 38,
    paddingHorizontal: S.sm,
    paddingVertical: S.xs,
    borderRadius: R.xs,
    backgroundColor: C.dangerBg,
    gap: S.xxs,
  },
  botaoRemoverFotoTexto: {
    fontFamily: FONT.semibold,
    fontSize: 12,
    color: C.danger,
  },
  progressoBox: {
    marginTop: S.md,
    paddingTop: S.md,
    borderTopWidth: 1,
    borderTopColor: C.divider,
  },
  progressoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.xs,
  },
  progressoLabel: {
    fontFamily: FONT.semibold,
    fontSize: 13,
    color: C.textPrimary,
  },
  progressoPctTexto: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: C.primary,
  },
  progressoTrack: {
    height: 8,
    borderRadius: R.pill,
    backgroundColor: C.bg2,
    overflow: 'hidden',
    marginBottom: S.xs,
  },
  progressoFill: {
    height: '100%',
    borderRadius: R.pill,
    backgroundColor: C.primary,
  },
  progressoCompletoTexto: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: C.primary,
  },
  progressoFaltantesTexto: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: C.textSecondary,
  },
  formPadding: {
    padding: S.md,
  },
  botaoSalvarPrincipal: {
    minHeight: 48,
    borderRadius: R.sm,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: S.xs,
  },
  botaoDesabilitado: {
    opacity: 0.45,
  },
  botaoSalvarTexto: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: C.textInverse,
  },
  emailAtualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    marginBottom: S.md,
  },
  emailIconBox: {
    width: 40,
    height: 40,
    borderRadius: R.sm,
    backgroundColor: C.primaryBgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailTextosCol: {
    flex: 1,
  },
  emailLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: C.textSecondary,
  },
  emailValor: {
    fontFamily: FONT.semibold,
    fontSize: 15,
    color: C.textPrimary,
  },
  emailPendenteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.warningBg,
    borderRadius: R.sm,
    padding: S.sm,
    marginBottom: S.md,
    gap: S.xs,
  },
  emailPendenteTitulo: {
    fontFamily: FONT.semibold,
    fontSize: 12,
    color: C.warning,
  },
  emailPendenteSub: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: C.textSecondary,
    marginTop: 2,
  },
  botaoSecundarioOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.primary,
    backgroundColor: C.primaryBgLight,
    gap: S.xs,
    paddingHorizontal: S.md,
  },
  botaoSecundarioOutlineTexto: {
    fontFamily: FONT.semibold,
    fontSize: 13,
    color: C.primary,
  },
  verificadoHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primaryBgLight,
    borderRadius: R.sm,
    paddingHorizontal: S.sm,
    paddingVertical: S.xs,
    marginBottom: S.md,
    gap: S.xs,
  },
  verificadoHeaderTexto: {
    fontFamily: FONT.semibold,
    fontSize: 13,
    color: C.primaryDark,
  },
  dadoTravadoItem: {
    backgroundColor: C.bg0,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.divider,
    padding: S.sm,
    marginBottom: S.sm,
  },
  dadoTravadoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dadoTravadoLabel: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: C.textSecondary,
  },
  dadoTravadoValor: {
    fontFamily: FONT.bold,
    fontSize: 15,
    color: C.textPrimary,
  },
  seloVerificadoMini: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primaryBgLight,
    paddingHorizontal: S.xs,
    paddingVertical: 2,
    borderRadius: R.pill,
    gap: 4,
  },
  seloVerificadoMiniTexto: {
    fontFamily: FONT.semibold,
    fontSize: 11,
    color: C.primary,
  },
  docsSubtitulo: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: C.textSecondary,
    marginTop: S.xs,
    marginBottom: S.xs,
    textTransform: 'uppercase',
  },
  docVerificadoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg0,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.divider,
    padding: S.sm,
    marginBottom: S.xs,
    gap: S.sm,
  },
  docTextosCol: {
    flex: 1,
  },
  docTitulo: {
    fontFamily: FONT.semibold,
    fontSize: 13,
    color: C.textPrimary,
  },
  docMeta: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: C.textSecondary,
    marginTop: 2,
  },
  botaoSolicitarAlteracao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.primary,
    backgroundColor: C.bg1,
    marginTop: S.sm,
    gap: S.xs,
  },
  historicoSolicitacoesBox: {
    marginTop: S.md,
    paddingTop: S.sm,
    borderTopWidth: 1,
    borderTopColor: C.divider,
  },
  solicitacaoItemCard: {
    backgroundColor: C.bg0,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.divider,
    padding: S.sm,
    marginBottom: S.xs,
  },
  seloStatusSol: {
    backgroundColor: C.warningBg,
    paddingHorizontal: S.xs,
    paddingVertical: 2,
    borderRadius: R.pill,
  },
  seloStatusAprovado: {
    backgroundColor: C.primaryBgLight,
  },
  seloStatusRejeitado: {
    backgroundColor: C.dangerBg,
  },
  seloStatusSolTexto: {
    fontFamily: FONT.semibold,
    fontSize: 11,
    color: C.textPrimary,
  },
  solicitacaoMotivoTexto: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: C.textSecondary,
    marginTop: S.xxs,
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
  botaoAnexo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: R.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.primary,
    backgroundColor: C.primaryBgLight,
    paddingHorizontal: S.sm,
    marginBottom: S.md,
    gap: S.xs,
  },
  modalFooterBotoes: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: S.sm,
    marginTop: S.xs,
  },
  botaoModalCancelar: {
    minHeight: 44,
    paddingHorizontal: S.md,
    borderRadius: R.sm,
    backgroundColor: C.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoModalCancelarTexto: {
    fontFamily: FONT.semibold,
    fontSize: 13,
    color: C.textPrimary,
  },
  botaoModalConfirmar: {
    minHeight: 44,
    paddingHorizontal: S.lg,
    borderRadius: R.sm,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
