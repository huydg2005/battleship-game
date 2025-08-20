import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot
} from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-setup',
  standalone: true,
  templateUrl: './setup.html',
  styleUrls: ['./setup.scss'],
  imports: [FormsModule, CommonModule]
})
export class SetupComponent implements OnInit {
  // --- Gốc ---
  userName: string = '';
  userInitial: string = '';
  playerName = '';
  playerUid = '';
  roomCode = '';
  isHost = false;

  players: { name: string; uid: string }[] = [];
  canStart = false;

  // --- Thêm cho UI mới ---
  roomName: string = '';
  maxPlayers: number = 2;
  roomPassword: string = '';

  roomsList: any[] = [];         // danh sách phòng lấy từ Firestore
  filteredRooms: any[] = [];
  searchTerm: string = '';

  showPasswordModal: boolean = false;
  joinPassword: string = '';
  currentRoom: any = null;

  showNotification: boolean = false;
  notificationText: string = '';
  notificationType: 'success' | 'error' | 'info' = 'success';

  private firestore = inject(Firestore);
  private router = inject(Router);

  ngOnInit() {
    const savedName = localStorage.getItem('playerName');
    const savedUid = localStorage.getItem('playerUid');
    if (savedName) this.playerName = savedName;
    if (savedUid) this.playerUid = savedUid;

    this.userName = this.playerName;
    this.userInitial = this.playerName ? this.playerName.charAt(0).toUpperCase() : '';

    this.loadRooms(); // load danh sách phòng khi vào
  }

  // --- Lấy danh sách phòng từ Firestore ---
  loadRooms() {
    const roomRef = doc(this.firestore, 'rooms', 'index'); 
  }

  // --- Tạo phòng ---
  async createRoom() {
    if (!this.playerName.trim()) {
      this.showMessage('Vui lòng nhập tên người chơi!', 'error');
      return;
    }

    try {
      const shortCode = Math.random().toString(36).substring(2, 7).toUpperCase();
      const roomRef = doc(this.firestore, 'rooms', shortCode);

      const roomData = {
        host: this.playerName,
        maxPlayers: this.maxPlayers,
        hasPassword: this.roomPassword.length > 0,
        password: this.roomPassword || '',
        players: {
          player1: {
            uid: this.playerUid,
            name: this.playerName,
            ships: [],
            ready: false,
            isHost: true
          },
          player2: {
            uid: '',
            name: '',
            ships: [],
            ready: false,
            isHost: false
          }
        },
        status: 'waiting',
        createdAt: new Date()
      };

      await setDoc(roomRef, roomData);

      this.roomCode = shortCode;
      this.isHost = true;

      this.listenToRoom(shortCode);
      this.router.navigate(['/waitroom'], {
        queryParams: { roomId: shortCode, playerId: 'player1' }
      });
    } catch (error) {
      console.error('❌ Lỗi tạo phòng:', error);
      this.showMessage('Không thể tạo phòng. Vui lòng thử lại!', 'error');
    }
  }

  // --- Vào phòng ---
  async joinRoom(room?: any) {
    const targetRoomCode = room ? room.id : this.roomCode;

    if (!this.playerName.trim()) {
      this.showMessage('Vui lòng nhập tên người chơi!', 'error');
      return;
    }

    if (!targetRoomCode.trim()) {
      this.showMessage('Vui lòng nhập mã phòng!', 'error');
      return;
    }

    try {
      const roomRef = doc(this.firestore, 'rooms', targetRoomCode);
      const snapshot = await getDoc(roomRef);

      if (!snapshot.exists()) {
        this.showMessage('Phòng không tồn tại!', 'error');
        return;
      }

      const data = snapshot.data() as any;
      const p1 = data['players']['player1'];
      const p2 = data['players']['player2'];

      if (this.playerUid && (p1.uid === this.playerUid || p2.uid === this.playerUid)) {
        const playerId = p1.uid === this.playerUid ? 'player1' : 'player2';
        this.listenToRoom(targetRoomCode);
        this.router.navigate(['/waitroom'], {
          queryParams: { roomId: targetRoomCode, playerId }
        });
        return;
      }
      
      if (!p2.uid) {
        await updateDoc(roomRef, {
          'players.player2': {
            uid: this.playerUid,
            name: this.playerName,
            ships: [],
            ready: false,
            isHost: false
          }
        });

        this.listenToRoom(targetRoomCode);
        this.router.navigate(['/waitroom'], {
          queryParams: { roomId: targetRoomCode, playerId: 'player2' }
        });
      } else {
        this.showMessage('Phòng đã đầy!', 'error');
      }
    } catch (error) {
      console.error('❌ Lỗi vào phòng:', error);
      this.showMessage('Không thể vào phòng. Vui lòng thử lại!', 'error');
    }
  }

  // --- Modal xác nhận join với mật khẩu ---
  openPasswordModal(room: any) {
    this.currentRoom = room;
    this.showPasswordModal = true;
  }

  async confirmJoinRoom() {
    if (!this.currentRoom) return;

    const roomRef = doc(this.firestore, 'rooms', this.currentRoom.id);
    const snapshot = await getDoc(roomRef);

    if (!snapshot.exists()) {
      this.showMessage('Phòng không tồn tại!', 'error');
      return;
    }

    const data = snapshot.data() as any;
    if (data.hasPassword && data.password !== this.joinPassword) {
      this.showMessage('Mật khẩu không đúng!', 'error');
      return;
    }

    this.showPasswordModal = false;
    await this.joinRoom(this.currentRoom);
    this.currentRoom = null;
  }

  closePasswordModal() {
    this.showPasswordModal = false;
    this.currentRoom = null;
  }

  // --- Lọc phòng ---
  searchRooms() {
    const term = this.searchTerm.toLowerCase();
    this.filteredRooms = this.roomsList.filter(room =>
      room.name.toLowerCase().includes(term) ||
      room.owner.toLowerCase().includes(term)
    );
  }

  // --- Làm mới danh sách ---
  refreshRooms() {
    this.loadRooms();
    this.showMessage('Đã làm mới danh sách phòng!', 'info');
  }

  // --- Lắng nghe dữ liệu phòng ---
  listenToRoom(roomId: string) {
    const roomRef = doc(this.firestore, 'rooms', roomId);
    onSnapshot(roomRef, (snapshot) => {
      const data = snapshot.data();
      if (data?.['players']) {
        const names: { name: string; uid: string }[] = [];

        const player1 = data['players']['player1'];
        const player2 = data['players']['player2'];

        if (player1?.name) names.push({ name: player1.name, uid: player1.uid });
        if (player2?.name) names.push({ name: player2.name, uid: player2.uid });

        this.players = names;
        this.canStart = names.length === 2;
      }
    }); 
  }

  // --- Thông báo ---
  showMessage(message: string, type: 'success' | 'error' | 'info' = 'success') {
    this.notificationText = message;
    this.notificationType = type;
    this.showNotification = true;

    setTimeout(() => {
      this.showNotification = false;
    }, 3000);
  }

  // --- Đăng xuất ---
  logout() {
    if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
      localStorage.clear();
      this.router.navigate(['/login']);
    }
  }
}
