import { Image, Linking, Pressable, Text, View } from 'react-native';

import { MAX_PHOTOS } from '../report/validation';
import type { UploadRecord } from '../report/types';
import { UPLOAD_STATE } from '../report/uploads';
import { theme } from '../theme';
import { Card } from './Card';
import { Icon } from './Icon';

type Props = {
  photos: UploadRecord[];
  editable: boolean;
  onAdd: () => void;
  onRemove: (uploadId: string) => void;
  /** Requeues a failed upload. Available even when the report is read-only —
   *  see retryUpload(): submit does not wait for Drive, so a submitted report
   *  is exactly when a stuck file most needs a way out. */
  onRetry: (uploadId: string) => void;
  /**
   * Feature N — a permission refusal from the last camera/library attempt. Shown
   * as a persistent inline message with an Open Settings link, because unlike a
   * transient alert the fix lives in the OS settings and the user needs the path
   * to it in front of them. Null when the last attempt was fine.
   */
  permissionMessage?: string | null;
  busy?: boolean;
};

const TILE = 96;

/**
 * Feature I's photo strip. No mockup exists for it — built from the shipped
 * card surface and tile metrics, like the crew card before it.
 *
 * Every thumbnail renders from the LOCAL file, never from the Drive URL: the
 * local copy is always present, works offline, and is the only thing that
 * exists before an upload succeeds. The badge is what communicates upload
 * state; the picture never changes.
 */
export function PhotoGrid({
  photos,
  editable,
  onAdd,
  onRemove,
  onRetry,
  permissionMessage = null,
  busy = false,
}: Props) {
  const canAdd = editable && photos.length < MAX_PHOTOS && !busy;
  const anyFailed = photos.some((p) => p.state === UPLOAD_STATE.FAILED);

  return (
    <Card style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 12, marginTop: 14 }}>
      <Text style={[theme.text.cardLabel, { paddingBottom: 8 }]}>
        Photos{photos.length > 0 ? ` · ${photos.length} of ${MAX_PHOTOS}` : ' · optional'}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {photos.map((photo) => (
          <View key={photo.id}>
            <Image
              source={{ uri: photo.localUri }}
              style={{
                width: TILE,
                height: TILE,
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.bg,
              }}
              resizeMode="cover"
            />

            <UploadBadge
              state={photo.state}
              busy={busy}
              onRetry={() => onRetry(photo.id)}
            />

            {editable && (
              <Pressable
                onPress={() => onRemove(photo.id)}
                hitSlop={8}
                disabled={busy}
                style={({ pressed }) => ({
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 24,
                  height: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radii.pill,
                  backgroundColor: theme.colors.ink,
                  opacity: pressed || busy ? 0.5 : 1,
                })}
              >
                <Icon name="close" size={12} color={theme.colors.white} />
              </Pressable>
            )}
          </View>
        ))}

        {canAdd && (
          <Pressable
            onPress={onAdd}
            style={({ pressed }) => ({
              width: TILE,
              height: TILE,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.colors.line,
              backgroundColor: pressed ? theme.colors.bg : theme.colors.white,
            })}
          >
            <Icon name="camera" size={theme.sizes.iconSmall} color={theme.colors.muted} />
            <Text style={theme.text.micro}>Add</Text>
          </Pressable>
        )}
      </View>

      {photos.length === 0 && !editable && (
        <Text style={[theme.text.caption, { paddingVertical: 4 }]}>
          No photos were attached to this report.
        </Text>
      )}

      {anyFailed && (
        <Text style={[theme.text.micro, { color: theme.colors.red, marginTop: 8 }]}>
          A photo could not be uploaded. Tap its red badge to try again once you have a
          signal.
        </Text>
      )}

      {permissionMessage !== null && (
        <View style={{ marginTop: 8, gap: 4 }}>
          <Text style={[theme.text.micro, { color: theme.colors.red }]}>{permissionMessage}</Text>
          <Pressable onPress={() => void Linking.openSettings()} hitSlop={6}>
            {({ pressed }) => (
              <Text
                style={[
                  theme.text.micro,
                  {
                    color: theme.colors.maroon,
                    fontFamily: theme.fonts.bold,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                Open Settings
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </Card>
  );
}

/**
 * Upload state, shown only when it is not the boring case. An uploaded photo
 * gets no badge: a green tick on every thumbnail would train people to ignore
 * the corner where the genuinely important warning appears.
 *
 * A failed badge is TAPPABLE and says so. The state it reports is otherwise a
 * dead end — the queue stops retrying by itself after MAX_UPLOAD_ATTEMPTS, and
 * on a submitted report the remove button is gone too, so this badge is the
 * only way back.
 */
function UploadBadge({
  state,
  busy,
  onRetry,
}: {
  state: string;
  busy: boolean;
  onRetry: () => void;
}) {
  if (state === UPLOAD_STATE.UPLOADED) return null;

  const failed = state === UPLOAD_STATE.FAILED;

  const body = (pressed: boolean) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: theme.radii.pill,
        backgroundColor: failed ? theme.colors.red : theme.colors.ink,
        opacity: pressed || (failed && busy) ? 0.5 : 1,
      }}
    >
      <Icon name={failed ? 'warning' : 'upload'} size={10} color={theme.colors.white} />
      <Text style={[theme.text.micro, { color: theme.colors.white, fontSize: 9 }]}>
        {failed ? 'Retry' : 'Queued'}
      </Text>
    </View>
  );

  if (!failed) {
    return <View style={{ position: 'absolute', left: 4, bottom: 4 }}>{body(false)}</View>;
  }

  return (
    <Pressable
      onPress={onRetry}
      disabled={busy}
      hitSlop={8}
      style={{ position: 'absolute', left: 4, bottom: 4 }}
    >
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}
