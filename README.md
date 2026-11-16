# Feedlify

Feedlify auttaa kotitalouden jäseniä huolehtimaan lemmikkien ruokinnasta yhdessä. Etusivu näyttää käyttäjän kaikkien kotitalouksien lemmikit ja niiden seuraavat ruokinta-ajat.

## Käytetyt teknologiat

- **React Native ja TypeScript** ovat mobiilisovelluksen toteutusteknologiat. Expo tarjoaa kehitysympäristön ja työkalut lemmikkikuvien käsittelyyn.
- **React Navigation** hallitsee sovelluksen näkymiä pinonavigoinnilla.
- **Firebase Authentication** hoitaa kirjautumisen sähköpostilla ja salasanalla.
- **Cloud Firestore** tallentaa kotitaloudet ja niiden lemmikit sekä ruokintamerkinnät. Reaaliaikaiset kuuntelijat päivittävät tiedot jäsenten näytöille.
- **Expo Notifications** ajastaa ruokintamuistutukset laitteella. Erillinen Node.js-prosessi lähettää muille kotitalouden jäsenille ilmoituksen ruokinnasta Firebase Cloud Messagingin kautta.
