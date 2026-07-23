// Feature I — getting bytes onto the device in a form the uploader can trust.
//
// Two jobs, both of which exist because of a specific failure:
//
//   1. RESIZE. A modern phone camera produces a 12 MP JPEG of several MB. That
//      travels to Apps Script as base64, inflated by a third. Resizing to
//      1280px at quality 0.6 lands around 200 KB — the difference between a
//      request that completes in a basement and one that times out.
//
//   2. PERSIST. Both the image picker and the manipulator write into the CACHE
//      directory, which Android may reclaim at any time. A queue row pointing
//      at a reclaimed file is a guaranteed permanent failure, discovered hours
//      later when the tech is off site. Everything is copied into the document
//      directory before a row is created.

import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';

import { strokesToPng, type Stroke } from './png';

/** Longest edge, in pixels, after resizing. */
export const PHOTO_MAX_EDGE = 1280;
export const PHOTO_QUALITY = 0.6;
export const PHOTO_MIME = 'image/jpeg';
export const SIGNATURE_MIME = 'image/png';

/** Where durable report media lives, inside the app's document directory. */
const MEDIA_DIR = 'report-media';

function mediaDirectory(): Directory {
  const dir = new Directory(Paths.document, MEDIA_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function uniqueName(extension: string): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
}

export type CaptureResult =
  | { ok: true; uri: string; mime: string }
  // `denied` marks a permission refusal specifically — the caller surfaces those
  // as a persistent "Open Settings" affordance rather than a transient alert,
  // because the fix is in the OS settings, not a retry.
  | { ok: false; error: string; denied?: boolean }
  | { ok: false; cancelled: true };

const CANCELLED: CaptureResult = { ok: false, cancelled: true };

/**
 * Resizes a picked image and copies it somewhere durable.
 *
 * `resize` is given only a width: passing both dimensions would stretch a
 * portrait photo into the landscape box. Height follows the aspect ratio, and
 * an image already narrower than the cap is left alone rather than upscaled
 * into a bigger file than the original.
 */
async function processImage(sourceUri: string, width: number): Promise<{ uri: string; mime: string }> {
  const context = ImageManipulator.ImageManipulator.manipulate(sourceUri);
  if (width > PHOTO_MAX_EDGE) {
    context.resize({ width: PHOTO_MAX_EDGE, height: null });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: ImageManipulator.SaveFormat.JPEG,
    compress: PHOTO_QUALITY,
  });

  // saveAsync writes to the cache — move it out before anything depends on it.
  // move() is async; not awaiting it would let a queue row be created against
  // a file that has not landed yet.
  const destination = new File(mediaDirectory(), uniqueName('jpg'));
  await new File(saved.uri).move(destination);
  return { uri: destination.uri, mime: PHOTO_MIME };
}

export async function capturePhotoFromCamera(): Promise<CaptureResult> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return {
        ok: false,
        denied: true,
        error: 'Camera access is off. Enable it in Settings to photograph equipment.',
      };
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 1, // compress once, during the resize — not twice
    });
    if (result.canceled || !result.assets?.length) return CANCELLED;

    const asset = result.assets[0];
    const processed = await processImage(asset.uri, asset.width);
    return { ok: true, ...processed };
  } catch (e) {
    console.warn('capturePhotoFromCamera failed:', e);
    return { ok: false, error: 'Could not take that photo. Please try again.' };
  }
}

export async function capturePhotoFromLibrary(): Promise<CaptureResult> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return {
        ok: false,
        denied: true,
        error: 'Photo access is off. Enable it in Settings to attach existing photos.',
      };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return CANCELLED;

    const asset = result.assets[0];
    const processed = await processImage(asset.uri, asset.width);
    return { ok: true, ...processed };
  } catch (e) {
    console.warn('capturePhotoFromLibrary failed:', e);
    return { ok: false, error: 'Could not attach that photo. Please try again.' };
  }
}

/**
 * Writes a drawn signature to disk as a PNG.
 *
 * The bytes come from our own encoder (src/report/png.ts), so there is no
 * picker, no permission, and nothing to resize — just base64 straight into a
 * durable file.
 */
export async function writeSignaturePng(
  strokes: readonly Stroke[],
  sourceWidth: number,
  sourceHeight: number,
): Promise<CaptureResult> {
  try {
    const png = strokesToPng(strokes, { sourceWidth, sourceHeight });
    const file = new File(mediaDirectory(), uniqueName('png'));
    file.create();
    // write() takes raw bytes, so the PNG goes to disk exactly as encoded —
    // no base64 round trip, and nothing that could re-encode it lossily.
    file.write(png);
    return { ok: true, uri: file.uri, mime: SIGNATURE_MIME };
  } catch (e) {
    console.warn('writeSignaturePng failed:', e);
    return { ok: false, error: 'Could not save the signature. Please try again.' };
  }
}
