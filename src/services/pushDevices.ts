import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firestore';

const INSTALLATION_ID_KEY = 'feedlify.push.installationId';
let installationIdPromise: Promise<string> | undefined;

// Lukee tämän asennuksen tunnisteen tai luo sen ensimmäisellä käyttökerralla.
async function loadInstallationId(): Promise<string> {
  const storedId = await AsyncStorage.getItem(INSTALLATION_ID_KEY);

  if (storedId) return storedId;

  const installationId = randomUUID();
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, installationId);

  return installationId;
}

// Samanaikaiset kutsut saavat saman tunnisteen myös ensimmäisellä käynnistyksellä.
export function getInstallationId(): Promise<string> {
  if (!installationIdPromise) {
    installationIdPromise = loadInstallationId().catch((error: unknown) => {
      installationIdPromise = undefined;
      throw error;
    });
  }

  return installationIdPromise;
}

// Tallentaa tämän Android-asennuksen nykyisen FCM-tunnuksen käyttäjälle.
export function registerPushDevice(
  userId: string,
  installationId: string,
  token: string,
): Promise<void> {
  const deviceRef = doc(db, 'users', userId, 'pushDevices', installationId);

  return setDoc(deviceRef, {
    token,
    platform: 'android',
    updatedAt: serverTimestamp(),
  });
}

// Poistaa tämän asennuksen rekisteröinnin käyttäjän kirjautuessa ulos.
export function unregisterPushDevice(
  userId: string,
  installationId: string,
): Promise<void> {
  const deviceRef = doc(db, 'users', userId, 'pushDevices', installationId);

  return deleteDoc(deviceRef);
}