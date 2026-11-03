import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PUBLIC_PATHS = ["/auth", "/reset-password", "/demo"];
/** Public screens render without the app shell or financial data provider. Tolerates trailing slashes. */
export function isPublicPath(path: string) {
  const p = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return PUBLIC_PATHS.includes(p);
}
