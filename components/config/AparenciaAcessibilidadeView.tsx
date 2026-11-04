import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  ArrowLeft,
  Sun,
  Moon,
  Smartphone,
  Globe,
  Sliders,
  Eye,
  Zap,
  Sparkles,
  WifiOff,
  Check,
} from 'lucide-react-native';
import { C, R, S, SH, FONT } from '../../constants/theme';
import { CONFIG_TEXTS, traduzirErroServidor } from '../../constants/configTexts';
import {
  SecaoConfig,
  ControleSegmentado,
  Interruptor,
  Aviso,
  EsqueletoLista,
  EstadoErro,
} from './ConfigComponents';
import {
  carregarPreferenciasAparenciaAcessibilidade,
  salvarPreferenciasAparenciaAcessibilidade,
  type PreferenciasAparenciaAcessibilidade,
  type AcessibilidadeFlags,
} from '../../lib/condoConfigApi';

interface AparenciaAcessibilidadeViewProps {
  onVoltar: () => void;
  focoInicial?: 'tema' | 'idioma' | 'acessibilidade';
  onPreferenciasAtualizadas?: () => void;
  valoresIniciais?: {
    tema?: 'claro' | 'escuro' | 'sistema';
    idioma?: 'pt-BR' | 'en-US' | 'es-ES';
    fuso?: string;
    acessibilidade?: Partial<AcessibilidadeFlags>;
  };
}

export function AparenciaAcessibilidadeView({
  onVoltar,
  focoInicial = 'tema',
  onPreferenciasAtualizadas,
  valoresIniciais,
}: AparenciaAcessibilidadeViewProps) {
  const [carregando, setCarregando] = useState(!valoresIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Estados locais inicializados com valoresIniciais ou padrão
  const [tema, setTema] = useState<'claro' | 'escuro' | 'sistema'>(
    valoresIniciais?.tema || 'claro'
  );
  const [idioma, setIdioma] = useState<'pt-BR' | 'en-US' | 'es-ES'>(
    valoresIniciais?.idioma || 'pt-BR'
  );
  const [fuso, setFuso] = useState(
    valoresIniciais?.fuso || 'America/Sao_Paulo'
  );
  const [acessibilidade, setAcessibilidade] = useState<AcessibilidadeFlags>({
    alto_contraste: Boolean(valoresIniciais?.acessibilidade?.alto_contraste),
    reduzir_movimento: Boolean(valoresIniciais?.acessibilidade?.reduzir_movimento),
    reduzir_transparencia: Boolean(valoresIniciais?.acessibilidade?.reduzir_transparencia),
  });

  const [aviso, setAviso] = useState<{
    visivel: boolean;
    tipo: 'sucesso' | 'erro' | 'info';
    mensagem: string;
  }>({ visivel: false, tipo: 'info', mensagem: '' });

  // Monitor de rede
  useEffect(() => {
    const unsub = NetInfo.addEventListener((st) => {
      setOffline(!st.isConnected);
    });
    return () => unsub();
  }, []);

  const carregarDados = useCallback(async () => {
    if (!valoresIniciais) {
      setCarregando(true);
    }
    setErro(null);
    try {
      const res = await carregarPreferenciasAparenciaAcessibilidade();
      setTema(res.dados.tema);
      setIdioma(res.dados.idioma);
      setFuso(res.dados.fuso);
      setAcessibilidade(res.dados.acessibilidade);
      if (res.doCacheOffline) {
        setOffline(true);
      }
    } catch (err) {
      const msg = traduzirErroServidor(err);
      if (!valoresIniciais) {
        setErro(msg);
      } else {
        setAviso({
          visivel: true,
          tipo: 'erro',
          mensagem: msg,
        });
      }
    } finally {
      setCarregando(false);
    }
  }, [valoresIniciais]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleMudarTema = async (novoTema: string) => {
    if (offline) {
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: CONFIG_TEXTS.comum.offlineBloqueioEscrita,
      });
      return;
    }
    const anterior = tema;
    const valido = novoTema as 'claro' | 'escuro' | 'sistema';
    setTema(valido); // Otimista

    setSalvando(true);
    try {
      await salvarPreferenciasAparenciaAcessibilidade(valido, undefined, undefined, undefined);
      setAviso({
        visivel: true,
        tipo: 'sucesso',
        mensagem: 'Modo de aparência atualizado com sucesso.',
      });
      onPreferenciasAtualizadas?.();
    } catch (err) {
      setTema(anterior); // Reversão
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: traduzirErroServidor(err),
      });
    } finally {
      setSalvando(false);
    }
  };

  const handleMudarIdioma = async (novoIdioma: string) => {
    if (offline) {
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: CONFIG_TEXTS.comum.offlineBloqueioEscrita,
      });
      return;
    }

    if (novoIdioma !== 'pt-BR') {
      setAviso({
        visivel: true,
        tipo: 'info',
        mensagem:
          'O idioma selecionado está em fase de homologação dos termos jurídicos e condominiais. O padrão segue em Português (Brasil).',
      });
      return;
    }

    const anterior = idioma;
    setIdioma('pt-BR');

    setSalvando(true);
    try {
      await salvarPreferenciasAparenciaAcessibilidade(undefined, 'pt-BR', undefined, undefined);
      setAviso({
        visivel: true,
        tipo: 'sucesso',
        mensagem: 'Idioma atualizado com sucesso.',
      });
      onPreferenciasAtualizadas?.();
    } catch (err) {
      setIdioma(anterior);
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: traduzirErroServidor(err),
      });
    } finally {
      setSalvando(false);
    }
  };

  const handleToggleAcessibilidade = async (chave: keyof AcessibilidadeFlags) => {
    if (offline) {
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: CONFIG_TEXTS.comum.offlineBloqueioEscrita,
      });
      return;
    }

    const anterior = acessibilidade;
    const novoValor = !acessibilidade[chave];
    const atualizado: AcessibilidadeFlags = {
      ...acessibilidade,
      [chave]: novoValor,
    };
    setAcessibilidade(atualizado); // Otimista

    setSalvando(true);
    try {
      await salvarPreferenciasAparenciaAcessibilidade(undefined, undefined, undefined, atualizado);
      setAviso({
        visivel: true,
        tipo: 'sucesso',
        mensagem: 'Ajuste de acessibilidade salvo.',
      });
      onPreferenciasAtualizadas?.();
    } catch (err) {
      setAcessibilidade(anterior); // Reversão
      setAviso({
        visivel: true,
        tipo: 'erro',
        mensagem: traduzirErroServidor(err),
      });
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.botaoVoltar} onPress={onVoltar}>
            <ArrowLeft size={20} color={C.textPrimary} />
            <Text style={styles.botaoVoltarTexto}>{CONFIG_TEXTS.comum.voltar}</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitulo}>Aparência & Idioma</Text>
          <View style={{ width: 68 }} />
        </View>
        <EsqueletoLista linhas={4} />
      </View>
    );
  }

  if (erro) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.botaoVoltar} onPress={onVoltar}>
            <ArrowLeft size={20} color={C.textPrimary} />
            <Text style={styles.botaoVoltarTexto}>{CONFIG_TEXTS.comum.voltar}</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitulo}>Aparência & Idioma</Text>
          <View style={{ width: 68 }} />
        </View>
        <EstadoErro
          titulo={CONFIG_TEXTS.comum.erroCarregarTitulo}
          mensagem={erro}
          onTentarDeNovo={carregarDados}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Barra de Topo */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={onVoltar}
          accessibilityRole="button"
          accessibilityLabel={CONFIG_TEXTS.comum.voltar}
        >
          <ArrowLeft size={20} color={C.textPrimary} />
          <Text style={styles.botaoVoltarTexto}>{CONFIG_TEXTS.comum.voltar}</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitulo}>Aparência & Idioma</Text>
        <View style={{ width: 68, alignItems: 'flex-end' }}>
          {salvando && <ActivityIndicator size="small" color={C.primary} />}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Offline */}
        {offline && (
          <View style={styles.offlineBanner}>
            <WifiOff size={16} color={C.warning} />
            <Text style={styles.offlineTexto}>
              {CONFIG_TEXTS.comum.offlineBloqueioEscrita}
            </Text>
          </View>
        )}

        <Aviso
          visivel={aviso.visivel}
          tipo={aviso.tipo}
          mensagem={aviso.mensagem}
          onFechar={() => setAviso((p) => ({ ...p, visivel: false }))}
        />

        {/* 1. SEÇÃO TEMA E APARÊNCIA */}
        <SecaoConfig
          titulo={CONFIG_TEXTS.aparencia.titulo}
          descricao={CONFIG_TEXTS.aparencia.subtitulo}
        >
          <View style={styles.cardPadding}>
            <ControleSegmentado
              label={CONFIG_TEXTS.aparencia.modoAparenciaLabel}
              opcoes={[
                { valor: 'claro', label: 'Claro' },
                { valor: 'escuro', label: 'Escuro' },
                { valor: 'sistema', label: 'Sistema' },
              ]}
              valorSelecionado={tema}
              onSelecionar={handleMudarTema}
              desabilitado={salvando || offline}
            />

            {/* Cartões visuais de prévia */}
            <View style={styles.previaContainer}>
              <View
                style={[
                  styles.previaCard,
                  styles.previaClaro,
                  tema === 'claro' && styles.previaCardAtivo,
                ]}
              >
                <Sun size={18} color="#2E5A36" />
                <Text style={styles.previaTituloClaro}>Claro</Text>
                <Text style={styles.previaDescClaro}>Verde Musgo & Branco</Text>
              </View>

              <View
                style={[
                  styles.previaCard,
                  styles.previaEscuro,
                  tema === 'escuro' && styles.previaCardAtivo,
                ]}
              >
                <Moon size={18} color="#34D399" />
                <Text style={styles.previaTituloEscuro}>Escuro</Text>
                <Text style={styles.previaDescEscuro}>Ardósia & Esmeralda</Text>
              </View>

              <View
                style={[
                  styles.previaCard,
                  styles.previaSistema,
                  tema === 'sistema' && styles.previaCardAtivo,
                ]}
              >
                <Smartphone size={18} color={C.textSecondary} />
                <Text style={styles.previaTituloSistema}>Sistema</Text>
                <Text style={styles.previaDescSistema}>Automático</Text>
              </View>
            </View>

            <Text style={styles.notaExplicativa}>
              {CONFIG_TEXTS.aparencia.avisoEscuroHonesto}
            </Text>
          </View>
        </SecaoConfig>

        {/* 2. SEÇÃO IDIOMA E REGIÃO */}
        <SecaoConfig
          titulo={CONFIG_TEXTS.idiomaConfig.titulo}
          descricao={CONFIG_TEXTS.idiomaConfig.subtitulo}
        >
          <View style={styles.cardPadding}>
            {/* Opção pt-BR */}
            <TouchableOpacity
              style={[
                styles.opcaoIdiomaCard,
                idioma === 'pt-BR' && styles.opcaoIdiomaCardAtivo,
              ]}
              onPress={() => handleMudarIdioma('pt-BR')}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={styles.opcaoIdiomaLeft}>
                <View style={styles.radioCirculo}>
                  {idioma === 'pt-BR' && <View style={styles.radioPonto} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.opcaoIdiomaLabel}>
                    {CONFIG_TEXTS.idiomaConfig.opcoes.ptBR.label}
                  </Text>
                  <Text style={styles.opcaoIdiomaDesc}>
                    {CONFIG_TEXTS.idiomaConfig.opcoes.ptBR.detalhe}
                  </Text>
                </View>
              </View>
              <View style={styles.badgeAtivo}>
                <Check size={12} color="#059669" />
                <Text style={styles.badgeAtivoTexto}>Ativo</Text>
              </View>
            </TouchableOpacity>

            {/* Opção en-US */}
            <TouchableOpacity
              style={styles.opcaoIdiomaCard}
              onPress={() => handleMudarIdioma('en-US')}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={styles.opcaoIdiomaLeft}>
                <View style={styles.radioCirculo}>
                  {idioma === 'en-US' && <View style={styles.radioPonto} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.opcaoIdiomaLabel}>
                    {CONFIG_TEXTS.idiomaConfig.opcoes.enUS.label}
                  </Text>
                  <Text style={styles.opcaoIdiomaDesc}>
                    {CONFIG_TEXTS.idiomaConfig.opcoes.enUS.detalhe}
                  </Text>
                </View>
              </View>
              <View style={styles.badgeEmBreve}>
                <Text style={styles.badgeEmBreveTexto}>Em breve</Text>
              </View>
            </TouchableOpacity>

            {/* Opção es-ES */}
            <TouchableOpacity
              style={styles.opcaoIdiomaCard}
              onPress={() => handleMudarIdioma('es-ES')}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={styles.opcaoIdiomaLeft}>
                <View style={styles.radioCirculo}>
                  {idioma === 'es-ES' && <View style={styles.radioPonto} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.opcaoIdiomaLabel}>
                    {CONFIG_TEXTS.idiomaConfig.opcoes.esES.label}
                  </Text>
                  <Text style={styles.opcaoIdiomaDesc}>
                    {CONFIG_TEXTS.idiomaConfig.opcoes.esES.detalhe}
                  </Text>
                </View>
              </View>
              <View style={styles.badgeEmBreve}>
                <Text style={styles.badgeEmBreveTexto}>Em breve</Text>
              </View>
            </TouchableOpacity>

            {/* Caixa de fuso horário e convenções */}
            <View style={styles.fusoContainer}>
              <Globe size={18} color={C.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fusoTitulo}>
                  {CONFIG_TEXTS.idiomaConfig.fusoHorarioTitulo}
                </Text>
                <Text style={styles.fusoDesc}>
                  {CONFIG_TEXTS.idiomaConfig.fusoHorarioDesc}
                </Text>
              </View>
            </View>
          </View>
        </SecaoConfig>

        {/* 3. SEÇÃO ACESSIBILIDADE */}
        <SecaoConfig
          titulo={CONFIG_TEXTS.acessibilidadeConfig.titulo}
          descricao={CONFIG_TEXTS.acessibilidadeConfig.subtitulo}
        >
          <View style={styles.cardPadding}>
            {/* Alto Contraste */}
            <Interruptor
              label={CONFIG_TEXTS.acessibilidadeConfig.altoContraste.titulo}
              subtitulo={CONFIG_TEXTS.acessibilidadeConfig.altoContraste.descricao}
              icone={<Eye size={20} color={C.primary} />}
              valor={acessibilidade.alto_contraste}
              ativo={acessibilidade.alto_contraste}
              onValueChange={() => handleToggleAcessibilidade('alto_contraste')}
              desabilitado={salvando || offline}
            />

            <View style={styles.divisor} />

            {/* Reduzir Movimento */}
            <Interruptor
              label={CONFIG_TEXTS.acessibilidadeConfig.reduzirMovimento.titulo}
              subtitulo={CONFIG_TEXTS.acessibilidadeConfig.reduzirMovimento.descricao}
              icone={<Zap size={20} color="#D97706" />}
              valor={acessibilidade.reduzir_movimento}
              ativo={acessibilidade.reduzir_movimento}
              onValueChange={() => handleToggleAcessibilidade('reduzir_movimento')}
              desabilitado={salvando || offline}
            />

            <View style={styles.divisor} />

            {/* Reduzir Transparência */}
            <Interruptor
              label={CONFIG_TEXTS.acessibilidadeConfig.reduzirTransparencia.titulo}
              subtitulo={CONFIG_TEXTS.acessibilidadeConfig.reduzirTransparencia.descricao}
              icone={<Sparkles size={20} color="#7C3AED" />}
              valor={acessibilidade.reduzir_transparencia}
              ativo={acessibilidade.reduzir_transparencia}
              onValueChange={() => handleToggleAcessibilidade('reduzir_transparencia')}
              desabilitado={salvando || offline}
            />
          </View>
        </SecaoConfig>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  topBar: {
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
    gap: 8,
    minHeight: 40,
    paddingRight: 12,
  },
  botaoVoltarTexto: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: '#132817',
  },
  topBarTitulo: {
    fontSize: 16.5,
    fontFamily: FONT.bold,
    color: '#132817',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  offlineTexto: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: '#92400E',
    flex: 1,
  },
  cardPadding: {
    padding: 16,
    gap: 16,
  },
  previaContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  previaCard: {
    flex: 1,
    padding: 12,
    borderRadius: R.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  previaCardAtivo: {
    borderWidth: 2,
    borderColor: C.primary,
  },
  previaClaro: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  previaEscuro: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  previaSistema: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  previaTituloClaro: {
    fontSize: 12,
    fontFamily: FONT.bold,
    color: '#132817',
  },
  previaDescClaro: {
    fontSize: 9,
    fontFamily: FONT.regular,
    color: '#64748B',
    textAlign: 'center',
  },
  previaTituloEscuro: {
    fontSize: 12,
    fontFamily: FONT.bold,
    color: '#F8FAFC',
  },
  previaDescEscuro: {
    fontSize: 9,
    fontFamily: FONT.regular,
    color: '#94A3B8',
    textAlign: 'center',
  },
  previaTituloSistema: {
    fontSize: 12,
    fontFamily: FONT.bold,
    color: '#334155',
  },
  previaDescSistema: {
    fontSize: 9,
    fontFamily: FONT.regular,
    color: '#64748B',
    textAlign: 'center',
  },
  notaExplicativa: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: C.textSecondary,
    lineHeight: 16,
  },
  opcaoIdiomaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: R.md,
    backgroundColor: C.background,
    borderWidth: 1,
    borderColor: C.border,
  },
  opcaoIdiomaCardAtivo: {
    borderColor: C.primary,
    backgroundColor: '#FAFDFB',
  },
  opcaoIdiomaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  radioCirculo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioPonto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primary,
  },
  opcaoIdiomaLabel: {
    fontSize: 13,
    fontFamily: FONT.bold,
    color: C.textPrimary,
  },
  opcaoIdiomaDesc: {
    fontSize: 11,
    fontFamily: FONT.regular,
    color: C.textSecondary,
    marginTop: 2,
  },
  badgeAtivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  badgeAtivoTexto: {
    fontSize: 10,
    fontFamily: FONT.bold,
    color: '#059669',
  },
  badgeEmBreve: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  badgeEmBreveTexto: {
    fontSize: 10,
    fontFamily: FONT.semiBold,
    color: '#D97706',
  },
  fusoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.primaryLight,
    padding: 12,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.primaryBg,
  },
  fusoTitulo: {
    fontSize: 12,
    fontFamily: FONT.bold,
    color: C.primaryDark,
  },
  fusoDesc: {
    fontSize: 11,
    fontFamily: FONT.regular,
    color: C.primary,
    marginTop: 2,
    lineHeight: 15,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  switchTitulo: {
    fontSize: 13,
    fontFamily: FONT.bold,
    color: C.textPrimary,
  },
  switchDesc: {
    fontSize: 11.5,
    fontFamily: FONT.regular,
    color: C.textSecondary,
    marginTop: 2,
  },
  divisor: {
    height: 1,
    backgroundColor: C.border,
  },
});
