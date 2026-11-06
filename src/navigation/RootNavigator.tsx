import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../hooks/useAuth';
import HomeScreen from '../screens/HomeScreen';
import PetsScreen from '../screens/PetsScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HouseholdsScreen from '../screens/HouseholdsScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Komponentti määrittää sovelluksen Native Stack -navigoinnin,
 * näkymien otsikot ja etusivun aloitusnäkymäksi.
 */
export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>
          Tarkistetaan kirjautumista…
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <Stack.Navigator>
      {user ? (
        <Stack.Group navigationKey={user.uid}>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'Feedlify' }}
          />

          <Stack.Screen
            name="Pets"
            component={PetsScreen}
            options={{ title: 'Your pets' }}
          />

          <Stack.Screen
            name="Households"
            component={HouseholdsScreen}
            options={{ title: 'Your Households' }}
           />
        </Stack.Group>
      ) : (
        <Stack.Group navigationKey="guest">
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'Sign In' }}
            />

          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ title: 'Create Account' }}
          />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F5',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#374151',
  },
});
