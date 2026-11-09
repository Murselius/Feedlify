import { addDoc, collection, deleteDoc, doc, getDocsFromServer, limit, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch, type FirestoreError, type Unsubscribe } from 'firebase/firestore';
import { auth } from './auth';
import { db } from './firestore';
import type { Pet } from '../types/pet';

// Kentät, joita käyttäjä voi muuttaa lemmikin lomakkeella.
export type PetDetailsInput = Pick<Pet, 'name' | 'species' | 'feedingsPerDay'>;

export type CreatePetInput = PetDetailsInput & {
  householdId: string;
};

// Tarkistaa lomakkeen tiedot ja palauttaa tallennettavat kentät.
function validatePetDetails(input: PetDetailsInput): PetDetailsInput {
  const name = input.name.trim();
  const species = input.species.trim();
  const feedingsPerDay = input.feedingsPerDay;

  if (name.length === 0 || name.length > 80) {
    throw new Error('Lemmikin nimessä pitää olla 1–80 merkkiä.');
  }

  if (species.length === 0 || species.length > 40) {
    throw new Error('Lajissa pitää olla 1–40 merkkiä.');
  }

  if (
    !Number.isInteger(feedingsPerDay) ||
    feedingsPerDay < 1 ||
    feedingsPerDay > 24
  ) {
    throw new Error('Ruokintamäärän pitää olla kokonaisluku väliltä 1–24.');
  }

  return { name, species, feedingsPerDay };
}

// Luo lemmikin valittuun kotitalouteen.
export async function createPet(input: CreatePetInput): Promise<string> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Kirjaudu sisään ennen lemmikin lisäämistä.');
  }

  const details = validatePetDetails(input);
  const householdId = input.householdId.trim();

  if (!householdId) {
    throw new Error('Valitse lemmikille kotitalous.');
  }

  const document = await addDoc(collection(db, 'pets'), {
    ...details,
    householdId,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  });

  return document.id;
}

// Päivittää olemassa olevan lemmikin nimen, lajin ja ruokintatavoitteen.
export async function updatePet(
  petId: string,
  input: PetDetailsInput,
): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Kirjaudu sisään ennen lemmikin muokkaamista.');
  }

  const details = validatePetDetails(input);
  await updateDoc(doc(db, 'pets', petId), details);
}

// Poistaa omistajan valitseman lemmikin, sen kuvan ja ruokintahistorian.
// Keskeytynyttä poistoa voi jatkaa samalla lemmikin tunnuksella.
export async function deletePet(petId: string): Promise<void> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Kirjaudu sisään ennen lemmikin poistamista.');
  }

  const petRef = doc(db, 'pets', petId);

  const householdId = await runTransaction(db, async (transaction) => {
    const petSnapshot = await transaction.get(petRef);

    if (!petSnapshot.exists()) {
      throw new Error('Lemmikkiä ei enää löydy.');
    }

    const pet = petSnapshot.data();
    const id = pet.householdId;

    if (typeof id !== 'string' || !id) {
      throw new Error('Lemmikin kotitaloutta ei löydy.');
    }

    const householdRef = doc(db, 'households', id);
    const householdSnapshot = await transaction.get(householdRef);

    if (!householdSnapshot.exists()) {
      throw new Error('Kotitaloutta ei enää löydy.');
    }

    const household = householdSnapshot.data();

    if (household.ownerId !== user.uid) {
      throw new Error('Vain kotitalouden omistaja voi poistaa lemmikin.');
    }

    if (household.isDeleting === true) {
      throw new Error(
        'Kotitalouden poisto on jo alkanut. Jatka poistoa Households-näkymästä.',
      );
    }

    if (pet.isDeleting !== true) {
      transaction.update(petRef, { isDeleting: true });
    }

    return id;
  });

  const feedingsQuery = query(
    collection(db, 'feedings'),
    where('householdId', '==', householdId),
    where('petId', '==', petId),
    limit(20),
  );

  while (true) {
    const snapshot = await getDocsFromServer(feedingsQuery);

    if (snapshot.empty) break;

    const batch = writeBatch(db);

    for (const feeding of snapshot.docs) {
      batch.delete(feeding.ref);
    }

    await batch.commit();
  }

  await deleteDoc(petRef);
}

// Kuuntelee valitun kotitalouden lemmikkejä aakkosjärjestyksessä.
export function subscribeToPets(
  householdId: string,
  onChange: (pets: Pet[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const petsQuery = query(
    collection(db, 'pets'),
    where('householdId', '==', householdId),
  );

  return onSnapshot(
    petsQuery,
    (snapshot) => {
      const pets = snapshot.docs.map((document) => {
        const data = document.data() as Omit<Pet, 'id'>;
        return { ...data, id: document.id };
      });

      pets.sort((a, b) => a.name.localeCompare(b.name));
      onChange(pets);
    },
    onError,
  );
}