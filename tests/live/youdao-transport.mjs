// Test-only proxy-aware transport. Product requests still use browser fetch.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile);
export async function youdaoTransport(url,{signal}={}){
 if(new URL(url).origin!=='https://dict.youdao.com')throw Error('Unexpected live test host');
 const script=`import urllib.request,urllib.error,sys,json
req=urllib.request.Request(sys.argv[1],headers={'User-Agent':'Lextide/0.7.8 (on-demand dictionary acceptance test)','Accept':'text/html','Accept-Language':'en'})
try:
 r=urllib.request.urlopen(req,timeout=12)
except urllib.error.HTTPError as e:
 r=e
with r:
 body=r.read(1048577)
 if len(body)>1048576: raise Exception('Response exceeds test bound')
 print(json.dumps({'status':r.code,'body':body.decode('utf-8')}))`;
 const {stdout}=await run('python',['-c',script,url],{signal,maxBuffer:4*1024*1024});const data=JSON.parse(stdout);return new Response(data.body,{status:data.status,headers:{'Content-Type':'text/html'}});
}
