import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Eye, EyeOff, Globe, Mail, Wallet } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, CardBox, Field, Header, Notice, PageTitle, Screen, styles } from '../components/ui';
import { firebaseReady, register, requestPasswordReset, signIn, signInWithGoogleIdToken } from '../services/firebase';
import type { RootStackParamList } from '../navigation';
import { colors } from '../theme';

WebBrowser.maybeCompleteAuthSession();
type AuthNavigation = NativeStackNavigationProp<RootStackParamList>;
const googleClientIds = {
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
};
const googleAvailable = Platform.OS === 'ios'
  ? Boolean(googleClientIds.ios)
  : Platform.OS === 'android'
    ? Boolean(googleClientIds.android)
    : Platform.OS === 'web'
      ? Boolean(googleClientIds.web)
      : false;

function AuthBrand() {
  return <View style={{ alignItems: 'flex-end', marginTop: 14 }}><View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Wallet size={20} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 19, fontWeight: '700' }}>Girls Wallet</Text></View></View>;
}

function PasswordField({ label, value, onChangeText, placeholder = 'Sua senha' }: { label: string; value: string; onChangeText: (text: string) => void; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <Field label={label} value={value} onChangeText={onChangeText} placeholder={placeholder} secureTextEntry={!visible} autoCapitalize="none" />
      <Pressable onPress={() => setVisible((current) => !current)} style={{ alignSelf: 'flex-end', marginTop: 7 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{visible ? 'Ocultar senha' : 'Mostrar senha'}</Text>
      </Pressable>
    </View>
  );
}

export function LoginScreen({
  enterLocalMode,
}: NativeStackScreenProps<RootStackParamList, 'Login'> & { enterLocalMode: () => void }) {
  const navigation = useNavigation<AuthNavigation>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Informe seu e-mail e sua senha.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha na autenticação. Confira seus dados e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AuthBrand />
      <PageTitle title="Seu dinheiro, com calma." subtitle="Entre para cuidar dos seus planos." />
      {!firebaseReady ? <Notice tone="amber">Modo local disponível. Configure o Firebase para ativar login seguro e sincronização.</Notice> : null}
      <Field label="E-mail" value={email} onChangeText={setEmail} placeholder="voce@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <PasswordField label="Senha" value={password} onChangeText={setPassword} />
      {error ? <Notice tone="amber">{error}</Notice> : null}
      <Button title="Entrar" onPress={() => void submit()} loading={busy} />
      <Button title="Esqueci minha senha" variant="text" onPress={() => navigation.navigate('ResetPassword')} />
      <View style={{ gap: 12, alignItems: 'center' }}>
        {googleAvailable ? (
          <>
            <Text style={{ color: colors.muted, fontSize: 12 }}>ou acesse com sua conta</Text>
            <GoogleSignInButton onError={setError} />
          </>
        ) : (
          <Notice tone="amber">Login Google não configurado neste dispositivo. Você pode testar o app com os dados de demonstração.</Notice>
        )}
        <Button title="Explorar com dados de demonstração" variant="text" onPress={enterLocalMode} />
      </View>
      <Pressable onPress={() => navigation.navigate('SignUp')} style={{ alignItems: 'center', paddingVertical: 5 }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Ainda não tem conta? <Text style={{ color: colors.primary, fontWeight: '700' }}>Criar conta</Text></Text>
      </Pressable>
      <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}>Seus dados protegidos. Seus planos em primeiro lugar.</Text>
    </Screen>
  );
}

function GoogleSignInButton({ onError }: { onError: (message: string) => void }) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: googleClientIds.web,
    iosClientId: googleClientIds.ios,
    androidClientId: googleClientIds.android,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.authentication?.idToken ?? response.params?.id_token;
    if (!idToken) {
      onError('O Google não retornou um token de acesso válido. Confira a configuração OAuth.');
      return;
    }
    setBusy(true);
    void signInWithGoogleIdToken(idToken)
      .then(() => onError(''))
      .catch((reason: unknown) => onError(reason instanceof Error ? reason.message : 'Falha na autenticação Google.'))
      .finally(() => setBusy(false));
  }, [onError, response]);

  return (
    <Button
      title="Continuar com Google"
      variant="secondary"
      icon={<Globe color={colors.primary} size={19} />}
      loading={busy}
      disabled={!request}
      onPress={() => {
        if (!firebaseReady) onError('Configure o Firebase antes de conectar uma conta Google.');
        else if (!request) onError('A autenticação Google ainda está sendo preparada.');
        else void promptAsync();
      }}
    />
  );
}

export function SignUpScreen() {
  const navigation = useNavigation<AuthNavigation>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || !email.includes('@') || password.length < 8 || password !== confirmation) {
      setError('Confira seus dados. A senha precisa ter ao menos 8 caracteres e as duas senhas devem ser iguais.');
      return;
    }
    if (!firebaseReady) {
      setError('Configure o Firebase antes de criar uma conta.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await register(name, email, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar sua conta.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header back />
      <AuthBrand />
      <PageTitle title="Vamos começar?" subtitle="Um espaço para você e seus próximos planos." />
      <Field label="Nome completo" value={name} onChangeText={setName} placeholder="Seu nome" autoComplete="name" />
      <Field label="E-mail" value={email} onChangeText={setEmail} placeholder="voce@email.com" keyboardType="email-address" autoCapitalize="none" />
      <PasswordField label="Senha" value={password} onChangeText={setPassword} placeholder="Pelo menos 8 caracteres" />
      <PasswordField label="Confirmar senha" value={confirmation} onChangeText={setConfirmation} />
      <Text style={{ color: colors.muted, fontSize: 12 }}>Ao continuar, você aceita os Termos de uso e a Política de privacidade.</Text>
      {error ? <Notice tone="amber">{error}</Notice> : null}
      <Button title="Criar minha conta" onPress={() => void submit()} loading={busy} />
      <Button title="Já tenho conta · Entrar" variant="text" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

export function ResetPasswordScreen() {
  const navigation = useNavigation<AuthNavigation>();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.includes('@')) {
      setError('Informe um e-mail válido.');
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(email);
      navigation.navigate('ResetSent', { email });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível enviar as instruções.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header back />
      <AuthBrand />
      <PageTitle title="Esqueceu a senha?" subtitle="Tudo bem. Vamos ajudar você a voltar." />
      <CardBox style={{ minHeight: 135, backgroundColor: colors.roseLight, alignItems: 'center', justifyContent: 'center' }}>
        <Mail size={42} color={colors.primary} />
      </CardBox>
      <Text style={{ color: colors.muted, lineHeight: 21 }}>Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha com segurança.</Text>
      <Field label="E-mail cadastrado" value={email} onChangeText={setEmail} placeholder="voce@email.com" keyboardType="email-address" autoCapitalize="none" />
      {error ? <Notice tone="amber">{error}</Notice> : null}
      <Button title="Enviar instruções" onPress={() => void submit()} loading={busy} />
      <Button title="Voltar ao login" variant="secondary" onPress={() => navigation.goBack()} />
      {!firebaseReady ? <Notice tone="amber">A recuperação de senha fica disponível quando o Firebase estiver configurado.</Notice> : null}
    </Screen>
  );
}

export function ResetSentScreen({ route }: NativeStackScreenProps<RootStackParamList, 'ResetSent'>) {
  const navigation = useNavigation<AuthNavigation>();
  return (
    <Screen>
      <Header back />
      <AuthBrand />
      <PageTitle title="Confira seu e-mail" subtitle="Seu próximo passo já está na caixa de entrada." />
      <CardBox style={{ minHeight: 145, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
        <Mail size={42} color={colors.greenInk} />
      </CardBox>
      <CardBox>
        <Text style={{ color: colors.ink, fontWeight: '700' }}>Instruções enviadas para</Text>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>{route.params.email}</Text>
        <Text style={{ color: colors.muted }}>Abra o link recebido para definir uma nova senha.</Text>
      </CardBox>
      <Button title="Voltar ao login" variant="secondary" onPress={() => navigation.popToTop()} />
      <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 12 }}>Não encontrou? Confira também as pastas de spam e promoções.</Text>
    </Screen>
  );
}
