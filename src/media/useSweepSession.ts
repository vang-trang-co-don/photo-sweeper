import { useCallback, useEffect, useRef, useState } from 'react';

import { usePhotoLibrary } from './usePhotoLibrary';
import { deleteAssets } from './delete';
import type { DateRange, MediaItem } from './library';

export interface SessionStats {
  deleted: number;
  kept: number;
  failed: number;
}

/**
 * Swiped-to-delete items sit in a pending buffer. Nothing is deleted until the
 * user presses "Commit". If the app is closed before committing, the photos are
 * untouched and simply reappear on the next session.
 */
export function useSweepSession(range?: DateRange) {
  const { assets, isDone, isLoading, loadMore, reset } = usePhotoLibrary(range);

  const [queue, setQueue] = useState<MediaItem[]>([]);
  const [kept, setKept] = useState<MediaItem[]>([]);
  const [deletedCount, setDeletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [pending, setPending] = useState<MediaItem[]>([]);
  const [committing, setCommitting] = useState(false);

  const assetsRef = useRef<MediaItem[]>([]);
  const pendingRef = useRef<MediaItem[]>([]);
  const committingRef = useRef(false);

  /**
   * When the active month range changes, drop everything so the queue
   * starts fresh inside the newly selected month.
   */
  const prevRangeRef = useRef<DateRange | undefined>(range);
  useEffect(() => {
    if (
      prevRangeRef.current?.after !== range?.after ||
      prevRangeRef.current?.before !== range?.before
    ) {
      prevRangeRef.current = range;
      setQueue([]);
      setKept([]);
      setDeletedCount(0);
      setFailedCount(0);
      pendingRef.current = [];
      setPending([]);
      setCommitting(false);
      committingRef.current = false;
    }
  }, [range]);

  useEffect(() => {
    assetsRef.current = assets;
    setQueue((prev) => {
      const existing = new Set(prev.map((a) => a.id));
      const fresh = assets.filter((a) => !existing.has(a.id));
      return fresh.length > 0 ? [...prev, ...fresh] : prev;
    });
  }, [assets]);

  const top = queue[0];

  const advance = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  /**
   * Deletes the whole pending batch in a single native call, so iOS shows only
   * one confirmation dialog for the entire batch. iOS keeps deleted photos in
   * "Recently Deleted" as a safety net.
   */
  const commitDelete = useCallback(async () => {
    if (committingRef.current) return;
    const batch = pendingRef.current;
    if (batch.length === 0) return;

    committingRef.current = true;
    setCommitting(true);

    try {
      const result = await deleteAssets(batch.map((a) => a.id));
      if (result.failed.length > 0) {
        setFailedCount((c) => c + result.failed.length);
      }
      if (result.deleted.length > 0) {
        setDeletedCount((c) => c + result.deleted.length);
      }
    } catch {
      setFailedCount((c) => c + batch.length);
    } finally {
      pendingRef.current = [];
      setPending([]);
      committingRef.current = false;
      setCommitting(false);
    }
  }, []);

  const swipeKeep = useCallback(
    (item: MediaItem) => {
      setKept((prev) => [...prev, item]);
      advance();
    },
    [advance]
  );

  const swipeDelete = useCallback(
    (item: MediaItem) => {
      advance();
      pendingRef.current = [...pendingRef.current, item];
      setPending(pendingRef.current);
    },
    [advance]
  );

  const undo = useCallback(() => {
    const last = pendingRef.current[pendingRef.current.length - 1];
    if (!last) return;
    pendingRef.current = pendingRef.current.slice(0, -1);
    setPending(pendingRef.current);
    setQueue((prev) => [last, ...prev]);
  }, []);

  return {
    top,
    queue,
    kept,
    pendingCount: pending.length,
    committing,
    stats: { deleted: deletedCount, kept: kept.length, failed: failedCount },
    isDone,
    isLoading,
    loadMore,
    reset,
    assetsLoaded: assetsRef.current.length,
    swipeKeep,
    swipeDelete,
    undo,
    commitDelete,
  };
}
