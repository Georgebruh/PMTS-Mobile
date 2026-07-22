import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { theme } from '../theme';
import { MAX_CREW_NAME, canRemoveCrew } from '../wo/actions';
import type { CrewRecord } from '../wo/types';
import { Card } from './Card';
import { Icon } from './Icon';
import { TextField } from './TextField';

type Props = {
  crew: CrewRecord[];
  /** False for L2 and for work orders past the editable window — read-only roster. */
  editable: boolean;
  /** Returns an error string to display, or null on success. */
  onAdd: (name: string) => Promise<string | null>;
  onRemove: (crewId: string) => Promise<string | null>;
};

// Feature H's crew roster: the free-typed names that cover workers without
// phones. No mockup exists for this card — it reuses the .info-card surface
// and the mockup's field/button metrics.
export function CrewCard({ crew, editable, onAdd, onRemove }: Props) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return; // a double tap must not create two rows
    setBusy(true);
    const result = await onAdd(draft);
    setBusy(false);
    setError(result);
    // Only clear the field on success, so a rejected name stays editable
    // instead of making the user retype it.
    if (result === null) setDraft('');
  };

  const remove = async (crewId: string) => {
    if (busy) return;
    setBusy(true);
    setError(await onRemove(crewId));
    setBusy(false);
  };

  return (
    <Card style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 12, marginTop: 14 }}>
      <Text style={[theme.text.cardLabel, { paddingBottom: 4 }]}>
        Crew{crew.length > 0 ? ` · ${crew.length}` : ''}
      </Text>

      {crew.length === 0 ? (
        <Text style={[theme.text.caption, { paddingVertical: 8 }]}>
          {editable
            ? 'Add the workers who are on this job with you.'
            : 'No crew was recorded for this work order.'}
        </Text>
      ) : (
        crew.map((member, index) => (
          <View
            key={member.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              paddingVertical: 10,
              borderBottomWidth: index === crew.length - 1 ? 0 : 1,
              borderBottomColor: theme.colors.lineFaint,
            }}
          >
            <Icon name="users" size={theme.sizes.iconInline} color={theme.colors.faint} />
            <Text style={[theme.text.body, { flex: 1 }]} numberOfLines={2}>
              {member.workerName}
            </Text>

            {/* Removal disappears once the row has synced: the gateway ignores
                deletes and every pull is a full snapshot, so a removed synced
                row would simply come back. Better no button than one that
                silently undoes itself. */}
            {editable && canRemoveCrew(member) && (
              <Pressable
                onPress={() => remove(member.id)}
                hitSlop={10}
                disabled={busy}
                style={({ pressed }) => ({ opacity: pressed || busy ? 0.5 : 1 })}
              >
                <Icon name="close" size={theme.sizes.iconSmall} color={theme.colors.muted} />
              </Pressable>
            )}
          </View>
        ))
      )}

      {editable && (
        <>
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              marginTop: crew.length > 0 ? 12 : 4,
            }}
          >
            <TextField
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                if (error !== null) setError(null); // typing clears the last complaint
              }}
              placeholder="Add a worker's name"
              onSubmitEditing={submit}
              maxLength={MAX_CREW_NAME}
              editable={!busy}
              invalid={error !== null}
            />
            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => ({
                width: theme.sizes.searchField,
                height: theme.sizes.searchField,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.red,
                borderRadius: theme.radii.md,
                opacity: pressed || busy ? 0.6 : 1,
              })}
            >
              <Icon name="plus" size={theme.sizes.iconSmall} color={theme.colors.white} />
            </Pressable>
          </View>

          {error !== null && (
            <Text style={[theme.text.micro, { color: theme.colors.red, marginTop: 8 }]}>
              {error}
            </Text>
          )}
        </>
      )}
    </Card>
  );
}
