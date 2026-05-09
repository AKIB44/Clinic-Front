import {
  Component, ElementRef, QueryList, ViewChildren, inject, signal,
} from '@angular/core';
import {
  FormsModule, ReactiveFormsModule,
  FormControl, FormGroup, Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { MaterialModule } from '../../../material.module';
import { AuthService } from 'src/app/auth/auth.service';

@Component({
  selector: 'app-side-two-steps',
  standalone: true,
  imports: [RouterModule, MaterialModule, FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './side-two-steps.component.html',
})
export class AppSideTwoStepsComponent {
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);

  // ── Step 1: Phone entry ───────────────────────────────────────────────────
  readonly step = signal<'phone' | 'otp'>('phone');

  phoneForm = new FormGroup({
    phone: new FormControl('', [
      Validators.required,
      Validators.pattern(/^[6-9]\d{9}$/),
    ]),
  });

  isSending   = false;
  sendError   = '';
  sentPhone   = '';   // store so we can show masked & pass to verify

  // ── Step 2: OTP entry ─────────────────────────────────────────────────────
  otpForm = new FormGroup({
    d1: new FormControl('', [Validators.required, Validators.pattern(/^\d$/)]),
    d2: new FormControl('', [Validators.required, Validators.pattern(/^\d$/)]),
    d3: new FormControl('', [Validators.required, Validators.pattern(/^\d$/)]),
    d4: new FormControl('', [Validators.required, Validators.pattern(/^\d$/)]),
    d5: new FormControl('', [Validators.required, Validators.pattern(/^\d$/)]),
    d6: new FormControl('', [Validators.required, Validators.pattern(/^\d$/)]),
  });

  isVerifying = false;
  otpError    = '';

  // Resend cooldown
  resendCooldown  = 0;
  private _timer: ReturnType<typeof setInterval> | null = null;

  @ViewChildren('digitInput') digitInputs!: QueryList<ElementRef<HTMLInputElement>>;

  // ── Derived ───────────────────────────────────────────────────────────────
  get maskedPhone(): string {
    if (!this.sentPhone) return '';
    return `XXXXXX${this.sentPhone.slice(-4)}`;
  }

  get otp(): string {
    return Object.values(this.otpForm.controls)
      .map(c => (c as FormControl).value ?? '')
      .join('');
  }

  // ── Step 1: request OTP ───────────────────────────────────────────────────
  requestOtp() {
    if (this.phoneForm.invalid || this.isSending) {
      this.phoneForm.markAllAsTouched();
      return;
    }
    this.sendError   = '';
    this.isSending   = true;

    const phone = this.phoneForm.value.phone!.replace(/\D/g, '');

    this.authService.requestOtp(phone)
      .pipe(finalize(() => (this.isSending = false)))
      .subscribe({
        next: () => {
          this.sentPhone = phone;
          this.step.set('otp');
          this.startCooldown();
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 429) {
            this.sendError = err.error?.error ?? 'Please wait before requesting another OTP.';
          } else if (err.status === 0) {
            this.sendError = 'Cannot reach server. Is the backend running?';
          } else {
            this.sendError = err.error?.error ?? 'Failed to send OTP. Please try again.';
          }
        },
      });
  }

  // ── Step 2: verify OTP ────────────────────────────────────────────────────
  verifyOtp() {
    if (this.otp.length < 6 || this.isVerifying) return;
    this.otpError    = '';
    this.isVerifying = true;

    this.authService.verifyOtp({ phone: this.sentPhone, otp: this.otp })
      .pipe(finalize(() => (this.isVerifying = false)))
      .subscribe({
        next: () => this.router.navigate([this.authService.getRedirectPath()]),
        error: (err: HttpErrorResponse) => {
          if (err.status === 401) {
            const msg = err.error?.error ?? 'Incorrect OTP.';
            const rem = err.error?.remaining;
            this.otpError = rem != null ? `${msg} ${rem} attempt${rem !== 1 ? 's' : ''} left.` : msg;
          } else if (err.status === 0) {
            this.otpError = 'Cannot reach server.';
          } else {
            this.otpError = err.error?.error ?? 'Verification failed. Please try again.';
          }
          // Clear the OTP boxes on wrong code
          this.clearOtp();
        },
      });
  }

  // ── Resend ────────────────────────────────────────────────────────────────
  resendOtp() {
    if (this.resendCooldown > 0 || this.isSending) return;
    this.otpError  = '';
    this.isSending = true;
    this.clearOtp();

    this.authService.requestOtp(this.sentPhone)
      .pipe(finalize(() => (this.isSending = false)))
      .subscribe({
        next: () => this.startCooldown(),
        error: (err: HttpErrorResponse) => {
          this.otpError = err.error?.error ?? 'Failed to resend OTP.';
        },
      });
  }

  private startCooldown() {
    this.resendCooldown = 60;
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0 && this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    }, 1000);
  }

  private clearOtp() {
    Object.values(this.otpForm.controls).forEach(c => (c as FormControl).setValue(''));
    this.digitInputs?.first?.nativeElement?.focus();
  }

  // ── OTP digit inputs ──────────────────────────────────────────────────────
  onDigitInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(-1);
    input.value = value;

    const keys = Object.keys(this.otpForm.controls) as (keyof typeof this.otpForm.controls)[];
    (this.otpForm.controls[keys[index]] as FormControl).setValue(value);

    if (value && index < 5) {
      this.digitInputs.get(index + 1)?.nativeElement.focus();
    }
    // Auto-submit when last digit entered
    if (value && index === 5 && this.otp.length === 6) {
      this.verifyOtp();
    }
  }

  onDigitPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pasted = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 6);
    if (!pasted.length) return;
    const keys = Object.keys(this.otpForm.controls) as (keyof typeof this.otpForm.controls)[];
    pasted.split('').forEach((ch, i) => {
      (this.otpForm.controls[keys[i]] as FormControl).setValue(ch);
      const el = this.digitInputs.get(i);
      if (el) el.nativeElement.value = ch;
    });
    const lastFilled = Math.min(pasted.length - 1, 5);
    this.digitInputs.get(lastFilled)?.nativeElement.focus();
    if (pasted.length === 6) this.verifyOtp();
  }

  onKeydown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace') {
      const keys = Object.keys(this.otpForm.controls) as (keyof typeof this.otpForm.controls)[];
      const ctrl = this.otpForm.controls[keys[index]] as FormControl;
      if (!ctrl.value && index > 0) {
        this.digitInputs.get(index - 1)?.nativeElement.focus();
      }
    }
  }

  goBack() {
    this.step.set('phone');
    this.otpError = '';
    this.clearOtp();
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.resendCooldown = 0;
  }
}
