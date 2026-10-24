"""Exercise the notebook runner orchestration without network or installations."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import subprocess
import tempfile
import unittest
from unittest.mock import MagicMock, patch

spec = importlib.util.spec_from_file_location('cloud_runner', pathlib.Path(__file__).resolve().parents[1] / 'cloud-qa/runner.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class RunnerReports(unittest.TestCase):
    def execute(self, scenario):
        reports, commands = [], []
        archive = b'synthetic node archive'
        checksum = hashlib.sha256(archive).hexdigest()
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            (root / 'test-results').mkdir()
            offscreen = {'status': 'passed', 'extensionVersion': 'unit', 'offscreenCreateMs': 12}
            native = {'status': 'passed', 'extensionVersion': 'unit'}

            def urlopen(request, **_):
                url = request if isinstance(request, str) else request.full_url
                if url.endswith('/report'):
                    payload = json.loads(request.data)
                    reports.append(payload)
                    return io.BytesIO(json.dumps({'nativeAcceptancePassed': payload['status'] == 'finished' and payload['exitCode'] == 0}).encode())
                if url.endswith('SHASUMS256.txt'):
                    return io.BytesIO((checksum + ' node-v22.0.0-linux-x64.tar.xz').encode())
                return io.BytesIO(archive)

            def run(command, **_):
                commands.append(command)
                if 'test:offscreen-extension' in command:
                    if scenario == 'blocked':
                        offscreen['status'] = 'blocked-by-policy'
                    (root / 'test-results/offscreen-extension.json').write_text(json.dumps(offscreen))
                    if scenario == 'timeout':
                        raise subprocess.TimeoutExpired(command, 300, output=b'offscreen current timeout diagnostic')
                    if scenario == 'malformed':
                        (root / 'test-results/offscreen-extension.json').write_text('{invalid')
                        return subprocess.CompletedProcess(command, 1, stdout='malformed report diagnostic')
                    if scenario == 'oversized':
                        (root / 'test-results/offscreen-extension.json').write_text('x' * (16 * 1024 + 1))
                        return subprocess.CompletedProcess(command, 1, stdout='oversized report diagnostic')
                    return subprocess.CompletedProcess(command, 2 if scenario == 'blocked' else 0, stdout='offscreen current diagnostic')
                if 'test:extension' in command:
                    if scenario == 'native-timeout':
                        raise subprocess.TimeoutExpired(command, 600, output=b'native current timeout diagnostic')
                    (root / 'test-results/extension-report.json').write_text(json.dumps(native))
                    return subprocess.CompletedProcess(command, 1 if scenario == 'native-failed' else 0, stdout='native current diagnostic')
                return subprocess.CompletedProcess(command, 0, stdout='previous stage output')

            previous = pathlib.Path.cwd()
            try:
                os.chdir(root)
                with patch.object(runner.urllib.request, 'urlopen', side_effect=urlopen), patch.object(runner.subprocess, 'run', side_effect=run), patch.object(runner.tarfile, 'open', return_value=MagicMock()), patch.object(runner.shutil, 'which', return_value='/synthetic/bin'), patch.object(runner.platform, 'machine', return_value='x86_64'), patch.object(runner.time, 'sleep'), contextlib.redirect_stdout(io.StringIO()):
                    code = runner.main({'manifest': {'sourceCommit': 'synthetic-commit'}, 'runId': 'test-run', 'endpoint': 'https://unit.invalid', 'token': 'synthetic-test-token'})
            finally:
                os.chdir(previous)
        return code, reports, commands

    def test_complete_run_uploads_both_reports(self):
        code, reports, _ = self.execute('passed')
        self.assertEqual(code, 0)
        self.assertEqual(reports[-1]['status'], 'finished')
        self.assertEqual(reports[-1]['nativeReport']['status'], 'passed')
        self.assertEqual(reports[-1]['offscreenReport']['status'], 'passed')

    def test_blocked_offscreen_reports_reason_and_never_runs_native_suite(self):
        code, reports, commands = self.execute('blocked')
        self.assertEqual(code, 1)
        self.assertEqual(reports[-1]['status'], 'error')
        self.assertEqual(reports[-1]['offscreenReport']['status'], 'blocked-by-policy')
        self.assertEqual(reports[-1]['stageLog'], 'offscreen current diagnostic')
        self.assertFalse(any('test:extension' in command for command in commands))

    def test_timeout_uses_current_stage_log_and_preserves_offscreen_evidence(self):
        for scenario, expected in [('timeout', 'offscreen'), ('native-timeout', 'native')]:
            with self.subTest(scenario=scenario):
                code, reports, _ = self.execute(scenario)
                self.assertEqual(code, 1)
                self.assertEqual(reports[-1]['status'], 'error')
                self.assertEqual(reports[-1]['stageLog'], expected + ' current timeout diagnostic')
                self.assertIn('timed out', reports[-1]['error'])
                self.assertEqual(reports[-1]['offscreenReport']['status'], 'passed')

    def test_failed_native_suite_still_uploads_both_results(self):
        code, reports, _ = self.execute('native-failed')
        self.assertEqual(code, 1)
        self.assertEqual(reports[-1]['status'], 'finished')
        self.assertEqual(reports[-1]['exitCode'], 1)
        self.assertIn('nativeReport', reports[-1])
        self.assertIn('offscreenReport', reports[-1])

    def test_unreadable_or_oversized_offscreen_report_cannot_break_error_upload(self):
        for scenario in ['malformed', 'oversized']:
            with self.subTest(scenario=scenario):
                code, reports, _ = self.execute(scenario)
                self.assertEqual(code, 1)
                self.assertEqual(reports[-1]['status'], 'error')
                self.assertEqual(reports[-1]['offscreenReport']['status'], 'failed')
                self.assertLess(len(json.dumps(reports[-1])), 4000)


if __name__ == '__main__':
    unittest.main()
