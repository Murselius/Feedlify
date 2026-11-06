import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where, type FirestoreError, type Unsubscribe, } from 'firebase/firestore';
import { auth } from './auth';
import { db } from './firestore';
import type { Household } from '../types/household';
import { generateJoinCode } from '../utils/joinCode';

// Luo kotitalouden jonka omistajaksi ja ensimmäiseksi jäseneksi asetetaan kirjautunut käyttäjä.
// Luo kotitalouden ja varaa sille yksilöllisen liittymiskoodin atomisesti.
export async function createHousehold(name: string): Promise<string> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Log in before creating a household.');
  }

  const trimmedName = name.trim();

  if (trimmedName.length === 0 || trimmedName.length > 80) {
    throw new Error('Household name must be between 1 and 80 characters.');
  }

  const householdRef = doc(collection(db, 'households'));

  for (let attempt = 0; attempt < 5; attempt++) {
    const joinCode = await generateJoinCode();
    const inviteRef = doc(db, 'householdInvites', joinCode);

    const created = await runTransaction(db, async (transaction) => {
      const inviteSnapshot = await transaction.get(inviteRef);

      if (inviteSnapshot.exists()) {
        return false;
      }

      transaction.set(householdRef, {
        name: trimmedName,
        ownerId: user.uid,
        memberIds: [user.uid],
        joinCode,
        createdAt: serverTimestamp(),
      });

      transaction.set(inviteRef, {
        householdId: householdRef.id,
      });

      return true;
    });

    if (created) {
      return householdRef.id;
    }
  }

  throw new Error(
    'No available join code could be generated. Please try again.',
  );
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