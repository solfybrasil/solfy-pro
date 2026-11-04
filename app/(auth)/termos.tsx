import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ShieldCheck, FileText } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { C } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

export default function TermsScreen() {
  const router = useRouter();

  const Section = ({ title, content }: { title: string, content: string }) => (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.sectionContent}>{content}</Text>
    </View>
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAF8" />

      {/* ── BACKGROUND CLARO ── */}
      <View style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, backgroundColor: '#FAFAF8' }} />
        <LinearGradient
          colors={['rgba(245, 158, 11, 0.08)', 'transparent']}
          style={s.glow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.5 }}
        />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={s.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeft size={20} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Jurídico Solfy</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(600)}>
            <View style={s.hero}>
              <View style={s.iconBadge}>
                <ShieldCheck size={36} color="#F59E0B" />
              </View>
              <Text style={s.mainTitle}>Termos de Uso e {'\n'}Privacidade Solfy Pro</Text>
              <Text style={s.lastUpdate}>Última atualização: Maio de 2024</Text>
            </View>

            <View style={s.introBox}>
              <Text style={s.introText}>
                Ao acessar ou utilizar a plataforma Solfy Pro, você concorda integralmente com os termos aqui estabelecidos. 
                Estes termos regem a relação entre a Solfy Technology e os Prestadores de Serviço Parceiros.
              </Text>
            </View>

            <Section 
              title="1. Natureza da Plataforma"
              content="A Solfy atua exclusivamente como uma plataforma de tecnologia que facilita o encontro entre clientes finais e prestadores de serviço independentes. A Solfy NÃO possui qualquer vínculo empregatício com o prestador, não estabelece subordinação, controle de jornada ou exclusividade."
            />

            <Section 
              title="2. Responsabilidades do Prestador"
              content="O Prestador declara ser plenamente capaz e possuir as habilidades técnicas necessárias para os serviços que se dispõe a realizar. É de total responsabilidade do prestador a qualidade do serviço, a segurança na execução e o cumprimento de qualquer norma legal ou tributária decorrente de sua atividade profissional independente."
            />

            <Section 
              title="3. Limitação de Responsabilidade"
              content="A Solfy não se responsabiliza por quaisquer danos diretos, indiretos, incidentais ou consequentes resultantes da interação entre prestadores e clientes. A plataforma não garante faturamento mínimo ou frequência de pedidos, atuando apenas como ferramenta de despacho de demandas."
            />

            <Section 
              title="4. Privacidade, Permissões e LGPD"
              content="Seus dados são coletados exclusivamente para a operação da plataforma e despacho de pedidos. Em conformidade com a LGPD, garantimos seu direito à exclusão definitiva dos dados (via menu Perfil ou site). O Solfy PRO solicita acesso à sua Localização (apenas em primeiro plano) para calcular a distância de serviços, e à sua Câmera/Galeria exclusivamente para atualização de avatar e comprovação de serviços realizados."
            />

            <Section 
              title="5. Propriedade Intelectual"
              content="Toda a tecnologia, marcas, logos e interfaces do aplicativo são propriedade exclusiva da Solfy Technology. O uso do aplicativo não concede qualquer direito de cópia, engenharia reversa ou exploração da marca Solfy fora do escopo desta parceria."
            />

            <Section 
              title="6. Cancelamento e Suspensão"
              content="A Solfy reserva-se o direito de suspender ou banir contas que apresentem baixo índice de avaliação, comportamentos inadequados, fraudes no sistema ou violação de qualquer item deste termo, sem necessidade de aviso prévio em casos graves."
            />

            <Section 
              title="7. Modificações"
              content="Estes termos podem ser atualizados periodicamente. O uso continuado da plataforma após alterações constitui aceitação tácita das novas condições estabelecidas."
            />

            <Section 
              title="8. Foro"
              content="Para dirimir quaisquer questões decorrentes deste termo, as partes elegem o foro da Comarca de São Paulo/SP, com renúncia expressa a qualquer outro por mais privilegiado que seja."
            />

            <View style={s.footer}>
              <FileText size={18} color="#9CA3AF" />
              <Text style={s.footerText}>Documento oficial registrado eletronicamente para Solfy Pro.</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FAFAF8' 
  },
  glow: { 
    position: 'absolute', 
    top: 0, 
    left: 0,
    right: 0,
    height: 320,
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingTop: 10, 
    paddingBottom: 16 
  },
  backBtn: { 
    width: 40, 
    height: 40, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: { 
    color: '#1A1A1A', 
    fontSize: 16, 
    fontWeight: '800' 
  },
  scroll: { 
    paddingHorizontal: 20, 
    paddingBottom: 60 
  },
  hero: { 
    alignItems: 'center', 
    marginVertical: 24 
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  mainTitle: { 
    fontSize: 26, 
    fontWeight: '900', 
    color: '#1A1A1A', 
    textAlign: 'center', 
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  lastUpdate: { 
    fontSize: 12.5, 
    color: '#F59E0B', 
    marginTop: 8, 
    fontWeight: '700' 
  },
  introBox: { 
    backgroundColor: '#FFFFFF', 
    padding: 18, 
    borderRadius: 18, 
    marginBottom: 28, 
    borderWidth: 1, 
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  introText: { 
    color: '#6B6B6B', 
    fontSize: 14, 
    lineHeight: 22, 
    textAlign: 'center', 
    fontWeight: '500' 
  },
  section: { 
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '900', 
    color: '#1A1A1A', 
    marginBottom: 8, 
    letterSpacing: -0.2,
  },
  sectionContent: { 
    fontSize: 14, 
    color: '#6B6B6B', 
    lineHeight: 21, 
    fontWeight: '400' 
  },
  footer: { 
    marginTop: 24, 
    alignItems: 'center', 
    gap: 8, 
    paddingBottom: 20 
  },
  footerText: { 
    color: '#9CA3AF', 
    fontSize: 12, 
    fontWeight: '600', 
    textAlign: 'center' 
  }
});
