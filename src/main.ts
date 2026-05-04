import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage } from 'electron';
import path from 'node:path';

import { claudeService } from './claude.service';
import { loadEnvFile } from './config';
import { openAIService } from './openai.service';

type CardId = 'claude' | 'codex';

let mainWindow: BrowserWindow | null = null;
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

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2IiB2aWV3Qm94PSIwIDAgMjU2IDI1NiI+PHJlY3Qgd2lkdGg9IjI1NiIgaGVpZ2h0PSIyNTYiIHJ4PSI1NiIgZmlsbD0iIzBmMTExNSIvPjxyZWN0IHg9IjQ0IiB5PSI1MiIgd2lkdGg9IjE2OCIgaGVpZ2h0PSIxNTIiIHJ4PSIyNCIgZmlsbD0iIzExMTUyMiIgc3Ryb2tlPSIjMmEzMTQ0IiBzdHJva2Utd2lkdGg9IjEyIi8+PHRleHQgeD0iMTI4IiB5PSIxMTgiIGZpbGw9IiNmNGY3ZmYiIGZvbnQtc2l6ZT0iNTIiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9IjcwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+JTwvdGV4dD48dGV4dCB4PSIxMjgiIHk9IjE2NSIgZmlsbD0iIzdmZDFmZiIgZm9udC1zaXplPSIzMiIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXdlaWdodD0iNzAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj41czwvdGV4dD48L3N2Zz4=',
  );

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
