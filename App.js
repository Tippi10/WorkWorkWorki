import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { AppProvider } from './context/AppContext';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import HomeScreen from './screens/HomeScreen';
import ClipEditorScreen from './screens/ClipEditorScreen';
import PlannerScreen from './screens/PlannerScreen';
import DepotScreen from './screens/DepotScreen';
import ProfileScreen from './screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="ClipEditor" component={ClipEditorScreen} />
    </HomeStack.Navigator>
  );
}

const icons = {
  Home: '🏠',
  Planner: '📅',
  Depot: '📦',
  Profile: '👤',
};

export default function App() {
  return (
    <AppProvider>
    <NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: '#0d0d0d', card: '#1a1a1a' } }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>
              {icons[route.name]}
            </Text>
          ),
          tabBarLabel: ({ focused }) => (
            <Text style={{ fontSize: 10, color: focused ? '#a78bfa' : '#555', marginBottom: 4 }}>
              {route.name}
            </Text>
          ),
          tabBarStyle: {
            backgroundColor: '#1a1a1a',
            borderTopColor: '#2a2a2a',
            height: 70,
            paddingTop: 8,
          },
          headerShown: false,
        })}
      >
        <Tab.Screen name="Home" component={HomeStackNavigator} />
        <Tab.Screen name="Planner" component={PlannerScreen} />
        <Tab.Screen name="Depot" component={DepotScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
    </AppProvider>
  );
}
