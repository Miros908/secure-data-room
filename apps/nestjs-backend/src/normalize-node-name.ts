export function normalizeNodeName(name: string): string {
  return name.trim().normalize('NFC');
}
