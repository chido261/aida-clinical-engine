// app/lib/deviceId.ts

const STORAGE_KEY = "aida_device_id_v1";

function createFallbackId(): string {
  const randomPart = Math.random().toString(36).slice(2, 12);
  const timePart = Date.now().toString(36);
  return `aida_${timePart}_${randomPart}`;
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  let deviceId = localStorage.getItem(STORAGE_KEY);

  if (!deviceId) {
    const canUseRandomUUID =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function";

    deviceId = canUseRandomUUID ? crypto.randomUUID() : createFallbackId();

    localStorage.setItem(STORAGE_KEY, deviceId);
  }

  return deviceId;
}