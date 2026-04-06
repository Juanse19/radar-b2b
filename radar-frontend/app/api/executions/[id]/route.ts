import { NextRequest, NextResponse } from 'next/server';
import { getExecutionStatus } from '@/lib/n8n';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const status = await getExecutionStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
