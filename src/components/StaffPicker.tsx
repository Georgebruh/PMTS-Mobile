import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { UserRecord } from '../staff/types';
import { theme } from '../theme';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

type Props = {
  visible: boolean;
  staff: UserRecord[];
  /** Highlighted with a tick — the reassignment case. */
  currentAssigneeId?: string | null;
  onPick: (staffId: string) => void;
  onClose: () => void;
  busy?: boolean;
};

/**
 * Bottom-sheet picker of the maintenance staff eligible for a work order.
 *
 * An RN Modal, not an in-tree overlay, for the same reason Feature I's report
 * and Feature J's tag picker are root modals: BottomBar's absolute-fill nav pill
 * + FAB would otherwise float over it. A Modal portals above everything.
 *
 * The list is already filtered and sorted by the caller (useEligibleStaff), so
 * every row here is genuinely assignable — the empty state is a real "no staff
 * cover this area", not a loading gap.
 */
export function StaffPicker({ visible, staff, currentAssigneeId, onPick, onClose, busy }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(34,31,31,0.35)', justifyContent: 'flex-end' }}
      >
        {/* Stops taps on the sheet body from dismissing it. */}
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: theme.colors.white,
            borderTopLeftRadius: theme.radii.xl,
            borderTopRightRadius: theme.radii.xl,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.lg + insets.bottom,
            maxHeight: '75%',
          }}
        >
          <View style={{ paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.md }}>
            <Text style={theme.text.screenTitle}>Assign to</Text>
            <Text style={[theme.text.caption, { marginTop: 2 }]}>
              Maintenance staff in this work order's area.
            </Text>
          </View>

          {staff.length === 0 ? (
            <View style={{ paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.lg }}>
              <Text style={theme.text.cardTitle}>No staff available</Text>
              <Text style={[theme.text.caption, { marginTop: 4 }]}>
                No active maintenance staff are assigned to this area yet.
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {staff.map((member) => {
                const current = member.id === currentAssigneeId;
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => onPick(member.id)}
                    disabled={busy}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      paddingVertical: 12,
                      paddingHorizontal: theme.spacing.xl,
                      backgroundColor: pressed ? theme.colors.bg : theme.colors.white,
                      opacity: busy ? 0.5 : 1,
                    })}
                  >
                    <Avatar fullName={member.fullName} size={40} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={theme.text.cardTitle}>
                        {member.fullName || member.userCode || 'Staff'}
                      </Text>
                      <Text numberOfLines={1} style={theme.text.caption}>
                        {member.assignedArea || '—'}
                        {current ? ' · currently assigned' : ''}
                      </Text>
                    </View>
                    {current && (
                      <Icon name="check" size={theme.sizes.iconSmall} color={theme.colors.syncGreen} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
