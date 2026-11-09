import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Bytes, doc, updateDoc } from 'firebase/firestore';
import { auth } from './auth';
import { db } from './firestore';

const MAX_PHOTO_BYTES = 200 * 1024;
const MAX_PHOTO_EDGE = 640;

export type SelectedPhoto = {
  uri: string;
  width: number;
  height: number;
};

export type SquareCrop = {
  originX: number;
  originY: number;
  size: number;
};

// Valitsee alkuperäisen kuvan. Käyttäjä rajaa sen seuraavaksi Feedlifyssä.
export async function choosePetPhoto(): Promise<SelectedPhoto | null> {
  if (!auth.currentUser) {
    throw new Error('Kirjaudu sisään ennen kuvan vaihtamista.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    allowsEditing: false,
  });

  if (result.canceled) return null;

  const { uri, width, height } = result.assets[0];

  if (width <= 0 || height <= 0) {
    throw new Error('Kuvan kokoa ei voitu lukea. Valitse toinen kuva.');
  }

  return { uri, width, height };
}

// Rajaa ja pienentää kuvan. Korvaa edellisen kuvan vasta valmistelun onnistuttua.
export async function saveCroppedPetPhoto(
  petId: string,
  photo: SelectedPhoto,
  crop: SquareCrop,
): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Kirjaudu sisään ennen kuvan tallentamista.');
  }

  const context = ImageManipulator.manipulate(photo.uri);

  try {
    context.crop({
      originX: crop.originX,
      originY: crop.originY,
      width: crop.size,
      height: crop.size,
    });

    if (crop.size > MAX_PHOTO_EDGE) {
      context.resize({ width: MAX_PHOTO_EDGE });
    }

    const image = await context.renderAsync();

    try {
      for (const quality of [0.8, 0.6, 0.4]) {
        const result = await image.saveAsync({
          format: SaveFormat.JPEG,
          compress: quality,
          base64: true,
        });

        if (!result.base64) {
          throw new Error('Kuvan käsittely epäonnistui.');
        }

        const bytes = Bytes.fromBase64String(result.base64);

        if (bytes.toUint8Array().byteLength <= MAX_PHOTO_BYTES) {
          await updateDoc(doc(db, 'pets', petId), { photo: bytes });
          return;
        }
      }

      throw new Error('Kuva on liian suuri. Kokeile tiukempaa rajausta.');
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}