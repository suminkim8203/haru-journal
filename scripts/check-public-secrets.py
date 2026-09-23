"""Read-only, targeted public-secret scan. Never print matching values.

This detects a few high-confidence formats; it is not a proof of absence of
all secrets, and does not read ignored environment files or browser storage.
"""
import argparse
import base64
import json
from pathlib import Path
import re
import subprocess
from datetime import datetime, timezone

PATTERNS = {
    'private_key': re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    'supabase_secret_key': re.compile(rb'\bsb_secret_[A-Za-z0-9_-]{20,}'),
    'resend_key': re.compile(rb'\bre_[A-Za-z0-9_]{24,}'),
}
JWT = re.compile(rb'\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{20,}')

def detected(data):
    result = {name for name, pattern in PATTERNS.items() if pattern.search(data)}
    for match in JWT.finditer(data):
        try:
            part = match.group().split(b'.')[1]
            payload = json.loads(base64.urlsafe_b64decode(part + b'=' * (-len(part) % 4)))
            if payload.get('role') == 'service_role':
                result.add('service_role_jwt')
            elif payload.get('session_id') or payload.get('role') == 'authenticated':
                result.add('user_access_jwt')
        except (ValueError, TypeError):
            pass
    return sorted(result)

def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], stderr=subprocess.DEVNULL)

def scan(root, build):
    report = {'checkedAt': datetime.now(timezone.utc).isoformat(),
              'head': git(root, 'rev-parse', 'HEAD').decode().strip(),
              'scope': 'Tracked working files, all reachable Git blobs, optional static build',
              'detectors': [*PATTERNS, 'service_role_jwt', 'user_access_jwt'],
              'limitations': ['No generic password detection', 'No server logs or unreferenced Git objects',
                              'Files over 8 MiB and binary files are skipped',
                              'Public anon JWTs are not server secrets'],
              'counts': {'tracked': 0, 'historyBlobs': 0, 'build': 0, 'skipped': 0},
              'findings': []}
    def inspect(data, scope, name):
        if len(data) > 8 * 1024 * 1024 or b'\0' in data[:8192]:
            report['counts']['skipped'] += 1
            return
        report['counts'][scope] += 1
        for kind in detected(data):
            report['findings'].append({'scope': scope, 'fileOrObject': name, 'kind': kind})

    for raw in git(root, 'ls-files', '-z').split(b'\0'):
        if not raw:
            continue
        name = raw.decode('utf-8')
        path = root / name
        if path.is_file():
            inspect(path.read_bytes(), 'tracked', name)

    objects = git(root, 'rev-list', '--objects', '--all').decode().splitlines()
    proc = subprocess.Popen(['git', '-C', str(root), 'cat-file', '--batch'],
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        for line in objects:
            oid = line.split(' ', 1)[0]
            proc.stdin.write((oid + '\n').encode()); proc.stdin.flush()
            metadata = proc.stdout.readline().split()
            if len(metadata) != 3:
                raise RuntimeError('Unexpected Git object response')
            kind, size = metadata[1], int(metadata[2])
            data = proc.stdout.read(size)
            proc.stdout.read(1)
            if kind == b'blob':
                inspect(data, 'historyBlobs', oid)
    finally:
        proc.stdin.close(); proc.stdout.close(); proc.wait()

    if build:
        for path in build.rglob('*'):
            if path.is_file():
                inspect(path.read_bytes(), 'build', path.relative_to(build).as_posix())
    report['passedTargetedScan'] = not report['findings']
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--build', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = scan(args.root.resolve(), args.build.resolve() if args.build else None)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'passedTargetedScan': report['passedTargetedScan'],
                      'counts': report['counts'], 'findingCount': len(report['findings']),
                      'report': str(args.output)}, ensure_ascii=False))
    raise SystemExit(0 if report['passedTargetedScan'] else 1)
