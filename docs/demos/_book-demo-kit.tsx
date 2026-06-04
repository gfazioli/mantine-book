import { Box, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';

/**
 * Shared building blocks for the Curl docs demos. NOT a demo itself — the
 * underscore prefix keeps it out of the `demos/index.ts` barrel.
 *
 * The Curl play-zone is 2×W wide, so the standard right-rail configurator gets
 * squeezed. These helpers lay each demo out as a centered stage with a
 * full-width control bar BELOW it.
 */

/** Default face colours used across the demos (blue Front A / orange Back B). */
export const FRONT_COLOR = '#4263eb';
export const BACK_COLOR = '#e8590c';

/** The standard labeled face. */
export function Face({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 36,
        fontWeight: 700,
        color: '#fff',
        background: color,
      }}
    >
      {label}
    </div>
  );
}

/**
 * Centers the Curl stage. Overflow is visible so the lifted curl — which
 * extends beyond the sheet box during a fold — spills out freely instead of
 * being clipped or triggering scrollbars.
 */
export function DemoStage({ children }: { children: ReactNode }) {
  return (
    <Box
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        overflow: 'visible',
        paddingBlock: 8,
      }}
    >
      {children}
    </Box>
  );
}

/**
 * A full-width control bar placed BELOW the stage (never a right side-rail,
 * which a 2×W component would squeeze). Wraps onto multiple rows when narrow.
 */
export function ControlBar({ children }: { children: ReactNode }) {
  return (
    <Group
      justify="center"
      align="flex-end"
      gap="xl"
      wrap="wrap"
      mt="md"
      pt="md"
      style={{ borderTop: '1px solid var(--mantine-color-default-border)', width: '100%' }}
    >
      {children}
    </Group>
  );
}

/** A labeled wrapper for a single control inside the ControlBar. */
export function Control({
  label,
  children,
  w,
}: {
  label: string;
  children: ReactNode;
  w?: number;
}) {
  return (
    <Stack gap={4} style={{ width: w }}>
      <Text size="xs" fw={600} c="dimmed" tt="uppercase">
        {label}
      </Text>
      {children}
    </Stack>
  );
}

export type CurlVariant = 'flat' | 'rounded';

/**
 * Reusable flat/rounded toggle. Many demos document a prop that is worth seeing
 * in BOTH renderers, so they pair this with `key={variant} variant={variant}`
 * on the Curl (the key forces a clean WebGL mount/unmount on switch).
 */
export function VariantControl({
  value,
  onChange,
}: {
  value: CurlVariant;
  onChange: (value: CurlVariant) => void;
}) {
  return (
    <Control label="Variant">
      <SegmentedControl
        value={value}
        onChange={(next) => onChange(next as CurlVariant)}
        data={['flat', 'rounded']}
      />
    </Control>
  );
}

/**
 * `overflow: visible` for the demo frame, so the lifted curl is never clipped
 * and no scrollbars appear. The frame's `overflow` prop is typed
 * `'hidden' | 'auto'` but is applied verbatim to the container's inline style,
 * so `'visible'` works at runtime; the cast keeps the typed demo object happy.
 */
export const VISIBLE_OVERFLOW = 'visible' as unknown as 'auto';
