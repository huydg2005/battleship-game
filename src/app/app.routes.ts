import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { SetupComponent } from './pages/setup/setup';
import { GameBoard } from './pages/game-board/game-board';
import { Result } from './pages/result/result';
import {PrepareComponent} from './pages/prepare/prepare';
import {WaitRoom} from './pages/waitroom/waitroom';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'setup', component: SetupComponent },
  { path: 'game-board', component: GameBoard },
  { path: 'result', component: Result },
  { path: 'prepare', component: PrepareComponent},
  { path: 'wait-room',component: WaitRoom}


];
