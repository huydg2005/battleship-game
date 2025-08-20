import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, docData, updateDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-wait-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './waitroom.html',
  styleUrls: ['./waitroom.scss']
})
export class WaitRoom implements OnInit {
  roomId = '';
  room$: Observable<any> | null = null;
  players: { id: string; name: string; ready: boolean; isHost?: boolean; uid?: string }[] = [];
  host = '';
  currentPlayer = '';
  currentPlayerId = '';
  currentUid = '';
  isHost = false;

  // Chat
  chatMessages: { name: string; message: string; time?: string }[] = [];
  chatInput = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore
  ) {}

  ngOnInit() {
    this.currentPlayer = localStorage.getItem('playerName') || '';
    this.currentUid = localStorage.getItem('playerUid') || '';

    this.route.queryParams.subscribe(params => {
      this.roomId = params['roomId'];
      if (this.roomId) {
        this.listenToRoom();
      }
    });
  }

  listenToRoom() {
    const roomRef = doc(this.firestore, 'rooms', this.roomId);
    this.room$ = docData(roomRef);

    this.room$.subscribe((data: any) => {
      if (!data) return;

      this.host = data.host || '';
      this.isHost = this.currentPlayer === this.host;

      // Chuyển players map -> array
      if (data.players && typeof data.players === 'object') {
        this.players = Object.entries(data.players).map(([id, info]: [string, any]) => ({
          id,
          name: info?.name || '',
          ready: !!info?.ready,
          isHost: !!info?.isHost,
          uid: info?.uid || ''
        }));

        // Xác định id player hiện tại dựa trên uid (ưu tiên hơn name)
        const found = this.players.find(p => p.uid === this.currentUid);
        if (found) {
          this.currentPlayerId = found.id;
        }
      } else {
        this.players = [];
      }

      // Nếu host đã start game
      if (data.status === 'prepare' && this.currentPlayerId) {
        // Lưu lại vào localStorage để /prepare có thể dùng
        localStorage.setItem('playerId', this.currentPlayerId);
        localStorage.setItem('playerName', this.currentPlayer);

        this.router.navigate(['/prepare'], {
          queryParams: { 
            roomId: this.roomId, 
            playerId: this.currentPlayerId, // player1 hoặc player2
            name: this.currentPlayer
          }
        });
      }
    });
  }

  // Getter
  get playersCount(): number {
    return Array.isArray(this.players) ? this.players.length : 0;
  }
  get readyCount(): number {
    return Array.isArray(this.players) ? this.players.filter(p => !!p.ready).length : 0;
  }
  get allPlayersReady(): boolean {
    return this.playersCount > 0 && this.players.every(p => !!p.ready);
  }
  get startDisabled(): boolean {
    return this.playersCount < 2 || !this.allPlayersReady;
  }

  isCurrentPlayerReady(): boolean {
    const me = this.players.find(p => p.id === this.currentPlayerId);
    return me ? me.ready : false;
  }

  // Nút Sẵn sàng / Hủy sẵn sàng
  async setReady(state: boolean) {
    if (!this.currentPlayerId) return;
    const roomRef = doc(this.firestore, 'rooms', this.roomId);
    await updateDoc(roomRef, {
      [`players.${this.currentPlayerId}.ready`]: state
    });
  }

  copyRoomCode() {
    if (!this.roomId) return;
    navigator.clipboard.writeText(this.roomId).then(() => {
      console.log('Room code copied:', this.roomId);
    });
  }

  async startGame() {
    if (!this.isHost) return;
    const roomRef = doc(this.firestore, 'rooms', this.roomId);
    await updateDoc(roomRef, { status: 'prepare' });
  }

  // Chat
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
      time: new Date().toLocaleTimeString()
    });
    this.chatInput = '';
  }
}
