import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot
} from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-setup',
  standalone: true,
  templateUrl: './setup.html',
  styleUrls: ['./setup.scss'],
  imports: [FormsModule, CommonModule]
})
export class SetupComponent implements OnInit {
  playerName = '';
  playerUid = '';
  roomCode = '';
  isHost = false;

  players: { name: string; uid: string }[] = [];
  canStart = false;

  private firestore = inject(Firestore);
  private router = inject(Router);

  ngOnInit() {
    const savedName = localStorage.getItem('playerName');
    const savedUid = localStorage.getItem('playerUid');
    if (savedName) this.playerName = savedName;
    if (savedUid) this.playerUid = savedUid;
  }

  async createRoom() {
    if (!this.playerName.trim()) {
      alert('Vui lòng nhập tên người chơi!');
      return;
    }

    try {
      const shortCode = Math.random().toString(36).substring(2, 7).toUpperCase();
      const roomRef = doc(this.firestore, 'rooms', shortCode);

      const roomData = {
        host: this.playerName,
        players: {
          player1: {
            uid: this.playerUid,
            name: this.playerName,
            ships: [],
            ready: false
          },
          player2: {
            uid: '',
            name: '',
            ships: [],
            ready: false
          }
        },
        status: 'waiting',
        createdAt: new Date()
      };

      await setDoc(roomRef, roomData);

      this.roomCode = shortCode;
      this.isHost = true;

      this.listenToRoom(shortCode);
      this.router.navigate(['/wait-room'], {
        queryParams: { roomId: shortCode, playerId: 'player1' }
      });
    } catch (error) {
      console.error('❌ Lỗi tạo phòng:', error);
      alert('Không thể tạo phòng. Vui lòng thử lại!');
    }
  }

  async joinRoom() {
    if (!this.playerName.trim()) {
      alert('Vui lòng nhập tên người chơi!');
      return;
    }

    if (!this.roomCode.trim()) {
      alert('Vui lòng nhập mã phòng!');
      return;
    }

    try {
      const roomRef = doc(this.firestore, 'rooms', this.roomCode);
      const snapshot = await getDoc(roomRef);

      if (!snapshot.exists()) {
        alert('Phòng không tồn tại!');
        return;
      }

      const data = snapshot.data() as any;
      const p1 = data['players']['player1'];
      const p2 = data['players']['player2'];

      if (p1.uid === this.playerUid || p2.uid === this.playerUid) {
        const playerId = p1.uid === this.playerUid ? 'player1' : 'player2';
        this.listenToRoom(this.roomCode);
        this.router.navigate(['/wait-room'], {
          queryParams: { roomId: this.roomCode, playerId }
        });
        return;
      }

      if (!p2.uid) {
        await updateDoc(roomRef, {
          'players.player2': {
            uid: this.playerUid,
            name: this.playerName,
            ships: [],
            ready: false
          }
        });

        this.listenToRoom(this.roomCode);
        this.router.navigate(['/wait-room'], {
          queryParams: { roomId: this.roomCode, playerId: 'player2' }
        });
      } else {
        alert('Phòng đã đầy!');
      }
    } catch (error) {
      console.error('❌ Lỗi vào phòng:', error);
      alert('Không thể vào phòng. Vui lòng thử lại!');
    }
  }

  async startGame() {
    const roomRef = doc(this.firestore, 'rooms', this.roomCode);
    await updateDoc(roomRef, { status: 'prepare' });
    console.log('🚀 Bắt đầu game!');
  }

  listenToRoom(roomId: string) {
  const roomRef = doc(this.firestore, 'rooms', roomId);
  onSnapshot(roomRef, (snapshot) => {
    const data = snapshot.data();
    if (data?.['players']) {
      const names: { name: string; uid: string }[] = [];

      const player1 = data['players']['player1'];
      const player2 = data['players']['player2'];

      if (player1?.name) {
        names.push({
          name: player1.name,
          uid: player1.uid
        });
      }

      if (player2?.name) {
        names.push({
          name: player2.name,
          uid: player2.uid
        });
      }

      this.players = names;
      this.canStart = names.length === 2;
    }
  }); 
}
}
