import { StatusBar } from 'expo-status-bar';
import { Button, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';

type Purchase = {
  id: number;
  product: string;
  amount: string;
};

export default function App() {
  const [product, setProduct] = useState('');
  const [amount, setAmount] = useState('');
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const handleFetch = async () => {
  };

  const initialize = async () => {
  };

  useEffect(() => {
    void initialize();
  }, []);

  const handleSave = async () => {
  };

  const handleDelete = async (id: number) => {
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#aaa',
    padding: 10,
    marginBottom: 10,
  },
  list: {
    width: '100%',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  title: {
    fontWeight: 'bold',
    fontSize: 20,
    color: 'blue',
    paddingTop: 24,
    paddingBottom: 8,
  },
  itemText: {
    fontSize: 16,
  },
  bought: {
    color: '#0000FF',
  },
});