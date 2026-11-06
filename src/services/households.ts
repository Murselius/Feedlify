import { addDoc, collection, onSnapshot, query, serverTimestamp, where, type FirestoreError, type Unsubscribe, } from 'firebase/firestore';
import { auth } from './auth';
import { db } from './firestore';
import type { Household } from '../types/household';

// Luo kotitalouden jonka omistajaksi ja ensimmäiseksi jäseneksi asetetaan kirjautunut käyttäjä.
export async function createHousehold(name: string): Promise<string> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Kirjaudu sisään ennen kotitalouden luomista.');
  }

  const trimmedName = name.trim();

  if (trimmedName.length === 0 || trimmedName.length > 80) {
    throw new Error('Kotitalouden nimessä pitää olla 1–80 merkkiä.');
  }

  const document = await addDoc(collection(db, 'households'), {
    name: trimmedName,
    ownerId: user.uid,
    memberIds: [user.uid],
    createdAt: serverTimestamp(),
  });

  return document.id;
}

/**
 * Kuuntelee käyttäjän kotitalouksien muutoksia reaaliaikaisesti.
 * Palauttaa funktion jolla kuuntelu lopetetaan.
 */
export function subscribeToHouseholds(
  userId: string,
  onChange: (households: Household[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const householdsQuery = query(
    collection(db, 'households'),
    where('memberIds', 'array-contains', userId),
  );

  return onSnapshot(
    householdsQuery,
    (snapshot) => {
      const households = snapshot.docs.map((document) => {
        const data = document.data() as Omit<Household, 'id'>;

        return {
          ...data,
          id: document.id,
        };
      });

      households.sort((a, b) => a.name.localeCompare(b.name));

      onChange(households);
    },
    onError,
  );
}