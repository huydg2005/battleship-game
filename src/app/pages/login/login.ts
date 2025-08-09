import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, signInWithPopup, GoogleAuthProvider } from '@angular/fire/auth';

@Component({
  selector: 'login',
  standalone: true,
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class Login {
  constructor(private auth: Auth, private router: Router) {}

  async loginWithGoogle() {
    try {
      const result = await signInWithPopup(this.auth, new GoogleAuthProvider());
      const user = result.user;

      // Lưu thông tin người chơi
      localStorage.setItem('playerName', user.displayName || 'Ẩn danh');
      localStorage.setItem('playerUid', user.uid);

      console.log('✅ Đăng nhập thành công:', user.displayName);
      this.router.navigate(['/setup']);
    } catch (error) {
      console.error('❌ Lỗi đăng nhập:', error);
      alert('Đăng nhập thất bại. Vui lòng thử lại!');
    }
  }
}
