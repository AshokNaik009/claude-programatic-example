import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, writeFileSync, unlinkSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getProfile, upsertProfile, removeProfile } from "./profile.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PROFILE_PATH = join(DATA_DIR, "profile.json");
const CV_PATH = join(DATA_DIR, "cv.pdf");
const BACKUP_PROFILE = join(DATA_DIR, "profile.backup.json");
const BACKUP_CV = join(DATA_DIR, "cv.backup.pdf");

// Back up any existing profile before tests so we don't destroy user data
function backup() {
  if (existsSync(PROFILE_PATH)) {
    writeFileSync(BACKUP_PROFILE, readFileSync(PROFILE_PATH));
    unlinkSync(PROFILE_PATH);
  }
  if (existsSync(CV_PATH)) {
    writeFileSync(BACKUP_CV, readFileSync(CV_PATH));
    unlinkSync(CV_PATH);
  }
}

function restore() {
  if (existsSync(BACKUP_PROFILE)) {
    writeFileSync(PROFILE_PATH, readFileSync(BACKUP_PROFILE));
    unlinkSync(BACKUP_PROFILE);
  }
  if (existsSync(BACKUP_CV)) {
    writeFileSync(CV_PATH, readFileSync(BACKUP_CV));
    unlinkSync(BACKUP_CV);
  }
}

describe("profile module", () => {
  beforeEach(() => {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    backup();
  });

  afterEach(() => {
    if (existsSync(PROFILE_PATH)) unlinkSync(PROFILE_PATH);
    if (existsSync(CV_PATH)) unlinkSync(CV_PATH);
    restore();
  });

  test("getProfile returns null when no profile exists", () => {
    assert.equal(getProfile(), null);
  });

  test("upsertProfile creates a new profile", () => {
    const result = upsertProfile("Alice", "alice@example.com");
    assert.deepEqual(result, { name: "Alice", email: "alice@example.com", hasCV: false });
    assert.ok(existsSync(PROFILE_PATH));
  });

  test("getProfile returns stored profile with hasCV flag", () => {
    upsertProfile("Bob", "bob@example.com");
    const profile = getProfile();
    assert.deepEqual(profile, { name: "Bob", email: "bob@example.com", hasCV: false });
  });

  test("getProfile reports hasCV=true when CV file exists", () => {
    upsertProfile("Carol", "carol@example.com");
    writeFileSync(CV_PATH, "fake pdf content");
    const profile = getProfile();
    assert.equal(profile?.hasCV, true);
  });

  test("upsertProfile overwrites existing profile", () => {
    upsertProfile("Dave", "dave@old.com");
    const updated = upsertProfile("Dave", "dave@new.com");
    assert.equal(updated.email, "dave@new.com");
    assert.equal(getProfile()?.email, "dave@new.com");
  });

  test("upsertProfile trims whitespace", () => {
    const result = upsertProfile("  Eve  ", "  eve@example.com  ");
    assert.equal(result.name, "Eve");
    assert.equal(result.email, "eve@example.com");
  });

  test("upsertProfile rejects empty name", () => {
    assert.throws(() => upsertProfile("", "test@test.com"), /Name is required/);
  });

  test("upsertProfile rejects empty email", () => {
    assert.throws(() => upsertProfile("Frank", ""), /Email is required/);
  });

  test("upsertProfile rejects invalid email format", () => {
    assert.throws(() => upsertProfile("Grace", "not-an-email"), /Invalid email format/);
  });

  test("removeProfile deletes profile and CV file", () => {
    upsertProfile("Henry", "henry@example.com");
    writeFileSync(CV_PATH, "fake pdf");
    removeProfile();
    assert.equal(existsSync(PROFILE_PATH), false);
    assert.equal(existsSync(CV_PATH), false);
    assert.equal(getProfile(), null);
  });

  test("removeProfile is safe to call when nothing exists", () => {
    assert.doesNotThrow(() => removeProfile());
  });
});
