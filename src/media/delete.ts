import * as MediaLibrary from 'expo-media-library';

export interface DeleteResult {
  deleted: string[];
  failed: string[];
}

/**
 * Deletes multiple assets in a single native call, so iOS shows only ONE
 * confirmation dialog for the whole batch.
 * iOS keeps deleted photos in "Recently Deleted" as a safety net.
 */
export async function deleteAssets(ids: string[]): Promise<DeleteResult> {
  if (ids.length === 0) {
    return { deleted: [], failed: [] };
  }
  try {
    const ok = await MediaLibrary.deleteAssetsAsync(ids);
    return ok ? { deleted: ids, failed: [] } : { deleted: [], failed: ids };
  } catch {
    return { deleted: [], failed: ids };
  }
}