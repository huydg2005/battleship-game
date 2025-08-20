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

  constructor(private route: ActivatedRoute, private router: Router) {
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

  goToWaitroom(): void {
    this.router.navigate(['/waitroom'], { queryParams: { uid: this.myUid } });
  }

  goToSetup(): void {
    this.router.navigate(['/setup']);
  }
}
