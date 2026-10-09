import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { PlannerProvider } from '../state/PlannerProvider';
import { palette } from '../components/ui';
export default function Layout() {
  return <PlannerProvider><StatusBar style="dark" /><Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: palette.green, tabBarInactiveTintColor: palette.muted, tabBarStyle: { backgroundColor: palette.paper, borderTopColor: palette.line }, tabBarLabelStyle: { fontWeight: '600', fontSize: 11 } }}>
    {[['index', 'Today', '◉'], ['week', 'Week', '▦'], ['tasks', 'Tasks', '✓'], ['assistant', 'AI', '✦'], ['settings', 'Settings', '⚙']].map(([name, title, icon]) => <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>{icon}</Text> }} />)}
  </Tabs></PlannerProvider>;
}
