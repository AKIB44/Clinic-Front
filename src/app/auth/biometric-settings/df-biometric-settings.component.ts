import {
  Component, ChangeDetectionStrategy, inject, signal, OnInit,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TablerIconsModule } from 'angular-tabler-icons';
import { WebAuthnService, WebAuthnCredentialInfo } from '../webauthn.service';
import { ToastService } from '../../services/toast.service';

type State = 'checking' | 'unavailable' | 'ready';

@Component({
  selector: 'df-biometric-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, MatCardModule, MatButtonModule,
    MatProgressSpinnerModule, TablerIconsModule,
  ],
  templateUrl: './df-biometric-settings.component.html',
  styleUrl: './df-biometric-settings.component.scss',
})
export class DfBiometricSettingsComponent implements OnInit {
  private readonly webauthn = inject(WebAuthnService);
  private readonly toast = inject(ToastService);

  protected readonly state = signal<State>('checking');
  protected readonly busy = signal(false);
  protected readonly creds = signal<WebAuthnCredentialInfo[]>([]);
  protected readonly label = this.webauthn.biometricLabel();

  async ngOnInit(): Promise<void> {
    if (!(await this.webauthn.isPlatformAvailable())) {
      this.state.set('unavailable');
      return;
    }
    await this.reload();
    this.state.set('ready');
  }

  private async reload(): Promise<void> {
    try { this.creds.set(await this.webauthn.listCredentials()); }
    catch { this.creds.set([]); }
  }

  /** Enroll the current device's biometric. */
  protected async registerDevice(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.webauthn.register();
      await this.reload();
      this.toast.success(`${this.label} registered for this device.`);
    } catch (e: unknown) {
      this.toast.error(this.describe(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(c: WebAuthnCredentialInfo): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.webauthn.deleteCredential(c.id);
      await this.reload();
      this.toast.success('Device removed.');
    } catch {
      this.toast.error('Could not remove this device. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  private describe(e: unknown): string {
    const err = e as { name?: string; error?: { error?: string }; message?: string };
    if (err?.name === 'NotAllowedError') return 'Enrollment was cancelled or timed out. Please try again.';
    if (err?.name === 'InvalidStateError') return 'This device is already registered.';
    if (err?.error?.error === 'verification_failed') return 'Verification failed. Please try again.';
    return err?.message || 'Could not register this device. Please try again.';
  }
}
