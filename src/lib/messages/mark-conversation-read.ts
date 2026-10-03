import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type ServerSupabaseClient = SupabaseClient<Database>;

export async function markConversationRead(
  supabase: ServerSupabaseClient,
  conversationId: string,
  userId: string,
) {
  const lastReadAt = new Date().toISOString();
  const update = await supabase.from("conversation_reads")
    .update({ last_read_at: lastReadAt })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .select("conversation_id")
    .maybeSingle();
  if (update.error) return update.error;
  if (update.data) return null;

  const insert = await supabase.from("conversation_reads")
    .insert({ conversation_id: conversationId, user_id: userId, last_read_at: lastReadAt });
  if (insert.error?.code !== "23505") return insert.error;

  const retry = await supabase.from("conversation_reads")
    .update({ last_read_at: lastReadAt })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .select("conversation_id")
    .maybeSingle();

  if (retry.error) return retry.error;
  return retry.data ? null : {
    code: "PGRST116",
    message: "The conversation read receipt could not be updated.",
  };
}
