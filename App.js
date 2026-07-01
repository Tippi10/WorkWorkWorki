import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import HomeScreen from './screens/HomeScreen';
import PlannerScreen from './screens/PlannerScreen';
import DepotScreen from './screens/DepotScreen';
import ProfileScreen from './screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const icons = {
  Home: '🏠',
  Planner: '📅',
  Depot: '🗄️',
  Profile: '👤',
};

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>
              {icons[route.name]}
            </Text>
          ),
          tabBarLabel: ({ focused, color }) => (
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
          headerStyle: { backgroundColor: '#0d0d0d' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold', fontSize: 22 },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Planner" component={PlannerScreen} />
        <Tab.Screen name="Depot" component={DepotScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
