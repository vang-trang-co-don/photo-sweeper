import { useCallback, useEffect, useRef, useState } from 'react';

import * as MediaLibrary from 'expo-media-library';

import { loadNextChunk, type DateRange, type MediaItem } from './library';

export function usePhotoLibrary(range?: DateRange) {
  const [assets, setAssets] = useState<MediaItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const cursorRef = useRef<MediaLibrary.AssetRef | undefined>(undefined);
  const rangeRef = useRef<DateRange | undefined>(range);
  const [rangeVersion, setRangeVersion] = useState(0);

  useEffect(() => {
    if (range?.after !== rangeRef.current?.after || range?.before !== rangeRef.current?.before) {
      rangeRef.current = range;
      cursorRef.current = undefined;
      setAssets([]);
      setTotalCount(0);
      setHasNext(true);
      setIsDone(false);
      setIsLoading(false);
      setRangeVersion((v) => v + 1);
    }
  }, [range]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasNext) {
      return;
    }
    setIsLoading(true);
    try {
      const chunk = await loadNextChunk(cursorRef.current, rangeRef.current);
      cursorRef.current = chunk.hasNext ? chunk.nextCursor : undefined;
      setTotalCount(chunk.totalCount);
      setAssets((prev) => [...prev, ...chunk.items]);
      setHasNext(chunk.hasNext);
      if (!chunk.hasNext) {
        setIsDone(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [hasNext, isLoading]);

  const reset = useCallback(() => {
    cursorRef.current = undefined;
    setAssets([]);
    setTotalCount(0);
    setHasNext(true);
    setIsDone(false);
    setIsLoading(false);
    setRangeVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    loadMore();
  }, [loadMore, rangeVersion]);

  return { assets, totalCount, hasNext, isDone, isLoading, loadMore, reset };
}