// Toast colour (vibecodecomponents.com "Toast Notifications" prompt: success,
// error and info, each with its own icon). Callers may say which; otherwise
// it's read from the message, since most messages already say what happened.

export type ToastTone = "success" | "error" | "info";

const ERROR =
  /\b(can't|couldn't|cannot|can not|not allowed|refused|failed|doesn't look right|already (has|have|uses|use|exists|belongs)|must be|needs (a|an)|no longer|isn't|aren't|would give|only managers|only admins)\b/i;
const ERROR_START = /^(already |pick a |that's already )/i;
const INFO = /^(nothing changed|sent to (your )?manager|saving|loading|copied|headers copied)/i;

export function toastTone(msg: string, tone?: ToastTone): ToastTone {
  if (tone) return tone;
  if (ERROR.test(msg) || ERROR_START.test(msg)) return "error";
  if (INFO.test(msg)) return "info";
  return "success";
}

// Errors stay up longer: they usually need reading.
export function toastDuration(tone: ToastTone): number {
  return tone === "error" ? 5000 : 3000;
}
