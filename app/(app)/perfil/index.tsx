import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  SafeAreaView,
  Platform,
  Modal,
  Alert,
  Dimensions,
  StatusBar,
  } from 'react-native';
import { useLocalSearchParams,
  useRouter,
  useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  User,
  Shield,
  ShieldCheck,
  CreditCard,
  Bell,
  MessageCircle,
  HelpCircle,
  FileText,
  LogOut,
  Search,
  X,
  Clock,
  WifiOff,
  ArrowLeft,
  Smartphone,
  ChevronRight,
  Check,
  CheckCircle2,
  Camera,
  Laptop,
  AlertTriangle,
  Lock,
  Wrench,
  Calendar,
  Sparkles,
  Star,
  Award,
  Trash2,
  Download,
  Mail,
  Phone,
  Key,
  Plus,
  Minus,
  MapPin,
  Sliders,
  CheckCheck,
  AlertCircle,
  FileCheck,
  RefreshCw,
} from 'lucide-react-native';
import { formatarCPF, formatarCNPJ } from '../../../lib/kycValidations';
import { SecaoReputacaoAvaliacoes } from '../../../components/SecaoReputacaoAvaliacoes';
import { useAlert } from '../../../components/AlertProvider';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { supabase } from '../../../lib/supabase';
import { SolfyLoader } from '../../../components/SolfyLoader';
import {
  obterOuCriarPrestadorLogado,
  atualizarPerfilPrestador,
  obterDadosPessoaJuridica,
  listarDisponibilidade,
  salvarDisponibilidade,
  listarAvaliacoesPrestador,
  TEXTO_TERMO_CNPJ_GRANDE_V1,
  listarSessoesAtivasPrestador,
  encerrarSessaoRemotaPrestador,
  encerrarTodasOutrasSessoesPrestador,
  solicitarTrocaEmail,
  solicitarTrocaTelefoneSms,
  confirmarTrocaTelefoneSms,
  listarCategoriasCatalogo,
  listarMinhasSolicitacoesCategoria,
  solicitarHomologacaoCategoria,
  removerMinhaCategoria,
  atualizarMeuRaioAtendimento,
  atualizarPlantaoEmergencia,
  obterResumoFaturasPrestador,
  type SessaoPrestadorItem,
  type CategoriaCatalogoItem,
  type SolicitacaoCategoriaItem,
} from '../../../lib/condoPrestadorPainelApi';
import type {
  PrestadorPerfilPro,
  PrestadorPessoaJuridica,
  PrestadorDisponibilidade,
} from '../../../types/condo';

export type SecaoConfigKey =
  | 'meu_perfil'
  | 'seguranca_senha'
  | 'reputacao_avaliacoes'
  | 'especialidades_raio'
  | 'disponibilidade'
  | 'documentos_kyc'
  | 'notificacoes'
  | 'central_ajuda'
  | 'fale_conosco'
  | 'termos';

const FAQ_PRESTADOR = [
  {
    q: 'Como funciona o despacho de pedidos?',
    a: 'Quando um condomínio abre uma demanda na sua categoria e raio de atuação, o pedido é despachado simultaneamente para até 3 profissionais homologados. Você pode agendar visita técnica ou enviar cotação direta.',
  },
  {
    q: 'Posso cotar antes de realizar a visita técnica?',
    a: 'Se você agendar uma visita técnica com o síndico, o envio de cotação é liberado imediatamente após o término do horário da visita, garantindo precisão técnica na sua proposta.',
  },
  {
    q: 'Como funciona o pagamento das comissões?',
    a: 'A comissão Solfy só é faturada após o síndico confirmar a conclusão da obra. Uma fatura é gerada no app com código PIX Copia-e-Cola e prazo de vencimento para quitação.',
  },
  {
    q: 'O que acontece se atrasar uma comissão?',
    a: 'Prestadores com comissões vencidas ficam temporariamente bloqueados para receber novos despachos até a compensação do comprovante na aba Financeiro.',
  },
  {
    q: 'Como aumentar meu nível para Prata, Ouro ou Diamante?',
    a: 'Seu nível evolui conforme você conclui obras dentro do prazo, mantém avaliações acima de 4.7 estrelas e atende síndicos com excelência.',
  },
];

export default function PrestadorConfiguracoesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const safeTop = Math.max(insets.top, statusBarHeight, Platform.OS === 'android' ? 28 : 16);
  const headerPaddingTop = safeTop + 10;
  const subHeaderPaddingTop = safeTop + 6;
  const subHeaderHeight = safeTop + 54;
  const subHeaderStyle = useMemo(
    () => [styles.subHeader, { paddingTop: subHeaderPaddingTop, height: subHeaderHeight }],
    [subHeaderPaddingTop, subHeaderHeight]
  );
  const params = useLocalSearchParams<{ secao?: string }>();
  const { user, perfil, prestador, signOut, signOutAllDevices, refreshPerfil } = useAuth();
  const { enfileirarNotificacao } = useNotifications();
  const { showAlert } = useAlert();

  const [secaoAtiva, setSecaoAtiva] = useState<SecaoConfigKey | null>(null);
  const [offline, setOffline] = useState(false);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  // Dados reais do prestador
  const [perfilPro, setPerfilPro] = useState<PrestadorPerfilPro | null>(null);
  const [pjData, setPjData] = useState<PrestadorPessoaJuridica | null>(null);
  const [disponibilidade, setDisponibilidade] = useState<PrestadorDisponibilidade[]>([]);

  // BLOCO 2: Estados reais de Especialidades, Raio, Plantão, KYC e Faturas
  const [solicitacoesCategoria, setSolicitacoesCategoria] = useState<SolicitacaoCategoriaItem[]>([]);
  const [catalogoCategorias, setCatalogoCategorias] = useState<CategoriaCatalogoItem[]>([]);
  const [modalNovaCategoria, setModalNovaCategoria] = useState(false);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('');
  const [motivoSolicitacao, setMotivoSolicitacao] = useState('');
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  const [raioEditavel, setRaioEditavel] = useState(30);
  const [salvandoRaio, setSalvandoRaio] = useState(false);

  const [plantao24h, setPlantao24h] = useState(false);
  const [atendeEmergencia, setAtendeEmergencia] = useState(false);
  const [salvandoPlantao, setSalvandoPlantao] = useState(false);
  const [gradeSemanal, setGradeSemanal] = useState<PrestadorDisponibilidade[]>([]);
  const [salvandoGrade, setSalvandoGrade] = useState(false);

  const [documentosKyc, setDocumentosKyc] = useState<any[]>([]);
  const [carregandoKyc, setCarregandoKyc] = useState(false);
  const [enviandoKyc, setEnviandoKyc] = useState<string | null>(null);

  const [resumoFaturas, setResumoFaturas] = useState<{
    totalPendentes: number;
    totalVencidas: number;
    valorTotalCentavos: number;
  }>({ totalPendentes: 0, totalVencidas: 0, valorTotalCentavos: 0 });

  // Sincroniza a barra de navegação: Oculta o dock quando em qualquer subtela de detalhe (igual ao condo)
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: { display: secaoAtiva ? 'none' : undefined },
    });
    return () => {
      navigation.setOptions({
        tabBarStyle: { display: undefined },
      });
    };
  }, [secaoAtiva, navigation]);

  // Sincroniza deep-link inicial (?secao=...)
  useEffect(() => {
    if (typeof params.secao === 'string' && params.secao.trim()) {
      setSecaoAtiva(params.secao.trim() as SecaoConfigKey);
    }
  }, [params.secao]);

  // Monitor de conectividade
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
    });
    return () => unsub();
  }, []);

  // Toast System
  const [toast, setToast] = useState<{ visivel: boolean; mensagem: string; tipo: 'sucesso' | 'erro' }>({
    visivel: false,
    mensagem: '',
    tipo: 'sucesso',
  });
  const toastTimeoutRef = useRef<any>(null);

  const showToast = useCallback((mensagem: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        tipo === 'erro' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success
      ).catch(() => {});
    }
    setToast({ visivel: true, mensagem, tipo });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToast((p) => ({ ...p, visivel: false }));
    }, 2800);
  }, []);

  // Campos do perfil editável
  const [dadosEditaveis, setDadosEditaveis] = useState({
    nome: '',
    telefone: '',
    servico: '',
    bio: '',
    foto_url: null as string | null,
    raio_km: 30,
  });

  const carregarTodosDados = useCallback(async () => {
    try {
      setCarregando(true);
      const p = await obterOuCriarPrestadorLogado();
      if (p) {
        setPerfilPro(p);
        setDadosEditaveis({
          nome: (perfil as any)?.nome_exibicao || p.name || perfil?.nome_completo || '',
          telefone: p.phone || perfil?.telefone || '',
          servico: p.service_type || 'Manutenção Predial',
          bio: p.bio_apresentacao || '',
          foto_url: p.foto_perfil_url || perfil?.foto_url || null,
          raio_km: p.raio_atendimento_km || 30,
        });
        setRaioEditavel(p.raio_atendimento_km || 30);
        setPlantao24h(Boolean((p as any).plantao_24h));
        setAtendeEmergencia(Boolean((p as any).atende_emergencia));

        const [pj, disp, sols, cats, faturas, docsRes] = await Promise.all([
          obterDadosPessoaJuridica(p.id).catch(() => null),
          listarDisponibilidade(p.id).catch(() => []),
          listarMinhasSolicitacoesCategoria(p.id).catch(() => []),
          listarCategoriasCatalogo().catch(() => []),
          obterResumoFaturasPrestador(p.id).catch(() => ({ totalPendentes: 0, totalVencidas: 0, valorTotalCentavos: 0 })),
          supabase
            .from('prestador_documentos')
            .select('*')
            .eq('prestador_id', p.id)
            .order('criado_em', { ascending: false })
            .then((r) => r, () => ({ data: [] })),
        ]);

        setPjData(pj);
        setDisponibilidade(disp);
        setSolicitacoesCategoria(sols);
        setCatalogoCategorias(cats);
        setResumoFaturas(faturas);
        setDocumentosKyc((docsRes as any)?.data || []);

        // Normaliza a grade para todos os 7 dias da semana (0=Dom ... 6=Sab)
        const gradeNormalizada: PrestadorDisponibilidade[] = [];
        for (let dia = 0; dia <= 6; dia++) {
          const existente = (disp as any[])?.find((d: any) => d.dia_semana === dia);
          if (existente) {
            gradeNormalizada.push({
              ...existente,
              horario_inicio: (existente.horario_inicio || '08:00').slice(0, 5),
              horario_fim: (existente.horario_fim || '18:00').slice(0, 5),
            });
          } else {
            const isDiaUtil = dia >= 1 && dia <= 5;
            gradeNormalizada.push({
              prestador_id: p.id,
              dia_semana: dia,
              horario_inicio: '08:00',
              horario_fim: '18:00',
              ativo: isDiaUtil,
            });
          }
        }
        setGradeSemanal(gradeNormalizada);
      }
    } catch (err) {
      console.warn('[ConfiguracoesScreen] Erro ao carregar dados:', err);
    } finally {
      setCarregando(false);
    }
  }, [perfil]);

  useEffect(() => {
    carregarTodosDados();
  }, [carregarTodosDados]);

  // Completude do perfil
  const completudeItens = useMemo(() => {
    return [
      { label: 'Foto de perfil / logotipo', ok: Boolean(dadosEditaveis.foto_url) },
      { label: 'Telefone cadastrado', ok: /\d{10,}/.test((dadosEditaveis.telefone || '').replace(/\D/g, '')) },
      { label: 'Especialidade principal', ok: !!(dadosEditaveis.servico || '').trim() },
      { label: 'Apresentação profissional (Bio)', ok: !!(dadosEditaveis.bio || '').trim() },
      { label: 'Documentação KYC Aprovada', ok: perfilPro?.status_cadastro === 'aprovado' },
      { label: 'Raio de atendimento definido', ok: dadosEditaveis.raio_km > 0 },
    ];
  }, [dadosEditaveis, perfilPro]);

  const percentualCompletude = useMemo(() => {
    const total = completudeItens.length;
    const oks = completudeItens.filter((x) => x.ok).length;
    return Math.round((oks / total) * 100);
  }, [completudeItens]);

  const corCompletude = useMemo(() => {
    if (percentualCompletude <= 25) return '#EF4444'; // 0 a 25%: Vermelho
    if (percentualCompletude <= 75) return '#F97316'; // 26 a 75%: Alaranjado
    return '#10B981'; // 76 a 100%: Verde
  }, [percentualCompletude]);

  const listaEspecialidadesHomologadas = useMemo(() => {
    if (perfilPro?.categorias_atendidas && perfilPro.categorias_atendidas.length > 0) {
      return perfilPro.categorias_atendidas;
    }
    if (dadosEditaveis.servico && dadosEditaveis.servico !== 'Técnico Especialista' && dadosEditaveis.servico !== 'Manutenção Predial') {
      return [dadosEditaveis.servico];
    }
    return [];
  }, [perfilPro?.categorias_atendidas, dadosEditaveis.servico]);

  const documentoOficialExibicao = useMemo(() => {
    const raw =
      pjData?.cnpj ||
      pjData?.cpf ||
      (perfilPro as any)?.cnpj ||
      (perfilPro as any)?.cpf ||
      (perfilPro as any)?.documento_fiscal ||
      perfil?.documento_numero ||
      '';
    const limpo = String(raw).replace(/\D/g, '');
    if (limpo.length === 11) {
      return formatarCPF(limpo);
    }
    if (limpo.length === 14) {
      return formatarCNPJ(limpo);
    }
    return limpo || 'Não informado';
  }, [pjData, perfilPro, perfil]);

  const itensFaltantes = useMemo(
    () => completudeItens.filter((x) => !x.ok).map((x) => x.label),
    [completudeItens]
  );

  // Estados de Notificação
  const [notificacoes, setNotificacoes] = useState({
    demandas: true,
    visitas: true,
    chat: true,
    comissao: true,
    silencioso: false,
  });

  const handleToggleNotificacao = (chave: keyof typeof notificacoes) => {
    setNotificacoes((prev) => {
      const updated = { ...prev, [chave]: !prev[chave] };
      showToast('Preferências de notificação salvas!');
      return updated;
    });
  };

  const handleEnviarNotificacaoTeste = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    showToast('🔔 Notificação de teste simulada com sucesso!');
  };

  // Alteração de Senha (Regra do Servidor: Mínimo 10, Maiúscula, Minúscula, Número)
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirma, setSenhaConfirma] = useState('');
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showSenhaNova, setShowSenhaNova] = useState(false);

  const pwRules = useMemo(() => {
    return {
      len: senhaNova.length >= 10,
      up: /[A-Z]/.test(senhaNova),
      low: /[a-z]/.test(senhaNova),
      num: /[0-9]/.test(senhaNova),
    };
  }, [senhaNova]);

  const pwStrengthScore = useMemo(() => {
    let score = 0;
    if (pwRules.len) score++;
    if (pwRules.up) score++;
    if (pwRules.low) score++;
    if (pwRules.num) score++;
    return score;
  }, [pwRules]);

  const canSavePassword =
    pwStrengthScore === 4 &&
    senhaNova === senhaConfirma &&
    senhaAtual.trim().length > 0;

  const handleSalvarSenha = async () => {
    if (offline) {
      showToast('Sem conexão. Conecte-se para alterar a senha.', 'erro');
      return;
    }
    if (!senhaAtual.trim()) {
      showToast('Informe sua senha atual para confirmar.', 'erro');
      return;
    }
    if (!canSavePassword) {
      showToast('A nova senha deve ter no mínimo 10 dígitos, maiúscula, minúscula e número.', 'erro');
      return;
    }

    try {
      // 1. Reautenticação obrigatória com a senha atual informada
      const emailUsuario = user?.email || '';
      if (!emailUsuario) {
        showToast('E-mail do usuário não localizado.', 'erro');
        return;
      }

      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: emailUsuario,
        password: senhaAtual,
      });

      if (reauthErr) {
        showToast('A senha atual informada está incorreta.', 'erro');
        return;
      }

      // 2. Atualização segura da senha no servidor
      const { error: upErr } = await supabase.auth.updateUser({ password: senhaNova });
      if (upErr) throw upErr;

      setSenhaAtual('');
      setSenhaNova('');
      setSenhaConfirma('');
      setSecaoAtiva(null);
      showToast('Senha atualizada com sucesso!');
    } catch (e: any) {
      showToast(e?.message || 'Falha ao alterar senha', 'erro');
    }
  };

  // ── ESTADOS E FLUXOS DE TROCA DE E-MAIL E TELEFONE (SMS) ──
  const [novoEmail, setNovoEmail] = useState('');
  const [carregandoEmail, setCarregandoEmail] = useState(false);
  const [novoTelefone, setNovoTelefone] = useState('');
  const [codigoSms, setCodigoSms] = useState('');
  const [etapaTelefone, setEtapaTelefone] = useState<'inicio' | 'aguardando_codigo'>('inicio');
  const [carregandoTelefone, setCarregandoTelefone] = useState(false);

  // ── SESSÕES ATIVAS REAIS ──
  const [sessoes, setSessoes] = useState<SessaoPrestadorItem[]>([]);
  const [carregandoSessoes, setCarregandoSessoes] = useState(false);

  const carregarSessoes = useCallback(async () => {
    if (!user?.id) return;
    try {
      setCarregandoSessoes(true);
      const lista = await listarSessoesAtivasPrestador(user.id);
      setSessoes(lista);
    } catch {
      // silencioso
    } finally {
      setCarregandoSessoes(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (secaoAtiva === 'seguranca_senha') {
      carregarSessoes();
    }
  }, [secaoAtiva, carregarSessoes]);

  const handleTrocarEmail = async () => {
    if (!novoEmail.trim() || !novoEmail.includes('@')) {
      showToast('Informe um novo e-mail válido.', 'erro');
      return;
    }
    try {
      setCarregandoEmail(true);
      await solicitarTrocaEmail(novoEmail);
      setNovoEmail('');
      showToast('Confirmação enviada! Verifique a caixa de entrada do novo e-mail.');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao solicitar troca de e-mail', 'erro');
    } finally {
      setCarregandoEmail(false);
    }
  };

  const handleEnviarSmsTelefone = async () => {
    const digitos = novoTelefone.replace(/\D/g, '');
    if (digitos.length < 10 || digitos.length > 11) {
      showToast('Informe um telefone brasileiro válido com DDD.', 'erro');
      return;
    }
    try {
      setCarregandoTelefone(true);
      await solicitarTrocaTelefoneSms(novoTelefone);
      setEtapaTelefone('aguardando_codigo');
      showToast('Código SMS enviado com sucesso!');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao enviar SMS', 'erro');
    } finally {
      setCarregandoTelefone(false);
    }
  };

  const handleConfirmarSmsTelefone = async () => {
    if (!codigoSms.trim() || codigoSms.trim().length < 6) {
      showToast('Informe o código de 6 dígitos recebido por SMS.', 'erro');
      return;
    }
    if (!user?.id) return;
    try {
      setCarregandoTelefone(true);
      await confirmarTrocaTelefoneSms(novoTelefone, codigoSms, user.id, perfilPro?.id);
      setDadosEditaveis((p) => ({ ...p, telefone: novoTelefone }));
      setNovoTelefone('');
      setCodigoSms('');
      setEtapaTelefone('inicio');
      showToast('Telefone e WhatsApp comercial verificados com sucesso!');
    } catch (err: any) {
      showToast(err?.message || 'Código SMS inválido ou expirado', 'erro');
    } finally {
      setCarregandoTelefone(false);
    }
  };

  const handleEncerrarSessaoRemota = async (sessionId: string) => {
    try {
      await encerrarSessaoRemotaPrestador(sessionId);
      showToast('Aparelho desconectado com sucesso.');
      await carregarSessoes();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao desconectar aparelho', 'erro');
    }
  };

  const handleEncerrarOutrasSessoes = async () => {
    if (!user?.id) return;
    try {
      await encerrarTodasOutrasSessoesPrestador(user.id);
      showToast('Todas as outras sessões foram encerradas.');
      await carregarSessoes();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao encerrar outras sessões', 'erro');
    }
  };

  // Upload de Foto para o bucket exclusivo 'avatars'
  const handleTrocarFoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setDadosEditaveis((prev) => ({ ...prev, foto_url: asset.uri }));

        if (asset.base64 && (user?.id || perfilPro?.id)) {
          const uid = user?.id || perfilPro?.id;
          const fileName = `${uid}/avatar_${Date.now()}.jpg`;
          const buffer = Uint8Array.from(atob(asset.base64), (c) => c.charCodeAt(0));

          const { error: upErr } = await supabase.storage
            .from('avatars')
            .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });

          if (!upErr) {
            const { data: pubData } = supabase.storage
              .from('avatars')
              .getPublicUrl(fileName);

            if (pubData?.publicUrl) {
              if (perfilPro?.id) {
                await atualizarPerfilPrestador(perfilPro.id, { foto_perfil_url: pubData.publicUrl });
              }
              if (user?.id) {
                await supabase.from('perfis').update({ foto_url: pubData.publicUrl }).eq('user_id', user.id);
              }
              setDadosEditaveis((prev) => ({ ...prev, foto_url: pubData.publicUrl }));
              if (refreshPerfil) refreshPerfil().catch(() => {});
              showToast('Foto profissional atualizada!');
              return;
            }
          }
        }
        showToast('Foto atualizada localmente!');
      }
    } catch {
      showToast('Não foi possível carregar a imagem', 'erro');
    }
  };

  // Salvar Meu Perfil PRO
  const handleSalvarPerfilPro = async () => {
    if (!perfilPro?.id) return;
    if (dadosEditaveis.nome.trim().length < 3) {
      showToast('O nome deve ter ao menos 3 letras.', 'erro');
      return;
    }

    try {
      await atualizarPerfilPrestador(perfilPro.id, {
        name: dadosEditaveis.nome.trim(),
        phone: dadosEditaveis.telefone.trim(),
        service_type: dadosEditaveis.servico.trim(),
        bio_apresentacao: dadosEditaveis.bio.trim(),
        raio_atendimento_km: Number(dadosEditaveis.raio_km) || 30,
      });

      if (user?.id) {
        await supabase
          .from('perfis')
          .update({
            nome_exibicao: dadosEditaveis.nome.trim(),
            bio: dadosEditaveis.bio.trim(),
          })
          .eq('user_id', user.id);
      }

      if (refreshPerfil) await refreshPerfil();
      setSecaoAtiva(null);
      showToast('Perfil profissional salvo com sucesso!');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar perfil', 'erro');
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCO 2: AÇÕES REAIS DE ESPECIALIDADES, RAIO, DISPONIBILIDADE E KYC
  // ══════════════════════════════════════════════════════════════════════════

  const handleSalvarRaio = async () => {
    if (raioEditavel < 1 || raioEditavel > 50) {
      showToast('O raio de atendimento deve estar entre 1 e 50 km.', 'erro');
      return;
    }
    try {
      setSalvandoRaio(true);
      await atualizarMeuRaioAtendimento(raioEditavel);
      setDadosEditaveis((p) => ({ ...p, raio_km: raioEditavel }));
      if (perfilPro) {
        setPerfilPro((p) => (p ? { ...p, raio_atendimento_km: raioEditavel } : null));
      }
      showToast(`Raio de atendimento atualizado para ${raioEditavel} km!`);
    } catch (err: any) {
      showToast(err?.message || 'Falha ao atualizar raio de atendimento', 'erro');
    } finally {
      setSalvandoRaio(false);
    }
  };

  const handleRemoverCategoria = (categoriaChave: string) => {
    const executar = async () => {
      try {
        const res = await removerMinhaCategoria(categoriaChave);
        if (perfilPro) {
          setPerfilPro((p) =>
            p ? { ...p, categorias_atendidas: res.categorias_atendidas } : null
          );
        }
        showToast('Especialidade removida da sua grade.');
      } catch (err: any) {
        showToast(err?.message || 'Não foi possível remover especialidade', 'erro');
      }
    };

    if (showAlert) {
      showAlert({
        title: 'Remover Especialidade',
        message: `Deseja parar de receber despachos para a categoria "${categoriaChave}"?`,
        type: 'confirm',
        confirmText: 'Remover',
        cancelText: 'Cancelar',
        isDestructive: true,
        onConfirm: executar,
      });
      return;
    }

    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined'
        ? window.confirm(`Deseja parar de receber despachos para "${categoriaChave}"?`)
        : true;
      if (ok) executar();
      return;
    }

    Alert.alert(
      'Remover Especialidade',
      `Deseja parar de receber despachos para "${categoriaChave}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: executar },
      ]
    );
  };

  const handleSolicitarCategoria = async () => {
    if (!categoriaSelecionada) {
      showToast('Selecione uma especialidade do catálogo.', 'erro');
      return;
    }
    try {
      setSalvandoCategoria(true);
      await solicitarHomologacaoCategoria(categoriaSelecionada, motivoSolicitacao.trim());
      setModalNovaCategoria(false);
      setCategoriaSelecionada('');
      setMotivoSolicitacao('');
      showToast('Solicitação enviada com sucesso! O admin fará a análise.');
      if (perfilPro?.id) {
        const sols = await listarMinhasSolicitacoesCategoria(perfilPro.id);
        setSolicitacoesCategoria(sols);
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao solicitar homologação de categoria', 'erro');
    } finally {
      setSalvandoCategoria(false);
    }
  };

  const handleSalvarPlantao = async () => {
    if (!perfilPro?.id) return;
    try {
      setSalvandoPlantao(true);
      await atualizarPlantaoEmergencia(perfilPro.id, plantao24h, atendeEmergencia);
      showToast('Preferências de plantão e emergência salvas!');
    } catch (err: any) {
      showToast(err?.message || 'Falha ao salvar plantão', 'erro');
    } finally {
      setSalvandoPlantao(false);
    }
  };

  const handleSalvarGradeSemanal = async () => {
    if (!perfilPro?.id) return;
    try {
      setSalvandoGrade(true);
      const padHora = (h: string, fallback: string) => {
        if (!h || !h.trim()) return fallback;
        const limpo = h.trim();
        if (limpo.includes(':')) {
          const partes = limpo.split(':');
          const hh = (partes[0] || '00').padStart(2, '0').slice(-2);
          const mm = (partes[1] || '00').padEnd(2, '0').slice(0, 2);
          return `${hh}:${mm}`;
        }
        const d = limpo.replace(/\D/g, '');
        if (d.length === 4) return `${d.slice(0, 2)}:${d.slice(2)}`;
        return fallback;
      };
      const gradeFormatada = gradeSemanal.map((item) => ({
        ...item,
        horario_inicio: padHora(item.horario_inicio, '08:00'),
        horario_fim: padHora(item.horario_fim, '18:00'),
      }));
      await salvarDisponibilidade(perfilPro.id, gradeFormatada);
      setGradeSemanal(gradeFormatada);
      showToast('Horários de atendimento salvos com sucesso!');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar disponibilidade', 'erro');
    } finally {
      setSalvandoGrade(false);
    }
  };

  const handleToggleDiaGrade = (diaIdx: number) => {
    setGradeSemanal((prev) =>
      prev.map((item) =>
        item.dia_semana === diaIdx ? { ...item, ativo: !item.ativo } : item
      )
    );
  };

  const handleAlterarHorarioGrade = (
    diaIdx: number,
    campo: 'horario_inicio' | 'horario_fim',
    valor: string
  ) => {
    let formatado = valor;
    if (valor.includes(':')) {
      const partes = valor.split(':');
      const hh = partes[0].replace(/\D/g, '').slice(0, 2);
      const mm = (partes[1] || '').replace(/\D/g, '').slice(0, 2);
      formatado = partes.length > 1 ? `${hh}:${mm}` : hh;
    } else {
      const digitos = valor.replace(/\D/g, '').slice(0, 4);
      formatado = digitos.length > 2 ? `${digitos.slice(0, 2)}:${digitos.slice(2)}` : digitos;
    }
    setGradeSemanal((prev) =>
      prev.map((item) =>
        item.dia_semana === diaIdx ? { ...item, [campo]: formatado } : item
      )
    );
  };

  const handleReenviarDocumentoKyc = async (tipoDocumento: string) => {
    if (!perfilPro?.id || !user?.id) return;
    try {
      setEnviandoKyc(tipoDocumento);
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        if (!asset.base64) {
          showToast('Não foi possível processar a imagem do documento.', 'erro');
          return;
        }

        const fileName = `${user.id}/${tipoDocumento}_${Date.now()}.jpg`;
        const buffer = Uint8Array.from(atob(asset.base64), (c) => c.charCodeAt(0));

        const { error: upErr } = await supabase.storage
          .from('kyc-documentos-privados')
          .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });

        if (upErr) throw new Error(upErr.message);

        // Insere registro no banco com status 'em_analise'
        const { error: insErr } = await supabase.from('prestador_documentos').insert({
          prestador_id: perfilPro.id,
          tipo_documento: tipoDocumento,
          arquivo_url: fileName,
          status_verificacao: 'em_analise',
        });

        if (insErr) throw new Error(insErr.message);

        // Atualiza prestador para 'em_analise'
        await supabase
          .from('prestadores')
          .update({ status_cadastro: 'em_analise' })
          .eq('id', perfilPro.id);

        if (perfilPro) {
          setPerfilPro((p) => (p ? { ...p, status_cadastro: 'em_analise' } : null));
        }

        // Recarrega documentos
        const { data: docsAtualizados } = await supabase
          .from('prestador_documentos')
          .select('*')
          .eq('prestador_id', perfilPro.id)
          .order('criado_em', { ascending: false });

        setDocumentosKyc(docsAtualizados || []);
        showToast('Documento enviado com sucesso! Está em análise.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao enviar documento', 'erro');
    } finally {
      setEnviandoKyc(null);
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
        console.warn('Erro ao sair da conta:', err);
      } finally {
        router.replace('/(auth)/login');
      }
    };

    if (showAlert) {
      showAlert({
        title: 'Sair da Conta',
        message: 'Deseja realmente desconectar do Solfy PRO?',
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
        ? window.confirm('Deseja realmente desconectar do Solfy PRO?')
        : true;
      if (confirmou) {
        executarLogout();
      }
      return;
    }

    Alert.alert('Sair da Conta', 'Deseja realmente desconectar do Solfy PRO?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: executarLogout,
      },
    ]);
  };

  const handleLogoutAllDevices = () => {
    const executarLogoutGlobal = async () => {
      try {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        }
        await signOutAllDevices();
      } catch (err) {
        console.warn('Erro ao sair de todos os aparelhos:', err);
      } finally {
        router.replace('/(auth)/login');
      }
    };

    if (showAlert) {
      showAlert({
        title: 'Sair de Todos os Aparelhos',
        message: 'Deseja desconectar sua conta de todos os celulares, tablets e computadores ativos?',
        type: 'confirm',
        confirmText: 'Desconectar Todos',
        cancelText: 'Cancelar',
        isDestructive: true,
        onConfirm: executarLogoutGlobal,
      });
      return;
    }

    if (Platform.OS === 'web') {
      const confirmou = typeof window !== 'undefined'
        ? window.confirm('Deseja realmente desconectar sua conta de todos os aparelhos?')
        : true;
      if (confirmou) {
        executarLogoutGlobal();
      }
      return;
    }

    Alert.alert(
      'Sair de Todos os Aparelhos',
      'Deseja desconectar sua conta de todos os celulares, tablets e computadores ativos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desconectar Todos', style: 'destructive', onPress: executarLogoutGlobal },
      ]
    );
  };

  const handleExportarDados = async () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      const { data, error } = await supabase.rpc('exportar_meus_dados');
      if (error) throw error;
      Alert.alert(
        'Baixar Meus Dados (LGPD)',
        `Seus dados pessoais, cadastrais e histórico foram compilados com sucesso!\n\nID do Titular: ${data?.titular_id || user?.id}\nExportado em: ${new Date().toLocaleString('pt-BR')}`,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      Alert.alert('Erro ao exportar dados', err.message || 'Falha ao processar solicitação.');
    }
  };

  const handleExcluirConta = () => {
    const confirmarExclusao = async () => {
      try {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        }
        const { data, error } = await supabase.rpc('excluir_minha_conta', {
          p_motivo: 'Solicitação do usuário via app móvel Solfy PRO'
        });
        if (error) {
          Alert.alert('Não foi possível excluir', error.message || 'Falha ao solicitar exclusão.');
          return;
        }
        Alert.alert(
          'Conta Excluída',
          'Sua conta e dados pessoais foram excluídos e anonimizados de acordo com a LGPD.',
          [{
            text: 'OK',
            onPress: async () => {
              await signOut();
              router.replace('/(auth)/login');
            }
          }]
        );
      } catch (err: any) {
        Alert.alert('Erro', err.message || 'Falha ao excluir conta.');
      }
    };

    Alert.alert(
      'Excluir Minha Conta (LGPD)',
      'ATENÇÃO: Esta ação é definitiva e irreversível.\n\nTodos os seus dados pessoais, documentos e fotos serão anonimizados e apagados dos nossos servidores.\n\nDeseja realmente prosseguir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir Definitivamente', style: 'destructive', onPress: confirmarExclusao }
      ]
    );
  };

  const filterMatch = (titulo: string, keywords: string) => {
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase().trim();
    return (
      titulo.toLowerCase().includes(termo) ||
      keywords.toLowerCase().includes(termo)
    );
  };

  const nomeExibicao = dadosEditaveis.nome || perfil?.nome_completo || 'Prestador PRO';
  const nomeIniciais = nomeExibicao
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'PR';

  const kycAprovado = perfilPro?.status_cadastro === 'aprovado';

  // ══════════════════════════════════════════════════════════════════════════
  // SUB-TELAS / SEÇÕES DETALHADAS (IGUAL AO CONDO)
  // ══════════════════════════════════════════════════════════════════════════

  // 1. MEU PERFIL PRO
  if (secaoAtiva === 'meu_perfil') {
    return (
      <View style={styles.safeContainer}>
        <View style={subHeaderStyle}>
          <TouchableOpacity style={styles.subBackBtn} onPress={() => setSecaoAtiva(null)}>
            <ArrowLeft size={20} color="#059669" strokeWidth={2.6} />
            <Text style={styles.subBackText}>Config</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>Meu Perfil PRO</Text>
          <TouchableOpacity style={styles.subSaveBtn} onPress={handleSalvarPerfilPro}>
            <Text style={styles.subSaveBtnText}>Salvar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.subScroll} contentContainerStyle={styles.subContent}>
          {/* Avatar com Botão de Trocar Foto */}
          <View style={styles.avatarEditContainer}>
            <View style={styles.avatarLargeCircle}>
              {dadosEditaveis.foto_url ? (
                <Image source={{ uri: dadosEditaveis.foto_url }} style={styles.avatarLargeImg} />
              ) : (
                <Text style={styles.avatarLargeInitials}>{nomeIniciais}</Text>
              )}
              <TouchableOpacity style={styles.avatarCameraBadge} onPress={handleTrocarFoto}>
                <Camera size={16} color="#FFFFFF" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
            <Text style={styles.avatarEditHint}>Toque na câmera para alterar foto profissional</Text>
          </View>

          <View style={styles.cardGroup}>
            <Text style={styles.groupSectionHeader}>Dados Profissionais Editáveis</Text>

            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Nome profissional / Nome fantasia</Text>
              <TextInput
                style={styles.fieldInput}
                value={dadosEditaveis.nome}
                onChangeText={(t) => setDadosEditaveis((p) => ({ ...p, nome: t }))}
                placeholder="Ex.: EletroTech Engenharia"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Especialidade principal</Text>
              <TextInput
                style={styles.fieldInput}
                value={dadosEditaveis.servico}
                onChangeText={(t) => setDadosEditaveis((p) => ({ ...p, servico: t }))}
                placeholder="Ex.: Eletricista Predial"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={[styles.fieldBox, { marginBottom: 0 }]}>
              <Text style={styles.fieldLabel}>Bio e Apresentação para Síndicos</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMultiline]}
                value={dadosEditaveis.bio}
                onChangeText={(t) => setDadosEditaveis((p) => ({ ...p, bio: t }))}
                placeholder="Conte sobre sua experiência, certificações e tempo de mercado..."
                placeholderTextColor="#94A3B8"
                multiline
                scrollEnabled={false}
              />
            </View>
          </View>

          {/* Dados Legais e Cadastrais Somente Leitura */}
          <View style={styles.cardGroup}>
            <Text style={styles.groupSectionHeader}>Dados Cadastrais Oficiais (Somente Leitura)</Text>

            <View style={[styles.fieldBox, { backgroundColor: '#F8FAFC' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.fieldLabel}>Razão Social / Nome Legal</Text>
                <Lock size={12} color="#94A3B8" />
              </View>
              <Text style={[styles.fieldInput, { backgroundColor: '#F1F5F9', color: '#475569' }]}>
                {pjData?.razao_social || (perfilPro as any)?.razao_social || perfil?.nome_completo || 'Não informado'}
              </Text>
            </View>

            <View style={[styles.fieldBox, { backgroundColor: '#F8FAFC' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.fieldLabel}>CPF / CNPJ</Text>
                <Lock size={12} color="#94A3B8" />
              </View>
              <Text style={[styles.fieldInput, { backgroundColor: '#F1F5F9', color: '#0F172A', fontWeight: '600' }]}>
                {documentoOficialExibicao}
              </Text>
            </View>

            <View style={[styles.fieldBox, { backgroundColor: '#F8FAFC' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.fieldLabel}>Tipo de Conta</Text>
                <Lock size={12} color="#94A3B8" />
              </View>
              <Text style={[styles.fieldInput, { backgroundColor: '#F1F5F9', color: '#059669', fontWeight: 'bold' }]}>
                Profissional Homologado Solfy PRO
              </Text>
            </View>

            <View style={[styles.fieldBox, { backgroundColor: '#F8FAFC' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.fieldLabel}>Categoria / Especialidade Homologada</Text>
                <Lock size={12} color="#94A3B8" />
              </View>
              {listaEspecialidadesHomologadas.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {listaEspecialidadesHomologadas.map((cat, idx) => (
                    <View
                      key={idx}
                      style={{
                        backgroundColor: '#ECFDF5',
                        borderWidth: 1,
                        borderColor: '#A7F3D0',
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: '#065F46', fontSize: 13, fontWeight: '700' }}>
                        {cat}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.fieldInput, { backgroundColor: '#F1F5F9', color: '#64748B', fontStyle: 'italic' }]}>
                  Nenhuma especialidade homologada ainda
                </Text>
              )}

            </View>

            <View style={[styles.fieldBox, { backgroundColor: '#F8FAFC' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.fieldLabel}>WhatsApp Comercial (Protegido por SMS)</Text>
                <Lock size={12} color="#94A3B8" />
              </View>
              <Text style={[styles.fieldInput, { backgroundColor: '#F1F5F9', color: '#475569' }]}>
                {dadosEditaveis.telefone || 'Não cadastrado'}
              </Text>
              <TouchableOpacity
                style={{ marginTop: 6, alignSelf: 'flex-start' }}
                onPress={() => setSecaoAtiva('seguranca_senha')}
              >
                <Text style={{ fontSize: 12, color: '#059669', fontWeight: '700' }}>
                  Alterar com SMS na aba Segurança →
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4, lineHeight: 16 }}>
              Para alterar Razão Social, CPF/CNPJ ou dados oficiais de cadastro, entre em contato com o suporte na Central de Ajuda.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // 2. SEGURANÇA & SENHA
  if (secaoAtiva === 'seguranca_senha') {
    return (
      <View style={styles.safeContainer}>
        <View style={subHeaderStyle}>
          <TouchableOpacity style={styles.subBackBtn} onPress={() => setSecaoAtiva(null)}>
            <ArrowLeft size={20} color="#059669" strokeWidth={2.6} />
            <Text style={styles.subBackText}>Config</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>Segurança & Senha</Text>
          <TouchableOpacity
            style={[styles.subSaveBtn, !canSavePassword && { opacity: 0.4 }]}
            disabled={!canSavePassword}
            onPress={handleSalvarSenha}
          >
            <Text style={styles.subSaveBtnText}>Salvar Senha</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.subScroll} contentContainerStyle={styles.subContent}>
          {/* Card 1: Alterar Senha Forte */}
          <View style={styles.cardGroup}>
            <Text style={styles.groupSectionHeader}>Alterar senha (Exige senha atual)</Text>
            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Senha atual</Text>
              <View style={styles.inputWithEyeRow}>
                <TextInput
                  style={styles.inputWithEye}
                  value={senhaAtual}
                  onChangeText={setSenhaAtual}
                  secureTextEntry={!showSenhaAtual}
                  placeholder="Digite sua senha atual"
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity onPress={() => setShowSenhaAtual(!showSenhaAtual)}>
                  <Text style={styles.eyeBtnText}>{showSenhaAtual ? 'Ocultar' : 'Mostrar'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Nova senha (Regra do Servidor)</Text>
              <View style={styles.inputWithEyeRow}>
                <TextInput
                  style={styles.inputWithEye}
                  value={senhaNova}
                  onChangeText={setSenhaNova}
                  secureTextEntry={!showSenhaNova}
                  placeholder="Mínimo de 10 dígitos, maiúscula e número"
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity onPress={() => setShowSenhaNova(!showSenhaNova)}>
                  <Text style={styles.eyeBtnText}>{showSenhaNova ? 'Ocultar' : 'Mostrar'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Medidor 4 Barras */}
            <View style={styles.meterRow}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.meterBar,
                    i < pwStrengthScore && {
                      backgroundColor: ['#EF4444', '#F59E0B', '#EAB308', '#10B981'][pwStrengthScore - 1],
                    },
                  ]}
                />
              ))}
            </View>

            {/* Checklist Alinhado com o Servidor */}
            <View style={styles.rulesList}>
              <View style={styles.ruleItem}>
                <View style={[styles.ruleCircle, pwRules.len && styles.ruleCircleOk]}>
                  {pwRules.len && <Check size={10} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Text style={[styles.ruleText, pwRules.len && styles.ruleTextOk]}>Ao menos 10 caracteres</Text>
              </View>
              <View style={styles.ruleItem}>
                <View style={[styles.ruleCircle, pwRules.up && styles.ruleCircleOk]}>
                  {pwRules.up && <Check size={10} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Text style={[styles.ruleText, pwRules.up && styles.ruleTextOk]}>Uma letra maiúscula</Text>
              </View>
              <View style={styles.ruleItem}>
                <View style={[styles.ruleCircle, pwRules.low && styles.ruleCircleOk]}>
                  {pwRules.low && <Check size={10} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Text style={[styles.ruleText, pwRules.low && styles.ruleTextOk]}>Uma letra minúscula</Text>
              </View>
              <View style={styles.ruleItem}>
                <View style={[styles.ruleCircle, pwRules.num && styles.ruleCircleOk]}>
                  {pwRules.num && <Check size={10} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Text style={[styles.ruleText, pwRules.num && styles.ruleTextOk]}>Um número</Text>
              </View>
            </View>

            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Confirmar nova senha</Text>
              <TextInput
                style={styles.fieldInput}
                value={senhaConfirma}
                onChangeText={setSenhaConfirma}
                secureTextEntry
                placeholder="Repita a nova senha"
                placeholderTextColor="#94A3B8"
              />
              {senhaConfirma.length > 0 && senhaConfirma !== senhaNova && (
                <Text style={styles.errorText}>As senhas não coincidem.</Text>
              )}
            </View>
          </View>

          {/* Card 2: Troca de E-mail (Confirmação Dupla) */}
          <View style={styles.cardGroup}>
            <Text style={styles.groupSectionHeader}>Trocar E-mail de Acesso</Text>
            <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 10 }}>
              E-mail atual: <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>{user?.email || 'Cadastrado no login'}</Text>
            </Text>

            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Novo endereço de e-mail</Text>
              <TextInput
                style={styles.fieldInput}
                value={novoEmail}
                onChangeText={setNovoEmail}
                placeholder="novo.email@empresa.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.btnActionOutline, { marginTop: 8 }, (!novoEmail.trim() || carregandoEmail) && { opacity: 0.5 }]}
              disabled={!novoEmail.trim() || carregandoEmail}
              onPress={handleTrocarEmail}
            >
              <Text style={styles.btnActionOutlineText}>
                {carregandoEmail ? 'Enviando...' : 'Enviar link de confirmação para o novo e-mail'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Card 3: Troca de Telefone (Validação por SMS) */}
          <View style={styles.cardGroup}>
            <Text style={styles.groupSectionHeader}>Trocar Telefone & WhatsApp Comercial</Text>
            <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 10 }}>
              Telefone atual: <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>{dadosEditaveis.telefone || 'Não cadastrado'}</Text>
            </Text>

            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Novo número com DDD</Text>
              <TextInput
                style={styles.fieldInput}
                value={novoTelefone}
                onChangeText={setNovoTelefone}
                placeholder="(11) 99999-9999"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                editable={etapaTelefone === 'inicio'}
              />
            </View>

            {etapaTelefone === 'inicio' ? (
              <TouchableOpacity
                style={[styles.btnActionOutline, { marginTop: 8 }, (!novoTelefone.trim() || carregandoTelefone) && { opacity: 0.5 }]}
                disabled={!novoTelefone.trim() || carregandoTelefone}
                onPress={handleEnviarSmsTelefone}
              >
                <Text style={styles.btnActionOutlineText}>
                  {carregandoTelefone ? 'Enviando SMS...' : 'Enviar Código SMS'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ marginTop: 8 }}>
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldLabel}>Código de 6 dígitos recebido por SMS</Text>
                  <TextInput
                    style={[styles.fieldInput, { letterSpacing: 4, fontWeight: 'bold', textAlign: 'center' }]}
                    value={codigoSms}
                    onChangeText={setCodigoSms}
                    placeholder="123456"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.btnActionOutline, { backgroundColor: '#059669', borderColor: '#059669', marginTop: 8 }]}
                  disabled={carregandoTelefone}
                  onPress={handleConfirmarSmsTelefone}
                >
                  <Text style={[styles.btnActionOutlineText, { color: '#FFFFFF' }]}>
                    {carregandoTelefone ? 'Verificando...' : 'Confirmar e Atualizar Telefone'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ marginTop: 8, alignItems: 'center' }}
                  onPress={() => setEtapaTelefone('inicio')}
                >
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Digitar outro número</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Card 4: Aparelhos Conectados Reais (dispositivos_sessao) */}
          <View style={styles.cardGroup}>
            <Text style={styles.groupSectionHeader}>Aparelhos conectados ({sessoes.length})</Text>
            {sessoes.map((s) => (
              <View key={s.id} style={styles.sessionRow}>
                <View style={styles.sessionIconBox}>
                  {s.dispositivo === 'mobile' ? (
                    <Smartphone size={18} color="#64748B" />
                  ) : (
                    <Laptop size={18} color="#64748B" />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.sessionTitle}>{s.dispositivo_info || 'Dispositivo Solfy'}</Text>
                  <Text style={styles.sessionMeta}>
                    {s.atual ? 'Sessão ativa neste aparelho' : `Último acesso: ${new Date(s.ultima_atividade).toLocaleDateString('pt-BR')}`}
                  </Text>
                </View>
                {s.atual ? (
                  <View style={styles.tagGreen}>
                    <Text style={styles.tagGreenText}>Atual</Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => handleEncerrarSessaoRemota(s.id)}>
                    <Text style={styles.textRedAction}>Desconectar</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {sessoes.length > 1 && (
              <TouchableOpacity
                style={[styles.btnActionOutlineRed, { marginTop: 12 }]}
                onPress={handleEncerrarOutrasSessoes}
              >
                <Text style={styles.btnActionOutlineRedText}>Desconectar todos os outros aparelhos</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.logoutAllButton, { marginTop: 14 }]}
              activeOpacity={0.8}
              onPress={handleLogoutAllDevices}
            >
              <Shield size={18} color="#D97706" strokeWidth={2.2} />
              <Text style={styles.logoutAllText}>Sair de todos os aparelhos</Text>
            </TouchableOpacity>
          </View>

          {/* Card 5: Zona de Perigo - Exclusão de Conta (LGPD) */}
          <View style={[styles.cardGroup, { marginTop: 16, borderColor: '#FEE2E2', borderWidth: 1 }]}>
            <Text style={[styles.groupSectionHeader, { color: '#991B1B' }]}>Zona de Risco</Text>
            <Text style={{ fontSize: 11.5, color: '#64748B', lineHeight: 17, marginBottom: 14 }}>
              Ao solicitar a exclusão da sua conta, seu cadastro, acessos e vínculos com condomínios serão anonimizados permanentemente conforme as diretrizes da LGPD.
            </Text>
            <TouchableOpacity style={styles.lgpdDeleteButton} activeOpacity={0.8} onPress={handleExcluirConta}>
              <Trash2 size={16} color="#991B1B" strokeWidth={2} />
              <Text style={styles.lgpdDeleteText}>Excluir Minha Conta (LGPD)</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // 2.5 REPUTAÇÃO & AVALIAÇÕES (FASE 2)
  if (secaoAtiva === 'reputacao_avaliacoes') {
    return (
      <View style={styles.safeContainer}>
        <View style={subHeaderStyle}>
          <TouchableOpacity style={styles.subBackBtn} onPress={() => setSecaoAtiva(null)}>
            <ArrowLeft size={20} color="#059669" strokeWidth={2.6} />
            <Text style={styles.subBackText}>Config</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>Pontuação & Avaliações</Text>
          <View style={{ width: 60 }} />
        </View>
        <SecaoReputacaoAvaliacoes
          prestadorId={perfilPro?.id || ''}
          ratingAtual={perfilPro?.rating || 5.0}
          onVoltar={() => setSecaoAtiva(null)}
        />
      </View>
    );
  }

  // 3. NOTIFICAÇÕES
  if (secaoAtiva === 'notificacoes') {
    return (
      <View style={styles.safeContainer}>
        <View style={subHeaderStyle}>
          <TouchableOpacity style={styles.subBackBtn} onPress={() => setSecaoAtiva(null)}>
            <ArrowLeft size={20} color="#059669" strokeWidth={2.6} />
            <Text style={styles.subBackText}>Config</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>Notificações</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.subScroll} contentContainerStyle={styles.subContent}>
          <Text style={styles.autoSavedHint}>Salvas automaticamente no seu aparelho.</Text>

          <View style={styles.cardGroup}>
            <Text style={styles.groupSectionHeader}>Alertas no Celular (Push)</Text>

            <View style={styles.switchRowContainer}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowTitleBold}>Novos despachos</Text>
                <Text style={styles.rowSubtitle}>Aviso imediato quando um condomínio solicitar serviço</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggleSwitch, notificacoes.demandas && styles.toggleSwitchOn]}
                onPress={() => handleToggleNotificacao('demandas')}
              >
                <View style={[styles.toggleCircle, notificacoes.demandas && styles.toggleCircleOn]} />
              </TouchableOpacity>
            </View>

            <View style={styles.switchRowContainer}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowTitleBold}>Mensagens no Chat</Text>
                <Text style={styles.rowSubtitle}>Avisos em tempo real de mensagens de síndicos</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggleSwitch, notificacoes.chat && styles.toggleSwitchOn]}
                onPress={() => handleToggleNotificacao('chat')}
              >
                <View style={[styles.toggleCircle, notificacoes.chat && styles.toggleCircleOn]} />
              </TouchableOpacity>
            </View>

            <View style={styles.switchRowContainer}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowTitleBold}>Lembretes de visitas técnicas</Text>
                <Text style={styles.rowSubtitle}>Notificação 1 hora antes do horário agendado</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggleSwitch, notificacoes.visitas && styles.toggleSwitchOn]}
                onPress={() => handleToggleNotificacao('visitas')}
              >
                <View style={[styles.toggleCircle, notificacoes.visitas && styles.toggleCircleOn]} />
              </TouchableOpacity>
            </View>

            <View style={styles.switchRowContainer}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowTitleBold}>Horário silencioso</Text>
                <Text style={styles.rowSubtitle}>Silenciar alertas entre 22:00 e 07:00</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggleSwitch, notificacoes.silencioso && styles.toggleSwitchOn]}
                onPress={() => handleToggleNotificacao('silencioso')}
              >
                <View style={[styles.toggleCircle, notificacoes.silencioso && styles.toggleCircleOn]} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.btnActionOutline} onPress={handleEnviarNotificacaoTeste}>
            <Text style={styles.btnActionOutlineText}>Enviar notificação de teste</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // 4. CENTRAL DE AJUDA & FAQ
  if (secaoAtiva === 'central_ajuda') {
    return (
      <View style={styles.safeContainer}>
        <View style={subHeaderStyle}>
          <TouchableOpacity style={styles.subBackBtn} onPress={() => setSecaoAtiva(null)}>
            <ArrowLeft size={20} color="#059669" strokeWidth={2.6} />
            <Text style={styles.subBackText}>Config</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>Central de Ajuda</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.subScroll} contentContainerStyle={styles.subContent}>
          <View style={styles.cardGroup}>
            <Text style={styles.groupSectionHeader}>Dúvidas Frequentes do Prestador</Text>
            {FAQ_PRESTADOR.map((faq, i) => (
              <View key={i} style={styles.faqItemBox}>
                <Text style={styles.faqQuestion}>{faq.q}</Text>
                <Text style={styles.faqAnswer}>{faq.a}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // 5. TERMO DE ADESÃO
  if (secaoAtiva === 'termos') {
    return (
      <View style={styles.safeContainer}>
        <View style={subHeaderStyle}>
          <TouchableOpacity style={styles.subBackBtn} onPress={() => setSecaoAtiva(null)}>
            <ArrowLeft size={20} color="#059669" strokeWidth={2.6} />
            <Text style={styles.subBackText}>Config</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>Termo de Adesão</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.subScroll} contentContainerStyle={styles.subContent}>
          <View style={styles.cardGroup}>
            <Text style={styles.groupSectionHeader}>Termo de Aceite Digital — Solfy PRO</Text>
            <Text style={styles.termoIntegralText}>{TEXTO_TERMO_CNPJ_GRANDE_V1}</Text>
          </View>

          <View style={[styles.cardGroup, { marginTop: 16 }]}>
            <Text style={styles.groupSectionHeader}>Privacidade e Dados Pessoais (LGPD)</Text>
            <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 18, marginBottom: 14 }}>
              Em conformidade com a LGPD (Lei Geral de Proteção de Dados), você pode solicitar o download completo de todos os seus dados cadastrais, logs de atividade e histórico de serviços.
            </Text>
            <TouchableOpacity style={styles.lgpdDownloadButton} activeOpacity={0.8} onPress={handleExportarDados}>
              <Download size={16} color="#0C2617" strokeWidth={2} />
              <Text style={styles.lgpdDownloadText}>Baixar Meus Dados (LGPD)</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // 6. ESPECIALIDADES & RAIO DE ATENDIMENTO
  if (secaoAtiva === 'especialidades_raio') {
    const catsAtendidas = listaEspecialidadesHomologadas.length > 0 ? listaEspecialidadesHomologadas : (perfilPro?.categorias_atendidas || [dadosEditaveis.servico].filter(Boolean));
    const categoriasDisponiveis = catalogoCategorias.filter(
      (c) =>
        !catsAtendidas.includes(c.chave) &&
        !solicitacoesCategoria.some((s) => s.categoria_chave === c.chave && s.status === 'em_analise')
    );

    return (
      <View style={styles.safeContainer}>
        <View style={subHeaderStyle}>
          <TouchableOpacity style={styles.subBackBtn} onPress={() => setSecaoAtiva(null)}>
            <ArrowLeft size={20} color="#059669" strokeWidth={2.6} />
            <Text style={styles.subBackText}>Config</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>Especialidades & Raio</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.subScroll} contentContainerStyle={styles.subContent}>
          {/* Card 1: Raio de Atendimento com Limite no Servidor */}
          <View style={styles.cardGroup}>
            <Text style={styles.groupSectionHeader}>Perímetro de Atendimento (1 a 50 km)</Text>

            <View style={styles.raioDisplayBox}>
              <View style={styles.raioIconCircle}>
                <MapPin size={24} color="#059669" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.raioValorDestaque}>{raioEditavel} km</Text>
                <Text style={styles.raioDescricao}>
                  Você receberá solicitações de condomínios situados a até {raioEditavel} km da sua base.
                </Text>
              </View>
            </View>

            {/* Stepper de Ajuste do Raio */}
            <View style={styles.raioStepperRow}>
              <TouchableOpacity
                style={[styles.raioStepperBtn, raioEditavel <= 1 && styles.raioStepperBtnDisabled]}
                disabled={raioEditavel <= 1}
                onPress={() => setRaioEditavel((r) => Math.max(1, r - 5))}
              >
                <Minus size={18} color={raioEditavel <= 1 ? '#CBD5E1' : '#0F172A'} strokeWidth={2.6} />
                <Text style={[styles.raioStepperBtnText, raioEditavel <= 1 && { color: '#CBD5E1' }]}>- 5 km</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.raioStepperBtn, raioEditavel >= 50 && styles.raioStepperBtnDisabled]}
                disabled={raioEditavel >= 50}
                onPress={() => setRaioEditavel((r) => Math.min(50, r + 5))}
              >
                <Plus size={18} color={raioEditavel >= 50 ? '#CBD5E1' : '#0F172A'} strokeWidth={2.6} />
                <Text style={[styles.raioStepperBtnText, raioEditavel >= 50 && { color: '#CBD5E1' }]}>+ 5 km</Text>
              </TouchableOpacity>
            </View>

            {/* Chips de Atalho Rápido */}
            <View style={styles.chipsAtalhoRow}>
              {[5, 15, 30, 40, 50].map((km) => (
                <TouchableOpacity
                  key={km}
                  style={[styles.chipAtalhoKm, raioEditavel === km && styles.chipAtalhoKmAtivo]}
                  onPress={() => setRaioEditavel(km)}
                >
                  <Text style={[styles.chipAtalhoKmText, raioEditavel === km && styles.chipAtalhoKmTextAtivo]}>
                    {km} km{km === 50 ? ' (máx)' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.btnActionPrimary, salvandoRaio && { opacity: 0.6 }]}
              disabled={salvandoRaio}
              onPress={handleSalvarRaio}
            >
              <Text style={styles.btnActionPrimaryText}>
                {salvandoRaio ? 'Salvando...' : 'Salvar Raio de Atendimento'}
              </Text>
            </TouchableOpacity>

            <View style={styles.infoBoxGray}>
              <Text style={styles.infoBoxGrayText}>
                🛡️ Limite regulatório: O raio máximo é de 50 km para manter alta pontuação de pontualidade no despacho. Tentativas de cadastro superior a 50 km são rejeitadas pelo servidor.
              </Text>
            </View>
          </View>

          {/* Card 2: Especialidades Homologadas (Ativas) */}
          <View style={styles.cardGroup}>
            <Text style={styles.groupSectionHeader}>Especialidades Homologadas</Text>
            <Text style={styles.groupSectionSub}>
              Categorias em que você está apto a receber pedidos imediatamente.
            </Text>

            {catsAtendidas.length === 0 ? (
              <Text style={styles.emptyListText}>Nenhuma especialidade cadastrada.</Text>
            ) : (
              catsAtendidas.map((cat, idx) => (
                <View key={idx} style={styles.categoriaItemRow}>
                  <View style={styles.categoriaIconSquircle}>
                    <Wrench size={18} color="#7C3AED" strokeWidth={2.4} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.categoriaNomeText}>{cat}</Text>
                    <Text style={styles.categoriaStatusAtiva}>Apta para despacho</Text>
                  </View>
                  <View style={styles.tagGreen}>
                    <Text style={styles.tagGreenText}>Homologada</Text>
                  </View>
                  {catsAtendidas.length > 1 && (
                    <TouchableOpacity
                      style={styles.categoriaRemoveBtn}
                      onPress={() => handleRemoverCategoria(cat)}
                    >
                      <Trash2 size={16} color="#EF4444" strokeWidth={2.2} />
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>

          {/* Card 3: Solicitações em Análise pelo Admin */}
          <View style={styles.cardGroup}>
            <Text style={styles.groupSectionHeader}>Solicitações em Homologação (Admin)</Text>
            <Text style={styles.groupSectionSub}>
              Novas categorias solicitadas que aguardam aprovação técnica.
            </Text>

            {solicitacoesCategoria.length === 0 ? (
              <View style={styles.emptySolicitacoesBox}>
                <Clock size={20} color="#94A3B8" />
                <Text style={styles.emptySolicitacoesText}>Nenhuma solicitação pendente no momento.</Text>
              </View>
            ) : (
              solicitacoesCategoria.map((sol) => (
                <View key={sol.id} style={styles.solicitacaoItemBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.solicitacaoCategoriaChave}>{sol.categoria_chave}</Text>
                    <View
                      style={[
                        styles.badgeStatusBase,
                        sol.status === 'aprovada'
                          ? styles.badgeStatusAprovada
                          : sol.status === 'recusada'
                          ? styles.badgeStatusRecusada
                          : styles.badgeStatusAnalise,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeStatusBaseText,
                          sol.status === 'aprovada'
                            ? styles.badgeTextAprovada
                            : sol.status === 'recusada'
                            ? styles.badgeTextRecusada
                            : styles.badgeTextAnalise,
                        ]}
                      >
                        {sol.status === 'aprovada'
                          ? 'Aprovada'
                          : sol.status === 'recusada'
                          ? 'Recusada'
                          : 'Em Análise pelo Admin'}
                      </Text>
                    </View>
                  </View>
                  {(sol.motivo_solicitacao || (sol as any).motivo) ? (
                    <Text style={styles.solicitacaoMotivoText}>Justificativa: {sol.motivo_solicitacao || (sol as any).motivo}</Text>
                  ) : null}
                  {sol.status === 'recusada' && sol.motivo_recusa ? (
                    <View style={styles.recusaAlertaBox}>
                      <AlertCircle size={14} color="#DC2626" />
                      <Text style={styles.recusaAlertaText}>
                        Motivo da recusa: {sol.motivo_recusa}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.solicitacaoDataText}>
                    Solicitado em {new Date(sol.solicitado_em).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
              ))
            )}

            <TouchableOpacity
              style={styles.btnActionOutline}
              onPress={() => setModalNovaCategoria(true)}
            >
              <Plus size={16} color="#059669" strokeWidth={2.4} />
              <Text style={styles.btnActionOutlineText}>Solicitar nova especialidade</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Modal: Solicitar Nova Categoria */}
        <Modal
          visible={modalNovaCategoria}
          animationType="slide"
          transparent
          onRequestClose={() => setModalNovaCategoria(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContentCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Solicitar Especialidade</Text>
                <TouchableOpacity onPress={() => setModalNovaCategoria(false)}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDesc}>
                Escolha a categoria técnica que você deseja homologar. A inclusão é julgada pela administração antes de liberar despachos.
              </Text>

              <Text style={styles.fieldLabel}>Selecione a categoria técnica:</Text>
              <ScrollView style={{ maxHeight: 180, marginBottom: 12 }}>
                {categoriasDisponiveis.length === 0 ? (
                  <Text style={styles.emptyListText}>Todas as categorias do catálogo já foram solicitadas.</Text>
                ) : (
                  categoriasDisponiveis.map((c) => (
                    <TouchableOpacity
                      key={c.chave}
                      style={[
                        styles.catOptionItem,
                        categoriaSelecionada === c.chave && styles.catOptionItemSelecionada,
                      ]}
                      onPress={() => setCategoriaSelecionada(c.chave)}
                    >
                      <Text
                        style={[
                          styles.catOptionItemText,
                          categoriaSelecionada === c.chave && styles.catOptionItemTextSelecionada,
                        ]}
                      >
                        {c.label} ({c.chave})
                      </Text>
                      {categoriaSelecionada === c.chave && (
                        <Check size={16} color="#059669" strokeWidth={2.8} />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              <View style={styles.fieldBox}>
                <Text style={styles.fieldLabel}>Qualificações ou Certificados (opcional):</Text>
                <TextInput
                  style={[styles.fieldInput, { height: 72, textAlignVertical: 'top' }]}
                  placeholder="Ex.: Tenho 6 anos de experiência com instalações prediais e curso NR-10..."
                  placeholderTextColor="#94A3B8"
                  value={motivoSolicitacao}
                  onChangeText={setMotivoSolicitacao}
                  multiline
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.modalBtnCancel, { flex: 1 }]}
                  onPress={() => setModalNovaCategoria(false)}
                >
                  <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btnActionPrimary,
                    { flex: 1.5 },
                    (!categoriaSelecionada || salvandoCategoria) && { opacity: 0.5 },
                  ]}
                  disabled={!categoriaSelecionada || salvandoCategoria}
                  onPress={handleSolicitarCategoria}
                >
                  <Text style={styles.btnActionPrimaryText}>
                    {salvandoCategoria ? 'Enviando...' : 'Enviar para o Admin'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // 7. DISPONIBILIDADE SEMANAL & PLANTÃO 24H
  if (secaoAtiva === 'disponibilidade') {
    const DIAS_NOMES = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ];

    return (
      <View style={styles.safeContainer}>
        <View style={subHeaderStyle}>
          <TouchableOpacity style={styles.subBackBtn} onPress={() => setSecaoAtiva(null)}>
            <ArrowLeft size={20} color="#059669" strokeWidth={2.6} />
            <Text style={styles.subBackText}>Config</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>Disponibilidade & Plantão</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.subScroll} contentContainerStyle={styles.subContent}>
          {/* Card 1: Plantão 24h & Chamados de Emergência Unificado */}
          <View style={styles.cardGroup}>
            <Text style={styles.groupSectionHeader}>Plantão 24h & Emergência</Text>
            <Text style={styles.groupSectionSub}>
              Habilite o recebimento de despachos urgentes de condomínios fora do horário comercial.
            </Text>

            <View style={styles.switchRowContainer}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowTitleBold}>Disponibilidade 24h para Emergências</Text>
                <Text style={styles.rowSubtitle}>
                  Ficar elegível no motor de despacho para panes graves, vazamentos e emergências prediais a qualquer horário.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.toggleSwitch, (plantao24h || atendeEmergencia) && styles.toggleSwitchOn]}
                onPress={() => {
                  const novoEstado = !(plantao24h || atendeEmergencia);
                  setPlantao24h(novoEstado);
                  setAtendeEmergencia(novoEstado);
                }}
              >
                <View style={[styles.toggleCircle, (plantao24h || atendeEmergencia) && styles.toggleCircleOn]} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.btnActionPrimary, salvandoPlantao && { opacity: 0.6 }]}
              disabled={salvandoPlantao}
              onPress={handleSalvarPlantao}
            >
              <Text style={styles.btnActionPrimaryText}>
                {salvandoPlantao ? 'Salvando...' : 'Salvar Preferências de Plantão'}
              </Text>
            </TouchableOpacity>

            <View style={styles.infoBoxAmber}>
              <AlertTriangle size={16} color="#D97706" />
              <Text style={styles.infoBoxAmberText}>
                Regra Solfy: Ao ativar o plantão de emergência, você assume o compromisso de responder aos chamados dentro do prazo de aceite configurado para cada categoria de serviço. Atrasos reiterados podem suspender temporariamente o recebimento de emergências.
              </Text>
            </View>
          </View>

          {/* Card 2: Grade Semanal de Atendimento (7 Dias) */}
          <View style={styles.cardGroup}>
            <Text style={styles.groupSectionHeader}>Grade Semanal de Trabalho</Text>
            <Text style={styles.groupSectionSub}>
              Defina os dias da semana e horários em que você aceita visitas técnicas e atendimentos regulares.
            </Text>

            {gradeSemanal.map((item) => (
              <View key={item.dia_semana} style={styles.diaGradeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.diaGradeNome}>{DIAS_NOMES[item.dia_semana]}</Text>
                  {item.ativo ? (
                    <View style={styles.horariosInputRow}>
                      <TextInput
                        style={styles.horarioInput}
                        value={item.horario_inicio || ''}
                        onChangeText={(t) => handleAlterarHorarioGrade(item.dia_semana, 'horario_inicio', t)}
                        placeholder="08:00"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                      />
                      <Text style={styles.horariosSeparador}>até</Text>
                      <TextInput
                        style={styles.horarioInput}
                        value={item.horario_fim || ''}
                        onChangeText={(t) => handleAlterarHorarioGrade(item.dia_semana, 'horario_fim', t)}
                        placeholder="18:00"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                      />
                    </View>
                  ) : (
                    <Text style={styles.diaFolgaText}>Folga / Indisponível</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.toggleSwitch, item.ativo && styles.toggleSwitchOn]}
                  onPress={() => handleToggleDiaGrade(item.dia_semana)}
                >
                  <View style={[styles.toggleCircle, item.ativo && styles.toggleCircleOn]} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.btnActionPrimary, salvandoGrade && { opacity: 0.6 }]}
              disabled={salvandoGrade}
              onPress={handleSalvarGradeSemanal}
            >
              <Text style={styles.btnActionPrimaryText}>
                {salvandoGrade ? 'Salvando...' : 'Salvar Grade Semanal'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // 8. DOCUMENTOS & HOMOLOGAÇÃO KYC
  if (secaoAtiva === 'documentos_kyc') {
    const statusGeral = perfilPro?.status_cadastro || 'em_analise';
    const isAprovado = statusGeral === 'aprovado';
    const isEmAnalise = statusGeral === 'em_analise';
    const isRejeitado = statusGeral === 'rejeitado';

    const getDocItem = (tipo: string) => {
      return documentosKyc.find((d) => d.tipo_documento === tipo);
    };

    const docFrente = getDocItem('doc_frente');
    const docVerso = getDocItem('doc_verso');
    const docSelfie = getDocItem('selfie_documento');
    const docPj = getDocItem('contrato_social') || getDocItem('pj');

    return (
      <View style={styles.safeContainer}>
        <View style={subHeaderStyle}>
          <TouchableOpacity style={styles.subBackBtn} onPress={() => setSecaoAtiva(null)}>
            <ArrowLeft size={20} color="#059669" strokeWidth={2.6} />
            <Text style={styles.subBackText}>Config</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>Documentos & KYC</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.subScroll} contentContainerStyle={styles.subContent}>
          {/* Card 1: Status Geral da Homologação Cadastral */}
          <View style={styles.cardGroup}>
            <Text style={styles.groupSectionHeader}>Status da Homologação</Text>

            <View
              style={[
                styles.kycStatusBanner,
                isAprovado
                  ? styles.kycStatusAprovado
                  : isRejeitado
                  ? styles.kycStatusRejeitado
                  : styles.kycStatusAnalise,
              ]}
            >
              {isAprovado ? (
                <ShieldCheck size={28} color="#166534" strokeWidth={2.4} />
              ) : isRejeitado ? (
                <AlertCircle size={28} color="#DC2626" strokeWidth={2.4} />
              ) : (
                <Clock size={28} color="#D97706" strokeWidth={2.4} />
              )}
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text
                  style={[
                    styles.kycStatusTitle,
                    isAprovado
                      ? { color: '#166534' }
                      : isRejeitado
                      ? { color: '#DC2626' }
                      : { color: '#D97706' },
                  ]}
                >
                  {isAprovado
                    ? 'Conta Homologada & Aprovada'
                    : isRejeitado
                    ? 'Documentação com Pendência'
                    : 'Documentação em Análise'}
                </Text>
                <Text style={styles.kycStatusDesc}>
                  {isAprovado
                    ? 'Seus documentos foram auditados e aprovados pela equipe Solfy. Você está 100% ativo para cotações e despachos.'
                    : isRejeitado
                    ? 'Algum documento não pôde ser verificado. Veja o detalhe abaixo e envie nova foto nítida para reanálise.'
                    : 'Nossa equipe técnica analisa os documentos em até 24h úteis. Você será avisado assim que o cadastro for liberado.'}
                </Text>
              </View>
            </View>

            <View style={styles.infoBoxGray}>
              <Text style={styles.infoBoxGrayText}>
                🔒 Segurança Bancária: Os documentos são armazenados com criptografia de ponta a ponta no bucket privado seguro e são acessados unicamente pela mesa de conformidade da Solfy.
              </Text>
            </View>
          </View>

          {/* Card 2: Lista dos Documentos KYC */}
          <View style={styles.cardGroup}>
            <Text style={styles.groupSectionHeader}>Documentos Enviados</Text>

            {/* Doc Frente */}
            <View style={styles.docKycItemBox}>
              <View style={styles.docKycHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docKycTitulo}>1. Documento de Identidade (Frente)</Text>
                  <Text style={styles.docKycSub}>RG ou CNH aberta e nítida</Text>
                </View>
                <View
                  style={[
                    styles.badgeStatusBase,
                    docFrente?.status_verificacao === 'aprovado'
                      ? styles.badgeStatusAprovada
                      : docFrente?.status_verificacao === 'recusado'
                      ? styles.badgeStatusRecusada
                      : styles.badgeStatusAnalise,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeStatusBaseText,
                      docFrente?.status_verificacao === 'aprovado'
                        ? styles.badgeTextAprovada
                        : docFrente?.status_verificacao === 'recusado'
                        ? styles.badgeTextRecusada
                        : styles.badgeTextAnalise,
                    ]}
                  >
                    {docFrente?.status_verificacao === 'aprovado'
                      ? 'Aprovado'
                      : docFrente?.status_verificacao === 'recusado'
                      ? 'Recusado'
                      : 'Em Análise'}
                  </Text>
                </View>
              </View>
              {docFrente?.motivo_rejeicao ? (
                <Text style={styles.docMotivoRejeicaoText}>Motivo: {docFrente.motivo_rejeicao}</Text>
              ) : null}

            </View>

            {/* Doc Verso */}
            <View style={styles.docKycItemBox}>
              <View style={styles.docKycHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docKycTitulo}>2. Documento de Identidade (Verso)</Text>
                  <Text style={styles.docKycSub}>Verso legível com número do órgão expedidor</Text>
                </View>
                <View
                  style={[
                    styles.badgeStatusBase,
                    docVerso?.status_verificacao === 'aprovado'
                      ? styles.badgeStatusAprovada
                      : docVerso?.status_verificacao === 'recusado'
                      ? styles.badgeStatusRecusada
                      : styles.badgeStatusAnalise,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeStatusBaseText,
                      docVerso?.status_verificacao === 'aprovado'
                        ? styles.badgeTextAprovada
                        : docVerso?.status_verificacao === 'recusado'
                        ? styles.badgeTextRecusada
                        : styles.badgeTextAnalise,
                    ]}
                  >
                    {docVerso?.status_verificacao === 'aprovado'
                      ? 'Aprovado'
                      : docVerso?.status_verificacao === 'recusado'
                      ? 'Recusado'
                      : 'Em Análise'}
                  </Text>
                </View>
              </View>
              {docVerso?.motivo_rejeicao ? (
                <Text style={styles.docMotivoRejeicaoText}>Motivo: {docVerso.motivo_rejeicao}</Text>
              ) : null}

            </View>

            {/* Selfie Segurando o Documento */}
            <View style={styles.docKycItemBox}>
              <View style={styles.docKycHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docKycTitulo}>3. Selfie com o Documento</Text>
                  <Text style={styles.docKycSub}>Rosto nítido segurando o documento de identidade</Text>
                </View>
                <View
                  style={[
                    styles.badgeStatusBase,
                    docSelfie?.status_verificacao === 'aprovado'
                      ? styles.badgeStatusAprovada
                      : docSelfie?.status_verificacao === 'recusado'
                      ? styles.badgeStatusRecusada
                      : styles.badgeStatusAnalise,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeStatusBaseText,
                      docSelfie?.status_verificacao === 'aprovado'
                        ? styles.badgeTextAprovada
                        : docSelfie?.status_verificacao === 'recusado'
                        ? styles.badgeTextRecusada
                        : styles.badgeTextAnalise,
                    ]}
                  >
                    {docSelfie?.status_verificacao === 'aprovado'
                      ? 'Aprovado'
                      : docSelfie?.status_verificacao === 'recusado'
                      ? 'Recusado'
                      : 'Em Análise'}
                  </Text>
                </View>
              </View>
              {docSelfie?.motivo_rejeicao ? (
                <Text style={styles.docMotivoRejeicaoText}>Motivo: {docSelfie.motivo_rejeicao}</Text>
              ) : null}

            </View>

            {/* PJ se aplicável */}
            {pjData && (
              <View style={styles.docKycItemBox}>
                <View style={styles.docKycHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docKycTitulo}>4. Cartão CNPJ / Contrato Social</Text>
                    <Text style={styles.docKycSub}>Documento da empresa cadastrada</Text>
                  </View>
                  <View
                    style={[
                      styles.badgeStatusBase,
                      docPj?.status_verificacao === 'aprovado'
                        ? styles.badgeStatusAprovada
                        : docPj?.status_verificacao === 'recusado'
                        ? styles.badgeStatusRecusada
                        : styles.badgeStatusAnalise,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeStatusBaseText,
                        docPj?.status_verificacao === 'aprovado'
                          ? styles.badgeTextAprovada
                          : docPj?.status_verificacao === 'recusado'
                          ? styles.badgeTextRecusada
                          : styles.badgeTextAnalise,
                      ]}
                    >
                      {docPj?.status_verificacao === 'aprovado'
                        ? 'Aprovado'
                        : docPj?.status_verificacao === 'recusado'
                        ? 'Recusado'
                        : 'Em Análise'}
                    </Text>
                  </View>
                </View>

              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: TELA PRINCIPAL DO HUB (CONFIGURAÇÕES - EXATAMENTE IGUAL AO CONDO)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <View style={styles.safeContainer}>
      {/* Toast Notificação Superior */}
      {toast.visivel && (
        <View style={styles.toastPopup}>
          <CheckCircle2 size={18} color="#34D399" strokeWidth={2.4} />
          <Text style={styles.toastText}>{toast.mensagem}</Text>
        </View>
      )}

      {/* Header Principal Padronizado */}
      <View style={[styles.mainHeaderTitleBox, { paddingTop: headerPaddingTop }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.mainHeaderTitle}>Configurações</Text>
          <Text style={styles.mainHeaderSubtitle} numberOfLines={1}>
            Conta, empresa e preferências
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[styles.mainScrollContent, { paddingBottom: 110 + Math.max(insets.bottom, 24) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Banner Offline */}
        {offline && (
          <View style={styles.offlineBannerBox}>
            <WifiOff size={18} color="#D97706" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.offlineBannerTitle}>Você está sem conexão</Text>
              <Text style={styles.offlineBannerDesc}>
                Mostrando dados em cache. Alterações exigem internet.
              </Text>
            </View>
          </View>
        )}

        {/* Card do Perfil do Prestador (.me) */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.profileTopRow}
            activeOpacity={0.8}
            onPress={() => setSecaoAtiva('meu_perfil')}
          >
            <View style={styles.profileAvatarBox}>
              {dadosEditaveis.foto_url ? (
                <Image source={{ uri: dadosEditaveis.foto_url }} style={styles.profileAvatarImg} />
              ) : (
                <Text style={styles.profileAvatarInitials}>{nomeIniciais}</Text>
              )}
            </View>

            <View style={styles.profileInfoCol}>
              <Text style={styles.profileNameText} numberOfLines={1}>
                {nomeExibicao}
              </Text>
              <Text style={styles.profileEmailText} numberOfLines={1}>
                {dadosEditaveis.servico || user?.email || 'Prestador Solfy PRO'}
              </Text>
              <View style={styles.profileChipsRow}>
                <View style={styles.chipRole}>
                  <Text style={styles.chipRoleText}>
                    Nível {(perfilPro?.nivel || 'BRONZE').toUpperCase()}
                  </Text>
                </View>
                <View style={kycAprovado ? styles.chipVerified : styles.chipPending}>
                  <ShieldCheck size={12} color={kycAprovado ? '#166534' : '#D97706'} strokeWidth={2.8} />
                  <Text style={kycAprovado ? styles.chipVerifiedText : styles.chipPendingText}>
                    {kycAprovado ? 'Verificado' : 'Em análise'}
                  </Text>
                </View>
              </View>
            </View>

            <ChevronRight size={20} color="#94A3B8" />
          </TouchableOpacity>

          {/* Barra de Completude */}
          <TouchableOpacity
            style={styles.profileCompletionRow}
            activeOpacity={0.8}
            onPress={() => setSecaoAtiva('meu_perfil')}
          >
            <View style={styles.profileCompletionHeader}>
              <Text style={styles.profileCompletionTitle}>
                {percentualCompletude === 100
                  ? 'Perfil completo'
                  : `Complete seu perfil (${percentualCompletude}%)`}
              </Text>
              {percentualCompletude < 100 ? (
                <Text style={[styles.profileCompletionCta, { color: corCompletude }]}>Completar</Text>
              ) : (
                <Check size={16} color="#166534" strokeWidth={3} />
              )}
            </View>
            <View style={styles.profileCompletionTrack}>
              <View style={[styles.profileCompletionFill, { width: `${percentualCompletude}%`, backgroundColor: corCompletude }]} />
            </View>
            {percentualCompletude < 100 && (
              <Text style={styles.profileCompletionTip} numberOfLines={1}>
                Falta: {itensFaltantes[0]}
                {itensFaltantes.length > 1 ? ` e mais ${itensFaltantes.length - 1}` : ''}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Campo de Busca (.search) */}
        <View style={styles.searchWrap}>
          <Search size={17} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar (senha, raio, extrato, termos...)"
            placeholderTextColor="#94A3B8"
          />
          {busca.length > 0 && (
            <TouchableOpacity style={styles.searchClearBtn} onPress={() => setBusca('')}>
              <X size={12} color="#FFFFFF" strokeWidth={3} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── GRUPO 1: CONTA & ATUAÇÃO PROFISSIONAL ── */}
        <View style={styles.configGroup}>
          <Text style={styles.groupTitleText}>Conta & Atuação</Text>
          <View style={styles.groupCard}>
            {filterMatch('Meu Perfil PRO', 'foto telefone servico bio nome') && (
              <TouchableOpacity
                style={styles.rowSetting}
                activeOpacity={0.7}
                onPress={() => setSecaoAtiva('meu_perfil')}
              >
                <View style={[styles.rowSquircleIcon, { backgroundColor: '#0a84ff' }]}>
                  <User size={18} color="#FFFFFF" strokeWidth={2.4} />
                </View>
                <View style={styles.rowSettingBody}>
                  <Text style={styles.rowSettingTitle}>Meu Perfil PRO</Text>
                  <Text style={styles.rowSettingSub}>Foto, especialidade, contato e bio</Text>
                </View>
                <Text style={styles.rowSettingValue}>
                  {percentualCompletude < 100 ? `${percentualCompletude}%` : 'Completo'}
                </Text>
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {filterMatch('Segurança & Senha', 'senha 2fa autenticacao') && (
              <TouchableOpacity
                style={styles.rowSetting}
                activeOpacity={0.7}
                onPress={() => setSecaoAtiva('seguranca_senha')}
              >
                <View style={[styles.rowSquircleIcon, { backgroundColor: '#34c759' }]}>
                  <Shield size={18} color="#FFFFFF" strokeWidth={2.4} />
                </View>
                <View style={styles.rowSettingBody}>
                  <Text style={styles.rowSettingTitle}>Segurança & Senha</Text>
                  <Text style={styles.rowSettingSub}>Alterar senha e proteção da conta</Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {filterMatch('Pontuação & Avaliações', 'avaliacao score reputacao estrelas notas solfy') && (
              <TouchableOpacity
                style={styles.rowSetting}
                activeOpacity={0.7}
                onPress={() => setSecaoAtiva('reputacao_avaliacoes')}
              >
                <View style={[styles.rowSquircleIcon, { backgroundColor: '#F59E0B' }]}>
                  <Star size={18} color="#FFFFFF" strokeWidth={2.4} />
                </View>
                <View style={styles.rowSettingBody}>
                  <Text style={styles.rowSettingTitle}>Pontuação & Avaliações</Text>
                  <Text style={styles.rowSettingSub}>
                    Rating {(perfilPro?.rating || 5.0).toFixed(1)} ★ • Ver pontuação 0-100
                  </Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {filterMatch('Especialidades & Raio', 'categoria raio km localizacao') && (
              <TouchableOpacity
                style={styles.rowSetting}
                activeOpacity={0.7}
                onPress={() => setSecaoAtiva('especialidades_raio')}
              >
                <View style={[styles.rowSquircleIcon, { backgroundColor: '#bf5af2' }]}>
                  <Wrench size={18} color="#FFFFFF" strokeWidth={2.4} />
                </View>
                <View style={styles.rowSettingBody}>
                  <Text style={styles.rowSettingTitle}>Especialidades & Raio</Text>
                  <Text style={styles.rowSettingSub}>
                    {(perfilPro?.categorias_atendidas || [dadosEditaveis.servico]).length} especialidades • {raioEditavel} km
                  </Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {filterMatch('Disponibilidade & Plantão', 'horario dia semana plantao emergencia') && (
              <TouchableOpacity
                style={styles.rowSetting}
                activeOpacity={0.7}
                onPress={() => setSecaoAtiva('disponibilidade')}
              >
                <View style={[styles.rowSquircleIcon, { backgroundColor: '#0284c7' }]}>
                  <Calendar size={18} color="#FFFFFF" strokeWidth={2.4} />
                </View>
                <View style={styles.rowSettingBody}>
                  <Text style={styles.rowSettingTitle}>Disponibilidade & Plantão</Text>
                  <Text style={styles.rowSettingSub}>
                    {plantao24h ? 'Plantão 24h Ativo' : 'Grade semanal configurada'}
                  </Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {filterMatch('Documentos & Homologação KYC', 'documento kyc cnh rg selfie pj analise') && (
              <TouchableOpacity
                style={styles.rowSetting}
                activeOpacity={0.7}
                onPress={() => setSecaoAtiva('documentos_kyc')}
              >
                <View style={[styles.rowSquircleIcon, { backgroundColor: '#059669' }]}>
                  <FileCheck size={18} color="#FFFFFF" strokeWidth={2.4} />
                </View>
                <View style={styles.rowSettingBody}>
                  <Text style={styles.rowSettingTitle}>Documentos & Homologação</Text>
                  <Text style={styles.rowSettingSub}>Mesa KYC e trio de fotos obrigatórias</Text>
                </View>
                <View
                  style={
                    perfilPro?.status_cadastro === 'aprovado'
                      ? styles.tagGreen
                      : perfilPro?.status_cadastro === 'rejeitado'
                      ? styles.tagRed
                      : styles.tagAmber
                  }
                >
                  <Text
                    style={
                      perfilPro?.status_cadastro === 'aprovado'
                        ? styles.tagGreenText
                        : perfilPro?.status_cadastro === 'rejeitado'
                        ? styles.tagRedText
                        : styles.tagAmberText
                    }
                  >
                    {perfilPro?.status_cadastro === 'aprovado'
                      ? 'Verificado'
                      : perfilPro?.status_cadastro === 'rejeitado'
                      ? 'Pendência'
                      : 'Em Análise'}
                  </Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── GRUPO 2: FINANCEIRO & COMISSÕES ── */}
        <View style={styles.configGroup}>
          <Text style={styles.groupTitleText}>Financeiro & Comissões</Text>
          <View style={styles.groupCard}>
            {filterMatch('Extrato & Comissões', 'fatura comissao pix pagamento') && (
              <TouchableOpacity
                style={styles.rowSetting}
                activeOpacity={0.7}
                onPress={() => router.push('/(app)/financeiro')}
              >
                <View style={[styles.rowSquircleIcon, { backgroundColor: '#ff375f' }]}>
                  <CreditCard size={18} color="#FFFFFF" strokeWidth={2.4} />
                </View>
                <View style={styles.rowSettingBody}>
                  <Text style={styles.rowSettingTitle}>Extrato & Faturas Solfy</Text>
                  <Text style={styles.rowSettingSub}>Comissões devidas, quitação PIX e comprovantes</Text>
                </View>
                {resumoFaturas.totalVencidas > 0 ? (
                  <View style={styles.tagRed}>
                    <Text style={styles.tagRedText}>
                      {resumoFaturas.totalVencidas} vencida{resumoFaturas.totalVencidas > 1 ? 's' : ''}
                    </Text>
                  </View>
                ) : resumoFaturas.totalPendentes > 0 ? (
                  <View style={styles.tagAmber}>
                    <Text style={styles.tagAmberText}>
                      {resumoFaturas.totalPendentes} a vencer
                    </Text>
                  </View>
                ) : (
                  <View style={styles.tagGreen}>
                    <Text style={styles.tagGreenText}>Em dia</Text>
                  </View>
                )}
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── GRUPO 3: PREFERÊNCIAS & SUPORTE ── */}
        <View style={styles.configGroup}>
          <Text style={styles.groupTitleText}>Preferências & Ajuda</Text>
          <View style={styles.groupCard}>
            {filterMatch('Notificações', 'push alerta som') && (
              <TouchableOpacity
                style={styles.rowSetting}
                activeOpacity={0.7}
                onPress={() => setSecaoAtiva('notificacoes')}
              >
                <View style={[styles.rowSquircleIcon, { backgroundColor: '#ff453a' }]}>
                  <Bell size={18} color="#FFFFFF" strokeWidth={2.4} />
                </View>
                <View style={styles.rowSettingBody}>
                  <Text style={styles.rowSettingTitle}>Notificações</Text>
                  <Text style={styles.rowSettingSub}>Despachos, visitas, chat e horário silencioso</Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {filterMatch('Central de Ajuda', 'faq duvidas regras') && (
              <TouchableOpacity
                style={styles.rowSetting}
                activeOpacity={0.7}
                onPress={() => setSecaoAtiva('central_ajuda')}
              >
                <View style={[styles.rowSquircleIcon, { backgroundColor: '#ff9f0a' }]}>
                  <HelpCircle size={18} color="#FFFFFF" strokeWidth={2.4} />
                </View>
                <View style={styles.rowSettingBody}>
                  <Text style={styles.rowSettingTitle}>Central de Ajuda & FAQ</Text>
                  <Text style={styles.rowSettingSub}>Regras de despacho, cotação e repasses</Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {filterMatch('Termo de Adesão', 'lgpd contrato termo') && (
              <TouchableOpacity
                style={styles.rowSetting}
                activeOpacity={0.7}
                onPress={() => setSecaoAtiva('termos')}
              >
                <View style={[styles.rowSquircleIcon, { backgroundColor: '#64748B' }]}>
                  <FileText size={18} color="#FFFFFF" strokeWidth={2.4} />
                </View>
                <View style={styles.rowSettingBody}>
                  <Text style={styles.rowSettingTitle}>Termo de Adesão Solfy</Text>
                  <Text style={styles.rowSettingSub}>Termos de uso, segurança e comissões</Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── BOTÃO SAIR DA CONTA ── */}
        <TouchableOpacity style={styles.logoutButton} activeOpacity={0.8} onPress={handleLogout}>
          <LogOut size={18} color="#EF4444" strokeWidth={2.2} />
          <Text style={styles.logoutText}>Sair da Conta</Text>
        </TouchableOpacity>





        <Text style={styles.versionFooter}>Solfy PRO • Versão 2.1.0 (Build Homologada)</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F3F5F2',
  },
  toastPopup: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 30 : 50,
    left: 20,
    right: 20,
    zIndex: 9999,
    backgroundColor: '#0D1B12',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  mainHeaderTitleBox: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  mainHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0D1B12',
    letterSpacing: -0.5,
  },
  mainHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  offlineBannerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  offlineBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  offlineBannerDesc: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(13, 27, 18, 0.08)',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 8px rgba(13,27,18,0.04)' }
      : {
          elevation: 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
        }),
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatarBox: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileAvatarImg: {
    width: 54,
    height: 54,
  },
  profileAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  profileInfoCol: {
    flex: 1,
  },
  profileNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D1B12',
    letterSpacing: -0.3,
  },
  profileEmailText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  profileChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  chipRole: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  chipRoleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  chipVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  chipVerifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  chipPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  chipPendingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  profileCompletionRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  profileCompletionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  profileCompletionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D1B12',
  },
  profileCompletionCta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  profileCompletionTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  profileCompletionFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 3,
  },
  profileCompletionTip: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  searchWrap: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(13, 27, 18, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0D1B12',
  },
  searchClearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  configGroup: {
    marginBottom: 18,
  },
  groupTitleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(13, 27, 18, 0.08)',
  },
  rowSetting: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 12,
  },
  rowSquircleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowSettingBody: {
    flex: 1,
  },
  rowSettingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D1B12',
  },
  rowSettingSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  rowSettingValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 4,
  },
  tagGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 4,
  },
  tagGreenText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      web: {
        boxShadow: '0 2px 6px rgba(239, 68, 68, 0.04)',
      },
      default: {
        elevation: 1,
      },
    }),
  },
  logoutText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '800',
  },
  logoutAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  logoutAllText: {
    color: '#B45309',
    fontSize: 14,
    fontWeight: '800',
  },
  lgpdContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  lgpdDownloadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lgpdDownloadText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  lgpdDeleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  lgpdDeleteText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '700',
  },
  versionFooter: {
    textAlign: 'center',
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 20,
    fontWeight: '500',
  },

  // ── ESTILOS DAS SUB-TELAS ──
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  subBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subBackText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  subHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D1B12',
  },
  subSaveBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  subSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  subScroll: {
    flex: 1,
  },
  subContent: {
    padding: 20,
    paddingBottom: 60,
  },
  autoSavedHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  avatarEditContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarLargeCircle: {
    width: 88,
    height: 88,
    borderRadius: 32,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarLargeImg: {
    width: 88,
    height: 88,
    borderRadius: 32,
  },
  avatarLargeInitials: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0D1B12',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  cardGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  groupSectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D1B12',
    marginBottom: 14,
  },
  fieldBox: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  fieldInput: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0D1B12',
  },
  fieldInputMultiline: {
    height: undefined,
    minHeight: 44,
    paddingTop: 8,
    paddingBottom: 8,
    textAlignVertical: 'top',
  },
  inputWithEyeRow: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  inputWithEye: {
    flex: 1,
    fontSize: 14,
    color: '#0D1B12',
  },
  eyeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  meterRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 10,
  },
  meterBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  rulesList: {
    gap: 6,
    marginBottom: 12,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleCircleOk: {
    backgroundColor: '#10B981',
  },
  ruleText: {
    fontSize: 11,
    color: '#64748B',
  },
  ruleTextOk: {
    color: '#10B981',
    fontWeight: '700',
  },
  errorText: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 4,
  },
  switchRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowTitleBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D1B12',
  },
  rowSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#CBD5E1',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchOn: {
    backgroundColor: '#059669',
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleCircleOn: {
    alignSelf: 'flex-end',
  },
  btnActionPrimary: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 6px rgba(5, 150, 105, 0.2)',
      },
    }),
  },
  btnActionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  btnActionOutline: {
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#059669',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  btnActionOutlineText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '700',
  },
  btnActionOutlineRed: {
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  btnActionOutlineRedText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  sessionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  sessionMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  textRedAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  faqItemBox: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D1B12',
    marginBottom: 4,
  },
  faqAnswer: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  termoIntegralText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 19,
  },
  // ── ESTILOS BLOCO 2: ESPECIALIDADES, RAIO, PLANTÃO, GRADE E KYC ──
  groupSectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
    marginTop: -4,
  },
  emptyListText: {
    fontSize: 12,
    color: '#94A3B8',
    paddingVertical: 8,
    fontStyle: 'italic',
  },
  tagRed: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 4,
  },
  tagRedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  tagAmber: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 4,
  },
  tagAmberText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  raioDisplayBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginBottom: 12,
  },
  raioIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  raioValorDestaque: {
    fontSize: 22,
    fontWeight: '800',
    color: '#065F46',
  },
  raioDescricao: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
    lineHeight: 15,
  },
  raioStepperRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  raioStepperBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  raioStepperBtnDisabled: {
    opacity: 0.5,
  },
  raioStepperBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  chipsAtalhoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  chipAtalhoKm: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipAtalhoKmAtivo: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  chipAtalhoKmText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  chipAtalhoKmTextAtivo: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  infoBoxGray: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  infoBoxGrayText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  infoBoxAmber: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 12,
  },
  infoBoxAmberText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 16,
  },
  categoriaItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  categoriaIconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriaNomeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  categoriaStatusAtiva: {
    fontSize: 11,
    color: '#059669',
    marginTop: 2,
  },
  categoriaRemoveBtn: {
    padding: 6,
    marginLeft: 6,
  },
  emptySolicitacoesBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  emptySolicitacoesText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  solicitacaoItemBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  solicitacaoCategoriaChave: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  solicitacaoMotivoText: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
  },
  solicitacaoDataText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 6,
  },
  recusaAlertaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    padding: 6,
    borderRadius: 6,
    marginTop: 6,
  },
  recusaAlertaText: {
    flex: 1,
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  badgeStatusBase: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeStatusAprovada: {
    backgroundColor: '#DCFCE7',
  },
  badgeStatusRecusada: {
    backgroundColor: '#FEE2E2',
  },
  badgeStatusAnalise: {
    backgroundColor: '#FEF3C7',
  },
  badgeStatusBaseText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextAprovada: {
    color: '#166534',
  },
  badgeTextRecusada: {
    color: '#DC2626',
  },
  badgeTextAnalise: {
    color: '#D97706',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContentCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalDesc: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 17,
  },
  catOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
  },
  catOptionItemSelecionada: {
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
  },
  catOptionItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  catOptionItemTextSelecionada: {
    color: '#059669',
    fontWeight: '700',
  },
  modalBtnCancel: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  diaGradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  diaGradeNome: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  horariosInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  horarioInput: {
    width: 74,
    height: 38,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    paddingVertical: 0,
    paddingHorizontal: 4,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  horariosSeparador: {
    fontSize: 11,
    color: '#94A3B8',
  },
  diaFolgaText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  kycStatusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  kycStatusAprovado: {
    backgroundColor: '#DCFCE7',
  },
  kycStatusAnalise: {
    backgroundColor: '#FEF3C7',
  },
  kycStatusRejeitado: {
    backgroundColor: '#FEE2E2',
  },
  kycStatusTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  kycStatusDesc: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  docKycItemBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docKycHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  docKycTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  docKycSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  docMotivoRejeicaoText: {
    fontSize: 11,
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    padding: 6,
    borderRadius: 6,
    marginTop: 6,
  },
  docReenviarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#DCFCE7',
  },
  docReenviarBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
});
