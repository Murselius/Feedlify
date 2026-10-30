import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import PetsScreen from '../screens/PetsScreen';
import type { RootStackParamList } from './types';

/**
 * Komponentti määrittää sovelluksen Native Stack -navigoinnin,
 * näkymien otsikot ja etusivun aloitusnäkymäksi.
 */
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
    return (
        //initialRouteName määrittää aloitusnäkymäksi "Home"
        <Stack.Navigator initialRouteName="Home">
            <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{ title: 'Feedlify' }}
            />

            <Stack.Screen
                name="Pets"
                component={PetsScreen}
                options={{ title: 'Your Pets' }}
            />
        </Stack.Navigator>
    );
}
