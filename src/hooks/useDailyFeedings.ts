import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { subscribeToFeedingsForDay } from '../services/feedings';
import type { Feeding } from '../types/feeding';
import { getFeedingDay } from '../utils/feedingSchedule';

type DailyFeedingsState = {
  householdId: string;
  dayStart: number;
  feedings: Feeding[];
  loading: boolean;
  error: string;
};

// Palauttaa nykyisen paikallisen kalenteripäivän alkamisajan.
function getTodayStart(): number {
  return getFeedingDay().start;
}

// Kuuntelee kotitalouden tämän päivän ruokintoja ja vaihtaa kuuntelun
// päivän vaihtuessa. Vapauttaa kuuntelut ja ajastimen käytön päättyessä.
export function useDailyFeedings(householdId: string) {
  const [dayStart, setDayStart] = useState(getTodayStart);

  const [state, setState] = useState<DailyFeedingsState>({
    householdId,
    dayStart,
    feedings: [],
    loading: true,
    error: '',
  });

  useEffect(() => {
    const refreshDay = () => {
      setDayStart(getTodayStart());
    };

    // Tarkistaa päivän vaihtumisen enintään 30 sekunnin välein.
    const timer = setInterval(refreshDay, 30_000);

    // Tarkistaa päivän heti sovelluksen palatessa taustalta.
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        refreshDay();
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;

    setState({
      householdId,
      dayStart,
      feedings: [],
      loading: true,
      error: '',
    });

    const unsubscribe = subscribeToFeedingsForDay(
      householdId,
      new Date(dayStart),
      (feedings) => {
        if (!active) return;

        setState({
          householdId,
          dayStart,
          feedings,
          loading: false,
          error: '',
        });
      },
      (error) => {
        if (!active) return;

        setState({
          householdId,
          dayStart,
          feedings: [],
          loading: false,
          error: `Feedings failed to load (${error.code}).`,
        });
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [householdId, dayStart]);

  // Estää edellisen kotitalouden tai päivän tietojen näyttämisen vaihdon aikana.
  if (
    state.householdId !== householdId ||
    state.dayStart !== dayStart
  ) {
    return {
      dayStart,
      feedings: [] as Feeding[],
      loading: true,
      error: '',
    };
  }

  return {
    dayStart,
    feedings: state.feedings,
    loading: state.loading,
    error: state.error,
  };
}