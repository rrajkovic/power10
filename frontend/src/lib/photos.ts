import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

// Proof photos for a workout: picking them, having the AI read them to fill
// in the form, and uploading them with the saved session.
//
// The AI runs in Supabase Edge Functions (supabase/functions), never in the
// app, so the API key stays on the server.

export const MAX_PHOTOS = 6;
// Photos are shrunk so the longest side is at most this many pixels: plenty
// to read a screen, and a fraction of the upload size.
const MAX_SIDE = 1600;

export type WorkoutPhoto = {
  // Where the shrunk copy lives on this device (for the thumbnail).
  uri: string;
  // The same image as text, for sending to the server.
  base64: string;
  // Gallery photos are marked for admins: they weren't taken just now.
  source: 'camera' | 'gallery';
};

async function shrink(asset: ImagePicker.ImagePickerAsset, source: WorkoutPhoto['source']) {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_SIDE) {
    context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return { uri: saved.uri, base64: saved.base64!, source } satisfies WorkoutPhoto;
}

// Opens the camera or the photo library. Returns [] if the person cancels,
// and throws a readable message if permission was refused.
export async function pickPhotos(from: WorkoutPhoto['source'], limit: number): Promise<WorkoutPhoto[]> {
  let result: ImagePicker.ImagePickerResult;
  if (from === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Allow camera access in Settings to take a photo.');
    }
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  } else {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit,
    });
  }
  if (result.canceled) return [];
  return Promise.all(result.assets.slice(0, limit).map((asset) => shrink(asset, from)));
}

// One workout the AI found in the photos. Photos of the same activity are
// already added together (see supabase/functions/_shared/group.ts). Anything
// it couldn't read is null.
export type ReadSession = {
  activity_type_id: string | null;
  intensity_id: string | null;
  seconds: number;
  distance_meters: number | null;
  date: string | null;
  // 1 to 10: how sure the AI is that it read the screen correctly.
  confidence: number;
  // True when that's too low to trust; a coach will be asked to look.
  low_confidence: boolean;
  // Which photos belong to this workout (positions in the list that was sent).
  photos: number[];
};

export type PhotoRead = {
  sessions: ReadSession[];
  // Photos nothing could be read from.
  unread: number[];
};

async function functionError(error: unknown, fallback: string): Promise<Error> {
  // The function's own message ("The photo reader is busy…") is in the response body.
  const response = (error as { context?: Response }).context;
  const body = await response?.json?.().catch(() => null);
  return new Error(typeof body?.error === 'string' ? body.error : fallback);
}

export async function readWorkoutPhotos(teamId: string, photos: WorkoutPhoto[]): Promise<PhotoRead> {
  const { data, error } = await supabase.functions.invoke<PhotoRead>('read-workout-photo', {
    body: {
      team_id: teamId,
      photos: photos.map((photo) => ({ mimeType: 'image/jpeg', base64: photo.base64 })),
    },
  });
  if (error || !data) {
    throw await functionError(error, 'Couldn’t read the photo. You can still type it in.');
  }
  return data;
}

function toBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Stores the photos with a saved session. The database then queues an AI
// check for the session.
export async function uploadSessionPhotos(teamId: string, sessionId: string, photos: WorkoutPhoto[]) {
  for (const [index, photo] of photos.entries()) {
    const path = `${teamId}/${sessionId}/${index + 1}.jpg`;
    const upload = await supabase.storage
      .from('session-photos')
      .upload(path, toBytes(photo.base64).buffer as ArrayBuffer, { contentType: 'image/jpeg' });
    if (upload.error) throw upload.error;

    const { error } = await supabase
      .from('session_photos')
      .insert({ team_id: teamId, session_id: sessionId, storage_path: path, source: photo.source });
    if (error) throw error;
  }
}

// Asks the server to check the session against its photos. We don't wait:
// the workout already counts, and the result shows up later.
export function requestVerification(sessionId: string) {
  supabase.functions
    .invoke('verify-session', { body: { session_id: sessionId } })
    .catch((error) => console.warn('Could not start the photo check', error));
}
