import { addDoc, collection, onSnapshot, query, serverTimestamp, where, type FirestoreError, type Unsubscribe, } from 'firebase/firestore';
import { auth } from './auth';
import { db } from './firestore';
import type { Pet } from '../types/pet';

//lemmikin luomiseen tarvittavat lomaketiedot. Käyttäjätunniste ja aikaleima lisätään tallennuksessa.
export type CreatePetInput = {
  name: string;
  species: string;
  householdId: string;
  feedingsPerDay: number;
};

/**
 * Tarkistaa lomaketiedot ja tallentaa lemmikin Firestoreen.
 * Firestore-säännöt tarkistavat käyttäjän kotitalousjäsenyyden.
 */
export async function createPet(input: CreatePetInput): Promise<string> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Kirjaudu sisään ennen lemmikin lisäämistä.');
  }

  const name = input.name.trim();
  const species = input.species.trim();
  const householdId = input.householdId.trim();

  if (name.length === 0 || name.length > 80) {
    throw new Error('Lemmikin nimessä pitää olla 1–80 merkkiä.');
  }

  if (species.length === 0 || species.length > 40) {
    throw new Error('Lajissa pitää olla 1–40 merkkiä.');
  }

  if (!householdId) {
    throw new Error('Valitse lemmikille kotitalous.');
  }

  if (
    !Number.isInteger(input.feedingsPerDay) ||
    input.feedingsPerDay < 1 ||
    input.feedingsPerDay > 24
  ) {
    throw new Error('Ruokintamäärän pitää olla kokonaisluku väliltä 1–24.');
  }

  const document = await addDoc(collection(db, 'pets'), {
    name,
    species,
    householdId,
    feedingsPerDay: input.feedingsPerDay,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  });

  return document.id;
}

/**
 * Kuuntelee yhden kotitalouden lemmikkejä reaaliaikaisesti.
 * Palauttaa funktion, jolla kuuntelu lopetetaan.
 */
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

        return {
          ...data,
          id: document.id,
        };
      });

      pets.sort((a, b) => a.name.localeCompare(b.name));

      onChange(pets);
    },
    onError,
  );
}