import type { Feeding } from '../types/feeding';

export const FEEDING_TIME_ZONE = 'Europe/Helsinki';

const DAY_MS = 86_400_000;

const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: FEEDING_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

// Muuntaa Suomen kellon kalenteriosat luvuksi päivän rajojen laskemista varten.
function civilTime(instant: Date): number {
  const parts = clock.formatToParts(instant);

  const part = (name: string) =>
    Number(parts.find((item) => item.type === name)?.value);

  return Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
}

// Etsii ajanhetken, jolloin Suomen paikallinen kello näyttää keskiyötä.
function midnightInstant(civilMidnight: number): number {
  let instant = civilMidnight;

  for (let attempt = 0; attempt < 3; attempt++) {
    const correction = civilMidnight - civilTime(new Date(instant));

    if (correction === 0) break;

    instant += correction;
  }

  return instant;
}

// Laskee päivän alun ja seuraavan päivän alun erikseen myös kellonsiirtopäivinä.
export function getFeedingDay(date = new Date()) {
  const dayNumber = Math.floor(civilTime(date) / DAY_MS);

  return {
    dayNumber,
    start: midnightInstant(dayNumber * DAY_MS),
    end: midnightInstant((dayNumber + 1) * DAY_MS),
  };
}

// Jakaa vuorokauden tasaisesti ja pyöristää kunkin ajan lähimpään varttiin.
export function getFeedingSchedule(count: number): number[] {
  if (!Number.isInteger(count) || count < 1 || count > 24) {
    throw new Error('Ruokintamäärän pitää olla kokonaisluku väliltä 1–24.');
  }

  const quartersPerDay = 96;

  return Array.from({ length: count }, (_, index) => {
    const quarter = Math.round((index * quartersPerDay) / count);
    return quarter * 15;
  });
}

export function formatFeedingTime(minute: number): string {
  const hours = String(Math.floor(minute / 60)).padStart(2, '0');
  const minutes = String(minute % 60).padStart(2, '0');

  return `${hours}:${minutes}`;
}

// Palauttaa ensimmäisen kuittaamattoman ajan tai null, jos kaikki on kuitattu.
export function getNextFeedingMinute(
  count: number,
  feedings: Pick<Feeding, 'scheduledMinute'>[],
): number | null {
  const schedule = getFeedingSchedule(count);
  const claimed = new Set<number>();
  let legacyCount = 0;

  for (const feeding of feedings) {
    if (feeding.scheduledMinute === undefined) {
      legacyCount++;
    } else {
      claimed.add(feeding.scheduledMinute);
    }
  }

  // Ennen aikatauluominaisuutta tehdyt kirjaukset kattavat päivän ensimmäiset ajat.
  for (const minute of schedule.slice(0, legacyCount)) {
    claimed.add(minute);
  }

  return schedule.find((minute) => !claimed.has(minute)) ?? null;
}