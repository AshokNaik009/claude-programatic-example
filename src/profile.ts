import { loadProfile, saveProfile, deleteProfile as deleteProfileStorage, hasCV } from "./storage.js";
import type { Profile } from "./types.js";

export interface ProfileResponse {
  name: string;
  email: string;
  hasCV: boolean;
}

export function getProfile(): ProfileResponse | null {
  const profile = loadProfile();
  if (!profile) return null;
  return { ...profile, hasCV: hasCV() };
}

export function upsertProfile(name: string, email: string): ProfileResponse {
  const trimmedName = name?.trim();
  const trimmedEmail = email?.trim();

  if (!trimmedName) throw new Error("Name is required");
  if (!trimmedEmail) throw new Error("Email is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new Error("Invalid email format");
  }

  const profile: Profile = { name: trimmedName, email: trimmedEmail };
  saveProfile(profile);
  return { ...profile, hasCV: hasCV() };
}

export function removeProfile(): void {
  deleteProfileStorage();
}
