import { useState } from 'react';
import {
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FirebaseError } from 'firebase/app';
import { createUserWithEmailAndPassword } from 'firebase/auth';

import { auth } from '../services/auth';

/**
 * Näyttää rekisteröitymislomakkeen, tarkistaa syötteet
 * ja luo käyttäjätilin Firebase Authenticationiin.
 */
export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    if (isSubmitting) return;

    setError('');

    if (!email.trim() || !password || !confirmPassword) {
      setError('Täytä kaikki kentät.');
      return;
    }

    if (password.length < 6) {
      setError('Salasanassa pitää olla vähintään 6 merkkiä.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Salasanat eivät täsmää.');
      return;
    }

    setIsSubmitting(true);

    try {
      await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      setPassword('');
      setConfirmPassword('');

      Alert.alert(
        'Tili luotu',
        'Rekisteröityminen onnistui. Olet nyt kirjautunut sisään.',
      );
    } catch (error) { //Virhemääritykset
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            setError('Sähköpostiosoitteella on jo käyttäjätili.');
            break;
          case 'auth/invalid-email':
            setError('Tarkista sähköpostiosoitteen muoto.');
            break;
          case 'auth/weak-password':
          case 'auth/password-does-not-meet-requirements':
            setError('Salasana ei täytä palvelun vaatimuksia.');
            break;
          case 'auth/network-request-failed':
            setError('Yhteys epäonnistui. Tarkista verkkoyhteys.');
            break;
          case 'auth/too-many-requests':
            setError('Liian monta yritystä. Yritä myöhemmin uudelleen.');
            break;
          default:
            setError(`Rekisteröityminen epäonnistui (${error.code}).`);
        }
      } else {
        setError('Odottamaton virhe. Yritä uudelleen.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={['bottom', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Luo käyttäjätili</Text>

        <Text style={styles.label}>Sähköposti</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel="Sähköposti"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          editable={!isSubmitting}
        />

        <Text style={styles.label}>Salasana</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel="Salasana"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          editable={!isSubmitting}
        />

        <Text style={styles.label}>Salasana uudelleen</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel="Salasana uudelleen"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isSubmitting}
        />

        {error !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}

        <Button
          title={isSubmitting ? 'Luodaan tiliä…' : 'Luo tili'}
          onPress={handleRegister}
          disabled={isSubmitting}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  error: {
    color: '#B91C1C',
    marginBottom: 16,
  },
});