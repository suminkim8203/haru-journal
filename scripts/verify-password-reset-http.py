"""Operator-run NAS check: disposable account, public reset API, redacted evidence.

Run on the authorized Haru NAS as a Docker-capable operator. Never uses an
existing user's account. Passwords, OTP and tokens stay in process memory.
The operator must explicitly select --run; importing this file has no effects.
"""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import time
import urllib.error
import urllib.request
import uuid

BASE = 'https://haruleaf.com'


def main(output):
    os.umask(0o077)
    report = {
        'checkedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'passed': False, 'requests': [],
        'scope': 'Disposable account; public recovery verify and password update; diary token revocation',
        'limitations': [
            'Recovery code generated through internal Auth admin endpoint; email delivery not tested here',
            'Does not test browser rendering or all Auth endpoints after revocation',
            'Test account retained without an active test session; no real user data modified',
        ],
    }
    tokens = []
    stage = 'configuration'
    env = {}

    def request(method, url, body=None, token=None):
        headers = {'Content-Type': 'application/json', 'apikey': env['SUPABASE_ANON_KEY']}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        req = urllib.request.Request(url, method=method, headers=headers,
                                     data=None if body is None else json.dumps(body).encode())
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                raw = res.read()
                return res.status, json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            raw = exc.read()
            try:
                return exc.code, json.loads(raw) if raw else {}
            except ValueError:
                return exc.code, {}

    def evidence(label, method, path, status, response, body, credential):
        report['requests'].append({
            'case': label, 'method': method, 'url': BASE + path,
            'headers': {'Authorization': 'Bearer [REDACTED]', 'apikey': '[REDACTED]'},
            'credentialAlias': credential, 'body': body, 'status': status, 'response': response,
        })

    def require(condition):
        if not condition:
            raise RuntimeError('Verification assertion failed')

    def snapshot(token):
        return request('POST', BASE + '/rest/v1/rpc/haru_snapshot', {}, token)

    try:
        edge = json.loads(subprocess.check_output(['docker', 'inspect', 'supabase-edge-functions'], stderr=subprocess.DEVNULL))[0]
        env = dict(v.split('=', 1) for v in edge['Config']['Env'])
        auth = json.loads(subprocess.check_output(['docker', 'inspect', 'supabase-auth'], stderr=subprocess.DEVNULL))[0]
        internal = 'http://' + next(iter(auth['NetworkSettings']['Networks'].values()))['IPAddress'] + ':9999'
        email = 't07-reset-' + uuid.uuid4().hex + '@example.invalid'
        old_password, new_password = secrets.token_urlsafe(24), secrets.token_urlsafe(24)
        stage = 'create disposable test account'
        status, user = request('POST', internal + '/admin/users', {
            'email': email, 'password': old_password, 'email_confirm': True,
            'app_metadata': {'haru_t07_verification': True, 'purpose': 'password-reset-http'},
        }, env['SUPABASE_SERVICE_ROLE_KEY'])
        require(status in (200, 201))
        report['testAccount'] = {'id': user['id'], 'testOnly': True}
        stage = 'initial public login'
        status, login = request('POST', BASE + '/auth/v1/token?grant_type=password', {'email': email, 'password': old_password})
        require(status == 200)
        old_token = login['access_token']; tokens.append(old_token)
        report['accessTokenExpiresInSeconds'] = login.get('expires_in')
        require(request('POST', BASE + '/rest/v1/rpc/haru_setup_account', {}, old_token)[0] == 200)
        stage = 'snapshot before reset'
        status, before = snapshot(old_token)
        evidence('before password reset', 'POST', '/rest/v1/rpc/haru_snapshot', status,
                 {'diaryId': before.get('diaryId'), 'planCount': len(before.get('plans', []))}, {}, 'original-login-token')
        require(status == 200)
        stage = 'prepare recovery code without email delivery'
        status, generated = request('POST', internal + '/admin/generate_link', {'type': 'recovery', 'email': email}, env['SUPABASE_SERVICE_ROLE_KEY'])
        require(status == 200 and bool(generated.get('email_otp')))
        stage = 'verify public recovery code'
        status, recovery = request('POST', BASE + '/auth/v1/verify', {'type': 'recovery', 'email': email, 'token': generated['email_otp']})
        evidence('recovery code verified', 'POST', '/auth/v1/verify', status,
                 {'sessionIssued': bool(recovery.get('access_token'))},
                 {'type': 'recovery', 'email': '[TEST EMAIL REDACTED]', 'token': '[REDACTED]'}, 'none')
        require(status == 200)
        recovery_token = recovery['access_token']; tokens.append(recovery_token)
        stage = 'public password reset'
        status, changed = request('PUT', BASE + '/auth/v1/user', {'password': new_password}, recovery_token)
        evidence('password reset accepted', 'PUT', '/auth/v1/user', status,
                 {'sameTestUser': changed.get('id') == user['id']}, {'password': '[REDACTED]'}, 'recovery-token')
        require(status == 200 and changed.get('id') == user['id'])
        stage = 'original token replay before logout'
        status, denied = snapshot(old_token)
        evidence('same original token after reset BEFORE any logout', 'POST', '/rest/v1/rpc/haru_snapshot', status,
                 {k: denied.get(k) for k in ('code', 'message', 'details', 'hint')}, {}, 'original-login-token')
        require(status == 401)
        stage = 'old password rejected'
        status, denied = request('POST', BASE + '/auth/v1/token?grant_type=password', {'email': email, 'password': old_password})
        evidence('old password login', 'POST', '/auth/v1/token?grant_type=password', status,
                 {k: denied.get(k) for k in ('code', 'error_code', 'msg')},
                 {'email': '[TEST EMAIL REDACTED]', 'password': '[REDACTED]'}, 'none')
        require(status in (400, 401))
        stage = 'new password login and data preservation'
        status, fresh = request('POST', BASE + '/auth/v1/token?grant_type=password', {'email': email, 'password': new_password})
        require(status == 200)
        tokens.append(fresh['access_token'])
        status, after = snapshot(fresh['access_token'])
        evidence('new password session', 'POST', '/rest/v1/rpc/haru_snapshot', status,
                 {'diaryId': after.get('diaryId'), 'snapshotUnchanged': after == before}, {}, 'new-login-token')
        require(status == 200 and before == after)
        report['passed'] = True
    except Exception as exc:
        # Never serialize exception text: third-party errors can contain secrets.
        report['failure'] = {'stage': stage, 'type': type(exc).__name__}
    finally:
        cleanup = []
        for token in tokens:
            try:
                cleanup.append(request('POST', BASE + '/auth/v1/logout?scope=local', None, token)[0])
            except Exception:
                cleanup.append('network_error')
        report['sessionCleanupStatuses'] = cleanup
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        os.chmod(output, 0o600)
        print(json.dumps({'passed': report['passed'], 'failure': report.get('failure'),
                          'requestCount': len(report['requests']), 'report': str(output)}))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', action='store_true', help='Operator authorizes creation/reset of this disposable test account')
    parser.add_argument('--output', type=Path, default=Path('/tmp/haru-password-reset-http.json'))
    args = parser.parse_args()
    if not args.run:
        parser.error('No changes made. Run explicitly with --run on the authorized NAS.')
    raise SystemExit(main(args.output))
