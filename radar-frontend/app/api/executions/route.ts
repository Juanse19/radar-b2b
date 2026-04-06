import { NextRequest, NextResponse } from 'next/server';
import { getRecentExecutions } from '@/lib/n8n';

const N8N_WORKFLOW_ID = process.env.N8N_WORKFLOW_ID || 'cB6VI7ZPS4fFVi-dAk4RG';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? '10'), 50);

  try {
    const executions = await getRecentExecutions(N8N_WORKFLOW_ID, limit);
    return NextResponse.json(executions);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[GET /api/executions] Error:', msg);
    return NextResponse.json([], { status: 200 });
  }
}
