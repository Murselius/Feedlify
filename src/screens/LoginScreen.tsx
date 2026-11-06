import { useState } from "react";
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { FirebaseError } from 'firebase/app';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/auth";
import type { RootStackParamList } from "../navigation/types";
type Props = NativeStackScreenProps<RootStackParamList, "Login">;

//Sivu näyttää kirjautumislomakkeen jossa käyttäjä kirjautuu sisään firebase authenticationilla.
export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (isSubmitting) return; // Estetään useampi samanaikainen kirjautumisyritys

    setError("");

    if (!email.trim() || !password) {
        setError("Please enter both email and password.");
        return;
    }

    setIsSubmitting(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            setError('Sähköposti tai salasana on virheellinen.');
            break;
          case 'auth/invalid-email':
            setError('Tarkista sähköpostiosoitteen muoto.');
            break;
          case 'auth/network-request-failed':
            setError('Yhteys epäonnistui. Tarkista verkkoyhteys.');
            break;
          case 'auth/too-many-requests':
            setError('Liian monta yritystä. Yritä myöhemmin uudelleen.');
            break;
          default:
            setError(`Kirjautuminen epäonnistui (${error.code}).`);
        }
      } else {
        setError('Odottamaton virhe. Yritä uudelleen.');
      }
    } finally {
      setIsSubmitting(false);
    }};

      return (
    <SafeAreaView
      style={styles.container}
      edges={['bottom', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Kirjaudu Feedlifyyn</Text>

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
          autoComplete="current-password"
          editable={!isSubmitting}
        />

        {error !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}

        <View style={styles.buttons}>
          <Button
            title={isSubmitting ? 'Logging in…' : 'Login'}
            onPress={handleLogin}
            disabled={isSubmitting}
          />

          <Button
            title="Create New Account"
            onPress={() => navigation.navigate('Register')}
            disabled={isSubmitting}
          />
        </View>
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
  buttons: {
    gap: 12,
  },
});