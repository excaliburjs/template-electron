import * as ex from 'excalibur';
import {Greeter} from "./greeter";

let x = new Greeter("Welcome to Excalibur");
alert(x.greet());

var game = new ex.Engine({
    displayMode: ex.DisplayMode.FillScreen 
});
var hello = new ex.Label({
    text: 'Hello Electron! 💖🎉',
    pos: game.screen.center,
    color: ex.Color.White,
    font: new ex.Font({
        family: 'Segoe UI Light',
        size: 50,
        textAlign: ex.TextAlign.Center
    })
});

game.add(hello);
game.start();