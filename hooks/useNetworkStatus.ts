import { useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export type NetworkStatus = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
  isLoading: boolean;
};

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
    isLoading: true,
  });

  const updateStatus = useCallback((state: NetInfoState) => {
    setStatus({
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      isLoading: false,
    });
  }, []);

  useEffect(() => {
    // Fetch initial state
    NetInfo.fetch().then(updateStatus);

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener(updateStatus);

    return () => unsubscribe();
  }, [updateStatus]);

  const isOffline =
    !status.isLoading &&
    (status.isConnected === false || status.isInternetReachable === false);

  return { ...status, isOffline };
}
