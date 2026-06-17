import { spawn } from 'child_process';

function run(command, args) {
  const child = spawn(command, args, { stdio: 'inherit', shell: true });
  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Command ${command} ${args.join(' ')} exited with code ${code}`);
      process.exit(code ?? 1);
    }
  });
  return child;
}

run('npm', ['--prefix', 'apps/tauri', 'run', 'dev']);
