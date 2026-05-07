/**
 * Default share-sheet implementation (BLG-0020 / DES-0004 §3.4 / ADR-0009).
 *
 * Composes `expo-file-system` + `expo-sharing` so the streamed PDF bytes
 * from `GET /export/business-expenses` can be handed to the native share
 * sheet on iOS / Android.
 *
 * Why this lives in `lib/` and not in `screens/profile/`:
 *   The Profile screen takes an injectable `shareImpl` prop so the unit /
 *   render tests can mount it without pulling `expo-sharing` /
 *   `expo-file-system` into the test path. When the prop is not provided
 *   (production wiring), the screen falls back to `defaultShareImpl`. The
 *   prop indirection from S-006 stays — this file only adds the default.
 *
 * Privacy contract (per ADR-0009 §3 + DES-0004 §3.4):
 *   - The PDF bytes are written to the sandboxed cache directory via
 *     `writeAsStringAsync(uri, base64, { encoding: "base64" })`.
 *   - `shareAsync(uri, ...)` hands the file to whichever app the user
 *     picks. The user's choice is the user's, not ours.
 *   - We never log the bytes, the filename, or the chosen target.
 *
 * Imports of native deps (`expo-file-system`, `expo-sharing`) live behind
 * dynamic `require` so this file stays loadable in pure-TS Jest projects
 * (where these deps are not installed at test time). Mirrors the same
 * pattern used by `mobile/src/cache/rotate.ts`.
 */

export type ShareArgs = {
  base64: string;
  filename: string;
};

/**
 * Hand the streamed PDF bytes to the native share sheet.
 *
 * Best-effort: if the share sheet is unavailable (older Android with no
 * apps registered for `application/pdf`, or iOS Simulator), the call
 * resolves silently — the export already succeeded server-side. The
 * Profile screen treats both success and dismissal as a non-error
 * (`EXPORT_DONE` per `state.ts`).
 */
export async function defaultShareImpl(args: ShareArgs): Promise<void> {
  const FileSystem = loadFileSystem();
  const Sharing = loadSharing();

  const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!cacheDir) {
    throw new Error("share: no writable directory available");
  }
  const uri = `${cacheDir}${args.filename}`;

  await FileSystem.writeAsStringAsync(uri, args.base64, {
    encoding: FileSystem.EncodingType?.Base64 ?? "base64",
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    return;
  }

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: args.filename,
  });
}

// ---------------------------------------------------------------------------
// Lazy native loaders — kept out of the test path.
// ---------------------------------------------------------------------------

type FileSystemShim = {
  cacheDirectory: string | null;
  documentDirectory: string | null;
  EncodingType?: { Base64: string };
  writeAsStringAsync(
    uri: string,
    contents: string,
    options?: { encoding?: string }
  ): Promise<void>;
};

type SharingShim = {
  isAvailableAsync(): Promise<boolean>;
  shareAsync(
    uri: string,
    options?: {
      mimeType?: string;
      UTI?: string;
      dialogTitle?: string;
    }
  ): Promise<void>;
};

function loadFileSystem(): FileSystemShim {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("expo-file-system");
  return m as FileSystemShim;
}

function loadSharing(): SharingShim {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("expo-sharing");
  return m as SharingShim;
}
