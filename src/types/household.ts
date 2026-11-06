import type { Timestamp } from 'firebase/firestore';

//Sovelluksessa käytettävä kotitalous -tyyppi. id saadaan Firestore-dokumentin tunnisteesta.
export type Household = {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  createdAt: Timestamp | null;
  joinCode?: string;
  isDeleting?: boolean;
};