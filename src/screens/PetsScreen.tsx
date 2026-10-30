import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Komponentti näyttää lemmikkinäkymän. Tähän lisätään myöhemmin
 * käyttäjän lemmikkilista ja lemmikkien hallinta.
 */
export default function PetsScreen() {
  return (
    <SafeAreaView
    style={styles.container}
    edges={['bottom', 'left', 'right']}>
      <Text style={styles.title}>Your Pets</Text>

        <Text style={styles.description}>
            Manage your pets and their feeding schedules here.
        </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 12,
  },
  description: {
    fontSize: 18,
    lineHeight: 26,
    color: '#374151',
  },
});