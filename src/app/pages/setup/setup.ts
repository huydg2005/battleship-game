import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  docData
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
  roomCode = '';
  isHost = false;
  players: string[] = [];
  canStart = false;
  room$: Observable<any> | null = null;

  private firestore = inject(Firestore);
  private router = inject(Router);

  ngOnInit() {
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
      this.playerName = savedName;
    }
  }

  async createRoom() {
  if (!this.playerName.trim()) {
    alert('Vui lòng nhập tên người chơi!');
    return;
  }

  localStorage.setItem('playerName', this.playerName);

  try {
    const shortCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const roomRef = doc(this.firestore, 'rooms', shortCode);

    const roomData = {
      host: this.playerName,
      players: [this.playerName],
      status: 'waiting',
      createdAt: new Date()
    };

    await setDoc(roomRef, roomData);

    console.log('✅ Phòng đã tạo:', shortCode);
    this.roomCode = shortCode;
    this.isHost = true;

    this.router.navigate(['/wait-room'], { queryParams: { roomId: shortCode } });
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

  localStorage.setItem('playerName', this.playerName);

  try {
    const roomRef = doc(this.firestore, 'rooms', this.roomCode);
    const snapshot = await getDoc(roomRef);

    if (!snapshot.exists()) {
      alert('Phòng không tồn tại!');
      return;
    }

    const data = snapshot.data();
    const players = data?.['players'] || [];

    if (!players.includes(this.playerName)) {
      await updateDoc(roomRef, {
        players: arrayUnion(this.playerName)
      });
    }

    console.log('✅ Đã vào phòng:', this.roomCode);
    this.router.navigate(['/wait-room'], { queryParams: { roomId: this.roomCode } });
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
}
