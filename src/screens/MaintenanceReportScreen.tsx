import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';

import { formatDateTime } from '../asset/format';
import { useAsset } from '../asset/hooks';
import { useRole, useSession } from '../auth/session';
import { ActionButton, ActionRow } from '../components/ActionRow';
import { Card } from '../components/Card';
import { DetailScreen } from '../components/DetailScreen';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { InfoCard, type InfoRowSpec } from '../components/InfoCard';
import { LoadingState } from '../components/LoadingState';
import { PhotoGrid } from '../components/PhotoGrid';
import { SignaturePad, type PadSize } from '../components/SignaturePad';
import { TextField } from '../components/TextField';
import type { RootStackParamList } from '../navigation/types';
import {
  capturePhotoFromCamera,
  capturePhotoFromLibrary,
  writeSignaturePng,
} from '../report/capture';
import { useReport, useReportParams, useReportUploads, usePhotos, useSignature } from '../report/hooks';
import {
  addPhoto,
  discardDraftIfUntouched,
  removeUpload,
  retryUpload,
  saveDraft,
  setSignature,
  submitReport,
  type ReportForm,
} from '../report/mutations';
import { blankParam, draftsFromRecords, withTrailingBlank } from '../report/params';
import type { Stroke } from '../report/png';
import type { UploadRecord } from '../report/types';
import { deleteLocalFiles } from '../report/uploader';
import { UPLOAD_STATE } from '../report/uploads';
import {
  REPORT_STATUS_COLORS,
  validateSubmit,
  type ParamDraft,
  type ReportField,
  type ReportStatusColor,
} from '../report/validation';
import { requestSync } from '../sync/syncManager';
import { theme } from '../theme';
import type { Viewer } from '../wo/actions';
import { useWo } from '../wo/hooks';
import { WO_TYPE_LABELS } from '../wo/status';

type Props = NativeStackScreenProps<RootStackParamList, 'MaintenanceReport'>;

/**
 * Feature I — the maintenance report. Presented above the tab navigator (see
 * RootNavigator) so the nav pill and FAB do not float over it.
 *
 * Form state lives in React and is persisted on exit, not on every keystroke:
 * a write per character would thrash the sync trigger. The DB seeds the form
 * ONCE (see seeded ref) — later emissions must not clobber what the user is
 * currently typing.
 */
export function MaintenanceReportScreen({ navigation, route }: Props) {
  const { reportId } = route.params;

  const role = useRole();
  const userId = useSession((s) => s.user?.id ?? '');
  const viewer: Viewer = { role: role === 1 ? 1 : 2, userId };

  const report = useReport(reportId);
  const storedParams = useReportParams(reportId);
  const uploads = useReportUploads(reportId);
  const photos = usePhotos(uploads);
  const signature = useSignature(uploads);
  const wo = useWo(report?.workOrder.id ?? '');
  // The report denormalizes the asset id at creation, so this resolves even if
  // the work order row goes away underneath us.
  const asset = useAsset(report?.asset.id ?? '');

  const [actionTaken, setActionTaken] = useState('');
  const [statusColor, setStatusColor] = useState<string | null>(null);
  const [params, setParams] = useState<ParamDraft[]>([blankParam()]);
  const [busy, setBusy] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [signing, setSigning] = useState(false);
  // A camera/library permission refusal, held so the photo grid can show a
  // persistent Open Settings affordance rather than a one-off alert.
  const [photoPermissionMsg, setPhotoPermissionMsg] = useState<string | null>(null);

  const seeded = useRef(false);
  const exiting = useRef(false);

  // Seed once, from the first emission that has both the report and its params.
  useEffect(() => {
    if (seeded.current) return;
    if (!report || storedParams === undefined) return;
    seeded.current = true;
    setActionTaken(report.actionTaken ?? '');
    setStatusColor(report.statusColor ?? null);
    setParams(withTrailingBlank(draftsFromRecords(storedParams)));
  }, [report, storedParams]);

  const form: ReportForm = { actionTaken, statusColor, params };
  const readOnly = report !== null && report !== undefined && report.isDraft === false;

  const issues = validateSubmit({
    actionTaken,
    statusColor,
    params,
    hasSignature: !!signature,
    photoCount: photos?.length ?? 0,
  });
  const issueFor = (field: ReportField): string | null =>
    showIssues ? (issues.find((i) => i.field === field)?.message ?? null) : null;

  // ---------- exits ----------

  const close = useCallback(async () => {
    if (exiting.current || busy) return;
    exiting.current = true;
    setBusy(true);

    if (!readOnly) {
      await saveDraft(reportId, viewer, form);
      // An untouched draft is removed rather than left inflating the
      // dashboard's Unfinished count with a report that says nothing.
      const { discarded, orphanedUris } = await discardDraftIfUntouched(reportId, form);
      if (discarded) await deleteLocalFiles(orphanedUris);
    }

    setBusy(false);
    navigation.goBack();
  }, [busy, form, navigation, readOnly, reportId, viewer]);

  // Android hardware back must behave exactly like the close button, not drop
  // the user out of a half-written report with nothing saved.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (signing) {
        setSigning(false);
        return true;
      }
      void close();
      return true;
    });
    return () => sub.remove();
  }, [close, signing]);

  const onSubmit = async () => {
    if (busy) return;
    if (issues.length > 0) {
      setShowIssues(true);
      Alert.alert('Report incomplete', issues[0].message);
      return;
    }

    Alert.alert('Submit this report?', 'It will be sent for approval and can no longer be edited.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit',
        onPress: async () => {
          setBusy(true);
          const result = await submitReport(reportId, viewer, form);
          setBusy(false);
          if (!result.ok) {
            Alert.alert('Could not submit', result.error);
            return;
          }
          exiting.current = true;
          navigation.goBack();
        },
      },
    ]);
  };

  const onSaveDraft = async () => {
    if (busy) return;
    setBusy(true);
    const result = await saveDraft(reportId, viewer, form);
    setBusy(false);
    if (!result.ok) {
      Alert.alert('Could not save', result.error);
      return;
    }
    exiting.current = true;
    navigation.goBack();
  };

  // ---------- media ----------

  const onAddPhoto = () => {
    Alert.alert('Add a photo', undefined, [
      { text: 'Take photo', onPress: () => void addFrom('camera') },
      { text: 'Choose from gallery', onPress: () => void addFrom('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const addFrom = async (source: 'camera' | 'library') => {
    if (busy) return;
    setBusy(true);
    const captured =
      source === 'camera' ? await capturePhotoFromCamera() : await capturePhotoFromLibrary();

    if (!captured.ok) {
      setBusy(false);
      if ('cancelled' in captured) return;
      // A permission refusal gets the persistent inline Settings affordance in
      // the grid; any other failure stays a one-off alert.
      if (captured.denied) {
        setPhotoPermissionMsg(captured.error);
      } else {
        Alert.alert('Photo unavailable', captured.error);
      }
      return;
    }
    // Permission came through this time — clear any stale denial notice.
    setPhotoPermissionMsg(null);

    const result = await addPhoto(reportId, captured.uri, captured.mime);
    setBusy(false);
    if (!result.ok) {
      // The queue row failed, so the file it points at is now an orphan.
      await deleteLocalFiles([captured.uri]);
      Alert.alert('Could not attach', result.error);
    }
  };

  const onRemovePhoto = async (uploadId: string) => {
    if (busy) return;
    setBusy(true);
    const result = await removeUpload(uploadId);
    setBusy(false);
    if (!result.ok) {
      Alert.alert('Could not remove', result.error);
      return;
    }
    if (result.orphanedUri) await deleteLocalFiles([result.orphanedUri]);
  };

  /**
   * Requeues a stuck file and immediately asks the sync manager for a round —
   * the uploader only runs after a sync, and a user who just tapped Retry has
   * told us they believe they have a signal now. Waiting up to five minutes for
   * the interval would read as the button doing nothing.
   */
  const onRetryUpload = async (uploadId: string) => {
    if (busy) return;
    setBusy(true);
    const result = await retryUpload(uploadId);
    setBusy(false);
    if (!result.ok) {
      Alert.alert('Could not retry', result.error);
      return;
    }
    void requestSync('upload retry');
  };

  const onSignatureDone = async (strokes: Stroke[], size: PadSize) => {
    if (strokes.length === 0 || size.width === 0) {
      setSigning(false);
      return;
    }
    setBusy(true);
    const written = await writeSignaturePng(strokes, size.width, size.height);
    if (!written.ok) {
      setBusy(false);
      setSigning(false);
      if (!('cancelled' in written)) Alert.alert('Signature failed', written.error);
      return;
    }

    const result = await setSignature(reportId, written.uri, written.mime);
    setBusy(false);
    setSigning(false);
    if (!result.ok) {
      await deleteLocalFiles([written.uri]);
      Alert.alert('Could not save the signature', result.error);
      return;
    }
    // The replaced signature's file is now unreferenced.
    if (result.orphanedUris.length > 0) await deleteLocalFiles(result.orphanedUris);
  };

  // ---------- render ----------

  // A loading card while the report query has not emitted once, rather than a
  // blank screen behind the header.
  if (report === undefined) {
    return (
      <DetailScreen title="Report" onBack={close}>
        <View style={{ marginTop: theme.spacing.md }}>
          <LoadingState />
        </View>
      </DetailScreen>
    );
  }

  if (report === null) {
    return (
      <DetailScreen title="Report" onBack={close}>
        <View style={{ marginTop: theme.spacing.md }}>
          <EmptyState
            icon="warning"
            title="Report not found"
            caption="It may have been removed by a sync."
          />
        </View>
      </DetailScreen>
    );
  }

  if (signing) {
    return <SignatureOverlay onCancel={() => setSigning(false)} onDone={onSignatureDone} />;
  }

  // Auto metadata, read-only. Split into two cards the same way Work Order
  // Detail is, rather than one undifferentiated block.
  const metaRows: InfoRowSpec[] = [
    // Display codes are server-owned: the gateway assigns one on the first push
    // (Feature N), so an app-created report shows '—' only until it syncs.
    { label: 'Report', value: report.reportCode || '—' },
    { label: 'Work Order', value: wo?.woCode || '—' },
    { label: 'Type', value: wo ? (WO_TYPE_LABELS[wo.woType] ?? wo.woType) : '—' },
    ...(wo?.startedAt ? [{ label: 'Started', value: formatDateTime(wo.startedAt) }] : []),
    ...(wo?.endedAt ? [{ label: 'Ended', value: formatDateTime(wo.endedAt) }] : []),
    ...(report.submittedAt
      ? [{ label: 'Submitted', value: formatDateTime(report.submittedAt) }]
      : []),
  ];

  // The tech's own confirmation that they are documenting the right equipment —
  // the one screen in the app where getting the asset wrong is unrecoverable
  // paperwork. '…' while the query has not emitted; never a silent blank.
  const pending = asset === undefined;
  const assetRows: InfoRowSpec[] = [
    { label: 'Asset', value: pending ? '…' : asset?.equipmentName || '—' },
    { label: 'Asset Code', value: pending ? '…' : asset?.assetCode || asset?.code || '—' },
    { label: 'Category', value: pending ? '…' : asset?.assetType || '—' },
    // The work order's denormalized location is where the job was actually
    // raised against, which is what belongs on the report.
    { label: 'Location', value: wo?.location || asset?.location || '—' },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <DetailScreen title={readOnly ? 'Report' : 'Maintenance Report'} onBack={close}>
        <InfoCard label="Details" rows={metaRows} />
        <InfoCard label="Asset" rows={assetRows} />

        <FieldCard label="Action Taken" required error={issueFor('actionTaken')}>
          <TextField
            value={actionTaken}
            onChangeText={(text) => {
              setActionTaken(text);
              if (showIssues) setShowIssues(false);
            }}
            placeholder="Describe what was done"
            editable={!readOnly && !busy}
            multiline
            invalid={issueFor('actionTaken') !== null}
          />
        </FieldCard>

        <ParamsCard
          params={params}
          editable={!readOnly && !busy}
          error={issueFor('params')}
          onChange={(next) => {
            setParams(withTrailingBlank(next));
            if (showIssues) setShowIssues(false);
          }}
        />

        {photos !== undefined && (
          <PhotoGrid
            photos={photos}
            editable={!readOnly}
            onAdd={onAddPhoto}
            onRemove={onRemovePhoto}
            onRetry={onRetryUpload}
            permissionMessage={photoPermissionMsg}
            busy={busy}
          />
        )}

        <StatusPicker
          value={statusColor}
          editable={!readOnly && !busy}
          error={issueFor('statusColor')}
          onChange={(color) => {
            setStatusColor(color);
            if (showIssues) setShowIssues(false);
          }}
        />

        <SignatureCard
          signature={signature ?? null}
          editable={!readOnly && !busy}
          error={issueFor('signature')}
          onPress={() => setSigning(true)}
          onRetry={onRetryUpload}
          busy={busy}
        />

        {!readOnly && (
          <ActionRow>
            <ActionButton
              label="Save Draft"
              icon="pencil"
              variant="ghost"
              onPress={onSaveDraft}
              disabled={busy}
            />
            <ActionButton
              label="Submit"
              icon="check"
              variant="primary"
              onPress={onSubmit}
              disabled={busy}
            />
          </ActionRow>
        )}

        {readOnly && (
          <Text style={[theme.text.micro, { marginTop: theme.spacing.md }]}>
            This report has been submitted and is waiting for approval.
          </Text>
        )}
      </DetailScreen>
    </KeyboardAvoidingView>
  );
}

// ---------- pieces ----------

function FieldCard({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <Card style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 12, marginTop: 14 }}>
      <Text style={[theme.text.cardLabel, { paddingBottom: 8 }]}>
        {label}
        {required ? ' ·' : ''}
        {required ? <Text style={{ color: theme.colors.red }}> required</Text> : null}
      </Text>
      {children}
      {error !== null && (
        <Text style={[theme.text.micro, { color: theme.colors.red, marginTop: 8 }]}>{error}</Text>
      )}
    </Card>
  );
}

function ParamsCard({
  params,
  editable,
  error,
  onChange,
}: {
  params: ParamDraft[];
  editable: boolean;
  error: string | null;
  onChange: (next: ParamDraft[]) => void;
}) {
  const update = (index: number, patch: Partial<ParamDraft>) => {
    onChange(params.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <Card style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 12, marginTop: 14 }}>
      <Text style={[theme.text.cardLabel, { paddingBottom: 8 }]}>Parameters · optional</Text>

      {params.map((row, index) => (
        <View key={row.key} style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: 8 }}>
          <View style={{ flex: 3 }}>
            <TextField
              value={row.name}
              onChangeText={(name) => update(index, { name })}
              placeholder="Parameter"
              editable={editable}
              autoCapitalize="sentences"
            />
          </View>
          <View style={{ flex: 2 }}>
            <TextField
              value={row.value}
              onChangeText={(value) => update(index, { value })}
              placeholder="Value"
              editable={editable}
              autoCapitalize="none"
            />
          </View>
          <View style={{ flex: 1.4 }}>
            <TextField
              value={row.unit}
              onChangeText={(unit) => update(index, { unit })}
              placeholder="Unit"
              editable={editable}
              autoCapitalize="none"
            />
          </View>
        </View>
      ))}

      {error !== null && (
        <Text style={[theme.text.micro, { color: theme.colors.red, marginTop: 4 }]}>{error}</Text>
      )}
      <Text style={[theme.text.micro, { marginTop: 4 }]}>
        Leave a row blank to skip it. A new row appears as you type.
      </Text>
    </Card>
  );
}

const STATUS_LABELS: Record<ReportStatusColor, string> = {
  green: 'Healthy',
  orange: 'Warning',
  red: 'For Repair',
  black: 'Down',
};

function StatusPicker({
  value,
  editable,
  error,
  onChange,
}: {
  value: string | null;
  editable: boolean;
  error: string | null;
  onChange: (color: string) => void;
}) {
  return (
    <FieldCard label="Equipment Status" required error={error}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {REPORT_STATUS_COLORS.map((color) => {
          const selected = value === color;
          const palette = theme.status[color];
          return (
            <Pressable
              key={color}
              onPress={() => editable && onChange(color)}
              disabled={!editable}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: theme.radii.md,
                backgroundColor: palette.bg,
                borderWidth: 2,
                borderColor: selected ? palette.text : 'transparent',
                opacity: editable ? 1 : 0.6,
              }}
            >
              <Text
                style={[
                  theme.text.pill,
                  { color: palette.text, fontFamily: selected ? theme.fonts.bold : theme.fonts.regular },
                ]}
              >
                {STATUS_LABELS[color]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[theme.text.micro, { marginTop: 8 }]}>
        Anything other than Healthy raises a rework work order after approval.
      </Text>
    </FieldCard>
  );
}

/**
 * The signature, and — unlike the earlier version of this card — the state of
 * its upload.
 *
 * That state matters more here than on any photo. The signature is REQUIRED, so
 * a tech who has drawn one believes the report is filed; if its upload then
 * fails permanently, signature_url stays empty in the sheet forever. Silence
 * was the wrong default: this card now says what is happening and, when the
 * upload has given up, offers the only way back.
 */
function SignatureCard({
  signature,
  editable,
  error,
  onPress,
  onRetry,
  busy,
}: {
  signature: UploadRecord | null;
  editable: boolean;
  error: string | null;
  onPress: () => void;
  onRetry: (uploadId: string) => void;
  busy: boolean;
}) {
  const failed = signature?.state === UPLOAD_STATE.FAILED;
  const queued = signature?.state === UPLOAD_STATE.PENDING;

  const label =
    signature === null
      ? 'Tap to sign'
      : failed
        ? 'Signed — upload failed'
        : queued
          ? 'Signed — upload queued'
          : 'Signed — tap to sign again';

  return (
    <FieldCard label="Signature" required error={error}>
      <Pressable
        onPress={onPress}
        disabled={!editable}
        style={({ pressed }) => ({
          height: theme.sizes.button,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderStyle: signature !== null ? 'solid' : 'dashed',
          borderColor: signature !== null ? theme.colors.line : theme.colors.faint,
          backgroundColor: pressed ? theme.colors.bg : theme.colors.white,
          opacity: editable ? 1 : 0.6,
        })}
      >
        <Text style={theme.text.body}>{label}</Text>
      </Pressable>

      {/* Retry is offered independently of `editable`: a submitted report is
          read-only, but its stuck signature still has to be able to reach
          Drive. */}
      {failed && signature !== null && (
        <>
          <Pressable
            onPress={() => onRetry(signature.id)}
            disabled={busy}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: 8,
              height: theme.sizes.button,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.red,
              opacity: pressed || busy ? 0.5 : 1,
            })}
          >
            <Icon name="upload" size={14} color={theme.colors.white} />
            <Text style={[theme.text.body, { color: theme.colors.white }]}>Retry upload</Text>
          </Pressable>
          {signature.lastError !== null && (
            <Text style={[theme.text.micro, { marginTop: 6 }]}>{signature.lastError}</Text>
          )}
        </>
      )}
    </FieldCard>
  );
}

/**
 * Full-screen signature capture. Separate from the scrolling form on purpose:
 * a drawing surface nested in a ScrollView loses every downward stroke to the
 * scroll gesture.
 */
function SignatureOverlay({
  onCancel,
  onDone,
}: {
  onCancel: () => void;
  onDone: (strokes: Stroke[], size: PadSize) => void;
}) {
  const captured = useRef<{ strokes: Stroke[]; size: PadSize }>({
    strokes: [],
    size: { width: 0, height: 0 },
  });
  const [hasInk, setHasInk] = useState(false);

  // scroll={false}: the pad must own its whole gesture area. DetailScreen's
  // default body IS a ScrollView, and every downward stroke would be lost to
  // it. The content is short enough not to need scrolling anyway.
  return (
    <DetailScreen title="Signature" onBack={onCancel} scroll={false}>
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.md }}>
        <Text style={[theme.text.caption, { marginBottom: theme.spacing.md }]}>
          Sign in the box below, then tap Done.
        </Text>

        <SignaturePad
          onChange={(strokes, size) => {
            captured.current = { strokes, size };
            setHasInk(strokes.length > 0);
          }}
        />

        <ActionRow>
          <ActionButton label="Cancel" icon="close" variant="ghost" onPress={onCancel} />
          <ActionButton
            label="Done"
            icon="check"
            variant="primary"
            disabled={!hasInk}
            onPress={() => onDone(captured.current.strokes, captured.current.size)}
          />
        </ActionRow>
      </View>
    </DetailScreen>
  );
}
