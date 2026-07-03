import { NextResponse } from "next/server";
import { runProtocolModule } from "@/app/lib/aida2/modules/protocolModule";

export async function GET() {
  const protocol = runProtocolModule();

  return NextResponse.json(protocol);
}