import type { Timestamp } from 'firebase/firestore';

// Yksittäinen ruokintakirjaus. Palvelimen aikaleima voi olla
// paikallisessa, vielä vahvistamattomassa kirjauksessa null.
export type Feeding = {
  id: string;
  petId: string;
  householdId: string;
  fedBy: string;
  fedAt: Timestamp | null;
};