import * as fs   from 'fs';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth/tokens.json');

export default async function globalSetup() {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  const res = await fetch('http://localhost:3000/v1/auth/login', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email: 'admin@sharayudental.com', password: 'Password123' }),
  });

  if (!res.ok) {
    throw new Error(`Global auth setup failed: ${res.status} ${await res.text()}`);
  }

  const data: any = await res.json();
  fs.writeFileSync(AUTH_FILE, JSON.stringify({
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    user:          data.user,
  }));

  console.log(`[global-setup] Auth tokens saved for ${data.user?.email}`);
}
