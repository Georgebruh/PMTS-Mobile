import { Linking, Pressable, Text, View } from 'react-native';

import { formatDateTime } from '../asset/format';
import { assetStatusMeta } from '../asset/status';
import type { ParamRecord } from '../report/types';
import type { ReportRecord } from '../report/types';
import { splitUrls } from '../report/urls';
import { theme } from '../theme';
import { AssetStatusPill } from './AssetStatus';
import { Card } from './Card';
import { Icon } from './Icon';

type Props = {
  report: ReportRecord;
  params: ParamRecord[];
  /** Resolved from the id→name map (gap #8). */
  reporterName: string;
};

/**
 * Read-only render of a submitted report, for L2's approval screen.
 *
 * Photos and the signature are shown as tappable LINKS, not inline images, and
 * on purpose. The reviewer is on a different device from the reporter, so they
 * never hold the local files — only the synced Drive URLs in photo_urls /
 * signature_url. Those are Drive *page* links (file.getUrl()), which an <Image>
 * cannot render as bytes; opening them shows the full-resolution photo reliably,
 * a broken thumbnail would not. When the columns are still empty (the reporter's
 * uploads have not synced yet) that is stated rather than shown as a gap.
 */
export function ReportReview({ report, params, reporterName }: Props) {
  const photos = splitUrls(report.photoUrls);
  const signature = (report.signatureUrl ?? '').trim();
  const meta = assetStatusMeta(report.statusColor ?? '');

  return (
    <>
      <Card style={{ padding: theme.spacing.lg, gap: 10, marginTop: 14 }}>
        <Text style={theme.text.cardLabel}>Equipment status reported</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <AssetStatusPill color={report.statusColor ?? ''} />
          <Text style={theme.text.caption}>
            {meta.label === 'Healthy'
              ? 'Green — approving closes this work order.'
              : 'Not green — approving spawns a repair work order.'}
          </Text>
        </View>
      </Card>

      <Card style={{ padding: theme.spacing.lg, gap: 6, marginTop: 14 }}>
        <Text style={theme.text.cardLabel}>Action taken</Text>
        <Text style={[theme.text.body, { lineHeight: 19 }]}>
          {report.actionTaken?.trim() || '—'}
        </Text>
      </Card>

      <Card style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 12, marginTop: 14 }}>
        <Text style={[theme.text.cardLabel, { paddingBottom: 4 }]}>
          Parameters{params.length > 0 ? ` · ${params.length}` : ''}
        </Text>
        {params.length === 0 ? (
          <Text style={[theme.text.caption, { paddingVertical: 4 }]}>
            No parameters were recorded.
          </Text>
        ) : (
          params.map((p, index) => (
            <View
              key={p.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.lg,
                paddingVertical: 10,
                borderBottomWidth: index === params.length - 1 ? 0 : 1,
                borderBottomColor: theme.colors.lineFaint,
              }}
            >
              <Text style={[theme.text.caption, { flexShrink: 1 }]}>{p.paramName || '—'}</Text>
              <Text
                style={{
                  fontFamily: theme.fonts.bold,
                  fontSize: 13.5,
                  color: theme.colors.ink,
                  textAlign: 'right',
                }}
              >
                {p.measuredValue || '—'}
                {p.unit ? ` ${p.unit}` : ''}
              </Text>
            </View>
          ))
        )}
      </Card>

      <LinkCard
        label={`Photos${photos.length > 0 ? ` · ${photos.length}` : ''}`}
        urls={photos}
        emptyNote="No photos on this report yet (they upload on the reporter's next sync)."
        itemLabel={(i) => `Open photo ${i + 1}`}
        icon="camera"
      />

      <LinkCard
        label="Signature"
        urls={signature ? [signature] : []}
        emptyNote="The signature has not synced from the reporter's device yet."
        itemLabel={() => 'Open signature'}
        icon="pencil"
      />

      <Card style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 6, marginTop: 14 }}>
        <Text style={[theme.text.cardLabel, { paddingTop: 10, paddingBottom: 2 }]}>Filed by</Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 12,
          }}
        >
          <Text style={theme.text.caption}>Reporter</Text>
          <Text style={{ fontFamily: theme.fonts.bold, fontSize: 13.5, color: theme.colors.ink }}>
            {reporterName}
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: theme.colors.lineFaint,
          }}
        >
          <Text style={theme.text.caption}>Submitted</Text>
          <Text style={{ fontFamily: theme.fonts.bold, fontSize: 13.5, color: theme.colors.ink }}>
            {formatDateTime(report.submittedAt)}
          </Text>
        </View>
      </Card>
    </>
  );
}

function LinkCard({
  label,
  urls,
  emptyNote,
  itemLabel,
  icon,
}: {
  label: string;
  urls: string[];
  emptyNote: string;
  itemLabel: (index: number) => string;
  icon: 'camera' | 'pencil';
}) {
  return (
    <Card style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 12, marginTop: 14 }}>
      <Text style={[theme.text.cardLabel, { paddingBottom: 4 }]}>{label}</Text>
      {urls.length === 0 ? (
        <Text style={[theme.text.caption, { paddingVertical: 4 }]}>{emptyNote}</Text>
      ) : (
        urls.map((url, index) => (
          <Pressable
            key={url}
            onPress={() => Linking.openURL(url).catch(() => {})}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              paddingVertical: 10,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name={icon} size={theme.sizes.iconSmall} color={theme.colors.red} />
            <Text style={{ fontFamily: theme.fonts.bold, fontSize: 13.5, color: theme.colors.red }}>
              {itemLabel(index)}
            </Text>
          </Pressable>
        ))
      )}
    </Card>
  );
}
