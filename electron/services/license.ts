import {
  createHash,
  verify as verifySignature
} from "node:crypto";
import {
  execFileSync
} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_ID = "com.aicontentstudio.desktop";
const LICENSE_VERSION = 1;

// This is the PUBLIC key only.
// The matching private signing key must never be included in the app.
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAc8QT9OrPH9FJO08JuCal+ue6nzaBHvVn6Mq6kfa2FLo=
-----END PUBLIC KEY-----`;

export type LicensePayload = {
  version: number;
  app: string;
  machineId: string;
  licensee: string;
  issuedAt: string;
  expiresAt?: string | null;
  features: string[];
};

export type LicenseStatus = {
  activated: boolean;
  machineId: string;
  licensee?: string;
  issuedAt?: string;
  expiresAt?: string | null;
  remainingMs?: number | null;
  isLifetime?: boolean;
  message: string;
};

function getWindowsMachineGuid(): string | null {
  if (process.platform !== "win32") return null;

  try {
    const output = execFileSync(
      "reg",
      [
        "query",
        "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography",
        "/v",
        "MachineGuid"
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"]
      }
    );

    const match = output.match(/MachineGuid\s+REG_SZ\s+(.+)/i);
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

export function getMachineId(): string {
  const machineGuid = getWindowsMachineGuid();

  // Windows MachineGuid is preferred because it is stable across reboots.
  // The fallback supports development and non-Windows testing.
  const source = machineGuid
    ? `windows:${machineGuid}`
    : [
        process.platform,
        os.hostname(),
        os.arch(),
        os.release()
      ].join(":");

  return createHash("sha256")
    .update(`${APP_ID}:${source}`)
    .digest("hex")
    .toUpperCase()
    .match(/.{1,4}/g)!
    .join("-");
}

function decodeLicenseCode(code: string): {
  payload: LicensePayload;
  payloadBytes: Buffer;
  signature: Buffer;
} {
  const normalized = String(code || "")
    .trim()
    .replace(/\s+/g, "");

  const parts = normalized.split(".");

  if (parts.length !== 2) {
    throw new Error("Invalid activation code format.");
  }

  let payloadBytes: Buffer;
  let signature: Buffer;

  try {
    payloadBytes = Buffer.from(parts[0], "base64url");
    signature = Buffer.from(parts[1], "base64url");
  } catch {
    throw new Error("Activation code could not be decoded.");
  }

  let payload: LicensePayload;

  try {
    payload = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    throw new Error("Activation code contains invalid license data.");
  }

  return { payload, payloadBytes, signature };
}

export function validateLicenseCode(code: string): LicensePayload {
  const { payload, payloadBytes, signature } = decodeLicenseCode(code);

  if (!verifySignature(null, payloadBytes, PUBLIC_KEY, signature)) {
    throw new Error("Activation code signature is invalid.");
  }

  if (payload.version !== LICENSE_VERSION) {
    throw new Error("This license version is not supported.");
  }

  if (payload.app !== APP_ID) {
    throw new Error("This activation code is not for AI Content Studio.");
  }

  if (payload.machineId !== getMachineId()) {
    throw new Error(
      "This activation code belongs to another PC. Request a code for this PC's Machine ID."
    );
  }

  if (!payload.licensee || !payload.issuedAt) {
    throw new Error("License information is incomplete.");
  }

  if (payload.expiresAt) {
    const expiry = Date.parse(payload.expiresAt);
    if (!Number.isFinite(expiry)) throw new Error("License expiry date is invalid.");
    if (expiry <= Date.now()) throw new Error("This license has expired. Please contact MadCraves for renewal.");
  }

  return payload;
}

export function getLicenseStatus(
  licenseFile: string
): LicenseStatus {
  const machineId = getMachineId();

  if (!fs.existsSync(licenseFile)) {
    return {
      activated: false,
      machineId,
      message: "This PC has not been activated."
    };
  }

  try {
    const saved = JSON.parse(
      fs.readFileSync(licenseFile, "utf8")
    );

    const payload = validateLicenseCode(saved.code);

    return {
      activated: true,
      machineId,
      licensee: payload.licensee,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt || null,
      remainingMs: payload.expiresAt ? Math.max(0, Date.parse(payload.expiresAt) - Date.now()) : null,
      isLifetime: !payload.expiresAt,
      message: "AI Content Studio is activated."
    };
  } catch (error: any) {
    let metadata: any = {};
    try {
      const saved = JSON.parse(fs.readFileSync(licenseFile, "utf8"));
      const { payload } = decodeLicenseCode(saved.code);
      metadata = { licensee: payload.licensee, issuedAt: payload.issuedAt, expiresAt: payload.expiresAt || null, remainingMs: payload.expiresAt ? Math.max(0, Date.parse(payload.expiresAt) - Date.now()) : null, isLifetime: !payload.expiresAt };
    } catch { /* Keep invalid-license details minimal. */ }
    return {
      activated: false,
      machineId,
      ...metadata,
      message: error?.message || "The saved license is invalid."
    };
  }
}

export function activateLicense(
  licenseFile: string,
  code: string
): LicenseStatus {
  const payload = validateLicenseCode(code);

  fs.mkdirSync(path.dirname(licenseFile), {
    recursive: true
  });

  fs.writeFileSync(
    licenseFile,
    JSON.stringify(
      {
        code: code.trim(),
        activatedAt: new Date().toISOString()
      },
      null,
      2
    ),
    {
      encoding: "utf8",
      mode: 0o600
    }
  );

  return {
    activated: true,
    machineId: getMachineId(),
    licensee: payload.licensee,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt || null,
    remainingMs: payload.expiresAt ? Math.max(0, Date.parse(payload.expiresAt) - Date.now()) : null,
    isLifetime: !payload.expiresAt,
    message: "Activation successful. Welcome to AI Content Studio."
  };
}
