import { useRef, useState, type ComponentProps, type Ref } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loginErrorMessage } from '../auth/api';
import { useSession } from '../auth/session';
import { Card } from '../components/Card';
import { theme } from '../theme';

// No login mockup exists in pmt-ui-redesign.html — this screen is composed
// from the Feature A tokens: maroon brand block, white card, red primary button.
export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const signIn = useSession((s) => s.signIn);
  const pinRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && pin.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, pin);
      // Success unmounts this screen via the root auth switch.
    } catch (e) {
      setError(loginErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.xl,
          paddingTop: insets.top + theme.spacing.xxl,
          paddingBottom: insets.bottom + theme.spacing.xxl,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <Text
            style={{
              fontFamily: theme.fonts.black,
              fontSize: 34,
              color: theme.colors.maroon,
              letterSpacing: 1,
            }}
          >
            PMTS
          </Text>
          <Text style={[theme.text.caption, { marginTop: 4, textAlign: 'center' }]}>
            Property Management Tracking System
          </Text>
        </View>

        <Card style={{ padding: theme.spacing.xl, gap: theme.spacing.lg }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => pinRef.current?.focus()}
          />
          <Field
            ref={pinRef}
            label="PIN"
            value={pin}
            onChangeText={setPin}
            editable={!busy}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={12}
            returnKeyType="done"
            onSubmitEditing={submit}
          />

          {error !== null && (
            <View
              style={{
                backgroundColor: theme.status.red.bg,
                borderRadius: theme.radii.md,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: 10,
              }}
            >
              <Text style={[theme.text.body, { color: theme.status.red.text }]}>{error}</Text>
            </View>
          )}

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={({ pressed }) => ({
              height: theme.sizes.button,
              borderRadius: theme.radii.lg,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? theme.colors.redPressed : theme.colors.red,
              opacity: canSubmit ? 1 : 0.55,
            })}
          >
            {busy ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text
                style={{
                  fontFamily: theme.fonts.bold,
                  fontSize: 15.5,
                  color: theme.colors.white,
                  letterSpacing: 0.3,
                }}
              >
                Log in
              </Text>
            )}
          </Pressable>
        </Card>

        <Text style={[theme.text.micro, { textAlign: 'center', marginTop: theme.spacing.lg }]}>
          First-time login needs a connection. After that, the app works offline.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = {
  label: string;
  ref?: Ref<TextInput>;
} & ComponentProps<typeof TextInput>;

function Field({ label, ref, ...inputProps }: FieldProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={theme.text.cardLabel}>{label}</Text>
      <TextInput
        ref={ref}
        {...inputProps}
        placeholderTextColor={theme.colors.faint}
        style={{
          height: theme.sizes.searchField,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.line,
          backgroundColor: theme.colors.bg,
          paddingHorizontal: theme.spacing.md,
          fontFamily: theme.fonts.regular,
          fontSize: 15,
          color: theme.colors.ink,
        }}
      />
    </View>
  );
}
