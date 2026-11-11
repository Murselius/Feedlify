import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { updateProfile, type User } from 'firebase/auth';

type Props = {
  user: User;
};

// Näyttää käyttäjän näyttönimen tai pyytää sitä, jos profiilista puuttuu nimi.
export default function DisplayNameField({ user }: Props) {
  const [savedName, setSavedName] = useState(user.displayName?.trim() ?? '');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const name = draft.trim();
    if (saving || !name) return;

    setSaving(true);
    setError('');

    try {
      await updateProfile(user, { displayName: name });
      setSavedName(name);
    } catch {
      setError('Could not save your display name. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (savedName) {
    return <Text style={styles.text}>Signed in as: {savedName}</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Choose your display name</Text>

      <TextInput
        style={styles.input}
        accessibilityLabel="Display name"
        placeholder="Display name"
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="words"
        maxLength={80}
        editable={!saving}
        returnKeyType="done"
        onSubmitEditing={handleSave}
      />

      {error !== '' && (
        <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
      )}

      <Button
        title={saving ? 'Saving…' : 'Save display name'}
        onPress={handleSave}
        disabled={saving || !draft.trim()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  text: {
    fontSize: 16,
    color: '#374151',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#9CA3AF',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    color: '#111827',
  },
  error: {
    color: '#B91C1C',
  },
});