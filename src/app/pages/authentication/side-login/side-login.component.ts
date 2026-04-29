import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import {
  FormGroup,
  FormControl,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { finalize } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';

@Component({
  selector: 'app-side-login',
  standalone: true,
  imports: [RouterModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './side-login.component.html',
})
export class AppSideLoginComponent {
  options = this.settings.getOptions();
  private readonly authService = inject(AuthService);
  isSubmitting = false;
  loginError = '';
  hidePassword = true;

  constructor(private settings: CoreService, private router: Router) {}

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  get f() {
    return this.form.controls;
  }

  submit() {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.loginError = '';
    this.isSubmitting = true;

    this.authService
      .login({
        email: this.form.controls.email.value ?? '',
        password: this.form.controls.password.value ?? '',
      })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => this.router.navigate([this.authService.getRedirectPath()]),
        error: (error: HttpErrorResponse) => {
          if (error.status === 401) {
            this.loginError = 'Invalid email or password.';
          } else if (error.status === 0) {
            this.loginError = 'Cannot reach server. Check backend is running on port 3000.';
          } else {
            this.loginError =
              error.error?.message || 'Login failed. Please try again.';
          }
        },
      });
  }
}
