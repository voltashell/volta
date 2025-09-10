'use client';

import { Auth0Provider } from '@auth0/auth0-react';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN || '';
  const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || '';
  const redirectUri = process.env.NEXT_PUBLIC_AUTH0_CALLBACK_URL || 'http://localhost:3000';

  return (
    <Auth0Provider domain={domain} clientId={clientId} authorizationParams={{ redirect_uri: redirectUri }}>
      {children}
    </Auth0Provider>
  );
}
