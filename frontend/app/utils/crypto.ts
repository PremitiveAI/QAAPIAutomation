import crypto from "crypto";

const SECRET_KEY = crypto
  .createHash("sha256")
  .update(String(process.env.COOKIE_SECRET || "default_secret"))
  .digest("base64")
  .substr(0, 32); // AES-256 requires 32 bytes

const IV_LENGTH = 16;

export function encrypt(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(SECRET_KEY), iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  return iv.toString("base64") + ":" + encrypted;
}

export function decrypt(text: string) {
  const parts = text.split(":");
  const iv = Buffer.from(parts[0], "base64");
  const encryptedText = parts[1];

  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(SECRET_KEY), iv);
  let decrypted = decipher.update(encryptedText, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
