import type { Bytes, Timestamp } from 'firebase/firestore';

//lemmikki ja sen päivittäinen ruokintatavoite. id saadaan Firestore-dokumentin tunnisteesta.
export type Pet = {
  id: string;
  name: string;
  species: string;
  householdId: string;
  feedingsPerDay: number;
  createdBy: string;
  createdAt: Timestamp | null;
  photo?: Bytes;
};