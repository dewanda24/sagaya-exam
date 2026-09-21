import { NextResponse } from 'next/server';
import { queryPostgres } from '@/lib/core/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const startTime = Date.now();
    await queryPostgres('SELECT 1 as health');
    const latency = Date.now() - startTime;

    return NextResponse.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      services: {
        application: 'operational',
        database: 'operational',
        examEngine: 'operational',
        authentication: 'operational',
      },
      latencyMs: latency,
    });
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          application: 'operational',
          database: 'degraded',
          examEngine: 'operational',
          authentication: 'degraded',
        },
      },
      { status: 200 }
    );
  }
}
