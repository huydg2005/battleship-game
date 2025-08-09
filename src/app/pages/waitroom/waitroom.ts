import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Firestore,
  doc,
  docData,
  updateDoc
} from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-wait-room',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './waitroom.html',
  styleUrls: ['./waitroom.scss']
})
export class WaitRoom implements OnInit {
  roomId = '';
  room$: Observable<any> | null = null;
  players: { id: string; name: string; ready: boolean }[] = [];
  host = '';
  currentPlayer = '';
  isHost = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore
  ) {}

  ngOnInit() {
    this.currentPlayer = localStorage.getItem('playerName') || '';
    this.route.queryParams.subscribe(params => {
      this.roomId = params['roomId'];
      this.listenToRoom();
    });
  }

  listenToRoom() {
    const roomRef = doc(this.firestore, 'rooms', this.roomId);
    this.room$ = docData(roomRef);

    this.room$.subscribe((data: any) => {
      if (!data) return;

      this.host = data.host || '';
      this.isHost = this.currentPlayer === this.host;

      // Chuyển players map -> array
      if (data.players && typeof data.players === 'object') {
        this.players = Object.entries(data.players).map(([id, info]: [string, any]) => ({
          id,
          name: info?.name || '',
          ready: info?.ready || false
        }));
      } else {
        this.players = [];
      }

      // Nếu host đã start game
      if (data.status === 'prepare') {
        this.router.navigate(['/prepare'], {
          queryParams: { roomId: this.roomId }
        });
      }
    });
  }

  async startGame() {
    if (!this.isHost) return;

    const roomRef = doc(this.firestore, 'rooms', this.roomId);
    await updateDoc(roomRef, { status: 'prepare' });
    console.log('🚀 Host đã bắt đầu game!');
  }
}
