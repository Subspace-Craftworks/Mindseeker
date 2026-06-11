import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_TABLES = ["subjects", "issues", "tasks", "events"];

export async function PATCH(req: NextRequest, context: { params: Promise<{ table: string; id: string }> }) {
  try {
    const { user } = await requireSupabaseUser(req);
    const { table, id } = await context.params;

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "Invalid table" } }, { status: 400 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status !== undefined) updates.status = body.status;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to update record" } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ table: string; id: string }> }) {
  try {
    const { user } = await requireSupabaseUser(req);
    const { table, id } = await context.params;

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "Invalid table" } }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, data: null });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to delete record" } },
      { status: 500 }
    );
  }
}
