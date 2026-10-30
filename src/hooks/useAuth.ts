import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../services/auth';

//Seuraa firebase-istunnon kirjautumistilaa. Palauttaa käyttäjätilin kun se on kirjautunut sisään
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); //oletusarvona että lataus on käynnissä

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentuser) => {
      setUser(currentuser);
      setLoading(false); 
    });
    return () => unsubscribe();
  }, []);

  return { user, loading };
}