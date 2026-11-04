import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import {
  ChevronRight,
  AlertCircle,
  Inbox,
  Lock,
  CheckCircle2,
  Info,
  X,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import { C, R, S, SH, FONT } from '../../constants/theme';
import { CONFIG_TEXTS } from '../../constants/configTexts';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

// ─── 1. LinhaConfig ──────────────────────────────────────────────────────────
export interface LinhaConfigProps {
  icone: React.ReactNode;
  titulo: string;
  subtitulo?: string;
  valorDireita?: string;
  atencao?: boolean;
  atencaoMotivo?: string | null;
  emBreve?: boolean;
  perigo?: boolean;
  desabilitado?: boolean;
  ultimoItem?: boolean;
  onPress?: () => void;
  acessibilidadeDica?: string;
}

export function LinhaConfig({
  icone,
  titulo,
  subtitulo,
  valorDireita,
  atencao = false,
  emBreve = false,
  perigo = false,
  desabilitado = false,
  ultimoItem = false,
  onPress,
  acessibilidadeDica,
}: LinhaConfigProps) {
  const handlePress = () => {
    if (desabilitado || !onPress) return;
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.linhaContainer,
        desabilitado && styles.linhaDesabilitada,
      ]}
      onPress={handlePress}
      disabled={desabilitado || !onPress}
      activeOpacity={0.65}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}${valorDireita ? `, ${valorDireita}` : ''}${emBreve ? `, ${CONFIG_TEXTS.comum.emBreveBadge}` : ''}`}
      accessibilityHint={acessibilidadeDica || subtitulo}
    >
      <View style={[styles.iconeBox, perigo && styles.iconeBoxPerigo]}>
        {icone}
      </View>

      <View style={styles.linhaTextos}>
        <View style={styles.linhaTituloRow}>
          <Text
            style={[styles.linhaTitulo, perigo && styles.linhaTituloPerigo]}
            numberOfLines={1}
          >
            {titulo}
          </Text>
          {atencao && !emBreve && (
            <View
              style={styles.pontoAtencao}
              accessibilityLabel="Requer atenção"
            />
          )}
        </View>
        {!!subtitulo && (
          <Text style={styles.linhaSubtitulo} numberOfLines={1}>
            {subtitulo}
          </Text>
        )}
      </View>

      <View style={styles.linhaDireita}>
        {emBreve ? (
          <View style={styles.badgeEmBreve}>
            <Text style={styles.badgeEmBreveTexto}>
              {CONFIG_TEXTS.comum.emBreveBadge}
            </Text>
          </View>
        ) : !!valorDireita ? (
          <Text
            style={[
              styles.valorDireitaTexto,
              atencao && styles.valorDireitaAtencao,
            ]}
            numberOfLines={1}
          >
            {valorDireita}
          </Text>
        ) : null}
        <ChevronRight
          size={16}
          color={perigo ? C.danger : '#94A3B8'}
          strokeWidth={2.2}
        />
      </View>

      {!ultimoItem && <View style={styles.divisorInterno} />}
    </TouchableOpacity>
  );
}

// ─── 2. SecaoConfig ──────────────────────────────────────────────────────────
export interface SecaoConfigProps {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}

export function SecaoConfig({ titulo, descricao, children }: SecaoConfigProps) {
  return (
    <View style={styles.secaoWrapper} accessibilityRole="summary">
      <View style={styles.secaoHeader}>
        <Text style={styles.secaoTitulo}>{titulo}</Text>
        {!!descricao && <Text style={styles.secaoDescricao}>{descricao}</Text>}
      </View>
      <View style={styles.secaoCard}>{children}</View>
    </View>
  );
}

// ─── 3. FolhaConfirmar ───────────────────────────────────────────────────────
export interface FolhaConfirmarProps {
  visivel: boolean;
  titulo: string;
  mensagem: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  perigo?: boolean;
  carregando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function FolhaConfirmar({
  visivel,
  titulo,
  mensagem,
  textoConfirmar = CONFIG_TEXTS.comum.confirmar,
  textoCancelar = CONFIG_TEXTS.comum.cancelar,
  perigo = false,
  carregando = false,
  onConfirmar,
  onCancelar,
}: FolhaConfirmarProps) {
  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={onCancelar}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.folhaCard} accessibilityViewIsModal>
          <View style={styles.folhaHeaderRow}>
            <Text style={styles.folhaTitulo}>{titulo}</Text>
            <TouchableOpacity
              onPress={onCancelar}
              disabled={carregando}
              style={styles.botaoFecharIcone}
              accessibilityRole="button"
              accessibilityLabel={CONFIG_TEXTS.comum.fechar}
            >
              <X size={20} color={C.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.folhaMensagem}>{mensagem}</Text>

          <View style={styles.folhaBotoesRow}>
            <TouchableOpacity
              style={styles.botaoSecundario}
              onPress={onCancelar}
              disabled={carregando}
              accessibilityRole="button"
              accessibilityLabel={textoCancelar}
            >
              <Text style={styles.botaoSecundarioTexto}>{textoCancelar}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.botaoPrimario,
                perigo && styles.botaoPrimarioPerigo,
                carregando && styles.botaoDesabilitado,
              ]}
              onPress={onConfirmar}
              disabled={carregando}
              accessibilityRole="button"
              accessibilityLabel={textoConfirmar}
            >
              {carregando ? (
                <ActivityIndicator size="small" color={C.textInverse} />
              ) : (
                <Text style={styles.botaoPrimarioTexto}>{textoConfirmar}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── 4. FolhaReautenticar ────────────────────────────────────────────────────
export interface FolhaReautenticarProps {
  visivel: boolean;
  titulo?: string;
  subtitulo?: string;
  carregando?: boolean;
  erro?: string | null;
  onConfirmarSenha: (senha: string) => void;
  onCancelar: () => void;
}

export function FolhaReautenticar({
  visivel,
  titulo = CONFIG_TEXTS.reautenticar.titulo,
  subtitulo = CONFIG_TEXTS.reautenticar.subtitulo,
  carregando = false,
  erro = null,
  onConfirmarSenha,
  onCancelar,
}: FolhaReautenticarProps) {
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  useEffect(() => {
    if (!visivel) {
      setSenha('');
      setErroLocal(null);
      setMostrarSenha(false);
    }
  }, [visivel]);

  const handleSubmit = () => {
    if (!senha.trim()) {
      setErroLocal(CONFIG_TEXTS.reautenticar.erroSenhaVazia);
      return;
    }
    setErroLocal(null);
    onConfirmarSenha(senha);
  };

  const msgErro = erro || erroLocal;

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={onCancelar}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.folhaCard} accessibilityViewIsModal>
          <View style={styles.folhaHeaderRow}>
            <View style={styles.reauthTitleWrap}>
              <Lock size={18} color={C.primary} />
              <Text style={styles.folhaTitulo}>{titulo}</Text>
            </View>
            <TouchableOpacity
              onPress={onCancelar}
              disabled={carregando}
              style={styles.botaoFecharIcone}
              accessibilityRole="button"
              accessibilityLabel={CONFIG_TEXTS.comum.fechar}
            >
              <X size={20} color={C.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.folhaMensagem}>{subtitulo}</Text>

          <View style={styles.campoWrapper}>
            <Text style={styles.campoLabel}>
              {CONFIG_TEXTS.reautenticar.labelSenha}
            </Text>
            <View
              style={[
                styles.inputRow,
                !!msgErro && styles.inputRowErro,
              ]}
            >
              <TextInput
                style={styles.inputFlex}
                value={senha}
                onChangeText={(t) => {
                  setSenha(t);
                  if (erroLocal) setErroLocal(null);
                }}
                placeholder={CONFIG_TEXTS.reautenticar.placeholderSenha}
                placeholderTextColor={C.textTertiary}
                secureTextEntry={!mostrarSenha}
                autoCapitalize="none"
                editable={!carregando}
                accessibilityLabel={CONFIG_TEXTS.reautenticar.labelSenha}
              />
              <TouchableOpacity
                onPress={() => setMostrarSenha((v) => !v)}
                style={styles.iconeOlhoBtn}
                accessibilityRole="button"
                accessibilityLabel={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? (
                  <EyeOff size={18} color={C.textSecondary} />
                ) : (
                  <Eye size={18} color={C.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
            {!!msgErro && <Text style={styles.campoErroTexto}>{msgErro}</Text>}
          </View>

          <View style={styles.folhaBotoesRow}>
            <TouchableOpacity
              style={styles.botaoSecundario}
              onPress={onCancelar}
              disabled={carregando}
              accessibilityRole="button"
              accessibilityLabel={CONFIG_TEXTS.comum.cancelar}
            >
              <Text style={styles.botaoSecundarioTexto}>
                {CONFIG_TEXTS.comum.cancelar}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.botaoPrimario,
                carregando && styles.botaoDesabilitado,
              ]}
              onPress={handleSubmit}
              disabled={carregando}
              accessibilityRole="button"
              accessibilityLabel={CONFIG_TEXTS.reautenticar.botaoConfirmar}
            >
              {carregando ? (
                <ActivityIndicator size="small" color={C.textInverse} />
              ) : (
                <Text style={styles.botaoPrimarioTexto}>
                  {CONFIG_TEXTS.reautenticar.botaoConfirmar}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── 5. CampoFormulario ──────────────────────────────────────────────────────
export interface CampoFormularioProps {
  label: string;
  valor: string;
  onChangeText: (texto: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  ajuda?: string;
  erro?: string | null;
  seloDireita?: string;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  editable?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export function CampoFormulario({
  label,
  valor,
  onChangeText,
  onBlur,
  placeholder,
  ajuda,
  erro,
  seloDireita,
  multiline = false,
  maxLength,
  keyboardType = 'default',
  editable = true,
  autoCapitalize = 'sentences',
}: CampoFormularioProps) {
  return (
    <View style={styles.campoWrapper}>
      <View style={styles.campoLabelRow}>
        <Text style={styles.campoLabel}>{label}</Text>
        {!!seloDireita && (
          <View style={styles.seloNeutro}>
            <Text style={styles.seloNeutroTexto}>{seloDireita}</Text>
          </View>
        )}
      </View>

      <TextInput
        style={[
          styles.inputBase,
          multiline && styles.inputMultiline,
          !editable && styles.inputSomenteLeitura,
          !!erro && styles.inputRowErro,
        ]}
        value={valor}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={C.textTertiary}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        editable={editable}
        autoCapitalize={autoCapitalize}
        accessibilityLabel={label}
      />

      {!!erro ? (
        <Text style={styles.campoErroTexto}>{erro}</Text>
      ) : !!ajuda ? (
        <Text style={styles.campoAjudaTexto}>{ajuda}</Text>
      ) : null}
    </View>
  );
}

// ─── 6. Interruptor ──────────────────────────────────────────────────────────
export interface InterruptorProps {
  label: string;
  subtitulo?: string;
  descricao?: string;
  icone?: React.ReactNode;
  valor?: boolean;
  ativo?: boolean;
  onValueChange?: (novoValor: boolean) => void;
  onAlterar?: (novoValor: boolean) => void;
  desabilitado?: boolean;
}

export function Interruptor({
  label,
  subtitulo,
  descricao,
  icone,
  valor,
  ativo,
  onValueChange,
  onAlterar,
  desabilitado = false,
}: InterruptorProps) {
  const isChecked = Boolean(valor ?? ativo);
  const textoApoio = subtitulo || descricao;

  const handlePress = () => {
    if (desabilitado) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const proximo = !isChecked;
    if (typeof onValueChange === 'function') {
      onValueChange(proximo);
    }
    if (typeof onAlterar === 'function') {
      onAlterar(proximo);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.interruptorRow, desabilitado && styles.linhaDesabilitada]}
      onPress={handlePress}
      activeOpacity={0.75}
      disabled={desabilitado}
      accessibilityRole="switch"
      accessibilityState={{ checked: isChecked, disabled: desabilitado }}
      accessibilityLabel={label}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
        {!!icone && <View>{icone}</View>}
        <View style={styles.linhaTextos}>
          <Text style={styles.linhaTitulo}>{label}</Text>
          {!!textoApoio && <Text style={styles.linhaSubtitulo}>{textoApoio}</Text>}
        </View>
      </View>

      <View style={[styles.switchTrack, isChecked && styles.switchTrackAtivo]}>
        <View style={[styles.switchThumb, isChecked && styles.switchThumbAtivo]} />
      </View>
    </TouchableOpacity>
  );
}

// ─── 7. ControleSegmentado ───────────────────────────────────────────────────
export interface OpcaoSegmento<T extends string = string> {
  valor: T;
  label: string;
}

export interface ControleSegmentadoProps<T extends string = string> {
  label?: string;
  opcoes: readonly OpcaoSegmento<T>[];
  valorSelecionado: T;
  onSelecionar: (valor: T) => void;
  desabilitado?: boolean;
}

export function ControleSegmentado<T extends string = string>({
  label,
  opcoes,
  valorSelecionado,
  onSelecionar,
  desabilitado = false,
}: ControleSegmentadoProps<T>) {
  const handleSelect = (val: T) => {
    if (desabilitado) return;
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    onSelecionar(val);
  };

  return (
    <View style={styles.campoWrapper}>
      {!!label && <Text style={styles.campoLabel}>{label}</Text>}
      <View style={styles.segmentoTrack} accessibilityRole="tablist">
        {opcoes.map((op) => {
          const ativo = op.valor === valorSelecionado;
          return (
            <TouchableOpacity
              key={op.valor}
              style={[styles.segmentoBotao, ativo && styles.segmentoBotaoAtivo]}
              onPress={() => handleSelect(op.valor)}
              disabled={desabilitado}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={op.label}
            >
              <Text
                style={[
                  styles.segmentoTexto,
                  ativo && styles.segmentoTextoAtivo,
                ]}
              >
                {op.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── 8. EstadoVazio ──────────────────────────────────────────────────────────
export interface EstadoVazioProps {
  titulo: string;
  subtitulo?: string;
  acaoTexto?: string;
  onAcao?: () => void;
}

export function EstadoVazio({
  titulo,
  subtitulo,
  acaoTexto,
  onAcao,
}: EstadoVazioProps) {
  return (
    <View style={styles.estadoBox}>
      <View style={styles.estadoIconeCirculo}>
        <Inbox size={26} color={C.primary} />
      </View>
      <Text style={styles.estadoTitulo}>{titulo}</Text>
      {!!subtitulo && <Text style={styles.estadoSubtitulo}>{subtitulo}</Text>}
      {!!acaoTexto && !!onAcao && (
        <TouchableOpacity
          style={styles.botaoPrimario}
          onPress={onAcao}
          accessibilityRole="button"
          accessibilityLabel={acaoTexto}
        >
          <Text style={styles.botaoPrimarioTexto}>{acaoTexto}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── 9. EstadoErro ───────────────────────────────────────────────────────────
export interface EstadoErroProps {
  titulo?: string;
  mensagem: string;
  onTentarDeNovo?: () => void;
}

export function EstadoErro({
  titulo = CONFIG_TEXTS.comum.erroCarregarTitulo,
  mensagem,
  onTentarDeNovo,
}: EstadoErroProps) {
  const router = useRouter();
  const lowerMsg = (mensagem || '').toLowerCase();
  const isSessaoExpirada =
    lowerMsg.includes('sessão') ||
    lowerMsg.includes('expirou') ||
    lowerMsg.includes('desconecte') ||
    lowerMsg.includes('401') ||
    lowerMsg.includes('unauthorized');

  return (
    <View style={styles.estadoBox} accessibilityRole="alert">
      <View style={[styles.estadoIconeCirculo, styles.estadoIconeErro]}>
        <AlertCircle size={26} color={C.danger} />
      </View>
      <Text style={styles.estadoTitulo}>{titulo}</Text>
      <Text style={styles.estadoSubtitulo}>{mensagem}</Text>
      {isSessaoExpirada ? (
        <TouchableOpacity
          style={styles.botaoPrimario}
          onPress={() => router.replace('/(auth)/login')}
          accessibilityRole="button"
          accessibilityLabel="Fazer login novamente"
        >
          <Text style={styles.botaoPrimarioTexto}>Fazer login novamente</Text>
        </TouchableOpacity>
      ) : (
        !!onTentarDeNovo && (
          <TouchableOpacity
            style={styles.botaoPrimario}
            onPress={onTentarDeNovo}
            accessibilityRole="button"
            accessibilityLabel={CONFIG_TEXTS.comum.tentarDeNovo}
          >
            <Text style={styles.botaoPrimarioTexto}>
              {CONFIG_TEXTS.comum.tentarDeNovo}
            </Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );
}

// ─── 10. EsqueletoLista ──────────────────────────────────────────────────────
export interface EsqueletoListaProps {
  linhas?: number;
}

export function EsqueletoLista({ linhas = 5 }: EsqueletoListaProps) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 750,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 750,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.esqueletoWrapper} accessibilityLabel="Carregando conteúdo">
      <Animated.View style={[styles.esqueletoHeaderCard, { opacity: pulse }]} />
      <View style={styles.secaoCard}>
        {Array.from({ length: linhas }).map((_, idx) => (
          <Animated.View
            key={idx}
            style={[
              styles.esqueletoRow,
              idx < linhas - 1 && styles.linhaBordaInferior,
              { opacity: pulse },
            ]}
          >
            <View style={styles.esqueletoIcone} />
            <View style={styles.esqueletoTextos}>
              <View style={styles.esqueletoBarraLonga} />
              <View style={styles.esqueletoBarraCurta} />
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ─── 11. Aviso (Toast / Banner de Feedback) ──────────────────────────────────
export interface AvisoProps {
  visivel: boolean;
  tipo?: 'sucesso' | 'erro' | 'info';
  mensagem: string;
  onFechar?: () => void;
}

export function Aviso({
  visivel,
  tipo = 'sucesso',
  mensagem,
  onFechar,
}: AvisoProps) {
  if (!visivel || !mensagem) return null;

  const isErro = tipo === 'erro';
  const isInfo = tipo === 'info';

  return (
    <View
      style={[
        styles.avisoContainer,
        isErro && styles.avisoErro,
        isInfo && styles.avisoInfo,
      ]}
      accessibilityRole="alert"
    >
      {isErro ? (
        <AlertCircle size={18} color={C.danger} />
      ) : isInfo ? (
        <Info size={18} color={C.info} />
      ) : (
        <CheckCircle2 size={18} color={C.primary} />
      )}
      <Text
        style={[
          styles.avisoTexto,
          isErro && styles.avisoTextoErro,
          isInfo && styles.avisoTextoInfo,
        ]}
      >
        {mensagem}
      </Text>
      {!!onFechar && (
        <TouchableOpacity
          onPress={onFechar}
          style={styles.avisoFecharBtn}
          accessibilityRole="button"
          accessibilityLabel={CONFIG_TEXTS.comum.fechar}
        >
          <X size={16} color={C.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  linhaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: C.bg1,
  },
  divisorInterno: {
    position: 'absolute',
    bottom: 0,
    left: 62,
    right: 0,
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  linhaBordaInferior: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  linhaDesabilitada: {
    opacity: 0.55,
  },
  iconeBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EDF4EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconeBoxPerigo: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  linhaTextos: {
    flex: 1,
    paddingRight: S.xs,
  },
  linhaTituloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
  },
  linhaTitulo: {
    fontFamily: FONT.semibold,
    fontSize: 14.5,
    color: C.textPrimary,
  },
  linhaTituloPerigo: {
    color: C.danger,
  },
  pontoAtencao: {
    width: 7,
    height: 7,
    borderRadius: R.pill,
    backgroundColor: C.warning,
  },
  linhaSubtitulo: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },
  linhaDireita: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '44%',
  },
  valorDireitaTexto: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: C.textSecondary,
  },
  valorDireitaAtencao: {
    color: C.warning,
    fontFamily: FONT.semibold,
  },
  badgeEmBreve: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: R.pill,
  },
  badgeEmBreveTexto: {
    fontFamily: FONT.semibold,
    fontSize: 10.5,
    color: C.textSecondary,
  },
  secaoWrapper: {
    marginBottom: 20,
  },
  secaoHeader: {
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  secaoTitulo: {
    fontFamily: FONT.semibold,
    fontSize: 11.5,
    letterSpacing: 0.5,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  secaoDescricao: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },
  secaoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(19, 40, 23, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: S.lg,
  },
  folhaCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: C.bg1,
    borderRadius: R.lg,
    padding: S.lg,
    ...SH.md,
  },
  folhaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S.sm,
  },
  reauthTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
  },
  folhaTitulo: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: C.textPrimary,
  },
  botaoFecharIcone: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folhaMensagem: {
    fontFamily: FONT.regular,
    fontSize: 14,
    lineHeight: 20,
    color: C.textSecondary,
    marginBottom: S.md,
  },
  folhaBotoesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: S.sm,
    marginTop: S.sm,
  },
  botaoPrimario: {
    minHeight: 44,
    paddingHorizontal: S.lg,
    paddingVertical: S.sm,
    borderRadius: R.sm,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoPrimarioPerigo: {
    backgroundColor: C.danger,
  },
  botaoDesabilitado: {
    opacity: 0.5,
  },
  botaoPrimarioTexto: {
    fontFamily: FONT.semibold,
    fontSize: 14,
    color: C.textInverse,
  },
  botaoSecundario: {
    minHeight: 44,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    borderRadius: R.sm,
    backgroundColor: C.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoSecundarioTexto: {
    fontFamily: FONT.semibold,
    fontSize: 14,
    color: C.textPrimary,
  },
  campoWrapper: {
    marginBottom: S.md,
  },
  campoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S.xs,
    gap: S.xs,
  },
  campoLabel: {
    fontFamily: FONT.semibold,
    fontSize: 13,
    color: C.textPrimary,
  },
  seloNeutro: {
    backgroundColor: C.warningBg,
    paddingHorizontal: S.xs,
    paddingVertical: 2,
    borderRadius: R.pill,
  },
  seloNeutroTexto: {
    fontFamily: FONT.medium,
    fontSize: 11,
    color: C.warning,
  },
  inputBase: {
    minHeight: 46,
    backgroundColor: C.bg0,
    borderWidth: 1,
    borderColor: C.divider,
    borderRadius: R.sm,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    fontFamily: FONT.regular,
    fontSize: 15,
    color: C.textPrimary,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  inputSomenteLeitura: {
    backgroundColor: C.bg2,
    color: C.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    backgroundColor: C.bg0,
    borderWidth: 1,
    borderColor: C.divider,
    borderRadius: R.sm,
    paddingHorizontal: S.sm,
  },
  inputRowErro: {
    borderColor: C.danger,
  },
  inputFlex: {
    flex: 1,
    minHeight: 44,
    fontFamily: FONT.regular,
    fontSize: 15,
    color: C.textPrimary,
  },
  iconeOlhoBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  campoErroTexto: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: C.danger,
    marginTop: S.xxs,
  },
  campoAjudaTexto: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: C.textSecondary,
    marginTop: S.xxs,
  },
  interruptorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    backgroundColor: C.bg1,
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackAtivo: {
    backgroundColor: C.primary,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.15,
    shadowRadius: 2.5,
    elevation: 2,
  },
  switchThumbAtivo: {
    alignSelf: 'flex-end',
  },
  segmentoTrack: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  segmentoBotao: {
    flex: 1,
    minHeight: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentoBotaoAtivo: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentoTexto: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: C.textSecondary,
  },
  segmentoTextoAtivo: {
    fontFamily: FONT.semibold,
    color: C.primary,
  },
  estadoBox: {
    backgroundColor: C.bg1,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.divider,
    padding: S.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: S.md,
  },
  estadoIconeCirculo: {
    width: 52,
    height: 52,
    borderRadius: R.pill,
    backgroundColor: C.primaryBgLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.sm,
  },
  estadoIconeErro: {
    backgroundColor: C.dangerBg,
  },
  estadoTitulo: {
    fontFamily: FONT.bold,
    fontSize: 16,
    color: C.textPrimary,
    textAlign: 'center',
    marginBottom: S.xxs,
  },
  estadoSubtitulo: {
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
    color: C.textSecondary,
    textAlign: 'center',
    marginBottom: S.md,
  },
  esqueletoWrapper: {
    gap: S.md,
  },
  esqueletoHeaderCard: {
    height: 112,
    borderRadius: R.md,
    backgroundColor: C.bg3,
  },
  esqueletoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: S.md,
    gap: S.sm,
  },
  esqueletoIcone: {
    width: 36,
    height: 36,
    borderRadius: R.sm,
    backgroundColor: C.bg3,
  },
  esqueletoTextos: {
    flex: 1,
    gap: S.xs,
  },
  esqueletoBarraLonga: {
    width: '62%',
    height: 12,
    borderRadius: R.xs,
    backgroundColor: C.bg3,
  },
  esqueletoBarraCurta: {
    width: '38%',
    height: 10,
    borderRadius: R.xs,
    backgroundColor: C.bg2,
  },
  avisoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primaryBgLight,
    borderWidth: 1,
    borderColor: C.primary,
    borderRadius: R.sm,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    marginBottom: S.md,
    gap: S.xs,
  },
  avisoErro: {
    backgroundColor: C.dangerBg,
    borderColor: C.danger,
  },
  avisoInfo: {
    backgroundColor: C.infoBg,
    borderColor: C.info,
  },
  avisoTexto: {
    flex: 1,
    fontFamily: FONT.medium,
    fontSize: 13,
    color: C.primaryDark,
  },
  avisoTextoErro: {
    color: C.danger,
  },
  avisoTextoInfo: {
    color: C.info,
  },
  avisoFecharBtn: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
