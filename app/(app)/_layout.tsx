import React from 'react';
import { View } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { LayoutDashboard, Layers, CalendarDays, MessageSquare, User } from 'lucide-react-native';
import AnimatedTabBar from '../../components/AnimatedTabBar';
import { useAuth } from '../../contexts/AuthContext';
import { SolfyLoader } from '../../components/SolfyLoader';

export default function AppTabsLayout() {
  const { session, isLoading, hasOnboarded, perfil, statusAprovacao, isContaBloqueadaSindico } = useAuth();

  // 1. Enquanto carrega a sessão ou o perfil, não monta a navegação de abas
  if (isLoading) {
    return <SolfyLoader fullscreen size="lg" />;
  }

  // 2. Se não houver sessão ativa, redireciona IMEDIATAMENTE
  if (!session) {
    return <Redirect href={hasOnboarded ? '/(auth)/login' : '/(auth)/welcome'} />;
  }

  // 3. Se for conta de síndico, redireciona para a tela de login com o aviso
  if (isContaBloqueadaSindico) {
    return <Redirect href="/(auth)/login" />;
  }

  // 4. Guarda Mandatória: Enquanto o cadastro não estiver 'aprovado' pelo servidor,
  // nenhuma rota do painel operacional pode ser acessada por link direto ou deep link.
  const status = statusAprovacao || perfil?.status_aprovacao;
  if (status === 'incompleto' || status === 'rascunho') {
    return <Redirect href="/(auth)/cadastro" />;
  }
  if (status !== 'aprovado') {
    return <Redirect href="/(auth)/status-analise" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName="index"
        tabBar={(props) => <AnimatedTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          animation: 'none',
          freezeOnBlur: true,
          lazy: true,
        }}
      >
        {/* 1. Gestão de Demandas / Solicitações */}
        <Tabs.Screen
          name="demandas/index"
          options={{
            title: 'Demandas',
            tabBarIcon: ({ color, size }) => (
              <Layers size={size || 20} color={color} strokeWidth={2} />
            ),
          }}
        />

        {/* 2. Agenda & Visitas Técnicas do Condomínio (substitui Mural) */}
        <Tabs.Screen
          name="agenda/index"
          options={{
            title: 'Agenda',
            tabBarIcon: ({ color, size }) => (
              <CalendarDays size={size || 20} color={color} strokeWidth={2} />
            ),
          }}
        />

        {/* 3. Início / Dashboard (CENTRO DO MENU) */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            tabBarIcon: ({ color, size }) => (
              <LayoutDashboard size={size || 20} color={color} strokeWidth={2} />
            ),
          }}
        />

        {/* 4. Chat do Condomínio */}
        <Tabs.Screen
          name="chat/index"
          options={{
            title: 'Chat',
            tabBarIcon: ({ color, size }) => (
              <MessageSquare size={size || 20} color={color} strokeWidth={2} />
            ),
          }}
        />

        {/* 5. Perfil & Configurações do Condomínio */}
        <Tabs.Screen
          name="perfil/index"
          options={{
            title: 'Config',
            tabBarIcon: ({ color, size }) => (
              <User size={size || 20} color={color} strokeWidth={2} />
            ),
          }}
        />

        {/* Rotas Auxiliares / Sub-rotas Hierárquicas Ocultas da barra de tabs */}
        <Tabs.Screen
          name="demandas/[id]"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="demandas/[id]/cotacao/[cotacaoId]"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="agenda/[id]"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="chat/[id]"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="demanda/[id]"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="cotacao/[id]"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="notificacoes/index"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="perfil/[secao]"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="financeiro/index"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="servicos"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="mapa"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
          }}
        />
      </Tabs>
    </View>
  );
}
