import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signOut } from 'firebase/auth';
import { auth } from '../services/auth';
import { subscribeToHouseholds } from '../services/households';
import { subscribeToPets } from '../services/pets';
import { useAuth } from '../hooks/useAuth';
import { useDailyFeedings } from '../hooks/useDailyFeedings';
import PetCard from '../components/PetCard';
import type { RootStackParamList } from '../navigation/types';
import type { Household } from '../types/household';
import type { Pet } from '../types/pet';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type HouseholdPetCardsProps = {
  household: Household;
  onPetCountChange: (householdId: string, count: number | null) => void;
};

// Näyttää kaikkien käyttäjän kotitalouksien lemmikit yhtenä listana
// sekä tarjoaa pääsyn hallintanäkymiin ja uloskirjautumiseen.
export default function HomeScreen({ navigation }: Props) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.uid;

  const [households, setHouseholds] = useState<Household[]>([]);
  const [householdsLoading, setHouseholdsLoading] = useState(true);
  const [householdsError, setHouseholdsError] = useState('');
  const [petCounts, setPetCounts] =
    useState<Record<string, number | null>>({});

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  useEffect(() => {
    setHouseholds([]);
    setHouseholdsError('');
    setPetCounts({});

    if (!userId) {
      setHouseholdsLoading(false);
      return;
    }

    setHouseholdsLoading(true);

    return subscribeToHouseholds(
      userId,
      (items) => {
        setHouseholds(items);
        setHouseholdsLoading(false);
        setHouseholdsError('');
      },
      (error) => {
        setHouseholds([]);
        setHouseholdsLoading(false);
        setHouseholdsError(
          `Households failed to load (${error.code}).`,
        );
      },
    );
  }, [userId]);

  // Kerää lemmikkimäärät yhteisen tyhjän tilan näyttämistä varten.
  const handlePetCountChange = useCallback(
    (householdId: string, count: number | null) => {
      setPetCounts((previous) => {
        if (previous[householdId] === count) {
          return previous;
        }

        return {
          ...previous,
          [householdId]: count,
        };
      });
    },
    [],
  );

  const allPetListsEmpty =
    households.length > 0 &&
    households.every((household) => petCounts[household.id] === 0);

  const handleLogout = async () => {
    if (isSigningOut) return;

    setLogoutError('');
    setIsSigningOut(true);

    try {
      await signOut(auth);
    } catch {
      setLogoutError('Sign out failed.');
    } finally {
      setIsSigningOut(false);
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
        <Text style={styles.title}>Feedlify</Text>

        <Text style={styles.description}>Keep your pets fed.</Text>

        {user && (
          <Text style={styles.text}>
            Signed in as: {user.email}
          </Text>
        )}

        <View style={styles.buttons}>
          <Button
            title="Manage Pets"
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

        {logoutError !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>
            {logoutError}
          </Text>
        )}

        <Text style={styles.heading}>Your Pets</Text>

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
              Create or join a household from the Households screen
              to get started.
            </Text>
          )}

        {!authLoading &&
          !householdsLoading &&
          !householdsError &&
          allPetListsEmpty && (
            <Text style={styles.text}>
              No pets yet. Add your first pet from Manage Pets.
            </Text>
          )}

        {households.map((household) => (
          <HouseholdPetCards
            key={household.id}
            household={household}
            onPetCountChange={handlePetCountChange}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// Kuuntelee yhden kotitalouden tietoja, mutta palauttaa vain lemmikkikortit.
// Käyttöliittymään ei lisätä kotitalousotsikkoa tai erillistä ryhmäkehystä.
function HouseholdPetCards({
  household,
  onPetCountChange,
}: HouseholdPetCardsProps) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [petsLoading, setPetsLoading] = useState(true);
  const [petsError, setPetsError] = useState('');

  const {
    feedings,
    loading: feedingsLoading,
    error: feedingsError,
    dayStart,
  } = useDailyFeedings(household.id);

  useEffect(() => {
    setPets([]);
    setPetsLoading(true);
    setPetsError('');
    onPetCountChange(household.id, null);

    return subscribeToPets(
      household.id,
      (items) => {
        setPets(items);
        setPetsLoading(false);
        setPetsError('');
        onPetCountChange(household.id, items.length);
      },
      (error) => {
        setPets([]);
        setPetsLoading(false);
        setPetsError(`Pets failed to load (${error.code}).`);
        onPetCountChange(household.id, null);
      },
    );
  }, [household.id, onPetCountChange]);

  return (
    <>
      {petsLoading && <ActivityIndicator color="#2563EB" />}

      {petsError !== '' && (
        <Text accessibilityRole="alert" style={styles.error}>
          {petsError}
        </Text>
      )}

      {feedingsError !== '' && pets.length > 0 && (
        <Text accessibilityRole="alert" style={styles.error}>
          {feedingsError}
        </Text>
      )}

      {pets.map((pet) => (
        <PetCard
          key={pet.id}
          pet={pet}
          dayStart={dayStart}
          feedings={feedings.filter(
            (feeding) => feeding.petId === pet.id,
          )}
          feedingsLoading={feedingsLoading}
          feedingsError={feedingsError}
          isDeleting={household.isDeleting === true || pet.isDeleting === true}
        />
      ))}
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
    fontSize: 36,
    fontWeight: '700',
    color: '#2563EB',
  },
  description: {
    fontSize: 18,
    lineHeight: 26,
    color: '#374151',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  text: {
    fontSize: 16,
    color: '#374151',
  },
  buttons: {
    gap: 12,
  },
  error: {
    color: '#B91C1C',
  },
});