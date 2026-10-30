import { Button, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;


// Komponentti näyttää sovelluksen etusivun ja painikkeen jolla käyttäjä siirtyy lemmikkinäkymään.

export default function HomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}
        edges={['bottom', 'left', 'right']}>
        <Text style={styles.title}>Feedlify</Text>

        <Text style={styles.description}>
          Keeping your pets fed on time
        </Text>

        <Button
          title="Show Pets"
          onPress={() => navigation.navigate('Pets')}
        />
    </SafeAreaView>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 12,
  },
  description: {
    fontSize: 18,
    lineHeight: 26,
    color: '#374151',
    marginBottom: 24,
  },
});