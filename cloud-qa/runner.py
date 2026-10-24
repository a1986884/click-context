"""One interactively started Colab job. No persistent service or remote-control loop."""
import hashlib, json, os, pathlib, platform, shutil, subprocess, sys, tarfile, time, urllib.request


def main(config):
    root = pathlib.Path.cwd()
    manifest = config['manifest']
    env = os.environ.copy()
    env['RELEASE_COMMIT'] = manifest['sourceCommit']
    env['PLAYWRIGHT_BROWSERS_PATH'] = str(root / '.browsers')
    env['HEADED'] = '1'
    env['LIVE_COLLINS'] = '1'
    last_report = 0.0
    stage = 'startup'
    native_exit = None
    stage_log = ''

    def offscreen_report():
        path = root / 'test-results' / 'offscreen-extension.json'
        if not path.is_file():
            return {'status': 'not-run'}
        if path.stat().st_size > 16 * 1024:
            return {'status': 'failed', 'error': 'Offscreen report exceeds 16 KiB'}
        try:
            value = json.loads(path.read_text())
            return value if isinstance(value, dict) else {'status': 'failed', 'error': 'Invalid offscreen report'}
        except (ValueError, OSError):
            return {'status': 'failed', 'error': 'Unreadable offscreen report'}

    def send(status, **extra):
        nonlocal last_report
        time.sleep(max(0, 1.1 - (time.monotonic() - last_report)))
        payload = {'sourceCommit': manifest['sourceCommit'], 'runId': config['runId'], 'status': status, 'stage': stage, 'offscreenReport': offscreen_report(), **extra}
        req = urllib.request.Request(config['endpoint'] + '/report', data=json.dumps(payload).encode(), headers={'Authorization': 'Bearer ' + config['token'], 'Content-Type': 'application/json', 'User-Agent': 'Lextide-Cloud-QA/1.0 (interactive notebook acceptance test)'}, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                value = json.load(response)
            last_report = time.monotonic()
            return value
        except Exception as error:
            print('结果回传暂未成功：', type(error).__name__, flush=True)
            return None

    def run(name, command, timeout=300, check=True):
        nonlocal stage, stage_log
        stage = name
        print('\n▶', name, flush=True)
        send('running')
        stage_log = ''
        try:
            result = subprocess.run(command, cwd=root, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=timeout)
        except subprocess.TimeoutExpired as error:
            output = error.stdout or ''
            stage_log = (output.decode(errors='replace') if isinstance(output, bytes) else output)[-6000:]
            raise RuntimeError(name + ' timed out after ' + str(timeout) + ' seconds') from error
        # No API credentials are passed to the subprocess; print only a bounded log tail.
        stage_log = result.stdout[-6000:]
        print(stage_log, flush=True)
        if check and result.returncode:
            raise RuntimeError(name + ' failed (exit ' + str(result.returncode) + ')')
        return result

    try:
        send('preparing')
        # Colab's stock Node version may be too old. Install the official Node 22 release,
        # checking the archive against the official HTTPS checksum list.
        arch = {'x86_64': 'x64', 'aarch64': 'arm64'}.get(platform.machine())
        if not arch:
            raise RuntimeError('Unsupported cloud CPU architecture')
        distribution = 'https://nodejs.org/dist/latest-v22.x/'
        with urllib.request.urlopen(distribution + 'SHASUMS256.txt', timeout=60) as response:
            lines = response.read(1024 * 1024).decode().splitlines()
        checksum, filename = next(line.split() for line in lines if line.endswith('-linux-' + arch + '.tar.xz'))
        node_archive = root / 'node.tar.xz'
        with urllib.request.urlopen(distribution + filename, timeout=120) as response, node_archive.open('wb') as output:
            shutil.copyfileobj(response, output)
        if hashlib.sha256(node_archive.read_bytes()).hexdigest() != checksum:
            raise RuntimeError('Official Node checksum mismatch')
        with tarfile.open(node_archive) as archive:
            archive.extractall(root / '.node', filter='data')
        env['PATH'] = str(root / '.node' / filename.removesuffix('.tar.xz') / 'bin') + os.pathsep + env['PATH']
        run('安装项目依赖', ['npm', 'ci', '--ignore-scripts'])
        run('代码检查', ['npm', 'run', 'check'])
        run('运行单元与权限契约测试', ['npm', 'test'])
        # This fresh, independent cloud runtime must allow extension testing. Any
        # administrator/identity restriction is reported, never overridden.
        run('安装云端浏览器及系统依赖', ['npx', 'playwright', 'install', '--with-deps', 'chromium'], timeout=600)
        if not shutil.which('xvfb-run') or not shutil.which('xauth'):
            run('安装虚拟显示依赖', ['apt-get', 'install', '-y', 'xvfb', 'xauth'])
        run('构建并运行全部普通浏览器回归（不代表原生安装）', ['npm', 'run', 'test:browser'], timeout=600)
        run('验证真实安装扩展的 offscreen 原生解析与真实查词', ['xvfb-run', '-a', 'npm', 'run', 'test:offscreen-extension'])
        result = run('真实安装插件与有道 Collins 查询验收', ['xvfb-run', '-a', 'npm', 'run', 'test:extension'], timeout=600, check=False)
        native_exit = result.returncode
        report_path = root / 'test-results' / 'extension-report.json'
        native = json.loads(report_path.read_text()) if report_path.is_file() else {'status': 'failed', 'failure': 'Native suite produced no report'}
        if report_path.is_file() and report_path.stat().st_size > 100 * 1024:
            native = {key: native.get(key) for key in ['kind', 'status', 'extensionId', 'extensionVersion', 'extensionFingerprint', 'browserVersion', 'checks', 'liveDictionary', 'failure', 'fixtureFailure', 'dictionaryResponses', 'dictionaryNetworkFailures', 'englishPageDiagnostic', 'contextAPI', 'liveContext']}
        accepted = send('finished', exitCode=native_exit, nativeReport=native)
        print('\n原生测试状态：', native.get('status'), flush=True)
        if native.get('liveDictionary'):
            print('Collins 查询结果：', json.dumps(native['liveDictionary'], ensure_ascii=False), flush=True)
        if not accepted or not accepted.get('nativeAcceptancePassed'):
            print('尚未通过完整安装验收；不会把构建或页面测试成功当作通过。', flush=True)
            return 1
        print('已完成真实插件安装、原生 offscreen 解析、有道 Collins 查询与重复点词测速，结果已回传。', flush=True)
        return 0
    except Exception as error:
        print('测试停止：', str(error)[:2000], flush=True)
        send('error', exitCode=native_exit, error=str(error)[:4000], stageLog=stage_log)
        return 1

if __name__ == '__main__':
    sys.exit(main(json.load(sys.stdin)))
