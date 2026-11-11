import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Button, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getInstallationId, registerPushDevice, unregisterPushDevice } from '../services/pushDevices';
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
import { ensureNotificationPermission, hasNotificationPermission, pruneFeedingReminders, syncHouseholdReminders, getAndroidFcmToken } from '../services/notifications';
import DisplayNameField from '../components/DisplayNameField';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type HouseholdPetCardsProps = {
  household: Household;
  onPetCountChange: (householdId: string, count: number | null) => void;
  remindersEnabled: boolean;
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
  const logoutStarted = useRef(false);
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

  const [remindersEnabled, setRemindersEnabled] = useState(false);

  useEffect(() => {
    let active = true;

    hasNotificationPermission()
      .then((granted) => {
        if (active) setRemindersEnabled(granted);
      })
      .catch(() => {
        if (active) setRemindersEnabled(false);
      });

    return () => {
      active = false;
    };
  }, []);

    // Rekisteröi Android-laitteen ja päivittää saman dokumentin tunnuksen vaihtuessa.
  useEffect(() => {
    if (Platform.OS !== 'android' || !userId || !remindersEnabled || isSigningOut) {
      return;
    }

    let active = true;
    let receivedTokenEvent = false;
    let latestToken = '';

    const saveToken = async (token: string) => {
      if (token === latestToken) return;
      latestToken = token;

      try {
        const installationId = await getInstallationId();

        if (!active || logoutStarted.current || auth.currentUser?.uid !== userId) return;
        if (token !== latestToken) return;

        await registerPushDevice(userId, installationId, token);
      } catch (error) {
        if (latestToken === token) latestToken = '';
        if (active) console.warn('Could not register this device:', error);
      }
    };

    const subscription = Notifications.addPushTokenListener((token) => {
      if (token.type === 'android' && typeof token.data === 'string' && token.data) {
        receivedTokenEvent = true;
        void saveToken(token.data);
      }
    });

    void getAndroidFcmToken()
      .then((token) => {
        if (active && !receivedTokenEvent) return saveToken(token);
      })
      .catch((error: unknown) => {
        if (active) console.warn('Could not get the device token:', error);
      });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [userId, remindersEnabled, isSigningOut]);

  useEffect(() => {
    if (!userId || householdsLoading || householdsError) return;

    void pruneFeedingReminders(
      userId,
      households.map((household) => household.id),
    ).catch((error) => console.warn('Could not clean up feeding reminders:', error));
  }, [userId, households, householdsLoading, householdsError]);

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
    if (logoutStarted.current || !userId) return;

    logoutStarted.current = true;
    setIsSigningOut(true);
    setLogoutError('');

    try {
      if (Platform.OS === 'android') {
        const installationId = await getInstallationId();
        await unregisterPushDevice(userId, installationId);
      }

      await signOut(auth);

      await pruneFeedingReminders(null, []).catch((error) => {
        console.warn('Could not clear feeding reminders after sign out:', error);
      });
    } catch (error) {
      console.warn('Could not complete sign out:', error);
      setLogoutError('Sign out failed. Please try again.');
    } finally {
      logoutStarted.current = false;
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

        {user && <DisplayNameField key={user.uid} user={user} />}

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

          {!remindersEnabled && (
            <Button
              title="Enable feeding reminders"
              onPress={async () => {
                try {
                  await ensureNotificationPermission();
                  setRemindersEnabled(true);
                } catch (error) {
                  Alert.alert(
                    'Feeding reminders',
                    error instanceof Error ? error.message : 'Could not enable reminders.',
                  );
                }
              }}
            />
          )}
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
            onPetCountChange={handlePetCountChange} remindersEnabled={remindersEnabled}/>
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
  remindersEnabled,
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

    useEffect(() => {
    const userId = auth.currentUser?.uid;

    if (
      !userId ||
      !remindersEnabled ||
      petsLoading ||
      feedingsLoading ||
      petsError ||
      feedingsError
    ) return;

    void syncHouseholdReminders(
      userId,
      household.id,
      household.isDeleting ? [] : pets,
      feedings,
      dayStart,
    ).catch((error) => {
      console.warn('Could not schedule feeding reminders:', error);
    });
  }, [
    remindersEnabled,
    household.id,
    household.isDeleting,
    pets,
    petsLoading,
    petsError,
    feedings,
    feedingsLoading,
    feedingsError,
    dayStart,
  ]);

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