import { getFirestore } from 'firebase/firestore';
import { firebaseApp } from './firebase';


//Sovelluksen Cloud Firestore -tietokantayhteys.
export const db = getFirestore(firebaseApp);