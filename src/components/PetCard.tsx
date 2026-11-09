import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FirebaseError } from 'firebase/app';
import { recordFeeding } from '../services/feedings';
import type { Feeding } from '../types/feeding';
import type { Pet } from '../types/pet';
import PetPhoto from './PetPhoto';

type Props = {
  pet: Pet;
  feedings: Feeding[];
  feedingsLoading: boolean;
  feedingsError: string;
  isDeleting: boolean;
};

// Näyttää lemmikin päivän ruokinnat ja mahdollistaa uuden ruokinnan kirjaamisen.
export default function PetCard({
  pet,
  feedings,
  feedingsLoading,
  feedingsError,
  isDeleting,
}: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordError, setRecordError] = useState('');
  const recordingInProgress = useRef(false);

  const confirmedFeedings = feedings.filter(
    (feeding) => feeding.fedAt !== null,
  );

  // Kuuntelun tulokset ovat uusimmasta vanhimpaan.
  const latestFeeding = confirmedFeedings[0];
  const hasPendingFeeding = feedings.some(
    (feeding) => feeding.fedAt === null,
  );

  const count = confirmedFeedings.length;
  const targetReached = count >= pet.feedingsPerDay;

  const isRecordDisabled =
    isRecording ||
    isDeleting ||
    feedingsLoading ||
    feedingsError !== '' ||
    hasPendingFeeding;

  const latestTime = latestFeeding?.fedAt
    ? latestFeeding.fedAt.toDate().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  // Estää saman kortin päällekkäiset tallennukset.
  const handleRecordFeeding = async () => {
    if (recordingInProgress.current || isRecordDisabled) return;

    recordingInProgress.current = true;
    setIsRecording(true);
    setRecordError('');

    try {
      await recordFeeding(pet.id, pet.householdId);
    } catch (error) {
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case 'permission-denied':
            setRecordError(
              'Recording is not allowed. The household may be pending deletion.',
            );
            break;
          case 'unavailable':
            setRecordError(
              'Could not connect. Check your connection and try again.',
            );
            break;
          default:
            setRecordError(`Recording failed (${error.code}).`);
        }
      } else if (error instanceof Error) {
        setRecordError(error.message);
      } else {
        setRecordError('An unexpected error occurred. Please try again.');
      }
    } finally {
      recordingInProgress.current = false;
      setIsRecording(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{pet.name}</Text>
      <PetPhoto pet={pet} />
      <Text style={styles.text}>Species: {pet.species}</Text>

      {feedingsLoading ? (
        <ActivityIndicator color="#2563EB" />
      ) : feedingsError !== '' ? (
        <Text style={styles.text}>
          Today's feeding count is unavailable.
        </Text>
      ) : (
        <>
          <Text
            style={[
              styles.feedingCount,
              targetReached && styles.targetReached,
            ]}
          >
            Today: {count} / {pet.feedingsPerDay}
          </Text>

          {targetReached && (
            <Text style={styles.success}>Daily target reached.</Text>
          )}

          <Text style={styles.text}>
            {latestTime
              ? `Last feeding today: ${latestTime}`
              : 'No feedings recorded today.'}
          </Text>

          {hasPendingFeeding && (
            <Text style={styles.text}>
              Waiting for feeding confirmation…
            </Text>
          )}
        </>
      )}

      {isDeleting && (
        <Text style={styles.error}>
          This household is being deleted. New feedings are disabled.
        </Text>
      )}

      {recordError !== '' && (
        <Text accessibilityRole="alert" style={styles.error}>
          {recordError}
        </Text>
      )}

      <Pressable
        onPress={handleRecordFeeding}
        disabled={isRecordDisabled}
        accessibilityRole="button"
        accessibilityLabel={`Record feeding for ${pet.name}`}
        accessibilityState={{
          disabled: isRecordDisabled,
          busy: isRecording,
        }}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: isRecordDisabled
              ? '#6B7280'
              : pressed
                ? '#1D4ED8'
                : '#2563EB',
          },
        ]}
      >
        <Text style={styles.buttonText}>
          {isRecording ? 'Recording…' : 'Record feeding'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  text: {
    fontSize: 16,
    color: '#374151',
  },
  feedingCount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2563EB',
  },
  targetReached: {
    color: '#15803D',
  },
  success: {
    color: '#15803D',
  },
  error: {
    color: '#B91C1C',
  },
  button: {
    minHeight: 48,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});