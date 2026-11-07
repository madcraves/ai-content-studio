const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");

const APP_ID = "com.aicontentstudio.desktop";
const VERSION = 1;

const KEY_FILE = path.join(__dirname, "ACS-License-Private-Key.pem");
const OUTPUT_DIR = path.join(__dirname, "issued-licenses");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function normalizeMachineId(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "");
}

function makeLicense(machineId, licensee, privateKey) {
  const payload = {
    version: VERSION,
    app: APP_ID,
    machineId: normalizeMachineId(machineId)
      .match(/.{1,4}/g)
      .join("-"),
    licensee: licensee.trim(),
    issuedAt: new Date().toISOString(),
    features: [
      "ai-generation",
      "wordpress",
      "article-library",
      "scheduler"
    ]
  };

  const payloadBytes = Buffer.from(
    JSON.stringify(payload),
    "utf8"
  );

  const signature = crypto.sign(
    null,
    payloadBytes,
    privateKey
  );

  return (
    payloadBytes.toString("base64url") +
    "." +
    signature.toString("base64url")
  );
}

async function main() {
  console.log("");
  console.log("======================================");
  console.log(" AI CONTENT STUDIO - LICENSE ISSUER");
  console.log(" ADMIN TOOL - KEEP PRIVATE");
  console.log("======================================");
  console.log("");

  if (!fs.existsSync(KEY_FILE)) {
    console.error("ERROR: Private key file not found.");
    console.error(
      "Place ACS-License-Private-Key.pem beside this script."
    );
    process.exitCode = 1;
    return;
  }

  const machineInput = await rl.question(
    "Enter the PC Machine ID: "
  );

  const machineId = normalizeMachineId(machineInput);

  if (!/^[A-F0-9]{64}$/.test(machineId)) {
    console.error(
      "ERROR: Machine ID must contain exactly 64 hexadecimal characters."
    );
    process.exitCode = 1;
    return;
  }

  const licensee = await rl.question(
    "Enter license holder name: "
  );

  if (!licensee.trim()) {
    console.error("ERROR: License holder name is required.");
    process.exitCode = 1;
    return;
  }

  const privateKey = fs.readFileSync(KEY_FILE, "utf8");

  const licenseCode = makeLicense(
    machineId,
    licensee,
    privateKey
  );

  fs.mkdirSync(OUTPUT_DIR, {
    recursive: true
  });

  const safeName = licensee
    .trim()
    .replace(/[^a-z0-9_-]/gi, "_")
    .slice(0, 40);

  const filename =
    `AI-Content-Studio-${safeName}-${Date.now()}.txt`;

  const outputPath = path.join(OUTPUT_DIR, filename);

  fs.writeFileSync(
    outputPath,
    [
      "AI CONTENT STUDIO - OFFLINE LICENSE",
      "",
      `License holder: ${licensee.trim()}`,
      `Machine ID: ${machineId}`,
      "",
      "ACTIVATION CODE:",
      licenseCode,
      ""
    ].join("\n"),
    "utf8"
  );

  console.log("");
  console.log("SUCCESS: License created.");
  console.log("");
  console.log("Activation code:");
  console.log(licenseCode);
  console.log("");
  console.log("Saved to:");
  console.log(outputPath);
  console.log("");
}

main()
  .catch(error => {
    console.error("License generation failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
