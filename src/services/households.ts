import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where, type FirestoreError, type Unsubscribe, getDocsFromServer, limit, writeBatch, } from 'firebase/firestore';
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

// Päivittää kotitalouden nimen vain kirjautuneen omistajan pyynnöstä.
export async function renameHousehold(
  householdId: string,
  name: string,
): Promise<void> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Login before editing a household.');
  }

  const trimmedName = name.trim();

  if (trimmedName.length === 0 || trimmedName.length > 80) {
    throw new Error('Household name must be between 1 and 80 characters.');
  }

  const householdRef = doc(db, 'households', householdId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(householdRef);

    if (!snapshot.exists()) {
      throw new Error('Household not found.');
    }

    if (snapshot.data().ownerId !== user.uid) {
      throw new Error('Only the household owner can change the name.');
    }

    if (snapshot.data().isDeleting === true) {
        throw new Error('The name of a household being deleted cannot be changed.');
    }

    transaction.update(householdRef, {
      name: trimmedName,
    });
  });
}

// Poistaa omistajan kotitalouden lemmikkeineen ja liittymiskoodin varauksineen.
// Keskeytynyttä poistoa voi jatkaa kutsumalla funktiota uudelleen.
export async function deleteHousehold(
  householdId: string,
): Promise<void> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Kirjaudu sisään ennen kotitalouden poistamista.');
  }

  const householdRef = doc(db, 'households', householdId);

  const joinCode = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(householdRef);

    if (!snapshot.exists()) {
      throw new Error('Kotitaloutta ei enää löydy.');
    }

    const household = snapshot.data();

    if (household.ownerId !== user.uid) {
      throw new Error('Vain kotitalouden omistaja voi poistaa sen.');
    }

    if (household.isDeleting !== true) {
      transaction.update(householdRef, {
        isDeleting: true,
      });
    }

    return typeof household.joinCode === 'string'
      ? household.joinCode
      : undefined;
  });

  const petsQuery = query(
    collection(db, 'pets'),
    where('householdId', '==', householdId),
    limit(20),
  );

  while (true) {
    // Haetaan palvelimelta, jotta paikallinen välimuisti ei ohita lemmikkejä.
    const petsSnapshot = await getDocsFromServer(petsQuery);

    if (petsSnapshot.empty) break;

    const batch = writeBatch(db);

    for (const petDocument of petsSnapshot.docs) {
      batch.delete(petDocument.ref);
    }

    await batch.commit();
  }

  const finalBatch = writeBatch(db);

  if (joinCode) {
    finalBatch.delete(doc(db, 'householdInvites', joinCode));
  }

  finalBatch.delete(householdRef);

  await finalBatch.commit();
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