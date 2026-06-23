import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TablerIconsModule } from 'angular-tabler-icons';
import { WebAuthnService } from '../webauthn.service';

type GateState = 'checking' | 'unavailable' | 'enroll' | 'ready' | 'working' | 'error';

@Component({
  selector: 'app-biometric-gate-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatDialogModule, MatButtonModule, TablerIconsModule],
  templateUrl: './biometric-gate-dialog.component.html',
  styleUrl: './biometric-gate-dialog.component.scss',
})
export class BiometricGateDialogComponent implements OnInit {
  private readonly webauthn = inject(WebAuthnService);
  private readonly ref = inject(MatDialogRef<BiometricGateDialogComponent, boolean>);

  protected readonly state = signal<GateState>('checking');
  protected readonly errorMsg = signal<string>('');

  async ngOnInit(): Promise<void> {
    if (!(await this.webauthn.isPlatformAvailable())) {
      this.state.set('unavailable');
      return;
    }
    try {
      const creds = await this.webauthn.listCredentials();
      this.state.set(creds.length ? 'ready' : 'enroll');
    } catch {
      // Treat a listing failure as "needs enrollment" rather than hard-blocking.
      this.state.set('enroll');
    }
  }

  /** Enroll this device, then immediately run the unlock ceremony. */
  protected async enroll(): Promise<void> {
    this.run(async () => {
      await this.webauthn.register();
      await this.webauthn.authenticate();
    });
  }

  protected async unlock(): Promise<void> {
    this.run(() => this.webauthn.authenticate());
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    this.errorMsg.set('');
    this.state.set('working');
    try {
      await action();
      this.ref.close(true);
    } catch (e: unknown) {
      this.state.set('error');
      this.errorMsg.set(this.describe(e));
    }
  }

  protected cancel(): void {
    this.ref.close(false);
  }

  private describe(e: unknown): string {
    const err = e as { name?: string; error?: { error?: string }; message?: string };
    if (err?.name === 'NotAllowedError') return 'Authentication was cancelled or timed out. Please try again.';
    if (err?.name === 'InvalidStateError') return 'This device is already enrolled. Try unlocking instead.';
    const apiErr = err?.error?.error;
    if (apiErr === 'not_enrolled') return 'No biometric is enrolled for your account on this device.';
    if (apiErr === 'verification_failed') return 'Verification failed. Please try again.';
    return err?.message || 'Something went wrong. Please try again.';
  }
}
