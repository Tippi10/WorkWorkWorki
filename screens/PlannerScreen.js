import { View, Text, StyleSheet } from 'react-native';

export default function PlannerScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Planner</Text>
      <Text style={styles.sub}>每週訓練行程規劃</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  sub: { color: '#888', fontSize: 14, marginTop: 8 },
});
