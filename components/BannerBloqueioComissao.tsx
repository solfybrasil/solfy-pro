import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  AlertTriangle,
  Lock,
  Copy,
  Check,
  ChevronRight,
  X,
  CreditCard,
  QrCode,
  ExternalLink,
} from 'lucide-react-native';
import { GradientButton } from './GradientButton';
import { FONT } from '../constants/theme';
import type { InadimplenciaInfo } from '../contexts/AuthContext';

interface BannerBloqueioComissaoProps {
  inadimplencia: InadimplenciaInfo;
  onRefresh?: () => void;
}

export function BannerBloqueioComissao({ inadimplencia, onRefresh }: BannerBloqueioComissaoProps) {
  const [modalDetalhesOpen, setModalDetalhesOpen] = useState(false);
  const [copiadoIdx, setCopiadoIdx] = useState<number | null>(null);

  if (!inadimplencia?.inadimplente) {
    return null;
  }

  const handleCopiarPix = async (codigo: string, idx: number) => {
    if (!codigo) return;
    await Clipboard.setStringAsync(codigo);
    setCopiadoIdx(idx);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setTimeout(() => setCopiadoIdx(null), 3000);
  };

  const valorFormatado = Number(inadimplencia.totalEmAtraso || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return (
    <>
      {/* Banner Principal de Bloqueio */}
      <View style={styles.bannerContainer}>
        <View style={styles.bannerIconWrap}>
          <Lock size={20} color="#DC2626" strokeWidth={2.5} />
        </View>
        <View style={styles.bannerTextCol}>
          <View style={styles.badgeRow}>
            <View style={styles.tagBloqueado}>
              <Text style={styles.tagBloqueadoText}>RECEBIMENTO BLOQUEADO</Text>
            </View>
            <Text style={styles.valorAtraso}>{valorFormatado} em aberto</Text>
          </View>
          <Text style={styles.bannerMsg}>
            Comissão pós-paga vencida. Novas oportunidades de serviço ficam pausadas até a regularização do pagamento.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.regularizarBtn}
          activeOpacity={0.8}
          onPress={() => setModalDetalhesOpen(true)}
        >
          <Text style={styles.regularizarBtnText}>Pagar PIX</Text>
          <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* Modal Completo de Regularização PIX */}
      <Modal
        visible={modalDetalhesOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalDetalhesOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIconWrap}>
                <AlertTriangle size={24} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Regularização de Comissões</Text>
                <Text style={styles.modalSubtitle}>Pague via PIX para reativar seu recebimento de demandas</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalDetalhesOpen(false)}
                style={styles.closeBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Total pendente de regularização:</Text>
                <Text style={styles.infoValue}>{valorFormatado}</Text>
                <Text style={styles.infoDesc}>
                  Após o pagamento, o sistema identifica automaticamente a baixa ou você pode anexar o comprovante na aba Financeiro para liberação expressa.
                </Text>
              </View>

              <Text style={styles.secaoTitulo}>ORDENS DE PAGAMENTO EM ABERTO</Text>

              {inadimplencia.opsAtrasadas.map((op: any, idx: number) => {
                const opValor = Number(op.valor_comissao || 0).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                });
                const pixCode = op.codigo_pix_copia_cola || op.chave_pix || 'financeiro@solfy.com.br';
                const copiado = copiadoIdx === idx;

                return (
                  <View key={op.id || idx} style={styles.opItemCard}>
                    <View style={styles.opHeader}>
                      <Text style={styles.opNumero}>{op.numero_op || `OP #${idx + 1}`}</Text>
                      <Text style={styles.opValor}>{opValor}</Text>
                    </View>
                    <Text style={styles.opVencimento}>
                      Venceu em: {op.data_vencimento ? new Date(op.data_vencimento).toLocaleDateString('pt-BR') : 'Imediato'}
                    </Text>

                    {/* Bloco Copia e Cola */}
                    <View style={styles.pixBox}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pixLabel}>CHAVE / CÓDIGO PIX</Text>
                        <Text numberOfLines={1} style={styles.pixCode}>
                          {pixCode}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.btnCopiarPix, copiado && styles.btnCopiarPixAtivo]}
                        onPress={() => handleCopiarPix(pixCode, idx)}
                      >
                        {copiado ? (
                          <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                        ) : (
                          <Copy size={16} color="#092215" strokeWidth={2.5} />
                        )}
                        <Text style={[styles.btnCopiarPixText, copiado && { color: '#FFFFFF' }]}>
                          {copiado ? 'Copiado!' : 'Copiar'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <GradientButton
                variant="primary"
                size="md"
                title="Já realizei o pagamento / Atualizar"
                onPress={() => {
                  setModalDetalhesOpen(false);
                  onRefresh?.();
                }}
                style={{ width: '100%', height: 48, borderRadius: 14 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 12px rgba(220, 38, 38, 0.08)' } as any)
      : {
          shadowColor: '#DC2626',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 2,
        }),
  },
  bannerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextCol: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  tagBloqueado: {
    backgroundColor: '#DC2626',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagBloqueadoText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  valorAtraso: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  bannerMsg: {
    fontSize: 11.5,
    color: '#7F1D1D',
    lineHeight: 16,
  },
  regularizarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  regularizarBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 34, 21, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    padding: 22,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalHeaderIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: FONT.bold,
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#DC2626',
    marginVertical: 4,
  },
  infoDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  secaoTitulo: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  opItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  opHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  opNumero: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  opValor: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  opVencimento: {
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 10,
  },
  pixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pixLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  pixCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 2,
  },
  btnCopiarPix: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  btnCopiarPixAtivo: {
    backgroundColor: '#1E3E25',
  },
  btnCopiarPixText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#092215',
  },
  modalFooter: {
    marginTop: 16,
  },
});
