import { NextResponse } from "next/server";
import {
  hasValidPreviewE2ETrigger,
  isPreviewVercelRuntime,
} from "../../../../lib/persistence/previewSupabaseE2ETrigger";
import { runSupabaseSyntheticE2E } from "../../../../scripts/supabase-synthetic-e2e.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isPreviewVercelRuntime()) return new NextResponse(null, { status: 404 });
  if (!hasValidPreviewE2ETrigger(request.headers.get("authorization")))
    return new NextResponse(null, { status: 401 });
  try {
    const result = await runSupabaseSyntheticE2E();
    return NextResponse.json(
      { status: result.status, scenarios: result.scenarios },
      { status: result.status === "PASS" ? 200 : 500 },
    );
  } catch {
    return NextResponse.json(
      {
        status: "FAIL",
        scenarios: [{ name: "runtime protegido", status: "FAIL" }],
      },
      { status: 500 },
    );
  }
}
