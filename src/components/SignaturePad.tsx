import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { strokeToPath, type Point, type Stroke } from '../report/png';
import { theme } from '../theme';

/** The coordinate space the strokes were captured in — the pad's MEASURED
 *  layout, which is what src/report/png.ts needs to rasterize at the right
 *  aspect ratio. Reported alongside the strokes so the parent never has to
 *  guess it (or worse, assume a fixed width and skew every signature). */
export type PadSize = { width: number; height: number };

type Props = {
  /** Called with every stroke drawn so far, after each finger lift. */
  onChange: (strokes: Stroke[], size: PadSize) => void;
  height?: number;
};

const PAD_HEIGHT = 200;

/**
 * Feature I's signature capture — PanResponder for the gesture, react-native-svg
 * for the ink, and src/report/png.ts to turn the result into a real PNG.
 *
 * Deliberately NOT react-native-signature-canvas: that library hosts an HTML
 * canvas inside a WebView, which means shipping a browser engine to capture a
 * name. Everything here is already in the app.
 *
 * The pad must own its whole gesture area, which is why the report screen
 * presents it as a full-screen overlay rather than inline: a drawing surface
 * inside a ScrollView fights the scroll for every vertical stroke.
 */
export function SignaturePad({ onChange, height = PAD_HEIGHT }: Props) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Point[]>([]);

  // The gesture handlers are created once; they read and write through refs so
  // a re-render mid-stroke cannot hand PanResponder a stale closure.
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Point[]>([]);
  const sizeRef = useRef<PadSize>({ width: 0, height });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Claim the gesture outright: a parent ScrollView must not be able to
        // steal a downward stroke halfway through a signature.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,

        onPanResponderGrant: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          currentRef.current = [{ x: locationX, y: locationY }];
          setCurrent(currentRef.current);
        },
        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          currentRef.current = [...currentRef.current, { x: locationX, y: locationY }];
          setCurrent(currentRef.current);
        },
        onPanResponderRelease: () => {
          if (currentRef.current.length > 0) {
            strokesRef.current = [...strokesRef.current, currentRef.current];
            setStrokes(strokesRef.current);
            onChange(strokesRef.current, sizeRef.current);
          }
          currentRef.current = [];
          setCurrent([]);
        },
      }),
    [onChange],
  );

  const clear = () => {
    strokesRef.current = [];
    currentRef.current = [];
    setStrokes([]);
    setCurrent([]);
    onChange([], sizeRef.current);
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height: h } = event.nativeEvent.layout;
    sizeRef.current = { width, height: h };
  };

  const paths = [...strokes, current].filter((s) => s.length > 0).map(strokeToPath);

  return (
    <View>
      <View
        onLayout={onLayout}
        {...responder.panHandlers}
        style={{
          height,
          backgroundColor: theme.colors.white,
          borderWidth: 1,
          borderColor: theme.colors.line,
          borderRadius: theme.radii.md,
          overflow: 'hidden',
        }}
      >
        <Svg width="100%" height="100%">
          {paths.map((d, index) => (
            <Path
              key={index}
              d={d}
              stroke={theme.colors.ink}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>

        {strokes.length === 0 && current.length === 0 && (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={theme.text.caption}>Sign here</Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: theme.spacing.sm }}>
        <Pressable onPress={clear} hitSlop={8} disabled={strokes.length === 0}>
          <Text
            style={[
              theme.text.micro,
              { color: strokes.length === 0 ? theme.colors.faint : theme.colors.red },
            ]}
          >
            Clear
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export { PAD_HEIGHT };
