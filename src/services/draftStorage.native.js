import AsyncStorage from '@react-native-async-storage/async-storage';
export const getItem = key => AsyncStorage.getItem(key);
export const setItem = (key, value) => AsyncStorage.setItem(key, value);
