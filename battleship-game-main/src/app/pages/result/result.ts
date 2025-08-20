import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-result',
  templateUrl: './result.html',
  styleUrls: ['./result.scss'],
})
export class Result {
  winner: string = '';
  myUid: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore
  ) {
    this.route.queryParams.subscribe(params => {
      this.winner = params['winner'];
      this.myUid = params['myUid'];
    });
  }

  get resultMessage(): string {
    if (!this.winner || !this.myUid) return 'Không xác định được kết quả!';
    return this.winner === this.myUid
      ? '🎉 Bạn đã chiến thắng!'
      : '💥 Bạn đã thua!';
  }

  async playAgain() {
    const playerId = localStorage.getItem('playerId');
    const playerName = localStorage.getItem('playerName');
    const lastRoomId = localStorage.getItem('lastRoomId');

    if (!playerId || !playerName || !lastRoomId) {
      alert('Thiếu thông tin để chơi lại!');
      return;
    }

    await this.resetRoomState(lastRoomId);

    this.router.navigate(['/waitroom'], {
      queryParams: {
        playerId,
        name: playerName,
        roomId: lastRoomId
      },
    });
  }

  async resetRoomState(roomId: string) {
    const roomRef = doc(this.firestore, 'rooms', roomId);

    try {
      await updateDoc(roomRef, {
        status: 'prepare',
        currentTurn: null,
        'players.player1.ready': false,
        'players.player2.ready': false,
        'players.player1.hitsReceived': [],
        'players.player1.missesReceived': [],
        'players.player2.hitsReceived': [],
        'players.player2.missesReceived': [],
        'players.player1.ships': [],
        'players.player2.ships': []
      });
      console.log('✅ Đã reset trạng thái phòng:', roomId);
    } catch (error) {
      console.error('❌ Lỗi khi reset phòng:', error);
    }
  }

  goToLobby() {
    this.router.navigate(['/setup']);
  }
}
