import { HttpErrorResponse } from '@angular/common/http';
import {
  Component, OnInit, inject, ViewChildren, QueryList, ElementRef, AfterViewInit,
} from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import {
  FormGroup, FormControl, Validators, FormsModule, ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { isMfaChallenge, LoginResponse } from 'src/app/auth/auth.models';
import { AuroraBgComponent } from '../aurora-bg/aurora-bg.component';

@Component({
  selector: 'app-side-login',
  standalone: true,
  imports: [RouterModule, CommonModule, MaterialModule, FormsModule, ReactiveFormsModule, AuroraBgComponent],
  templateUrl: './side-login.component.html',
  styles: [`
    /* ── Clinic inactive banner ── */
    .clinic-inactive-banner {
      display: flex; align-items: flex-start; gap: 12px;
      background: #fff3cd; border: 1px solid #ffc107;
      border-radius: 10px; padding: 14px 16px; color: #664d03; margin-bottom: 16px;
    }
    .banner-icon  { font-size: 20px; flex-shrink: 0; margin-top: 1px; }
    .banner-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
    .banner-body  { font-size: 13px; line-height: 1.5; }

    /* ── MFA card ── */
    .mfa-box {
      background: #f0f7ff; border: 1px solid #bbdefb;
      border-radius: 16px; padding: 28px 20px 24px;
    }
    .mfa-icon  { font-size: 36px; text-align: center; display: block; margin-bottom: 8px; }
    .mfa-title { font-size: 1.05rem; font-weight: 700; color: #1565c0; margin-bottom: 4px; }
    .mfa-sub   { font-size: .82rem; color: #546e7a; margin-bottom: 22px; line-height: 1.5; }
    .mfa-actions { display: flex; flex-direction: column; gap: 8px; }

    /* ── OTP boxes ── */
    .otp-row {
      display: flex; align-items: center; justify-content: center;
      gap: 8px; margin-bottom: 20px;
    }
    .otp-box {
      width: 48px; height: 56px;
      border: 2px solid #b0bec5; border-radius: 10px;
      background: #fff; font-size: 1.5rem; font-weight: 700; color: #1565c0;
      text-align: center; caret-color: transparent; outline: none;
      transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
      -moz-appearance: textfield;
    }
    .otp-box::-webkit-outer-spin-button,
    .otp-box::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .otp-box:focus {
      border-color: #1976d2; box-shadow: 0 0 0 3px rgba(25,118,210,.15); background: #e3f2fd;
    }
    .otp-box.otp-filled { border-color: #1976d2; background: #e8f5ff; }
    .otp-box.otp-error  {
      border-color: #e53935; background: #fff5f5; animation: otp-shake 0.35s ease;
    }
    .otp-separator { font-size: 1.4rem; color: #90a4ae; user-select: none; flex-shrink: 0; }

    @keyframes otp-shake {
      0%, 100% { transform: translateX(0); }
      25%       { transform: translateX(-4px); }
      75%       { transform: translateX(4px); }
    }

    .btn-spinner-row { display: inline-flex; align-items: center; gap: 8px; }
  `],
})
export class AppSideLoginComponent implements OnInit {
  options = this.settings.getOptions();
  private readonly authService = inject(AuthService);
  private readonly route       = inject(ActivatedRoute);

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  isSubmitting   = false;
  loginError     = '';
  clinicInactive = false;
  hidePassword   = true;

  // MFA step
  mfaStep       = false;
  mfaToken      = '';
  mfaDigits     = ['', '', '', '', '', ''];
  mfaError      = '';
  mfaShake      = false;
  mfaSubmitting = false;

  constructor(private settings: CoreService, private router: Router) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      this.clinicInactive = params.get('reason') === 'clinic_inactive';
    });
  }

  form = new FormGroup({
    email:    new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  get f() { return this.form.controls; }

  // ── Login ──────────────────────────────────────────────────────────────────

  submit() {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }
    this.loginError     = '';
    this.clinicInactive = false;
    this.isSubmitting   = true;

    this.authService
      .login({ email: this.f['email'].value ?? '', password: this.f['password'].value ?? '' })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (res) => {
          if (isMfaChallenge(res)) {
            this.mfaToken = res.mfa_token;
            this.mfaStep  = true;
            // Focus first box after view updates
            setTimeout(() => this.focusBox(0), 60);
            return;
          }
          this.authService.finaliseLogin(res as LoginResponse)
            .then(() => {
              sessionStorage.removeItem('df_greeting_shown');
              this.router.navigate([this.authService.getRedirectPath()]);
            });
        },
        error: (err: HttpErrorResponse) => {
          if (err.error?.error === 'clinic_inactive') {
            this.clinicInactive = true;
          } else if (err.status === 401) {
            this.loginError = 'Invalid email or password.';
          } else if (err.status === 0) {
            this.loginError = 'Cannot reach server. Check backend is running on port 3000.';
          } else {
            this.loginError = err.error?.message || 'Login failed. Please try again.';
          }
        },
      });
  }

  // ── OTP box interactions ───────────────────────────────────────────────────

  onDigitInput(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const raw   = input.value.replace(/\D/g, '');

    // Handle paste of full code into any box
    if (raw.length > 1) {
      const digits = raw.slice(0, 6).split('');
      digits.forEach((d, i) => { this.mfaDigits[i] = d; });
      this.syncInputValues();
      const nextFocus = Math.min(digits.length, 5);
      this.focusBox(nextFocus);
      if (this.isMfaCodeValid()) this.submitMfa();
      return;
    }

    this.mfaDigits[index] = raw.slice(-1); // keep last char if somehow >1
    input.value = this.mfaDigits[index];

    if (raw && index < 5) {
      this.focusBox(index + 1);
    }

    if (this.isMfaCodeValid()) this.submitMfa();
  }

  onDigitKeydown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace') {
      if (this.mfaDigits[index]) {
        this.mfaDigits[index] = '';
        (event.target as HTMLInputElement).value = '';
      } else if (index > 0) {
        this.mfaDigits[index - 1] = '';
        this.focusBox(index - 1);
        const prev = this.otpInputs.toArray()[index - 1];
        if (prev) prev.nativeElement.value = '';
      }
      event.preventDefault();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      this.focusBox(index - 1);
    } else if (event.key === 'ArrowRight' && index < 5) {
      this.focusBox(index + 1);
    } else if (event.key === 'Enter') {
      this.submitMfa();
    }
  }

  onDigitFocus(event: FocusEvent) {
    (event.target as HTMLInputElement).select();
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const digits = text.replace(/\D/g, '').slice(0, 6).split('');
    digits.forEach((d, i) => { this.mfaDigits[i] = d; });
    this.syncInputValues();
    const nextFocus = Math.min(digits.length, 5);
    this.focusBox(nextFocus);
    if (this.isMfaCodeValid()) this.submitMfa();
  }

  private focusBox(index: number) {
    const boxes = this.otpInputs?.toArray();
    boxes?.[index]?.nativeElement.focus();
  }

  private syncInputValues() {
    this.otpInputs?.toArray().forEach((ref, i) => {
      ref.nativeElement.value = this.mfaDigits[i] ?? '';
    });
  }

  // ── MFA submit ─────────────────────────────────────────────────────────────

  isMfaCodeValid(): boolean {
    return this.mfaDigits.every(d => /^\d$/.test(d));
  }

  submitMfa() {
    if (!this.isMfaCodeValid() || this.mfaSubmitting) return;

    const code = this.mfaDigits.join('');
    this.mfaError     = '';
    this.mfaSubmitting = true;

    this.authService.mfaChallenge(this.mfaToken, code)
      .pipe(finalize(() => (this.mfaSubmitting = false)))
      .subscribe({
        next: () => {
          sessionStorage.removeItem('df_greeting_shown');
          this.router.navigate([this.authService.getRedirectPath()]);
        },
        error: (err: HttpErrorResponse) => {
          this.triggerShake();
          if (err.status === 401) {
            this.mfaError = err.error?.error === 'MFA session expired. Please log in again.'
              ? 'Session expired — please log in again.'
              : 'Incorrect code. Try again.';
          } else {
            this.mfaError = 'Verification failed. Please try again.';
          }
          // Clear boxes and refocus on error
          this.mfaDigits = ['', '', '', '', '', ''];
          setTimeout(() => { this.syncInputValues(); this.focusBox(0); }, 360);
        },
      });
  }

  private triggerShake() {
    this.mfaShake = true;
    setTimeout(() => (this.mfaShake = false), 400);
  }

  backToPassword() {
    this.mfaStep   = false;
    this.mfaToken  = '';
    this.mfaDigits = ['', '', '', '', '', ''];
    this.mfaError  = '';
  }
}
