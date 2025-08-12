import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Firestore,
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc
} from '@angular/fire/firestore';
import { onSnapshot } from 'firebase/firestore';
import { CommonModule } from '@angular/common';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';

type PlayerData = {
  uid: string;
  name: string;
  ships: ShipData[];
  ready: boolean;
};

type ShipData = {
  type: string;
  positions: number[];
  direction: 'horizontal' | 'vertical';
};

type RoomData = {
  host: string;
  createdAt?: any;
  status: string;
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
  playerId: 'player1' | 'player2' = 'player1';
  shipTypes = ['small', 'medium', 'large', 'xlarge'];
  shipSizes: Record<string, number> = {
    small: 2,
    medium: 3,
    large: 4,
    xlarge: 5
  };
  playerName: string = '';
  opponentReady = false;
  private hasNavigated = false;
  private uid: string = '';

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private router: Router,
    private auth: Auth
  ) {}

  async ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.roomId = params['roomId'];
      this.playerName =
        params['name'] || `Người chơi ${Math.floor(Math.random() * 1000)}`;

      onAuthStateChanged(this.auth, async user => {
        if (!user) {
          alert('Bạn chưa đăng nhập!');
          return;
        }

        this.uid = user.uid;
        await this.joinRoom();
      });
    });
  }

  async joinRoom() {
    const roomRef = doc(this.firestore, 'rooms', this.roomId);

    try {
      const assignedPlayerId = await runTransaction(this.firestore, async transaction => {
        const snapshot = await transaction.get(roomRef);

        if (!snapshot.exists()) {
          const newRoomData: RoomData = {
            host: this.playerName,
            createdAt: serverTimestamp(),
            status: 'waiting',
            players: {
              player1: {
                uid: this.uid,
                name: this.playerName,
                ships: [],
                ready: false
              }
            }
          };
          transaction.set(roomRef, newRoomData);
          return 'player1';
        }

        const roomData = snapshot.data() as RoomData;
        const players = roomData.players || {};

        const playerEntry = Object.entries(players).find(
          ([_, p]) => p.uid === this.uid
        );
        if (playerEntry) {
          this.playerName = playerEntry[1].name;
          return playerEntry[0] as 'player1' | 'player2';
        }

        if (!players['player1']) {
          transaction.update(roomRef, {
            'players.player1': {
              uid: this.uid,
              name: this.playerName,
              ships: [],
              ready: false
            }
          });
          return 'player1';
        } else if (!players['player2']) {
          transaction.update(roomRef, {
            'players.player2': {
              uid: this.uid,
              name: this.playerName,
              ships: [],
              ready: false
            }
          });
          return 'player2';
        } else {
          throw new Error('Phòng đã đầy!');
        }
      });

      this.playerId = assignedPlayerId;
      this.listenForReadyState();
    } catch (error: any) {
      alert(error.message || 'Không thể tham gia phòng. Vui lòng thử lại!');
    }
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
      const pos =
        this.direction === 'horizontal' ? index + i : index + i * 10;
      positions.push(pos);
    }

    if (positions.some(pos => pos >= 100 || pos < 0)) {
      alert('Thuyền vượt quá lưới!');
      return;
    }

    if (
      this.direction === 'horizontal' &&
      positions.some(pos => Math.floor(pos / 10) !== Math.floor(index / 10))
    ) {
      alert('Thuyền vượt hàng!');
      return;
    }

    if (positions.some(pos => this.grid[pos] !== '')) {
      alert('Vị trí đã có thuyền!');
      return;
    }

    positions.forEach(pos => (this.grid[pos] = this.draggingShip));
    this.placedShips.push({
      type: this.draggingShip,
      positions,
      direction: this.direction
    });

    this.draggingShip = '';
  }

  rotateDirection() {
    this.direction =
      this.direction === 'horizontal' ? 'vertical' : 'horizontal';
  }

  async confirmSetup() {
    const placedTypes = this.placedShips.map(ship => ship.type);
    const missingTypes = this.shipTypes.filter(
      type => !placedTypes.includes(type)
    );

    if (missingTypes.length > 0) {
      alert(`Thiếu các loại tàu: ${missingTypes.join(', ')}`);
      return;
    }

    const roomRef = doc(this.firestore, 'rooms', this.roomId);

    try {
      await updateDoc(roomRef, {
        [`players.${this.playerId}`]: {
          uid: this.uid,
          name: this.playerName,
          ships: this.placedShips,
          ready: true
        }
      });

      console.log('✅ Bạn đã sẵn sàng:', this.playerId);
    } catch (error) {
      console.error('❌ Lỗi khi xác nhận sẵn sàng:', error);
      alert('Có lỗi xảy ra khi xác nhận sẵn sàng!');
    }
  }

  listenForReadyState() {
    const roomRef = doc(this.firestore, 'rooms', this.roomId);

    onSnapshot(roomRef, snapshot => {
      const roomData = snapshot.data() as RoomData;
      if (!roomData || !roomData.players) return;

      const opponentId = this.playerId === 'player1' ? 'player2' : 'player1';
      const opponent = roomData.players[opponentId];
      this.opponentReady = opponent?.ready ?? false;

      const allReady = Object.values(roomData.players).every(
        p => p.ready && p.ships?.length === this.shipTypes.length
      );

      if (allReady && !this.hasNavigated) {
        this.hasNavigated = true;
        this.router.navigate(['/game'], {
          queryParams: {
            roomId: this.roomId,
            playerId: this.playerId
          }
        });
      }
    });
  }

  isShipPlaced(type: string): boolean {
    return this.placedShips.some(ship => ship.type === type);
  }
  resetBoard() {
  this.grid = Array(100).fill('');
  this.placedShips = [];
  this.draggingShip = '';
}

}
