import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, onSnapshot, runTransaction, updateDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';

type Ship = {
    type: string;
    positions: number[];
    direction: 'horizontal' | 'vertical';
    imageHorizontal: string;
    imageVertical: string;
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
    players: Record<string, PlayerData>;
};

@Component({
    selector: 'app-game-board',
    standalone: true,
    templateUrl: './game-board.html',
    styleUrls: ['./game-board.scss'],
    imports: [CommonModule],
})
export class GameBoard implements OnInit, OnDestroy {
    gridSize = 150; // Đã cập nhật kích thước lưới
    myGrid: string[] = Array(this.gridSize).fill('');
    opponentGrid: string[] = Array(this.gridSize).fill('');
    winner: 'me' | 'opponent' | null = null;

    roomId = '';
    uid = '';
    opponentUid = '';
    myName = '';
    opponentName = '';
    myShips: Ship[] = [];
    opponentShips: Ship[] = [];
    currentTurn: string | null = null;
    isMyTurn = false;
    roomStatus: RoomData['status'] = 'prepare';

    private myData: PlayerData | null = null;
    private opponentData: PlayerData | null = null;
    private cellSize = 42;
    private gridGap = 5;
    private gridCols = 15; // Đã thêm biến cho số cột

    private firestore = inject(Firestore);
    private route = inject(ActivatedRoute);
    public router = inject(Router);

    private unsubscribeRoom?: () => void;

    ngOnInit(): void {
        this.route.queryParams.subscribe((params) => {
            this.roomId = params['roomId'];
            this.uid = params['uid'];

            if (!this.roomId || !this.uid) {
                console.error('Thiếu roomId hoặc uid!');
                return;
            }

            this.loadRoomData();
        });
    }

    ngOnDestroy(): void {
        this.unsubscribeRoom?.();
    }

    loadRoomData(): void {
        const roomRef = doc(this.firestore, 'rooms', this.roomId);

        this.unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
            const data = snapshot.data() as RoomData;
            if (!data || !data.players) return;

            this.myData = data.players[this.uid];
            const allUids = Object.keys(data.players);
            this.opponentUid = allUids.find((u) => u !== this.uid) || '';
            this.opponentData = data.players[this.opponentUid];

            if (!this.myData || !this.opponentData) return;

            this.myName = this.myData.name || this.uid;
            this.opponentName = this.opponentData.name || this.opponentUid;

            this.myData.hitsReceived ??= [];
            this.myData.missesReceived ??= [];
            this.opponentData.hitsReceived ??= [];
            this.opponentData.missesReceived ??= [];

            // Chuẩn hóa vị trí tàu
            this.myShips = (this.myData.ships ?? []).map(ship => ({
                ...ship,
                positions: [...ship.positions].sort((a, b) => a - b)
            }));

            this.opponentShips = (this.opponentData.ships ?? []).map(ship => ({
                ...ship,
                positions: [...ship.positions].sort((a, b) => a - b)
            }));

            this.roomStatus = data.status ?? 'prepare';
            this.currentTurn = data.currentTurn ?? null;
            this.isMyTurn = this.currentTurn === this.uid;

            this.renderGrids();
            if (this.roomStatus === 'playing') {
                this.checkWinner();
            }
        });
    }

    renderGrids(): void {
        if (!this.myData || !this.opponentData) return;

        this.myGrid = Array(this.gridSize).fill('');
        this.opponentGrid = Array(this.gridSize).fill('');

        // Cập nhật grid của mình (Hiển thị khói và miss)
        for (const pos of this.myData.hitsReceived) {
            if (pos < this.gridSize) {
                this.myGrid[pos] = 'assets/smoke.png';
            }
        }
        for (const pos of this.myData.missesReceived) {
            if (pos < this.gridSize) {
                this.myGrid[pos] = 'assets/miss.png';
            }
        }

        // Cập nhật grid của đối thủ (Hiển thị khói và miss)
        for (const pos of this.opponentData.hitsReceived) {
            if (pos < this.gridSize) {
                this.opponentGrid[pos] = 'assets/smoke.png';
            }
        }
        for (const pos of this.opponentData.missesReceived) {
            if (pos < this.gridSize) {
                this.opponentGrid[pos] = 'assets/miss.png';
            }
        }
    }

    isCellHit(index: number, isOpponentGrid: boolean): boolean {
        const hits = isOpponentGrid ? this.opponentData?.hitsReceived : this.myData?.hitsReceived;
        return hits ? hits.includes(index) : false;
    }

    isCellMiss(index: number, isOpponentGrid: boolean): boolean {
        const misses = isOpponentGrid ? this.opponentData?.missesReceived : this.myData?.missesReceived;
        return misses ? misses.includes(index) : false;
    }

    getShipStyle(ship: Ship) {
    const cellSize = this.cellSize;
    const gap = this.gridGap;
    return ship.direction === 'horizontal'
        ? { 
            width: `${ship.positions.length * cellSize + (ship.positions.length - 1) * gap}px`, 
            height: `${cellSize}px` 
        }
        : { 
            width: `${cellSize}px`, 
            height: `${ship.positions.length * cellSize + (ship.positions.length - 1) * gap}px` 
        };
    }

    getShipPosition(ship: Ship) {
        const headIndex = Math.min(...ship.positions);
        const row = Math.floor(headIndex / this.gridCols); // Đã sửa lỗi: sử dụng gridCols
        const col = headIndex % this.gridCols; // Đã sửa lỗi: sử dụng gridCols
        const top = row * (this.cellSize + this.gridGap);
        const left = col * (this.cellSize + this.gridGap);
        return {
            top: `${top}px`,
            left: `${left}px`
        };
    }

    isShipSunk(ship: Ship, isOpponentShip: boolean): boolean {
        if (!this.myData || !this.opponentData) return false;
        const hitsReceived = isOpponentShip ? this.opponentData.hitsReceived : this.myData.hitsReceived;
        return ship.positions.every(pos => hitsReceived.includes(pos));
    }

    getShipImage(ship: Ship, isSunk: boolean): string {
        const imagePath = ship.direction === 'horizontal' ? ship.imageHorizontal : ship.imageVertical;
        if (isSunk) {
            const parts = imagePath.split('.');
            const fileName = parts[0];
            const extension = parts[1];
            return `${fileName}_no.${extension}`;
        }
        return imagePath;
    }
      
    getShipStyles(ship: Ship): { [key: string]: string } {
      return {
        ...this.getShipStyle(ship),
        ...this.getShipPosition(ship)
      };
    }

    checkWinner(): void {
        if (!this.myData || !this.opponentData) return;

        const opponentShipsSunk = this.opponentShips.filter(ship =>
            this.isShipSunk(ship, true)
        ).length;

        const myShipsSunk = this.myShips.filter(ship =>
            this.isShipSunk(ship, false)
        ).length;

        if (opponentShipsSunk >= 4 && myShipsSunk < 4 && !this.winner) {
            this.winner = 'me';
            this.updateRoomStatus('finished');
            this.router.navigate(['/result'], {
                queryParams: { winner: this.uid, myUid: this.uid },
            });
        }
        else if (myShipsSunk >= 4 && opponentShipsSunk < 4 && !this.winner) {
            this.winner = 'opponent';
            this.updateRoomStatus('finished');
            this.router.navigate(['/result'], {
                queryParams: { winner: this.opponentUid, myUid: this.uid },
            });
        }
        else if (myShipsSunk >= 4 && opponentShipsSunk >= 4 && !this.winner) {
            this.winner = 'opponent';
            this.updateRoomStatus('finished');
            this.router.navigate(['/result'], {
                queryParams: { winner: this.opponentUid, myUid: this.uid },
            });
        }
    }


    async fire(index: number): Promise<void> {
        if (this.winner || !this.isMyTurn) return;

        const roomRef = doc(this.firestore, 'rooms', this.roomId);

        try {
            await runTransaction(this.firestore, async (transaction) => {
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) throw new Error('Phòng không tồn tại');

                const data = roomDoc.data() as RoomData;
                const opponentData = data.players[this.opponentUid];

                if (opponentData.hitsReceived.includes(index) || opponentData.missesReceived.includes(index)) return;

                const hitShip = opponentData.ships.find(ship => ship.positions.includes(index));
                const newHits = [...opponentData.hitsReceived];
                const newMisses = [...opponentData.missesReceived];

                hitShip ? newHits.push(index) : newMisses.push(index);

                const nextTurn = this.isMyTurn ? this.opponentUid : this.uid;

                transaction.update(roomRef, {
                    currentTurn: nextTurn,
                    [`players.${this.opponentUid}.hitsReceived`]: newHits,
                    [`players.${this.opponentUid}.missesReceived`]: newMisses,
                });
            });
        } catch (error: any) {
            console.error('Lỗi khi bắn:', error.message);
        }
    }

    async updateRoomStatus(status: RoomData['status']) {
        const roomRef = doc(this.firestore, 'rooms', this.roomId);
        await updateDoc(roomRef, { status });
    }

    async markReady(): Promise<void> {
        const roomRef = doc(this.firestore, 'rooms', this.roomId);
        await updateDoc(roomRef, { [`players.${this.uid}.ready`]: true });
    }
}