// SMS segment calculation
// GSM 7-bit: 160 chars per segment, 153 if multipart
// Unicode: 70 chars per segment, 67 if multipart

const GSM_REGEX = /^[\x20-\x7E\n\r]*$/;

export function isGSM(text: string): boolean {
  return GSM_REGEX.test(text);
}

export function calculateSegments(message: string): number {
  if (!message) return 0;
  const isGsm = isGSM(message);
  const len = message.length;

  if (isGsm) {
    return len <= 160 ? 1 : Math.ceil(len / 153);
  }
  return len <= 70 ? 1 : Math.ceil(len / 67);
}

export function calculateCost(message: string, recipientCount: number, costPerSegment = 0.50): number {
  const segments = calculateSegments(message);
  return segments * recipientCount * costPerSegment;
}

export function parseRecipients(input: string): string[] {
  return input
    .split(/[,\n;]+/)
    .map((r) => r.trim().replace(/\s/g, ""))
    .filter((r) => r.length >= 10);
}
