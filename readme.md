# Excalibur Electron Example

This example shows how to use [Electron](http://electron.atom.io/) to distribute your Excalibur game 
to Mac, Linux, and PC desktops. It is built on 
[electron-boilerplate](https://github.com/sindresorhus/electron-boilerplate).

![Electron](https://cloud.githubusercontent.com/assets/563819/21593476/23dbd4f4-d0dd-11e6-94a8-f52c37fd3237.png)

## Launch

    # Install dependencies
    npm install

    # Run locally
    npm start

    # Package for distribution (run as administrator)
    npm run build

## Notes

The game files are compiled via TypeScript in the **game** folder. You could easily use a bundler 
like [webpack](https://github.com/excaliburjs/example-ts-webpack) to bundle Excalibur and your game 
into one file.
