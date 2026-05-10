import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from 'src/app/auth/auth.service';

type SetupPhase = 'check' | 'scan' | 'verify' | 'done' | 'disable';

@Component({
  selector: 'app-mfa-setup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, RouterModule],
  templateUrl: './mfa-setup.component.html',
  styleUrls: ['./mfa-setup.component.scss'],
})
export class MfaSetupComponent implements OnInit {
  private svc   = inject(AuthService);
  private snack = inject(MatSnackBar);
  private cdr   = inject(ChangeDetectorRef);
  private router = inject(Router);

  phase       = signal<SetupPhase>('check');
  mfaEnabled  = signal(false);
  loading     = signal(false);
  error       = signal('');

  // Setup data
  qrDataUrl   = '';
  secret      = '';
  verifyCode  = '';
  verifyError = '';
  verifying   = false;

  // Disable data
  disablePassword = '';
  disableCode     = '';
  disableError    = '';
  disabling       = false;

  ngOnInit(): void {
    this.loading.set(true);
    this.svc.mfaStatus().subscribe({
      next: (s) => {
        this.mfaEnabled.set(s.mfa_enabled);
        this.phase.set(s.mfa_enabled ? 'done' : 'scan');
        this.loading.set(false);
        if (!s.mfa_enabled) this.generateQr();
        this.cdr.markForCheck();
      },
      error: () => {
        this.error.set('Failed to load MFA status.');
        this.loading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  generateQr(): void {
    this.loading.set(true);
    this.svc.mfaSetup().subscribe({
      next: (r) => {
        this.qrDataUrl = r.qr_data_url;
        this.secret    = r.secret;
        this.phase.set('scan');
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.error.set('Failed to generate QR code. Please try again.');
        this.loading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  proceedToVerify(): void {
    this.phase.set('verify');
    this.verifyCode  = '';
    this.verifyError = '';
    this.cdr.markForCheck();
  }

  submitVerify(): void {
    const code = this.verifyCode.replace(/\D/g, '');
    if (code.length !== 6 || this.verifying) return;

    this.verifyError = '';
    this.verifying   = true;
    this.cdr.markForCheck();

    this.svc.mfaEnable({ code }).subscribe({
      next: () => {
        this.verifying = false;
        this.mfaEnabled.set(true);
        this.phase.set('done');
        this.snack.open('Two-factor authentication enabled', 'Close', { duration: 3000 });
        this.cdr.markForCheck();
        setTimeout(() => this.router.navigate(['/schedule']), 3000);
      },
      error: (err) => {
        this.verifying   = false;
        this.verifyError = err?.error?.error || 'Invalid code. Try again.';
        this.cdr.markForCheck();
      },
    });
  }

  openDisable(): void {
    this.phase.set('disable');
    this.disablePassword = '';
    this.disableCode     = '';
    this.disableError    = '';
    this.cdr.markForCheck();
  }

  submitDisable(): void {
    const code = this.disableCode.replace(/\D/g, '');
    if (!this.disablePassword || code.length !== 6 || this.disabling) return;

    this.disableError = '';
    this.disabling    = true;
    this.cdr.markForCheck();

    this.svc.mfaDisable({ password: this.disablePassword, code }).subscribe({
      next: () => {
        this.disabling = false;
        this.mfaEnabled.set(false);
        this.phase.set('scan');
        this.snack.open('Two-factor authentication disabled', 'Close', { duration: 4000 });
        this.generateQr();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.disabling    = false;
        this.disableError = err?.error?.error || 'Verification failed. Check your password and code.';
        this.cdr.markForCheck();
      },
    });
  }

  cancelDisable(): void {
    this.phase.set('done');
    this.cdr.markForCheck();
  }

  goToDashboard(): void {
    this.router.navigate(['/schedule']);
  }

  isVerifyCodeValid(): boolean {
    return this.verifyCode.replace(/\D/g, '').length === 6;
  }

  isDisableReady(): boolean {
    return !!this.disablePassword && this.disableCode.replace(/\D/g, '').length === 6;
  }
}
