import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SweeperScreen } from './src/components/SweeperScreen';
import { getPhotoAccess, requestPhotoAccess, type PhotoAccess } from './src/media/permissions';

export default function App() {
  const [access, setAccess] = useState<PhotoAccess | 'checking'>('checking');
  const [isRequesting, setIsRequesting] = useState(false);

  const refresh = useCallback(async () => {
    setAccess(await getPhotoAccess());
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const onRequest = useCallback(async () => {
    setIsRequesting(true);
    try {
      const next = await requestPhotoAccess();
      setAccess(next);
      if (next === 'limited') {
        Linking.openSettings();
      }
    } finally {
      setIsRequesting(false);
    }
  }, []);

  if (access === 'checking') {
    return (
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.screen}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      </GestureHandlerRootView>
    );
  }

  if (access === 'full') {
    return (
      <GestureHandlerRootView style={styles.root}>
        <SweeperScreen />
      </GestureHandlerRootView>
    );
  }

  const isLimited = access === 'limited';
  const isDenied = access === 'denied';

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.screen}>
        <Text style={styles.title}>photo-sweeper</Text>
        <Text style={styles.subtitle}>
          {isLimited
            ? 'Your photo access is limited. To delete photos you must grant Full Access (All Photos).'
            : isDenied
              ? 'Photo access was denied. Enable it in Settings to continue.'
              : 'Swipe left to delete, swipe right to keep. Grant photo access to begin.'}
        </Text>

        {isLimited ? (
          <>
            <Pressable style={styles.button} onPress={() => Linking.openSettings()}>
              <Text style={styles.buttonText}>Open Settings</Text>
            </Pressable>
            <Text style={styles.hint}>
              Settings → Privacy & Security → Photos → photo-sweeper → All Photos
            </Text>
          </>
        ) : isDenied ? (
          <Pressable style={styles.button} onPress={() => Linking.openSettings()}>
            <Text style={styles.buttonText}>Open Settings</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.button} onPress={onRequest} disabled={isRequesting}>
            <Text style={styles.buttonText}>{isRequesting ? 'Requesting…' : 'Allow Photos'}</Text>
          </Pressable>
        )}

        {isDenied || isLimited ? (
          <Pressable style={styles.link} onPress={refresh}>
            <Text style={styles.linkText}>I enabled it — check again</Text>
          </Pressable>
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    color: '#aaa',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 28,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#2ecc71',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
  hint: {
    color: '#777',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  link: {
    marginTop: 20,
  },
  linkText: {
    color: '#5aa9ff',
    fontSize: 14,
    textAlign: 'center',
  },
});