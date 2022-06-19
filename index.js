'use strict';
const { app, BrowserWindow } = require('electron');

// prevent window being garbage collected
let mainWindow;

const onClosed = () => {
	// dereference the window
	// for multiple windows store them in an array
	mainWindow = null;
}

const createWindow = () => {
	const win = new BrowserWindow({
		width: 800,
		height: 600
	});
	win.removeMenu();// The menu has access to the developer tools if you need to debug your app
	win.setIcon('./icon.png');
	win.loadFile('./dist/index.html');
	win.on('closed', onClosed);

	return win;
}

app.whenReady().then(() => {
	createWindow();
	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});
