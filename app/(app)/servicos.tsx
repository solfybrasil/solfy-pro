import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Rota migrada/descontinuada: o condomínio utiliza 'demandas' e 'agenda'.
 * Redireciona com segurança para a tela inicial do condomínio.
 */
export default function DeprecatedServicosScreen() {
  return <Redirect href="/(app)" />;
}
