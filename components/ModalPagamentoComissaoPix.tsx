import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  X,
  QrCode,
  Copy,
  Check,
  Building2,
  Calendar,
  DollarSign,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileText,
} from 'lucide-react-native';
import {
  CobrancaComissaoItem,
  enviarComprovanteComissaoPrestador,
} from '../lib/prestadorExecucaoApi';

interface ModalPagamentoComissaoPixProps {
  visible: boolean;
  onClose: () => void;
  cobranca: CobrancaComissaoItem | null;
  onSucesso: () => void;
}

const THEME = {
  bg: '#F3F5F2',
  surface: '#FFFFFF',
  ink: '#0D1B12',
  sub: '#5C6B61',
  mute: '#8A978E',
  line: 'rgba(13, 27, 18, 0.08)',
  deep: '#132817',
  mid: '#2E5A36',
  accent: '#059669',
  accentSoft: '#E3F5EC',
  amber: '#B45309',
  amberSoft: '#FEF3C7',
  rose: '#BE123C',
  roseSoft: '#FFE4E6',
};

export const ModalPagamentoComissaoPix: React.FC<ModalPagamentoComissaoPixProps> = ({
  visible,
  onClose,
  cobranca,
  onSucesso,
}) => {
  const [copiadoChave, setCopiadoChave] = useState(false);
  const [copiadoPayload, setCopiadoPayload] = useState(false);
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);

  if (!cobranca) return null;

  const chavePix = cobranca.chave_pix || 'financeiro@solfy.com.br';
  const pixCopiaCola = cobranca.codigo_pix_copia_cola || `00020126580014BR.GOV.BCB.PIX0114${chavePix}5204000053039865405${cobranca.valor_reais.toFixed(2)}5802BR5909SOLFY_PRO6009SAO_PAULO62070503***6304`;

  const handleCopiarChave = async () => {
    await Clipboard.setStringAsync(chavePix);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setCopiadoChave(true);
    setTimeout(() => setCopiadoChave(false), 2500);
  };

  const handleCopiarPayload = async () => {
    await Clipboard.setStringAsync(pixCopiaCola);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setCopiadoPayload(true);
    setTimeout(() => setCopiadoPayload(false), 2500);
  };

  const handleEnviarComprovante = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    setEnviandoComprovante(true);
    try {
      const mockComprovante = new Blob(['COMPROVANTE_PIX_COMISSAO_SOLFY'], { type: 'image/jpeg' });
      const res = await enviarComprovanteComissaoPrestador({
        cobrancaId: cobranca.id,
        arquivoBlobOuUri: mockComprovante,
        nomeArquivo: `comprovante_${cobranca.id.slice(0, 8)}.jpg`,
        observacoes: 'Comprovante anexado pelo prestador via Solfy PRO',
      });

      if (res.sucesso) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        Alert.alert(
          'Comprovante Enviado!',
          'Seu comprovante foi enviado e está em análise pelo departamento financeiro da Solfy.',
          [{ text: 'OK', onPress: () => { onSucesso(); onClose(); } }]
        );
      } else {
        Alert.alert('Erro', res.erro || 'Falha ao enviar comprovante.');
      }
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Falha no envio.');
    } finally {
      setEnviandoComprovante(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <QrCode size={22} color={THEME.mid} />
              </View>
              <View>
                <Text style={styles.title}>Pagamento de Comissão</Text>
                <Text style={styles.subTitle}>PIX Oficial Solfy PRO</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <View style={styles.closeBtn}>
                <X size={18} color={THEME.ink} />
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Valor da Comissão */}
            <View style={styles.valorCard}>
              <Text style={styles.valorLabel}>VALOR DA COMISSÃO SOLFY</Text>
              <Text style={styles.valorPrincipal}>
                R$ {cobranca.valor_reais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Text>
              <View style={styles.detalhesRow}>
                <Text style={styles.detalheText}>
                  Vencimento: {cobranca.vencimento ? new Date(cobranca.vencimento).toLocaleDateString('pt-BR') : 'Imediato'}
                </Text>
                <View style={styles.dot} />
                <Text style={styles.detalheText}>
                  Base: R$ {(cobranca.base_centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* Simulação Visual do QR Code PIX */}
            <View style={styles.qrContainer}>
              <View style={styles.qrMock}>
                <QrCode size={110} color={THEME.ink} />
              </View>
              <Text style={styles.qrHelpText}>
                Abra o app do seu banco e aponte a câmera ou use o Copia-e-Cola abaixo.
              </Text>
            </View>

            {/* Chave PIX */}
            <Text style={styles.sectionLabel}>CHAVE PIX (E-MAIL)</Text>
            <View style={styles.copyBox}>
              <Text style={styles.copyText} numberOfLines={1}>{chavePix}</Text>
              <TouchableOpacity style={styles.copyBtn} onPress={handleCopiarChave}>
                {copiadoChave ? (
                  <Check size={16} color={THEME.accent} />
                ) : (
                  <Copy size={16} color={THEME.ink} />
                )}
                <Text style={[styles.copyBtnText, copiadoChave && { color: THEME.accent }]}>
                  {copiadoChave ? 'Copiado!' : 'Copiar'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Código PIX Copia-e-Cola */}
            <Text style={styles.sectionLabel}>CÓDIGO PIX COPIA-E-COLA</Text>
            <View style={styles.copyBox}>
              <Text style={styles.copyText} numberOfLines={1}>{pixCopiaCola}</Text>
              <TouchableOpacity style={styles.copyBtn} onPress={handleCopiarPayload}>
                {copiadoPayload ? (
                  <Check size={16} color={THEME.accent} />
                ) : (
                  <Copy size={16} color={THEME.ink} />
                )}
                <Text style={[styles.copyBtnText, copiadoPayload && { color: THEME.accent }]}>
                  {copiadoPayload ? 'Copiado!' : 'Copiar'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Info do Chamado */}
            <View style={styles.jobInfoCard}>
              <Building2 size={16} color={THEME.sub} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.jobCondo}>{cobranca.condominio_nome}</Text>
                <Text style={styles.jobDesc} numberOfLines={1}>
                  {cobranca.solicitacao_titulo || cobranca.solicitacao_descricao || 'Manutenção Predial'}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer com Upload de Comprovante */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.comprovanteBtn, enviandoComprovante && { opacity: 0.5 }]}
              disabled={enviandoComprovante}
              onPress={handleEnviarComprovante}
            >
              {enviandoComprovante ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Upload size={18} color="#FFFFFF" />
                  <Text style={styles.comprovanteBtnText}>Anexar Comprovante de Pagamento</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 27, 18, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: THEME.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.ink,
    letterSpacing: -0.3,
  },
  subTitle: {
    fontSize: 12,
    color: THEME.sub,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  valorCard: {
    backgroundColor: THEME.deep,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  valorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.5,
  },
  valorPrincipal: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 4,
  },
  detalhesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detalheText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrMock: {
    padding: 16,
    backgroundColor: THEME.bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.line,
    marginBottom: 10,
  },
  qrHelpText: {
    fontSize: 12,
    color: THEME.sub,
    textAlign: 'center',
    maxWidth: 260,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.sub,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 6,
  },
  copyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.bg,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 14,
  },
  copyText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.ink,
    marginRight: 10,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.line,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.ink,
  },
  jobInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.bg,
    padding: 12,
    borderRadius: 14,
    marginBottom: 24,
  },
  jobCondo: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.ink,
  },
  jobDesc: {
    fontSize: 12,
    color: THEME.sub,
    marginTop: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
  },
  comprovanteBtn: {
    backgroundColor: THEME.accent,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  comprovanteBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
