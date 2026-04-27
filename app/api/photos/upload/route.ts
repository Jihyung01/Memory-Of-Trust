import {
  createSupabaseUserClient,
  fetchFamilyMemberForElder,
  insertFamilyPhoto,
  uploadFamilyPhoto,
} from "@/lib/supabase/family";

export const dynamic = "force-dynamic";

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
}

function readOptionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalYear(value: FormDataEntryValue | null): number | null {
  const text = readOptionalString(value);

  if (!text) {
    return null;
  }

  const year = Number.parseInt(text, 10);
  return Number.isFinite(year) ? year : null;
}

function readPeople(value: FormDataEntryValue | null): string[] | null {
  const text = readOptionalString(value);

  if (!text) {
    return null;
  }

  const people = text
    .split(",")
    .map((person) => person.trim())
    .filter(Boolean);

  return people.length > 0 ? people : null;
}

function createStoragePath(input: { elderId: string; file: File }): string {
  const extension = input.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "jpg";

  return `${input.elderId}/${crypto.randomUUID()}.${safeExtension}`;
}

export async function POST(request: Request) {
  try {
    const accessToken = readBearerToken(request);

    if (!accessToken) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const elderId = readOptionalString(formData.get("elder_id"));
    const photo = formData.get("photo");

    if (!elderId || !(photo instanceof File) || photo.size === 0) {
      return Response.json({ error: "Invalid form data" }, { status: 400 });
    }

    const db = createSupabaseUserClient(accessToken);
    const member = await fetchFamilyMemberForElder(db, elderId);

    if (!member) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const storagePath = createStoragePath({ elderId, file: photo });

    await uploadFamilyPhoto({
      db,
      file: photo,
      storagePath,
    });

    const inserted = await insertFamilyPhoto({
      db,
      elderId,
      uploadedBy: member.id,
      storagePath,
      caption: readOptionalString(formData.get("caption")),
      approximateYear: readOptionalYear(formData.get("approximate_year")),
      peopleInPhoto: readPeople(formData.get("people_in_photo")),
    });

    return Response.json({ photo_id: inserted.id });
  } catch (error) {
    console.error("POST /api/photos/upload error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
