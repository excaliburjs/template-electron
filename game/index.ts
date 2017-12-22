import * as ex from 'excalibur';
import {Greeter} from "./greeter";

let x = new Greeter("Welcome to Excalibur");
alert(x.greet());

var game = new ex.Engine({ displayMode: ex.DisplayMode.FullScreen });
var hello = new ex.Label('Hello Electron', game.canvasWidth / 2, 100, 'Segoe UI Light');
hello.color = ex.Color.White;
hello.fontSize = 50;
hello.textAlign = ex.TextAlign.Center;

game.add(hello);
game.start();