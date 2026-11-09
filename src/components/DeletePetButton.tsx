import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { FirebaseError } from 'firebase/app';
import { deletePet } from '../services/pets';
import type { Pet } from '../types/pet';

type Props = {
  pet: Pet;
};

// Pyytää omistajalta vahvistuksen ja käynnistää tai jatkaa lemmikin poistoa.
export default function DeletePetButton({ pet }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const deletionInProgress = useRef(false);

  const handleDelete = async () => {
    if (deletionInProgress.current) return;

    deletionInProgress.current = true;
    setIsDeleting(true);
    setError('');

    try {
      await deletePet(pet.id);
    } catch (error) {
      if (error instanceof FirebaseError) {
        setError(`Deletion failed (${error.code}). Please try again.`);
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Deletion failed. Please try again.');
      }
    } finally {
      deletionInProgress.current = false;
      setIsDeleting(false);
    }
  };

  const confirmDelete = () => {
    if (deletionInProgress.current) return;

    const continuing = pet.isDeleting === true;

    Alert.alert(
      continuing ? 'Continue deleting pet?' : 'Delete pet?',
      continuing
        ? `Continue deleting "${pet.name}" and its remaining feeding history?`
        : `Delete "${pet.name}", its photo and all its feeding history for every household member? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: continuing ? 'Continue deletion' : 'Delete pet',
          style: 'destructive',
          onPress: () => void handleDelete(),
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <View style={styles.container}>
      {error !== '' && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          pet.isDeleting ? `Continue deleting ${pet.name}` : `Delete ${pet.name}`
        }
        accessibilityState={{ disabled: isDeleting, busy: isDeleting }}
        disabled={isDeleting}
        onPress={confirmDelete}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.pressed,
          isDeleting && styles.disabled,
        ]}
      >
        <Text style={styles.buttonText}>
          {isDeleting
            ? 'Deleting…'
            : pet.isDeleting
              ? 'Continue deletion'
              : 'Delete pet'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#B91C1C',
  },
  pressed: { backgroundColor: '#991B1B' },
  disabled: { backgroundColor: '#6B7280' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  error: { color: '#B91C1C' },
});