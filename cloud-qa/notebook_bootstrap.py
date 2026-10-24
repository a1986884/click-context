# Executed interactively in the user's Google Colab CPU notebook.
# No Drive mount, SSH, remote desktop, background worker, CAPTCHA solver or proxy.
import hashlib, io, json, pathlib, subprocess, sys, tempfile, urllib.request, uuid, zipfile

def download(path, limit):
    req = urllib.request.Request(QA_ENDPOINT + path, headers={'Authorization': 'Bearer ' + QA_TOKEN, 'User-Agent': 'Lextide-Cloud-QA/1.0 (interactive notebook acceptance test)'})
    with urllib.request.urlopen(req, timeout=60) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise RuntimeError('Cloud test download exceeded its size limit')
    return data

manifest = json.loads(download('/manifest', 16384))
archive = download('/bundle', 2 * 1024 * 1024)
if hashlib.sha256(archive).hexdigest() != manifest['archiveSha256']:
    raise RuntimeError('Source checksum mismatch; stopped before executing code')
workspace = pathlib.Path(tempfile.mkdtemp(prefix='lextide-native-qa-'))
with zipfile.ZipFile(io.BytesIO(archive)) as source:
    if len(source.infolist()) > 2000 or sum(item.file_size for item in source.infolist()) > 32 * 1024 * 1024:
        raise RuntimeError('Test archive exceeds extraction limits')
    for item in source.infolist():
        path = pathlib.PurePosixPath(item.filename)
        if path.is_absolute() or '..' in path.parts or item.file_size > 2 * 1024 * 1024:
            raise RuntimeError('Unsafe test archive')
    source.extractall(workspace)
print('已校验云端测试源码：', manifest['version'], manifest['sourceCommit'][:12])
# Keep the job credential in memory/stdin, not in child environment variables or logs.
config = json.dumps({'endpoint': QA_ENDPOINT, 'token': QA_TOKEN, 'manifest': manifest, 'runId': str(uuid.uuid4())})
result = subprocess.run([sys.executable, str(workspace / 'cloud-qa' / 'runner.py')], input=config, text=True, cwd=workspace, timeout=1800)
if result.returncode:
    raise RuntimeError('云端测试未通过，诊断结果已尝试回传；请保留此页的输出。')
