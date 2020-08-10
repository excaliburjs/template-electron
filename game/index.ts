import * as ex from 'excalibur';
import { Greeter } from './greeter';

const x = new Greeter('Welcome to Excalibur');
alert(x.greet());

const game = new ex.Engine({ displayMode: ex.DisplayMode.FullScreen });
const hello = new ex.Label('Hello Electron', game.canvasWidth / 2, 100, 'Segoe UI Light');
hello.color = ex.Color.White;
hello.fontSize = 50;
hello.textAlign = ex.TextAlign.Center;

game.add(hello);
game.start();
