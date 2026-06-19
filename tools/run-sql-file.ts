import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (let line of content.split('\n')) {
      const commentIndex = line.indexOf('#');
      if (commentIndex !== -1) line = line.substring(0, commentIndex);
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val.trim();
      }
    }
  }
}

loadEnv();

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF;

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx tools/run-sql-file.ts <path-to-sql-file>");
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  const sql = fs.readFileSync(resolvedPath, 'utf-8');

  console.log(`Executing SQL from: ${resolvedPath}`);
  const res = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed: ${res.status} - ${err}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log("Success:", JSON.stringify(data, null, 2));
}

main();
