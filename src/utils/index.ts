
import path from 'path';
import os from 'os';
import fs from 'fs';
import { promisify } from 'util';
import { exec, execFile, spawn } from 'child_process';
const execP = promisify(exec);
const fsp = fs.promises;

/**
 * sleep
 * @param time 
 * @returns 
 */
const sleep = async function (time) {
  return new Promise((r) => {
    setTimeout(() => r(""), time);
  });
}
/**
 * 
 * @param query 
 * @returns 
 */
const findAppOnMac = async (appName) => {
  const searchPaths = [
    '/Applications',
    path.join(os.homedir(), 'Applications'),
  ];

  for (const dir of searchPaths) {
    try {
      const files = await fsp.readdir(dir);
      for (const file of files) {
        if (file.toLowerCase().endsWith('.app')) {
          const baseName = file.replace(/\.app$/, '');
          if (baseName.toLowerCase() === appName.toLowerCase() || baseName.toLowerCase().includes(appName.toLowerCase())) {
            return path.join(dir, file);
          }
        }
      }
    } catch (err) {
      // Ignore if directory does not exist
    }
  }

  // 2. Use Spotlight (mdfind) as a fallback
  try {
    const query = appName.includes('.')
      ? `kMDItemCFBundleIdentifier == '${appName}'` // Search by bundle id
      : `kMDItemDisplayName == '${appName}' && kMDItemKind == 'Application'`; // Search by application display name
    const { stdout } = await execP(`mdfind "${query}"`);
    const result = stdout.trim().split('\n')[0];
    if (result) {
      return result;
    }
  } catch (err) {
    // Ignore if mdfind fails to execute
  }

  return null;
};

const findExeRecursive = async (dir, exeName, maxDepth = 2) => {
  if (maxDepth < 0) {
    return null;
  }

  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (err) {
    return null; // Unable to read directory
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findExeRecursive(fullPath, exeName, maxDepth - 1);
      if (found) {
        return found;
      }
    } else if (entry.name.toLowerCase() === exeName.toLowerCase()) {
      return fullPath;
    }
  }
  return null;
};

const findAppOnWindows = async (appName) => {
  const exeName = `${appName}.exe`;

  // 1. Use 'where' command to quickly check PATH
  try {
    const { stdout } = await execP(`where ${appName}`);
    const result = stdout.trim().split(/\r\n|\n/)[0];
    if (result) {
      return result;
    }
  } catch (err) {
    // Not found in PATH, continue searching
  }

  // 2. Check common installation directories
  const searchPaths = [
    process.env.ProgramFiles, // C:\Program Files
    process.env['ProgramFiles(x86)'], // C:\Program Files (x86)
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs') : null,
  ].filter(Boolean); // Filter out invalid paths

  for (const dir of searchPaths) {
    // Applications are usually installed in a subfolder named after the application
    const appDir = path.join(dir, appName);
    const result = await findExeRecursive(appDir, exeName);
    if (result) {
      return result;
    }
  }

  return null;
};


/**
 * @param query
 * @returns
 */
const findAppOnMacOrWin = async function (query: string) {
  const platform = os.platform();

  if (platform === 'darwin') { // macOS
    return findAppOnMac(query);
  }

  if (platform === 'win32') { // Windows
    return findAppOnWindows(query);
  }

  console.warn(`Unsupported platform: ${platform} for findApp`);
  return null;
}

async function launchApp(appName: string) {
  // Try to find the full path of the app first.
  const executablePath = await findAppOnMacOrWin(appName);
  // If found, use the full path. Otherwise, use the original appName,
  // which might be a bundle ID on macOS or an app in the PATH.
  const identifierOrPath = executablePath || appName;

  const platform = process.platform;
  // If the passed in path exists, open it as an executable
  try {
    const stat = await fsp.stat(identifierOrPath).catch(() => null);
    if (stat) {
      if (platform === 'darwin') {
        // macOS: use open -a or open <.app path> directly
        return execFile('open', ['-a', identifierOrPath]);
      } else if (platform === 'win32') {
        // Windows: spawn the executable directly (detached)
        const child = spawn(identifierOrPath, [], { detached: true, stdio: 'ignore' });
        child.unref();
        return Promise.resolve();
      } else {
        // Linux/other: try to execute the executable or xdg-open
        const child = spawn(identifierOrPath, [], { detached: true, stdio: 'ignore' });
        child.unref();
        return Promise.resolve();
      }
    }
  } catch (e) {
    // ignore and try other approaches
  }

  // if it's macOS, identifier could be bundle id or app name
  if (platform === 'darwin') {
    // if it's a bundle id like com.apple.Safari -> open -b
    if (identifierOrPath.includes('.')) {
      return execFile('open', ['-b', identifierOrPath]);
    }
    // otherwise open by app name: open -a "App Name"
    return execFile('open', ['-a', identifierOrPath]);
  }

  // Windows: use the start command (must go through cmd)
  if (platform === 'win32') {
    // The first parameter of start is the title, usually an empty string
    const cmd = `start "" "${identifierOrPath}"`;
    return execP(cmd, { shell: 'cmd.exe' });
  }

  // Linux: try xdg-open or the command name directly
  try {
    return execFile('xdg-open', [identifierOrPath]);
  } catch (e) {
    // fallback: try running as command
    return execP(identifierOrPath);
  }
}

async function getCliPath(appName: string): Promise<string | null> {
  const appPath = await findAppOnMacOrWin(appName);
  if (!appPath) {
    return null;
  }

  const platform = os.platform();

  if (platform === 'darwin') {
    const cliPath = path.join(appPath, 'Contents', 'MacOS', 'cli');
    try {
      const stat = await fsp.stat(cliPath);
      if (stat.isFile()) {
        return cliPath;
      }
    } catch (err) {
      // File does not exist
      return null;
    }
  }

  if (platform === 'win32') {
    const appDir = path.dirname(appPath);
    // Search for cli.exe in the application's directory
    const cliPath = await findExeRecursive(appDir, 'cli.exe');
    return cliPath;
  }

  console.warn(`Unsupported platform: ${platform} for getCliPath`);
  return null;
}

export { findAppOnMacOrWin, launchApp, sleep, getCliPath }
