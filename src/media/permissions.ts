import * as MediaLibrary from 'expo-media-library';

export type PhotoAccess = 'full' | 'limited' | 'denied' | 'undetermined';

export async function getPhotoAccess(): Promise<PhotoAccess> {
  const { status, accessPrivileges } = await MediaLibrary.getPermissionsAsync();
  if (status === 'granted') {
    return accessPrivileges === 'limited' ? 'limited' : 'full';
  }
  if (status === 'undetermined') {
    return 'undetermined';
  }
  return 'denied';
}

export async function requestPhotoAccess(): Promise<PhotoAccess> {
  const { status, accessPrivileges } = await MediaLibrary.requestPermissionsAsync();
  if (status === 'granted') {
    return accessPrivileges === 'limited' ? 'limited' : 'full';
  }
  if (status === 'undetermined') {
    return 'undetermined';
  }
  return 'denied';
}