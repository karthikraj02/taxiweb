import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import type { RootStackParamList, TabParamList } from './types';

import HomeScreen from '../screens/HomeScreen';
import BookScreen from '../screens/BookScreen';
import TripsScreen from '../screens/TripsScreen';
import AccountScreen from '../screens/AccountScreen';
import AuthScreen from '../screens/AuthScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import PaymentScreen from '../screens/PaymentScreen';
import TripDetailScreen from '../screens/TripDetailScreen';
import ToursScreen from '../screens/ToursScreen';
import ContactScreen from '../screens/ContactScreen';
import DriverAuthScreen from '../screens/DriverAuthScreen';
import DriverDashboardScreen from '../screens/DriverDashboardScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.ink, card: colors.white, text: colors.ink, border: colors.line },
};

const icons: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Book: 'add-circle-outline',
  Trips: 'receipt-outline',
  Account: 'person-outline',
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleStyle: { fontWeight: '800', color: colors.ink },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { borderTopColor: colors.line },
        tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name]} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Book" component={BookScreen} options={{ title: 'Book a ride', tabBarLabel: 'Book' }} />
      <Tab.Screen name="Trips" component={TripsScreen} options={{ title: 'My trips' }} />
      <Tab.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerTitleStyle: { fontWeight: '800', color: colors.ink },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ title: 'Log in', presentation: 'modal' }} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Confirm booking' }} />
        <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Payment', headerBackVisible: false }} />
        <Stack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: 'Trip' }} />
        <Stack.Screen name="Tours" component={ToursScreen} options={{ title: 'Tour packages' }} />
        <Stack.Screen name="Contact" component={ContactScreen} options={{ title: 'Contact us' }} />
        <Stack.Screen name="DriverAuth" component={DriverAuthScreen} options={{ title: 'Driver portal' }} />
        <Stack.Screen name="DriverDashboard" component={DriverDashboardScreen} options={{ title: 'Driver dashboard', headerBackVisible: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
