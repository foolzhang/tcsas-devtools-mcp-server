#!/usr/bin/env node

import { z } from 'zod';
import fs from 'fs';
import log from './utils/log.js';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { findAppOnMacOrWin, launchApp, getCliPath, sleep } from './utils/index.js';
import { ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { appName, mcpName, previewQrCodePath } from './brand.js';
const execFileP = promisify(execFile);

const server = new McpServer({
  title: mcpName,
  name: `${appName} for miniprogram development and debugging`,
  version: '1.0.0',
  websiteUrl: "https://www.tencentcloud.com/zh/products/tcsas",
  icons: [{
    src: "https://staticintl.cloudcachetci.com/yehe/backend-news/3HUL132_qc-topnav-m-logo.svg",
    mimeType: "image/svg"
  }]
});

/**
 * launch TCSAS-Devtools with args
 */
server.registerTool('launchIde', {
  title: 'Launch IDE',
  description: `Launches the ${appName} IDE. If a project path is provided, it opens the specified miniprogram project. Use this tool when the user wants to open the IDE or a specific project.`,
  inputSchema: {
    path: z.string().optional().describe("The absolute path to the miniprogram project to open. This is optional; if omitted, the IDE will just be launched."),
  },
  outputSchema: {
    openApp: z.boolean().describe("open IDE status"),
    openProject: z.boolean().describe("open project status"),
    msg: z.string().describe("launch IDE logs")
  }
}, async ({ path }) => {
  const output = {
    openApp: false,
    openProject: false,
    msg: "",
  }

  const result = await launchApp(appName);
  if (result) {
    output.openApp = true
  }

  if (path) {
    const cliPath = await getCliPath(appName);
    if (cliPath) {
      const { stdout, stderr } = await execFileP(cliPath, ['--open', path]);
      if (!stderr) {
        output.openProject = true
      }
      output.msg = stdout
    }
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(output)
    }],
    structuredContent: output
  };
});

/**
 * check whether install IDE (TCSAS-Devtools)
 */
server.registerTool('checkIdeInstalled', {
  title: 'Check IDE Installation',
  description: `Checks if the ${appName} IDE is installed on the user's system. Use this to verify the user's environment before attempting to launch the IDE.`,
  outputSchema: {
    isInstall: z.boolean().describe("Returns true if the IDE is installed, otherwise false."),
  }
}, async () => {
  const output = { isInstall: false }
  const result = await findAppOnMacOrWin(appName);
  if (result) {
    output.isInstall = true
  }
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(output)
      }
    ],
    structuredContent: output
  };
});


/**
 * preview-miniprogram with devtools
 */
server.registerTool('previewMiniprogram', {
  title: 'Preview Miniprogram',
  description: `Generates a preview of the miniprogram at the given project path. It returns a QR code as an image that can be scanned to view the preview.`,
  inputSchema: {
    path: z.string().describe("The absolute path of the miniprogram project to preview."),
  },
}, async ({ path }) => {
  const cliPath = await getCliPath(appName);
  if (cliPath && path) {
    const { stdout, stderr } = await execFileP(cliPath, ['--preview', path, '--preview-qr-output', `base64@${encodeURIComponent(previewQrCodePath)}`]);
    log("stdout:", stdout)
    log("stderr:", stderr)
  }

  await sleep(200);

  if (!fs.existsSync(previewQrCodePath)) {
    return {
      content: [{
        type: 'text',
        text: 'Failed to generate QR code file.'
      }]
    };
  }

  const base64Content = fs.readFileSync(previewQrCodePath, 'utf8');
  const imageContent: ImageContent = {
    type: "image",
    data: base64Content.replace("data:image/png;base64,", ""),
    mimeType: "image/png",
    // (Optional) Add a description to help llm understand
    annotations: {
      title: "miniprogram preview Qrcode"
    }
  };

  return {
    content: [imageContent]
  }
});

/**
 * upload-miniprogram with devtools
 */
server.registerTool('uploadMiniprogram', {
  title: 'Upload Miniprogram',
  description: `Uploads a new version of a miniprogram project from the specified path. Requires a version number and a description for the upload.`,
  inputSchema: {
    path: z.string().describe("The absolute path of the miniprogram project to upload."),
    version: z.string().describe("The version for this upload (e.g., '1.0.0')."),
    describeMessage: z.string().describe("A short description of the changes in this version."),
  },
  outputSchema: {
    updateDetail: z.string().describe("upload response detail"),
  }
}, async ({ path, version, describeMessage }) => {
  const output = { updateDetail: "upload fail" };
  const cliPath = await getCliPath(appName);

  if (cliPath) {
    try {
      const { stdout, stderr } = await execFileP(cliPath, ['-u', `${version}@${path}`, '--upload-desc', describeMessage]);
      log("stdout:", stdout)
      log("stderr:", stderr)
      if (stdout) {
        output.updateDetail = stdout.toString()
      }
    } catch (err) {
      output.updateDetail = err.toString()
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(output)
      }
    ],
    structuredContent: output
  };
});

const transport = new StdioServerTransport();
server.connect(transport);