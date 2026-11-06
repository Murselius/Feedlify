import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, Timestamp, where, type FirestoreError, type Unsubscribe } from 'firebase/firestore';
import { auth } from './auth';
import { db } from './firestore';
import type { Feeding } from '../types/feeding';

// Tallentaa ruokinnan kirjautuneen käyttäjän tunnuksella ja palvelimen ajalla.
// Firestore-säännöt tarkistavat jäsenyyden, lemmikin ja kotitalouden poistotilan.
export async function recordFeeding(
  petId: string,
  householdId: string,
): Promise<string> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Kirjaudu sisään ennen ruokinnan kirjaamista.');
  }

  if (!petId.trim() || !householdId.trim()) {
    throw new Error('Ruokinnalta puuttuu lemmikki tai kotitalous.');
  }

  const document = await addDoc(collection(db, 'feedings'), {
    petId,
    householdId,
    fedBy: user.uid,
    fedAt: serverTimestamp(),
  });

  return document.id;
}

// Kuuntelee kotitalouden ruokintoja valitulta paikalliselta kalenteripäivältä.
// Palauttaa funktion, jolla kuuntelu lopetetaan.
export function subscribeToFeedingsForDay(
  householdId: string,
  day: Date,
  onChange: (feedings: Feeding[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const start = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
  );

  const end = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate() + 1,
  );

  const feedingsQuery = query(
    collection(db, 'feedings'),
    where('householdId', '==', householdId),
    where('fedAt', '>=', Timestamp.fromDate(start)),
    where('fedAt', '<', Timestamp.fromDate(end)),
    orderBy('fedAt', 'desc'),
  );

  return onSnapshot(
    feedingsQuery,
    (snapshot) => {
      const feedings = snapshot.docs.map((document) => {
        const data = document.data() as Omit<Feeding, 'id'>;

        return {
          ...data,
          id: document.id,
        };
      });

      onChange(feedings);
    },
    onError,
  );
}