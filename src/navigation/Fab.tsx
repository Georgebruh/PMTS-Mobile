import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

import { useRole } from '../auth/session';
import type { IconName } from '../components/icons';
import { Icon } from '../components/Icon';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';

const EDGE = 18;
const ACTION_SIZE = 46;

// Add Asset still has no scheduled feature (flagged in the implementation plan).
// Tag Asset for Repair is live as of Feature J.
const addAssetStub = () =>
  Alert.alert('Add Asset', 'Adding assets from the app is not available yet.');

// The persistent FAB (Feature D), rendered inside BottomBar's full-screen
// layer. L1: a single direct Tag-for-Repair action. L2: a speed-dial — the
// plus rotates into an X, a backdrop dims everything behind the dial (scenes
// and the nav pill both sit under it, so any outside tap dismisses), and the
// two action rows rise above the FAB.
export function Fab({ bottom }: { bottom: number }) {
  const role = useRole();
  // The FAB is drawn inside the tab navigator but opens a ROOT-stack modal, so
  // the picker is not covered by this very layer. Typed against the root list
  // rather than the tab's — navigate() walks up to the parent navigator.
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [open, setOpen] = useState(false);
  // Keeps the dial mounted while the close animation runs out.
  const [visible, setVisible] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  const animateTo = useCallback(
    (value: 0 | 1) => {
      Animated.timing(progress, {
        toValue: value,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && value === 0) setVisible(false);
      });
    },
    [progress],
  );

  const openDial = () => {
    setOpen(true);
    setVisible(true);
    animateTo(1);
  };

  const closeDial = useCallback(() => {
    setOpen(false);
    animateTo(0);
  }, [animateTo]);

  // Android back closes the dial instead of navigating — registered only
  // while open so normal back behaviour is untouched.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeDial();
      return true;
    });
    return () => sub.remove();
  }, [open, closeDial]);

  // The L2→L1 toggle can flip the role while the dial is open — snap it shut.
  useEffect(() => {
    if (role !== 2 && open) {
      setOpen(false);
      setVisible(false);
      progress.setValue(0);
    }
  }, [role, open, progress]);

  if (role === null) return null; // unmounts via the root auth switch

  const openTagForRepair = () => navigation.navigate('TagForRepair');

  const onFabPress = () => {
    if (role === 1) {
      openTagForRepair();
    } else {
      open ? closeDial() : openDial();
    }
  };

  const runAction = (action: () => void) => {
    closeDial();
    action();
  };

  return (
    <>
      {visible && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
          <Pressable
            onPress={closeDial}
            accessibilityLabel="Close actions"
            style={{ flex: 1, backgroundColor: 'rgba(34, 31, 31, 0.45)' }}
          />
        </Animated.View>
      )}

      <View
        style={{ position: 'absolute', right: EDGE, bottom, alignItems: 'flex-end', gap: 14 }}
        pointerEvents="box-none"
      >
        {visible && role === 2 && (
          <Animated.View
            style={{
              gap: theme.spacing.md,
              alignItems: 'flex-end',
              opacity: progress,
              transform: [
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
              ],
            }}
          >
            <ActionRow label="Add Asset" icon="box" onPress={() => runAction(addAssetStub)} />
            <ActionRow
              label="Tag Asset for Repair"
              icon="wrench"
              onPress={() => runAction(openTagForRepair)}
            />
          </Animated.View>
        )}

        <Pressable
          onPress={onFabPress}
          accessibilityRole="button"
          accessibilityLabel={role === 1 ? 'Tag asset for repair' : 'Actions'}
          accessibilityState={role === 2 ? { expanded: open } : undefined}
          style={({ pressed }) => ({
            width: theme.sizes.navBar,
            height: theme.sizes.navBar,
            borderRadius: theme.sizes.navBar / 2,
            backgroundColor: pressed ? theme.colors.redPressed : theme.colors.red,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Animated.View
            style={{
              transform: [
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '45deg'],
                  }),
                },
              ],
            }}
          >
            <Icon name="plus" size={26} color={theme.colors.white} strokeWidth={2.2} />
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
}

function ActionRow({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      // The 46px action circle sits 8px in so its centre lines up with the
      // 62px FAB's below it.
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginRight: 8 }}
    >
      <View
        style={{
          backgroundColor: theme.colors.white,
          borderRadius: theme.radii.pill,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: 8,
        }}
      >
        <Text style={theme.text.cardTitle}>{label}</Text>
      </View>
      <View
        style={{
          width: ACTION_SIZE,
          height: ACTION_SIZE,
          borderRadius: ACTION_SIZE / 2,
          backgroundColor: theme.colors.red,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={22} color={theme.colors.white} />
      </View>
    </Pressable>
  );
}
