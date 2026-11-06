import { getRandomBytesAsync } from 'expo-crypto';

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 12;

// Luo satunnaisen liittymiskoodin. Yksilöllisyys varmistetaan tallennettaessa.
export async function generateJoinCode(): Promise<string> {
  let code = '';

  // Hyväksytään vain tasaisesti merkistölle jakautuvat tavuarvot.
  const limit =
    256 - (256 % JOIN_CODE_ALPHABET.length);

  while (code.length < JOIN_CODE_LENGTH) {
    const bytes = await getRandomBytesAsync(JOIN_CODE_LENGTH);

    for (const byte of bytes) {
      if (byte >= limit) continue;

      code += JOIN_CODE_ALPHABET.charAt(
        byte % JOIN_CODE_ALPHABET.length
      );

      if (code.length === JOIN_CODE_LENGTH) break;
    }
  }

  return code;
}

// Yhtenäistää käyttäjän kirjoittaman tai liittämän koodin.
export function normalizeJoinCode(value: string): string {
  return value.trim().toUpperCase();
}