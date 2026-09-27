import {execFileSync} from 'node:child_process';
const files=execFileSync('git',['diff','--cached','--name-only','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const forbidden=/(^|\/)(\.local|\.npm-cache|node_modules|\.next|dist)(\/|$)|(^|\/)\.env(\.|$)/;
const markers=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bgh[pousr]_[A-Za-z0-9]{30,}\b/,/\bgithub_pat_[A-Za-z0-9_]{40,}\b/,/\bAKIA[A-Z0-9]{16}\b/,/\bsk_live_[A-Za-z0-9]{20,}\b/];
const issues=[];
for(const file of files){if(forbidden.test(file)&&!file.endsWith('.env.example'))issues.push(file+': forbidden local/secret path');if(!/\.(ts|tsx|js|mjs|cjs|json|ya?ml|md|sql|ps1|cmd|example)$|(^|\/)(Dockerfile|\.gitignore|\.dockerignore)$/.test(file))continue;const content=execFileSync('git',['show',`:${file}`],{encoding:'utf8',maxBuffer:10*1024*1024});if(markers.some(p=>p.test(content)))issues.push(file+': credential marker');}
if(issues.length){console.error(issues.join('\n'));process.exit(1)}console.log(`Checked ${files.length} staged files; no forbidden paths or matching credential markers. This is a pattern scan, not a full security audit.`);
