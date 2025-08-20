import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Firestore,
  doc,
  onSnapshot,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

type PlayerData = {
  uid: string;
  name: string;
  ready: boolean;
  isHost?: boolean;
};

type RoomData = {
  host: string;
  status: string;
  players: Record<string, PlayerData>;
  currentTurn: string | null;
};

@Component({
  selector: 'app-wait-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './waitroom.html',
  styleUrls: ['./waitroom.scss'],
})
export class WaitRoom implements OnInit, OnDestroy {
  roomId = '';
  roomData: RoomData | null = null;
  players: {
    id: string;
    name: string;
    ready: boolean;
    isHost?: boolean;
    uid?: string;
  }[] = [];
  host = '';
  currentPlayer = '';
  currentPlayerId = '';
  currentUid = '';
  isHost = false;

  // Chat
  chatMessages: { name: string; message: string; time?: string }[] = [];
  chatInput = '';

  // Biến để lưu trữ hàm hủy lắng nghe
  private unsubscribeRoom: (() => void) | undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore
  ) {}

  ngOnInit() {
    this.currentPlayer = localStorage.getItem('playerName') || '';
    this.currentUid = localStorage.getItem('playerUid') || '';

    this.route.queryParams.subscribe((params) => {
      this.roomId = params['roomId'];
      if (this.roomId) {
        this.listenToRoom();
      }
    });
  }

  ngOnDestroy() {
    // Hủy lắng nghe khi component bị hủy để tránh rò rỉ bộ nhớ
    if (this.unsubscribeRoom) {
      this.unsubscribeRoom();
    }
  }

  listenToRoom() {
    if (!this.roomId) return;

    const roomRef = doc(this.firestore, 'rooms', this.roomId);

    // ✅ ĐÃ SỬA: Sử dụng onSnapshot và lưu hàm hủy
    this.unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      const data = snapshot.data() as RoomData;
      if (!data) return;
      this.roomData = data;

      this.host = data.host || '';
      this.isHost = this.currentUid === this.host;

      if (data.players && typeof data.players === 'object') {
        this.players = Object.entries(data.players).map(([id, info]: [string, any]) => ({
          id,
          name: info?.name || '',
          ready: !!info?.ready,
          isHost: !!info?.isHost,
          uid: info?.uid || '',
        }));

        const found = this.players.find((p) => p.uid === this.currentUid);
        if (found) {
          this.currentPlayerId = found.id;
        }
      } else {
        this.players = [];
      }

      if (data.status === 'playing' && this.currentPlayerId) {
        this.router.navigate(['/prepare'], {
          queryParams: {
            roomId: this.roomId,
            uid: this.currentUid,
          },
        });
      }
    });
  }

  get playersCount(): number {
    return Array.isArray(this.players) ? this.players.length : 0;
  }
  get readyCount(): number {
    return Array.isArray(this.players) ? this.players.filter((p) => !!p.ready).length : 0;
  }
  get allPlayersReady(): boolean {
    return this.playersCount > 0 && this.players.every((p) => !!p.ready);
  }
  get startDisabled(): boolean {
    return this.playersCount < 2 || !this.allPlayersReady;
  }

  isCurrentPlayerReady(): boolean {
    const me = this.players.find((p) => p.id === this.currentPlayerId);
    return me ? me.ready : false;
  }

  async setReady(state: boolean) {
    if (!this.currentPlayerId || !this.roomId) return;
    const roomRef = doc(this.firestore, 'rooms', this.roomId);
    await updateDoc(roomRef, {
      [`players.${this.currentPlayerId}.ready`]: state,
    });
  }

  copyRoomCode() {
    if (!this.roomId) return;
    navigator.clipboard.writeText(this.roomId).then(() => {
      console.log('Room code copied:', this.roomId);
    });
  }

  async startGame() {
    if (!this.isHost || !this.roomId) {
      console.log('Bạn không phải host hoặc thiếu roomId.');
      return;
    }
    const roomRef = doc(this.firestore, 'rooms', this.roomId);
    try {
      await runTransaction(this.firestore, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) {
          throw new Error('Phòng không tồn tại!');
        }
        const roomData = roomDoc.data();
        const playersMap = roomData['players'];

        if (
          !playersMap ||
          Object.keys(playersMap).length < 2 ||
          !Object.values(playersMap).every((p: any) => p.ready)
        ) {
          throw new Error('Chưa đủ người chơi hoặc chưa tất cả đều sẵn sàng.');
        }

        const playerUids = Object.values(playersMap).map((player: any) => player.uid);
        const firstPlayerUid = playerUids[Math.floor(Math.random() * playerUids.length)];

        const updates: any = {
          status: 'playing',
          gameStartedAt: serverTimestamp(),
          currentTurn: firstPlayerUid,
        };

        for (const uid of Object.keys(playersMap)) {
            updates[`players.${uid}.ready`] = false;
            updates[`players.${uid}.ships`] = [];
            updates[`players.${uid}.hitsReceived`] = [];
            updates[`players.${uid}.missesReceived`] = [];
        }

        transaction.update(roomRef, updates);
        console.log('✅ Bắt đầu trò chơi thành công!');
      });
    } catch (error) {
      console.error('❌ Lỗi khi bắt đầu trò chơi:', error);
    }
  }

  handleChatEnter(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.sendMessage();
    }
  }

  sendMessage() {
    const text = this.chatInput?.trim();
    if (!text) return;
    this.chatMessages.push({
      name: this.currentPlayer || 'Khách',
      message: text,
      time: new Date().toLocaleTimeString(),
    });
    this.chatInput = '';
  }
}
