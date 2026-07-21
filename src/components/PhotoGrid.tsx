import { Image, Pressable, Text, View } from 'react-native';

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
export function PhotoGrid({ photos, editable, onAdd, onRemove, busy = false }: Props) {
  const canAdd = editable && photos.length < MAX_PHOTOS && !busy;

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

            <UploadBadge state={photo.state} />

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
    </Card>
  );
}

/**
 * Upload state, shown only when it is not the boring case. An uploaded photo
 * gets no badge: a green tick on every thumbnail would train people to ignore
 * the corner where the genuinely important warning appears.
 */
function UploadBadge({ state }: { state: string }) {
  if (state === UPLOAD_STATE.UPLOADED) return null;

  const failed = state === UPLOAD_STATE.FAILED;
  return (
    <View
      style={{
        position: 'absolute',
        left: 4,
        bottom: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: theme.radii.pill,
        backgroundColor: failed ? theme.colors.red : theme.colors.ink,
      }}
    >
      <Icon name={failed ? 'warning' : 'upload'} size={10} color={theme.colors.white} />
      <Text style={[theme.text.micro, { color: theme.colors.white, fontSize: 9 }]}>
        {failed ? 'Failed' : 'Queued'}
      </Text>
    </View>
  );
}
