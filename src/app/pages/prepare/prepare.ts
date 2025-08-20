import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, NgZone } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Firestore, doc, updateDoc, onSnapshot } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';

type ShipData = {
    type: string;
    positions: number[];
    direction: 'horizontal' | 'vertical';
    length: number;
    imageHorizontal: string;
    imageVertical: string;
};

type ShipConfig = {
    type: string;
    length: number;
    imageHorizontal: string;
    imageVertical: string;
};

type PlayerData = {
    uid: string;
    name: string;
    ships: ShipData[];
    ready: boolean;
};

type RoomData = {
    host: string;
    createdAt?: any;
    status: string;
    players: { [uid: string]: PlayerData };
};

@Component({
    selector: 'app-prepare',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './prepare.html',
    styleUrls: ['./prepare.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrepareComponent implements OnInit, OnDestroy {
    grid: string[] = Array(100).fill('');

    public readonly shipsConfig: ShipConfig[] = [
        { type: 'tau5', length: 5, imageHorizontal: 'assets/tau5_ngang.png', imageVertical: 'assets/tau5_doc.png' },
        { type: 'tau4', length: 4, imageHorizontal: 'assets/tau4_ngang.png', imageVertical: 'assets/tau4_doc.png' },
        { type: 'tau3', length: 3, imageHorizontal: 'assets/tau3_ngang.png', imageVertical: 'assets/tau3_doc.png' },
        { type: 'tau2', length: 2, imageHorizontal: 'assets/tau2_ngang.png', imageVertical: 'assets/tau2_doc.png' },
    ];

    private readonly totalShips = this.shipsConfig.length;

    shipsToPlace: ShipConfig[] = [];
    placedShips: ShipData[] = [];
    draggingShip: string = '';
    direction: 'horizontal' | 'vertical' = 'horizontal';

    roomId: string = '';
    uid: string = '';
    playerName: string = '';
    isReady = false;
    opponentUid: string = '';

    previewPositions: number[] = [];
    hasNavigated = false;

    private firestore = inject(Firestore);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private auth = inject(Auth);
    private cdr = inject(ChangeDetectorRef);
    private ngZone = inject(NgZone);

    private unsubscribeRoom?: () => void;

    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent) {
        if (event.key.toLowerCase() === 'r') {
            this.rotateDirection();
        }
    }

    ngOnInit() {
        this.resetShipsToPlace();
        this.route.queryParams.subscribe((params) => {
            this.roomId = params['roomId'];
            onAuthStateChanged(this.auth, async (user) => {
                if (user) {
                    this.uid = user.uid;
                    this.playerName = localStorage.getItem('playerName') || 'Người chơi';
                    this.listenForRoomUpdates();
                } else {
                    this.router.navigate(['/login']);
                }
            });
        });
    }

    ngOnDestroy() {
        this.unsubscribeRoom?.();
    }

    rotateDirection() {
        this.direction = this.direction === 'horizontal' ? 'vertical' : 'horizontal';
        if (this.draggingShip && this.previewPositions.length > 0) {
            this.updatePreview(this.previewPositions[0]);
        }
        this.cdr.markForCheck();
    }

    getShipImage(type: string): string {
        const ship = this.shipsConfig.find(s => s.type === type);
        return ship ? (this.direction === 'horizontal' ? ship.imageHorizontal : ship.imageVertical) : '';
    }

    getPlacedShipImage(ship: ShipData): string {
        return ship.direction === 'horizontal' ? ship.imageHorizontal : ship.imageVertical;
    }

    listenForRoomUpdates(): void {
        if (!this.roomId || !this.uid) return;

        const roomRef = doc(this.firestore, 'rooms', this.roomId);
        this.unsubscribeRoom = onSnapshot(roomRef, async (snapshot) => {
            this.ngZone.run(() => {
                const roomData = snapshot.data() as RoomData;
                if (!roomData) return;

                const players = roomData.players;
                const myData = players[this.uid];

                if (myData) {
                    if (myData.ships && JSON.stringify(myData.ships) !== JSON.stringify(this.placedShips)) {
                        this.placedShips = myData.ships;
                        console.log("My ships data loaded from Firestore:", this.placedShips);
                    }
                    this.isReady = myData.ready;
                }

                const allReady = Object.values(players).every(
                    (p) => p.ready && p.ships?.length === this.totalShips
                );

                if (allReady && !this.hasNavigated && players && Object.keys(players).length >= 2) {
                    this.hasNavigated = true;
                    this.router.navigate(['/game-board'], {
                        queryParams: { roomId: this.roomId, uid: this.uid },
                    });
                }
                this.cdr.markForCheck();
            });
        });
    }

    startDrag(type: string) {
        this.draggingShip = type;
    }

    cancelDrag() {
        this.draggingShip = '';
        this.previewPositions = [];
        this.cdr.markForCheck();
    }

    allowDrop(event: DragEvent, index: number) {
        event.preventDefault();
        this.updatePreview(index);
    }

    updatePreview(index: number) {
        if (!this.draggingShip) {
            this.previewPositions = [];
            this.cdr.markForCheck();
            return;
        }

        const shipToPlace = this.shipsConfig.find(s => s.type === this.draggingShip);
        if (!shipToPlace) return;

        const size = shipToPlace.length;
        const positions: number[] = [];
        const row = Math.floor(index / 10);

        for (let i = 0; i < size; i++) {
            let pos;
            if (this.direction === 'horizontal') {
                pos = index + i;
                if (Math.floor(pos / 10) !== row) {
                    this.previewPositions = [];
                    this.cdr.markForCheck();
                    return;
                }
            } else {
                pos = index + i * 10;
            }
            if (pos >= 100) {
                this.previewPositions = [];
                this.cdr.markForCheck();
                return;
            }
            positions.push(pos);
        }

        const canPlace = positions.every((pos) => {
            const cellOccupied = this.placedShips.some(ship => ship.positions.includes(pos));
            return !cellOccupied;
        });

        this.previewPositions = canPlace ? positions : [];
        this.cdr.markForCheck();
    }

    dropShip(index: number) {
        if (!this.draggingShip || !this.previewPositions.length) {
            this.cancelDrag();
            return;
        }

        const shipToPlace = this.shipsConfig.find(s => s.type === this.draggingShip);
        if (!shipToPlace) return;

        this.placedShips.push({
            type: this.draggingShip,
            positions: this.previewPositions,
            direction: this.direction,
            length: shipToPlace.length,
            imageHorizontal: shipToPlace.imageHorizontal,
            imageVertical: shipToPlace.imageVertical,
        });

        this.shipsToPlace = this.shipsToPlace.filter(s => s.type !== this.draggingShip);
        this.cancelDrag();
    }

    placeRandomShips() {
        this.resetGrid();
        const shipsToPlaceCopy = [...this.shipsConfig];

        for (const shipConfig of shipsToPlaceCopy) {
            let placed = false;
            let guard = 0;
            const maxAttempts = 500;

            while (!placed && guard < maxAttempts) {
                guard++;
                const index = Math.floor(Math.random() * 100);
                const direction = Math.random() > 0.5 ? 'horizontal' : 'vertical';
                const size = shipConfig.length;
                const positions: number[] = [];
                let isValidPlacement = true;

                for (let i = 0; i < size; i++) {
                    let pos;
                    if (direction === 'horizontal') {
                        pos = index + i;
                        if (Math.floor(pos / 10) !== Math.floor(index / 10)) {
                            isValidPlacement = false;
                            break;
                        }
                    } else {
                        pos = index + i * 10;
                    }
                    if (pos >= 100 || this.placedShips.some(s => s.positions.includes(pos))) {
                        isValidPlacement = false;
                        break;
                    }
                    positions.push(pos);
                }

                if (isValidPlacement) {
                    this.placedShips.push({
                        type: shipConfig.type,
                        positions,
                        direction,
                        length: size,
                        imageHorizontal: shipConfig.imageHorizontal,
                        imageVertical: shipConfig.imageVertical,
                    });
                    placed = true;
                }
            }

            if (!placed) {
                this.placedShips = [];
                this.placeRandomShips();
                return;
            }
        }

        this.shipsToPlace = [];
        this.cdr.markForCheck();
    }

    resetGrid() {
        this.grid = Array(100).fill('');
        this.placedShips = [];
        this.previewPositions = [];
        this.isReady = false;
        this.resetShipsToPlace();
        this.cdr.markForCheck();
    }

    private resetShipsToPlace() {
        this.shipsToPlace = [...this.shipsConfig];
    }

    allShipsPlaced(): boolean {
        return this.placedShips.length === this.totalShips;
    }

    async confirmSetup() {
        if (!this.allShipsPlaced()) {
            console.error('🚨 Bạn cần đặt đủ tất cả các 4 tàu trước khi xác nhận!');
            return;
        }

        if (!this.uid || !this.roomId) {
            console.error('Thông tin người dùng hoặc phòng bị thiếu. Vui lòng thử lại!');
            return;
        }

        const roomRef = doc(this.firestore, 'rooms', this.roomId);

        try {
            await updateDoc(roomRef, {
                [`players.${this.uid}.ships`]: this.placedShips,
                [`players.${this.uid}.ready`]: true,
            });

            this.isReady = true;

            // Chuyển sang GameBoard sau khi lưu Firestore
            this.router.navigate(['/game-board'], {
                queryParams: { roomId: this.roomId, uid: this.uid },
            });
        } catch (error: any) {
            console.error('Lỗi khi lưu dữ liệu tàu:', error.message);
        }
    }

    isCellOccupied(index: number): ShipData | null {
        return this.placedShips.find(s => s.positions.includes(index)) || null;
    }

    getShipStyle(ship: ShipData): any {
        const cellSize = 42;
        return ship.direction === 'horizontal'
            ? { width: `${cellSize * ship.length}px`, height: `${cellSize}px` }
            : { width: `${cellSize}px`, height: `${cellSize * ship.length}px` };
    }

    isShipPlaced(type: string): boolean {
        return this.placedShips.some((s) => s.type === type);
    }
    // PrepareComponent.ts

}
