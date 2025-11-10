import path from 'path';
const appName = "TCSAS-Devtools";
const mcpName = "tcsas-devtools-mcp-server";

// TODO 需要判断平台
const previewQrCodePath = path.resolve(`/Users/zklsj/Library/Application Support/${appName}/Default`, 'pBase64.txt');

export {
  appName,
  mcpName,
  previewQrCodePath
};