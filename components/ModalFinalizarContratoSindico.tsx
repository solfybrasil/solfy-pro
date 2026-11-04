import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  FileCheck,
  Upload,
  Lock,
  Unlock,
  ExternalLink,
  ShieldCheck,
  FileText,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  Calendar,
  Star,
  Check,
  ChevronRight,
  AlertCircle,
  Clock,
} from 'lucide-react-native';
import {
  obterFinalizacao,
  enviarContratoFinalizacao,
  retirarEnvioFinalizacao,
  obterUrlAssinadaContrato,
  FinalizacaoInfo,
  StatusFinalizacao,
} from '../lib/condoFinalizacaoContratoApi';
import type { Solicitacao } from '../types/condo';

const FONT_TITLE = Platform.select({
  ios: 'Arial Rounded MT Bold',
  android: 'sans-serif-medium',
  default: 'Arial Rounded MT Bold, sans-serif',
});

const FONT_BODY = Platform.select({
  ios: 'Arial Rounded MT Bold',
  android: 'sans-serif',
  default: 'Arial Rounded MT Bold, sans-serif',
});

const THEME = {
  bg: '#FDFCFB',
  card: '#FFFFFF',
  ink: '#092215',
  sub: '#526056',
  mute: '#829086',
  line: 'rgba(9, 34, 21, 0.08)',
  accent: '#059669',
  accentSoft: '#E6F7EF',
  deep: '#092215',
  mid: '#14462B',
  light: '#059669',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  rose: '#E11D48',
  roseSoft: '#FFE4E6',
  slateSoft: '#F8FAFC',
};

interface ModalFinalizarContratoSindicoProps {
  visible: boolean;
  onClose: () => void;
  solicitacao?: Solicitacao;
  solicitacaoId?: string;
  prestadorId: string;
  cotacaoId?: string;
  valorSugerido?: number;
  valorPadrao?: number;
  prestadorNome?: string;
  prestadorFoto?: string;
  onSuccess?: () => void;
}

function formatarDataHora(isoString?: string | null) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return (
      d.toLocaleDateString('pt-BR') +
      ' às ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    );
  } catch {
    return isoString;
  }
}

export function ModalFinalizarContratoSindico({
  visible,
  onClose,
  solicitacao,
  solicitacaoId,
  prestadorId,
  cotacaoId,
  valorSugerido,
  valorPadrao,
  prestadorNome,
  prestadorFoto,
  onSuccess,
}: ModalFinalizarContratoSindicoProps) {
  const targetSolicitacaoId = solicitacaoId || solicitacao?.id || '';
  const targetTitulo = solicitacao?.titulo || solicitacao?.descricao || 'Serviço Condominial';
  const displayPrestador = prestadorNome || 'Prestador Homologado';
  const initialValor = valorSugerido ?? valorPadrao ?? Number(solicitacao?.valor_estimado || 0);

  const [finalizacao, setFinalizacao] = useState<FinalizacaoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [retirando, setRetirando] = useState(false);
  const [declaracaoAceita, setDeclaracaoAceita] = useState(false);

  const [valorFinal, setValorFinal] = useState(
    initialValor ? String(initialValor.toFixed(2)).replace('.', ',') : ''
  );
  const [arquivoUri, setArquivoUri] = useState<any>(null);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);

  const carregarDados = async () => {
    if (!targetSolicitacaoId) return;
    setLoading(true);
    try {
      const dados = await obterFinalizacao(targetSolicitacaoId);
      setFinalizacao(dados);
      if (dados.sindico_valor_centavos) {
        setValorFinal((dados.sindico_valor_centavos / 100).toFixed(2).replace('.', ','));
      }
    } catch (err) {
      console.warn('[ModalFinalizarContratoSindico] Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && targetSolicitacaoId) {
      carregarDados();
    }
  }, [visible, targetSolicitacaoId]);

  if (!visible) return null;

  // Garante estritamente que a finalização só abre após aprovação da cotação
  if (solicitacao && !['aprovada', 'em_execucao', 'concluida'].includes(solicitacao.status)) {
    Alert.alert(
      'Aprovação prévia necessária',
      'Para enviar o contrato e finalizar o chamado, é necessário primeiro selecionar e aprovar uma cotação.'
    );
    onClose();
    return null;
  }

  const status = finalizacao?.status || 'em_execucao';
  const jaEnviouSindico = Boolean(finalizacao?.sindico_enviou);
  const prestadorEnviou = Boolean(finalizacao?.prestador_enviou);
  const isTravado = status === 'em_analise_admin' || status === 'concluida';
  const isDivergente = status === 'divergente';
  const isDevolvida = status === 'devolvida';

  const handleEscolherDocumento = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          if (file.type !== 'application/pdf') {
            Alert.alert('Arquivo Inválido', 'Por favor, selecione um arquivo em formato PDF.');
            return;
          }
          if (file.size > 15 * 1024 * 1024) {
            Alert.alert('Arquivo muito grande', 'O tamanho máximo permitido é de 15 MB.');
            return;
          }
          setArquivoUri(file);
          setArquivoNome(file.name);
        }
      };
      input.click();
      return;
    }

    // Mobile Expo Document Picker / Image fallback
    Alert.alert(
      'Anexar Contrato',
      'Como deseja enviar a via assinada do contrato?',
      [
        {
          text: 'Galeria / Arquivo',
          onPress: async () => {
            const res = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
            });
            if (!res.canceled && res.assets?.[0]?.uri) {
              setArquivoUri(res.assets[0].uri);
              setArquivoNome(`contrato_${Date.now()}.pdf`);
            }
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const handleRetirarEnvio = async () => {
    Alert.alert(
      'Retirar Envio?',
      'O documento anexado e o valor declarado serão desvinculados para que você possa reenviar.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Sim, Retirar',
          style: 'destructive',
          onPress: async () => {
            setRetirando(true);
            try {
              await retirarEnvioFinalizacao(targetSolicitacaoId);
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              }
              setArquivoUri(null);
              setArquivoNome(null);
              setDeclaracaoAceita(false);
              await carregarDados();
              if (onSuccess) onSuccess();
            } catch (err: any) {
              Alert.alert('Erro', err.message || 'Falha ao retirar envio');
            } finally {
              setRetirando(false);
            }
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    const valLimpo = valorFinal.replace(/\./g, '').replace(',', '.');
    const valNum = parseFloat(valLimpo);

    if (isNaN(valNum) || valNum <= 0) {
      Alert.alert('Atenção', 'Informe um valor final válido em R$.');
      return;
    }

    if (!arquivoUri && !finalizacao?.sindico_arquivo_path) {
      Alert.alert('Atenção', 'É obrigatório anexar o arquivo do contrato em PDF.');
      return;
    }

    if (!declaracaoAceita) {
      Alert.alert(
        'Declaração Obrigatória',
        'Você deve marcar a caixa declarando que o valor e o contrato estão corretos antes de enviar.'
      );
      return;
    }

    const valorCentavos = Math.round(valNum * 100);

    setSalvando(true);
    try {
      await enviarContratoFinalizacao({
        solicitacaoId: targetSolicitacaoId,
        valorCentavos,
        uriOrBlob: arquivoUri,
        nomeArquivo: arquivoNome || 'contrato_assinado_sindico.pdf',
        papel: 'sindico',
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      Alert.alert(
        'Contrato Enviado!',
        'Seu contrato e valor final foram protocolados com sucesso no servidor Solfy.'
      );
      setArquivoUri(null);
      await carregarDados();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      Alert.alert('Erro ao Enviar', err.message || 'Falha no protocolo do contrato.');
    } finally {
      setSalvando(false);
    }
  };

  const handleAbrirPdf = async (path?: string | null) => {
    if (!path) return;
    try {
      const url = await obterUrlAssinadaContrato(path);
      if (url) {
        Linking.openURL(url);
      } else {
        Alert.alert('Aviso', 'Não foi possível gerar link de acesso seguro ao PDF.');
      }
    } catch (e: any) {
      Alert.alert('Erro', 'Falha ao abrir documento: ' + e.message);
    }
  };

  // Status visual label & badge
  const renderStatusBadge = () => {
    switch (status) {
      case 'em_analise_admin':
        return (
          <View style={[styles.statusPill, { backgroundColor: '#EDF4EE', borderColor: '#C8E2CC' }]}>
            <Lock size={12} color="#1E3E25" strokeWidth={2.4} />
            <Text style={[styles.statusPillText, { color: '#1E3E25' }]}>Em análise da Solfy</Text>
          </View>
        );
      case 'divergente':
        return (
          <View style={[styles.statusPill, { backgroundColor: THEME.amberSoft, borderColor: '#FDE68A' }]}>
            <AlertTriangle size={12} color={THEME.amber} strokeWidth={2.4} />
            <Text style={[styles.statusPillText, { color: THEME.amber }]}>Valores Divergentes</Text>
          </View>
        );
      case 'devolvida':
        return (
          <View style={[styles.statusPill, { backgroundColor: THEME.roseSoft, borderColor: '#FECDD3' }]}>
            <AlertCircle size={12} color={THEME.rose} strokeWidth={2.4} />
            <Text style={[styles.statusPillText, { color: THEME.rose }]}>Devolvida para Correção</Text>
          </View>
        );
      case 'concluida':
        return (
          <View style={[styles.statusPill, { backgroundColor: THEME.accentSoft, borderColor: '#A7F3D0' }]}>
            <CheckCircle2 size={12} color={THEME.accent} strokeWidth={2.4} />
            <Text style={[styles.statusPillText, { color: THEME.accent }]}>Concluída & Homologada</Text>
          </View>
        );
      case 'aguardando_outra_parte':
        return (
          <View style={[styles.statusPill, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
            <Clock size={12} color={THEME.sub} strokeWidth={2.4} />
            <Text style={[styles.statusPillText, { color: THEME.sub }]}>
              {jaEnviouSindico ? 'Aguardando o prestador' : 'Aguardando o síndico'}
            </Text>
          </View>
        );
      default:
        return (
          <View style={[styles.statusPill, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
            <Clock size={12} color={THEME.sub} strokeWidth={2.4} />
            <Text style={[styles.statusPillText, { color: THEME.sub }]}>Em Execução</Text>
          </View>
        );
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.cardContainer}>
          {/* Apple Bottom Sheet Drag Pill */}
          <View style={styles.grabZone}>
            <View style={styles.grabHandle} />
          </View>

          {/* Top Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <View style={styles.titleWithBadge}>
                <Text style={styles.headerTitle}>Finalização de Contrato</Text>
                {renderStatusBadge()}
              </View>
              <Text style={styles.headerSub} numberOfLines={1}>
                {targetTitulo}
              </Text>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color={THEME.sub} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={THEME.accent} />
              <Text style={styles.loadingText}>Carregando protocolo de contrato...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Banner de Aviso de Divergência */}
              {isDivergente && (
                <View style={styles.alertBanner}>
                  <AlertTriangle size={20} color={THEME.amber} strokeWidth={2.4} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertBannerTitle}>Atenção: Valores Divergentes</Text>
                    <Text style={styles.alertBannerDesc}>
                      Você declarou{' '}
                      <Text style={{ fontWeight: '800' }}>
                        R${' '}
                        {finalizacao?.sindico_valor_centavos
                          ? (finalizacao.sindico_valor_centavos / 100).toFixed(2).replace('.', ',')
                          : '0,00'}
                      </Text>{' '}
                      e o prestador declarou{' '}
                      <Text style={{ fontWeight: '800' }}>
                        R${' '}
                        {finalizacao?.prestador_valor_centavos
                          ? (finalizacao.prestador_valor_centavos / 100).toFixed(2).replace('.', ',')
                          : '0,00'}
                      </Text>
                      . O pedido não avançará até que ambos reenviem o mesmo valor fechado.
                    </Text>
                  </View>
                </View>
              )}

              {/* Banner de Devolução pelo Admin */}
              {isDevolvida && (
                <View style={[styles.alertBanner, { backgroundColor: THEME.roseSoft, borderColor: '#FECDD3' }]}>
                  <AlertCircle size={20} color={THEME.rose} strokeWidth={2.4} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertBannerTitle, { color: THEME.rose }]}>
                      Devolvido pela Administração Solfy
                    </Text>
                    <Text style={[styles.alertBannerDesc, { color: '#9F1239' }]}>
                      Motivo: {finalizacao?.devolvida_motivo || 'Verifique o contrato e reenvie as informações corretas.'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Banner Em Análise da Solfy */}
              {status === 'em_analise_admin' && (
                <View style={[styles.alertBanner, { backgroundColor: '#EDF4EE', borderColor: '#C8E2CC' }]}>
                  <ShieldCheck size={20} color="#1E3E25" strokeWidth={2.4} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertBannerTitle, { color: '#1E3E25' }]}>
                      Contratos em Análise pela Solfy
                    </Text>
                    <Text style={[styles.alertBannerDesc, { color: '#2E5A36' }]}>
                      Os valores bateram com sucesso! O pedido está travado para edição e aguarda homologação da nossa equipe.
                    </Text>
                  </View>
                </View>
              )}

              {/* Cartão de Status Lado a Lado (Você x Prestador) */}
              <View style={styles.sumBox}>
                <Text style={styles.sectionHeaderTitle}>SITUAÇÃO DO ENVIO DAS PARTES</Text>
                
                <View style={styles.pareamentoRow}>
                  {/* Lado Síndico (Você) */}
                  <View style={styles.pareamentoCol}>
                    <Text style={styles.pareamentoColTitle}>Você (Síndico)</Text>
                    {jaEnviouSindico ? (
                      <View style={styles.badgeSuccess}>
                        <Check size={12} color="#059669" strokeWidth={2.8} />
                        <Text style={styles.badgeSuccessText}>Enviado</Text>
                      </View>
                    ) : (
                      <View style={styles.badgePending}>
                        <Clock size={12} color={THEME.sub} strokeWidth={2.4} />
                        <Text style={styles.badgePendingText}>Pendente</Text>
                      </View>
                    )}
                    {jaEnviouSindico && (
                      <Text style={styles.declaredValueText}>
                        R${' '}
                        {finalizacao?.sindico_valor_centavos
                          ? (finalizacao.sindico_valor_centavos / 100).toFixed(2).replace('.', ',')
                          : '0,00'}
                      </Text>
                    )}
                  </View>

                  <View style={styles.pareamentoDividerVertical} />

                  {/* Lado Prestador */}
                  <View style={styles.pareamentoCol}>
                    <Text style={styles.pareamentoColTitle}>Prestador ({displayPrestador.split(' ')[0]})</Text>
                    {prestadorEnviou ? (
                      <View style={styles.badgeSuccess}>
                        <Check size={12} color="#059669" strokeWidth={2.8} />
                        <Text style={styles.badgeSuccessText}>Enviado</Text>
                      </View>
                    ) : (
                      <View style={styles.badgePending}>
                        <Clock size={12} color={THEME.sub} strokeWidth={2.4} />
                        <Text style={styles.badgePendingText}>Pendente</Text>
                      </View>
                    )}
                    {prestadorEnviou && (
                      <Text style={styles.declaredValueText}>
                        R${' '}
                        {finalizacao?.prestador_valor_centavos
                          ? (finalizacao.prestador_valor_centavos / 100).toFixed(2).replace('.', ',')
                          : '0,00'}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Se o Síndico já enviou e o arquivo está registrado */}
              {jaEnviouSindico && finalizacao?.sindico_arquivo_path && (
                <View style={styles.fieldSection}>
                  <Text style={styles.fieldLabel}>SEU CONTRATO ANEXADO</Text>
                  <View style={styles.docBox}>
                    <View style={styles.docIconSquircle}>
                      <FileText size={20} color="#059669" strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.docName} numberOfLines={1}>
                        {finalizacao.sindico_arquivo_nome || 'Contrato_Assinado_Sindico.pdf'}
                      </Text>
                      <Text style={styles.docSub}>
                        Enviado em {formatarDataHora(finalizacao.sindico_enviado_em)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.btnVerDoc}
                      onPress={() => handleAbrirPdf(finalizacao.sindico_arquivo_path)}
                      activeOpacity={0.8}
                    >
                      <ExternalLink size={13} color="#FFFFFF" strokeWidth={2.4} />
                      <Text style={styles.btnVerDocText}>Abrir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* FORMULÁRIO DE ENVIO (Só exibe se não travado em análise ou se divergente/devolvida ou não enviou) */}
              {!isTravado && (
                <View style={styles.formContainer}>
                  <Text style={styles.sectionHeaderTitle}>
                    {jaEnviouSindico ? 'REENVIAR CONTRATO OU AJUSTAR VALOR' : 'DADOS DO FECHAMENTO'}
                  </Text>

                  {/* Campo de Valor Final */}
                  <View style={styles.fieldSection}>
                    <Text style={styles.fieldLabel}>VALOR FINAL FECHADO DO SERVIÇO (R$)</Text>
                    <View style={styles.inputWrap}>
                      <DollarSign size={18} color="#059669" strokeWidth={2.4} />
                      <TextInput
                        style={styles.inputField}
                        value={valorFinal}
                        onChangeText={setValorFinal}
                        placeholder="0,00"
                        placeholderTextColor="#94A3B8"
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <Text style={styles.inputHelp}>
                      Informe exatamente o valor total acordado para execução.
                    </Text>
                  </View>

                  {/* Upload do Arquivo PDF */}
                  <View style={styles.fieldSection}>
                    <Text style={styles.fieldLabel}>ARQUIVO DO CONTRATO ASSINADO (PDF)</Text>
                    <TouchableOpacity
                      style={styles.uploadArea}
                      onPress={handleEscolherDocumento}
                      activeOpacity={0.7}
                    >
                      <Upload size={24} color={THEME.accent} strokeWidth={2} />
                      <Text style={styles.uploadTitle}>
                        {arquivoNome ? arquivoNome : 'Clique para selecionar o PDF do contrato'}
                      </Text>
                      <Text style={styles.uploadSub}>Tamanho máximo: 15 MB • Formato PDF</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Checkbox de Declaração de Conformidade */}
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setDeclaracaoAceita(!declaracaoAceita)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkboxSquare, declaracaoAceita && styles.checkboxActive]}>
                      {declaracaoAceita && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      Declaro sob responsabilidade que o valor final e o contrato anexado são os oficiais fechados com o prestador.
                    </Text>
                  </TouchableOpacity>

                  {/* Botão Primário de Envio */}
                  <TouchableOpacity
                    style={[styles.btnPrimary, (!declaracaoAceita || salvando) && styles.btnDisabled]}
                    onPress={handleSubmit}
                    disabled={!declaracaoAceita || salvando}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={[THEME.deep, THEME.mid]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.btnPrimaryGradient}
                    >
                      {salvando ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <FileCheck size={18} color="#FFFFFF" strokeWidth={2.4} />
                          <Text style={styles.btnPrimaryText}>
                            {jaEnviouSindico ? 'Atualizar Envio de Contrato' : 'Enviar Contrato para Finalização'}
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* Ação de Retirar Envio (quando permitido) */}
              {jaEnviouSindico && !isTravado && (
                <TouchableOpacity
                  style={styles.btnGhostDanger}
                  onPress={handleRetirarEnvio}
                  disabled={retirando}
                  activeOpacity={0.8}
                >
                  {retirando ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <>
                      <RotateCcw size={14} color="#DC2626" />
                      <Text style={styles.btnGhostDangerText}>Retirar Envio Atual</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 34, 21, 0.45)',
    justifyContent: 'flex-end',
  },
  cardContainer: {
    backgroundColor: THEME.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#092215',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  grabZone: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.ink,
    fontFamily: FONT_TITLE,
  },
  headerSub: {
    fontSize: 12,
    color: THEME.sub,
    fontFamily: FONT_BODY,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONT_TITLE,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: THEME.sub,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: THEME.amberSoft,
    borderColor: '#FDE68A',
  },
  alertBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.amber,
    marginBottom: 2,
  },
  alertBannerDesc: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  sumBox: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 16,
    gap: 12,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.mute,
    letterSpacing: 0.8,
  },
  pareamentoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pareamentoCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  pareamentoColTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.ink,
  },
  pareamentoDividerVertical: {
    width: 1,
    height: 50,
    backgroundColor: THEME.line,
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: THEME.accentSoft,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  badgeSuccessText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  badgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  badgePendingText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.sub,
  },
  declaredValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.ink,
  },
  fieldSection: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.mute,
    letterSpacing: 0.6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  inputField: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.ink,
  },
  inputHelp: {
    fontSize: 11,
    color: THEME.mute,
  },
  uploadArea: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 16,
    backgroundColor: THEME.card,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  uploadTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.ink,
    textAlign: 'center',
  },
  uploadSub: {
    fontSize: 11,
    color: THEME.mute,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: THEME.accent,
    borderColor: THEME.accent,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: THEME.sub,
    lineHeight: 18,
  },
  docBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.line,
    padding: 12,
    gap: 10,
  },
  docIconSquircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: THEME.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.ink,
  },
  docSub: {
    fontSize: 11,
    color: THEME.mute,
  },
  btnVerDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnVerDocText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  formContainer: {
    gap: 14,
    marginTop: 6,
  },
  btnPrimary: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  btnPrimaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: FONT_TITLE,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnGhostDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  btnGhostDangerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
});
