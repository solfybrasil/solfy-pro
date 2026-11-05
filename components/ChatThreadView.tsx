import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Alert,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  MoreHorizontal,
  ChevronRight,
  Send,
  Plus,
  Mic,
  Image as ImageIcon,
  FileText,
  Check,
  CheckCheck,
  Clock,
  Archive,
  Layers,
  Wrench,
  Zap,
  Droplet,
  Building,
  User,
  Users,
  X,
  Lock,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { useCondo } from '../contexts/CondoContext';
import { supabase } from '../lib/supabase';
import {
  listarMensagensChat,
  enviarMensagemChat,
  listarConversasCondominio,
} from '../lib/condoApi';
import type { ChatConversa, ChatMensagem } from '../types/condo';
import { STATUS_SOLICITACAO_LABELS } from '../types/condo';

interface ChatThreadViewProps {
  conversaId: string;
  conversaInicial?: ChatConversa | null;
  onBack: () => void;
  onArchiveToggle?: (id: string) => void;
  isArchived?: boolean;
}

const QUICK_REPLIES = [
  'Pode confirmar o prazo?',
  'Obrigado!',
  'Envie as fotos, por favor',
];

const TypingDot = ({ delay }: { delay: number }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.delay(Math.max(0, 640 - delay)),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -5],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.15],
  });

  return (
    <Animated.View
      style={[
        styles.typingDot,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    />
  );
};

const CaixaTresPontosAnimada = ({
  nome,
  fotoUrl,
}: {
  nome: string;
  fotoUrl?: string | null;
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const inicial = (nome || 'P').charAt(0).toUpperCase();

  return (
    <Animated.View style={[styles.typingWrapper, { opacity: fadeAnim }]}>
      <View style={styles.typingAvatar}>
        {fotoUrl ? (
          <Image source={{ uri: fotoUrl }} style={styles.typingAvatarImg} contentFit="cover" />
        ) : (
          <Text style={styles.typingAvatarText}>{inicial}</Text>
        )}
      </View>
      <View style={styles.typingBubble}>
        <View style={styles.dotsRow}>
          <TypingDot delay={0} />
          <TypingDot delay={160} />
          <TypingDot delay={320} />
        </View>
        <Text style={styles.typingLabel} numberOfLines={1}>
          <Text style={styles.typingLabelBold}>{nome}</Text> está digitando...
        </Text>
      </View>
    </Animated.View>
  );
};

export default function ChatThreadView({
  conversaId,
  conversaInicial,
  onBack,
  onArchiveToggle,
  isArchived = false,
}: ChatThreadViewProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, perfil } = useAuth();
  const { condominioAtivo } = useCondo();

  const [conversa, setConversa] = useState<ChatConversa | null>(conversaInicial || null);
  const [solicitacaoStatus, setSolicitacaoStatus] = useState<string | null>(
    conversaInicial?.solicitacao?.status || null
  );
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [anexoAberto, setAnexoAberto] = useState(false);
  const [fotoVisualizando, setFotoVisualizando] = useState<string | null>(null);

  // Status de Digitando do Interlocutor (em tempo real)
  const [outroUsuarioDigitando, setOutroUsuarioDigitando] = useState<{
    nome: string;
    foto_url?: string | null;
  } | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<any>(null);
  const typingClearTimeoutRef = useRef<any>(null);
  const typingDebounceTimerRef = useRef<any>(null);
  const isTypingLocalRef = useRef(false);

  // Extrai o ID da solicitação se existir
  const solicitacaoId = useMemo(() => {
    if (conversa?.solicitacao?.id) return conversa.solicitacao.id;
    if (conversa?.solicitacao_id) return conversa.solicitacao_id;
    if (conversaId && conversaId.startsWith('solic_')) {
      return conversaId.replace('solic_', '').split('_')[0];
    }
    return null;
  }, [conversa, conversaId]);

  // Carrega informações da conversa se não vieram pré-carregadas
  useEffect(() => {
    if (conversaInicial) {
      setConversa(conversaInicial);
      if (conversaInicial.solicitacao?.status) {
        setSolicitacaoStatus(conversaInicial.solicitacao.status);
      }
    } else if (condominioAtivo?.id && conversaId) {
      listarConversasCondominio(condominioAtivo.id).then((convs) => {
        const encontrada = convs.find((c) => c.id === conversaId);
        if (encontrada) {
          setConversa(encontrada);
          if (encontrada.solicitacao?.status) {
            setSolicitacaoStatus(encontrada.solicitacao.status);
          }
        }
      });
    }
  }, [conversaId, conversaInicial, condominioAtivo?.id]);

  // Sincroniza em tempo real o status da solicitação vinculada (concluída, cancelada, etc.)
  useEffect(() => {
    if (!solicitacaoId) return;

    let cancelado = false;
    async function carregarInfoSolicitacao() {
      try {
        const { data, error } = await supabase
          .from('solicitacoes')
          .select('id, titulo, categoria, status')
          .eq('id', solicitacaoId)
          .maybeSingle();

        if (!cancelado && data) {
          setSolicitacaoStatus(data.status);
          setConversa((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              solicitacao: {
                id: data.id,
                titulo: data.titulo || prev.solicitacao?.titulo,
                categoria: data.categoria || prev.solicitacao?.categoria,
                status: data.status,
              },
            };
          });
        }
      } catch (e) {
        console.error('[ChatThread] Erro ao carregar status da demanda:', e);
      }
    }

    carregarInfoSolicitacao();

    const canalStatusName = `solicitacao_status_sync_${solicitacaoId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const canalStatus = supabase
      .channel(canalStatusName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'solicitacoes',
          filter: `id=eq.${solicitacaoId}`,
        },
        (payload) => {
          const novoStatus = (payload.new as any)?.status;
          if (novoStatus) {
            setSolicitacaoStatus(novoStatus);
            setConversa((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                solicitacao: {
                  id: solicitacaoId,
                  titulo: (payload.new as any)?.titulo || prev.solicitacao?.titulo,
                  categoria: (payload.new as any)?.categoria || prev.solicitacao?.categoria,
                  status: novoStatus,
                },
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      cancelado = true;
      supabase.removeChannel(canalStatus);
    };
  }, [solicitacaoId]);

  // Status de bloqueio do chat: Pedido concluído ou cancelado bloqueia o envio
  const isPedidoConcluido =
    solicitacaoStatus === 'concluida' ||
    solicitacaoStatus === 'finalizada' ||
    conversa?.solicitacao?.status === 'concluida' ||
    conversa?.solicitacao?.status === 'finalizada';

  const isPedidoCancelado =
    solicitacaoStatus === 'cancelada' ||
    conversa?.solicitacao?.status === 'cancelada';

  const isChatBloqueado = isPedidoConcluido || isPedidoCancelado;

  // Carrega mensagens reais
  const carregarMensagens = useCallback(async () => {
    if (!conversaId) return;
    try {
      const msgs = await listarMensagensChat(conversaId);
      setMensagens(msgs);
    } catch (err) {
      console.error('[ChatThread] Erro ao carregar mensagens:', err);
    } finally {
      setLoading(false);
    }
  }, [conversaId]);

  // Assinatura em Tempo Real (Supabase Realtime): Mensagens & Digitando
  useEffect(() => {
    setLoading(true);
    carregarMensagens();

    if (!conversaId) return;

    const solId = solicitacaoId;

    const canalNome = `chat_${conversaId}`;
    const canal = supabase.channel(canalNome, {
      config: { broadcast: { ack: false, self: false } },
    });

    channelRef.current = canal;

    // 0. Escuta broadcast direto de mensagens (entrega instantânea < 50ms)
    canal.on('broadcast', { event: 'nova_mensagem' }, (res) => {
      const msg = res.payload as ChatMensagem;
      if (!msg || !msg.conteudo) return;
      if (msg.remetente_id === user?.id) return;
      setMensagens((prev) => {
        if (
          prev.some(
            (m) =>
              m.id === msg.id ||
              (m.conteudo === msg.conteudo &&
                Math.abs(new Date(m.criado_em).getTime() - new Date(msg.criado_em).getTime()) < 4000)
          )
        ) {
          return prev;
        }
        return [...prev, msg];
      });
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 60);
    });

    // 1. Escuta broadcast do evento 'typing' (quem está digitando)
    canal.on('broadcast', { event: 'typing' }, (res) => {
      const payload = res.payload as {
        userId?: string;
        nome?: string;
        foto_url?: string | null;
        isTyping: boolean;
      };
      if (!payload || (payload.userId && user?.id && payload.userId === user.id)) return;

      if (payload.isTyping) {
        setOutroUsuarioDigitando({
          nome: payload.nome || 'Interlocutor',
          foto_url: payload.foto_url || null,
        });

        if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current);
        typingClearTimeoutRef.current = setTimeout(() => {
          setOutroUsuarioDigitando(null);
        }, 3500);

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 60);
      } else {
        if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current);
        setOutroUsuarioDigitando(null);
      }
    });

    // 2. Escuta novas mensagens em tempo real na tabela chat_mensagens
    canal.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_mensagens',
        filter: `conversa_id=eq.${conversaId}`,
      },
      (payload) => {
        const nova = payload.new as any;
        if (!nova) return;
        const msg: ChatMensagem = {
          id: nova.id,
          conversa_id: nova.conversa_id,
          remetente_id: nova.remetente_id || nova.sender_id,
          conteudo: nova.conteudo || nova.conteudo_texto || '',
          tipo: nova.tipo || nova.tipo_mensagem || 'texto',
          lida: Boolean(nova.lida),
          criado_em: nova.criado_em,
        };
        setMensagens((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          const semTemp = prev.filter((m) => !m.id.startsWith('temp_') || m.conteudo !== msg.conteudo);
          return [...semTemp, msg];
        });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 60);
      }
    );

    // 3. Se for vinculada a solicitação, escuta também solicitacao_mensagens
    if (solId) {
      canal.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'solicitacao_mensagens',
          filter: `solicitacao_id=eq.${solId}`,
        },
        (payload) => {
          const nova = payload.new as any;
          if (!nova) return;
          const msg: ChatMensagem = {
            id: nova.id,
            conversa_id: conversaId,
            remetente_id: nova.remetente_id,
            conteudo: nova.mensagem || nova.conteudo || '',
            tipo: 'texto',
            lida: Boolean(nova.lida),
            criado_em: nova.criado_em,
          };
          setMensagens((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            const semTemp = prev.filter((m) => !m.id.startsWith('temp_') || m.conteudo !== msg.conteudo);
            return [...semTemp, msg];
          });
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 60);
        }
      );
    }

    canal.subscribe();

    // Fallback polling suave a cada 2s (resiliência para conexões móveis e segundo plano)
    const timer = setInterval(() => {
      listarMensagensChat(conversaId).then((novas) => {
        setMensagens((atuais) => {
          if (novas.length !== atuais.length) return novas;
          return atuais;
        });
      });
    }, 2000);

    return () => {
      clearInterval(timer);
      if (channelRef.current) {
        try {
          channelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: {
              userId: user?.id,
              nome: perfil?.nome_completo || 'Usuário',
              isTyping: false,
            },
          });
        } catch (_) {}
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current);
      if (typingDebounceTimerRef.current) clearTimeout(typingDebounceTimerRef.current);
    };
  }, [conversaId, solicitacaoId, carregarMensagens, user?.id, perfil?.nome_completo]);

  // Scroll para o fim ao carregar ou enviar
  useEffect(() => {
    if (mensagens.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [mensagens.length]);

  // Disparo de status de digitação para a outra ponta (Web ou App)
  const enviarStatusDigitando = useCallback((isTyping: boolean) => {
    if (!channelRef.current || !user) return;
    try {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId: user.id,
          nome: perfil?.nome_completo || 'Síndico',
          foto_url: perfil?.foto_url || null,
          isTyping,
        },
      });
    } catch (_) {}
  }, [user, perfil]);

  const handleTextoChange = (val: string) => {
    setTexto(val);

    if (val.trim().length > 0) {
      if (!isTypingLocalRef.current) {
        isTypingLocalRef.current = true;
        enviarStatusDigitando(true);
      }
      if (typingDebounceTimerRef.current) clearTimeout(typingDebounceTimerRef.current);
      typingDebounceTimerRef.current = setTimeout(() => {
        isTypingLocalRef.current = false;
        enviarStatusDigitando(false);
      }, 1500);
    } else {
      if (typingDebounceTimerRef.current) clearTimeout(typingDebounceTimerRef.current);
      if (isTypingLocalRef.current) {
        isTypingLocalRef.current = false;
        enviarStatusDigitando(false);
      }
    }
  };

  const handleEnviar = async (conteudoManual?: string) => {
    if (isChatBloqueado) {
      Alert.alert(
        'Chat bloqueado',
        'Este pedido foi concluído. O chat está disponível apenas para visualização do histórico.'
      );
      return;
    }

    const textoFinal = (conteudoManual || texto).trim();
    if (!textoFinal || enviando) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    if (typingDebounceTimerRef.current) clearTimeout(typingDebounceTimerRef.current);
    if (isTypingLocalRef.current) {
      isTypingLocalRef.current = false;
      enviarStatusDigitando(false);
    }

    if (!conteudoManual) {
      setTexto('');
    }
    setEnviando(true);

    const tempId = `temp_${Date.now()}`;
    const tempMsg: ChatMensagem = {
      id: tempId,
      conversa_id: conversaId,
      remetente_id: user?.id || 'me',
      conteudo: textoFinal,
      tipo: 'texto',
      lida: false,
      criado_em: new Date().toISOString(),
    };

    setMensagens((prev) => [...prev, tempMsg]);

    // Transmite instantaneamente por broadcast (< 50ms para a outra ponta conectada)
    try {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'nova_mensagem',
        payload: tempMsg,
      });
    } catch (_) {}

    try {
      const nova = await enviarMensagemChat(conversaId, textoFinal);
      setMensagens((prev) => prev.map((m) => (m.id === tempId ? nova : m)));
    } catch (err) {
      console.error('[ChatThread] Erro ao enviar mensagem:', err);
    } finally {
      setEnviando(false);
    }
  };

  const handlePickImage = async () => {
    if (isChatBloqueado) return;
    setAnexoAberto(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        const tempMsg: ChatMensagem = {
          id: `img_${Date.now()}`,
          conversa_id: conversaId,
          remetente_id: user?.id || 'me',
          conteudo: uri,
          tipo: 'imagem',
          lida: false,
          criado_em: new Date().toISOString(),
        };
        setMensagens((prev) => [...prev, tempMsg]);
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    }
  };

  // Helper para ícone da categoria do pedido
  const renderCategoriaIcon = (cat?: string) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('elét') || c.includes('elet')) return <Zap size={18} color="#059669" />;
    if (c.includes('hidr') || c.includes('água') || c.includes('vazam')) return <Droplet size={18} color="#0284C7" />;
    if (c.includes('civil') || c.includes('obra') || c.includes('pred')) return <Building size={18} color="#D97706" />;
    return <Wrench size={18} color="#059669" />;
  };

  // Formatação de data / agrupamento
  const formatHora = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDia = (iso: string) => {
    try {
      const d = new Date(iso);
      const hoje = new Date();
      if (d.toDateString() === hoje.toDateString()) return 'Hoje';
      const ontem = new Date();
      ontem.setDate(hoje.getDate() - 1);
      if (d.toDateString() === ontem.toDateString()) return 'Ontem';
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  const nomeParticipante =
    conversa?.participante_nome ||
    conversa?.nome_grupo ||
    'Conversa';

  const statusSubtitulo = useMemo(() => {
    if (isPedidoConcluido) {
      return 'Pedido Concluído · Somente leitura';
    }
    if (isPedidoCancelado) {
      return 'Pedido Cancelado · Somente leitura';
    }
    if (conversa?.tipo_conversa === 'equipe_condominio') {
      return 'Equipe do Condomínio';
    }
    return 'Online agora';
  }, [conversa, isPedidoConcluido, isPedidoCancelado]);

  const temDemandaVinculada = !!conversa?.solicitacao?.id || !!solicitacaoId;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* ── HEADER ULTRA APPLE (.ch-tnav) ── */}
      <View style={[styles.tnav, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 24 : 16) + 4 }]}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={onBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="#0D1B12" strokeWidth={2.4} />
        </TouchableOpacity>

        <View style={styles.whoContainer}>
          <Text style={styles.whoName} numberOfLines={1}>
            {nomeParticipante}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, isChatBloqueado && styles.statusDotLocked]} />
            <Text style={[styles.statusText, isChatBloqueado && styles.statusTextLocked]}>
              {statusSubtitulo}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setMenuAberto(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <MoreHorizontal size={22} color="#0D1B12" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {/* ── CONTEXTO DA DEMANDA / PEDIDO PINADO (.ch-ctx) ── */}
      {temDemandaVinculada && conversa?.solicitacao && (
        <TouchableOpacity
          style={styles.ctxCard}
          activeOpacity={0.8}
          onPress={() => {
            if (conversa.solicitacao?.id) {
              router.push(`/demanda/${conversa.solicitacao.id}` as any);
            }
          }}
        >
          <View style={styles.ctxIconWrap}>
            {renderCategoriaIcon(conversa.solicitacao.categoria)}
          </View>
          <View style={styles.ctxInfo}>
            <Text style={styles.ctxTitle} numberOfLines={1}>
              Pedido #{conversa.solicitacao.id.slice(0, 8).toUpperCase()} ·{' '}
              {conversa.solicitacao.titulo || conversa.solicitacao.categoria}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                  backgroundColor: isPedidoConcluido
                    ? '#F1F5F9'
                    : isPedidoCancelado
                    ? '#FEF2F2'
                    : '#ECFDF5',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: isPedidoConcluido
                      ? '#475569'
                      : isPedidoCancelado
                      ? '#DC2626'
                      : '#059669',
                  }}
                >
                  {conversa.solicitacao.status
                    ? STATUS_SOLICITACAO_LABELS[conversa.solicitacao.status as keyof typeof STATUS_SOLICITACAO_LABELS] ||
                      conversa.solicitacao.status
                    : 'Em andamento'}
                </Text>
              </View>
              {isChatBloqueado && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Lock size={11} color="#64748B" />
                  <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '500' }}>
                    Chat bloqueado
                  </Text>
                </View>
              )}
            </View>
          </View>
          <ChevronRight size={18} color="#94A3B8" strokeWidth={2.2} />
        </TouchableOpacity>
      )}

      {/* ── LISTA DE MENSAGENS (.ch-msgs) ── */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="small" color="#059669" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={mensagens}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.msgsListContent,
            mensagens.length === 0 && { flex: 1, justifyContent: 'center' },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <View style={styles.emptyMessagesBadge}>
                <Text style={styles.emptyMessagesBadgeText}>Início da conversa</Text>
              </View>
              <Text style={styles.emptyMessagesSub}>
                Envie uma mensagem para alinhar prazos, visitas técnicas ou tirar dúvidas.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isMe = item.remetente_id === user?.id || item.remetente_id === 'me';
            const prev = mensagens[index - 1];
            const diaAtual = formatDia(item.criado_em);
            const diaAnterior = prev ? formatDia(prev.criado_em) : null;
            const exibeDia = diaAtual !== diaAnterior;

            return (
              <View>
                {exibeDia && (
                  <View style={styles.daySeparator}>
                    <Text style={styles.daySeparatorText}>{diaAtual}</Text>
                  </View>
                )}

                {item.tipo === 'sistema' ? (
                  <View style={styles.sysMessage}>
                    <Text style={styles.sysMessageText}>{item.conteudo}</Text>
                  </View>
                ) : (
                  <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOt]}>
                    {/* Balão de Mensagem */}
                    {isMe ? (
                      <LinearGradient
                        colors={['#132817', '#2E5A36']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.bubble, styles.bubbleMe]}
                      >
                        {item.tipo === 'imagem' ? (
                          <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => setFotoVisualizando(item.conteudo)}
                          >
                            <Image
                              source={{ uri: item.conteudo }}
                              style={styles.msgImage}
                              contentFit="cover"
                            />
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.bubbleTextMe}>{item.conteudo}</Text>
                        )}
                        <View style={styles.metaRowMe}>
                          <Text style={styles.metaTimeMe}>{formatHora(item.criado_em)}</Text>
                          {item.lida ? (
                            <CheckCheck size={14} color="#6EE7B7" strokeWidth={2.4} />
                          ) : (
                            <Check size={13} color="rgba(255,255,255,0.7)" strokeWidth={2.2} />
                          )}
                        </View>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.bubble, styles.bubbleOt]}>
                        {conversa?.tipo_conversa === 'equipe_condominio' && item.remetente?.nome_completo && (
                          <Text style={styles.whoAuthor}>{item.remetente.nome_completo}</Text>
                        )}
                        {item.tipo === 'imagem' ? (
                          <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => setFotoVisualizando(item.conteudo)}
                          >
                            <Image
                              source={{ uri: item.conteudo }}
                              style={styles.msgImage}
                              contentFit="cover"
                            />
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.bubbleTextOt}>{item.conteudo}</Text>
                        )}
                        <View style={styles.metaRowOt}>
                          <Text style={styles.metaTimeOt}>{formatHora(item.criado_em)}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          }}
          ListFooterComponent={
            outroUsuarioDigitando ? (
              <CaixaTresPontosAnimada
                nome={outroUsuarioDigitando.nome}
                fotoUrl={outroUsuarioDigitando.foto_url}
              />
            ) : (
              <View style={{ height: 16 }} />
            )
          }
        />
      )}

      {/* ── RESPOSTAS RÁPIDAS (.ch-quick) ── */}
      {temDemandaVinculada && !isChatBloqueado && (
        <View style={styles.quickBar}>
          <FlatList
            horizontal
            data={QUICK_REPLIES}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickListContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.quickChip}
                activeOpacity={0.75}
                onPress={() => handleEnviar(item)}
              >
                <Text style={styles.quickChipText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* ── BARRA INFERIOR: BLOQUEADO vs COMPOSIÇÃO ── */}
      {isChatBloqueado ? (
        <View
          style={[
            styles.blockedBar,
            { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16) },
          ]}
        >
          <View style={styles.blockedBarContent}>
            <View style={styles.blockedIconCircle}>
              <Lock size={18} color="#64748B" strokeWidth={2.4} />
            </View>
            <View style={styles.blockedTextContainer}>
              <Text style={styles.blockedBarTitle}>
                {isPedidoCancelado ? 'Pedido Cancelado' : 'Pedido Concluído'}
              </Text>
              <Text style={styles.blockedBarDesc}>
                {isPedidoCancelado
                  ? 'O chamado foi cancelado. O chat com o prestador foi bloqueado para novas mensagens.'
                  : 'Este pedido foi concluído. O chat está disponível apenas para visualização do histórico.'}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.composeBar,
            { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 12) },
          ]}
        >
          <TouchableOpacity
            style={styles.plusBtn}
            activeOpacity={0.7}
            onPress={() => setAnexoAberto(true)}
          >
            <Plus size={20} color="#0D1B12" strokeWidth={2.4} />
          </TouchableOpacity>

          <View style={styles.inputField}>
            <TextInput
              style={styles.textInput}
              placeholder="Mensagem"
              placeholderTextColor="#94A3B8"
              value={texto}
              onChangeText={handleTextoChange}
              multiline
              maxLength={1000}
            />
            {texto.trim().length > 0 ? (
              <TouchableOpacity
                style={styles.sendBtn}
                activeOpacity={0.8}
                onPress={() => handleEnviar()}
                disabled={enviando}
              >
                <LinearGradient
                  colors={['#132817', '#2E5A36']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendGradient}
                >
                  {enviando ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Send size={15} color="#FFFFFF" strokeWidth={2.6} />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.micBtn}
                activeOpacity={0.7}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }
                  Alert.alert('Áudio', 'Toque e segure para gravar em uma próxima atualização.');
                }}
              >
                <Mic size={20} color="#64748B" strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── MODAL OPÇÕES (Menu Superior) ── */}
      <Modal
        visible={menuAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuAberto(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuAberto(false)}
        >
          <View style={styles.sheetContent}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{nomeParticipante}</Text>

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => {
                setMenuAberto(false);
                if (onArchiveToggle) {
                  onArchiveToggle(conversaId);
                }
              }}
            >
              <Archive size={20} color="#0D1B12" strokeWidth={2} />
              <Text style={styles.menuItemText}>
                {isArchived ? 'Desarquivar conversa' : 'Arquivar conversa'}
              </Text>
            </TouchableOpacity>

            {temDemandaVinculada && conversa?.solicitacao && (
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={() => {
                  setMenuAberto(false);
                  if (conversa.solicitacao?.id) {
                    router.push(`/demanda/${conversa.solicitacao.id}` as any);
                  }
                }}
              >
                <Layers size={20} color="#059669" strokeWidth={2} />
                <Text style={styles.menuItemText}>
                  Ver pedido #{conversa.solicitacao.id.slice(0, 8).toUpperCase()}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.menuItem, { marginTop: 8 }]}
              activeOpacity={0.7}
              onPress={() => setMenuAberto(false)}
            >
              <X size={20} color="#94A3B8" strokeWidth={2} />
              <Text style={[styles.menuItemText, { color: '#64748B' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── MODAL ANEXOS (Foto / Documento) ── */}
      <Modal
        visible={anexoAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setAnexoAberto(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAnexoAberto(false)}
        >
          <View style={styles.sheetContent}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Anexar</Text>

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={handlePickImage}
            >
              <ImageIcon size={20} color="#059669" strokeWidth={2} />
              <Text style={styles.menuItemText}>Foto da galeria</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => {
                setAnexoAberto(false);
                Alert.alert('Documento', 'Envio de PDF e contratos habilitado via pedido.');
              }}
            >
              <FileText size={20} color="#0284C7" strokeWidth={2} />
              <Text style={styles.menuItemText}>Documento</Text>
            </TouchableOpacity>

            <Text style={styles.sheetHint}>
              Fotos são otimizadas antes do envio. Conversas são criptografadas.
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── LIGHTBOX PARA FOTOS (.ch-lb) ── */}
      <Modal
        visible={!!fotoVisualizando}
        transparent
        animationType="fade"
        onRequestClose={() => setFotoVisualizando(null)}
      >
        <View style={styles.lightboxContainer}>
          <TouchableOpacity
            style={styles.lightboxClose}
            onPress={() => setFotoVisualizando(null)}
          >
            <X size={22} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
          {fotoVisualizando && (
            <Image
              source={{ uri: fotoVisualizando }}
              style={styles.lightboxImage}
              contentFit="contain"
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F5F2',
  },
  tnav: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(243, 245, 242, 0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(13, 27, 18, 0.08)',
    zIndex: 10,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whoContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  whoName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0D1B12',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  statusDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  ctxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(13, 27, 18, 0.08)',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 8px rgba(13,27,18,0.04)' }
      : {
          elevation: 1,
          shadowColor: '#0D1B12',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        }),
  },
  ctxIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctxInfo: {
    flex: 1,
  },
  ctxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D1B12',
    letterSpacing: -0.15,
  },
  ctxStatus: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgsListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  emptyMessages: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyMessagesBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(13, 27, 18, 0.06)',
    marginBottom: 8,
  },
  emptyMessagesBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  emptyMessagesSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  daySeparator: {
    alignSelf: 'center',
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(13, 27, 18, 0.07)',
  },
  daySeparatorText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  sysMessage: {
    alignSelf: 'center',
    maxWidth: '85%',
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
  },
  sysMessageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    textAlign: 'center',
    lineHeight: 16,
  },
  msgRow: {
    marginVertical: 3,
    flexDirection: 'row',
  },
  msgRowMe: {
    justifyContent: 'flex-end',
  },
  msgRowOt: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 20,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 2px rgba(13,27,18,0.05)' }
      : {
          elevation: 1,
          shadowColor: '#0D1B12',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
        }),
  },
  bubbleMe: {
    borderBottomRightRadius: 7,
  },
  bubbleOt: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(13, 27, 18, 0.08)',
    borderBottomLeftRadius: 7,
  },
  whoAuthor: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 4,
  },
  bubbleTextMe: {
    fontSize: 15,
    lineHeight: 21,
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  bubbleTextOt: {
    fontSize: 15,
    lineHeight: 21,
    color: '#0D1B12',
    letterSpacing: -0.1,
  },
  msgImage: {
    width: 200,
    height: 150,
    borderRadius: 14,
    marginBottom: 4,
  },
  metaRowMe: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  metaTimeMe: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  metaRowOt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  metaTimeOt: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  quickBar: {
    paddingVertical: 6,
    backgroundColor: '#F3F5F2',
  },
  quickListContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickChip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(13, 27, 18, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0D1B12',
  },
  composeBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: 'rgba(243, 245, 242, 0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(13, 27, 18, 0.08)',
  },
  plusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(13, 27, 18, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputField: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(13, 27, 18, 0.1)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 3,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: '#0D1B12',
    paddingTop: 6,
    paddingBottom: 6,
  },
  micBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 2,
    marginLeft: 4,
  },
  sendGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D1B12',
    marginBottom: 12,
  },
  sheetHint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 12,
    lineHeight: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(13, 27, 18, 0.06)',
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0D1B12',
  },
  lightboxContainer: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 7, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  lightboxImage: {
    width: '90%',
    height: '75%',
  },
  typingWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 6,
    alignSelf: 'flex-start',
  },
  typingAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#092215',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typingAvatarImg: {
    width: '100%',
    height: '100%',
  },
  typingAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  typingBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    maxWidth: '85%',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  typingDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.25,
    backgroundColor: '#059669',
  },
  typingLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  typingLabelBold: {
    fontWeight: '600',
    color: '#092215',
  },
  statusDotLocked: {
    backgroundColor: '#94A3B8',
  },
  statusTextLocked: {
    color: '#64748B',
    fontWeight: '600',
  },
  blockedBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 4,
  },
  blockedBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  blockedIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF2F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedTextContainer: {
    flex: 1,
  },
  blockedBarTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : undefined,
  },
  blockedBarDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : undefined,
  },
});
