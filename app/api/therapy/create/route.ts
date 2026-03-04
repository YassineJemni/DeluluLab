import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { randomBytes } from "crypto";

function token() {
  return randomBytes(24).toString("hex");
}

export async function POST() {
  try {
    const a = token();
    const b = token();

    const { data, error } = await supabaseAdmin
      .from("therapy_sessions")
      .insert({ a_token: a, b_token: b })
      .select("id, a_token, b_token")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      sessionId: data.id,
      aLink: `/therapy/${data.id}?t=${data.a_token}`,
      bLink: `/therapy/${data.id}?t=${data.b_token}`,
    });
  } catch (e: any) {
    console.error("Create route crash:", e);
    return NextResponse.json(
      { error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}