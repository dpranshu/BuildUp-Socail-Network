import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ blockedId: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { blockedId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Sign in to unblock this account." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", blockedId)
      .select("blocked_id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ message: "Unable to unblock this account." }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ message: "This account is not in your blocked list." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Unable to unblock this account." }, { status: 500 });
  }
}
