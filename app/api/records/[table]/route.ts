import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    const { user } = await requireSupabaseUser(req);
    const { table } = await params;
    
    // Only allow specific tables
    const allowedTables = ["subjects", "issues", "tasks", "events"];
    if (!allowedTables.includes(table)) {
      return NextResponse.json({ ok: false, error: { message: "Invalid table" } }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    // Ensure user_id is set
    const dataToInsert = { ...body, user_id: user.id };

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from(table)
      .insert(dataToInsert)
      .select("*")
      .single();

    if (error) {
      console.error(`Failed to insert into ${table}:`, error);
      return NextResponse.json(
        { ok: false, error: { message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: { message: msg } },
      { status: msg.includes("Unauthorized") ? 401 : 500 }
    );
  }
}
