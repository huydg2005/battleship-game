import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { onSnapshot } from 'firebase/firestore';
import { CommonModule } from '@angular/common';

type PlayerData = {
  ships: ShipData[];
  ready: boolean;
};

type ShipData = {
  type: string;
  positions: number[];
  direction: 'horizontal' | 'vertical';
};

type RoomData = {
  players: {
    [key: string]: PlayerData;
  };
};

@Component({
  selector: 'app-prepare',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prepare.html',
  styleUrls: ['./prepare.scss']
})
export class Prepare implements OnInit {
  grid: string[] = Array(100).fill('');
  draggingShip: string = '';
  direction: 'horizontal' | 'vertical' = 'horizontal';
  placedShips: ShipData[] = [];
  roomId: string = '';
  playerId: string = '';
  shipTypes = ['small', 'medium', 'large', 'xlarge'];
  shipSizes: Record<string, number> = {
    small: 2,
    medium: 3,
    large: 4,
    xlarge: 5
  };

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.roomId = params['roomId'];
      this.playerId = localStorage.getItem('playerId') || 'player1';
      this.listenForReadyState();
    });
  }

  startDrag(type: string) {
    this.draggingShip = type;
  }

  allowDrop(event: DragEvent) {
    event.preventDefault();
  }

  dropShip(index: number) {
    if (!this.draggingShip) return;

    const size = this.shipSizes[this.draggingShip];
    const positions: number[] = [];

    for (let i = 0; i < size; i++) {
      const pos = this.direction === 'horizontal' ? index + i : index + i * 10;
      positions.push(pos);
    }

    // Kiểm tra tràn lưới
    if (positions.some(pos => pos >= 100)) {
      alert('Thuyền vượt quá lưới!');
      return;
    }

    // Kiểm tra tràn hàng (chỉ khi ngang)
    if (
      this.direction === 'horizontal' &&
      positions.some(pos => Math.floor(pos / 10) !== Math.floor(index / 10))
    ) {
      alert('Thuyền vượt hàng!');
      return;
    }

    // Kiểm tra va chạm
    if (positions.some(pos => this.grid[pos] !== '')) {
      alert('Vị trí đã có thuyền!');
      return;
    }

    // Đặt thuyền
    positions.forEach(pos => (this.grid[pos] = this.draggingShip));
    this.placedShips.push({
      type: this.draggingShip,
      positions,
      direction: this.direction
    });

    this.draggingShip = '';
  }

  rotateDirection() {
    this.direction = this.direction === 'horizontal' ? 'vertical' : 'horizontal';
  }

  async confirmSetup() {
    if (this.placedShips.length < 4) {
      alert('Bạn cần đặt đủ 4 thuyền!');
      return;
    }

    const roomRef = doc(this.firestore, 'rooms', this.roomId);

    await updateDoc(roomRef, {
      [`players.${this.playerId}.ships`]: this.placedShips,
      [`players.${this.playerId}.ready`]: true
    });

    alert('Đã sẵn sàng!');
  }

  listenForReadyState() {
    const roomRef = doc(this.firestore, 'rooms', this.roomId);

    onSnapshot(roomRef, snapshot => {
      const roomData = snapshot.data() as RoomData;
      const players = roomData.players;

      const p1 = players['player1'];
      const p2 = players['player2'];

      const p1Ready = p1?.ready && p1?.ships?.length === 4;
      const p2Ready = p2?.ready && p2?.ships?.length === 4;

      if (p1Ready && p2Ready) {
        this.router.navigate(['/game'], { queryParams: { roomId: this.roomId } });
      }
    });
  }
}
