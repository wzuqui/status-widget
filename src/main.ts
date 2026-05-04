import { app, BrowserWindow, Menu, Tray, ipcMain, dialog, nativeImage } from 'electron';
import path from 'node:path';

import { claudeService } from './claude.service';
import { loadEnvFile, readEnvConfig, writeEnvConfig } from './config';
import { openAIService } from './openai.service';

type CardId = 'claude' | 'codex';

let mainWindow: BrowserWindow | null = null;
let configWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function getEnabledCards(): CardId[] {
  const rawCards = process.env.CARDS?.trim();
  if (!rawCards) return ['claude', 'codex'];

  const cards = rawCards
    .split(',')
    .map((card) => card.trim().toLowerCase())
    .filter((card): card is CardId => card === 'claude' || card === 'codex');

  return cards.length > 0 ? Array.from(new Set(cards)) : ['claude', 'codex'];
}

function createWindow(): void {
  const enabledCards = getEnabledCards();
  const width = enabledCards.length === 1 ? 142 : 252;
  const height = 122;

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: enabledCards.length === 1 ? 100 : 170,
    minHeight: 82,
    frame: false,
    resizable: true,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.on('close', (event) => {
    if (isQuitting) return;

    event.preventDefault();
    mainWindow?.hide();
  });
  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));
}

function openConfigWindow(): void {
  if (configWindow) {
    configWindow.focus();
    return;
  }

  configWindow = new BrowserWindow({
    width: 460,
    height: 420,
    resizable: false,
    frame: true,
    title: 'Configurar',
    backgroundColor: '#0f1115',
    parent: mainWindow ?? undefined,
    modal: false,
    webPreferences: {
      preload: path.join(__dirname, 'config-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  configWindow.setMenuBarVisibility(false);
  configWindow.loadFile(path.join(__dirname, '../src/config.html'));
  configWindow.on('closed', () => {
    configWindow = null;
  });
}

function createTray(): void {
  const iconPath = path.join(app.getAppPath(), 'icone.png');
  const icon = nativeImage.createFromPath(iconPath);

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Status Widget');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Mostrar/Ocultar',
        click: toggleWindow,
      },
      {
        label: 'Sempre visivel',
        type: 'checkbox',
        checked: true,
        click: (menuItem) => {
          mainWindow?.setAlwaysOnTop(menuItem.checked, 'screen-saver');
        },
      },
      { type: 'separator' },
      {
        label: 'Configurar',
        click: openConfigWindow,
      },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('click', toggleWindow);
}

function toggleWindow(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }

  mainWindow.show();
  mainWindow.focus();
}

app.whenReady().then(() => {
  loadEnvFile(app.getAppPath());
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});

ipcMain.on('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('config:getCards', () => getEnabledCards());

ipcMain.handle('status:get', async (_event, id: CardId) => {
  if (id === 'claude') {
    return claudeService.getFiveHourUsage();
  }

  if (id === 'codex') {
    return openAIService.getPrimaryWindowUsage();
  }

  throw new Error(`Unknown status id: ${id}`);
});

ipcMain.handle('config:get', () => {
  return readEnvConfig();
});

ipcMain.handle('config:selectFile', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Selecionar auth.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });

  return result.canceled ? null : result.filePaths[0] ?? null;
});

ipcMain.handle('config:save', (_event, data: Record<string, string>) => {
  writeEnvConfig(data);
  configWindow?.close();
});

ipcMain.on('config:cancel', () => {
  configWindow?.close();
});
