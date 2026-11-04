import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C } from '../../../constants/theme';

/**
 * Rota dinâmica /perfil/[secao] para deep links diretos (ex.: /perfil/meu_perfil, /perfil/seguranca_senha)
 * Encaminha de forma consistente para a tela principal /perfil com o parâmetro secao ativo
 * e botão voltar funcionando em Web, iOS e Android.
 */
export default function PerfilSecaoDeepLinkScreen() {
  const { secao } = useLocalSearchParams<{ secao?: string }>();
  const router = useRouter();

  useEffect(() => {
    const secaoLimpa = typeof secao === 'string' ? secao.trim() : '';
    if (secaoLimpa) {
      router.replace({
        pathname: '/(app)/perfil',
        params: { secao: secaoLimpa },
      });
    } else {
      router.replace('/(app)/perfil');
    }
  }, [secao, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={C.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
