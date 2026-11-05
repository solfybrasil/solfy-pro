import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BannerItem, buscarBannersAtivos, handleBannerPress, registrarEventoBanner } from '../lib/bannersApi';

interface Props {
  onRefreshTrigger?: number;
}

export const HomeBannersCarousel: React.FC<Props> = ({ onRefreshTrigger }) => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const [erroredImages, setErroredImages] = useState<Record<string, boolean>>({});

  const flatListRef = useRef<FlatList<BannerItem>>(null);
  const visualizadosRef = useRef<Set<string>>(new Set());

  // Proporção fixa 16:7
  // paddingHorizontal da tela é 20 de cada lado (total 40)
  const bannerWidth = Math.max(280, Math.min(width - 40, 520));
  const bannerHeight = Math.round(bannerWidth * (7 / 16));

  // Carrega banners ativos do banco
  const carregar = useCallback(async () => {
    try {
      const lista = await buscarBannersAtivos();
      setBanners(lista);
    } catch (err) {
      console.warn('[HomeBannersCarousel] Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar, onRefreshTrigger]);

  // Registra visualização para o primeiro banner ao carregar
  useEffect(() => {
    if (banners.length > 0 && banners[0]?.id && !visualizadosRef.current.has(banners[0].id)) {
      visualizadosRef.current.add(banners[0].id);
      registrarEventoBanner(banners[0].id, 'visualizacao');
    }
  }, [banners]);

  // Carrossel com troca automática a cada 6 segundos (pausa ao tocar/interagir)
  useEffect(() => {
    if (banners.length <= 1 || isInteracting) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % banners.length;
        try {
          flatListRef.current?.scrollToIndex({
            index: nextIndex,
            animated: true,
          });
        } catch {
          // Ignora se layout ainda não estiver pronto
        }
        // Registra telemetria de visualização para o próximo
        const nextBanner = banners[nextIndex];
        if (nextBanner && !visualizadosRef.current.has(nextBanner.id)) {
          visualizadosRef.current.add(nextBanner.id);
          registrarEventoBanner(nextBanner.id, 'visualizacao');
        }
        return nextIndex;
      });
    }, 6000);

    return () => clearInterval(interval);
  }, [banners, isInteracting]);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / bannerWidth);
      if (index >= 0 && index < banners.length && index !== currentIndex) {
        setCurrentIndex(index);
        const banner = banners[index];
        if (banner && !visualizadosRef.current.has(banner.id)) {
          visualizadosRef.current.add(banner.id);
          registrarEventoBanner(banner.id, 'visualizacao');
        }
      }
      setIsInteracting(false);
    },
    [bannerWidth, banners, currentIndex]
  );

  const handlePress = useCallback(
    (item: BannerItem) => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      handleBannerPress(item, (route) => {
        router.push(route as any);
      });
    },
    [router]
  );

  // Se não houver banners, a área não aparece
  if (!loading && banners.length === 0) {
    return null;
  }

  // 1 único banner: sem carrossel, sem indicador de bolinhas
  if (banners.length === 1) {
    const item = banners[0];
    const hasError = erroredImages[item.id];

    return (
      <View style={[styles.containerSingle, { width: bannerWidth, height: bannerHeight }]}>
        <TouchableOpacity
          activeOpacity={item.link_tipo === 'nenhum' ? 1 : 0.9}
          onPress={() => handlePress(item)}
          accessible={true}
          accessibilityLabel={item.texto_alternativo || item.titulo}
          accessibilityRole={item.link_tipo === 'nenhum' ? 'image' : 'button'}
          style={[styles.bannerCard, { width: bannerWidth, height: bannerHeight }]}
        >
          {hasError ? (
            <View style={[styles.fallbackContainer, { width: bannerWidth, height: bannerHeight }]}>
              <Text style={styles.fallbackTitle}>{item.titulo}</Text>
              <Text style={styles.fallbackSub}>{item.texto_alternativo}</Text>
            </View>
          ) : (
            <Image
              source={{ uri: item.imagem_url }}
              style={[styles.bannerImage, { width: bannerWidth, height: bannerHeight }]}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              onError={() => {
                setErroredImages((prev) => ({ ...prev, [item.id]: true }));
              }}
            />
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Múltiplos banners: Carrossel com deslize lateral e indicador
  return (
    <View
      style={[styles.containerMultiple, { width: bannerWidth }]}
      onTouchStart={() => setIsInteracting(true)}
      onTouchEnd={() => setIsInteracting(false)}
    >
      <FlatList
        ref={flatListRef}
        data={banners}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={bannerWidth}
        decelerationRate="fast"
        onScrollBeginDrag={() => setIsInteracting(true)}
        onMomentumScrollEnd={handleScrollEnd}
        getItemLayout={(_, index) => ({
          length: bannerWidth,
          offset: bannerWidth * index,
          index,
        })}
        renderItem={({ item }) => {
          const hasError = erroredImages[item.id];

          return (
            <TouchableOpacity
              activeOpacity={item.link_tipo === 'nenhum' ? 1 : 0.9}
              onPress={() => handlePress(item)}
              accessible={true}
              accessibilityLabel={item.texto_alternativo || item.titulo}
              accessibilityRole={item.link_tipo === 'nenhum' ? 'image' : 'button'}
              style={[styles.bannerCard, { width: bannerWidth, height: bannerHeight }]}
            >
              {hasError ? (
                <View style={[styles.fallbackContainer, { width: bannerWidth, height: bannerHeight }]}>
                  <Text style={styles.fallbackTitle}>{item.titulo}</Text>
                  <Text style={styles.fallbackSub}>{item.texto_alternativo}</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: item.imagem_url }}
                  style={[styles.bannerImage, { width: bannerWidth, height: bannerHeight }]}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                  onError={() => {
                    setErroredImages((prev) => ({ ...prev, [item.id]: true }));
                  }}
                />
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Indicador de Páginas (Bolinhas) */}
      <View style={styles.paginationRow}>
        {banners.map((_, i) => (
          <View
            key={`dot-${i}`}
            style={[
              styles.dot,
              currentIndex === i ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  containerSingle: {
    alignSelf: 'center',
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    ...Platform.select({
      ios: {
        shadowColor: '#0D1B12',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      web: {
        boxShadow: '0 4px 12px rgba(13, 27, 18, 0.08)',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  containerMultiple: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  bannerCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    ...Platform.select({
      ios: {
        shadowColor: '#0D1B12',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      web: {
        boxShadow: '0 4px 12px rgba(13, 27, 18, 0.08)',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  bannerImage: {
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  fallbackContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fallbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 4,
  },
  fallbackSub: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    transitionDuration: '200ms',
  } as any,
  dotActive: {
    width: 18,
    backgroundColor: '#2E5A36',
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(46, 90, 54, 0.25)',
  },
});
