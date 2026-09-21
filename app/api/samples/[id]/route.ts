import { NextResponse } from "next/server"
import { SAMPLE_SOURCES } from "@/lib/reality5/data-source"

/** Raw sample tracking JSON — the client runs it through the same adapter as an upload. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sample = SAMPLE_SOURCES.find((s) => s.id === id)
  if (!sample) return NextResponse.json({ error: "Unknown sample" }, { status: 404 })
  return NextResponse.json(sample.raw)
}
