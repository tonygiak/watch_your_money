/**
 * Date field that shows the native iOS / Android date picker
 * (BLG-0021 / DES-0004 §3.4 / §9).
 *
 * Public contract:
 *   - `value` is a ``YYYY-MM-DD`` string (the same shape the
 *     `profileReducer` uses for `exportFromDate` / `exportToDate`).
 *   - `onChange(value)` emits the same shape; `EXPORT_FROM_CHANGED` /
 *     `EXPORT_TO_CHANGED` actions are unchanged at the reducer layer.
 *   - `accessibilityLabel` is forwarded to the picker's trigger button so
 *     `getByLabelText("Από")` / `getByLabelText("Έως")` keep working in
 *     the existing render tests.
 *
 * The native picker is loaded behind a dynamic `require` so the component
 * stays loadable under pure-TS Jest. When the dep is not installed (the
 * S-007 test path before the SDK 54 install completes), the component
 * silently falls back to a plain `Pressable` that toggles a no-op — render
 * tests that mount this component still pass; actually opening the picker
 * is exercised in the on-device acceptance step in `S-007-UREV-0001`.
 */

import React, { useCallback, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

export type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
  editable?: boolean;
  /** Hint text shown under the value when set (e.g. error). */
  errorMessage?: string;
};

const DEFAULT_DATE = new Date();

export default function DateField(props: DateFieldProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const editable = props.editable !== false;

  const onPress = useCallback(() => {
    if (!editable) return;
    setOpen(true);
  }, [editable]);

  const onPicked = useCallback(
    (event: { type?: string }, picked: Date | undefined): void => {
      if (Platform.OS === "android") {
        setOpen(false);
      }
      if (event && event.type === "dismissed") {
        return;
      }
      if (!picked) return;
      props.onChange(formatIsoDate(picked));
    },
    [props]
  );

  const Picker = loadPicker();

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        accessibilityHint="Πατήστε για επιλογή ημερομηνίας"
        accessibilityState={{ disabled: !editable }}
        style={[
          styles.trigger,
          !editable && styles.triggerDisabled,
          props.errorMessage ? styles.triggerError : null,
        ]}
        onPress={onPress}
        disabled={!editable}
      >
        <Text style={styles.triggerText}>{props.value || "—"}</Text>
      </Pressable>
      {open && Picker ? (
        <Picker
          value={parseIsoDate(props.value) ?? DEFAULT_DATE}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={onPicked}
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const date = new Date(y, mo - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

type PickerComponent = React.ComponentType<{
  value: Date;
  mode?: "date" | "time" | "datetime";
  display?: "default" | "spinner" | "inline" | "compact" | "calendar";
  onChange?: (event: { type?: string }, picked: Date | undefined) => void;
}>;

function loadPicker(): PickerComponent | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require("@react-native-community/datetimepicker");
    const Component = (m && (m.default ?? m)) as PickerComponent;
    return Component ?? null;
  } catch {
    // Dep not yet installed (pre-SDK-54-install test path) or runtime
    // error: render the button but skip the picker. The component still
    // mounts cleanly — the BLG-0021 on-device picker open is verified in
    // `S-007-UREV-0001`.
    return null;
  }
}

const styles = StyleSheet.create({
  trigger: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
    backgroundColor: "#fff",
    marginTop: 4,
    justifyContent: "center",
  },
  triggerDisabled: { backgroundColor: "#f4f4f4", borderColor: "#ddd" },
  triggerError: { borderColor: "#c00" },
  triggerText: { fontSize: 16, color: "#222" },
});
