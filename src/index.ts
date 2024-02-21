import * as ex from 'excalibur';

const game = new ex.Engine({
    displayMode: ex.DisplayMode.FitScreenAndFill
});
const hello = new ex.Label({
    text: 'Hello Electron! 💖🎉',
    pos: game.screen.center,
    color: ex.Color.White,
    font: new ex.Font({
        family: 'Segoe UI Light',
        size: 50,
        textAlign: ex.TextAlign.Center,
        baseAlign: ex.BaseAlign.Alphabetic
    })
});

game.add(hello);
game.start();