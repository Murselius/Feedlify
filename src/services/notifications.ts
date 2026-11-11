import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { auth } from './auth';
import { getFeedingDay, getFeedingInstant, getFeedingSchedule, getRemainingFeedingMinutes } from '../utils/feedingSchedule';
import type { Pet } from '../types/pet';
import type { Feeding } from '../types/feeding';

const FEEDING_CHANNEL_ID = 'feeding-reminders';

// Näyttää saapuvan ilmoituksen myös Feedlifyn ollessa auki.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Luo Androidin ruokintamuistutusten kanavan ennen ilmoitusluvan pyytämistä.
export async function ensureNotificationPermission(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(FEEDING_CHANNEL_ID, {
      name: 'Feeding reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  let permission = await Notifications.getPermissionsAsync();

  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }

  if (!permission.granted) {
    throw new Error('Enable notifications in the device settings to receive feeding reminders.');
  }
}

const REMINDER_KIND = 'feedlify-feeding';

type Reminder = {
  identifier: string;
  at: number;
  petName: string;
};

// Käsittelee ajastusten muutokset järjestyksessä myös nopeilla peräkkäisillä kuittauksilla.
let pendingSync: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>): Promise<void> {
  const result = pendingSync.then(task);
  pendingSync = result.catch(() => {});
  return result;
}

export async function hasNotificationPermission(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

// Pitää yhden kotitalouden tulevat muistutukset ajan tasalla tällä laitteella.
export function syncHouseholdReminders(
  userId: string,
  householdId: string,
  pets: Pet[],
  feedings: Feeding[],
  dayStart: number,
): Promise<void> {
  return enqueue(async () => {
    if (auth.currentUser?.uid !== userId) return;

    const today = getFeedingDay();
    if (today.start !== dayStart) return;

    const tomorrow = getFeedingDay(new Date(today.end));
    const wanted = new Map<string, Reminder>();

    for (const pet of pets) {
      if (pet.isDeleting) continue;

      const petFeedings = feedings.filter((entry) => entry.petId === pet.id);
      const days = [
        { day: today, minutes: getRemainingFeedingMinutes(pet.feedingsPerDay, petFeedings) },
        { day: tomorrow, minutes: getFeedingSchedule(pet.feedingsPerDay) },
      ];

      for (const { day, minutes } of days) {
        for (const minute of minutes) {
          const at = getFeedingInstant(day, minute);
          if (at === null || at <= Date.now()) continue;

          const identifier = `${REMINDER_KIND}:${userId}:${pet.id}:${day.dayNumber}:${minute}`;
          wanted.set(identifier, { identifier, at, petName: pet.name });
        }
      }
    }

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    for (const request of scheduled) {
      const data = request.content.data;

      if (
        data?.kind !== REMINDER_KIND ||
        data.userId !== userId ||
        data.householdId !== householdId
      ) continue;

      const expected = wanted.get(request.identifier);

      if (expected && data.at === expected.at && data.petName === expected.petName) {
        wanted.delete(request.identifier);
      } else {
        await Notifications.cancelScheduledNotificationAsync(request.identifier);
      }
    }

    for (const reminder of wanted.values()) {
      if (reminder.at <= Date.now() || auth.currentUser?.uid !== userId) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: reminder.identifier,
        content: {
          title: 'Feedlify',
          body: `It's time to feed ${reminder.petName}`,
          sound: 'default',
          data: {
            kind: REMINDER_KIND,
            userId,
            householdId,
            petName: reminder.petName,
            at: reminder.at,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(reminder.at),
          channelId: FEEDING_CHANNEL_ID,
        },
      });
    }
  });
}

// Poistaa laitteelta aiemman käyttäjän ja poistuneiden kotitalouksien muistutukset.
export function pruneFeedingReminders(
  userId: string | null,
  householdIds: string[],
): Promise<void> {
  return enqueue(async () => {
    const allowed = new Set(householdIds);
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    for (const request of scheduled) {
      const data = request.content.data;
      if (data?.kind !== REMINDER_KIND) continue;

      if (
        data.userId !== userId ||
        typeof data.householdId !== 'string' ||
        !allowed.has(data.householdId)
      ) {
        await Notifications.cancelScheduledNotificationAsync(request.identifier);
      }
    }
  });
}

// Hakee tämän Feedlify-asennuksen Androidin FCM-rekisteröintitunnuksen.
export async function getAndroidFcmToken(): Promise<string> {
  await ensureNotificationPermission();

  const token = await Notifications.getDevicePushTokenAsync();

  if (token.type !== 'android' || typeof token.data !== 'string' || !token.data) {
    throw new Error('Could not get an Android FCM token.');
  }

  return token.data;
}