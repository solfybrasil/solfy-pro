import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  useWindowDimensions,
  Alert,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  Building2,
  Mail,
  Lock,
  ArrowLeft,
  ArrowRight,
  Smartphone,
  MapPin,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Camera,
  ChevronDown,
  X,
  Clock,
  Wrench,
  FileText,
  CheckCircle2,
  Sparkles,
  RotateCw,
  Lightbulb,
  Upload,
} from 'lucide-react-native';
import { GradientButton } from '../../components/GradientButton';
import { TurnstileWidget } from '../../components/TurnstileWidget';
import FlagIcon from '../../components/FlagIcon';
import PasswordStrength from '../../components/PasswordStrength';
import { supabase } from '../../lib/supabase';
import { geocodificarEnderecoCep, GeocodingResult } from '../../lib/geocoding';
import {
  validarCPF,
  validarCNPJ,
  formatarCPF,
  formatarCNPJ,
  formatarTelefone,
  formatarCEP,
} from '../../lib/kycValidations';
import {
  registrarAceiteTermoCnpjGrande,
  TEXTO_TERMO_CNPJ_GRANDE_V1,
} from '../../lib/condoPrestadorPainelApi';

type Step = 'identificacao' | 'credenciais' | 'servicos' | 'disponibilidade' | 'documentos';

const STEPS_LIST: Step[] = ['identificacao', 'credenciais', 'servicos', 'disponibilidade', 'documentos'];

const COUNTRIES = [
  { code: '+55', name: 'Brasil' },
  { code: '+351', name: 'Portugal' },
  { code: '+1', name: 'Estados Unidos' },
  { code: '+54', name: 'Argentina' },
  { code: '+34', name: 'Espanha' },
  { code: '+39', name: 'Itália' },
  { code: '+44', name: 'Reino Unido' },
  { code: '+595', name: 'Paraguai' },
  { code: '+598', name: 'Uruguai' },
  { code: '+56', name: 'Chile' },
];

const CATEGORIAS_PRESTADOR = [
  { id: 'ELETRICA', label: 'Eletricista Predial' },
  { id: 'HIDRAULICA', label: 'Encanador & Bombas' },
  { id: 'PINTURA', label: 'Pintura & Fachadas' },
  { id: 'REFORMA', label: 'Alvenaria & Reforma' },
  { id: 'IMPERMEABILIZACAO', label: 'Impermeabilização' },
  { id: 'SERRALHERIA', label: 'Serralheria & Portões' },
  { id: 'CLIMATIZACAO', label: 'Ar Condicionado' },
  { id: 'CFTV', label: 'CFTV & Interfonia' },
  { id: 'JARDINAGEM', label: 'Jardinagem & Paisagismo' },
  { id: 'LIMPEZA', label: 'Limpeza Pós-Obra' },
];

const RAIOS_KM = [15, 30, 50, 80, 100];
const STORAGE_DRAFT_KEY = '@solfy_pro:cadastro_prestador_draft_v2';

export default function CadastroPrestadorScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const params = useLocalSearchParams<{ retomarPendencia?: string; campoPendente?: string }>();

  const [step, setStep] = useState<Step>('identificacao');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // 1. Identificação Fiscal & Atuação
  const [tipoPessoa, setTipoPessoa] = useState<'pj' | 'pf'>('pj');
  const [portePj, setPortePj] = useState<'mei' | 'me_epp' | 'grande'>('mei');
  const [documentoFiscal, setDocumentoFiscal] = useState('');
  const [nomeRazao, setNomeRazao] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [telefone, setTelefone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [countryModalOpen, setCountryModalOpen] = useState(false);

  // 2. Credenciais de Acesso
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 3. Serviços & Geografia
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>(['ELETRICA']);
  const [raioKm, setRaioKm] = useState<number>(30);
  const [cepBase, setCepBase] = useState('');
  const [cidadeBase, setCidadeBase] = useState('');
  const [ufBase, setUfBase] = useState('');
  const [bairroBase, setBairroBase] = useState('');
  const [geoResult, setGeoResult] = useState<GeocodingResult | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // 4. Disponibilidade & Plantão
  const [diasAtendimento, setDiasAtendimento] = useState<string[]>(['seg_sex', 'sabado']);
  const [horarioInicio, setHorarioInicio] = useState('08:00');
  const [horarioFim, setHorarioFim] = useState('18:00');
  const [atendeEmergencia, setAtendeEmergencia] = useState(false);

  // 5. Documentos KYC (Três Fotos Obrigatórias) & Termos
  const [docFrenteUri, setDocFrenteUri] = useState<string | null>(null);
  const [docVersoUri, setDocVersoUri] = useState<string | null>(null);
  const [docSelfieUri, setDocSelfieUri] = useState<string | null>(null);
  const [docPjUri, setDocPjUri] = useState<string | null>(null);
  const [modalTermosOpen, setModalTermosOpen] = useState(false);
  const [modalPrivacidadeOpen, setModalPrivacidadeOpen] = useState(false);
  const [termoGrandeAceito, setTermoGrandeAceito] = useState(false);
  const isCaptchaEnabled = process.env.EXPO_PUBLIC_CAPTCHA_ENABLED === 'true';
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaTokenRef = useRef<string | null>(null);
  const [captchaTokenTime, setCaptchaTokenTime] = useState<number>(0);
  const [turnstileResetKey, setTurnstileResetKey] = useState<number>(0);

  // Se vier com pendência de documento, vai direto para a etapa de documentos
  useEffect(() => {
    if (params.retomarPendencia === 'true') {
      setStep('documentos');
    }
  }, [params.retomarPendencia]);

  // Largura máxima centralizada igual ao condo
  const contentMaxWidth = Math.min(width - 32, 480);

  // Carregamento de rascunho anterior
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_DRAFT_KEY).then((raw) => {
      if (raw) {
        try {
          const draft = JSON.parse(raw);
          if (draft.tipoPessoa) setTipoPessoa(draft.tipoPessoa);
          if (draft.portePj) setPortePj(draft.portePj);
          if (draft.documentoFiscal) setDocumentoFiscal(draft.documentoFiscal);
          if (draft.nomeRazao) setNomeRazao(draft.nomeRazao);
          if (draft.nomeFantasia) setNomeFantasia(draft.nomeFantasia);
          if (draft.telefone) setTelefone(draft.telefone);
          if (draft.email) setEmail(draft.email);
          if (draft.categoriasSelecionadas) setCategoriasSelecionadas(draft.categoriasSelecionadas);
          if (draft.raioKm) setRaioKm(draft.raioKm);
          if (draft.cepBase) setCepBase(draft.cepBase);
          if (draft.cidadeBase) setCidadeBase(draft.cidadeBase);
          if (draft.ufBase) setUfBase(draft.ufBase);
          if (draft.diasAtendimento) setDiasAtendimento(draft.diasAtendimento);
          if (draft.horarioInicio) setHorarioInicio(draft.horarioInicio);
          if (draft.horarioFim) setHorarioFim(draft.horarioFim);
          if (draft.atendeEmergencia !== undefined) setAtendeEmergencia(draft.atendeEmergencia);
        } catch {}
      }
    });
  }, []);

  const salvarRascunho = async () => {
    try {
      const draft = {
        tipoPessoa,
        portePj,
        documentoFiscal,
        nomeRazao,
        nomeFantasia,
        telefone,
        email,
        categoriasSelecionadas,
        raioKm,
        cepBase,
        cidadeBase,
        ufBase,
        diasAtendimento,
        horarioInicio,
        horarioFim,
        atendeEmergencia,
      };
      await AsyncStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  };

  // Busca de CEP resiliente
  const handleCepChange = async (valor: string) => {
    const formatado = formatarCEP(valor);
    setCepBase(formatado);
    const clean = formatado.replace(/\D/g, '');

    if (clean.length === 8) {
      setBuscandoCep(true);
      try {
        const geo = await geocodificarEnderecoCep(clean);
        setGeoResult(geo);
        if (geo.cidade) setCidadeBase(geo.cidade);
        if (geo.estado) setUfBase(geo.estado);
        if (geo.bairro) setBairroBase(geo.bairro);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (err) {
        console.warn('[Cadastro] Erro ao buscar CEP:', err);
      } finally {
        setBuscandoCep(false);
      }
    }
  };

  // Capturar documento (Câmera ou Galeria)
  const handleCapturarFoto = async (
    campo: 'frente' | 'verso' | 'selfie' | 'pj',
    origem: 'camera' | 'galeria'
  ) => {
    try {
      if (origem === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão necessária', 'Permita o acesso à câmera para fotografar o documento.');
          return;
        }
        const isSelfie = campo === 'selfie';
        const res = await ImagePicker.launchCameraAsync({
          cameraType: isSelfie ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
          quality: 0.8,
          allowsEditing: true,
        });
        if (!res.canceled && res.assets[0]?.uri) {
          if (campo === 'frente') setDocFrenteUri(res.assets[0].uri);
          else if (campo === 'verso') setDocVersoUri(res.assets[0].uri);
          else if (campo === 'selfie') setDocSelfieUri(res.assets[0].uri);
          else if (campo === 'pj') setDocPjUri(res.assets[0].uri);
          if (Platform.OS !== 'web') Haptics.selectionAsync();
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão necessária', 'Permita o acesso às suas fotos.');
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
        });
        if (!res.canceled && res.assets[0]?.uri) {
          if (campo === 'frente') setDocFrenteUri(res.assets[0].uri);
          else if (campo === 'verso') setDocVersoUri(res.assets[0].uri);
          else if (campo === 'selfie') setDocSelfieUri(res.assets[0].uri);
          else if (campo === 'pj') setDocPjUri(res.assets[0].uri);
          if (Platform.OS !== 'web') Haptics.selectionAsync();
        }
      }
    } catch (err) {
      console.warn('[Cadastro] Erro ao selecionar foto:', err);
    }
  };

  // Navegação e validação entre etapas
  const handleNextStep = () => {
    setError('');

    if (step === 'identificacao') {
      const docClean = documentoFiscal.replace(/\D/g, '');
      if (tipoPessoa === 'pf') {
        if (!validarCPF(docClean)) {
          setError('CPF inválido. Verifique os 11 dígitos.');
          return;
        }
      } else {
        if (!validarCNPJ(docClean)) {
          setError('CNPJ inválido. Verifique os 14 dígitos.');
          return;
        }
      }

      if (!nomeRazao.trim()) {
        setError(tipoPessoa === 'pj' ? 'Informe a Razão Social da empresa.' : 'Informe seu nome completo.');
        return;
      }

      const rawPhone = telefone.replace(/\D/g, '');
      if (rawPhone.length < (selectedCountry.code === '+55' ? 10 : 8)) {
        setError('Telefone / WhatsApp com DDD inválido.');
        return;
      }

      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      salvarRascunho();
      setStep('credenciais');
      return;
    }

    if (step === 'credenciais') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setError('Digite um e-mail de acesso válido.');
        return;
      }
      if (password.length < 6) {
        setError('A senha deve conter no mínimo 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setError('As senhas digitadas não coincidem.');
        return;
      }

      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      salvarRascunho();
      setStep('servicos');
      return;
    }

    if (step === 'servicos') {
      if (categoriasSelecionadas.length === 0) {
        setError('Selecione pelo menos uma especialidade técnica.');
        return;
      }
      const rawCep = cepBase.replace(/\D/g, '');
      if (rawCep.length !== 8) {
        setError('Informe um CEP base válido para cálculo de despacho.');
        return;
      }

      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      salvarRascunho();
      setStep('disponibilidade');
      return;
    }

    if (step === 'disponibilidade') {
      if (diasAtendimento.length === 0) {
        setError('Selecione ao menos um dia de atendimento semanal.');
        return;
      }
      if (!horarioInicio.trim() || !horarioFim.trim()) {
        setError('Defina os horários habituais de atendimento.');
        return;
      }

      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      salvarRascunho();
      setStep('documentos');
      return;
    }
  };

  const handlePrevStep = () => {
    setError('');
    if (step === 'identificacao') {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(auth)/welcome');
      }
    } else if (step === 'credenciais') setStep('identificacao');
    else if (step === 'servicos') setStep('credenciais');
    else if (step === 'disponibilidade') setStep('servicos');
    else if (step === 'documentos') setStep('disponibilidade');
  };

  // Submissão do Credenciamento
  const handleFinalizarCadastro = async () => {
    if (!docFrenteUri || !docVersoUri || !docSelfieUri) {
      setError('Anexe as 3 fotos obrigatórias: Frente, Verso do documento e Selfie com o documento.');
      return;
    }

    if (tipoPessoa === 'pj' && portePj === 'grande' && !termoGrandeAceito) {
      setError('Prestadores de Grande Porte devem aceitar o Termo Digital de Responsabilidade.');
      return;
    }

    setLoading(true);
    setLoadingText('Verificando segurança...');
    setError('');

    const isCaptchaEnabled = process.env.EXPO_PUBLIC_CAPTCHA_ENABLED === 'true';
    let token = captchaTokenRef.current || captchaToken;

    if (isCaptchaEnabled) {
      if (!token) {
        const start = Date.now();
        while (!token && Date.now() - start < 3000) {
          await new Promise((r) => setTimeout(r, 120));
          token = captchaTokenRef.current;
        }
      }

      if (!token) {
        setLoading(false);
        setLoadingText('');
        setError('Não foi possível verificar, tente novamente');
        setTurnstileResetKey((k) => k + 1);
        return;
      }

      const now = Date.now();
      if (captchaTokenTime > 0 && now - captchaTokenTime > 4 * 60 * 1000) {
        setLoading(false);
        setLoadingText('');
        setError('A verificação de segurança expirou. Por favor, tente novamente.');
        setCaptchaToken(null);
        captchaTokenRef.current = null;
        setCaptchaTokenTime(0);
        setTurnstileResetKey((k) => k + 1);
        return;
      }
    }

    setLoadingText('Processando credenciamento...');

    // Token do Turnstile é de uso único: consome antes do envio
    const tokenToSend = isCaptchaEnabled ? token : undefined;
    setCaptchaToken(null);
    captchaTokenRef.current = null;
    setCaptchaTokenTime(0);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    try {
      // 1. Cria usuário no Supabase Auth
      const fullPhone = `${selectedCountry.code}${telefone.replace(/\D/g, '')}`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: nomeRazao.trim(),
            user_type: 'prestador',
            phone: fullPhone,
          },
          ...(tokenToSend ? { captchaToken: tokenToSend } : {}),
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error('Falha ao obter identificador do usuário criado.');
      }

      setLoadingText('Configurando perfil profissional...');

      // 2. Atualiza perfil do usuário (email fica armazenado em auth.users)
      await supabase.from('perfis').upsert({
        user_id: userId,
        nome_completo: nomeRazao.trim(),
        documento_numero: documentoFiscal.replace(/\D/g, ''),
        telefone: fullPhone,
        tipo_conta: 'prestador',
        status_aprovacao: 'em_analise',
        termos_versao_aceita: '1.0',
        termos_data_aceite: new Date().toISOString(),
        privacidade_versao_aceita: '1.0',
        privacidade_data_aceite: new Date().toISOString(),
      });

      // 3. Cadastra o prestador na tabela prestadores
      const categoriasNomes = categoriasSelecionadas.map(
        (id) => CATEGORIAS_PRESTADOR.find((c) => c.id === id)?.label || id
      );

      const ibgeCod = geoResult?.cidade_ibge || null;
      const regioesIbge = ibgeCod ? [ibgeCod] : [];

      const { data: prestadorCriado, error: pErr } = await supabase
        .from('prestadores')
        .insert({
          user_id: userId,
          name: nomeRazao.trim(),
          nome_fantasia: nomeFantasia.trim() || nomeRazao.trim(),
          razao_social: tipoPessoa === 'pj' ? nomeRazao.trim() : null,
          service_type: categoriasNomes[0] || 'Manutenção Predial',
          phone: fullPhone,
          categorias_atendidas: categoriasSelecionadas.map((c) => c.toLowerCase()),
          regioes_atendimento: regioesIbge,
          cidade: cidadeBase || geoResult?.cidade || null,
          estado: ufBase || geoResult?.estado || null,
          cep: cepBase.replace(/\D/g, '') || null,
          cidade_ibge: ibgeCod,
          latitude: geoResult?.latitude || null,
          longitude: geoResult?.longitude || null,
          geocodificado_em: geoResult?.latitude ? new Date().toISOString() : null,
          geocodificacao_origem: geoResult?.origem || 'pendente',
          geocodificacao_aproximada: geoResult?.aproximado ?? true,
          raio_atendimento_km: raioKm,
          atende_emergencia: atendeEmergencia,
          nivel: 'bronze',
          solfcoins_saldo: 50,
          apto_servicos_grandes: tipoPessoa === 'pj' && portePj === 'grande',
          status_cadastro: 'em_analise',
          selo_verificado: false,
          total_servicos_concluidos: 0,
          eh_teste: false,
        })
        .select('id')
        .single();

      if (pErr) {
        console.warn('[Cadastro] Aviso ao inserir prestadores:', pErr);
      }

      const prestadorId = prestadorCriado?.id;

      // 4. Se for PJ, insere na tabela prestador_pessoa_juridica
      if (tipoPessoa === 'pj' && prestadorId) {
        await supabase.from('prestador_pessoa_juridica').insert({
          prestador_id: prestadorId,
          tipo_pessoa: 'pj',
          cnpj: documentoFiscal.replace(/\D/g, ''),
          razao_social: nomeRazao.trim(),
          possui_mei: portePj === 'mei',
        });
      }

      // 5. Upload seguro de documentos para o bucket privado kyc-documentos-privados
      const docsEnviadosParaKyc: Array<{ tipo: string; storage_path: string; nome: string }> = [];

      if (prestadorId) {
        const docsParaUpload = [
          { uri: docFrenteUri, tipo: 'doc_frente', prefix: 'doc_frente' },
          { uri: docVersoUri, tipo: 'doc_verso', prefix: 'doc_verso' },
          { uri: docSelfieUri, tipo: 'selfie_documento', prefix: 'selfie_doc' },
        ];

        if (tipoPessoa === 'pj' && docPjUri) {
          docsParaUpload.push({ uri: docPjUri, tipo: 'cnpj_cartao', prefix: 'cnpj_cartao' });
        }

        for (const docItem of docsParaUpload) {
          if (!docItem.uri) continue;
          try {
            const ext = docItem.uri.split('.').pop() || 'jpg';
            const storagePath = `${userId}/${docItem.prefix}_${Date.now()}.${ext}`;
            const res = await fetch(docItem.uri);
            const blob = await res.blob();
            const { error: upErr } = await supabase.storage
              .from('kyc-documentos-privados')
              .upload(storagePath, blob, { upsert: true });

            if (!upErr) {
              docsEnviadosParaKyc.push({
                tipo: docItem.tipo,
                storage_path: storagePath,
                nome: `${docItem.prefix}.${ext}`,
              });

              await supabase.from('prestador_documentos').insert({
                prestador_id: prestadorId,
                tipo_documento: docItem.tipo,
                arquivo_url: storagePath,
                status: 'em_analise',
              });
            }
          } catch (docErr) {
            console.warn(`[Cadastro] Aviso ao enviar documento ${docItem.tipo}:`, docErr);
          }
        }
      }

      // 5. Disponibilidade semanal
      if (prestadorId) {
        const disponibilidades = [1, 2, 3, 4, 5].map((dia) => ({
          prestador_id: prestadorId,
          dia_semana: dia,
          horario_inicio: `${horarioInicio}:00`,
          horario_fim: `${horarioFim}:00`,
          ativo: diasAtendimento.includes('seg_sex'),
        }));

        if (diasAtendimento.includes('sabado')) {
          disponibilidades.push({
            prestador_id: prestadorId,
            dia_semana: 6,
            horario_inicio: `${horarioInicio}:00`,
            horario_fim: '13:00:00',
            ativo: true,
          });
        }
        if (diasAtendimento.includes('domingo')) {
          disponibilidades.push({
            prestador_id: prestadorId,
            dia_semana: 0,
            horario_inicio: '09:00:00',
            horario_fim: '14:00:00',
            ativo: true,
          });
        }

        await supabase.from('prestador_disponibilidade').insert(disponibilidades);
      }

      // 6. Submissão unificada ao portão KYC via RPC atômica
      setLoadingText('Submetendo caso para auditoria KYC...');
      const { data: submissaoRes, error: submissaoErr } = await supabase.rpc('submeter_cadastro_prestador', {
        p_payload: {
          user_id: userId,
          nome_razao: nomeRazao.trim(),
          nome_fantasia: nomeFantasia.trim() || nomeRazao.trim(),
          telefone: fullPhone,
          documento: documentoFiscal.replace(/\D/g, ''),
          tipo_pessoa: tipoPessoa,
          raio_km: raioKm,
          cidade: cidadeBase || geoResult?.cidade || null,
          estado: ufBase || geoResult?.estado || null,
          cep: cepBase.replace(/\D/g, '') || null,
          latitude: geoResult?.latitude || null,
          longitude: geoResult?.longitude || null,
          atende_emergencia: atendeEmergencia,
          categorias: categoriasSelecionadas.map((c) => c.toLowerCase()),
          documentos: docsEnviadosParaKyc,
        },
      });

      if (submissaoErr) {
        console.warn('[Cadastro] Aviso ao chamar submeter_cadastro_prestador:', submissaoErr);
      }

      const casoIdCriado = submissaoRes?.caso_id;

      // Vincula caso_id aos documentos recém-enviados
      if (casoIdCriado && prestadorId) {
        await supabase
          .from('prestador_documentos')
          .update({ caso_id: casoIdCriado })
          .eq('prestador_id', prestadorId);
      }

      // Registra aceite dos Termos de Uso e Política de Privacidade
      try {
        await supabase.rpc('registrar_aceite_termos_privacidade', {
          p_versao_termos: '1.1',
          p_versao_privacidade: '1.1',
        });
      } catch (errAceite) {
        console.warn('[Cadastro] Aviso ao registrar aceite de termos:', errAceite);
      }

      // 7. Termo CNPJ Grande Porte
      if (tipoPessoa === 'pj' && portePj === 'grande' && termoGrandeAceito) {
        const aparelho = `${Platform.OS.toUpperCase()} (${Platform.Version ?? ''})`;
        await registrarAceiteTermoCnpjGrande('v1.0', TEXTO_TERMO_CNPJ_GRANDE_V1, aparelho);
      }

      // Limpa rascunho
      await AsyncStorage.removeItem(STORAGE_DRAFT_KEY);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Navega diretamente para a tela de análise sem expor status, email ou IDs na URL
      router.replace('/(auth)/status-analise' as any);
    } catch (err: any) {
      console.error('[Cadastro] Erro ao cadastrar:', err);
      let userMsg = err?.message || 'Falha ao concluir cadastro. Verifique os dados digitados.';
      const lower = userMsg.toLowerCase();
      if (
        lower.includes('captcha') ||
        lower.includes('disallowed') ||
        lower.includes('request disallowed')
      ) {
        userMsg = 'Não foi possível verificar, tente novamente';
      }
      setError(userMsg);
      // Sempre reseta o Turnstile para nova tentativa
      setTurnstileResetKey((k) => k + 1);
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  const stepIndex = STEPS_LIST.indexOf(step);

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Background Sutil Solfy */}
      <View style={s.ambientBg}>
        <View style={s.ambientCircleTop} />
        <View style={s.ambientCircleBottom} />
      </View>

      <SafeAreaView style={s.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.keyboardView}
        >
          {/* Top Bar com Botão Voltar Circular & Dots Interligados */}
          <View style={[s.topBar, { width: contentMaxWidth }]}>
            <TouchableOpacity
              onPress={handlePrevStep}
              accessibilityLabel="Voltar etapa"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={s.circleBackBtn}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="#1E3E25" strokeWidth={2.4} />
            </TouchableOpacity>

            {/* Stepper Dots com Pílula Ativa em Verde Militar */}
            <View style={s.stepDotsRow}>
              {STEPS_LIST.map((st, idx) => {
                const isCurrent = stepIndex === idx;
                const isCompleted = stepIndex > idx;
                return (
                  <View
                    key={st}
                    style={[
                      s.dotItem,
                      isCurrent && s.dotItemCurrent,
                      isCompleted && s.dotItemCompleted,
                    ]}
                  />
                );
              })}
            </View>

            <View style={{ width: 38 }} />
          </View>

          {/* Conteúdo Scrollável Centralizado */}
          <ScrollView
            contentContainerStyle={[
              s.scrollContent,
              { width: contentMaxWidth, flexGrow: 1 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Banner de Erro */}
            {!!error && (
              <Animated.View entering={FadeInDown.duration(200)} style={s.errorBanner}>
                <AlertCircle size={17} color="#DC2626" style={{ marginTop: 1 }} />
                <Text style={s.errorText}>{error}</Text>
              </Animated.View>
            )}

            {/* ══════════════════════════════════════════════════
                ETAPA 1: IDENTIFICAÇÃO FISCAL & ATUAÇÃO
            ══════════════════════════════════════════════════ */}
            {step === 'identificacao' && (
              <View style={s.stepContainer}>
                <View style={s.standaloneIconWrap}>
                  <Wrench size={42} color="#1E3E25" strokeWidth={2.2} />
                </View>

                <View style={s.textBlock}>
                  <Text style={s.heroTitle}>Quem é você?</Text>
                  <Text style={s.heroSub}>
                    Selecione sua forma de atuação e informe seus dados fiscais.
                  </Text>
                </View>

                {/* Seletor Segmentado: PJ vs PF */}
                <View style={s.segmentWrap}>
                  <View style={{ flex: 1 }}>
                    <GradientButton
                      variant={tipoPessoa === 'pj' ? 'primary' : 'secondary'}
                      size="sm"
                      title="Pessoa Jurídica (CNPJ)"
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                        setTipoPessoa('pj');
                      }}
                      style={s.segmentGradientBtn}
                      textStyle={[
                        s.segmentBtnText,
                        tipoPessoa === 'pj' && s.segmentBtnTextActive,
                      ]}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <GradientButton
                      variant={tipoPessoa === 'pf' ? 'primary' : 'secondary'}
                      size="sm"
                      title="Pessoa Física (CPF)"
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                        setTipoPessoa('pf');
                      }}
                      style={s.segmentGradientBtn}
                      textStyle={[
                        s.segmentBtnText,
                        tipoPessoa === 'pf' && s.segmentBtnTextActive,
                      ]}
                    />
                  </View>
                </View>

                {/* Se for PJ, seleção de porte */}
                {tipoPessoa === 'pj' && (
                  <View style={s.porteRow}>
                    <TouchableOpacity
                      style={[s.porteChip, portePj === 'mei' && s.porteChipAtivo]}
                      onPress={() => setPortePj('mei')}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.porteText, portePj === 'mei' && s.porteTextAtivo]}>MEI</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.porteChip, portePj === 'me_epp' && s.porteChipAtivo]}
                      onPress={() => setPortePj('me_epp')}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.porteText, portePj === 'me_epp' && s.porteTextAtivo]}>ME / EPP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.porteChip, portePj === 'grande' && s.porteChipAtivo]}
                      onPress={() => setPortePj('grande')}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.porteText, portePj === 'grande' && s.porteTextAtivo]}>Grande Porte</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Card de Inputs Elevado */}
                <View style={s.inputCard}>
                  {/* Documento Fiscal */}
                  <View style={s.fieldItem}>
                    <Text style={[s.inputLabel, focusedField === 'doc' && s.inputLabelFocused]}>
                      {tipoPessoa === 'pj' ? 'CNPJ DA EMPRESA' : 'CPF DO PRESTADOR'}
                    </Text>
                    <View style={[s.inputWrap, focusedField === 'doc' && s.inputWrapFocused]}>
                      {tipoPessoa === 'pj' ? (
                        <Building2 size={16} color={focusedField === 'doc' ? '#1E3E25' : '#94A3B8'} style={{ marginRight: 8 }} />
                      ) : (
                        <User size={16} color={focusedField === 'doc' ? '#1E3E25' : '#94A3B8'} style={{ marginRight: 8 }} />
                      )}
                      <TextInput
                        style={s.input}
                        placeholder={tipoPessoa === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'}
                        placeholderTextColor="#94A3B8"
                        value={documentoFiscal}
                        onChangeText={(t) => {
                          setDocumentoFiscal(tipoPessoa === 'pj' ? formatarCNPJ(t) : formatarCPF(t));
                          if (error) setError('');
                        }}
                        keyboardType="numeric"
                        maxLength={tipoPessoa === 'pj' ? 18 : 14}
                        onFocus={() => setFocusedField('doc')}
                        onBlur={() => setFocusedField(null)}
                      />
                    </View>
                  </View>

                  {/* Nome Completo ou Razão Social */}
                  <View style={[s.fieldItem, { marginTop: 12 }]}>
                    <Text style={[s.inputLabel, focusedField === 'nome' && s.inputLabelFocused]}>
                      {tipoPessoa === 'pj' ? 'RAZÃO SOCIAL' : 'NOME COMPLETO'}
                    </Text>
                    <View style={[s.inputWrap, focusedField === 'nome' && s.inputWrapFocused]}>
                      <TextInput
                        style={s.input}
                        placeholder={tipoPessoa === 'pj' ? 'Ex: Silva Reformas Prediais Ltda' : 'Ex: Carlos Silva Santos'}
                        placeholderTextColor="#94A3B8"
                        value={nomeRazao}
                        onChangeText={(t) => {
                          setNomeRazao(t);
                          if (error) setError('');
                        }}
                        autoCapitalize="words"
                        onFocus={() => setFocusedField('nome')}
                        onBlur={() => setFocusedField(null)}
                      />
                    </View>
                  </View>

                  {/* Nome Fantasia (se PJ) */}
                  {tipoPessoa === 'pj' && (
                    <View style={[s.fieldItem, { marginTop: 12 }]}>
                      <Text style={[s.inputLabel, focusedField === 'fantasia' && s.inputLabelFocused]}>
                        NOME FANTASIA (COMERCIAL)
                      </Text>
                      <View style={[s.inputWrap, focusedField === 'fantasia' && s.inputWrapFocused]}>
                        <TextInput
                          style={s.input}
                          placeholder="Ex: Silva Manutenções & Elétrica"
                          placeholderTextColor="#94A3B8"
                          value={nomeFantasia}
                          onChangeText={setNomeFantasia}
                          autoCapitalize="words"
                          onFocus={() => setFocusedField('fantasia')}
                          onBlur={() => setFocusedField(null)}
                        />
                      </View>
                    </View>
                  )}

                  {/* WhatsApp com DDI */}
                  <View style={[s.fieldItem, { marginTop: 12 }]}>
                    <Text style={[s.inputLabel, focusedField === 'phone' && s.inputLabelFocused]}>
                      WHATSAPP (COM DDD)
                    </Text>
                    <View style={s.phoneRow}>
                      <TouchableOpacity
                        onPress={() => setCountryModalOpen(true)}
                        activeOpacity={0.7}
                        style={s.countryPill}
                      >
                        <FlagIcon countryCode={selectedCountry.code} width={24} height={16} />
                        <ChevronDown size={12} color="#64748B" />
                      </TouchableOpacity>

                      <View style={[s.inputWrap, { flex: 1 }, focusedField === 'phone' && s.inputWrapFocused]}>
                        <Smartphone size={16} color={focusedField === 'phone' ? '#1E3E25' : '#94A3B8'} style={{ marginRight: 8 }} />
                        <TextInput
                          style={s.input}
                          placeholder="(11) 99999-9999"
                          placeholderTextColor="#94A3B8"
                          value={telefone}
                          onChangeText={(t) => {
                            setTelefone(formatarTelefone(t));
                            if (error) setError('');
                          }}
                          keyboardType="phone-pad"
                          maxLength={15}
                          onFocus={() => setFocusedField('phone')}
                          onBlur={() => setFocusedField(null)}
                        />
                      </View>
                    </View>
                  </View>
                </View>

                {/* Card de Confiança */}
                <View style={s.trustCard}>
                  <ShieldCheck size={16} color="#1E3E25" />
                  <Text style={s.trustCardTxt}>
                    Seus dados estão protegidos sob a LGPD e governança da Solfy PRO.
                  </Text>
                </View>
              </View>
            )}

            {/* ══════════════════════════════════════════════════
                ETAPA 2: CREDENCIAIS DE ACESSO
            ══════════════════════════════════════════════════ */}
            {step === 'credenciais' && (
              <View style={s.stepContainer}>
                <View style={s.standaloneIconWrap}>
                  <Lock size={42} color="#1E3E25" strokeWidth={2.2} />
                </View>

                <View style={s.textBlock}>
                  <Text style={s.heroTitle}>Acesso à Plataforma</Text>
                  <Text style={s.heroSub}>
                    Defina seu e-mail e uma senha segura para entrar no app.
                  </Text>
                </View>

                <View style={s.inputCard}>
                  {/* E-mail */}
                  <View style={s.fieldItem}>
                    <Text style={[s.inputLabel, focusedField === 'email' && s.inputLabelFocused]}>
                      E-MAIL PROFISSIONAL
                    </Text>
                    <View style={[s.inputWrap, focusedField === 'email' && s.inputWrapFocused]}>
                      <Mail size={16} color={focusedField === 'email' ? '#1E3E25' : '#94A3B8'} style={{ marginRight: 8 }} />
                      <TextInput
                        style={s.input}
                        placeholder="contato@suaempresa.com.br"
                        placeholderTextColor="#94A3B8"
                        value={email}
                        onChangeText={(t) => {
                          setEmail(t);
                          if (error) setError('');
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                      />
                    </View>
                  </View>

                  {/* Senha */}
                  <View style={[s.fieldItem, { marginTop: 12 }]}>
                    <Text style={[s.inputLabel, focusedField === 'password' && s.inputLabelFocused]}>
                      SENHA SEGURA
                    </Text>
                    <View style={[s.inputWrap, focusedField === 'password' && s.inputWrapFocused]}>
                      <Lock size={16} color={focusedField === 'password' ? '#1E3E25' : '#94A3B8'} style={{ marginRight: 8 }} />
                      <TextInput
                        style={[s.input, { flex: 1 }]}
                        placeholder="Mínimo de 6 caracteres"
                        placeholderTextColor="#94A3B8"
                        value={password}
                        onChangeText={(t) => {
                          setPassword(t);
                          if (error) setError('');
                        }}
                        secureTextEntry={!showPassword}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {showPassword ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Medidor de Força */}
                  {password.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <PasswordStrength value={password} />
                    </View>
                  )}

                  {/* Confirmar Senha */}
                  <View style={[s.fieldItem, { marginTop: 12 }]}>
                    <Text style={[s.inputLabel, focusedField === 'confirm' && s.inputLabelFocused]}>
                      CONFIRMAR SENHA
                    </Text>
                    <View style={[s.inputWrap, focusedField === 'confirm' && s.inputWrapFocused]}>
                      <Lock size={16} color={focusedField === 'confirm' ? '#1E3E25' : '#94A3B8'} style={{ marginRight: 8 }} />
                      <TextInput
                        style={[s.input, { flex: 1 }]}
                        placeholder="Digite a senha novamente"
                        placeholderTextColor="#94A3B8"
                        value={confirmPassword}
                        onChangeText={(t) => {
                          setConfirmPassword(t);
                          if (error) setError('');
                        }}
                        secureTextEntry={!showConfirmPassword}
                        onFocus={() => setFocusedField('confirm')}
                        onBlur={() => setFocusedField(null)}
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {showConfirmPassword ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Card de Confiança */}
                <View style={s.trustCard}>
                  <ShieldCheck size={16} color="#1E3E25" />
                  <Text style={s.trustCardTxt}>
                    Criptografia avançada de ponta a ponta para proteger suas credenciais.
                  </Text>
                </View>
              </View>
            )}

            {/* ══════════════════════════════════════════════════
                ETAPA 3: SERVIÇOS & RAIO DE ATENDIMENTO
            ══════════════════════════════════════════════════ */}
            {step === 'servicos' && (
              <View style={s.stepContainer}>
                <View style={s.standaloneIconWrap}>
                  <MapPin size={42} color="#1E3E25" strokeWidth={2.2} />
                </View>

                <View style={s.textBlock}>
                  <Text style={s.heroTitle}>Especialidades & Raio</Text>
                  <Text style={s.heroSub}>
                    Defina suas áreas técnicas e o alcance geográfico para despacho.
                  </Text>
                </View>

                <View style={s.inputCard}>
                  <Text style={s.inputLabel}>SELECIONE SUAS ESPECIALIDADES TÉCNICAS</Text>
                  <View style={s.categoriasWrap}>
                    {CATEGORIAS_PRESTADOR.map((cat) => {
                      const sel = categoriasSelecionadas.includes(cat.id);
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[s.categoriaChip, sel && s.categoriaChipAtiva]}
                          onPress={() => {
                            if (Platform.OS !== 'web') Haptics.selectionAsync();
                            if (sel) {
                              setCategoriasSelecionadas(categoriasSelecionadas.filter((id) => id !== cat.id));
                            } else {
                              setCategoriasSelecionadas([...categoriasSelecionadas, cat.id]);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.categoriaText, sel && s.categoriaTextAtiva]}>
                            {cat.label}
                          </Text>
                          {sel && <Check size={13} color="#FFFFFF" strokeWidth={2.8} style={{ marginLeft: 4 }} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[s.inputLabel, { marginTop: 18 }]}>RAIO MÁXIMO DE DESPACHO (KM)</Text>
                  <View style={s.raiosRow}>
                    {RAIOS_KM.map((r) => (
                      <TouchableOpacity
                        key={r}
                        style={[s.raioBtn, raioKm === r && s.raioBtnAtivo]}
                        onPress={() => {
                          if (Platform.OS !== 'web') Haptics.selectionAsync();
                          setRaioKm(r);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.raioText, raioKm === r && s.raioTextAtivo]}>{r} km</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* CEP Base */}
                  <View style={[s.fieldItem, { marginTop: 18 }]}>
                    <Text style={[s.inputLabel, focusedField === 'cep' && s.inputLabelFocused]}>
                      CEP BASE (SEU PONTO DE PARTIDA)
                    </Text>
                    <View style={[s.inputWrap, focusedField === 'cep' && s.inputWrapFocused]}>
                      <MapPin size={16} color={focusedField === 'cep' ? '#1E3E25' : '#94A3B8'} style={{ marginRight: 8 }} />
                      <TextInput
                        style={s.input}
                        placeholder="00000-000"
                        placeholderTextColor="#94A3B8"
                        value={cepBase}
                        onChangeText={handleCepChange}
                        keyboardType="numeric"
                        maxLength={9}
                        onFocus={() => setFocusedField('cep')}
                        onBlur={() => setFocusedField(null)}
                      />
                      {buscandoCep && <ActivityIndicator size="small" color="#1E3E25" />}
                    </View>

                    {cidadeBase ? (
                      <View style={s.geoBadge}>
                        <Sparkles size={13} color="#1E3E25" />
                        <Text style={s.geoBadgeTxt}>
                          {cidadeBase} / {ufBase} {bairroBase ? `— ${bairroBase}` : ''}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Card de Confiança */}
                <View style={s.trustCard}>
                  <ShieldCheck size={16} color="#1E3E25" />
                  <Text style={s.trustCardTxt}>
                    O raio base direciona chamados prioritários e orçamentos próximos à você.
                  </Text>
                </View>
              </View>
            )}

            {/* ══════════════════════════════════════════════════
                ETAPA 4: AGENDA & DISPONIBILIDADE
            ══════════════════════════════════════════════════ */}
            {step === 'disponibilidade' && (
              <View style={s.stepContainer}>
                <View style={s.standaloneIconWrap}>
                  <Clock size={42} color="#1E3E25" strokeWidth={2.2} />
                </View>

                <View style={s.textBlock}>
                  <Text style={s.heroTitle}>Agenda & Plantão</Text>
                  <Text style={s.heroSub}>
                    Configure seus horários de atendimento técnico aos condomínios.
                  </Text>
                </View>

                <View style={s.inputCard}>
                  <Text style={s.inputLabel}>DIAS DISPONÍVEIS DE ATENDIMENTO</Text>
                  <View style={s.diasRow}>
                    <TouchableOpacity
                      style={[
                        s.diaChip,
                        diasAtendimento.includes('seg_sex') && s.diaChipAtivo,
                      ]}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                        if (diasAtendimento.includes('seg_sex')) {
                          setDiasAtendimento(diasAtendimento.filter((d) => d !== 'seg_sex'));
                        } else {
                          setDiasAtendimento([...diasAtendimento, 'seg_sex']);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          s.diaText,
                          diasAtendimento.includes('seg_sex') && s.diaTextAtivo,
                        ]}
                      >
                        Segunda a Sexta
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        s.diaChip,
                        diasAtendimento.includes('sabado') && s.diaChipAtivo,
                      ]}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                        if (diasAtendimento.includes('sabado')) {
                          setDiasAtendimento(diasAtendimento.filter((d) => d !== 'sabado'));
                        } else {
                          setDiasAtendimento([...diasAtendimento, 'sabado']);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          s.diaText,
                          diasAtendimento.includes('sabado') && s.diaTextAtivo,
                        ]}
                      >
                        Sábados
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Horários */}
                  <View style={s.horasRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.inputLabel, focusedField === 'hIni' && s.inputLabelFocused]}>
                        INÍCIO
                      </Text>
                      <View style={[s.inputWrap, focusedField === 'hIni' && s.inputWrapFocused]}>
                        <Clock size={15} color="#94A3B8" style={{ marginRight: 6 }} />
                        <TextInput
                          style={s.input}
                          value={horarioInicio}
                          onChangeText={setHorarioInicio}
                          placeholder="08:00"
                          placeholderTextColor="#94A3B8"
                          onFocus={() => setFocusedField('hIni')}
                          onBlur={() => setFocusedField(null)}
                        />
                      </View>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[s.inputLabel, focusedField === 'hFim' && s.inputLabelFocused]}>
                        TÉRMINO
                      </Text>
                      <View style={[s.inputWrap, focusedField === 'hFim' && s.inputWrapFocused]}>
                        <Clock size={15} color="#94A3B8" style={{ marginRight: 6 }} />
                        <TextInput
                          style={s.input}
                          value={horarioFim}
                          onChangeText={setHorarioFim}
                          placeholder="18:00"
                          placeholderTextColor="#94A3B8"
                          onFocus={() => setFocusedField('hFim')}
                          onBlur={() => setFocusedField(null)}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Checkbox Plantão 24h */}
                  <TouchableOpacity
                    style={s.checkRow}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                      setAtendeEmergencia(!atendeEmergencia);
                    }}
                  >
                    <View style={[s.checkbox, atendeEmergencia && s.checkboxChecked]}>
                      {atendeEmergencia && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                    <Text style={s.checkLabel}>
                      Disponível para chamados de plantão & emergências técnicas 24h
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Card de Confiança */}
                <View style={s.trustCard}>
                  <ShieldCheck size={16} color="#1E3E25" />
                  <Text style={s.trustCardTxt}>
                    Você pode pausar ou alterar sua agenda a qualquer momento no painel.
                  </Text>
                </View>
              </View>
            )}

            {/* ══════════════════════════════════════════════════
                ETAPA 5: DOCUMENTOS KYC & TERMOS DE ADESÃO
            ══════════════════════════════════════════════════ */}
            {step === 'documentos' && (
              <View style={s.stepContainer}>
                <View style={s.standaloneIconWrap}>
                  <ShieldCheck size={42} color="#1E3E25" strokeWidth={2.2} />
                </View>

                <View style={s.textBlock}>
                  <Text style={s.heroTitle}>Documentação & Identificação</Text>
                  <Text style={s.heroSub}>
                    Para segurança da comunidade Solfy, envie as 3 fotos obrigatórias para análise técnica.
                  </Text>
                </View>

                {/* Banner de Dicas para Aprovação Rápida */}
                <View style={s.tipsBanner}>
                  <View style={s.tipsHeaderRow}>
                    <Lightbulb size={18} color="#D97706" />
                    <Text style={s.tipsTitle}>Dicas para aprovação rápida sem pendências</Text>
                  </View>
                  <Text style={s.tipsItem}>• Fotografe em local bem iluminado e evite reflexos de flash.</Text>
                  <Text style={s.tipsItem}>• Mantenha o documento inteiro visível, sem cortar bordas.</Text>
                  <Text style={s.tipsItem}>• Na selfie: segure o documento ao lado do rosto, garantindo que ambos fiquem 100% nítidos e sem cobrir seus olhos ou boca.</Text>
                </View>

                <View style={s.inputCard}>
                  {/* CAMPO 1: DOCUMENTO - FRENTE */}
                  <View style={s.docCardSection}>
                    <View style={s.docCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.docCardTitle}>1. Documento (RG ou CNH) — FRENTE</Text>
                        <Text style={s.docCardDesc}>Foto nítida da frente com sua foto e dados legíveis</Text>
                      </View>
                      {docFrenteUri ? (
                        <View style={s.docStatusBadgeSuccess}>
                          <Check size={12} color="#1E3E25" strokeWidth={3} />
                          <Text style={s.docStatusTextSuccess}>Anexada</Text>
                        </View>
                      ) : (
                        <View style={s.docStatusBadgeRequired}>
                          <Text style={s.docStatusTextRequired}>Obrigatória</Text>
                        </View>
                      )}
                    </View>

                    {docFrenteUri ? (
                      <View style={s.thumbnailContainer}>
                        <Image source={{ uri: docFrenteUri }} style={s.docThumbnailImage} contentFit="cover" />
                        <TouchableOpacity
                          style={s.refazerBtn}
                          onPress={() => handleCapturarFoto('frente', 'camera')}
                          activeOpacity={0.8}
                        >
                          <RotateCw size={14} color="#1E3E25" />
                          <Text style={s.refazerBtnText}>Refazer foto</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={s.docActionButtonsRow}>
                        <TouchableOpacity
                          style={s.btnFotoCamera}
                          activeOpacity={0.8}
                          onPress={() => handleCapturarFoto('frente', 'camera')}
                        >
                          <Camera size={18} color="#FFFFFF" strokeWidth={2.4} />
                          <Text style={s.btnFotoCameraText}>Tirar Foto</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.btnFotoGaleria}
                          activeOpacity={0.8}
                          onPress={() => handleCapturarFoto('frente', 'galeria')}
                        >
                          <Upload size={18} color="#1E3E25" strokeWidth={2.2} />
                          <Text style={s.btnFotoGaleriaText}>Galeria</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* CAMPO 2: DOCUMENTO - VERSO */}
                  <View style={[s.docCardSection, { marginTop: 16 }]}>
                    <View style={s.docCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.docCardTitle}>2. Documento (RG ou CNH) — VERSO</Text>
                        <Text style={s.docCardDesc}>Foto do verso com filiação e registros complementares</Text>
                      </View>
                      {docVersoUri ? (
                        <View style={s.docStatusBadgeSuccess}>
                          <Check size={12} color="#1E3E25" strokeWidth={3} />
                          <Text style={s.docStatusTextSuccess}>Anexada</Text>
                        </View>
                      ) : (
                        <View style={s.docStatusBadgeRequired}>
                          <Text style={s.docStatusTextRequired}>Obrigatória</Text>
                        </View>
                      )}
                    </View>

                    {docVersoUri ? (
                      <View style={s.thumbnailContainer}>
                        <Image source={{ uri: docVersoUri }} style={s.docThumbnailImage} contentFit="cover" />
                        <TouchableOpacity
                          style={s.refazerBtn}
                          onPress={() => handleCapturarFoto('verso', 'camera')}
                          activeOpacity={0.8}
                        >
                          <RotateCw size={14} color="#1E3E25" />
                          <Text style={s.refazerBtnText}>Refazer foto</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={s.docActionButtonsRow}>
                        <TouchableOpacity
                          style={s.btnFotoCamera}
                          activeOpacity={0.8}
                          onPress={() => handleCapturarFoto('verso', 'camera')}
                        >
                          <Camera size={18} color="#FFFFFF" strokeWidth={2.4} />
                          <Text style={s.btnFotoCameraText}>Tirar Foto</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.btnFotoGaleria}
                          activeOpacity={0.8}
                          onPress={() => handleCapturarFoto('verso', 'galeria')}
                        >
                          <Upload size={18} color="#1E3E25" strokeWidth={2.2} />
                          <Text style={s.btnFotoGaleriaText}>Galeria</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* CAMPO 3: SELFIE SEGURANDO O DOCUMENTO */}
                  <View style={[s.docCardSection, { marginTop: 16 }]}>
                    <View style={s.docCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.docCardTitle}>3. Selfie Segurando o Documento</Text>
                        <Text style={s.docCardDesc}>Segure o documento ao lado do rosto. Rosto e dados legíveis</Text>
                      </View>
                      {docSelfieUri ? (
                        <View style={s.docStatusBadgeSuccess}>
                          <Check size={12} color="#1E3E25" strokeWidth={3} />
                          <Text style={s.docStatusTextSuccess}>Anexada</Text>
                        </View>
                      ) : (
                        <View style={s.docStatusBadgeRequired}>
                          <Text style={s.docStatusTextRequired}>Obrigatória</Text>
                        </View>
                      )}
                    </View>

                    {docSelfieUri ? (
                      <View style={s.thumbnailContainer}>
                        <Image source={{ uri: docSelfieUri }} style={s.docThumbnailImage} contentFit="cover" />
                        <TouchableOpacity
                          style={s.refazerBtn}
                          onPress={() => handleCapturarFoto('selfie', 'camera')}
                          activeOpacity={0.8}
                        >
                          <RotateCw size={14} color="#1E3E25" />
                          <Text style={s.refazerBtnText}>Refazer selfie</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={s.docActionButtonsRow}>
                        <TouchableOpacity
                          style={[s.btnFotoCamera, { backgroundColor: '#092215' }]}
                          activeOpacity={0.8}
                          onPress={() => handleCapturarFoto('selfie', 'camera')}
                        >
                          <Camera size={18} color="#FFFFFF" strokeWidth={2.4} />
                          <Text style={s.btnFotoCameraText}>Tirar Selfie (Frontal)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.btnFotoGaleria}
                          activeOpacity={0.8}
                          onPress={() => handleCapturarFoto('selfie', 'galeria')}
                        >
                          <Upload size={18} color="#1E3E25" strokeWidth={2.2} />
                          <Text style={s.btnFotoGaleriaText}>Galeria</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Documento PJ (se aplicável) */}
                  {tipoPessoa === 'pj' && (
                    <View style={[s.docCardSection, { marginTop: 16 }]}>
                      <View style={s.docCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.docCardTitle}>Cartão CNPJ ou CCMEI (Opcional)</Text>
                          <Text style={s.docCardDesc}>Comprovante de inscrição e situação cadastral</Text>
                        </View>
                        {docPjUri && (
                          <View style={s.docStatusBadgeSuccess}>
                            <Check size={12} color="#1E3E25" strokeWidth={3} />
                            <Text style={s.docStatusTextSuccess}>Anexado</Text>
                          </View>
                        )}
                      </View>

                      {docPjUri ? (
                        <View style={s.thumbnailContainer}>
                          <Image source={{ uri: docPjUri }} style={s.docThumbnailImage} contentFit="cover" />
                          <TouchableOpacity
                            style={s.refazerBtn}
                            onPress={() => handleCapturarFoto('pj', 'camera')}
                            activeOpacity={0.8}
                          >
                            <RotateCw size={14} color="#1E3E25" />
                            <Text style={s.refazerBtnText}>Refazer comprovante</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={s.docActionButtonsRow}>
                          <TouchableOpacity
                            style={s.btnFotoCamera}
                            activeOpacity={0.8}
                            onPress={() => handleCapturarFoto('pj', 'camera')}
                          >
                            <Camera size={18} color="#FFFFFF" strokeWidth={2.4} />
                            <Text style={s.btnFotoCameraText}>Fotografar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={s.btnFotoGaleria}
                            activeOpacity={0.8}
                            onPress={() => handleCapturarFoto('pj', 'galeria')}
                          >
                            <Upload size={18} color="#1E3E25" strokeWidth={2.2} />
                            <Text style={s.btnFotoGaleriaText}>Galeria</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Se PJ Grande Porte: Termo Adicional Executivo */}
                  {tipoPessoa === 'pj' && portePj === 'grande' && (
                    <View style={s.termoGrandeBox}>
                      <Text style={s.termoGrandeTitulo}>Termo Adicional — Grande Porte</Text>
                      <Text style={s.termoGrandeTexto}>
                        Declaro sob as penas da lei a capacidade técnica operacional e anuo expressamente que a inadimplência na comissão pós-paga ensejará emissão de título executivo e cancelamento da mediação.
                      </Text>
                      <TouchableOpacity
                        style={[s.termsRow, { marginTop: 10, borderTopWidth: 0 }]}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (Platform.OS !== 'web') Haptics.selectionAsync();
                          setTermoGrandeAceito(!termoGrandeAceito);
                        }}
                      >
                        <View style={[s.checkbox, termoGrandeAceito && s.checkboxChecked]}>
                          {termoGrandeAceito && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                        </View>
                        <Text style={[s.termsText, { color: '#78350F', fontWeight: '700' }]}>
                          Li e aceito as condições e cláusulas executivas de Grande Porte.
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Verificação Anti-Bot Cloudflare Turnstile (Invisível em background) */}
                  {isCaptchaEnabled && (
                    <TurnstileWidget
                      resetKey={turnstileResetKey}
                      onToken={(t) => {
                        setCaptchaToken(t);
                        captchaTokenRef.current = t;
                        setCaptchaTokenTime(t ? Date.now() : 0);
                        if (t) setError('');
                      }}
                      onError={(msg) => {
                        setCaptchaToken(null);
                        captchaTokenRef.current = null;
                        setCaptchaTokenTime(0);
                        setError(msg || 'Não foi possível verificar, tente novamente');
                      }}
                    />
                  )}
                </View>

                {/* Card de Confiança */}
                <View style={s.trustCard}>
                  <ShieldCheck size={16} color="#1E3E25" />
                  <Text style={s.trustCardTxt}>
                    Ambiente seguro certificado. Documentos analisados de forma estritamente sigilosa.
                  </Text>
                </View>
              </View>
            )}

            {/* Termos e Condições (Texto Legal Direto sem Checkbox) + Botão de Conclusão */}
            <View style={s.footerBtnWrap}>
              {step === 'documentos' ? (
                <>
                  <View style={s.termsNoticeWrap}>
                    <Text style={s.termsNoticeText}>
                      Ao concluir, você concorda com os{' '}
                      <Text
                        style={s.termsNoticeLink}
                        onPress={() => {
                          Alert.alert(
                            'Termos de Adesão Solfy PRO',
                            '1. A Solfy conecta demandas condominiais qualificadas e prestadores certificados.\n2. A taxa de remuneração de sucesso só é devida após a formalização ou execução do serviço.\n3. Não há cobrança de mensalidade pré-paga para visualização de chamados.'
                          );
                        }}
                      >
                        Termos de Uso
                      </Text>{' '}
                      e a{' '}
                      <Text
                        style={s.termsNoticeLink}
                        onPress={() => {
                          Alert.alert(
                            'Política de Privacidade',
                            'Seus dados e documentos KYC são tratados com sigilo absoluto conforme a LGPD e armazenados em bucket com criptografia em repouso estritamente para homologação técnica.'
                          );
                        }}
                      >
                        Política de Privacidade
                      </Text>{' '}
                      da Solfy PRO.
                    </Text>
                  </View>

                  <GradientButton
                    variant="primary"
                    size="lg"
                    title="Concluir e Enviar para Análise"
                    loading={loading}
                    loadingText={loadingText || 'Processando...'}
                    disabled={
                      loading ||
                      !docFrenteUri ||
                      !docVersoUri ||
                      !docSelfieUri ||
                      (tipoPessoa === 'pj' && portePj === 'grande' && !termoGrandeAceito)
                    }
                    onPress={handleFinalizarCadastro}
                    style={s.footerGradientBtn}
                  />
                </>
              ) : (
                <GradientButton
                  variant="primary"
                  size="lg"
                  title="Continuar"
                  rightIcon={<ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />}
                  onPress={handleNextStep}
                  style={s.footerGradientBtn}
                />
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Modal de Seleção de País (DDI) */}
      <Modal
        visible={countryModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setCountryModalOpen(false)}
      >
        <TouchableOpacity
          style={s.modalBackdrop}
          activeOpacity={1}
          onPress={() => setCountryModalOpen(false)}
        >
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Código do País</Text>
              <TouchableOpacity onPress={() => setCountryModalOpen(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {COUNTRIES.map((c) => (
                <TouchableOpacity
                  key={c.code + c.name}
                  style={s.countryOption}
                  onPress={() => {
                    setSelectedCountry(c);
                    setCountryModalOpen(false);
                  }}
                >
                  <FlagIcon countryCode={c.code} width={28} height={18} />
                  <Text style={s.countryOptionName}>{c.name}</Text>
                  <Text style={s.countryOptionCode}>{c.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },

  // Ambient Background Solfy Condo
  ambientBg: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  ambientCircleTop: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#EDF4EE',
    opacity: 0.6,
  },
  ambientCircleBottom: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#E2EFE4',
    opacity: 0.5,
  },

  // Top Bar com Stepper
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    alignSelf: 'center',
    marginTop: 4,
  },
  circleBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EDF4EE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C8E2CC',
  },
  stepDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotItem: {
    width: 8,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D4E5D6',
  },
  dotItemCurrent: {
    width: 24,
    backgroundColor: '#1E3E25',
  },
  dotItemCompleted: {
    backgroundColor: '#2E5A36',
  },

  // Conteúdo Scrollável
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 32,
    alignSelf: 'center',
    alignItems: 'center',
  },
  stepContainer: {
    width: '100%',
    alignItems: 'center',
  },
  standaloneIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#EDF4EE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#C8E2CC',
    marginBottom: 12,
  },
  textBlock: {
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  heroTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#132817',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },

  // Segmented Control (PJ vs PF)
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: '#EDF4EE',
    borderRadius: 14,
    padding: 3,
    width: '100%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C8E2CC',
    gap: 6,
  },
  segmentGradientBtn: {
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#C8E2CC',
  },
  segmentBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#475569',
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Porte PJ Chips
  porteRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginBottom: 12,
  },
  porteChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  porteChipAtivo: {
    borderColor: '#1E3E25',
    backgroundColor: '#1E3E25',
  },
  porteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  porteTextAtivo: {
    color: '#FFFFFF',
  },

  // Card de Inputs Elevado
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 2,
        }),
  },
  fieldItem: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#1E3E25',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputLabelFocused: {
    color: '#132817',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 48,
  },
  inputWrapFocused: {
    borderColor: '#1E3E25',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
    padding: 0,
  },

  // Telefone / DDI
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 48,
  },

  // Especialidades & Categorias
  categoriasWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  categoriaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  categoriaChipAtiva: {
    borderColor: '#1E3E25',
    backgroundColor: '#1E3E25',
  },
  categoriaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  categoriaTextAtiva: {
    color: '#FFFFFF',
  },

  // Raios
  raiosRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  raioBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  raioBtnAtivo: {
    borderColor: '#1E3E25',
    backgroundColor: '#1E3E25',
  },
  raioText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  raioTextAtivo: {
    color: '#FFFFFF',
  },
  geoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDF4EE',
    borderWidth: 1,
    borderColor: '#C8E2CC',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  geoBadgeTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3E25',
  },

  // Dias e Horas
  diasRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  diaChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  diaChipAtivo: {
    borderColor: '#1E3E25',
    backgroundColor: '#EDF4EE',
  },
  diaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  diaTextAtivo: {
    color: '#1E3E25',
    fontWeight: '800',
  },
  horasRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    paddingTop: 8,
  },

  // Documentos Upload
  docUploadBoxGradient: {
    width: '100%',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    marginTop: 4,
  },
  docUploadBoxGradientFilled: {
    borderColor: '#1E3E25',
    backgroundColor: '#EDF4EE',
    borderStyle: 'solid',
  },
  docPlaceholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  docFilledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  docUploadBoxTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#132817',
  },
  docUploadSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  docUploadBoxTxtFilled: {
    fontSize: 13,
    fontWeight: '800',
    color: '#132817',
  },
  trocarTexto: {
    fontSize: 11.5,
    color: '#1E3E25',
    fontWeight: '600',
    marginTop: 2,
  },

  // Termos de Uso
  termoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 14,
  },
  termoTitulo: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  termoTexto: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  termoGrandeBox: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  termoGrandeTitulo: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
  },
  termoGrandeTexto: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 16,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#1E3E25',
    borderColor: '#1E3E25',
  },
  checkLabel: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  termsText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
    flex: 1,
    lineHeight: 17,
  },
  termsHighlight: {
    color: '#1E3E25',
    fontWeight: '800',
  },

  // Banner de Dicas
  tipsBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  tipsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  tipsTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#92400E',
  },
  tipsItem: {
    fontSize: 11.5,
    color: '#78350F',
    lineHeight: 16,
    marginTop: 2,
  },

  // Cards de Documentos KYC
  docCardSection: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
  },
  docCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  docCardTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#132817',
  },
  docCardDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  docStatusBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDF4EE',
    borderWidth: 1,
    borderColor: '#C8E2CC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  docStatusTextSuccess: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#1E3E25',
  },
  docStatusBadgeRequired: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  docStatusTextRequired: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  thumbnailContainer: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  docThumbnailImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#0F172A',
  },
  refazerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  refazerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3E25',
  },
  docActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btnFotoCamera: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E3E25',
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnFotoCameraText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  btnFotoGaleria: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnFotoGaleriaText: {
    color: '#1E3E25',
    fontSize: 12.5,
    fontWeight: '700',
  },

  // Termos Aviso Legal (Sem Checkbox)
  termsNoticeWrap: {
    width: '100%',
    paddingHorizontal: 8,
    paddingBottom: 12,
    alignItems: 'center',
  },
  termsNoticeText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsNoticeLink: {
    color: '#1E3E25',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },

  // Card de Confiança
  trustCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EDF4EE',
    borderWidth: 1,
    borderColor: '#C8E2CC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    width: '100%',
  },
  trustCardTxt: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#1E3E25',
    flex: 1,
    lineHeight: 16,
  },

  // Banner de Erro
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    width: '100%',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
    lineHeight: 16,
  },

  // Botão Primário de Ação
  footerBtnWrap: {
    marginTop: 18,
    width: '100%',
  },
  footerGradientBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
  },

  // Modal DDI
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    width: '100%',
    maxWidth: 360,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  countryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  countryOptionName: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  countryOptionCode: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
});
