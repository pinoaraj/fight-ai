import { NextRequest, NextResponse } from 'next/server';

function requestHostname(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const raw = forwarded || request.headers.get('host') || request.nextUrl.hostname;
  return raw.replace(/^\[|\]$/g, '').split(':')[0].toLowerCase();
}

function isLocalHostname(hostname: string) {
  if (hostname === 'localhost' || hostname === '::1' || hostname.endsWith('.local')) return true;
  if (/^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname)) return true;
  const match = hostname.match(/^172\.(\d{1,3})\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

export function middleware(request: NextRequest) {
  if (isLocalHostname(requestHostname(request))) return NextResponse.next();

  const username = (process.env.FIGHT_AI_REMOTE_USER || 'fightai').trim();
  const password = (process.env.FIGHT_AI_REMOTE_PASSWORD || '').trim();
  if (!password) {
    return new NextResponse('El acceso remoto de Fight AI no esta configurado.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const expected = `Basic ${btoa(`${username}:${password}`)}`;
  if (request.headers.get('authorization') !== expected) {
    return new NextResponse('Autenticacion requerida para Fight AI.', {
      status: 401,
      headers: {
        'Cache-Control': 'no-store',
        'WWW-Authenticate': 'Basic realm="Fight AI", charset="UTF-8"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
