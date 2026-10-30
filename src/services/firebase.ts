import { getApp, getApps, initializeApp } from "firebase/app";

//Firebasen arvot haetaan ympäristömuuttujista
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Tarkistaa kaikki Firebase-konfiguraatiotiedot
for (const [key, value] of Object.entries(firebaseConfig)) {
    if (!value?.trim()) {
        throw new Error(`Missing Firebase config value for ${key}. Check .env file.`);
    }
}

//estää saman Firebase-sovelluksen alustamisen uudelleen
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();