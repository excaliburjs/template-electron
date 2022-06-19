const { _electron: electron } = require('playwright')
const { test, expect } = require('@playwright/test')
const fs = require('fs');
const { PNG } = require('pngjs');

test('example test', async () => {
    const electronApp = await electron.launch({ args: ['.'] })
    const isPackaged = await electronApp.evaluate(async ({ app }) => {
        // This runs in Electron's main process, parameter here is always
        // the result of the require('electron') in the main app script.
        return app.isPackaged;
    });

    expect(isPackaged).toBe(false);

    // Wait for the first BrowserWindow to open
    // and return its Page object
    const window = await electronApp.firstWindow();

    const buffer = await window.screenshot({ path: 'actual.png' });
    if (fs.existsSync('./actual.png')) {
        
        console.log('Actual image', 'data:image/png;base64,' + buffer.toString('base64'));
    }

    await expect(window).toHaveScreenshot('expected-start.png');


    // close app
    await electronApp.close();
});