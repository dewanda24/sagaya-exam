import fs from 'fs';
import path from 'path';

const envFiles = ['.env.local', '.env'];
for (const file of envFiles) {
  const envPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...rest] = trimmed.split('=');
        const val = rest.join('=').replace(/^["']|["']$/g, '').trim();
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = val;
        }
      }
    });
  }
}
