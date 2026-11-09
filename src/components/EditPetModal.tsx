import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FirebaseError } from 'firebase/app';
import { updatePet } from '../services/pets';
import type { Pet } from '../types/pet';

type Props = {
  pet: Pet;
  onClose: () => void;
};

// Avaa lemmikin nykyiset tiedot muokattaviksi ja tallentaa muutokset.
export default function EditPetModal({ pet, onClose }: Props) {
  const [name, setName] = useState(pet.name);
  const [species, setSpecies] = useState(pet.species);
  const [feedingsPerDay, setFeedingsPerDay] = useState(
    String(pet.feedingsPerDay),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const savingInProgress = useRef(false);

  const target = Number(feedingsPerDay);
  const isTargetValid =
    /^\d{1,2}$/.test(feedingsPerDay) && target >= 1 && target <= 24;

  const isSaveDisabled =
    isSaving || !name.trim() || !species.trim() || !isTargetValid;

  const handleClose = () => {
    if (!savingInProgress.current) onClose();
  };

  const handleSave = async () => {
    if (savingInProgress.current || isSaveDisabled) return;

    savingInProgress.current = true;
    setIsSaving(true);
    setError('');

    try {
      await updatePet(pet.id, {
        name,
        species,
        feedingsPerDay: target,
      });
    } catch (error) {
      if (error instanceof FirebaseError) {
        setError(`Changes could not be saved (${error.code}).`);
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Could not save changes. Please try again.');
      }
      return;
    } finally {
      savingInProgress.current = false;
      setIsSaving(false);
    }

    onClose();
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card} accessibilityViewIsModal>
            <Text style={styles.title}>Edit pet</Text>

            <Text style={styles.label}>Pet name</Text>
            <TextInput
              accessibilityLabel="Pet name"
              style={styles.input}
              value={name}
              onChangeText={setName}
              maxLength={80}
              editable={!isSaving}
            />

            <Text style={styles.label}>Species</Text>
            <TextInput
              accessibilityLabel="Species"
              style={styles.input}
              value={species}
              onChangeText={setSpecies}
              maxLength={40}
              editable={!isSaving}
            />

            <Text style={styles.label}>Feedings per day (1–24)</Text>
            <TextInput
              accessibilityLabel="Feedings per day"
              style={styles.input}
              value={feedingsPerDay}
              onChangeText={setFeedingsPerDay}
              keyboardType="number-pad"
              maxLength={2}
              editable={!isSaving}
            />

            {!isTargetValid && feedingsPerDay !== '' && (
              <Text style={styles.error}>
                Enter a whole number from 1 to 24.
              </Text>
            )}

            {error !== '' && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSaveDisabled, busy: isSaving }}
              disabled={isSaveDisabled}
              onPress={handleSave}
              style={({ pressed }) => [
                styles.button,
                styles.saveButton,
                pressed && styles.pressed,
                isSaveDisabled && styles.disabled,
              ]}
            >
              <Text style={styles.saveText}>
                {isSaving ? 'Saving…' : 'Save changes'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSaving }}
              disabled={isSaving}
              onPress={handleClose}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.label}>Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  label: { fontSize: 16, color: '#374151' },
  input: {
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  button: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: { backgroundColor: '#2563EB' },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  cancelButton: { borderWidth: 1, borderColor: '#9CA3AF' },
  disabled: { backgroundColor: '#6B7280' },
  pressed: { opacity: 0.75 },
  error: { color: '#B91C1C' },
});