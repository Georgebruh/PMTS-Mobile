import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AssetFilter } from '../asset/queries';
import { assetStatusMeta } from '../asset/status';
import { theme } from '../theme';
import { ActionButton, ActionRow } from './ActionRow';

type Props = {
  visible: boolean;
  filter: AssetFilter;
  /** Option lists derived from the LOCKED set, so only reachable values show. */
  types: string[];
  statuses: string[];
  locations: string[];
  onApply: (filter: AssetFilter) => void;
  onClose: () => void;
};

// L2's filter sheet (the mockup's sliders button opens this). Net-new visual.
// Edits a draft copy so dismissing without applying changes nothing.
export function AssetFilterModal({
  visible,
  filter,
  types,
  statuses,
  locations,
  onApply,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<AssetFilter>(filter);

  // Re-seed the draft each time the sheet opens, so a previous cancel never
  // leaks into the next session.
  useEffect(() => {
    if (visible) setDraft(filter);
  }, [visible, filter]);

  const clearAll = () => setDraft({ search: draft.search });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(34,31,31,0.35)', justifyContent: 'flex-end' }}
      >
        {/* Stops taps inside the sheet from dismissing it. */}
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: theme.colors.bg,
            borderTopLeftRadius: theme.radii.xl,
            borderTopRightRadius: theme.radii.xl,
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.lg + insets.bottom,
            maxHeight: '80%',
          }}
        >
          <Text style={[theme.text.screenTitle, { fontSize: 18 }]}>Filter assets</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: theme.spacing.sm }}>
            <OptionGroup
              label="Type"
              options={types.map((value) => ({ value, label: value }))}
              selected={draft.type}
              onSelect={(type) => setDraft((d) => ({ ...d, type }))}
            />
            <OptionGroup
              label="Status"
              options={statuses.map((value) => ({
                value,
                label: assetStatusMeta(value).label,
              }))}
              selected={draft.status}
              onSelect={(status) => setDraft((d) => ({ ...d, status }))}
            />
            <OptionGroup
              label="Location"
              options={locations.map((value) => ({ value, label: value }))}
              selected={draft.location}
              onSelect={(location) => setDraft((d) => ({ ...d, location }))}
            />
          </ScrollView>

          <ActionRow>
            <ActionButton label="Clear all" onPress={clearAll} />
            <ActionButton label="Apply" variant="primary" onPress={() => onApply(draft)} />
          </ActionRow>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type Option = { value: string; label: string };

function OptionGroup({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: Option[];
  selected: string | undefined;
  onSelect: (value: string | undefined) => void;
}) {
  if (options.length === 0) return null;

  return (
    <View style={{ marginTop: theme.spacing.md }}>
      <Text style={theme.text.cardLabel}>{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.sm,
        }}
      >
        {options.map((option) => {
          const active = option.value === selected;
          return (
            <Pressable
              key={option.value}
              // Tapping the active option clears it — no separate "any" chip.
              onPress={() => onSelect(active ? undefined : option.value)}
              style={({ pressed }) => ({
                height: 34,
                borderRadius: theme.radii.pill,
                paddingHorizontal: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? theme.colors.maroonDeep : theme.colors.white,
                borderWidth: 1,
                borderColor: active ? theme.colors.maroonDeep : theme.colors.line,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: theme.fonts.bold,
                  fontSize: 12,
                  color: active ? theme.colors.white : theme.colors.muted,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
