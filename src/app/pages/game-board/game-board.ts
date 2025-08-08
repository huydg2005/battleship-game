import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc, updateDoc, onSnapshot } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-game-board',
  standalone: true,
  templateUrl: './game-board.html',
  styleUrls: ['./game-board.scss'],
  imports: [CommonModule] 
})
export class GameBoard implements OnInit {
  roomId = '';
  players: string[] = [];
  currentTurn = '';
  board: string[] = Array(100).fill('');

  constructor(private route: ActivatedRoute, private firestore: Firestore, private router: Router) {}

  async ngOnInit() {
    this.roomId = this.route.snapshot.queryParamMap.get('roomId') || '';

    const roomRef = doc(this.firestore, 'rooms', this.roomId);
    const snapshot = await getDoc(roomRef);

    if (!snapshot.exists()) {
      alert('Phòng không tồn tại!');
      this.router.navigate(['/setup']);
      return;
    }

    const data = snapshot.data();
    this.players = data['players'] || [];
    this.currentTurn = data['currentTurn'] || this.players[0];

    // Lắng nghe thay đổi realtime
    onSnapshot(roomRef, (docSnap) => {
      const data = docSnap.data();
      this.currentTurn = data?.['currentTurn'] || '';
      // Có thể cập nhật board từ Firebase nếu bạn lưu nó
    });
  }

  async fire(index: number) {
    if (this.currentTurn !== localStorage.getItem('playerName')) {
      alert('Chưa tới lượt bạn!');
      return;
    }

    // Giả lập bắn
    this.board[index] = Math.random() > 0.5 ? 'hit' : 'miss';

    // Chuyển lượt
    const nextPlayer = this.players.find(p => p !== this.currentTurn);
    const roomRef = doc(this.firestore, 'rooms', this.roomId);
    await updateDoc(roomRef, {
      currentTurn: nextPlayer
    });
  }

  leaveRoom() {
    this.router.navigate(['/setup']);
  }
}
