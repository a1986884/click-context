import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
test('notebook runner preserves reports and current diagnostics across success, installation denial, failure and timeout',()=>{
 execFileSync('python3',['tests/cloud-runner-fixture.py'],{stdio:'pipe',timeout:30000});
});
