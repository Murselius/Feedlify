import { collection, doc, getDocFromServer, getDocsFromServer, onSnapshot, orderBy, query, runTransaction, serverTimestamp, Timestamp, where, type FirestoreError, type Unsubscribe } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { getFeedingDay, getFeedingSchedule, getNextFeedingMinute } from '../utils/feedingSchedule';
import { auth } from './auth';
import { db } from './firestore';
import type { Feeding } from '../types/feeding';

function dailyQuery(householdId: string, date: Date) {
  const day = getFeedingDay(date);

  return query(
    collection(db, 'feedings'),
    where('householdId', '==', householdId),
    where('fedAt', '>=', Timestamp.fromMillis(day.start)),
    where('fedAt', '<', Timestamp.fromMillis(day.end)),
    orderBy('fedAt', 'desc'),
  );
}

// Kuittaa juuri kortissa näkyneen ruokinta-ajan.
export async function recordFeeding(
  petId: string,
  householdId: string,
  count: number,
  displayedDay: number,
  minute: number,
): Promise<void> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Kirjaudu sisään ennen ruokinnan kirjaamista.');
  }

  const day = getFeedingDay();

  if (day.start !== displayedDay) {
    throw new Error('Päivä vaihtui. Odota kortin päivittymistä.');
  }

  const today = await getDocsFromServer(
    dailyQuery(householdId, new Date(day.start)),
  );

  const petFeedings = today.docs
    .map((entry) => entry.data() as Feeding)
    .filter((entry) => entry.petId === petId);

  if (getNextFeedingMinute(count, petFeedings) !== minute) {
    throw new Error('Ruokintatilanne muuttui. Tarkista seuraava aika kortista.');
  }

  const slotIndex = getFeedingSchedule(count).indexOf(minute);

  // Kaikilla jäsenillä on samalle lemmikille, päivälle ja ajalle sama tunniste.
  const feedingId = `${petId}_${day.dayNumber}_${minute}`;
  const feedingRef = doc(db, 'feedings', feedingId);
  const petRef = doc(db, 'pets', petId);

  try {
    await runTransaction(db, async (transaction) => {
      const pet = await transaction.get(petRef);

      if (
        !pet.exists() ||
        pet.data().householdId !== householdId ||
        pet.data().isDeleting ||
        pet.data().feedingsPerDay !== count
      ) {
        throw new Error('Lemmikin tiedot muuttuivat. Tarkista kortti uudelleen.');
      }

      if (getFeedingDay().start !== displayedDay) {
        throw new Error('Päivä vaihtui. Odota kortin päivittymistä.');
      }

      transaction.set(feedingRef, {
        petId,
        householdId,
        fedBy: user.uid,
        fedAt: serverTimestamp(),
        scheduledMinute: minute,
        scheduleDay: day.dayNumber,
        slotIndex,
        dayStart: Timestamp.fromMillis(day.start),
        dayEnd: Timestamp.fromMillis(day.end),
      });
    });
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'permission-denied') {
      const existing = await getDocFromServer(feedingRef).catch(() => null);

      if (existing?.exists()) {
        throw new Error('Tämä ruokinta-aika on jo kuitattu.');
      }
    }

    throw error;
  }
}

// Kuuntelee yhden kotitalouden ruokintoja valitulta Suomen kalenteripäivältä.
export function subscribeToFeedingsForDay(
  householdId: string,
  day: Date,
  onChange: (feedings: Feeding[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    dailyQuery(householdId, day),
    (snapshot) => {
      const feedings = snapshot.docs.map((document) => {
        const data = document.data() as Omit<Feeding, 'id'>;
        return { ...data, id: document.id };
      });

      onChange(feedings);
    },
    onError,
  );
}