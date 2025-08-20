import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection, // Thêm collection để query danh sách phòng
  query,
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

  // Cấu trúc mới, không cần mảng players trong setup.ts
  canStart = false;

  // --- Thêm cho UI mới ---
  roomName: string = '';
  maxPlayers: number = 2;
  roomPassword: string = '';

  roomsList: any[] = [];
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
    
    // Nếu chưa có UID, tạo UID mới ngẫu nhiên
    if (!savedUid) {
      this.playerUid = Math.random().toString(36).substring(2, 10);
      localStorage.setItem('playerUid', this.playerUid);
    } else {
      this.playerUid = savedUid;
    }

    this.userName = this.playerName;
    this.userInitial = this.playerName ? this.playerName.charAt(0).toUpperCase() : '';

    this.loadRooms(); // load danh sách phòng khi vào
  }

  // --- Lấy danh sách phòng từ Firestore ---
  loadRooms() {
    const roomsCollection = collection(this.firestore, 'rooms');
    const q = query(roomsCollection);

    // Sử dụng onSnapshot để cập nhật real-time
    onSnapshot(q, (querySnapshot) => {
      this.roomsList = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        this.roomsList.push({
          id: doc.id,
          ...data,
          playerCount: Object.keys(data['players'] || {}).length, // Đếm số người chơi
        });
      });
      this.searchRooms(); // Cập nhật danh sách hiển thị
    });
  }

  // --- Tạo phòng ---
  async createRoom() {
    if (!this.playerName.trim()) {
      this.showMessage('Vui lòng nhập tên người chơi!', 'error');
      return;
    }
    
    // Lưu tên người chơi vào localStorage
    localStorage.setItem('playerName', this.playerName);

    try {
      const shortCode = Math.random().toString(36).substring(2, 7).toUpperCase();
      const roomRef = doc(this.firestore, 'rooms', shortCode);

      const roomData = {
        host: this.playerUid,
        roomName: this.roomName || `Phòng của ${this.playerName}`,
        maxPlayers: this.maxPlayers,
        hasPassword: this.roomPassword.length > 0,
        password: this.roomPassword || '',
        players: {
          [this.playerUid]: {
            uid: this.playerUid,
            name: this.playerName,
            ships: [],
            ready: false,
          },
        },
        status: 'waiting',
        createdAt: new Date(),
      };

      await setDoc(roomRef, roomData);
      
      this.roomCode = shortCode;
      this.isHost = true;

      this.router.navigate(['/wait-room'], {
        queryParams: { roomId: shortCode, uid: this.playerUid }
      });
    } catch (error) {
      console.error('❌ Lỗi tạo phòng:', error);
      this.showMessage('Không thể tạo phòng. Vui lòng thử lại!', 'error');
    }
  }

  // --- Vào phòng ---
  async joinRoom(room?: any) {
    const targetRoomCode = room ? room.id : this.roomCode;
    const roomRef = doc(this.firestore, 'rooms', targetRoomCode);

    if (!this.playerName.trim()) {
      this.showMessage('Vui lòng nhập tên người chơi!', 'error');
      return;
    }

    if (!targetRoomCode.trim()) {
      this.showMessage('Vui lòng nhập mã phòng!', 'error');
      return;
    }
    
    // Lưu tên người chơi vào localStorage
    localStorage.setItem('playerName', this.playerName);

    try {
      const snapshot = await getDoc(roomRef);

      if (!snapshot.exists()) {
        this.showMessage('Phòng không tồn tại!', 'error');
        return;
      }

      const data = snapshot.data() as any;
      const currentPlayers = Object.keys(data.players);
      
      if (data.status !== 'waiting') {
        this.showMessage('Phòng này đã bắt đầu hoặc đã kết thúc!', 'error');
        return;
      }
      
      // Kiểm tra người chơi hiện tại đã có trong phòng chưa
      if (currentPlayers.includes(this.playerUid)) {
        this.router.navigate(['/wait-room'], {
          queryParams: { roomId: targetRoomCode, uid: this.playerUid }
        });
        return;
      }

      // Kiểm tra xem phòng đã đầy chưa
      if (currentPlayers.length >= data.maxPlayers) {
        this.showMessage('Phòng đã đầy!', 'error');
        return;
      }

      // Thêm người chơi mới vào map players bằng UID
      const newPlayer = {
        uid: this.playerUid,
        name: this.playerName,
        ships: [],
        ready: false,
      };

      await updateDoc(roomRef, {
        [`players.${this.playerUid}`]: newPlayer
      });

      this.router.navigate(['/wait-room'], {
        queryParams: { roomId: targetRoomCode, uid: this.playerUid }
      });

    } catch (error) {
      console.error('❌ Lỗi vào phòng:', error);
      this.showMessage('Không thể vào phòng. Vui lòng thử lại!', 'error');
    }
  }

  // --- Modal xác nhận join với mật khẩu ---
  openPasswordModal(room: any) {
    if (room.hasPassword) {
      this.currentRoom = room;
      this.showPasswordModal = true;
    } else {
      this.joinRoom(room);
    }
  }

  async confirmJoinRoom() {
    if (!this.currentRoom) return;

    const roomRef = doc(this.firestore, 'rooms', this.currentRoom.id);
    const snapshot = await getDoc(roomRef);
    const data = snapshot.data() as any;

    if (data.password !== this.joinPassword) {
      this.showMessage('Mật khẩu không đúng!', 'error');
      return;
    }

    this.showPasswordModal = false;
    await this.joinRoom(this.currentRoom);
    this.currentRoom = null;
  }

  closePasswordModal() {
    this.showPasswordModal = false;
    this.joinPassword = '';
    this.currentRoom = null;
  }

  // --- Lọc phòng ---
  searchRooms() {
    const term = this.searchTerm.toLowerCase();
    this.filteredRooms = this.roomsList.filter(room =>
      room.roomName.toLowerCase().includes(term) ||
      room.id.toLowerCase().includes(term)
    );
  }

  // --- Làm mới danh sách ---
  refreshRooms() {
    this.loadRooms();
    this.showMessage('Đã làm mới danh sách phòng!', 'info');
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
