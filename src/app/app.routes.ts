import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { SetupComponent } from './pages/setup/setup';
import { GameBoard } from './pages/game-board/game-board';
import { Result } from './pages/result/result';
import {Prepare} from './pages/prepare/prepare';
import {WaitRoom} from './pages/waitroom/waitroom';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'setup', component: SetupComponent },
  { path: 'game', component: GameBoard },
  { path: 'result', component: Result },
  { path: 'prepare', component: Prepare},
  { path: 'wait-room',component: WaitRoom}


];
