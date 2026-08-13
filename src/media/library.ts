import * as MediaLibrary from 'expo-media-library';

export interface MediaItem {
  id: string;
  uri: string;
  isVideo: boolean;
  createdAt: number;
}

export interface DateRange {
  after?: number;
  before?: number;
}

export interface Chunk {
  items: MediaItem[];
  hasNext: boolean;
  nextCursor?: MediaLibrary.AssetRef;
  totalCount: number;
}

export interface MonthInfo {
  key: string;
  label: string;
  start: number;
  end: number;
  count: number;
}

const PAGE_SIZE = 50;
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function startOfMonth(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function nextMonthStart(startTs: number): number {
  const d = new Date(startTs);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}

function prevMonthStart(startTs: number): number {
  const d = new Date(startTs);
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
}

export function monthLabel(startTs: number): string {
  const d = new Date(startTs);
  return `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
}

function monthKey(startTs: number): string {
  const d = new Date(startTs);
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

export async function loadNextChunk(cursor: MediaLibrary.AssetRef | undefined, range?: DateRange): Promise<Chunk> {
  const page = await MediaLibrary.getAssetsAsync({
    mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    first: PAGE_SIZE,
    after: cursor,
    createdAfter: range?.after,
    createdBefore: range?.before,
  });

  const items: MediaItem[] = page.assets.map((asset) => ({
    id: asset.id,
    uri: asset.uri,
    isVideo: asset.mediaType === MediaLibrary.MediaType.video,
    createdAt: asset.creationTime,
  }));

  return {
    items,
    hasNext: page.hasNextPage,
    nextCursor: page.endCursor,
    totalCount: page.totalCount,
  };
}

/**
 * Builds a newest-first index of months that contain photos/videos, with counts.
 */
export async function getMonthIndex(): Promise<MonthInfo[]> {
  const [newestPage, oldestPage] = await Promise.all([
    MediaLibrary.getAssetsAsync({
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      first: 1,
    }),
    MediaLibrary.getAssetsAsync({
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      sortBy: [[MediaLibrary.SortBy.creationTime, true]],
      first: 1,
    }),
  ]);

  const newestTs = newestPage.assets[0]?.creationTime;
  const oldestTs = oldestPage.assets[0]?.creationTime;
  if (!newestTs || !oldestTs) {
    return [];
  }

  const months: MonthInfo[] = [];
  let cur = startOfMonth(newestTs);
  const last = startOfMonth(oldestTs);

  while (cur >= last) {
    const end = nextMonthStart(cur);
    const page = await MediaLibrary.getAssetsAsync({
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      first: 1,
      createdAfter: cur,
      createdBefore: end,
    });
    if (page.totalCount > 0) {
      months.push({ key: monthKey(cur), label: monthLabel(cur), start: cur, end, count: page.totalCount });
    }
    cur = prevMonthStart(cur);
  }

  return months;
}