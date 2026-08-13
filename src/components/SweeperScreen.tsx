import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Image } from 'expo-image';

import { BackCard } from './BackCard';
import { MediaItem, DateRange, getMonthIndex, monthLabel, MonthInfo } from '../media/library';
import { useSweepSession } from '../media/useSweepSession';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.32;
const FLING_VELOCITY = 900; // px/s — a fast short flick commits without crossing the threshold
const FLY_DISTANCE = SCREEN_WIDTH * 1.6;

interface TopCardProps {
  item: MediaItem;
  translateX: SharedValue<number>;
}

const TopCard = memo(function TopCard({ item, translateX }: TopCardProps) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${interpolate(translateX.value, [-SCREEN_WIDTH, SCREEN_WIDTH], [-22, 22])}deg` },
    ],
  }));

  const deleteBadge = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SCREEN_WIDTH, -SWIPE_THRESHOLD, 0], [1, 1, 0]),
  }));

  const keepBadge = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD, SCREEN_WIDTH], [0, 1, 1]),
  }));

  return (
    <Animated.View style={[styles.topCard, style]}>
      <Image source={{ uri: item.uri }} style={styles.image} contentFit="cover" />
      <Animated.View style={[styles.badge, styles.deleteBadge, deleteBadge]}>
        <Text style={[styles.badgeText, styles.deleteBadgeText]}>DELETE</Text>
      </Animated.View>
      <Animated.View style={[styles.badge, styles.keepBadge, keepBadge]}>
        <Text style={[styles.badgeText, styles.keepBadgeText]}>KEEP</Text>
      </Animated.View>
      {item.isVideo ? (
        <View style={styles.videoBadge}>
          <Text style={styles.videoText}>VIDEO</Text>
        </View>
      ) : null}
    </Animated.View>
  );
});

export function SweeperScreen() {
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const session = useSweepSession(range);

  const [monthsOpen, setMonthsOpen] = useState(false);
  const [months, setMonths] = useState<MonthInfo[] | null>(null);

  const openMonths = useCallback(async () => {
    setMonthsOpen(true);
    if (months === null) {
      setMonths(await getMonthIndex());
    }
  }, [months]);

  const selectMonth = useCallback((m: MonthInfo) => {
    setRange({ after: m.start, before: m.end });
    setMonthsOpen(false);
  }, []);

  const clearRange = useCallback(() => {
    setRange(undefined);
    setMonthsOpen(false);
  }, []);

  const translateX = useSharedValue(0);

  useEffect(() => {
    if (session.queue.length < 8 && !session.isDone) {
      session.loadMore();
    }
  }, [session.queue.length, session.isDone, session.loadMore]);

  const top = session.top;

  useEffect(() => {
    const next = session.queue[1]?.uri;
    const after = session.queue[2]?.uri;
    if (next) {
      Image.prefetch(next).catch(() => {});
    }
    if (after) {
      Image.prefetch(after).catch(() => {});
    }
  }, [top?.id, session.queue]);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const topRef = useRef<MediaItem | undefined>(top);
  topRef.current = top;

  const onSwipeDecision = useCallback(
    (toRight: boolean) => {
      const item = topRef.current;
      if (!item) return;
      translateX.value = 0;
      if (toRight) sessionRef.current.swipeKeep(item);
      else sessionRef.current.swipeDelete(item);
    },
    [translateX]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onChange((e) => {
          translateX.value += e.changeX;
        })
        .onEnd((e) => {
          /**
           * Commit the card: fly it off to `targetX`. Duration is scaled by the
           * current velocity so a fast flick keeps its inertia and drifts off,
           * while a slow drag glides at a comfortable pace.
           */
          const done = (toRight: boolean, velocity: number) => {
            const targetX = (toRight ? 1 : -1) * FLY_DISTANCE;
            const distance = Math.abs(targetX - translateX.value);
            const duration = Math.max(
              120,
              Math.min(420, (distance / Math.max(Math.abs(velocity), 500)) * 700)
            );
            translateX.value = withTiming(
              targetX,
              { duration, easing: Easing.out(Easing.quad) },
              (finished) => {
                if (finished) {
                  runOnJS(onSwipeDecision)(toRight);
                }
              }
            );
          };

          const tx = translateX.value;
          const vx = e.velocityX;
          const reachedThreshold = Math.abs(tx) > SWIPE_THRESHOLD;
          const enoughVelocity = Math.abs(vx) > FLING_VELOCITY && Math.sign(tx) === Math.sign(vx) && tx !== 0;

          if (reachedThreshold || enoughVelocity) {
            done(vx > 0, vx);
          } else {
            translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
          }
        }),
    [onSwipeDecision, translateX]
  );

  const back1 = session.queue[1];
  const back2 = session.queue[2];

  const totalSeen = session.stats.deleted + session.stats.kept + session.queue.length;
  const filterLabel = range?.after ? monthLabel(range.after) : 'all photos';

  if (!top) {
    if (session.isLoading) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.subtitle}>Loading…</Text>
        </View>
      );
    }
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.title}>Done — library reviewed!</Text>
        <Text style={styles.subtitle}>
          Deleted: {session.stats.deleted} · Kept: {session.stats.kept}
          {session.stats.failed > 0 ? ` · Failed: ${session.stats.failed}` : ''}
        </Text>
        <Text style={styles.hint}>
          Deleted photos are in the Photos app's Recently Deleted and can be recovered there.
        </Text>
        <Pressable style={styles.doneButton} onPress={openMonths}>
          <Text style={styles.doneButtonText}>Switch month</Text>
        </Pressable>
        <MonthPickerModal
          visible={monthsOpen}
          months={months}
          loading={months !== null ? false : true}
          onSelect={selectMonth}
          onAll={clearRange}
          onClose={() => setMonthsOpen(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headRow}>
        <Text style={styles.header}>
          {totalSeen} reviewed
        </Text>
        <Pressable style={styles.monthButton} onPress={openMonths}>
          <Text style={styles.monthButtonText}>
            {range ? 'Month ▾' : 'All'}
          </Text>
        </Pressable>
      </View>
      {range ? <Text style={styles.monthCaption}>viewing {filterLabel}</Text> : null}
      <View style={styles.stack}>
        {back2 ? (
          <View style={styles.cardSlot}>
            <BackCard uri={back2.uri} isVideo={back2.isVideo} scale={0.84} />
          </View>
        ) : null}
        {back1 ? (
          <View style={styles.cardSlot}>
            <BackCard uri={back1.uri} isVideo={back1.isVideo} scale={0.92} />
          </View>
        ) : null}
        {top ? (
          <GestureDetector gesture={pan} key={top.id}>
            <View style={styles.cardSlot}>
              <TopCard item={top} translateX={translateX} />
            </View>
          </GestureDetector>
        ) : null}
      </View>
      <View style={styles.footer}>
        {session.stats.failed > 0 ? (
          <Text style={[styles.footerText, styles.failedText]}>
            {session.stats.failed} failed to delete
          </Text>
        ) : (
          <Text style={styles.footerText}>swipe ← DELETE</Text>
        )}
        <View style={styles.footerRight}>
          {session.pendingCount > 0 ? (
            <Pressable onPress={session.undo} hitSlop={8}>
              <Text style={[styles.footerText, styles.undoText]}>undo</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[
              styles.commitButton,
              session.pendingCount === 0 && styles.commitButtonDisabled,
            ]}
            onPress={session.commitDelete}
            disabled={session.pendingCount === 0 || session.committing}
          >
            <Text style={styles.commitButtonText}>
              {session.committing
                ? 'Deleting…'
                : `Delete ${session.pendingCount}`}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.footerText}>swipe → KEEP</Text>
      </View>
      <MonthPickerModal
        visible={monthsOpen}
        months={months}
        loading={months === null}
        onSelect={selectMonth}
        onAll={clearRange}
        onClose={() => setMonthsOpen(false)}
      />
    </View>
  );
}

interface MonthPickerModalProps {
  visible: boolean;
  months: MonthInfo[] | null;
  loading: boolean;
  onSelect: (m: MonthInfo) => void;
  onAll: () => void;
  onClose: () => void;
}

function MonthPickerModal({ visible, months, loading, onSelect, onAll, onClose }: MonthPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <Text style={styles.modalTitle}>Pick a month</Text>
          <Pressable style={styles.monthRow} onPress={onAll}>
            <Text style={styles.monthRowLabel}>All photos</Text>
            <Text style={styles.monthRowCount} />
          </Pressable>
          {loading ? (
            <Text style={styles.monthRowLabel}>Loading…</Text>
          ) : (
            <FlatList
              data={months ?? []}
              keyExtractor={(m) => m.key}
              renderItem={({ item }) => (
                <Pressable style={styles.monthRow} onPress={() => onSelect(item)}>
                  <Text style={styles.monthRowLabel}>{item.label}</Text>
                  <Text style={styles.monthRowCount}>{item.count}</Text>
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 72,
    paddingHorizontal: 16,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthButton: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  monthButtonText: {
    color: '#5aa9ff',
    fontSize: 14,
    fontWeight: '700',
  },
  monthCaption: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginTop: -6,
    marginBottom: 12,
  },
  doneButton: {
    marginTop: 24,
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  doneButtonText: {
    color: '#5aa9ff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  monthRowLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  monthRowCount: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  stack: {
    flex: 1,
    position: 'relative',
  },
  cardSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 140,
  },
  topCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 24,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 3,
  },
  deleteBadge: {
    left: 20,
    borderColor: '#ff4757',
    backgroundColor: 'rgba(255,71,87,0.15)',
  },
  keepBadge: {
    right: 20,
    borderColor: '#2ecc71',
    backgroundColor: 'rgba(46,204,113,0.15)',
  },
  badgeText: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 2,
  },
  deleteBadgeText: {
    color: '#ff4757',
  },
  keepBadgeText: {
    color: '#2ecc71',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 40,
    paddingHorizontal: 4,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commitButton: {
    backgroundColor: '#ff4757',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 12,
  },
  commitButtonDisabled: {
    backgroundColor: '#3a3a3c',
  },
  commitButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  footerText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  failedText: {
    color: '#ff4757',
  },
  undoText: {
    color: '#5aa9ff',
    textDecorationLine: 'underline',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  hint: {
    color: '#555',
    fontSize: 12,
    marginTop: 20,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});