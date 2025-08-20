import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Firestore,
  doc,
  onSnapshot,
  updateDoc,
  runTransaction,
} from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';

type Ship = {
  type: string;
  positions: number[];
  direction: 'horizontal' | 'vertical';
};

type PlayerData = {
  name: string;
  ships: Ship[];
  ready: boolean;
  uid: string;
  hitsReceived: number[];
  missesReceived: number[];
};

type RoomData = {
  host: string;
  createdAt?: any;
  status: 'waiting' | 'playing' | 'finished' | 'prepare';
  currentTurn: string | null;
  players: Record<'player1' | 'player2', PlayerData>;
};

@Component({
  selector: 'app-game-board',
  standalone: true,
  templateUrl: './game-board.html',
  styleUrls: ['./game-board.scss'],
  imports: [CommonModule],
})
export class GameBoard implements OnInit, OnDestroy {
  gridSize = 100;
  myGrid: string[] = Array(this.gridSize).fill('');
  opponentGrid: string[] = Array(this.gridSize).fill('');
  winner: 'player' | 'opponent' | null = null;

  roomId: string = '';
  playerId: 'player1' | 'player2' = 'player1';
  opponentId: 'player1' | 'player2' = 'player2';

  myShips: Ship[] = [];
  opponentShips: Ship[] = [];

  currentTurn: string | null = null;
  isMyTurn: boolean = false;

  roomStatus: 'waiting' | 'playing' | 'finished' | 'prepare' = 'prepare';

  private firestore: Firestore = inject(Firestore);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  private unsubscribeRoom?: () => void;

  myUid: string = '';
  hostUid: string = '';

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const pid = params['playerId'];
      const rid = params['roomId'];

      if (pid !== 'player1' && pid !== 'player2') {
        alert('Thiếu hoặc sai playerId trong URL!');
        return;
      }

      this.playerId = pid;
      this.opponentId = pid === 'player1' ? 'player2' : 'player1';
      this.roomId = rid;

      this.loadRoomData();
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeRoom?.();
  }

  loadRoomData(): void {
    const roomRef = doc(this.firestore, 'rooms', this.roomId);

    this.unsubscribeRoom = onSnapshot(roomRef, async snapshot => {
      const data = snapshot.data() as RoomData;
      if (!data || !data.players) return;

      const myData = data.players[this.playerId];
      const opponentData = data.players[this.opponentId];

      this.myUid = myData.uid;
      this.hostUid = data.host;

      if (data.host === data.players.player1.name) {
        await updateDoc(roomRef, {
          host: data.players.player1.uid,
        });
        return;
      }

      myData.hitsReceived = myData.hitsReceived ?? [];
      myData.missesReceived = myData.missesReceived ?? [];
      opponentData.hitsReceived = opponentData.hitsReceived ?? [];
      opponentData.missesReceived = opponentData.missesReceived ?? [];

      this.myShips = myData.ships ?? [];
      this.opponentShips = opponentData.ships ?? [];

      this.roomStatus = data.status ?? 'prepare';
      this.currentTurn = data.currentTurn ?? null;
      this.isMyTurn = !!this.currentTurn && this.currentTurn === this.myUid;

      if (this.roomStatus === 'playing') {
        this.renderGrids(myData, opponentData);
        this.checkWinner(myData, opponentData);
      }

      if (
        data.status === 'prepare' &&
        data.players.player1.ready &&
        data.players.player2.ready
      ) {
        await this.startGameAuto(data);
      }
    });
  }

  async startGameAuto(data: RoomData): Promise<void> {
    const roomRef = doc(this.firestore, 'rooms', this.roomId);
    try {
      await updateDoc(roomRef, {
        status: 'playing',
        currentTurn: data.host,
      });
      console.log('✅ Game đã tự động bắt đầu');
    } catch (error: any) {
      console.error('❌ Lỗi khi tự động bắt đầu:', error.message);
    }
  }

  renderGrids(myData: PlayerData, opponentData: PlayerData): void {
    this.myGrid = Array(this.gridSize).fill('');
    this.opponentGrid = Array(this.gridSize).fill('');

    for (const ship of this.myShips) {
      for (const pos of ship.positions) {
        this.myGrid[pos] = '🚢';
      }
    }

    for (const pos of myData.hitsReceived) {
      this.myGrid[pos] = '💥';
    }

    for (const pos of myData.missesReceived) {
      if (this.myGrid[pos] === '') this.myGrid[pos] = '❌';
    }

    for (const ship of this.opponentShips) {
      for (const pos of ship.positions) {
        if (opponentData.hitsReceived.includes(pos)) {
          const isDestroyed = ship.positions.every(p =>
            opponentData.hitsReceived.includes(p)
          );
          this.opponentGrid[pos] = isDestroyed ? '💥' : '🔥';
        }
      }
    }

    for (const pos of opponentData.missesReceived) {
      if (this.opponentGrid[pos] === '') this.opponentGrid[pos] = '❌';
    }
  }

  checkWinner(myData: PlayerData, opponentData: PlayerData): void {
    const opponentShipsDestroyed = this.opponentShips.every(ship =>
      ship.positions.every(pos => opponentData.hitsReceived.includes(pos))
    );

    const myShipsDestroyed = this.myShips.every(ship =>
      ship.positions.every(pos => myData.hitsReceived.includes(pos))
    );

    if (opponentShipsDestroyed && !this.winner) {
      this.winner = 'player';
      localStorage.setItem('lastRoomId', this.roomId);
      this.updateRoomStatus('finished');
      this.router.navigate(['/result'], {
        queryParams: {
          winner: this.myUid,
          myUid: this.myUid,
        },
      });
    } else if (myShipsDestroyed && !this.winner) {
      this.winner = 'opponent';
      localStorage.setItem('lastRoomId', this.roomId);
      this.updateRoomStatus('finished');
      this.router.navigate(['/result'], {
        queryParams: {
          winner: opponentData.uid,
          myUid: this.myUid,
        },
      });
    }
  }

  async fire(index: number): Promise<void> {
    if (this.winner || !this.isMyTurn) return;

    if (['💥', '❌', '🔥'].includes(this.opponentGrid[index])) {
      alert('Vị trí này đã được đánh rồi!');
      return;
    }

    const roomRef = doc(this.firestore, 'rooms', this.roomId);

    try {
      await runTransaction(this.firestore, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) throw new Error('Phòng không tồn tại');

        const data = roomDoc.data() as RoomData;
        const opponentData = data.players[this.opponentId];

        const currentHits = opponentData.hitsReceived ?? [];
        const currentMisses = opponentData.missesReceived ?? [];

        if (currentHits.includes(index) || currentMisses.includes(index)) {
          throw new Error('Vị trí này đã được đánh rồi!');
        }

        const hitShip = this.opponentShips.find(ship =>
          ship.positions.includes(index)
        );

        let newHits = [...currentHits];
        let newMisses = [...currentMisses];

        if (hitShip) {
          console.log(`🎯 Bắn trúng tàu tại ô ${index}`);
          newHits.push(index);
        } else {
          console.log(`💨 Bắn trượt tại ô ${index}`);
          newMisses.push(index);
        }

        const nextTurn =
          data.currentTurn === data.players.player1.uid
            ? data.players.player2.uid
            : data.players.player1.uid;

        transaction.update(roomRef, {
          currentTurn: nextTurn,
          [`players.${this.opponentId}.hitsReceived`]: newHits,
          [`players.${this.opponentId}.missesReceived`]: newMisses,
        });
      });
    } catch (error: any) {
      alert(error.message || 'Lỗi khi bắn!');
    }
  }

  async updateRoomStatus(status: 'waiting' | 'playing' | 'finished' | 'prepare') {
    const roomRef = doc(this.firestore, 'rooms', this.roomId);
    await updateDoc(roomRef, { status });
  }

  async markReady(): Promise<void> {
    const roomRef = doc(this.firestore, 'rooms', this.roomId);
    await updateDoc(roomRef, {
      [`players.${this.playerId}.ready`]: true
    });
  }
}
