"""Build a private cloud test bundle and notebook. Secrets stay outside the repository."""
import argparse, base64, hashlib, json, pathlib, subprocess, zipfile
parser = argparse.ArgumentParser()
parser.add_argument('--out', required=True)
args = parser.parse_args()
root = pathlib.Path.cwd()
out = pathlib.Path(args.out)
out.mkdir(parents=True, exist_ok=True)
paths = subprocess.check_output(['git', 'ls-files', '-z']).decode().strip('\0').split('\0')
archive = out / 'source.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for name in paths:
        if name.startswith(('assets/', 'src/', 'demo/', 'extension/', 'scripts/', 'tests/', 'cloud-qa/', 'workers/')) or name in ['package.json', 'package-lock.json', 'LICENSE']:
            bundle.write(root / name, name)
release = json.loads((root / 'build/packages/release.json').read_text())
manifest = {'version': release['version'], 'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode().strip(), 'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'extensionFingerprint': release['extensionFingerprint'], 'dictionaryProvider': 'youdao-collins-public-page', 'kind': 'native Chromium extension acceptance', 'requiresInteractiveNotebookStart': True}
(out / 'manifest.json').write_text(json.dumps(manifest, indent=2))
entry = "import {createCloudQA} from './cloud-qa/worker.mjs';export default createCloudQA(" + json.dumps({'manifest': manifest, 'bundle': base64.b64encode(archive.read_bytes()).decode()}) + ');'
(out / 'entry.js').write_text(entry)
print(json.dumps({'version': manifest['version'], 'sourceCommit': manifest['sourceCommit'], 'archiveBytes': archive.stat().st_size}))
