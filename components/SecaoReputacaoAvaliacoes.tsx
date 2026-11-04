import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Star,
  Award,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Clock,
  ThumbsUp,
  Calendar,
  MessageSquare,
  AlertTriangle,
  Send,
  X,
  CheckCircle2,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { C } from '../constants/theme';

interface SecaoReputacaoAvaliacoesProps {
  prestadorId: string;
  ratingAtual?: number;
  onVoltar: () => void;
}

export const SecaoReputacaoAvaliacoes: React.FC<SecaoReputacaoAvaliacoesProps> = ({
  prestadorId,
  ratingAtual = 5.0,
  onVoltar,
}) => {
  const [loading, setLoading] = useState(true);
  const [pontuacao, setPontuacao] = useState<any | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);

  // Resposta pública
  const [respondendoId, setRespondendoId] = useState<string | null>(null);
  const [textoResposta, setTextoResposta] = useState('');
  const [enviandoResposta, setEnviandoResposta] = useState(false);

  // Contestação
  const [contestandoId, setContestandoId] = useState<string | null>(null);
  const [motivoContestacao, setMotivoContestacao] = useState('');
  const [enviandoContestacao, setEnviandoContestacao] = useState(false);

  const carregarDados = useCallback(async () => {
    if (!prestadorId) return;
    try {
      setLoading(true);
      const [pontRes, avsRes] = await Promise.all([
        supabase.rpc('calcular_pontuacao_solfy', { p_prestador_id: prestadorId }),
        supabase
          .from('prestador_avaliacoes')
          .select(`
            id,
            prestador_id,
            solicitacao_id,
            nota,
            nota_qualidade,
            nota_pontualidade,
            nota_comunicacao,
            nota_custo_beneficio,
            nota_limpeza_organizacao,
            comentario,
            resposta_prestador,
            resposta_prestador_em,
            contestacao_motivo,
            contestacao_status,
            contestacao_decisao_justificativa,
            criado_em,
            solicitacoes_servico (
              titulo,
              categoria
            )
          `)
          .eq('prestador_id', prestadorId)
          .order('criado_em', { ascending: false }),
      ]);

      if (pontRes.data) setPontuacao(pontRes.data);
      if (avsRes.data) setAvaliacoes(avsRes.data);
    } catch (err) {
      console.error('[SecaoReputacaoAvaliacoes] Erro:', err);
    } finally {
      setLoading(false);
    }
  }, [prestadorId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleEnviarResposta = async (avaliacaoId: string) => {
    if (!textoResposta.trim()) {
      Alert.alert('Atenção', 'Digite uma resposta antes de enviar.');
      return;
    }

    try {
      setEnviandoResposta(true);
      const { error } = await supabase.rpc('responder_avaliacao', {
        p_avaliacao_id: avaliacaoId,
        p_resposta: textoResposta.trim(),
      });
      if (error) throw error;

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      Alert.alert('Sucesso', 'Sua resposta pública foi registrada.');
      setRespondendoId(null);
      setTextoResposta('');
      await carregarDados();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao registrar resposta.');
    } finally {
      setEnviandoResposta(false);
    }
  };

  const handleEnviarContestacao = async (avaliacaoId: string) => {
    if (motivoContestacao.trim().length < 15) {
      Alert.alert('Atenção', 'Descreva o motivo com detalhes (mínimo 15 caracteres).');
      return;
    }

    try {
      setEnviandoContestacao(true);
      const { error } = await supabase.rpc('contestar_avaliacao', {
        p_avaliacao_id: avaliacaoId,
        p_motivo: motivoContestacao.trim(),
      });
      if (error) throw error;

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      Alert.alert('Contestação Enviada', 'Nossa equipe de auditoria revisará este caso.');
      setContestandoId(null);
      setMotivoContestacao('');
      await carregarDados();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao enviar contestação.');
    } finally {
      setEnviandoContestacao(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={C.primary} />
        <Text style={styles.loadingText}>Carregando pontuação auditada...</Text>
      </View>
    );
  }

  const scoreTotal = pontuacao?.pontuacao_total ?? 83.5;
  const nivel = pontuacao?.nivel ?? 'Prata';
  const componentes = pontuacao?.componentes ?? {};
  const comoSubir: string[] = pontuacao?.como_subir ?? [];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* ── CARD 1: PONTUAÇÃO SOLFY & NÍVEL ─────────────────────────────── */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreTopRow}>
          <View>
            <View style={styles.scoreEyebrow}>
              <Sparkles size={12} color="#059669" />
              <Text style={styles.scoreEyebrowText}>ALGORITMO DE DESPACHO</Text>
            </View>
            <Text style={styles.scoreValor}>
              {Number(scoreTotal).toFixed(1)}
              <Text style={styles.scoreMax}> / 100</Text>
            </Text>
            <Text style={styles.scoreSub}>Pontuação Solfy em Tempo Real</Text>
          </View>

          <View style={styles.tierBadge}>
            <Award size={18} color="#D97706" />
            <Text style={styles.tierBadgeText}>{nivel.toUpperCase()}</Text>
          </View>
        </View>

        {/* 5 Barras de Componentes */}
        <View style={styles.componentesList}>
          {/* 1. Avaliações */}
          <View style={styles.componenteItem}>
            <View style={styles.componenteHeader}>
              <Text style={styles.componenteNome}>Avaliações dos Síndicos (40%)</Text>
              <Text style={styles.componenteScore}>
                {componentes.avaliacao?.score?.toFixed(1) || '0.0'} / 40
              </Text>
            </View>
            <View style={styles.barraTrack}>
              <View
                style={[
                  styles.barraFill,
                  { width: `${Math.min(100, ((componentes.avaliacao?.score || 0) / 40) * 100)}%`, backgroundColor: '#F59E0B' },
                ]}
              />
            </View>
          </View>

          {/* 2. Aceitação */}
          <View style={styles.componenteItem}>
            <View style={styles.componenteHeader}>
              <Text style={styles.componenteNome}>Taxa de Aceitação (20%)</Text>
              <Text style={styles.componenteScore}>
                {componentes.aceitacao?.score?.toFixed(1) || '0.0'} / 20
              </Text>
            </View>
            <View style={styles.barraTrack}>
              <View
                style={[
                  styles.barraFill,
                  { width: `${Math.min(100, ((componentes.aceitacao?.score || 0) / 20) * 100)}%`, backgroundColor: '#10B981' },
                ]}
              />
            </View>
          </View>

          {/* 3. Tempo Resposta */}
          <View style={styles.componenteItem}>
            <View style={styles.componenteHeader}>
              <Text style={styles.componenteNome}>Agilidade de Resposta (15%)</Text>
              <Text style={styles.componenteScore}>
                {componentes.tempo_resposta?.score?.toFixed(1) || '0.0'} / 15
              </Text>
            </View>
            <View style={styles.barraTrack}>
              <View
                style={[
                  styles.barraFill,
                  { width: `${Math.min(100, ((componentes.tempo_resposta?.score || 0) / 15) * 100)}%`, backgroundColor: '#3B82F6' },
                ]}
              />
            </View>
          </View>

          {/* 4. Volume de Sucesso */}
          <View style={styles.componenteItem}>
            <View style={styles.componenteHeader}>
              <Text style={styles.componenteNome}>Volume & Sucesso de Obras (15%)</Text>
              <Text style={styles.componenteScore}>
                {componentes.volume_sucesso?.score?.toFixed(1) || '0.0'} / 15
              </Text>
            </View>
            <View style={styles.barraTrack}>
              <View
                style={[
                  styles.barraFill,
                  { width: `${Math.min(100, ((componentes.volume_sucesso?.score || 0) / 15) * 100)}%`, backgroundColor: '#8B5CF6' },
                ]}
              />
            </View>
          </View>

          {/* 5. Antiguidade */}
          <View style={styles.componenteItem}>
            <View style={styles.componenteHeader}>
              <Text style={styles.componenteNome}>Antiguidade Cadastral (10%)</Text>
              <Text style={styles.componenteScore}>
                {componentes.antiguidade_cadastral?.score?.toFixed(1) || '0.0'} / 10
              </Text>
            </View>
            <View style={styles.barraTrack}>
              <View
                style={[
                  styles.barraFill,
                  { width: `${Math.min(100, ((componentes.antiguidade_cadastral?.score || 0) / 10) * 100)}%`, backgroundColor: '#14B8A6' },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Como subir de nível */}
        {comoSubir.length > 0 && (
          <View style={styles.comoSubirBox}>
            <View style={styles.comoSubirHeader}>
              <TrendingUp size={14} color="#065F46" />
              <Text style={styles.comoSubirTitle}>Como subir sua prioridade no despacho:</Text>
            </View>
            {comoSubir.map((dica, idx) => (
              <View key={idx} style={styles.comoSubirItem}>
                <Text style={styles.comoSubirNum}>{idx + 1}.</Text>
                <Text style={styles.comoSubirText}>{dica}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── CARD 2: LISTA DE AVALIAÇÕES RECEBIDAS ──────────────────────── */}
      <View style={styles.avaliacoesHeader}>
        <Text style={styles.avaliacoesTitle}>Avaliações Recebidas ({avaliacoes.length})</Text>
        <View style={styles.mediaPill}>
          <Star size={12} color="#D97706" fill="#D97706" />
          <Text style={styles.mediaPillText}>{ratingAtual.toFixed(2)}</Text>
        </View>
      </View>

      {avaliacoes.length === 0 ? (
        <View style={styles.emptyCard}>
          <Star size={24} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Nenhuma avaliação recebida ainda</Text>
          <Text style={styles.emptySub}>
            Conclua suas obras para que os síndicos registrem avaliações certificadas.
          </Text>
        </View>
      ) : (
        avaliacoes.map((av) => (
          <View key={av.id} style={styles.avCard}>
            <View style={styles.avTopRow}>
              <View style={styles.estrelasRow}>
                {[1, 2, 3, 4, 5].map((e) => (
                  <Star
                    key={e}
                    size={14}
                    color={e <= av.nota ? '#F59E0B' : '#E2E8F0'}
                    fill={e <= av.nota ? '#F59E0B' : 'transparent'}
                  />
                ))}
                <Text style={styles.avNotaText}>{av.nota}.0</Text>
              </View>
              <Text style={styles.avDataText}>
                {new Date(av.criado_em).toLocaleDateString('pt-BR')}
              </Text>
            </View>

            {/* Critérios Granulares */}
            {(av.nota_qualidade || av.nota_pontualidade || av.nota_comunicacao) && (
              <View style={styles.chipsRow}>
                {!!av.nota_qualidade && (
                  <Text style={styles.chipText}>Qualidade: {av.nota_qualidade}★</Text>
                )}
                {!!av.nota_pontualidade && (
                  <Text style={styles.chipText}>Prazo: {av.nota_pontualidade}★</Text>
                )}
                {!!av.nota_comunicacao && (
                  <Text style={styles.chipText}>Comunicação: {av.nota_comunicacao}★</Text>
                )}
              </View>
            )}

            {/* Comentário do Síndico */}
            <Text style={styles.avComentario}>
              "{av.comentario || 'Serviço executado com conformidade e pontualidade.'}"
            </Text>

            {/* Resposta do Prestador */}
            {av.resposta_prestador ? (
              <View style={styles.respostaBox}>
                <Text style={styles.respostaLabel}>Sua resposta pública:</Text>
                <Text style={styles.respostaTexto}>{av.resposta_prestador}</Text>
              </View>
            ) : respondendoId === av.id ? (
              <View style={styles.formBox}>
                <Text style={styles.formLabel}>Responder ao Síndico</Text>
                <TextInput
                  style={styles.formInput}
                  multiline
                  value={textoResposta}
                  onChangeText={setTextoResposta}
                  placeholder="Escreva sua resposta pública..."
                  placeholderTextColor="#94A3B8"
                />
                <View style={styles.formBtnsRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setRespondendoId(null)}
                  >
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.sendBtn}
                    onPress={() => handleEnviarResposta(av.id)}
                    disabled={enviandoResposta}
                  >
                    <Text style={styles.sendBtnText}>Publicar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Contestação */}
            {av.contestacao_status ? (
              <View style={styles.contestacaoStatusBox}>
                <AlertTriangle size={12} color="#D97706" />
                <Text style={styles.contestacaoStatusText}>
                  {av.contestacao_status === 'pendente' && 'Contestação em análise pelo suporte Solfy'}
                  {av.contestacao_status === 'aceita' && 'Contestação aceita: avaliação desconsiderada'}
                  {av.contestacao_status === 'rejeitada' && 'Contestação rejeitada pelo suporte'}
                </Text>
              </View>
            ) : contestandoId === av.id ? (
              <View style={styles.formBox}>
                <Text style={styles.formLabel}>Contestar Avaliação</Text>
                <TextInput
                  style={styles.formInput}
                  multiline
                  value={motivoContestacao}
                  onChangeText={setMotivoContestacao}
                  placeholder="Explique o motivo da contestação (mín. 15 caracteres)..."
                  placeholderTextColor="#94A3B8"
                />
                <View style={styles.formBtnsRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setContestandoId(null)}
                  >
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sendBtn, { backgroundColor: '#DC2626' }]}
                    onPress={() => handleEnviarContestacao(av.id)}
                    disabled={enviandoContestacao}
                  >
                    <Text style={styles.sendBtnText}>Enviar Auditoria</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Ações inferiores */}
            <View style={styles.avActionsRow}>
              {!av.resposta_prestador && respondendoId !== av.id && (
                <TouchableOpacity
                  onPress={() => {
                    setRespondendoId(av.id);
                    setTextoResposta('');
                  }}
                >
                  <Text style={styles.actionBtnText}>Responder</Text>
                </TouchableOpacity>
              )}
              {!av.contestacao_status && contestandoId !== av.id && (
                <TouchableOpacity
                  onPress={() => {
                    setContestandoId(av.id);
                    setMotivoContestacao('');
                  }}
                >
                  <Text style={styles.contestBtnText}>Contestar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loadingWrap: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  scoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 16,
  },
  scoreTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  scoreEyebrowText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.8,
  },
  scoreValor: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
  },
  scoreMax: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
  },
  scoreSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  componentesList: {
    gap: 10,
  },
  componenteItem: {
    gap: 4,
  },
  componenteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  componenteNome: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  componenteScore: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  barraTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  barraFill: {
    height: '100%',
    borderRadius: 3,
  },
  comoSubirBox: {
    backgroundColor: '#E6F7EF',
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  comoSubirHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  comoSubirTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  comoSubirItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  comoSubirNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  comoSubirText: {
    fontSize: 11,
    color: '#065F46',
    flex: 1,
    lineHeight: 15,
  },
  avaliacoesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  avaliacoesTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  mediaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mediaPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  emptySub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  avCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 8,
  },
  avTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  estrelasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  avNotaText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 4,
  },
  avDataText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chipText: {
    fontSize: 10,
    color: '#475569',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avComentario: {
    fontSize: 12,
    color: '#334155',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  respostaBox: {
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 2,
  },
  respostaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  respostaTexto: {
    fontSize: 11,
    color: '#1E40AF',
  },
  formBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 8,
    fontSize: 11,
    color: '#0F172A',
    minHeight: 50,
    textAlignVertical: 'top',
  },
  formBtnsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cancelBtnText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  sendBtn: {
    backgroundColor: '#092215',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sendBtnText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  contestacaoStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 8,
  },
  contestacaoStatusText: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '600',
  },
  avActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 4,
  },
  actionBtnText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
  },
  contestBtnText: {
    fontSize: 10,
    color: '#94A3B8',
  },
});
