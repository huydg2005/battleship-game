import { AfterViewInit, Component, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, signInWithPopup, GoogleAuthProvider } from '@angular/fire/auth';

@Component({
  selector: 'login',
  standalone: true,
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  imports: [] 
})
export class Login implements AfterViewInit {
  constructor(private auth: Auth, private router: Router) {}

  ngAfterViewInit() {
  }

  // Lắng nghe sự kiện nhấp chuột trên toàn bộ cửa sổ
  @HostListener('window:click', ['$event'])
  onClick(event: Event) {
    this.playBackgroundVideo();
  }

  // Hàm để cố gắng phát video nền
  playBackgroundVideo() {
    const video = document.getElementById('background-video') as HTMLVideoElement;
    if (video && video.paused) { // Chỉ cố gắng phát video nếu nó đang dừng
      video.play().catch(error => {
        console.error("Autoplay was prevented.", error);
      });
    }
  }

  async loginWithGoogle() {
    try {
      const result = await signInWithPopup(this.auth, new GoogleAuthProvider());
      const user = result.user;

      // Save player name to local storage
      localStorage.setItem('playerName', user.displayName || 'Ẩn danh');
      localStorage.setItem('playerUid', user.uid);

      console.log('Login successful, navigating to /setup');
      this.router.navigate(['/setup']); // Navigate to the setup page
    } catch (error) {
      console.error('Login error:', error);
      alert('Đăng nhập thất bại. Vui lòng thử lại sau.');
    }
  }
}
