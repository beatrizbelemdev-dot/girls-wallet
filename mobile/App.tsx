/** Inicializa autenticação, notificações e o contexto de dados adequado à conta ativa. */
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged, type User } from 'firebase/auth';
import * as Notifications from 'expo-notifications';
import { WalletProvider, useWallet } from './src/contexts/WalletContext';
import { RootNavigator } from './src/navigation';
import { auth } from './src/services/firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [localMode, setLocalMode] = useState(false);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLocalMode(false);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <WalletProvider key={user?.uid ?? 'demo'} scope={user?.uid ?? 'demo'}>
        <AppContent
          user={user}
          localMode={localMode}
          enterLocalMode={() => setLocalMode(true)}
          leaveLocalMode={() => setLocalMode(false)}
        />
      </WalletProvider>
    </SafeAreaProvider>
  );
}

function AppContent({
  user,
  localMode,
  enterLocalMode,
  leaveLocalMode,
}: {
  user: User | null;
  localMode: boolean;
  enterLocalMode: () => void;
  leaveLocalMode: () => void;
}) {
  const { setSyncIdentity } = useWallet();

  useEffect(() => {
    setSyncIdentity(user?.uid);
  }, [setSyncIdentity, user]);

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <RootNavigator
        signedIn={Boolean(user)}
        localMode={localMode}
        enterLocalMode={enterLocalMode}
        leaveLocalMode={leaveLocalMode}
      />
    </NavigationContainer>
  );
}
