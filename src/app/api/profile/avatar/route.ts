import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const avatarTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const maxAvatarSize = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to upload a profile photo." }, { status: 401 });

  const { data: currentProfile, error: lookupError } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  if (lookupError || !currentProfile) {
    return NextResponse.json({ message: "Unable to load your profile." }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Choose an image to upload." }, { status: 400 });
  }
  if (!avatarTypes[file.type]) {
    return NextResponse.json({ message: "Use a JPEG, PNG, or WebP image." }, { status: 400 });
  }
  if (file.size === 0 || file.size > maxAvatarSize) {
    return NextResponse.json({ message: "Avatar images must be between 1 byte and 5 MB." }, { status: 413 });
  }

  const objectPath = `${user.id}/${crypto.randomUUID()}.${avatarTypes[file.type]}`;
  const bucket = supabase.storage.from("avatars");
  const { error: uploadError } = await bucket.upload(objectPath, file, {
    cacheControl: "31536000",
    contentType: file.type,
  });
  if (uploadError) return NextResponse.json({ message: "Unable to upload profile photo." }, { status: 500 });

  const avatarUrl = bucket.getPublicUrl(objectPath).data.publicUrl;
  const { data: updatedProfile, error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (profileError || !updatedProfile) {
    await bucket.remove([objectPath]);
    return NextResponse.json({ message: "Unable to save profile photo." }, { status: 500 });
  }

  if (currentProfile.avatar_url) {
    try {
      const previousUrl = new URL(currentProfile.avatar_url);
      const projectOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
      const bucketMarker = "/storage/v1/object/public/avatars/";
      const markerIndex = previousUrl.pathname.indexOf(bucketMarker);
      const previousPath = markerIndex >= 0
        ? decodeURIComponent(previousUrl.pathname.slice(markerIndex + bucketMarker.length))
        : "";
      if (previousUrl.origin === projectOrigin && previousPath.startsWith(`${user.id}/`)) {
        await bucket.remove([previousPath]).catch(() => null);
      }
    } catch {
      return NextResponse.json({ avatarUrl });
    }
  }

  return NextResponse.json({ avatarUrl });
}