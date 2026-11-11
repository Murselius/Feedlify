import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Kuuntelee käynnistyksen jälkeen kirjattuja ruokintoja ja käsittelee ne järjestyksessä.
async function watchFeedings(
  db: Firestore,
  sendFeeding: (feedingId: string) => Promise<void>,
): Promise<void> {
  const feedings = db.collection('feedings');
  const baseline = await feedings.select().limit(1).get();
  const query = feedings.where('fedAt', '>', baseline.readTime);

  const handled = new Set<string>();
  let pending = Promise.resolve();
  let ready = false;

  await new Promise<void>((resolve, reject) => {
    const unsubscribe = query.onSnapshot(
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const id = change.doc.id;
          if (change.type !== 'added' || handled.has(id)) continue;

          handled.add(id);
          pending = pending
            .then(() => sendFeeding(id))
            .catch((error: unknown) => {
              console.error(`Ruokinnan ${id} lähetys epäonnistui.`, error);
            });
        }

        if (!ready) {
          ready = true;
          console.log('Kuuntelu käynnissä. Voit nyt painaa Feed.');
        }
      },
      (error) => {
        process.off('SIGINT', stop);
        void pending.then(() => reject(error));
      },
    );

    function stop() {
      unsubscribe();
      console.log('Kuuntelu lopetetaan.');
      void pending.then(resolve);
    }

    process.once('SIGINT', stop);
  });
}

// Tarkistaa yhden ruokinnan vastaanottajat ja näyttää laitteiden määrän.
async function main() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const argument = process.argv[2]?.trim();
  const watchMode = argument === '--watch';

  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT puuttuu tästä PowerShell-ikkunasta.');
  }

  if (!argument || argument.includes('/')) {
    throw new Error('Anna ruokintadokumentin tunniste tai --watch.');
  }

  const app = initializeApp({ projectId, credential: applicationDefault() });
  const db = getFirestore(app);

  async function processFeeding(feedingId: string, send: boolean): Promise<void> {
    const feeding = (await db.collection('feedings').doc(feedingId).get()).data();
    if (!feeding) throw new Error('Ruokintaa ei löytynyt. Tarkista dokumentin tunniste.');

    const { householdId, petId, fedBy } = feeding;
    if (!householdId || !petId || !fedBy) {
      throw new Error('Ruokinnasta puuttuu kotitalous, lemmikki tai ruokkija.');
    }

    const [householdDoc, petDoc] = await Promise.all([
      db.collection('households').doc(householdId).get(),
      db.collection('pets').doc(petId).get(),
    ]);

    const household = householdDoc.data();
    const pet = petDoc.data();

    if (!household || household.isDeleting || !Array.isArray(household.memberIds)) {
      throw new Error('Aktiivista kotitaloutta tai sen jäsenlistaa ei löytynyt.');
    }

    if (!pet || pet.isDeleting || pet.householdId !== householdId) {
      throw new Error('Lemmikkiä ei löytynyt tästä kotitaloudesta.');
    }

    const recipients = new Set<string>(household.memberIds);
    recipients.delete(fedBy);

    const tokens = new Set<string>();
    let membersWithDevices = 0;

    for (const userId of recipients) {
      const devices = await db.collection('users').doc(userId).collection('pushDevices').get();
      let hasDevice = false;

      for (const device of devices.docs) {
        const { platform, token } = device.data();

        if (platform === 'android' && typeof token === 'string' && token.length > 0) {
          tokens.add(token);
          hasDevice = true;
        }
      }

      if (hasDevice) membersWithDevices++;
    }

    console.log(`Lemmikki: ${pet.name}`);
    console.log(`Muita kotitalouden jäseniä: ${recipients.size}`);
    console.log(`Jäseniä, joilla on Android-laite: ${membersWithDevices}`);
    console.log(`Vastaanottavia laitteita: ${tokens.size}`);

    if (!send) return;

    if (tokens.size === 0) {
      console.log('Ei rekisteröityjä vastaanottajia. Lähetys ohitettiin.');
      return;
    }

    const messaging = getMessaging(app);
    let accepted = 0;

    for (const token of tokens) {
      try {
        await messaging.send({
          token,
          notification: {
            title: 'Feedlify',
            body: `${pet.name} has been fed.`,
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'feeding-reminders',
              tag: feedingId,
            },
          },
        });

        accepted++;
      } catch (error) {
        const code = error instanceof Error && 'code' in error
          ? String(error.code)
          : 'unknown';

        console.error(`FCM-lähetys epäonnistui (${code}).`);
        process.exitCode = 1;
      }
    }

    console.log(`FCM hyväksyi ${accepted}/${tokens.size} ilmoitusta.`);
  }

  try {
    if (watchMode) {
      await watchFeedings(db, (id) => processFeeding(id, true));
    } else {
      await processFeeding(argument, process.argv[3] === '--send');
    }
  } finally {
    await db.terminate();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});