// app/lib/deviceId.ts

export function getDeviceId(): string {
    if (typeof window === "undefined") return "";
  
    const STORAGE_KEY = "aida_device_id_v1";
  
    let deviceId = localStorage.getItem(STORAGE_KEY);
  
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, deviceId);
    }
  
    return deviceId;
  }