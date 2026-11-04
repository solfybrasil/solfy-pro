import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import {
  MapPin,
  Lock,
  Unlock,
  Navigation,
  Building2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react-native';
import { LocalizacaoPrivacidade } from '../../lib/prestadorPedidosApi';

interface LocalizacaoCardProps {
  local?: LocalizacaoPrivacidade;
}

export const LocalizacaoCard: React.FC<LocalizacaoCardProps> = ({ local }) => {
  const isAceito = !!local?.aceito;
  const bairro = local?.bairro || 'Bairro sob consulta';
  const cidade = local?.cidade || 'São Paulo';
  const estado = local?.estado || 'SP';
  const distancia = local?.distancia_km != null ? `${local.distancia_km} km de você` : null;

  const handleAbrirNavegacao = (app: 'google' | 'waze') => {
    if (!isAceito) {
      Alert.alert(
        'Endereço Protegido',
        'Aceite o convite do chamado para liberar o endereço completo e a rota de navegação.',
        [{ text: 'Entendi' }]
      );
      return;
    }

    const lat = local?.latitude;
    const lon = local?.longitude;
    const endereco = local?.endereco_completo || `${local?.logradouro}, ${local?.numero} - ${bairro}, ${cidade}`;

    if (app === 'google') {
      const url = lat && lon
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Erro', 'Não foi possível abrir o Google Maps.');
      });
    } else {
      const url = lat && lon
        ? `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`
        : `https://waze.com/ul?q=${encodeURIComponent(endereco)}&navigate=yes`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Erro', 'Não foi possível abrir o Waze.');
      });
    }
  };

  const handleModalRotas = () => {
    Alert.alert(
      'Como Chegar ao Condomínio',
      'Escolha seu aplicativo de navegação favorito:',
      [
        { text: 'Google Maps', onPress: () => handleAbrirNavegacao('google') },
        { text: 'Waze', onPress: () => handleAbrirNavegacao('waze') },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Building2 size={18} color="#0D1B12" />
          <Text style={styles.cardTitle}>Local do Atendimento</Text>
        </View>

        {isAceito ? (
          <View style={[styles.badgePrivacy, styles.badgePrivacyLiberado]}>
            <Unlock size={12} color="#047857" />
            <Text style={[styles.badgePrivacyText, { color: '#047857' }]}>
              Endereço Liberado
            </Text>
          </View>
        ) : (
          <View style={[styles.badgePrivacy, styles.badgePrivacyBloqueado]}>
            <Lock size={12} color="#B45309" />
            <Text style={[styles.badgePrivacyText, { color: '#B45309' }]}>
              Portaria Protegida
            </Text>
          </View>
        )}
      </View>

      {/* Dados do Endereço */}
      {isAceito ? (
        <View style={styles.contentAceito}>
          <Text style={styles.condoNome}>
            {local?.condominio_nome || 'Condomínio Residencial'}
          </Text>

          <View style={styles.linhaInfo}>
            <MapPin size={15} color="#059669" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.enderecoTexto}>
                {local?.logradouro ? `${local.logradouro}, ${local.numero || 's/n'}` : 'Endereço liberado'}
                {local?.complemento ? ` (${local.complemento})` : ''}
              </Text>
              <Text style={styles.enderecoSub}>
                {bairro} • {cidade} - {estado} {local?.cep ? `• CEP: ${local.cep}` : ''}
              </Text>
              {distancia && (
                <Text style={styles.distanciaTexto}>📍 Aproximadamente {distancia}</Text>
              )}
            </View>
          </View>

          {/* Botão Como Chegar */}
          <TouchableOpacity
            style={styles.btnComoChegar}
            onPress={handleModalRotas}
            activeOpacity={0.8}
          >
            <Navigation size={16} color="#FFFFFF" />
            <Text style={styles.btnComoChegarText}>Como Chegar (Maps / Waze)</Text>
            <ExternalLink size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.contentBloqueado}>
          <View style={styles.linhaInfo}>
            <MapPin size={16} color="#6B7280" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.regiaoAproximada}>
                Região: {bairro}, {cidade} - {estado}
              </Text>
              {distancia && (
                <Text style={styles.distanciaAprox}>📍 {distancia}</Text>
              )}
            </View>
          </View>

          {/* Banner de Aviso de Privacidade */}
          <View style={styles.avisoPrivacidadeBox}>
            <ShieldCheck size={16} color="#B45309" style={{ marginTop: 1 }} />
            <Text style={styles.avisoPrivacidadeText}>
              <Text style={{ fontWeight: '700' }}>Privacidade da Portaria:</Text> O nome do condomínio, endereço exato e rotas de navegação serão liberados assim que você aceitar o convite.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0D1B12',
    letterSpacing: -0.2,
  },
  badgePrivacy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgePrivacyBloqueado: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  badgePrivacyLiberado: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  badgePrivacyText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  contentAceito: {
    gap: 10,
  },
  condoNome: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0D1B12',
  },
  linhaInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  enderecoTexto: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1F2937',
  },
  enderecoSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  distanciaTexto: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#059669',
    marginTop: 3,
  },
  btnComoChegar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#092215',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 4,
  },
  btnComoChegarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contentBloqueado: {
    gap: 10,
  },
  regiaoAproximada: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#374151',
  },
  distanciaAprox: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  avisoPrivacidadeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 10,
  },
  avisoPrivacidadeText: {
    fontSize: 11.5,
    color: '#92400E',
    lineHeight: 16,
    flex: 1,
  },
});
