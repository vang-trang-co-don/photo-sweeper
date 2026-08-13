import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Image } from 'expo-image';

interface Props {
  uri: string;
  isVideo: boolean;
  scale: number;
}

/**
 * Static card shown behind the top one. Kept as a plain (non-animated) view so the
 * gesture-driven frames only update a single animated component (the top card).
 */
export const BackCard = memo(function BackCard({ uri, isVideo, scale }: Props) {
  return (
    <View style={[styles.card, { transform: [{ scale }] }]}>
      <Image source={{ uri }} style={styles.image} contentFit="cover" cachePolicy="memory-disk" />
      {isVideo ? (
        <View style={styles.videoBadge}>
          <Text style={styles.videoText}>VIDEO</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#262626',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    right: 12,
    top: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  videoText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
});