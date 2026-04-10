import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { extractEmail } from "./apply.js";

describe("extractEmail", () => {
  test("extracts a simple email", () => {
    assert.equal(extractEmail("Contact us at jobs@example.com for details."), "jobs@example.com");
  });

  test("extracts email with dots and plus signs", () => {
    assert.equal(extractEmail("Send CV to hire.me+jobs@company.co.uk"), "hire.me+jobs@company.co.uk");
  });

  test("returns null when no email is present", () => {
    assert.equal(extractEmail("No email here, just some text."), null);
  });

  test("returns null for empty input", () => {
    assert.equal(extractEmail(""), null);
  });

  test("returns the first email when multiple are present", () => {
    assert.equal(
      extractEmail("Primary: first@a.com, backup: second@b.com"),
      "first@a.com"
    );
  });

  test("skips noreply github emails", () => {
    const body = "Created by user@users.noreply.github.com. Contact real@company.com";
    assert.equal(extractEmail(body), "real@company.com");
  });

  test("returns null when only noreply emails exist", () => {
    assert.equal(extractEmail("Opened by bot@noreply.github.com"), null);
  });

  test("extracts email embedded in markdown", () => {
    const body = "## Contact\n\nEmail: **recruit@acme.io**\n\n[Apply here](https://acme.io/apply)";
    assert.equal(extractEmail(body), "recruit@acme.io");
  });

  test("handles email with subdomain", () => {
    assert.equal(extractEmail("Reach out: hr@careers.big-corp.com"), "hr@careers.big-corp.com");
  });

  test("handles whitespace-surrounded email", () => {
    assert.equal(extractEmail("  team@startup.io  "), "team@startup.io");
  });
});
