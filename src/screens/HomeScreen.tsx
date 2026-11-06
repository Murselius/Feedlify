import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signOut } from 'firebase/auth';

import { auth } from '../services/auth';
import { useAuth } from '../hooks/useAuth';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/**
 * Näyttää kirjautuneen käyttäjän etusivun, pääsyn lemmikkinäkymään
 * ja mahdollisuuden kirjautua ulos.
 */
export default function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = async () => {
    if (isSigningOut) return;

    setError('');
    setIsSigningOut(true);

    try {
      await signOut(auth);
    } catch {
      setError('Sign out failed.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={['bottom', 'left', 'right']}
    >
      <Text style={styles.title}>Feedlify</Text>

      <Text style={styles.description}>
        Keep your pets fed.
      </Text>

      {user && (
        <Text style={styles.description}>
          Signed in as: {user.email}
        </Text>
      )}

      {error !== '' && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}

      <View style={styles.buttons}>
        <Button
          title="Show Pets"
          onPress={() => navigation.navigate('Pets')}
          disabled={isSigningOut}
        />

        <Button
          title="Households"
          onPress={() => navigation.navigate('Households')}
          disabled={isSigningOut}
        />

        <Button
          title={isSigningOut ? 'Signing out…' : 'Sign Out'}
          onPress={handleLogout}
          disabled={isSigningOut}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 12,
  },
  description: {
    fontSize: 18,
    lineHeight: 26,
    color: '#374151',
    marginBottom: 24,
  },
  buttons: {
    gap: 12,
  },
  error: {
    color: '#B91C1C',
    marginBottom: 16,
  },
});