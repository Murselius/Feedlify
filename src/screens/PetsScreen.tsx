import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FirebaseError } from 'firebase/app';
import { useAuth } from '../hooks/useAuth';
import { subscribeToHouseholds } from '../services/households';
import { createPet, subscribeToPets } from '../services/pets';
import type { Household } from '../types/household';
import type { Pet } from '../types/pet';
import PetPhoto from '../components/PetPhoto';
import EditPetModal from '../components/EditPetModal';
import DeletePetButton from '../components/DeletePetButton';

//Näyttää käyttäjän kotitaloudet ja valitun kotitalouden lemmikit. Sisältää lomakkeen lemmikin lisäämiseen valittuun kotitalouteen.
export default function PetsScreen() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.uid;

  const [households, setHouseholds] = useState<Household[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [householdsLoading, setHouseholdsLoading] = useState(true);
  const [householdsError, setHouseholdsError] = useState('');

  useEffect(() => {
    setHouseholds([]);
    setSelectedId('');
    setHouseholdsError('');

    if (!userId) {
      setHouseholdsLoading(false);
      return;
    }

    setHouseholdsLoading(true);

    return subscribeToHouseholds(
      userId,
      (items) => {
        setHouseholds(items);

        setSelectedId((previousId) =>
          items.some((item) => item.id === previousId)
            ? previousId
            : (items[0]?.id ?? ''),
        );

        setHouseholdsLoading(false);
        setHouseholdsError('');
      },
      (error) => {
        setHouseholds([]);
        setSelectedId('');
        setHouseholdsLoading(false);
        setHouseholdsError(
          `Kotitalouksien lataaminen epäonnistui (${error.code}).`,
        );
      },
    );
  }, [userId]);

  const selectedHousehold = households.find(
    (household) => household.id === selectedId,
  );

  return (
    <SafeAreaView
      style={styles.container}
      edges={['bottom', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Pets</Text>

        {(authLoading || householdsLoading) && (
          <ActivityIndicator size="large" color="#2563EB" />
        )}

        {householdsError !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>
            {householdsError}
          </Text>
        )}

        {!authLoading &&
          !householdsLoading &&
          !householdsError &&
          households.length === 0 && (
            <Text style={styles.text}>
              Create a household first from the Households screen.
            </Text>
          )}

        {households.length > 0 && (
          <>
            <Text style={styles.heading}>Select Household</Text>

            <View style={styles.choices}>
              {households.map((household) => {
                const selected = household.id === selectedId;

                return (
                  <Pressable
                    key={household.id}
                    onPress={() => setSelectedId(household.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[
                      styles.choice,
                      selected && styles.selectedChoice,
                    ]}
                  >
                    <Text
                      style={[
                        styles.text,
                        selected && styles.selectedChoiceText,
                      ]}
                    >
                      {household.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {selectedHousehold && (
          <HouseholdPets
            key={selectedHousehold.id}
            household={selectedHousehold}
            isOwner={selectedHousehold.ownerId === userId}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Kuuntelee yhden kotitalouden lemmikkejä ja hoitaa lisäyslomakkeen.
 * Kotitalouden vaihtuessa komponentin tila alustetaan uudelleen.
 */
function HouseholdPets({ household, isOwner }: { household: Household; isOwner: boolean }) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  const editingPet = pets.find((pet) => pet.id === editingPetId);

  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [feedingsPerDay, setFeedingsPerDay] = useState('2');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    return subscribeToPets(
      household.id,
      (items) => {
        setPets(items);
        setLoading(false);
        setLoadError('');
      },
      (error) => {
        setPets([]);
        setLoading(false);
        setLoadError(
          `Pets failed to load (${error.code}).`,
        );
      },
    );
  }, [household.id]);

  const handleCreate = async () => {
    if (isSaving) return;

    setFormError('');
    setSuccessMessage('');
    setIsSaving(true);

    try {
      await createPet({
        name,
        species,
        householdId: household.id,
        feedingsPerDay: Number(feedingsPerDay),
      });

      setName('');
      setSpecies('');
      setFeedingsPerDay('2');
      setSuccessMessage('Pet added.');
    } catch (error) {
      if (error instanceof FirebaseError) {
        setFormError(
          `Failed to save pet (${error.code}).`,
        );
      } else if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError('Unexpected error. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const isSaveDisabled =
    isSaving ||
    !name.trim() ||
    !species.trim() ||
    !feedingsPerDay.trim();

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.heading}>Add Pet</Text>
        <Text style={styles.text}>Household: {household.name}</Text>

        <Text style={styles.label}>Pet Name</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel="Pet Name"
          value={name}
          onChangeText={setName}
          maxLength={80}
          editable={!isSaving}
        />

        <Text style={styles.label}>Species</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel="Species"
          placeholder="For example, cat, dog, hamster"
          placeholderTextColor="#6B7280"
          value={species}
          onChangeText={setSpecies}
          maxLength={40}
          editable={!isSaving}
        />

        <Text style={styles.label}>Feedings per Day (1–24)</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel="Feedings per Day"
          value={feedingsPerDay}
          onChangeText={setFeedingsPerDay}
          keyboardType="number-pad"
          maxLength={2}
          editable={!isSaving}
        />

        {formError !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>
            {formError}
          </Text>
        )}

        {successMessage !== '' && (
          <Text style={styles.success}>{successMessage}</Text>
        )}

        <Pressable
          onPress={handleCreate}
          disabled={isSaveDisabled}
          accessibilityRole="button"
          accessibilityState={{
            disabled: isSaveDisabled,
            busy: isSaving,
          }}
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: isSaveDisabled
                ? '#6B7280'
                : pressed
                  ? '#1D4ED8'
                  : '#2563EB',
            },
          ]}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving…' : 'Add Pet'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>
        Pets in Household {household.name}
      </Text>

      {loading && <ActivityIndicator color="#2563EB" />}

      {loadError !== '' && (
        <Text accessibilityRole="alert" style={styles.error}>
          {loadError}
        </Text>
      )}

      {!loading && !loadError && pets.length === 0 && (
        <Text style={styles.text}>
          There are no pets in this household yet.
        </Text>
      )}

      {pets.map((pet) => {
        const canEdit = !household.isDeleting && !pet.isDeleting;

        return (
          <View key={pet.id} style={styles.card}>
            <Text style={styles.heading}>{pet.name}</Text>

            <PetPhoto pet={pet} editable={canEdit} />

            <Text style={styles.text}>Species: {pet.species}</Text>
            <Text style={styles.text}>
              Feedings per Day: {pet.feedingsPerDay}
            </Text>

            {pet.isDeleting && (
              <Text style={styles.error}>Deletion has started for this pet.</Text>
            )}

            {canEdit && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${pet.name}`}
                onPress={() => setEditingPetId(pet.id)}
                style={({ pressed }) => [
                  styles.saveButton,
                  { backgroundColor: pressed ? '#1D4ED8' : '#2563EB' },
                ]}
              >
                <Text style={styles.saveButtonText}>Edit</Text>
              </Pressable>
            )}

            {isOwner && !household.isDeleting && (
              <DeletePetButton pet={pet} />
            )}
          </View>
        );
      })}

      {editingPet && !editingPet.isDeleting && !household.isDeleting && (
        <EditPetModal
          key={editingPet.id}
          pet={editingPet}
          onClose={() => setEditingPetId(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },
  content: {
    padding: 24,
    gap: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2563EB',
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
  label: {
    fontSize: 16,
    color: '#374151',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    backgroundColor: '#FFFFFF',
  },
  selectedChoice: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  selectedChoiceText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  saveButton: {
    minHeight: 48,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#B91C1C',
  },
  success: {
    color: '#15803D',
  },
});