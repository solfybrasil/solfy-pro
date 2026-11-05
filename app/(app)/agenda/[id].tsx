import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { SolfyLoader } from '../../../components/SolfyLoader';

export default function AgendaItemScreen() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(app)/agenda');
  }, [router]);

  return <SolfyLoader fullscreen size="md" />;
}
