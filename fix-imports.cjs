const fs = require('fs');
const path = require('path');

const replacements = {
  '@/lib/app-logs': '@/lib/db/app-logs',
  '@/lib/chat-threads': '@/lib/db/chat-threads',
  '@/lib/context-map': '@/lib/db/context-map',
  '@/lib/goals': '@/lib/db/goals',
  '@/lib/dify': '@/lib/api/dify',
  '@/lib/planning-api': '@/lib/api/planning-api',
  '@/lib/env': '@/lib/utils/env',
  '@/components/app-shell': '@/components/layout/app-shell',
  '@/components/chat-workspace': '@/components/features/chat/chat-workspace',
  '@/components/goals-workspace': '@/components/features/goals/goals-workspace',
  '@/components/login-panel': '@/components/features/auth/login-panel',
};

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const [oldImport, newImport] of Object.entries(replacements)) {
        // match exact imports like "@/lib/env"
        const regex = new RegExp(`['"]${oldImport}['"]`, 'g');
        if (regex.test(content)) {
          content = content.replace(regex, `"${newImport}"`);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(path.join(process.cwd(), 'app'));
processDirectory(path.join(process.cwd(), 'lib'));
processDirectory(path.join(process.cwd(), 'components'));
