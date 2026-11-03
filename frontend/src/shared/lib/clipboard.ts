import { notify } from "./notify";

/**
 * Copies `text` and confirms with a toast, e.g. "Video ID copied".
 * Returns false (and shows an error) when the browser refuses.
 */
export async function copyToClipboard(text: string, label: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    notify.success(`${label} copied`);
    return true;
  } catch {
    notify.error(`Couldn't copy the ${label.toLowerCase()}. Copy it by hand instead.`);
    return false;
  }
}
