/** Define os fluxos de acesso e as telas autenticadas, com abas principais e rotas de detalhe. */
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator, type BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ParamListBase } from '@react-navigation/native';
import {
  ChartNoAxesCombined,
  ClipboardList,
  House,
  Target,
  UserRound,
} from 'lucide-react-native';
import type { InvoiceTransaction } from './services/statements';
import { LoginScreen, ResetPasswordScreen, ResetSentScreen, SignUpScreen } from './screens/AuthScreens';
import {
  BudgetScreen,
  CategoriesScreen,
  ExpenseFormScreen,
  FixedExpensesScreen,
  ImportReviewScreen,
  ImportStatementScreen,
  IncomeScreen,
  NotificationsScreen,
  ProfileEditScreen,
} from './screens/DetailScreens';
import {
  AddCardScreen,
  CardsScreen,
  GoalDetailScreen,
  GoalFormScreen,
  SettingsScreen,
} from './screens/ManagementScreens';
import { ExpenseListScreen, GoalsScreen, HomeScreen, ProfileScreen, ReportsScreen } from './screens/MainScreens';
import { colors } from './theme';

export interface RootStackParamList extends ParamListBase {
  Login: undefined;
  SignUp: undefined;
  ResetPassword: undefined;
  ResetSent: { email: string };
  Main: undefined;
  Budget: undefined;
  Notifications: undefined;
  ExpenseForm: { id?: string } | undefined;
  FixedExpenses: undefined;
  Categories: undefined;
  Cards: undefined;
  ImportStatement: undefined;
  ImportReview: { transactions: InvoiceTransaction[]; fileName: string; cardId: string; period: string };
  AddCard: { id?: string } | undefined;
  GoalDetail: { id: string };
  GoalForm: { id?: string } | undefined;
  Income: undefined;
  ProfileEdit: undefined;
  Settings: undefined;
}

export type TabParamList = {
  Início: undefined;
  Despesas: undefined;
  Metas: undefined;
  Relatórios: undefined;
  Perfil: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

// Botão de aba com o destaque arredondado da aba ativa (o fundo nativo do React Navigation fica retangular).
function PillTabButton({ children, onPress, onLongPress, accessibilityState, accessibilityLabel, testID }: BottomTabBarButtonProps) {
  const selected = Boolean(accessibilityState?.selected);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 7,
        marginHorizontal: 2,
        borderRadius: 27,
        backgroundColor: selected ? colors.rose : 'transparent',
      }}
    >
      {children}
    </Pressable>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    // O fundo evita uma faixa de outra cor ao redor da barra flutuante.
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarButton: (props) => <PillTabButton {...props} />,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        // Barra flutuante em pílula: afastada das bordas e acima do indicador de início do aparelho.
        tabBarStyle: {
          height: 68,
          marginHorizontal: 14,
          marginBottom: Math.max(insets.bottom - 6, 12),
          paddingTop: 0,
          paddingBottom: 0,
          paddingHorizontal: 6,
          borderRadius: 34,
          borderTopWidth: 0,
          backgroundColor: colors.surface,
          shadowColor: colors.ink,
          shadowOpacity: 0.12,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        },
      }}
    >
      <Tabs.Screen name="Início" component={HomeScreen} options={{ tabBarIcon: ({ color }) => <House color={color} size={21} /> }} />
      <Tabs.Screen name="Despesas" component={ExpenseListScreen} options={{ tabBarIcon: ({ color }) => <ClipboardList color={color} size={21} /> }} />
      <Tabs.Screen name="Metas" component={GoalsScreen} options={{ tabBarIcon: ({ color }) => <Target color={color} size={21} /> }} />
      <Tabs.Screen name="Relatórios" component={ReportsScreen} options={{ tabBarIcon: ({ color }) => <ChartNoAxesCombined color={color} size={21} /> }} />
      <Tabs.Screen name="Perfil" component={ProfileScreen} options={{ tabBarIcon: ({ color }) => <UserRound color={color} size={21} /> }} />
    </Tabs.Navigator>
    </View>
  );
}

export function RootNavigator({
  signedIn,
  localMode,
  enterLocalMode,
  leaveLocalMode,
}: {
  signedIn: boolean;
  localMode: boolean;
  enterLocalMode: () => void;
  leaveLocalMode: () => void;
}) {
  const authenticated = signedIn || localMode;
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background } }}>
      {authenticated ? (
        <>
          <RootStack.Screen name="Main">
            {() => <MainTabs />}
          </RootStack.Screen>
          <RootStack.Screen name="Budget" component={BudgetScreen} />
          <RootStack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
          <RootStack.Screen name="ExpenseForm" component={ExpenseFormScreen} />
          <RootStack.Screen name="FixedExpenses" component={FixedExpensesScreen} />
          <RootStack.Screen name="Categories" component={CategoriesScreen} />
          <RootStack.Screen name="Cards" component={CardsScreen} />
          <RootStack.Screen name="ImportStatement" component={ImportStatementScreen} />
          <RootStack.Screen name="ImportReview" component={ImportReviewScreen} />
          <RootStack.Screen name="AddCard" component={AddCardScreen} />
          <RootStack.Screen name="GoalDetail" component={GoalDetailScreen} />
          <RootStack.Screen name="GoalForm" component={GoalFormScreen} />
          <RootStack.Screen name="Income" component={IncomeScreen} />
          <RootStack.Screen name="ProfileEdit" component={ProfileEditScreen} />
          <RootStack.Screen name="Settings">
            {() => <SettingsScreen leaveLocalMode={leaveLocalMode} />}
          </RootStack.Screen>
        </>
      ) : (
        <>
          <RootStack.Screen name="Login">
            {(props) => <LoginScreen {...props} enterLocalMode={enterLocalMode} />}
          </RootStack.Screen>
          <RootStack.Screen name="SignUp" component={SignUpScreen} />
          <RootStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          <RootStack.Screen name="ResetSent" component={ResetSentScreen} />
        </>
      )}
    </RootStack.Navigator>
  );
}
