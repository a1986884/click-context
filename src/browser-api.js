/** Promise-based WebExtension API shared by Chrome/Edge and Safari. */
export function getExtensionAPI(scope=globalThis){
 const api=scope.browser||scope.chrome;
 if(!api?.runtime?.id)throw Error('浏览器扩展 API 不可用，请通过已安装的扩展打开');
 return api;
}
