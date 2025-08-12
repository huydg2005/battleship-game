import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-result',
  templateUrl: './result.html',
  styleUrls: ['./result.scss'],
})
export class Result {
  winner: string = '';
  myUid: string = '';
  roomId: string = '';
  playerName: string = '';

  constructor(private route: ActivatedRoute, private router: Router) {
    this.route.queryParams.subscribe(params => {
      this.winner = params['winner'];
      this.myUid = params['myUid'];
      this.roomId = params['roomId'];
      this.playerName = params['name'] || 'Người chơi';
    });
  }

  get resultMessage(): string {
    if (!this.winner || !this.myUid) return 'Không xác định được kết quả!';
    return this.winner === this.myUid
      ? '🎉 Bạn đã chiến thắng!'
      : '💥 Bạn đã thua!';
  }

  playAgain(): void {
    this.router.navigate(['/prepare'], {
      queryParams: {
        roomId: this.roomId,
        name: this.playerName
      }
    });
  }

  goToLobby(): void {
    this.router.navigate(['/setup']);
  }
}
